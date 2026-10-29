

const AdminController = (() => {

  
  async function _run(fn) {
    AdminState.setLoading(true);
    AdminUI.setLoading(true);
    try {
      return await fn();
    } catch (err) {
      AdminUI.toast('error', 'Error', err.message || 'Something went wrong');
      console.error('[AdminController]', err);
    } finally {
      AdminState.setLoading(false);
      AdminUI.setLoading(false);
    }
  }

  
  const TAB_LOADERS = {
    overview:     loadOverview,
    bookings:     loadBookings,
    payments:     loadPayments,
    transactions: loadTransactions,
    users:        loadUsers,
    notify:       loadNotify,
    messages:     loadMessages,
    promos:       loadPromos,
    licenses:     loadLicenses,
    uploads:      loadUploads,
    logs:         loadLogs,
  };

  function navigate(tab) {
    AdminState.setTab(tab);
    AdminUI.setActiveTab(tab);
    const loader = TAB_LOADERS[tab];
    if (loader) loader();
  }

  function refresh() {
    const tab = AdminState.get('currentTab');
    const loader = TAB_LOADERS[tab];
    if (loader) loader();
  }

  
  async function loadOverview() {
    await _run(async () => {
      const stats = await AdminAPI.fetchStats();
      AdminState.setState({ stats, bookings: stats.recentBookings || AdminState.get('bookings') });
      AdminUI.renderStats(stats);
      AdminUI.renderLiveFeed(stats.recentBookings || []);
    });
  }

  
  async function loadBookings() {
    await _run(async () => {
      const bookings = await AdminAPI.fetchBookings();
      AdminState.setState({ bookings });
      AdminUI.renderBookings(bookings);
    });
  }

  function filterBookings(status, btn) {
    document.querySelectorAll('#t_bookings .trip-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const all = AdminState.get('bookings');
    AdminUI.renderBookings(status === 'all' ? all : all.filter(b => b.status === status));
  }

  async function approveBooking(id) {
    const note = prompt('Note for user (optional):') || 'Booking approved by admin';
    await _run(async () => {
      await AdminAPI.updateBooking(id, { status: 'confirmed', paymentStatus: 'paid', adminNote: note });
      AdminState.updateItem('bookings', id, { status: 'confirmed', paymentStatus: 'paid', adminNote: note });
      AdminUI.toast('success', 'Approved!');
      loadBookings();
    });
  }

  async function confirmPayment(id) {
    await _run(async () => {
      await AdminAPI.updateBooking(id, { status: 'confirmed', paymentStatus: 'paid', adminNote: 'Payment verified by admin' });
      AdminState.updateItem('bookings', id, { status: 'confirmed', paymentStatus: 'paid' });
      AdminUI.toast('success', 'Payment confirmed!');
      loadBookings();
    });
  }

  async function cancelBooking(id) {
    const reason = prompt('Reason for cancellation (required - shown to user):');
    if (!reason) { AdminUI.toast('error', 'Reason required'); return; }
    await _run(async () => {
      await AdminAPI.updateBooking(id, { status: 'cancelled', adminNote: reason });
      AdminState.updateItem('bookings', id, { status: 'cancelled', adminNote: reason });
      AdminUI.toast('info', 'Cancelled');
      loadBookings();
    });
  }

  async function saveBookingEdits(id, leg) {
    const form = document.getElementById(`editBookingForm-${id}`);
    if (!form) return;
    const flightFields = [
      'from','to','airline','flightNumber','departureDate','depTime','arrTime',
      'duration','stops','type','aircraft','details',
    ];
    const flight = Object.fromEntries(flightFields.map(name => [
      name,
      form.elements.namedItem(name).value.trim(),
    ]));
    const totalValue = form.elements.namedItem('totalAmount').value.trim();
    const totalAmount = Number(totalValue);
    if (!totalValue || !Number.isFinite(totalAmount) || totalAmount < 0 || totalAmount > 1000000) {
      AdminUI.toast('error', 'Invalid booking total', 'Enter an amount between $0 and $1,000,000.');
      return;
    }
    const updates = {
      flightLeg: leg,
      flight,
      totalAmount,
      status: form.elements.namedItem('status').value,
      paymentStatus: form.elements.namedItem('paymentStatus').value,
      adminNote: form.elements.namedItem('adminNote').value.trim(),
    };
    await _run(async () => {
      const saved = await AdminAPI.updateBooking(id, updates);
      const current = (AdminState.get('bookings') || []).find(item => item.id === id) || {};
      const updatedBooking = { ...current, ...saved };
      AdminState.updateItem('bookings', id, updatedBooking);
      AdminUI.renderBookingDetail(updatedBooking, leg);
      AdminUI.toast('success', 'Booking updated', 'Flight, price and status changes were saved and the user was notified.');
      loadBookings();
    });
  }

  async function openBookingDetail(id, leg = 'outboundFlight') {
    const bookings = AdminState.get('bookings');
    let b = bookings.find(x => x.id === id);
    if (!b) {
      
      const fresh = await AdminAPI.fetchBookings().catch(() => []);
      AdminState.setState({ bookings: fresh });
      b = fresh.find(x => x.id === id);
    }
    if (!b) return;
    AdminUI.renderBookingDetail(b, leg);
  }

  
  async function loadPayments() {
    await _run(async () => {
      let bookings = AdminState.get('bookings');
      if (!bookings.length) {
        bookings = await AdminAPI.fetchBookings();
        AdminState.setState({ bookings });
      }
      const pending = bookings.filter(b =>
        b.paymentStatus === 'proof_submitted' || b.paymentStatus === 'pending'
      );
      AdminUI.renderPayments(pending);
    });
  }

  async function approvePayment(id) {
    const note = document.getElementById(`nr_${id}`)?.value || 'Payment verified by admin';
    await _run(async () => {
      await AdminAPI.updateBooking(id, { status: 'confirmed', paymentStatus: 'paid', adminNote: note });
      AdminState.updateItem('bookings', id, { status: 'confirmed', paymentStatus: 'paid', adminNote: note });
      AdminUI.toast('success', 'Approved! User notified.');
      loadPayments();
    });
  }

  async function rejectPayment(id) {
    const note = document.getElementById(`nr_${id}`)?.value;
    if (!note) { AdminUI.toast('error', 'Add reason', 'Please write a reason so the user knows what to do.'); return; }
    await _run(async () => {
      await AdminAPI.updateBooking(id, { paymentStatus: 'pending', adminNote: note });
      AdminState.updateItem('bookings', id, { paymentStatus: 'pending', adminNote: note });
      AdminUI.toast('info', 'Rejected. User notified.');
      loadPayments();
    });
  }

  
  async function loadTransactions() {
    await _run(async () => {
      const transactions = await AdminAPI.fetchTransactions();
      AdminState.setState({ transactions });
      AdminUI.renderTransactions(transactions);
    });
  }

  
  async function loadUsers() {
    await _run(async () => {
      const users = await AdminAPI.fetchUsers();
      AdminState.setState({ users });
      AdminUI.renderUsers(users);
    });
  }

  async function toggleUser(id, name, isActive) {
    if (!confirm(`${isActive ? 'Disable' : 'Enable'} ${name}?`)) return;
    await _run(async () => {
      await AdminAPI.toggleUser(id);
      AdminState.updateItem('users', id, { isActive: !isActive });
      AdminUI.toast('success', 'Updated');
      loadUsers();
    });
  }

  async function deleteUser(id, name) {
    if (!confirm(`Permanently delete user "${name}"? This cannot be undone.`)) return;
    await _run(async () => {
      await AdminAPI.deleteUser(id);
      AdminState.removeItem('users', id);
      AdminUI.toast('success', `User ${name} deleted`);
      AdminUI.renderUsers(AdminState.get('users'));
    });
  }

  
  async function loadNotify() {
    await _run(async () => {
      let users = AdminState.get('users');
      if (!users.length) {
        users = await AdminAPI.fetchUsers();
        AdminState.setState({ users });
      }
      AdminUI.renderUserDropdown(users);
    });
  }

  async function sendNotification() {
    const userId = document.getElementById('notifyUsr').value;
    const type   = document.getElementById('notifyTyp').value;
    const title  = document.getElementById('notifyTtl').value.trim();
    const msg    = document.getElementById('notifyMsg').value.trim();
    if (!userId || !title || !msg) { AdminUI.toast('error', 'Fill all fields'); return; }
    await _run(async () => {
      await AdminAPI.sendNotification(userId, type, title, msg);
      AdminUI.toast('success', 'Notification sent!');
      document.getElementById('notifyTtl').value = '';
      document.getElementById('notifyMsg').value = '';
    });
  }

  async function broadcastNotification() {
    const type  = document.getElementById('bcTyp').value;
    const title = document.getElementById('bcTtl').value.trim();
    const msg   = document.getElementById('bcMsg').value.trim();
    if (!title || !msg) { AdminUI.toast('error', 'Fill all fields'); return; }
    if (!confirm(`Broadcast "${title}" to ALL users?`)) return;
    await _run(async () => {
      const r = await AdminAPI.broadcastNotification(type, title, msg);
      AdminUI.toast('success', `Sent to ${r.sent} users!`);
      document.getElementById('bcTtl').value = '';
      document.getElementById('bcMsg').value = '';
    });
  }

  function goToNotifyUser(userId, ref) {
    navigate('notify');
    setTimeout(async () => {
      let users = AdminState.get('users');
      if (!users.length) {
        users = await AdminAPI.fetchUsers().catch(() => []);
        AdminState.setState({ users });
      }
      AdminUI.renderUserDropdown(users);
      setTimeout(() => {
        const sel = document.getElementById('notifyUsr');
        if (sel) sel.value = userId;
        const ttl = document.getElementById('notifyTtl');
        if (ttl) ttl.value = `Update on booking ${ref}`;
      }, 300);
    }, 100);
  }

  
  async function loadMessages() {
    await _run(async () => {
      const messages = await AdminAPI.fetchMessages();
      AdminState.setState({ messages });
      AdminUI.renderMessages(messages);
    });
  }

  async function markMessageRead(id) {
    await _run(async () => {
      await AdminAPI.updateMessage(id, { status: 'read' });
      AdminState.updateItem('messages', id, { status: 'read' });
      AdminUI.renderMessages(AdminState.get('messages'));
    });
  }

  async function replyMessage(id, userId) {
    const r = document.getElementById(`rep_${id}`)?.value?.trim();
    if (!r) { AdminUI.toast('error', 'Enter reply'); return; }
    await _run(async () => {
      await AdminAPI.updateMessage(id, { reply: r, status: 'replied', userId });
      AdminState.updateItem('messages', id, { reply: r, status: 'replied' });
      AdminUI.toast('success', 'Sent!');
      AdminUI.renderMessages(AdminState.get('messages'));
    });
  }

  async function clearAllMessages() {
    if (!confirm('Delete ALL messages? This cannot be undone.')) return;
    await _run(async () => {
      await AdminAPI.deleteAllMessages();
      AdminState.setState({ messages: [] });
      AdminUI.toast('success', 'All messages cleared');
      AdminUI.updateBadge('messages', 0);
      AdminUI.renderMessages([]);
    });
  }

  async function deleteMessage(id) {
    await _run(async () => {
      await AdminAPI.deleteMessage(id);
      AdminState.removeItem('messages', id);
      AdminUI.updateBadge('messages', AdminState.get('messages').filter(m => m.status === 'unread').length);
      AdminUI.renderMessages(AdminState.get('messages'));
    });
  }

  async function clearAllBookings() {
    if (!confirm('Delete ALL bookings? This cannot be undone.')) return;
    await _run(async () => {
      await AdminAPI.deleteAllBookings();
      AdminState.setState({ bookings: [] });
      AdminUI.toast('success', 'All bookings cleared');
      AdminUI.renderBookings([]);
      AdminUI.renderLiveFeed([]);
      AdminUI.updateBadge('payments', 0);
    });
  }

  async function clearAllPaymentReviews() {
    if (!confirm('Delete ALL payment review entries? This cannot be undone.')) return;
    await _run(async () => {
      await AdminAPI.deleteAllPayments();
      const remainingBookings = (AdminState.get('bookings') || []).filter(b => !['pending', 'proof_submitted'].includes(b.paymentStatus));
      AdminState.setState({ bookings: remainingBookings });
      AdminUI.toast('success', 'All payment reviews cleared');
      AdminUI.renderPayments([]);
      AdminUI.updateBadge('payments', 0);
    });
  }

  async function clearAllTransactions() {
    if (!confirm('Delete ALL transactions? This cannot be undone.')) return;
    await _run(async () => {
      await AdminAPI.deleteAllTransactions();
      AdminState.setState({ transactions: [] });
      AdminUI.toast('success', 'All transactions cleared');
      AdminUI.renderTransactions([]);
    });
  }

  async function clearAllUploads() {
    if (!confirm('Delete ALL uploaded files? This cannot be undone.')) return;
    await _run(async () => {
      await AdminAPI.deleteAllUploads();
      AdminUI.toast('success', 'All proof files cleared');
      AdminUI.renderUploads([]);
    });
  }

  async function clearAllLogs() {
    if (!confirm('Delete ALL access logs? This cannot be undone.')) return;
    await _run(async () => {
      await AdminAPI.deleteAllLogs();
      AdminState.setState({ logs: [] });
      AdminUI.toast('success', 'All access logs cleared');
      AdminUI.renderLogs([]);
    });
  }
  
  async function loadPromos() {
    await _run(async () => {
      const promos = await AdminAPI.fetchPromos();
      AdminState.setState({ promos });
      AdminUI.renderPromos(promos);
    });
  }

  async function createPromo() {
    const data = {
      code:         document.getElementById('pc_code').value.trim().toUpperCase(),
      description:  document.getElementById('pc_desc').value,
      discountType: document.getElementById('pc_type').value,
      discountValue:parseFloat(document.getElementById('pc_val').value) || 0,
      maxDiscount:  parseFloat(document.getElementById('pc_max').value) || 9999,
      usageLimit:   parseInt(document.getElementById('pc_limit').value) || 100,
      validUntil:   document.getElementById('pc_expiry').value,
      isActive:     true,
    };
    if (!data.code) { AdminUI.toast('error', 'Enter code'); return; }
    await _run(async () => {
      const promo = await AdminAPI.createPromo(data);
      AdminState.addItem('promos', promo);
      AdminUI.toast('success', 'Promo created!');
      FlyWay.hideModal('newPromoM');
      loadPromos();
    });
  }

  async function togglePromo(id, isActive) {
    await _run(async () => {
      await AdminAPI.updatePromo(id, { isActive: !isActive });
      AdminState.updateItem('promos', id, { isActive: !isActive });
      AdminUI.toast('success', `Promo ${isActive ? 'deactivated' : 'activated'}`);
      AdminUI.renderPromos(AdminState.get('promos'));
    });
  }

  async function deletePromo(id) {
    if (!confirm('Delete this promo code?')) return;
    await _run(async () => {
      await AdminAPI.deletePromo(id);
      AdminState.removeItem('promos', id);
      AdminUI.toast('info', 'Deleted');
      AdminUI.renderPromos(AdminState.get('promos'));
    });
  }

  
  async function loadLicenses() {
    await _run(async () => {
      const licenses = await AdminAPI.fetchLicenses();
      AdminState.setState({ licenses });
      AdminUI.renderLicenses(licenses);
    });
  }

  async function createLicense() {
    const key = document.getElementById('lic_key').value.trim().toUpperCase();
    if (!key) { AdminUI.toast('error', 'Enter key'); return; }
    const expDate = document.getElementById('lic_exp').value;       // "YYYY-MM-DD"
    const expTime = document.getElementById('lic_exp_time').value || '23:59'; // "HH:MM"
    // Build a local-time ISO string so the server compares in absolute time, not midnight UTC
    const expiresAt = expDate ? `${expDate}T${expTime}:00` : '2027-12-31T23:59:00';
    const data = {
      key, status: 'active',
      type:      document.getElementById('lic_type').value,
      maxUsers:  parseInt(document.getElementById('lic_max').value) || 1,
      expiresAt,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      usedBy: null, activatedAt: null,
    };
    await _run(async () => {
      await AdminAPI.createLicense(data);
      AdminUI.toast('success', 'License key created!');
      FlyWay.hideModal('newLicM');
      loadLicenses();
    });
  }

  async function toggleLicense(key, newStatus) {
    const statusLabels = { active:'activated', suspended:'suspended', revoked:'revoked', paused:'paused', disabled:'disabled' };
    await _run(async () => {
      await AdminAPI.updateLicense(key, { status: newStatus });
      AdminUI.toast('success', `License ${statusLabels[newStatus] || newStatus}`);
      loadLicenses();
    });
  }

  async function editLicense(key) {
    const lics = AdminState.get('licenses') || [];
    const lic  = lics.find(l => l.key === key);
    if (!lic) { AdminUI.toast('error', 'License not found'); return; }

    // Build edit modal inline
    const existing = document.getElementById('fwEditLicModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'fwEditLicModal';
    modal.className = 'overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <div class="modal-title">✏ Edit License</div>
          <button class="modal-close" onclick="document.getElementById('fwEditLicModal').remove()">×</button>
        </div>
        <div style="padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div style="grid-column:span 2">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:5px">Key (read-only)</div>
            <div style="font-family:var(--font-m);font-size:12px;color:#00d4ff;padding:10px 12px;background:rgba(0,212,255,0.05);border-radius:8px;border:1px solid rgba(0,212,255,0.15)">${lic.key}</div>
          </div>
          <div>
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:5px">Status</label>
            <select id="editLicStatus" class="form-input form-select" style="padding:10px 12px">
              ${['active','suspended','paused','disabled','revoked'].map(s => `<option value="${s}" ${(lic.computedStatus||lic.status)===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:5px">Type</label>
            <select id="editLicType" class="form-input form-select" style="padding:10px 12px">
              ${['standard','family','business','admin','solo','holiday','adventure','student','senior','couple','group','honeymoon','cargo','temporary','renewable','lifetime'].map(t => `<option value="${t}" ${lic.type===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div style="grid-column:span 2">
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:5px">Expiry Date &amp; Time <span style="font-size:10px;opacity:.6">(local time)</span></label>
            <div style="display:flex;gap:8px">
              <input id="editLicExp" type="date" class="form-input" value="${(lic.expiresAt||'').slice(0,10)}" style="padding:10px 12px;flex:1.6">
              <input id="editLicExpTime" type="time" class="form-input" value="${(lic.expiresAt||'').slice(11,16)||'23:59'}" style="padding:10px 12px;flex:1">
            </div>
          </div>
          <div>
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:5px">Max Users</label>
            <input id="editLicMax" type="number" class="form-input" value="${lic.maxUsers||1}" min="1" max="100" style="padding:10px 12px">
          </div>
        </div>
        <div style="padding:0 20px 20px;display:flex;gap:10px;justify-content:flex-end">
          <button class="btn btn-ghost" onclick="document.getElementById('fwEditLicModal').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="AdminController.saveEditLicense('${lic.key}')">💾 Save Changes</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  async function saveEditLicense(key) {
    const status    = document.getElementById('editLicStatus')?.value;
    const type      = document.getElementById('editLicType')?.value;
    const expDate   = document.getElementById('editLicExp')?.value;         // "YYYY-MM-DD"
    const expTime   = document.getElementById('editLicExpTime')?.value || '23:59'; // "HH:MM"
    const expiresAt = expDate ? `${expDate}T${expTime}:00` : undefined;
    const maxUsers  = parseInt(document.getElementById('editLicMax')?.value) || 1;
    const updates   = { status, type, maxUsers };
    if (expiresAt) updates.expiresAt = expiresAt;

    await _run(async () => {
      await AdminAPI.updateLicense(key, updates);
      AdminUI.toast('success', 'License updated and synced!');
      document.getElementById('fwEditLicModal')?.remove();
      loadLicenses();
    });
  }

  async function extendLicense(key, days) {
    const lics = AdminState.get('licenses') || [];
    const lic  = lics.find(l => l.key === key);
    if (!lic) return;
    // Preserve the existing time-of-day part when extending
    const existingTime = (lic.expiresAt || '').slice(11, 16) || '23:59';
    const current = lic.expiresAt ? new Date(lic.expiresAt) : new Date();
    if (current < new Date()) current.setTime(new Date().getTime()); // start from today if expired
    current.setDate(current.getDate() + (days || 30));
    const dateStr = current.toISOString().split('T')[0];
    const newExp  = `${dateStr}T${existingTime}:00`;
    await _run(async () => {
      await AdminAPI.updateLicense(key, { expiresAt: newExp, status: 'active' });
      AdminUI.toast('success', `License extended to ${dateStr} at ${existingTime}`);
      loadLicenses();
    });
  }

  async function revokeAllExpired() {
    if (!confirm('Mark all expired licenses as revoked?')) return;
    const lics = AdminState.get('licenses') || [];
    const expired = lics.filter(l => {
      if ((l.status||'') !== 'active') return false;
      if (!l.expiresAt) return false;
      return new Date(l.expiresAt) < new Date();
    });
    if (!expired.length) { AdminUI.toast('info', 'No expired active licenses found'); return; }
    await _run(async () => {
      for (const l of expired) await AdminAPI.updateLicense(l.key, { status: 'revoked' });
      AdminUI.toast('success', `${expired.length} license(s) revoked`);
      loadLicenses();
    });
  }

  async function deleteLicense(key) {
    if (!confirm('Delete this license key permanently? This cannot be undone.')) return;
    await _run(async () => {
      await AdminAPI.deleteLicense(key);
      AdminUI.toast('success', 'License deleted');
      loadLicenses();
    });
  }

  function generateLicenseKey() {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const s = () => Array.from({ length: 4 }, () => c[Math.floor(Math.random() * c.length)]).join('');
    const key = `FLY-${s()}-${s()}-${s()}`;
    document.getElementById('lic_key').value = key;
  }

  
  async function loadUploads() {
    await _run(async () => {
      const uploads = await AdminAPI.fetchUploads();
      AdminState.setState({ uploads });
      AdminUI.renderUploads(uploads);
    });
  }

  
  async function loadLogs() {
    await _run(async () => {
      const logs = await AdminAPI.fetchLogs();
      AdminState.setState({ logs });
      AdminUI.renderLogs(logs);
    });
  }

  
  function init() {
    const tok = localStorage.getItem('fw_token');
    const usr = localStorage.getItem('fw_user');
    if (!tok || !usr) { window.location.href = '/backdoor/login'; return false; }
    try {
      const u = JSON.parse(usr);
      if (u.role !== 'admin') { window.location.href = '/backdoor/login'; return false; }
      FlyWay.token = tok;
      FlyWay.user  = u;
      if (typeof FlyWay.init === 'function') FlyWay.init();
      sessionStorage.setItem('fw_admin_auth', '1');
      sessionStorage.setItem('fw_admin_warned', '1');
    } catch (e) { window.location.href = '/backdoor/login'; return false; }

    
    AdminState.subscribe('stats', stats => {
      if (!stats) return;
      AdminUI.updateBadge('messages', stats.unreadMessages);
      AdminUI.updateBadge('payments', stats.pendingProofs);
    });

    
    setInterval(() => {
      const c = document.getElementById('liveClock');
      if (c) c.textContent = new Date().toLocaleTimeString();
    }, 1000);

    
    const sub = document.getElementById('pgSub');
    if (sub) sub.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    
    _initMobileSidebar();

    
    _initSocket();

    
    loadOverview();
    return true;
  }

  function signOut() {
    AdminState.reset();
    sessionStorage.removeItem('fw_admin_auth');
    sessionStorage.removeItem('fw_admin_warned');
    localStorage.removeItem('fw_token');
    localStorage.removeItem('fw_user');
    window.location.href = '/backdoor';
  }

  
  function _initMobileSidebar() {
    const sidebar = document.getElementById('admSide');
    const overlay = document.getElementById('admOverlay');
    const btn     = document.getElementById('admMenuBtn');
    if (!sidebar) return;

    function closeMenu() {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
    }

    // Close sidebar when viewport grows beyond mobile breakpoint
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) closeMenu();
    });

    // The button onclick already calls toggleAdmSide() defined in dashboard.html,
    // but wire overlay click here too as a fallback
    if (overlay) {
      overlay.addEventListener('click', closeMenu);
    }

    // Auto-close sidebar when a nav item is clicked on mobile
    document.querySelectorAll('.adm-ni').forEach(el => {
      el.addEventListener('click', () => {
        if (window.innerWidth <= 900) closeMenu();
      });
    });
  }

  
  function _initSocket() {
    if (typeof io === 'undefined') return;
    const socket = io();
    socket.emit('join_admin');

    socket.on('admin_new_booking', data => {
      AdminUI.realtimeToast('✈ New Booking', `${data.route || ''} · $${parseFloat(data.amount || 0).toFixed(2)} · ${data.paymentMethod || ''}`);
      loadOverview();
    });

    socket.on('admin_proof_uploaded', data => {
      AdminUI.realtimeToast('📎 Proof Uploaded', `Booking ${data.ref || ''} - payment proof submitted`);
      if (AdminState.get('currentTab') === 'payments') loadPayments();
    });

    socket.on('admin_new_message', data => {
      AdminUI.realtimeToast('💬 New Message', `"${data.subject || ''}" from ${data.name || 'user'}`);
      if (AdminState.get('currentTab') === 'messages') loadMessages();
    });

    socket.on('admin_notification', note => {
      AdminUI.realtimeToast(note.title || 'Admin Alert', note.message || '');
    });
  }

  
  return {
    init, signOut, navigate, refresh,
    loadOverview, loadBookings, loadPayments, loadTransactions,
    loadUsers, loadNotify, loadMessages, loadPromos, loadLicenses, loadUploads, loadLogs,
    filterBookings,
    approveBooking, confirmPayment, cancelBooking, openBookingDetail, saveBookingEdits, clearAllBookings,
    approvePayment, rejectPayment,
    toggleUser, deleteUser,
    sendNotification, broadcastNotification, goToNotifyUser,
    markMessageRead, replyMessage, clearAllMessages, deleteMessage,
    createPromo, togglePromo, deletePromo,
    createLicense, toggleLicense, editLicense, saveEditLicense, extendLicense, revokeAllExpired, deleteLicense, generateLicenseKey,
    clearAllTransactions, clearAllUploads, clearAllLogs, clearAllPaymentReviews,
  };
})();

window.AdminController = AdminController;
