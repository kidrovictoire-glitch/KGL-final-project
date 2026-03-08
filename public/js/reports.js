(function () {
      function validSession() {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        const branch = localStorage.getItem('branch');
        return !!token && role === 'director' && (!branch || branch === 'All');
      }
      function redirectToLogin() {
        window.location.replace('index.html');
      }
      function guardSession() {
        if (validSession()) return;
        const b = document.createElement('div');
        b.className = 'banner banner-error';
        b.innerText = 'Access denied: director role required. Redirecting to login...';
        document.body.insertBefore(b, document.body.firstChild);
        setTimeout(redirectToLogin, 300);
      }
      window.addEventListener('pageshow', guardSession);
      window.addEventListener('popstate', guardSession);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') guardSession();
      });
      guardSession();
    })();

    function ugx(v) { return 'UGX ' + (Number(v) || 0).toLocaleString(); }
    function toDate(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
    function inRange(d, from, to) {
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }

    function getState() {
      return {
        sales: JSON.parse(localStorage.getItem('sales') || '[]'),
        credits: JSON.parse(localStorage.getItem('credits') || '[]'),
        procurements: JSON.parse(localStorage.getItem('procurements') || '[]'),
        inventoryByBranch: JSON.parse(localStorage.getItem('inventoryByBranch') || '{"Maganjo":{},"Matugga":{}}'),
        prices: JSON.parse(localStorage.getItem('prices') || '{}')
      };
    }

    function buildRows(filters) {
      const { sales, credits, procurements, inventoryByBranch, prices } = getState();
      const from = filters.fromDate ? new Date(filters.fromDate + 'T00:00:00') : null;
      const to = filters.toDate ? new Date(filters.toDate + 'T23:59:59') : null;
      const wantBranch = filters.branch;
      const type = filters.type;

      const rows = [];

      if (type === 'all' || type === 'cash') {
        sales.forEach(s => {
          if (wantBranch !== 'All' && s.branch !== wantBranch) return;
          const d = toDate((s.date || s.created));
          if (!inRange(d, from, to)) return;
          rows.push({
            category: 'Cash Sale',
            branch: s.branch,
            date: s.date || '',
            produce: s.produce || '',
            tonnage: Number(s.tonnage || 0),
            amount: Number(s.amount || 0),
            actor: s.agent || ''
          });
        });
      }

      if (type === 'all' || type === 'credit') {
        credits.forEach(c => {
          if (wantBranch !== 'All' && c.branch !== wantBranch) return;
          const d = toDate((c.dispatch || c.created));
          if (!inRange(d, from, to)) return;
          rows.push({
            id: c.id || '',
            category: 'Credit Sale',
            branch: c.branch,
            date: c.dispatch || '',
            produce: c.produce || '',
            tonnage: Number(c.tonnage || 0),
            amount: Number(c.amountDue || 0),
            actor: c.agent || ''
          });
        });
      }

      if (type === 'all' || type === 'procurement') {
        procurements.forEach(p => {
          if (wantBranch !== 'All' && p.branch !== wantBranch) return;
          const d = toDate((p.date || p.created));
          if (!inRange(d, from, to)) return;
          rows.push({
            category: 'Procurement',
            branch: p.branch,
            date: p.date || '',
            produce: p.name || '',
            tonnage: Number(p.tonnage || 0),
            amount: Number(p.cost || 0),
            actor: p.dealer || ''
          });
        });
      }

      if (type === 'inventory') {
        ['Maganjo', 'Matugga'].forEach(branch => {
          if (wantBranch !== 'All' && branch !== wantBranch) return;
          Object.keys(inventoryByBranch[branch] || {}).forEach(product => {
            const qty = Number(inventoryByBranch[branch][product] || 0);
            const val = qty * Number(prices[product] || 0);
            rows.push({
              category: 'Inventory',
              branch,
              date: '',
              produce: product,
              tonnage: qty,
              amount: val,
              actor: 'Stock Snapshot'
            });
          });
        });
      }

      rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return rows;
    }

    function renderSummary(rows) {
      const cashRevenue = rows.filter(r => r.category === 'Cash Sale').reduce((s, r) => s + r.amount, 0);
      const creditDue = rows.filter(r => r.category === 'Credit Sale').reduce((s, r) => s + r.amount, 0);
      const procurementCost = rows.filter(r => r.category === 'Procurement').reduce((s, r) => s + r.amount, 0);
      const movedTonnage = rows.reduce((s, r) => s + r.tonnage, 0);

      document.getElementById('sumCashRevenue').innerText = ugx(cashRevenue);
      document.getElementById('sumCreditDue').innerText = ugx(creditDue);
      document.getElementById('sumProcurementCost').innerText = ugx(procurementCost);
      document.getElementById('sumTonnage').innerText = movedTonnage.toLocaleString() + ' Kg';
    }

    function renderTable(rows) {
      const head = document.getElementById('reportHeadRow');
      const body = document.getElementById('reportBody');
      const empty = document.getElementById('reportEmpty');

      head.innerHTML = ['Type', 'Branch', 'Date', 'Produce', 'Tonnage (Kg)', 'Amount (UGX)', 'Recorded By/Source', 'Action']
        .map(h => `<th>${h}</th>`).join('');
      body.innerHTML = rows.map(r => (
        `<tr>
      <td>${r.category}</td>
      <td>${r.branch}</td>
      <td>${r.date || '-'}</td>
      <td>${r.produce}</td>
      <td>${Number(r.tonnage || 0).toLocaleString()}</td>
      <td>${Number(r.amount || 0).toLocaleString()}</td>
      <td>${r.actor}</td>
      <td>${r.category === 'Credit Sale' && r.id ? `<button class="btn btn-sm btn-outline-danger" data-del-credit-report="${r.id}">Delete</button>` : '<span class="text-muted">-</span>'}</td>
    </tr>`
      )).join('');

      if (!rows.length) empty.classList.remove('hidden-section');
      else empty.classList.add('hidden-section');
    }

    function currentFilters() {
      return {
        branch: document.getElementById('filterBranch').value,
        type: document.getElementById('filterType').value,
        fromDate: document.getElementById('fromDate').value,
        toDate: document.getElementById('toDate').value
      };
    }

    function rerender() {
      const rows = buildRows(currentFilters());
      renderSummary(rows);
      renderTable(rows);
    }

    function exportCsv(rows) {
      const headers = ['Type', 'Branch', 'Date', 'Produce', 'Tonnage (Kg)', 'Amount (UGX)', 'Recorded By/Source'];
      const lines = [
        headers.join(','),
        ...rows.map(r => [
          r.category, r.branch, r.date || '-', r.produce, r.tonnage, r.amount, r.actor
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const d = new Date().toISOString().slice(0, 10);
      a.download = `kgl-report-${d}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    document.getElementById('applyFiltersBtn').addEventListener('click', rerender);
    document.getElementById('refreshDataBtn').addEventListener('click', async function () {
      try {
        await window.KGLApi.syncState();
        rerender();
      } catch (err) {
        window.alert(err.message || 'Failed to sync data.');
      }
    });
    document.getElementById('exportCsvBtn').addEventListener('click', function () {
      const rows = buildRows(currentFilters());
      exportCsv(rows);
    });
    document.getElementById('exportPdfBtn').addEventListener('click', function () {
      window.print();
    });

    document.getElementById('reportBody').addEventListener('click', async function (e) {
      const id = e.target && e.target.getAttribute('data-del-credit-report');
      if (!id) return;
      if (!window.confirm('Delete this credit sale record? The dispatched stock will be restored to branch inventory.')) return;
      try {
        await window.KGLApi.deleteCreditSale(id);
        await window.KGLApi.syncState();
        rerender();
      } catch (err) {
        window.alert(err.message || 'Failed to delete credit sale record.');
      }
    });

    async function boot() {
      try {
        await window.KGLApi.syncState();
        const today = new Date().toISOString().slice(0, 10);
        document.getElementById('toDate').value = today;
        rerender();
      } catch (err) {
        const b = document.createElement('div');
        b.className = 'banner banner-error';
        b.innerText = 'Session expired. Redirecting to login...';
        document.body.insertBefore(b, document.body.firstChild);
        setTimeout(() => window.location.replace('index.html'), 300);
      }
    }

    document.addEventListener('DOMContentLoaded', boot);
