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

    const PRODUCE = ['Beans', 'Grain Maize', 'Cow Peas', 'G-nuts', 'Soybeans'];
    let STAFF_CACHE = [];
    let ACCOUNT_REQ_CACHE = [];

    function ugx(v) { return 'UGX ' + (Number(v) || 0).toLocaleString(); }
    function fmtDateTime(v) {
      const d = v ? new Date(v) : null;
      if (!d || isNaN(d.getTime())) return '-';
      return d.toLocaleString();
    }
    function parseDate(v) { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
    function inWindow(d, start, end) { return !!d && d >= start && d <= end; }

    function readSales() { return JSON.parse(localStorage.getItem('sales') || '[]'); }
    function readCredits() { return JSON.parse(localStorage.getItem('credits') || '[]'); }
    function readPrices() { return JSON.parse(localStorage.getItem('prices') || '{}'); }
    function readInv() { return JSON.parse(localStorage.getItem('inventoryByBranch') || '{"Maganjo":{},"Matugga":{}}'); }

    function readStaff() {
      if (!localStorage.getItem('staff')) {
        localStorage.setItem('staff', JSON.stringify([
          { name: 'Orban', role: 'Director', branch: 'All', password: 'orban123' },
          { name: 'Branch Manager', role: 'Manager', branch: 'Maganjo', password: 'manager123' },
          { name: 'Branch Manager', role: 'Manager', branch: 'Matugga', password: 'manager123' }
        ]));
      }
      return JSON.parse(localStorage.getItem('staff') || '[]');
    }

    function saveStaff(staff) {
      localStorage.setItem('staff', JSON.stringify(staff));
    }

    function normalizeRole(role) {
      const r = String(role || '').toLowerCase();
      if (r === 'director') return 'Director';
      if (r === 'manager') return 'Manager';
      return 'Agent';
    }

    function uiRoleToApi(role) {
      return String(role || '').toLowerCase();
    }

    function computeRevenueCards() {
      const sales = readSales();
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(dayStart); weekStart.setDate(weekStart.getDate() - 6);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      let daily = 0, weekly = 0, monthly = 0, annual = 0;
      let magRev = 0, matRev = 0;

      sales.forEach(s => {
        const d = parseDate((s.date ? s.date : s.created));
        const amt = Number(s.amount) || 0;
        if (inWindow(d, dayStart, now)) daily += amt;
        if (inWindow(d, weekStart, now)) weekly += amt;
        if (inWindow(d, monthStart, now)) monthly += amt;
        if (inWindow(d, yearStart, now)) annual += amt;
        if (s.branch === 'Maganjo') magRev += amt;
        if (s.branch === 'Matugga') matRev += amt;
      });

      const credits = readCredits();
      const magCredit = credits.filter(c => c.branch === 'Maganjo').reduce((s, c) => s + (Number(c.amountDue) || 0), 0);
      const matCredit = credits.filter(c => c.branch === 'Matugga').reduce((s, c) => s + (Number(c.amountDue) || 0), 0);

      document.getElementById('dailySales').innerText = ugx(daily);
      document.getElementById('weeklySales').innerText = ugx(weekly);
      document.getElementById('monthlySales').innerText = ugx(monthly);
      document.getElementById('annualSales').innerText = ugx(annual);
      document.getElementById('magRevenue').innerText = ugx(magRev);
      document.getElementById('matRevenue').innerText = ugx(matRev);
      document.getElementById('magCredit').innerText = ugx(magCredit);
      document.getElementById('matCredit').innerText = ugx(matCredit);
    }

    function computeStockCards() {
      const prices = readPrices();
      const inv = readInv();
      const branches = ['Maganjo', 'Matugga'];

      let totalValue = 0, low = 0, out = 0;
      let magVal = 0, matVal = 0, magUnits = 0, matUnits = 0, magLow = 0, matLow = 0;

      branches.forEach(b => {
        PRODUCE.forEach(p => {
          const q = Number((inv[b] || {})[p] || 0);
          const val = q * (Number(prices[p]) || 0);
          totalValue += val;
          if (q <= 0) out++;
          if (q > 0 && q < 500) low++;
          if (b === 'Maganjo') { magVal += val; magUnits += q; if (q > 0 && q < 500) magLow++; }
          if (b === 'Matugga') { matVal += val; matUnits += q; if (q > 0 && q < 500) matLow++; }
        });
      });

      document.getElementById('totalStockValue').innerText = ugx(totalValue);
      document.getElementById('lowStockItems').innerText = low;
      document.getElementById('outStockItems').innerText = out;
      document.getElementById('trackedProducts').innerText = PRODUCE.length;
      document.getElementById('magStockValue').innerText = ugx(magVal);
      document.getElementById('matStockValue').innerText = ugx(matVal);
      document.getElementById('magUnits').innerText = magUnits.toLocaleString();
      document.getElementById('matUnits').innerText = matUnits.toLocaleString();
      document.getElementById('magLow').innerText = magLow;
      document.getElementById('matLow').innerText = matLow;
    }

    function loadStaff() {
      const rows = document.getElementById('staffRows');
      rows.innerHTML = '';
      const staff = readStaff().filter(s => s && String(s.name || '').trim() && String(s.branch || '').trim());
      STAFF_CACHE = staff;

      staff.forEach((s, idx) => {
        const tr = document.createElement('tr');
        const rowId = s.id || String(idx);
        const displayName = s.name || '';
        const displayRole = normalizeRole(s.role);
        const displayBranch = s.branch || '';
        const displayPassword = s.password || '********';

        tr.innerHTML = `<td>${displayName}</td><td><span class="badge bg-info-subtle text-info border border-info">${displayRole}</span></td><td>${displayBranch}</td><td>${displayPassword}</td><td>
      <button class="btn btn-sm text-warning" data-action="edit" data-id="${rowId}"><i class="bi bi-pencil-square"></i></button>
      <button class="btn btn-sm text-danger" data-action="delete" data-id="${rowId}"><i class="bi bi-trash3"></i></button>
    </td>`;

        rows.appendChild(tr);
      });
    }

    async function loadAccountChangeRequests() {
      const rows = document.getElementById('accountChangeRows');
      const msg = document.getElementById('accountReqMsg');
      if (!rows || !msg) return;
      rows.innerHTML = '';
      msg.textContent = '';

      try {
        const list = await window.KGLApi.getAccountChangeRequests();
        ACCOUNT_REQ_CACHE = Array.isArray(list) ? list : [];
      } catch (err) {
        msg.textContent = err.message || 'Failed to load account change requests.';
        return;
      }

      if (!ACCOUNT_REQ_CACHE.length) {
        rows.innerHTML = '<tr><td colspan="6" class="text-muted">No account change requests yet.</td></tr>';
        return;
      }

      rows.innerHTML = ACCOUNT_REQ_CACHE.map((r) => {
        const statusClass = r.status === 'approved' ? 'success' : (r.status === 'rejected' ? 'danger' : 'warning');
        const canAct = r.status === 'pending';
        const reqName = r.requestedName ? r.requestedName : '<span class="text-muted">No name change</span>';
        const passCell = r.hasPasswordChange ? '<span class="text-warning">Requested</span>' : '<span class="text-muted">No</span>';
        const staff = `${r.requestedByName} (${normalizeRole(r.requestedByRole)} - ${r.requestedByBranch})`;
        const actions = canAct
          ? `<button class="btn btn-sm btn-success me-1" data-req-action="approve" data-id="${r.id}">Approve</button>
             <button class="btn btn-sm btn-outline-danger" data-req-action="reject" data-id="${r.id}">Reject</button>`
          : '<span class="text-muted">Processed</span>';
        return `<tr>
          <td>${staff}</td>
          <td>${reqName}</td>
          <td>${passCell}</td>
          <td><span class="badge bg-${statusClass}-subtle text-${statusClass} border border-${statusClass}">${r.status}</span></td>
          <td>${fmtDateTime(r.createdAt)}</td>
          <td>${actions}</td>
        </tr>`;
      }).join('');
    }

    async function handleAccountRequestAction(id, action) {
      const note = window.prompt(`Optional note for ${action}:`, '') || '';
      try {
        if (action === 'approve') {
          await window.KGLApi.approveAccountChangeRequest(id, { note });
        } else {
          await window.KGLApi.rejectAccountChangeRequest(id, { note });
        }
        await window.KGLApi.syncState();
        await loadStaff();

      } catch (err) {
        const msg = document.getElementById('accountReqMsg');
        msg.textContent = err.message || `Failed to ${action} request.`;
      }
    }

    function openAddStaffModal() {
      document.getElementById('staffModalTitle').innerText = 'Register New Staff';
      document.getElementById('staffSubmitBtn').innerText = 'Create Account';
      document.getElementById('staffEditIndex').value = '-1';
      document.getElementById('staffName').value = '';
      document.getElementById('staffRole').value = 'Manager';
      document.getElementById('staffBranch').value = 'Maganjo';
      document.getElementById('staffPassword').value = '';
    }

    function openEditStaffModal(id) {
      const item = STAFF_CACHE.find(s => (s.id || '') === id) || STAFF_CACHE[Number(id)];
      if (!item) return;

      document.getElementById('staffModalTitle').innerText = 'Edit Staff';
      document.getElementById('staffSubmitBtn').innerText = 'Update Staff';
      document.getElementById('staffEditIndex').value = String(item.id || '');
      document.getElementById('staffName').value = item.name || '';
      document.getElementById('staffRole').value = normalizeRole(item.role) || 'Agent';
      document.getElementById('staffBranch').value = item.branch || 'Maganjo';
      document.getElementById('staffPassword').value = '';

      bootstrap.Modal.getOrCreateInstance(document.getElementById('addUserModal')).show();
    }

    async function deleteStaff(id) {
      const item = STAFF_CACHE.find(s => (s.id || '') === id) || STAFF_CACHE[Number(id)];
      if (!item) return;

      const ok = window.confirm(`Delete ${item.name} (${item.role}) from ${item.branch}?`);
      if (!ok) return;

      try {
        await window.KGLApi.deleteStaff(item.id || id);
        await window.KGLApi.syncState();
        loadStaff();
      } catch (err) {
        window.alert(err.message || 'Failed to delete staff.');
      }
    }

    document.getElementById('openAddStaffBtn').addEventListener('click', openAddStaffModal);

    document.getElementById('staffRows').addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');

      if (action === 'edit') openEditStaffModal(id);
      if (action === 'delete') deleteStaff(id);
    });

    const accountChangeRowsEl = document.getElementById('accountChangeRows');
    if (accountChangeRowsEl) {
      accountChangeRowsEl.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-req-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-req-action');
        const id = btn.getAttribute('data-id');
        if (!id || !action) return;
        handleAccountRequestAction(id, action);
      });
    }

    document.getElementById('staffForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const name = document.getElementById('staffName').value.trim();
      const role = document.getElementById('staffRole').value;
      const branch = document.getElementById('staffBranch').value;
      const password = document.getElementById('staffPassword').value.trim();
      const editId = document.getElementById('staffEditIndex').value;

      try {
        if (editId && editId !== '-1') {
          const payload = { name, role: uiRoleToApi(role), branch };
          if (password) payload.password = password;
          await window.KGLApi.updateStaff(editId, payload);
        } else {
          if (password.length < 4) return;
          await window.KGLApi.createStaff({ name, role: uiRoleToApi(role), branch, password });
        }
        await window.KGLApi.syncState();
        loadStaff();
        this.reset();
        document.getElementById('staffEditIndex').value = '-1';
        bootstrap.Modal.getOrCreateInstance(document.getElementById('addUserModal')).hide();
      } catch (err) {
        window.alert(err.message || 'Failed to save staff.');
      }
    });

    document.getElementById('staffRole').addEventListener('change', function (e) {
      const role = String(e.target.value || '').toLowerCase();
      const branchSelect = document.getElementById('staffBranch');
      if (role === 'director') {
        branchSelect.value = 'All';
      } else if (branchSelect.value === 'All') {
        branchSelect.value = 'Maganjo';
      }
    });

    function showSection(id) {
      document.getElementById('agg-section').classList.add('hidden-section');
      document.getElementById('stock-section').classList.add('hidden-section');
      document.getElementById('user-section').classList.add('hidden-section');
      document.getElementById(id).classList.remove('hidden-section');

      document.querySelectorAll('.nav-link[data-section]').forEach(link => link.classList.remove('active'));
      const active = document.querySelector(`.nav-link[data-section="${id}"]`);
      if (active) active.classList.add('active');

      const label = id === 'agg-section' ? 'Global Analytics' : id === 'stock-section' ? 'Stock Aggregates' : 'User Management';
      document.getElementById('breadcrumb').innerHTML = `Director / <strong>${label}</strong>`;
    }

    function logoutNow() {
      window.KGLApi.logout();
      window.location.replace('index.html');
    }

    async function boot() {
      try {
        await window.KGLApi.syncState();
        const a = await window.KGLApi.getDirectorAggregates();
        document.getElementById('dailySales').innerText = ugx(a.dailySales);
        document.getElementById('weeklySales').innerText = ugx(a.weeklySales);
        document.getElementById('monthlySales').innerText = ugx(a.monthlySales);
        document.getElementById('annualSales').innerText = ugx(a.annualSales);
        document.getElementById('magRevenue').innerText = ugx(a.magRevenue);
        document.getElementById('matRevenue').innerText = ugx(a.matRevenue);
        document.getElementById('magCredit').innerText = ugx(a.magCredit);
        document.getElementById('matCredit').innerText = ugx(a.matCredit);
        document.getElementById('totalStockValue').innerText = ugx(a.totalStockValue);
        document.getElementById('lowStockItems').innerText = a.lowStockItems;
        document.getElementById('outStockItems').innerText = a.outStockItems;
        document.getElementById('trackedProducts').innerText = a.trackedProducts;
        document.getElementById('magStockValue').innerText = ugx(a.magStockValue);
        document.getElementById('matStockValue').innerText = ugx(a.matStockValue);
        document.getElementById('magUnits').innerText = Number(a.magUnits || 0).toLocaleString();
        document.getElementById('matUnits').innerText = Number(a.matUnits || 0).toLocaleString();
        document.getElementById('magLow').innerText = a.magLow;
        document.getElementById('matLow').innerText = a.matLow;
        loadStaff();

      } catch (err) {
        const b = document.createElement('div');
        b.className = 'banner banner-error';
        b.innerText = 'Session expired. Redirecting to login...';
        document.body.insertBefore(b, document.body.firstChild);
        setTimeout(() => window.location.replace('index.html'), 300);
      }
    }

    document.addEventListener('DOMContentLoaded', boot);
