

const AdminUI = (() => {

  
  function el(id)  { return document.getElementById(id); }
  function set(id, html) { const e = el(id); if (e) e.innerHTML = html; }
  function setText(id, v) { const e = el(id); if (e) e.textContent = v; }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
    })[char]);
  }

  function emptyState(icon, title, desc = '') {
    return `<div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${title}</div>
      ${desc ? `<div class="empty-desc">${desc}</div>` : ''}
    </div>`;
  }

  function loadingState(msg = 'Loading…') {
    return `<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--muted);font-size:13px">
      <span style="margin-right:8px;animation:spin 1s linear infinite;display:inline-block">⟳</span> ${msg}
    </div>`;
  }

  
  function setLoading(isLoading) {
    const loader = el('adminGlobalLoader');
    if (loader) loader.style.opacity = isLoading ? '1' : '0';
  }

  
  const TAB_TITLES = {
    overview:'Dashboard', bookings:'All Bookings', payments:'Payment Reviews',
    transactions:'Transactions', users:'Users & Credentials',
    notify:'Notifications', messages:'Messages', promos:'Promo Codes',
    licenses:'License Keys', uploads:'Proof Files', logs:'Access Logs',
  };

  function setActiveTab(tab) {
    document.querySelectorAll('[id^="t_"]').forEach(e => e.classList.add('hidden'));
    const panel = el(`t_${tab}`);
    if (panel) panel.classList.remove('hidden');

    document.querySelectorAll('.adm-ni').forEach(n => n.classList.remove('active'));
    el(`n_${tab}`)?.classList.add('active');

    setText('pgTitle', TAB_TITLES[tab] || tab);
  }

  function updateBadge(tab, count) {
    const b = el(`bd_${tab}`);
    if (!b) return;
    if (count > 0) { b.textContent = count; b.classList.remove('hidden'); }
    else b.classList.add('hidden');
  }

  
  function renderStats(stats) {
    setText('st_users',    stats.totalUsers);
    setText('st_bookings', stats.totalBookings);
    setText('st_revenue',  '$' + FlyWay.fmt(stats.totalRevenue));
    setText('st_pending',  stats.pending);
    setText('st_proofs',   stats.pendingProofs);
    setText('st_msgs',     stats.unreadMessages);
    setText('st_today',    stats.todayBookings);
    setText('st_todayrev', '$' + FlyWay.fmt(stats.todayRevenue));
    updateBadge('messages', stats.unreadMessages);
    updateBadge('payments', stats.pendingProofs);
  }

  function renderLiveFeed(bookings) {
    if (!bookings.length) {
      set('liveFeed', '<div style="color:var(--muted);padding:20px;text-align:center">No bookings yet</div>');
      return;
    }
    set('liveFeed', bookings.map(b => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-weight:700;font-size:14px">
            ${b.outboundFlight?.from || '-'} → ${b.outboundFlight?.to || '-'}
            <span style="font-family:var(--font-m);font-size:11px;color:var(--cyan);margin-left:6px">${b.ref}</span>
          </div>
          <div style="font-size:11px;color:var(--muted)">
            👤 ${b.userName || '?'} · ${b.paymentMethod || ''} · ${FlyWay.fmtDate(b.createdAt)}
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${FlyWay.statusBadge(b.status)}${FlyWay.statusBadge(b.paymentStatus)}
          <div style="font-family:var(--font-h);font-weight:800;color:var(--cyan)">$${FlyWay.fmt(b.totalAmount)}</div>
          <button class="btn btn-ghost btn-sm" onclick="AdminController.openBookingDetail('${b.id}')">View</button>
        </div>
      </div>`).join(''));
  }

  
  function renderBookings(list) {
    const container = el('bookingsEl');
    if (!list.length) {
      set('bookingsEl', emptyState('✈', 'No bookings', 'No bookings match the current filter.'));
      return;
    }
    const header = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-weight:700">${list.length} booking${list.length!==1?'s':''}</div>
      <button class="btn btn-sm" style="background:rgba(255,70,70,0.1);border:1px solid rgba(255,70,70,0.3);color:#ff4757" onclick="AdminController.clearAllBookings()">🗑 Clear All</button>
    </div>`;
    set('bookingsEl', header + list.map(b => `
      <div class="adm-card" style="transition:border-color 0.2s"
           onmouseover="this.style.borderColor='rgba(0,212,255,0.25)'"
           onmouseout="this.style.borderColor='var(--border)'">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">
              <div style="font-family:var(--font-h);font-weight:800;font-size:17px">
                ${b.outboundFlight?.from || '-'} → ${b.outboundFlight?.to || '-'}
              </div>
              <span style="font-family:var(--font-m);font-size:10px;background:rgba(0,212,255,0.1);color:var(--cyan);padding:2px 9px;border-radius:20px;border:1px solid rgba(0,212,255,0.2)">${b.ref}</span>
              ${FlyWay.statusBadge(b.status)}${FlyWay.statusBadge(b.paymentStatus)}
            </div>
            <div style="font-size:12px;color:var(--muted)">
              👤 ${b.userName || '?'} · ✉ ${b.userEmail || ''} · 💺 ${b.travelClass} · ${(b.passengers || []).length} pax · 💳 ${b.paymentMethod}
            </div>
            ${b.adminNote ? `<div style="margin-top:6px;padding:5px 10px;background:rgba(245,200,66,0.07);border-radius:6px;font-size:11px;color:var(--gold)">📝 ${b.adminNote}</div>` : ''}
          </div>
          <div style="text-align:right">
            <div style="font-family:var(--font-h);font-size:20px;font-weight:800;color:var(--cyan)">$${FlyWay.fmt(b.totalAmount)}</div>
            ${b.paymentProof ? `<img src="${b.paymentProof}" class="proof-img" onclick="AdminUI.viewImage('${b.paymentProof}')" style="margin-top:6px" onerror="this.style.display='none'">` : ''}
            ${b.giftcardCode ? `<div style="font-size:10px;color:var(--gold);margin-top:3px;font-family:var(--font-m)">🎁 ${b.giftcardCode}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${b.status !== 'confirmed' ? `<button class="btn btn-success btn-sm" onclick="AdminController.approveBooking('${b.id}')">✅ Approve</button>` : ''}
          ${['proof_submitted','pending'].includes(b.paymentStatus) ? `<button class="btn btn-success btn-sm" onclick="AdminController.confirmPayment('${b.id}')">💳 Confirm Payment</button>` : ''}
          ${b.status !== 'cancelled' ? `<button class="btn btn-danger btn-sm" onclick="AdminController.cancelBooking('${b.id}')">❌ Cancel</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="AdminController.openBookingDetail('${b.id}')">📋 Details</button>
          <button class="btn btn-ghost btn-sm" onclick="AdminController.goToNotifyUser('${b.userId}','${b.ref}')">💬 Notify User</button>
        </div>
      </div>`).join(''));
  }

  
  function renderBookingDetail(b, leg = 'outboundFlight') {
    if (leg !== 'returnFlight' || !b.returnFlight) leg = 'outboundFlight';
    const f = b[leg] || {};
    const flightFields = [
      ['airline','Airline'], ['flightNumber','Flight name / number'], ['from','From'], ['to','To'],
      ['departureDate','Departure date'], ['depTime','Departure time'], ['arrTime','Arrival time'],
      ['duration','Duration'], ['stops','Stops / layover'], ['type','Flight type'], ['aircraft','Aircraft'],
    ];
    const flightInputs = flightFields.map(([name,label]) => `
      <label class="form-group" style="margin:0"><span class="form-label">${label}</span>
        <input class="form-input" name="${name}" value="${escapeHtml(name === 'departureDate' ? (f[name] || '').slice(0,10) : f[name])}" ${name === 'departureDate' ? 'type="date"' : ''}>
      </label>`).join('');
    const statusOptions = [
      ['pending','Pending / unapproved'], ['confirmed','Confirmed'], ['cancelled','Cancelled'], ['completed','Completed'],
    ].map(([value,label]) => `<option value="${value}" ${b.status === value ? 'selected' : ''}>${label}</option>`).join('');
    const paymentOptions = [
      ['pending','Pending / unapproved'], ['proof_submitted','Proof submitted'], ['paid','Paid / approved'], ['refunded','Refunded'],
    ].map(([value,label]) => `<option value="${value}" ${b.paymentStatus === value ? 'selected' : ''}>${label}</option>`).join('');
    el('bdTitle').textContent = `Booking ${b.ref}`;
    set('bdContent', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;margin-bottom:16px">
        <div><div style="color:var(--muted);font-size:10px;margin-bottom:2px">ROUTE</div><strong style="font-size:15px">${f.from || '-'} → ${f.to || '-'}</strong></div>
        <div><div style="color:var(--muted);font-size:10px;margin-bottom:2px">STATUS</div>${FlyWay.statusBadge(b.status)} ${FlyWay.statusBadge(b.paymentStatus)}</div>
        <div><div style="color:var(--muted);font-size:10px;margin-bottom:2px">AMOUNT</div><strong style="color:var(--cyan);font-size:18px">$${FlyWay.fmt(b.totalAmount)}</strong></div>
        <div><div style="color:var(--muted);font-size:10px;margin-bottom:2px">USER</div><strong>${b.userName || '-'}</strong> <span style="color:var(--muted);font-size:11px">${b.userEmail || ''}</span></div>
        <div><div style="color:var(--muted);font-size:10px;margin-bottom:2px">FLIGHT</div>${f.flightNumber || '-'} · ${f.depTime || '-'}→${f.arrTime || '-'} · ${f.duration || '-'}</div>
        <div><div style="color:var(--muted);font-size:10px;margin-bottom:2px">PAYMENT</div>${b.paymentMethod} ${b.promoCode ? '· Promo: ' + b.promoCode : ''}</div>
      </div>
      ${b.adminNote ? `<div style="padding:10px;background:rgba(245,200,66,0.07);border:1px solid rgba(245,200,66,0.2);border-radius:8px;font-size:12px;color:var(--gold);margin-bottom:12px">📝 Admin Note: ${b.adminNote}</div>` : ''}
      ${b.paymentProof ? `<div style="margin-bottom:12px"><div style="font-size:10px;color:var(--muted);margin-bottom:6px">PAYMENT PROOF</div><img src="${b.paymentProof}" style="max-height:180px;border-radius:8px;border:1px solid var(--border);cursor:pointer" onclick="AdminUI.viewImage('${b.paymentProof}')" onerror="this.outerHTML='<a href=${b.paymentProof} target=_blank class=btn btn-ghost btn-sm>View File</a>'"></div>` : ''}
      ${b.giftcardCode ? `<div style="padding:10px;background:rgba(245,200,66,0.07);border-radius:8px;margin-bottom:12px"><div style="font-size:10px;color:var(--gold)">GIFT CARD CODE</div><div style="font-family:var(--font-m);font-size:16px;color:var(--gold)">${b.giftcardCode}</div></div>` : ''}
      ${b.paymentDetails ? `<div style="padding:10px;background:var(--navy3);border-radius:8px;margin-bottom:12px;font-size:12px"><div style="color:var(--muted);font-size:10px;margin-bottom:4px">PAYMENT DETAILS</div>${b.paymentDetails}</div>` : ''}
      <div style="margin-bottom:16px">
        <div style="font-size:10px;color:var(--muted);margin-bottom:6px">PASSENGERS</div>
        ${(b.passengers || []).map((p, i) => `<div style="padding:7px 10px;background:var(--navy3);border-radius:7px;margin-bottom:4px;font-size:12px">${p.name || 'Pax ' + (i + 1)} · Age ${p.age} · ${p.meal || 'Standard'} · Seat: ${b.selectedSeats?.[i] || 'Auto'}</div>`).join('')}
      </div>
      <form id="editBookingForm-${b.id}" onsubmit="return false" style="padding:14px;background:var(--navy3);border:1px solid var(--border);border-radius:10px;margin-bottom:14px">
        <div style="font-weight:700;margin-bottom:10px">Edit flight and booking</div>
        ${b.returnFlight ? `<label class="form-group"><span class="form-label">Flight leg</span><select class="form-input" onchange="AdminController.openBookingDetail('${b.id}',this.value)"><option value="outboundFlight" ${leg === 'outboundFlight' ? 'selected' : ''}>Outbound</option><option value="returnFlight" ${leg === 'returnFlight' ? 'selected' : ''}>Return</option></select></label>` : ''}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:10px">${flightInputs}</div>
        <label class="form-group"><span class="form-label">Flight details</span><textarea class="form-input" name="details" rows="3" maxlength="1000">${escapeHtml(f.details)}</textarea></label>
        <label class="form-group"><span class="form-label">Booking total (USD)</span><input class="form-input" name="totalAmount" type="number" min="0" max="1000000" step="0.01" value="${Number(b.totalAmount || 0).toFixed(2)}" required></label>
        <div style="font-size:11px;color:var(--muted);margin:-8px 0 12px">Updates the amount shown on this booking and its receipt. It does not charge or refund a payment automatically.</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
          <label class="form-group"><span class="form-label">Booking status</span><select class="form-input" name="status">${statusOptions}</select></label>
          <label class="form-group"><span class="form-label">Payment status</span><select class="form-input" name="paymentStatus">${paymentOptions}</select></label>
        </div>
        <label class="form-group"><span class="form-label">Admin note</span><textarea class="form-input" name="adminNote" rows="2" maxlength="1000">${escapeHtml(b.adminNote)}</textarea></label>
        <button type="button" class="btn btn-primary" onclick="AdminController.saveBookingEdits('${b.id}','${leg}')">Save changes</button>
        <span style="font-size:11px;color:var(--muted);margin-left:8px">Edits are allowed even after departure.</span>
      </form>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${b.status !== 'confirmed' ? `<button class="btn btn-success" onclick="AdminController.approveBooking('${b.id}');FlyWay.hideModal('bdModal')">✅ Approve</button>` : ''}
        ${b.status !== 'cancelled' ? `<button class="btn btn-danger" onclick="AdminController.cancelBooking('${b.id}');FlyWay.hideModal('bdModal')">❌ Cancel</button>` : ''}
      </div>`);
    FlyWay.showModal('bdModal');
  }

  
  function renderPayments(list) {
    if (!list.length) {
      set('paymentsEl', emptyState('✅', 'All Clear!', 'No payments pending review.'));
      return;
    }
    const header = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-weight:700">${list.length} payment${list.length!==1?'s':''} pending</div>
      <button class="btn btn-sm" style="background:rgba(255,70,70,0.1);border:1px solid rgba(255,70,70,0.3);color:#ff4757" onclick="AdminController.clearAllPaymentReviews()">🗑 Clear All</button>
    </div>`;
    set('paymentsEl', header + list.map(b => `
      <div class="adm-card" style="border-color:rgba(245,200,66,0.25);margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
          <div>
            <div style="font-weight:800;font-size:15px;font-family:var(--font-h)">${b.outboundFlight?.from || '-'} → ${b.outboundFlight?.to || '-'}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px">
              <span style="font-family:var(--font-m);color:var(--cyan)">${b.ref}</span> · ${b.userName || '?'} · ${b.paymentMethod}
            </div>
          </div>
          <div style="font-family:var(--font-h);font-size:22px;font-weight:800;color:var(--gold)">$${FlyWay.fmt(b.totalAmount)}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:14px">
          ${b.paymentProof ? `<div style="background:var(--navy3);border-radius:8px;padding:10px;border:1px solid var(--border)"><div style="font-size:10px;color:var(--muted);margin-bottom:6px">📎 PAYMENT RECEIPT</div><img src="${b.paymentProof}" style="width:100%;height:130px;object-fit:cover;border-radius:5px;cursor:pointer" onclick="AdminUI.viewImage('${b.paymentProof}')" onerror="this.outerHTML='<a href=${b.paymentProof} target=_blank class=btn btn-ghost btn-sm>View File</a>'"></div>` : ''}
          ${b.giftcardImage ? `<div style="background:var(--navy3);border-radius:8px;padding:10px;border:1px solid rgba(245,200,66,0.3)"><div style="font-size:10px;color:var(--gold);margin-bottom:6px">🎁 GIFT CARD IMAGE</div><img src="${b.giftcardImage}" style="width:100%;height:130px;object-fit:cover;border-radius:5px;cursor:pointer" onclick="AdminUI.viewImage('${b.giftcardImage}')"></div>` : ''}
          ${b.giftcardCode ? `<div style="background:var(--navy3);border-radius:8px;padding:10px;border:1px solid rgba(245,200,66,0.3)"><div style="font-size:10px;color:var(--gold);margin-bottom:6px">🎁 GIFT CARD CODE</div><div style="font-family:var(--font-m);font-size:15px;color:var(--gold);word-break:break-all">${b.giftcardCode}</div></div>` : ''}
          ${b.paymentDetails ? `<div style="background:var(--navy3);border-radius:8px;padding:10px;border:1px solid var(--border)"><div style="font-size:10px;color:var(--muted);margin-bottom:6px">📝 DETAILS</div><div style="font-size:12px">${b.paymentDetails}</div></div>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Admin Note / Reason (shown to user)</label>
          <input class="form-input" id="nr_${b.id}" placeholder="e.g. Payment received ✓  OR  Wrong amount - please resend $${FlyWay.fmt(b.totalAmount)}">
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-success" onclick="AdminController.approvePayment('${b.id}')">✅ Approve - Confirm Booking</button>
          <button class="btn btn-danger"  onclick="AdminController.rejectPayment('${b.id}')">❌ Reject - Notify User</button>
          <button class="btn btn-ghost btn-sm" onclick="AdminController.openBookingDetail('${b.id}')">📋 Full Details</button>
        </div>
      </div>`).join(''));
  }

  
  function renderTransactions(list) {
    const panel = el('t_transactions');
    if (!panel) return;
    const header = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-weight:700;font-size:13px">${list.length} transaction${list.length!==1?'s':''}</div>
      <button class="btn btn-sm" style="background:rgba(255,70,70,0.1);border:1px solid rgba(255,70,70,0.3);color:#ff4757" onclick="AdminController.clearAllTransactions()">🗑 Clear All</button>
    </div>`;
    if (!list.length) {
      panel.innerHTML = header + `<div class="adm-card" style="padding:20px;text-align:center;color:var(--muted)">No transactions available.</div>`;
      return;
    }
    panel.innerHTML = header + `<div class="adm-card"><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th class="adm-th">Ref</th><th class="adm-th">User</th><th class="adm-th">Route</th><th class="adm-th">Amount</th><th class="adm-th">Method</th><th class="adm-th">Status</th><th class="adm-th">Proof</th><th class="adm-th">Date</th>
      </tr></thead>
      <tbody>${list.map(t => `
        <tr class="adm-tr">
          <td class="adm-td" style="font-family:var(--font-m);color:var(--cyan);font-size:11px">${t.bookingRef}</td>
          <td class="adm-td">${t.userName || '-'}</td>
          <td class="adm-td" style="font-weight:600">${t.route || '-'}</td>
          <td class="adm-td" style="font-family:var(--font-h);font-weight:700;color:var(--cyan)">$${FlyWay.fmt(t.amount)}</td>
          <td class="adm-td" style="text-transform:capitalize">${t.paymentMethod}</td>
          <td class="adm-td">${FlyWay.statusBadge(t.status)}</td>
          <td class="adm-td">${t.proofFile ? `<img src="${t.proofFile}" class="proof-img" onclick="AdminUI.viewImage('${t.proofFile}')" onerror="this.outerHTML='<a href=${t.proofFile} target=_blank style=color:var(--cyan);font-size:11px>View</a>'">` : '-'}</td>
          <td class="adm-td" style="font-size:11px;color:var(--muted)">${FlyWay.fmtDateTime(t.createdAt)}</td>
        </tr>`).join('')}</tbody>
    </table></div></div>`;
  }

  
  function renderUsers(users) {
    set('usersEl', users.map(u => `
      <div class="adm-card">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;flex-wrap:wrap">
          <div style="width:46px;height:46px;background:linear-gradient(135deg,var(--cyan),var(--purple));border-radius:11px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;color:var(--navy);overflow:hidden;flex-shrink:0">
            ${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover">` : (u.firstName || u.username || 'U')[0].toUpperCase()}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:15px">${u.firstName || ''} ${u.lastName || ''} <span style="color:var(--muted);font-size:12px">@${u.username}</span></div>
            <div style="font-size:12px;color:var(--muted)">${u.email} · ${u.phone || 'no phone'}</div>
            <div style="display:flex;gap:5px;margin-top:4px;flex-wrap:wrap">
              <span class="badge ${u.role === 'admin' ? 'badge-gold' : 'badge-cyan'}">${u.role}</span>
              <span class="badge ${u.isActive ? 'badge-green' : 'badge-red'}">${u.isActive ? 'Active' : 'Disabled'}</span>
              <span class="badge badge-purple">⭐ ${FlyWay.fmtInt(u.loyaltyPoints)} pts</span>
              <span class="badge badge-muted">✈ ${u.bookingCount || 0} bookings</span>
            </div>
          </div>
          <div style="text-align:right;font-size:11px;color:var(--muted)">
            <div>Joined ${FlyWay.fmtDate(u.createdAt)}</div>
            <div>Last login: ${FlyWay.fmtDate(u.lastLogin) || 'Never'}</div>
          </div>
        </div>
        <div class="cred-box mb-14">
          <div style="font-size:10px;color:var(--cyan);font-weight:700;margin-bottom:8px;letter-spacing:0.5px">🔑 CREDENTIALS</div>
          <div class="cred-row"><span class="cred-key">Username</span><span class="cred-val">${u.username}</span></div>
          <div class="cred-row"><span class="cred-key">Password</span>
            <span style="display:flex;align-items:center;gap:6px">
              <span class="cred-val" id="pw_${u.id}" style="filter:blur(5px)">${u.passwordPlain || '-'}</span>
              <button onclick="const e=document.getElementById('pw_${u.id}');e.style.filter=e.style.filter==='none'?'blur(5px)':'none'" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px">👁</button>
            </span>
          </div>
          <div class="cred-row"><span class="cred-key">Email</span><span class="cred-val">${u.email}</span></div>
          <div class="cred-row"><span class="cred-key">License Key</span><span class="cred-val">${u.licenseKey || '-'}</span></div>
        </div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          <button class="btn ${u.isActive ? 'btn-danger' : 'btn-success'} btn-sm" onclick="AdminController.toggleUser('${u.id}','${u.username}',${u.isActive})">${u.isActive ? '🚫 Disable' : '✅ Enable'}</button>
          <button class="btn btn-ghost btn-sm" onclick="AdminController.goToNotifyUser('${u.id}','(direct)')">💬 Send Notification</button>
          ${u.id !== 'admin-001' ? `<button class="btn btn-danger btn-sm" onclick="AdminController.deleteUser('${u.id}','${u.username}')">🗑 Delete</button>` : ''}
        </div>
      </div>`).join(''));
  }

  
  function renderUserDropdown(users) {
    const sel = el('notifyUsr');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">Select user...</option>' +
      users.filter(u => u.role !== 'admin').map(u =>
        `<option value="${u.id}">${u.username || u.email} - ${u.email}</option>`
      ).join('');
    if (prev) sel.value = prev;
  }

  
  function renderMessages(msgs) {
    const panel = el('t_messages');
    if (!panel) return;
    panel.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-weight:700">${msgs.length} messages</div>
        <button class="btn btn-sm" style="background:rgba(255,70,70,0.1);border:1px solid rgba(255,70,70,0.3);color:#ff4757" onclick="AdminController.clearAllMessages()">🗑 Clear All</button>
      </div>` +
      (msgs.length ? msgs.map(m => `
        <div class="adm-card" style="${m.status === 'unread' ? 'border-color:rgba(0,212,255,0.3)' : ''};margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <div>
              <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:3px">
                <strong>${m.name}</strong>
                <span class="badge ${m.status === 'unread' ? 'badge-cyan' : m.status === 'replied' ? 'badge-green' : 'badge-muted'}">${m.status}</span>
                <span class="badge badge-muted">${m.subject}</span>
              </div>
              <div style="font-size:12px;color:var(--muted)">${m.email} · ${FlyWay.fmtDateTime(m.createdAt)}</div>
            </div>
            ${m.status === 'unread' ? `<button class="btn btn-ghost btn-sm" onclick="AdminController.markMessageRead('${m.id}')">Mark Read</button>` : ''}
          </div>
          <div style="padding:10px 12px;background:var(--navy3);border-radius:8px;font-size:13px;line-height:1.8;margin-bottom:10px;word-wrap:break-word;white-space:pre-wrap;overflow-wrap:break-word">${m.message}</div>
          ${m.reply ? `<div style="padding:10px 12px;background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.15);border-radius:8px;font-size:12px;margin-bottom:10px;word-wrap:break-word;white-space:pre-wrap"><strong style="color:var(--cyan)">Your reply:</strong> ${m.reply}</div>` : ''}
          <div style="display:flex;gap:8px">
            <input class="form-input" id="rep_${m.id}" placeholder="Type reply to send..." style="flex:1;font-size:13px">
            <button class="btn btn-primary btn-sm" onclick="AdminController.replyMessage('${m.id}','${m.userId || ''}')">Send</button>
          </div>
        </div>`).join('') : '<div style="color:var(--muted);text-align:center;padding:40px">No messages yet</div>');
  }

  
  function renderPromos(promos) {
    set('promosEl', promos.length ? promos.map(p => `
      <div class="adm-card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="font-family:var(--font-m);font-size:16px;font-weight:800;color:var(--cyan)">${p.code}</span>
              <span class="badge ${p.isActive ? 'badge-green' : 'badge-muted'}">${p.isActive ? '● Active' : 'Inactive'}</span>
            </div>
            <div style="font-size:12px;color:var(--muted)">
              ${p.description} · ${p.discountType === 'percentage' ? p.discountValue + '%' : '$' + p.discountValue} off · Used: ${p.usedCount || 0}/${p.usageLimit || '∞'} · Exp: ${p.validUntil}
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn ${p.isActive ? 'btn-danger' : 'btn-success'} btn-sm" onclick="AdminController.togglePromo('${p.id}',${p.isActive})">${p.isActive ? 'Deactivate' : 'Activate'}</button>
            <button class="btn btn-danger btn-sm" onclick="AdminController.deletePromo('${p.id}')">Delete</button>
          </div>
        </div>
      </div>`).join('') : emptyState('🎟', 'No promo codes yet'));
  }

  
  function renderLicenses(lics) {
    const statusColor = function(l) {
      const cs = l.computedStatus || l.status || 'unknown';
      if (cs === 'active')    return '#00e396';
      if (cs === 'expired')   return '#ff5757';
      if (cs === 'suspended') return '#fb923c';
      if (cs === 'revoked')   return '#ff5757';
      if (cs === 'paused')    return '#f5c842';
      return '#94a3b8';
    };
    const statusBg = function(l) {
      const c = statusColor(l);
      return c + '18';
    };
    const expiryText = function(l) {
      if (l.expiryInfo && l.expiryInfo.text) return l.expiryInfo.text;
      if (!l.expiresAt) return 'Lifetime';
      const d = new Date(l.expiresAt);
      const diff = Math.ceil((d - new Date()) / 86400000);
      // Show time portion if present (not midnight-only date string)
      const hasTime = l.expiresAt.length > 10;
      const timeStr = hasTime ? (' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})) : '';
      if (diff < 0) return 'Expired ' + Math.abs(diff) + 'd ago';
      if (diff === 0) return 'Expires Today' + timeStr;
      if (diff <= 7) return 'Expires in ' + diff + 'd' + timeStr;
      return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + timeStr;
    };
    const expiryColor = function(l) {
      if (l.expiryInfo) {
        if (l.expiryInfo.urgency === 'expired' || l.expiryInfo.isExpired) return '#ff5757';
        if (l.expiryInfo.urgency === 'soon' || l.expiryInfo.urgency === 'critical') return '#f5c842';
        if (l.expiryInfo.urgency === 'lifetime') return '#a78bfa';
      }
      if (!l.expiresAt) return '#a78bfa';
      const diff = Math.ceil((new Date(l.expiresAt) - new Date()) / 86400000);
      if (diff < 0) return '#ff5757';
      if (diff <= 7) return '#f5c842';
      return '#00e396';
    };

    const toolbar = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div style="font-size:13px;color:var(--muted)">${lics.length} license key${lics.length!==1?'s':''} total
        · <span style="color:#00e396">${lics.filter(l=>(l.computedStatus||l.status)==='active').length} active</span>
        · <span style="color:#ff5757">${lics.filter(l=>(l.computedStatus||l.status)==='expired').length} expired</span>
        · <span style="color:var(--muted)">${lics.filter(l=>!l.usedBy).length} available</span>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openNewLicModal()">+ New Key</button>
    </div>`;

    const table = `<div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;min-width:700px">
        <thead><tr>
          <th class="adm-th">Key</th>
          <th class="adm-th">Type</th>
          <th class="adm-th">Status</th>
          <th class="adm-th">Expiry</th>
          <th class="adm-th">Used By</th>
          <th class="adm-th">Activated</th>
          <th class="adm-th" style="text-align:center">Actions</th>
        </tr></thead>
        <tbody>
        ${lics.map(l => {
          const cs  = l.computedStatus || l.status || 'unknown';
          const sc  = statusColor(l);
          const ec  = expiryColor(l);
          const et  = expiryText(l);
          const activated = l.activatedAt ? new Date(l.activatedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '-';
          return `<tr class="adm-tr">
            <td class="adm-td" style="font-family:var(--font-m);color:#00d4ff;font-size:11px;letter-spacing:0.5px">${l.key}</td>
            <td class="adm-td"><span class="badge badge-muted" style="text-transform:capitalize">${l.type||'standard'}</span></td>
            <td class="adm-td">
              <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:0.5px;border:1px solid ${sc}40;color:${sc};background:${sc}15">
                ${cs.toUpperCase()}
              </span>
            </td>
            <td class="adm-td">
              <span style="font-size:12px;color:${ec};font-weight:600">${et}</span>
            </td>
            <td class="adm-td" style="font-size:12px">${l.usedByUser ? '<span style="color:var(--cyan)">'+l.usedByUser+'</span>' : '<span style="color:var(--muted)">Available</span>'}</td>
            <td class="adm-td" style="font-size:11px;color:var(--muted)">${activated}</td>
            <td class="adm-td">
              <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:center">
                ${cs !== 'active' ? `<button onclick="AdminController.toggleLicense('${l.key}','active')" style="background:rgba(0,227,150,.1);border:1px solid rgba(0,227,150,.3);color:#00e396;border-radius:6px;padding:3px 9px;font-size:11px;cursor:pointer;white-space:nowrap">✓ Activate</button>` : ''}
                ${cs === 'active' ? `<button onclick="AdminController.toggleLicense('${l.key}','suspended')" style="background:rgba(251,146,60,.1);border:1px solid rgba(251,146,60,.3);color:#fb923c;border-radius:6px;padding:3px 9px;font-size:11px;cursor:pointer;white-space:nowrap">⏸ Suspend</button>` : ''}
                <button onclick="AdminController.editLicense('${l.key}')" style="background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3);color:#00d4ff;border-radius:6px;padding:3px 9px;font-size:11px;cursor:pointer;white-space:nowrap">✏ Edit</button>
                <button onclick="AdminController.deleteLicense('${l.key}')" style="background:rgba(255,70,70,.1);border:1px solid rgba(255,70,70,.3);color:#ff4757;border-radius:6px;padding:3px 9px;font-size:11px;cursor:pointer;white-space:nowrap">🗑</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>`;

    set('licensesEl', toolbar + table);
  }

  
  function renderUploads(files) {
    if (!files.length) {
      set('uploadsEl', emptyState('📎', 'No uploads yet'));
      return;
    }
    const header = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-weight:700">${files.length} file${files.length!==1?'s':''}</div>
      <button class="btn btn-sm" style="background:rgba(255,70,70,0.1);border:1px solid rgba(255,70,70,0.3);color:#ff4757" onclick="AdminController.clearAllUploads()">🗑 Clear All</button>
    </div>`;
    set('uploadsEl', header + `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px">
      ${files.map(f => `
        <div class="adm-card" style="padding:12px;cursor:pointer" onclick="AdminUI.viewImage('${f.url}')">
          ${f.url.match(/\.(jpg|jpeg|png|webp|gif)$/i)
            ? `<img src="${f.url}" style="width:100%;height:120px;object-fit:cover;border-radius:7px;margin-bottom:8px" onerror="this.style.display='none'">`
            : `<div style="height:70px;display:flex;align-items:center;justify-content:center;font-size:32px;background:var(--navy3);border-radius:7px;margin-bottom:8px">📄</div>`}
          <div style="font-size:10px;font-family:var(--font-m);color:var(--muted);word-break:break-all">${f.filename}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">${(f.size / 1024).toFixed(0)} KB</div>
          ${f.booking ? `<div style="margin-top:5px"><span class="badge badge-cyan" style="font-size:10px">${f.booking.ref}</span></div>` : ''}
          <a href="${f.url}" target="_blank" onclick="event.stopPropagation()" class="btn btn-ghost btn-sm mt-8 btn-full" style="font-size:11px">Open</a>
        </div>`).join('')}
    </div>`);
  }

  
  function renderLogs(logs) {
    const toolbar = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-weight:700">${logs.length} log${logs.length!==1?'s':''}</div>
      <button class="btn btn-sm" style="background:rgba(255,70,70,0.1);border:1px solid rgba(255,70,70,0.3);color:#ff4757" onclick="AdminController.clearAllLogs()">🗑 Clear All</button>
    </div>`;
    if (!logs.length) {
      set('logsEl', toolbar + `<div class="adm-card" style="padding:20px;text-align:center;color:var(--muted)">No access logs yet.</div>`);
      return;
    }
    set('logsEl', toolbar + `
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th class="adm-th">Time</th><th class="adm-th">User</th><th class="adm-th">Action</th>
          <th class="adm-th">IP</th><th class="adm-th">Details</th>
        </tr></thead>
        <tbody>
        ${logs.slice(0, 100).map(l => `<tr class="adm-tr">
          <td class="adm-td" style="font-size:11px;color:var(--muted);white-space:nowrap">${FlyWay.fmtDateTime(l.timestamp)}</td>
          <td class="adm-td" style="font-size:12px">${l.userName || l.userId?.slice(0, 8) || '-'}</td>
          <td class="adm-td"><span class="badge ${l.action.includes('LOGIN') ? 'badge-cyan' : l.action.includes('CANCEL') ? 'badge-red' : l.action.includes('BOOKING') ? 'badge-green' : 'badge-muted'}">${l.action}</span></td>
          <td class="adm-td" style="font-family:var(--font-m);font-size:10px;color:var(--muted)">${l.ip}</td>
          <td class="adm-td" style="font-size:11px;color:var(--muted)">${JSON.stringify(l.details || {}).slice(0, 80)}</td>
        </tr>`).join('')}
        </tbody>
      </table>`);
  }

  
  function viewImage(url) {
    el('imgMSrc').src = url;
    FlyWay.showModal('imgM');
  }

  
  function toast(type, title, msg) {
    FlyWay.toast(type, title, msg);
  }

  
  function realtimeToast(icon, text) {
    const c = el('toastContainer') || (() => {
      const d = document.createElement('div');
      d.id = 'toastContainer';
      d.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(d);
      return d;
    })();
    const t = document.createElement('div');
    t.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:14px 16px;background:rgba(8,15,30,0.97);border:1px solid rgba(0,212,255,0.25);border-radius:12px;min-width:280px;max-width:380px;color:#fff;font-family:inherit;box-shadow:0 8px 32px rgba(0,0,0,0.5)';
    t.innerHTML = `<div style="flex:1"><div style="font-weight:700;font-size:13px;margin-bottom:3px">${icon}</div><div style="font-size:12px;color:rgba(148,163,184,0.8)">${text}</div></div><span style="cursor:pointer;color:rgba(148,163,184,0.5);flex-shrink:0" onclick="this.parentElement.remove()">×</span>`;
    c.appendChild(t);
    setTimeout(() => t.isConnected && t.remove(), 7000);
  }

  return {
    el, set, setText, emptyState, loadingState, setLoading,
    setActiveTab, updateBadge,
    renderStats, renderLiveFeed,
    renderBookings, renderBookingDetail, renderPayments,
    renderTransactions, renderUsers, renderUserDropdown,
    renderMessages, renderPromos, renderLicenses, renderUploads, renderLogs,
    viewImage, toast, realtimeToast,
  };
})();

window.AdminUI = AdminUI;
