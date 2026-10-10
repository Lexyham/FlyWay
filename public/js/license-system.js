/**
 * FlyWay License System v2.0
 * ──────────────────────────
 * Real-time license management, Book Flight protection,
 * expiry countdown, notifications, and recovery flow.
 * Works with socket.io for instant server→client sync.
 */

(function(global) {
  'use strict';

  // ─── CONSTANTS ───────────────────────────────────────────────────────────────

  const STATUS_CFG = {
    active:    { color:'#00e396', bg:'rgba(0,227,150,0.1)',  border:'rgba(0,227,150,0.25)',  label:'Active',    icon:'●' },
    expired:   { color:'#ff5757', bg:'rgba(255,87,87,0.1)',  border:'rgba(255,87,87,0.25)',  label:'Expired',   icon:'✕' },
    suspended: { color:'#fb923c', bg:'rgba(251,146,60,0.1)', border:'rgba(251,146,60,0.25)', label:'Suspended', icon:'⏸' },
    revoked:   { color:'#ff5757', bg:'rgba(255,87,87,0.1)',  border:'rgba(255,87,87,0.25)',  label:'Revoked',   icon:'🚫' },
    paused:    { color:'#f5c842', bg:'rgba(245,200,66,0.1)', border:'rgba(245,200,66,0.25)', label:'Paused',    icon:'⏸' },
    disabled:  { color:'#94a3b8', bg:'rgba(148,163,184,0.1)',border:'rgba(148,163,184,0.25)',label:'Disabled',  icon:'○' },
    lifetime:  { color:'#a78bfa', bg:'rgba(167,139,250,0.1)',border:'rgba(167,139,250,0.25)',label:'Lifetime',  icon:'♾' },
    invalid:   { color:'#ff5757', bg:'rgba(255,87,87,0.1)',  border:'rgba(255,87,87,0.25)',  label:'Invalid',   icon:'?' },
  };

  let _state = {
    license: null,
    expiryInfo: null,
    bookingAllowed: null,  // null = unknown, true/false
    socket: null,
    pollInterval: null,
    countdownInterval: null,
    gateLocked: false,
    initialized: false,
  };

  // ─── UTILITIES ───────────────────────────────────────────────────────────────

  function _token() { return localStorage.getItem('fw_token') || ''; }
  function _user()  { try { return JSON.parse(localStorage.getItem('fw_user') || '{}'); } catch { return {}; } }

  function _api(method, url, body) {
    const opts = { method, headers: { 'Authorization': 'Bearer ' + _token(), 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(r => r.json());
  }

  function _formatCountdown(ms) {
    // Format milliseconds into HH:MM:SS countdown display
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    const pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    return pad(hours) + ':' + pad(mins) + ':' + pad(secs);
  }

  function _computeExpiry(license) {
    if (!license) return { isExpired: true, daysLeft: 0, hoursLeft: 0, text: 'No License', cls: 'expiry-expired', urgency: 'expired', isCountdown: false };

    const lStatus = (license.status || '').toLowerCase();
    if (lStatus === 'revoked')   return { isExpired: true,  daysLeft: 0, hoursLeft: 0, text: 'Revoked',   cls:'expiry-expired',  urgency:'expired', isCountdown: false };
    if (lStatus === 'suspended') return { isExpired: true,  daysLeft: 0, hoursLeft: 0, text: 'Suspended', cls:'expiry-expired',  urgency:'expired', isCountdown: false };
    if (lStatus === 'paused')    return { isExpired: true,  daysLeft: 0, hoursLeft: 0, text: 'Paused',    cls:'expiry-expired',  urgency:'expired', isCountdown: false };
    if (lStatus === 'disabled')  return { isExpired: true,  daysLeft: 0, hoursLeft: 0, text: 'Disabled',  cls:'expiry-expired',  urgency:'expired', isCountdown: false };

    if (!license.expiresAt) return { isExpired: false, daysLeft: Infinity, hoursLeft: Infinity, text: 'Lifetime License', cls:'expiry-lifetime', urgency:'lifetime', isCountdown: false };

    const now     = new Date();
    const expDate = new Date(license.expiresAt);
    const diffMs  = expDate - now;
    const diffDays  = Math.ceil(diffMs / 86400000);
    const diffHours = Math.ceil(diffMs / 3600000);

    // Lifetime check
    if (license.type === 'lifetime' || expDate.getFullYear() >= 2030) {
      return { isExpired:false, daysLeft:Infinity, hoursLeft:Infinity, text:'Lifetime License', cls:'expiry-lifetime', urgency:'lifetime', isCountdown: false };
    }

    if (diffMs < 0) {
      const agoDays  = Math.abs(diffDays);
      const agoHours = Math.abs(diffHours);
      const text = agoDays === 0
        ? 'Expired ' + agoHours + ' hour' + (agoHours!==1?'s':'') + ' ago'
        : 'Expired ' + agoDays + ' day' + (agoDays!==1?'s':'') + ' ago';
      return { isExpired:true, daysLeft:agoDays, hoursLeft:agoHours, text, cls:'expiry-expired', urgency:'expired', isCountdown: false };
    }

    if (lStatus !== 'active') {
      return { isExpired:true, daysLeft:diffDays, hoursLeft:diffHours, text:'License Inactive', cls:'expiry-expired', urgency:'expired', isCountdown: false };
    }

    let text, cls, urgency, isCountdown = false, isHidden = false;
    if (diffMs < 86400000) {
      // Live countdown for licenses expiring within 24 hours — show HH:MM:SS only
      text = _formatCountdown(diffMs);
      cls = 'expiry-soon';
      urgency = 'soon';
      isCountdown = true;
    }
    else {
      // More than 24 h remaining — display a friendly expiration date
      if (diffDays === 0) {
        text = 'Expires today';
      } else if (diffDays <= 7) {
        text = 'Expires in ' + diffDays + ' day' + (diffDays === 1 ? '' : 's');
      } else {
        text = 'Expires ' + new Date(license.expiresAt).toLocaleDateString();
      }
      cls = 'expiry-ok';
      urgency = 'ok';
      isHidden = false;
    }

    return { isExpired:false, daysLeft:diffDays, hoursLeft:diffHours, text, cls, urgency, isCountdown, isHidden };
  }

  function _isBookingAllowed(license, expiryInfo) {
    if (!license) return false;
    if (expiryInfo.isExpired) return false;
    const lStatus = (license.status || '').toLowerCase();
    return lStatus === 'active';
  }

  // ─── NOTIFICATION ─────────────────────────────────────────────────────────────

  function showLicenseNotif(type, title, message) {
    // type: 'success' | 'warning' | 'error' | 'info'
    const icons = { success:'✅', warning:'⚠️', error:'🔐', info:'🔑' };
    const colors = { success:'#00e396', warning:'#f5c842', error:'#ff5757', info:'#00d4ff' };
    const col = colors[type] || colors.info;

    const el = document.createElement('div');
    el.className = 'fw-lic-notif';
    el.style.borderColor = col + '40';
    el.innerHTML =
      '<div class="fw-lic-notif-icon">' + (icons[type]||'🔑') + '</div>' +
      '<div class="fw-lic-notif-content">' +
        '<div class="fw-lic-notif-title">' + title + '</div>' +
        '<div class="fw-lic-notif-msg">' + message + '</div>' +
      '</div>' +
      '<button class="fw-lic-notif-close" onclick="this.closest(\'.fw-lic-notif\').remove()">×</button>';

    document.body.appendChild(el);
    setTimeout(function() {
      el.style.animation = 'fw-notif-out 0.3s ease forwards';
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 5500);
  }

  // ─── EXPIRY DISPLAY UPDATE ───────────────────────────────────────────────────

  function _updateExpiryUI(expiryInfo) {
    const el = document.getElementById('licenseExpiry');
    if (!el) return;

    // Display expiry row for all license states; use countdown only when expiring soon
    if (expiryInfo.isHidden) {
      el.style.display = 'none';
    } else {
      el.style.display = '';
      el.className = 'fw-license-expiry ' + expiryInfo.cls;

      let icon = '🟢';
      if      (expiryInfo.isExpired)              icon = '🔴';
      else if (expiryInfo.urgency === 'lifetime')  icon = '♾';
      else if (expiryInfo.urgency === 'soon')      icon = '🟡';

      // For the live countdown we show ONLY the HH:MM:SS — no extra label text
      const display = expiryInfo.isCountdown
        ? expiryInfo.text
        : icon + ' ' + expiryInfo.text;

      el.innerHTML =
        '<span class="fw-license-countdown">' +
          (expiryInfo.isCountdown ? '🟡 ' : '') + display +
        '</span>';
    }

    // Update status badge
    const statusEl = document.getElementById('licenseStatus');
    if (statusEl) {
      if (expiryInfo.isExpired) {
        statusEl.textContent = '● Expired';
        statusEl.className = 'badge badge-red';
      } else if (expiryInfo.urgency === 'lifetime') {
        statusEl.textContent = '● Lifetime';
        statusEl.className = 'badge badge-purple';
      } else {
        statusEl.textContent = '● Active';
        statusEl.className = 'badge badge-green';
      }
    }

    // Start/restart countdown interval based on expiry status
    if (expiryInfo.isCountdown) {
      startCountdown(); // Restart with 1-second interval
    } else {
      stopCountdown();
    }

    // Update Book Flight button/link state
    _updateBookFlightAccess(!expiryInfo.isExpired);
    _setBookingButtonState(!expiryInfo.isExpired && _state.bookingAllowed !== false);
  }

  function _setBookingButtonState(allowed) {
    const submitBtn = document.getElementById('payBtn');
    if (!submitBtn) return;
    submitBtn.disabled = !allowed;
    submitBtn.style.opacity = allowed ? '' : '0.5';
    submitBtn.title = allowed ? '' : 'License required to submit booking';
  }

  function _updateBookFlightAccess(allowed) {
    // Guard all Book Flight nav links
    const bookLinks = document.querySelectorAll('a[href="/booking"], .nav-link[href="/booking"], .sidebar-nav-item[href="/booking"]');
    bookLinks.forEach(function(link) {
      if (!allowed) {
        if (!link.dataset.fwOrigHref) link.dataset.fwOrigHref = link.getAttribute('href');
        link.setAttribute('href', '#');
        link.onclick = function(e) { e.preventDefault(); FWLicense.showBookingGate(); };
        link.style.opacity = '0.65';
        link.title = 'License required to book flights';
      } else {
        if (link.dataset.fwOrigHref) link.setAttribute('href', link.dataset.fwOrigHref);
        link.onclick = null;
        link.style.opacity = '';
        link.title = '';
      }
    });

    // Guard the main dashboard "Book a Flight" button
    const dashBtn = document.querySelector('.page-header .btn-primary[href="/booking"]');
    if (dashBtn) {
      if (!allowed) {
        dashBtn.setAttribute('href', '#');
        dashBtn.onclick = function(e) { e.preventDefault(); FWLicense.showBookingGate(); };
        dashBtn.style.opacity = '0.65';
      } else {
        dashBtn.setAttribute('href', '/booking');
        dashBtn.onclick = null;
        dashBtn.style.opacity = '';
      }
    }
  }

  // ─── BOOK FLIGHT GATE ────────────────────────────────────────────────────────

  function showBookingGate() {
    if (document.getElementById('fwBookingGate')) return; // already shown

    const lic  = _state.license;
    const exp  = _state.expiryInfo || { text:'License Invalid', urgency:'expired', isExpired:true };
    const user = _user();

    const lStatus = lic ? (lic.status || 'unknown').toLowerCase() : 'unknown';
    const statusCfg = STATUS_CFG[lStatus === 'active' ? 'expired' : lStatus] || STATUS_CFG.expired;
    const expColor  = exp.urgency === 'expired' ? '#ff5757' : '#f5c842';

    // Reason text
    let reasonTitle = '🔐 Flight Booking Restricted';
    let reasonSub   = 'Your license has expired. Enter a new valid license key to restore booking access.';
    let reasonIcon  = '🔐';

    if (lStatus === 'suspended')  { reasonTitle = '⏸ License Suspended'; reasonSub = 'Your license has been suspended by admin. Contact support to reactivate.'; reasonIcon = '⏸'; }
    else if (lStatus === 'revoked') { reasonTitle = '🚫 License Revoked'; reasonSub = 'Your license has been revoked. Contact admin for assistance.'; reasonIcon = '🚫'; }
    else if (lStatus === 'paused')  { reasonTitle = '⏸ License Paused'; reasonSub = 'Your license is currently paused. Enter a new key or contact admin.'; reasonIcon = '⏸'; }

    const overlay = document.createElement('div');
    overlay.id = 'fwBookingGate';
    overlay.className = 'fw-license-gate';

    overlay.innerHTML =
      '<div class="fw-license-gate-inner">' +
        '<div class="fw-gate-icon">' + reasonIcon + '</div>' +
        '<div class="fw-gate-title">' + reasonTitle + '</div>' +
        '<div class="fw-gate-sub">' + reasonSub + '</div>' +

        '<div class="fw-gate-status-row">' +
          '<span class="fw-gate-badge" style="color:' + expColor + ';background:' + expColor + '15;border-color:' + expColor + '30">' +
            '🔑 ' + (user.licenseKey || 'No Key Assigned') +
          '</span>' +
          '<span class="fw-gate-badge" style="color:' + expColor + ';background:' + expColor + '15;border-color:' + expColor + '30">' +
            exp.text +
          '</span>' +
        '</div>' +

        '<div class="fw-gate-input-group">' +
          '<label class="fw-gate-input-label">Enter New License Key</label>' +
          '<input id="fwGateKeyInput" class="fw-gate-input" type="text" placeholder="FLY-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false">' +
          '<div id="fwGateMsg" class="fw-gate-msg"></div>' +
        '</div>' +

        '<div class="fw-gate-actions">' +
          '<button class="fw-gate-btn-primary" id="fwGateActivateBtn" onclick="FWLicense._gateActivate()">🔑 Verify & Activate License</button>' +

          '<div class="fw-gate-divider"><span>or</span></div>' +

          '<button class="fw-gate-btn-secondary" onclick="FWLicense._gateContactAdmin()">📧 Request Activation from Admin</button>' +
          '<button class="fw-gate-btn-secondary" onclick="window.location.href=\'/dashboard\'">← Back to Dashboard</button>' +
        '</div>' +

        '<div class="fw-gate-info-row">' +
          'Only new flight bookings are restricted. You can still view your bookings, tickets, and receipts.' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    const inp = document.getElementById('fwGateKeyInput');
    if (inp) {
      inp.addEventListener('input', function() { this.value = this.value.toUpperCase().replace(/[^A-Z0-9\-]/g,''); });
      inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') FWLicense._gateActivate(); });
      setTimeout(function() { inp.focus(); }, 100);
    }
  }

  async function _gateActivate() {
    const inp = document.getElementById('fwGateKeyInput');
    const msg = document.getElementById('fwGateMsg');
    const btn = document.getElementById('fwGateActivateBtn');
    if (!inp || !msg || !btn) return;

    const key = inp.value.trim().toUpperCase();
    if (!key || key.length < 6) {
      msg.style.color = '#ff5757';
      msg.textContent = '❌ Please enter a valid license key';
      return;
    }

    msg.style.color = 'rgba(255,255,255,0.4)';
    msg.textContent = '⏳ Verifying license...';
    inp.disabled = true;
    btn.disabled = true;
    btn.textContent = '⏳ Verifying...';

    try {
      // Step 1: Validate
      const v = await _api('POST', '/api/auth/validate-license', { licenseKey: key });
      if (!v.valid) {
        msg.style.color = '#ff5757';
        msg.textContent = '❌ ' + (v.message || 'Invalid license key');
        inp.disabled = false;
        btn.disabled = false;
        btn.textContent = '🔑 Verify & Activate License';
        return;
      }

      msg.style.color = '#00d4ff';
      msg.textContent = '✅ Key verified — activating...';

      // Step 2: Apply
      const r = await _api('POST', '/api/auth/update-license', { licenseKey: key });
      if (r.error) {
        // update-license might reject for valid reasons but key was validated — proceed anyway
        if (r.error.toLowerCase().includes('already')) {
          msg.style.color = '#f5c842';
          msg.textContent = '⚠️ ' + r.error;
          inp.disabled = false;
          btn.disabled = false;
          btn.textContent = '🔑 Try Another Key';
          return;
        }
      }

      // Success
      try {
        const u = JSON.parse(localStorage.getItem('fw_user') || '{}');
        u.licenseKey = key;
        localStorage.setItem('fw_user', JSON.stringify(u));
      } catch(e) {}

      msg.style.color = '#00e396';
      msg.textContent = '✅ License activated! Restoring booking access...';
      btn.textContent = '✅ Activated!';

      showLicenseNotif('success', '🔑 License Activated', 'Your license key has been activated. Flight booking is now available!');

      // Close gate and restore access
      setTimeout(function() {
        const gate = document.getElementById('fwBookingGate');
        if (gate) gate.remove();
        _state.gateLocked = false;
        // Re-fetch license state
        FWLicense.init(true);
      }, 1200);

    } catch(e) {
      msg.style.color = '#ff5757';
      msg.textContent = '❌ Verification failed. Please try again.';
      inp.disabled = false;
      btn.disabled = false;
      btn.textContent = '🔑 Verify & Activate License';
    }
  }

  function _gateContactAdmin() {
    // Redirect to contact page with pre-filled subject
    const user = _user();
    const ref  = encodeURIComponent('License Activation Request — ' + (user.username || user.email || ''));
    window.location.href = '/contact?subject=' + ref;
  }

  // ─── RENEWAL MODAL (dashboard soft prompt) ───────────────────────────────────

  function showRenewalModal(expiryInfo) {
    if (sessionStorage.getItem('fw_lic_shown_v2')) return;
    sessionStorage.setItem('fw_lic_shown_v2', '1');

    const isExpired = expiryInfo.isExpired;
    const title   = isExpired ? '🔑 License Expired' : '⏳ License Expiring Soon';
    const sub     = isExpired
      ? 'Your license has expired. Enter a new valid key to restore flight booking access.'
      : 'Your license expires ' + expiryInfo.text.toLowerCase() + '. You can renew now or continue until it expires.';

    const overlay = document.createElement('div');
    overlay.id = 'fw_lic_renew_modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,8,18,0.88);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);animation:fw-gate-in 0.3s ease';

    overlay.innerHTML =
      '<div style="background:linear-gradient(145deg,#08101e,#0d1c38);border:1px solid rgba(0,212,255,0.2);border-radius:22px;max-width:460px;width:100%;padding:32px;box-shadow:0 24px 80px rgba(0,0,0,0.7);position:relative">' +
        '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,' + (isExpired?'#ff5757':'#f5c842') + ' 50%,transparent);border-radius:2px 2px 0 0"></div>' +
        '<div style="font-size:36px;text-align:center;margin-bottom:12px">' + (isExpired ? '🔐' : '⏳') + '</div>' +
        '<h2 style="font-family:var(--font-h);font-size:20px;font-weight:800;text-align:center;margin-bottom:8px">' + title + '</h2>' +
        '<p style="color:var(--muted);font-size:13px;text-align:center;line-height:1.7;margin-bottom:22px">' + sub + '</p>' +

        '<div style="margin-bottom:14px">' +
          '<label style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);display:block;margin-bottom:6px;font-weight:700">New License Key</label>' +
          '<input id="licRenewalInput" type="text" placeholder="FLY-XXXX-XXXX-XXXX" style="width:100%;background:rgba(0,212,255,0.04);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:13px 15px;color:#e0f0ff;font-family:monospace;font-size:14px;letter-spacing:2px;outline:none;text-transform:uppercase;box-sizing:border-box">' +
          '<div id="licRenewalMsg" style="font-size:12px;margin-top:6px;min-height:18px;font-weight:600"></div>' +
        '</div>' +

        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button onclick="FWLicense._renewActivate()" style="flex:1;padding:13px;background:linear-gradient(135deg,#0044cc,#00d4ff);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--font,sans-serif)">🔑 Verify & Activate</button>' +
          (!isExpired ? '<button onclick="document.getElementById(\'fw_lic_renew_modal\').remove()" style="padding:13px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:var(--muted);font-size:13px;cursor:pointer;font-family:var(--font,sans-serif)">Later</button>' : '') +
        '</div>' +

        (isExpired ? '<p style="font-size:11px;color:rgba(255,255,255,0.2);text-align:center;margin-top:14px">Only flight booking is restricted. You can still access your dashboard and bookings.</p>' : '') +
      '</div>';

    document.body.appendChild(overlay);

    const inp = document.getElementById('licRenewalInput');
    if (inp) {
      inp.addEventListener('input', function() { this.value = this.value.toUpperCase(); });
      inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') FWLicense._renewActivate(); });
    }
  }

  async function _renewActivate() {
    const inp = document.getElementById('licRenewalInput');
    const msg = document.getElementById('licRenewalMsg');
    if (!inp || !msg) return;

    const key = inp.value.trim().toUpperCase();
    if (!key) { msg.style.color = '#ff5757'; msg.textContent = '❌ Please enter a license key'; return; }

    msg.style.color = 'rgba(255,255,255,0.4)'; msg.textContent = '⏳ Verifying...';
    inp.disabled = true;

    try {
      const v = await _api('POST', '/api/auth/validate-license', { licenseKey: key });
      if (!v.valid) {
        msg.style.color = '#ff5757'; msg.textContent = '❌ ' + (v.message || 'Invalid key');
        inp.disabled = false;
        return;
      }

      const r = await _api('POST', '/api/auth/update-license', { licenseKey: key });

      try {
        const u = JSON.parse(localStorage.getItem('fw_user') || '{}');
        u.licenseKey = key;
        localStorage.setItem('fw_user', JSON.stringify(u));
      } catch(e) {}

      msg.style.color = '#00e396'; msg.textContent = '✅ License activated!';
      showLicenseNotif('success', '🔑 License Renewed!', 'Your account is now active. Flight booking restored!');

      setTimeout(function() {
        const ov = document.getElementById('fw_lic_renew_modal');
        if (ov) ov.remove();
        sessionStorage.removeItem('fw_lic_shown_v2');
        FWLicense.init(true);
      }, 1000);
    } catch(e) {
      msg.style.color = '#ff5757'; msg.textContent = '❌ Verification failed. Try again.';
      inp.disabled = false;
    }
  }

  // Legacy compat for old dashboard.html function
  function activateLicenseRenewal() { FWLicense._renewActivate(); }

  // ─── INIT & POLLING ──────────────────────────────────────────────────────────

  async function init(silent) {
    const user = _user();
    if (!user || !user.id) return;

    try {
      const lic = await _api('GET', '/api/user/license');
      if (!lic || !lic.found) {
        _state.license = null;
        _state.expiryInfo = { isExpired:true, text:'No License', cls:'expiry-expired', urgency:'expired', daysLeft:0 };
        _state.bookingAllowed = false;
        _updateExpiryUI(_state.expiryInfo);
        return;
      }

      _state.license    = lic;
      _state.expiryInfo = _computeExpiry(lic);
      _state.bookingAllowed = _isBookingAllowed(lic, _state.expiryInfo);

      _updateExpiryUI(_state.expiryInfo);

      // License display
      const licDisp = document.getElementById('licenseDisplay');
      if (licDisp) licDisp.textContent = lic.key || '-';

      const licType = document.getElementById('licenseType');
      if (licType) licType.textContent = (lic.type || 'standard').charAt(0).toUpperCase() + (lic.type||'standard').slice(1);

      // Show renewal prompt if needed (non-booking pages)
      if (!silent && !_state.initialized) {
        if (_state.expiryInfo.isExpired && !document.getElementById('fw_lic_renew_modal')) {
          setTimeout(function() { showRenewalModal(_state.expiryInfo); }, 900);
      } else if (_state.expiryInfo.isCountdown && !document.getElementById('fw_lic_renew_modal')) {
          setTimeout(function() { showRenewalModal(_state.expiryInfo); }, 1200);
      }

      // Only warn for licenses actively counting down in the final 24 hours
      if (_state.expiryInfo.isCountdown) {
        showLicenseNotif('warning', '⏳ License Expiring Today', 'Your license expires in ' + _state.expiryInfo.text.toLowerCase() + '. Renew now to keep booking access.');
      }
      }

      _state.initialized = true;

    } catch(e) {
      console.warn('[FWLicense] init error:', e);
    }
  }

  function startPolling(intervalMs) {
    intervalMs = intervalMs || 30000; // 30s default
    if (_state.pollInterval) clearInterval(_state.pollInterval);
    _state.pollInterval = setInterval(function() { init(true); }, intervalMs);
  }

  function stopPolling() {
    if (_state.pollInterval) { clearInterval(_state.pollInterval); _state.pollInterval = null; }
  }

  // Live countdown ticker
  function startCountdown() {
    if (_state.countdownInterval) clearInterval(_state.countdownInterval);
    // Update every second for 24-hour countdown, or every minute for other updates
    const interval = _state.expiryInfo && _state.expiryInfo.isCountdown ? 1000 : 60000;
    _state.countdownInterval = setInterval(function() {
      if (_state.license) {
        _state.expiryInfo = _computeExpiry(_state.license);
        _updateExpiryUI(_state.expiryInfo);
      }
    }, interval);
  }

  function stopCountdown() {
    if (_state.countdownInterval) { clearInterval(_state.countdownInterval); _state.countdownInterval = null; }
  }

  // ─── SOCKET.IO INTEGRATION ──────────────────────────────────────────────────

  function connectSocket(socket) {
    if (!socket) return;
    _state.socket = socket;
    const user = _user();
    if (!user || !user.id) return;

    socket.on('license_update_' + user.id, function(data) {
      if (!data) return;

      const newStatus = (data.status || '').toLowerCase();
      const expiryInfo = data.expiryInfo ? data.expiryInfo : _computeExpiry(data);

      // Merge into state
      if (_state.license) {
        _state.license.status = newStatus;
        if (data.expiresAt) _state.license.expiresAt = data.expiresAt;
      }

      _state.expiryInfo = expiryInfo && expiryInfo.text
        ? expiryInfo
        : _computeExpiry(_state.license);

      _state.bookingAllowed = _isBookingAllowed(_state.license, _state.expiryInfo);
      _updateExpiryUI(_state.expiryInfo);
      _setBookingButtonState(_state.bookingAllowed);

      // Notification messages
      const msgs = {
        active:    ['success', '🔑 License Activated',  'Your license is now active. Flight booking available!'],
        suspended: ['warning', '⏸ License Suspended',  'Your license has been suspended. Flight booking restricted.'],
        revoked:   ['error',   '🚫 License Revoked',   'Your license has been revoked. Contact admin.'],
        paused:    ['warning', '⏸ License Paused',     'Your license is currently paused.'],
        disabled:  ['error',   '🔴 License Disabled',  'Your license has been disabled. Contact admin.'],
        expired:   ['error',   '🔐 License Expired',   'Your license has expired. Flight booking restricted.'],
      };

      const notifArgs = msgs[newStatus] || msgs.active;
      showLicenseNotif(notifArgs[0], notifArgs[1], notifArgs[2]);

      // If booking page: show gate if now restricted
      if (!_state.bookingAllowed && window.location.pathname === '/booking') {
        if (!document.getElementById('fwBookingGate')) showBookingGate();
      }

      // If gate is open and now active: close it
      if (_state.bookingAllowed) {
        const gate = document.getElementById('fwBookingGate');
        if (gate) gate.remove();
        const modal = document.getElementById('fw_lic_renew_modal');
        if (modal) modal.remove();
      }
    });
  }

  // ─── BOOKING PAGE GUARD ──────────────────────────────────────────────────────

  async function guardBookingPage() {
    // Called from booking.html on load
    const user = _user();
    if (!user || !user.id) return; // not logged in, let auth handle

    try {
      const lic = await _api('GET', '/api/user/license');
      if (!lic || !lic.found) {
        _showBookingPageBlock({ text:'No License Found', isExpired:true, urgency:'expired' });
        return;
      }

      const expiryInfo = _computeExpiry(lic);
      _state.license = lic;
      _state.expiryInfo = expiryInfo;
      _state.bookingAllowed = _isBookingAllowed(lic, expiryInfo);

      if (!_state.bookingAllowed) {
        _showBookingPageBlock(expiryInfo);
      } else {
        _setBookingButtonState(true);
      }
    } catch(e) {
      // Network error — allow through (backend will validate)
      console.warn('[FWLicense] guard check failed:', e);
    }
  }

  function _showBookingPageBlock(expiryInfo) {
    // On the booking page itself, show the gate overlay
    if (!document.getElementById('fwBookingGate')) {
      showBookingGate();
    }
    // Also disable the submit button
    const submitBtn = document.getElementById('payBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.title = 'License required to submit booking';
      submitBtn.style.opacity = '0.5';
    }
  }

  // ─── VALIDATE BEFORE SUBMIT ──────────────────────────────────────────────────

  async function validateBeforeSubmit() {
    // Returns true if allowed to proceed
    try {
      const lic = await _api('GET', '/api/user/license');
      if (!lic || !lic.found) {
        showBookingGate();
        return false;
      }
      const expiryInfo = _computeExpiry(lic);
      if (!_isBookingAllowed(lic, expiryInfo)) {
        showBookingGate();
        _setBookingButtonState(false);
        return false;
      }
      _setBookingButtonState(true);
      return true;
    } catch(e) {
      // If can't verify, allow (server-side will catch)
      return true;
    }
  }

  // ─── DASHBOARD INLINE KEY EDITOR ─────────────────────────────────────────────

  function showDashboardKeyEditor() {
    const wrap = document.getElementById('fwLicenseEditWrap');
    const keyDisp = document.getElementById('licenseDisplay');
    if (!wrap) return;
    // Toggle visibility
    if (wrap.style.display !== 'none' && wrap.style.display !== '') {
      wrap.style.display = 'none';
      return;
    }
    // Pre-fill with current key
    const inp = document.getElementById('fwDashKeyInput');
    if (inp && keyDisp) inp.value = keyDisp.textContent.trim() === '-' ? '' : keyDisp.textContent.trim();
    const msg = document.getElementById('fwDashKeyMsg');
    if (msg) { msg.textContent = ''; }
    wrap.style.display = 'block';
    if (inp) setTimeout(function() { inp.focus(); inp.select(); }, 60);
  }

  async function _dashKeySave() {
    const inp = document.getElementById('fwDashKeyInput');
    const msg = document.getElementById('fwDashKeyMsg');
    const btn = document.getElementById('fwDashKeySaveBtn');
    if (!inp || !msg || !btn) return;

    const key = inp.value.trim().toUpperCase();
    if (!key || key.length < 6) {
      msg.style.color = '#ff5757';
      msg.textContent = '❌ Enter a valid license key';
      return;
    }

    msg.style.color = 'rgba(255,255,255,0.4)';
    msg.textContent = '⏳ Verifying…';
    inp.disabled = true;
    btn.disabled = true;
    btn.textContent = '⏳';

    try {
      const v = await _api('POST', '/api/auth/validate-license', { licenseKey: key });
      if (!v.valid) {
        msg.style.color = '#ff5757';
        msg.textContent = '❌ ' + (v.message || 'Invalid license key');
        inp.disabled = false;
        btn.disabled = false;
        btn.textContent = 'Save';
        return;
      }

      msg.style.color = '#00d4ff';
      msg.textContent = '✅ Verified — activating…';

      const r = await _api('POST', '/api/auth/update-license', { licenseKey: key });
      if (r && r.error && r.error.toLowerCase && r.error.toLowerCase().includes('already')) {
        msg.style.color = '#f5c842';
        msg.textContent = '⚠️ ' + r.error;
        inp.disabled = false;
        btn.disabled = false;
        btn.textContent = 'Save';
        return;
      }

      // Persist locally
      try {
        const u = JSON.parse(localStorage.getItem('fw_user') || '{}');
        u.licenseKey = key;
        localStorage.setItem('fw_user', JSON.stringify(u));
      } catch(e) {}

      // Update display immediately
      const keyDisp = document.getElementById('licenseDisplay');
      if (keyDisp) keyDisp.textContent = key;

      msg.style.color = '#00e396';
      msg.textContent = '✅ License updated!';
      btn.textContent = '✅';

      showLicenseNotif('success', '🔑 License Updated', 'Your new license key is active. Enjoy booking!');

      setTimeout(function() {
        const wrap = document.getElementById('fwLicenseEditWrap');
        if (wrap) wrap.style.display = 'none';
        inp.disabled = false;
        btn.disabled = false;
        btn.textContent = 'Save';
        FWLicense.init(true);
      }, 1000);

    } catch(e) {
      msg.style.color = '#ff5757';
      msg.textContent = '❌ Verification failed. Try again.';
      inp.disabled = false;
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  }

  // ─── PUBLIC API ──────────────────────────────────────────────────────────────

  const FWLicense = {
    init,
    startPolling,
    stopPolling,
    startCountdown,
    connectSocket,
    guardBookingPage,
    validateBeforeSubmit,
    showBookingGate,
    showRenewalModal,
    showLicenseNotif,
    showDashboardKeyEditor,
    _dashKeySave,
    _gateActivate,
    _renewActivate,
    _gateContactAdmin,
    activateLicenseRenewal, // legacy compat
    getState: function() { return _state; },
    isBookingAllowed: function() { return _state.bookingAllowed !== false; },
  };

  global.FWLicense = FWLicense;

})(window);
