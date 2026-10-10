const FlyWay = {
  API: '',
  token: null,
  user: null,
  AI_NAME: 'Zephyr',
  init() {
    this.token = localStorage.getItem('fw_token');
    try { const s = localStorage.getItem('fw_user'); if(s) this.user = JSON.parse(s); } catch(e) {}
    this.setupNavbar();
    this.setupChat();
  },
  getHeaders(multipart) {
    const h = {};
    if (!multipart) h['Content-Type'] = 'application/json';
    if (this.token) h['Authorization'] = 'Bearer ' + this.token;
    return h;
  },
  async api(method, endpoint, data, multipart) {
    const opts = { method: method, headers: this.getHeaders(multipart) };
    if (data) { opts.body = multipart ? data : JSON.stringify(data); }
    const res = await fetch(this.API + endpoint, opts);
    const json = await res.json().catch(function(){ return {}; });
    if (!res.ok) throw new Error(json.error || json.message || 'Request failed (' + res.status + ')');
    return json;
  },
  isLoggedIn() { return !!(this.token && this.user); },
  requireAuth(adminRequired) {
    if (!this.isLoggedIn()) { window.location.href = '/login'; return false; }
    if (adminRequired && this.user.role !== 'admin') {
      window.location.href = '/dashboard';
      return false;
    }
    return true;
  },
  logout() {
    localStorage.removeItem('fw_token');
    localStorage.removeItem('fw_user');
    window.location.href = '/';
  },
  toast(type, title, msg) {
    let c = document.getElementById('toastContainer');
    if (!c) { c = document.createElement('div'); c.id = 'toastContainer'; document.body.appendChild(c); }
    const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = '<span class="toast-icon">' + (icons[type]||'ℹ️') + '</span>' +
      '<div class="toast-body"><div class="toast-title">' + title + '</div>' +
      (msg ? '<div class="toast-msg">' + msg + '</div>' : '') + '</div>' +
      '<span class="toast-close" onclick="this.parentElement.remove()">×</span>';
    c.appendChild(t);
    setTimeout(function(){ t.remove(); }, 5000);
  },
  setLoading(btn, loading) {
    if (!btn) return;
    if (loading) { btn._orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="loading-spinner"></span> Please wait...'; }
    else { btn.disabled = false; btn.innerHTML = btn._orig || btn.innerHTML; }
  },
  setupNavbar() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    window.addEventListener('scroll', function(){ nav.classList.toggle('scrolled', window.scrollY > 30); });
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(function(l){
      const href = l.getAttribute('href') || '';
      if (href && (href === path || (href !== '/' && path.startsWith(href)))) l.classList.add('active');
    });
    this.updateNavAuth();
  },
  updateNavAuth() {
    const loggedIn = this.isLoggedIn();
    const loginBtn  = document.getElementById('navLoginBtn');
    const dashBtn   = document.getElementById('navDashBtn');
    const logoutBtn = document.getElementById('navLogoutBtn');
    const getStart  = document.getElementById('navGetStarted');
    const myAcct    = document.getElementById('navMyAccount');
    const chip      = document.getElementById('navUserChip');
    if (loggedIn) {
      loginBtn  && loginBtn.classList.add('hidden');
      getStart  && getStart.classList.add('hidden');
      dashBtn   && dashBtn.classList.remove('hidden');
      logoutBtn && logoutBtn.classList.remove('hidden');
      myAcct    && myAcct.classList.remove('hidden');
      if (chip) { chip.classList.remove('hidden'); chip.textContent = this.user.username; }
    } else {
      loginBtn  && loginBtn.classList.remove('hidden');
      getStart  && getStart.classList.remove('hidden');
      dashBtn   && dashBtn.classList.add('hidden');
      logoutBtn && logoutBtn.classList.add('hidden');
      myAcct    && myAcct.classList.add('hidden');
      chip      && chip.classList.add('hidden');
    }
  },
  setupSidebar() {
    const path = window.location.pathname;
    document.querySelectorAll('.sidebar-nav-item[href]').forEach(function(l){
      const href = l.getAttribute('href') || '';
      if (href && (href === path || (href !== '/' && path.startsWith(href)))) l.classList.add('active');
    });
    if (this.user) {
      const u = this.user;
      const nameEl   = document.querySelector('.user-name');
      const subEl    = document.querySelector('.user-sub');
      const avatarEl = document.querySelector('.user-avatar');
      if (nameEl)   nameEl.textContent  = u.firstName ? (u.firstName + ' ' + (u.lastName||'')).trim() : u.username;
      if (subEl)    subEl.textContent   = (u.loyaltyPoints||0).toLocaleString() + ' pts · ' + u.role;
      if (avatarEl) {
        if (u.avatar) avatarEl.innerHTML = '<img src="' + u.avatar + '" alt="avatar">';
        else avatarEl.textContent = (u.firstName || u.username || 'U')[0].toUpperCase();
      }
    }
  },
  airports: [
    {code:'JFK',city:'New York',name:'John F. Kennedy Intl',country:'USA',flag:'🇺🇸'},
    {code:'LAX',city:'Los Angeles',name:'Los Angeles Intl',country:'USA',flag:'🇺🇸'},
    {code:'ORD',city:'Chicago',name:"O'Hare International",country:'USA',flag:'🇺🇸'},
    {code:'ATL',city:'Atlanta',name:'Hartsfield-Jackson',country:'USA',flag:'🇺🇸'},
    {code:'DFW',city:'Dallas',name:'Dallas/Fort Worth Intl',country:'USA',flag:'🇺🇸'},
    {code:'DEN',city:'Denver',name:'Denver International',country:'USA',flag:'🇺🇸'},
    {code:'SFO',city:'San Francisco',name:'SFO International',country:'USA',flag:'🇺🇸'},
    {code:'MIA',city:'Miami',name:'Miami International',country:'USA',flag:'🇺🇸'},
    {code:'SEA',city:'Seattle',name:'Seattle-Tacoma',country:'USA',flag:'🇺🇸'},
    {code:'LAS',city:'Las Vegas',name:'Harry Reid International',country:'USA',flag:'🇺🇸'},
    {code:'BOS',city:'Boston',name:'Logan International',country:'USA',flag:'🇺🇸'},
    {code:'MCO',city:'Orlando',name:'Orlando International',country:'USA',flag:'🇺🇸'},
    {code:'PHX',city:'Phoenix',name:'Phoenix Sky Harbor',country:'USA',flag:'🇺🇸'},
    {code:'EWR',city:'Newark',name:'Newark Liberty Intl',country:'USA',flag:'🇺🇸'},
    {code:'IAH',city:'Houston',name:'George Bush Intercontinental',country:'USA',flag:'🇺🇸'},
    {code:'CLT',city:'Charlotte',name:'Charlotte Douglas Intl',country:'USA',flag:'🇺🇸'},
    {code:'PHL',city:'Philadelphia',name:'Philadelphia International',country:'USA',flag:'🇺🇸'},
    {code:'SAN',city:'San Diego',name:'San Diego International',country:'USA',flag:'🇺🇸'},
    {code:'TPA',city:'Tampa',name:'Tampa International',country:'USA',flag:'🇺🇸'},
    {code:'PDX',city:'Portland',name:'Portland International',country:'USA',flag:'🇺🇸'},
    {code:'SLC',city:'Salt Lake City',name:'Salt Lake City Intl',country:'USA',flag:'🇺🇸'},
    {code:'BNA',city:'Nashville',name:'Nashville International',country:'USA',flag:'🇺🇸'},
    {code:'AUS',city:'Austin',name:'Austin-Bergstrom Intl',country:'USA',flag:'🇺🇸'},
    {code:'MSP',city:'Minneapolis',name:'Minneapolis-Saint Paul',country:'USA',flag:'🇺🇸'},
    {code:'DTW',city:'Detroit',name:'Detroit Metropolitan',country:'USA',flag:'🇺🇸'},
    {code:'YYZ',city:'Toronto',name:'Pearson International',country:'Canada',flag:'🇨🇦'},
    {code:'YVR',city:'Vancouver',name:'Vancouver International',country:'Canada',flag:'🇨🇦'},
    {code:'YUL',city:'Montreal',name:'Montreal-Trudeau Intl',country:'Canada',flag:'🇨🇦'},
    {code:'MEX',city:'Mexico City',name:'Benito Juarez International',country:'Mexico',flag:'🇲🇽'},
    {code:'CUN',city:'Cancun',name:'Cancun International',country:'Mexico',flag:'🇲🇽'},
    {code:'GRU',city:'Sao Paulo',name:'Guarulhos International',country:'Brazil',flag:'🇧🇷'},
    {code:'GIG',city:'Rio de Janeiro',name:'Galeao International',country:'Brazil',flag:'🇧🇷'},
    {code:'BOG',city:'Bogota',name:'El Dorado International',country:'Colombia',flag:'🇨🇴'},
    {code:'SCL',city:'Santiago',name:'Arturo Merino Benitez Intl',country:'Chile',flag:'🇨🇱'},
    {code:'LIM',city:'Lima',name:'Jorge Chavez International',country:'Peru',flag:'🇵🇪'},
    {code:'EZE',city:'Buenos Aires',name:'Ministro Pistarini Intl',country:'Argentina',flag:'🇦🇷'},
    {code:'LHR',city:'London',name:'Heathrow Airport',country:'UK',flag:'🇬🇧'},
    {code:'LGW',city:'London',name:'Gatwick Airport',country:'UK',flag:'🇬🇧'},
    {code:'MAN',city:'Manchester',name:'Manchester Airport',country:'UK',flag:'🇬🇧'},
    {code:'CDG',city:'Paris',name:'Charles de Gaulle',country:'France',flag:'🇫🇷'},
    {code:'ORY',city:'Paris',name:'Orly Airport',country:'France',flag:'🇫🇷'},
    {code:'NCE',city:'Nice',name:'Cote d\'Azur Airport',country:'France',flag:'🇫🇷'},
    {code:'FRA',city:'Frankfurt',name:'Frankfurt Airport',country:'Germany',flag:'🇩🇪'},
    {code:'MUC',city:'Munich',name:'Munich Airport',country:'Germany',flag:'🇩🇪'},
    {code:'BER',city:'Berlin',name:'Brandenburg Airport',country:'Germany',flag:'🇩🇪'},
    {code:'AMS',city:'Amsterdam',name:'Schiphol Airport',country:'Netherlands',flag:'🇳🇱'},
    {code:'MAD',city:'Madrid',name:'Barajas Airport',country:'Spain',flag:'🇪🇸'},
    {code:'BCN',city:'Barcelona',name:'El Prat Airport',country:'Spain',flag:'🇪🇸'},
    {code:'FCO',city:'Rome',name:'Fiumicino Airport',country:'Italy',flag:'🇮🇹'},
    {code:'MXP',city:'Milan',name:'Malpensa Airport',country:'Italy',flag:'🇮🇹'},
    {code:'ZRH',city:'Zurich',name:'Zurich Airport',country:'Switzerland',flag:'🇨🇭'},
    {code:'GVA',city:'Geneva',name:'Geneva Airport',country:'Switzerland',flag:'🇨🇭'},
    {code:'VIE',city:'Vienna',name:'Vienna International',country:'Austria',flag:'🇦🇹'},
    {code:'BRU',city:'Brussels',name:'Brussels Airport',country:'Belgium',flag:'🇧🇪'},
    {code:'CPH',city:'Copenhagen',name:'Kastrup Airport',country:'Denmark',flag:'🇩🇰'},
    {code:'ARN',city:'Stockholm',name:'Arlanda Airport',country:'Sweden',flag:'🇸🇪'},
    {code:'OSL',city:'Oslo',name:'Gardermoen Airport',country:'Norway',flag:'🇳🇴'},
    {code:'HEL',city:'Helsinki',name:'Helsinki-Vantaa',country:'Finland',flag:'🇫🇮'},
    {code:'LIS',city:'Lisbon',name:'Humberto Delgado Airport',country:'Portugal',flag:'🇵🇹'},
    {code:'ATH',city:'Athens',name:'Eleftherios Venizelos Intl',country:'Greece',flag:'🇬🇷'},
    {code:'IST',city:'Istanbul',name:'Istanbul Airport',country:'Turkey',flag:'🇹🇷'},
    {code:'WAW',city:'Warsaw',name:'Chopin Airport',country:'Poland',flag:'🇵🇱'},
    {code:'PRG',city:'Prague',name:'Vaclav Havel Airport',country:'Czech Republic',flag:'🇨🇿'},
    {code:'BUD',city:'Budapest',name:'Budapest Liszt Ferenc Intl',country:'Hungary',flag:'🇭🇺'},
    {code:'DUB',city:'Dublin',name:'Dublin Airport',country:'Ireland',flag:'🇮🇪'},
    {code:'SVO',city:'Moscow',name:'Sheremetyevo Intl',country:'Russia',flag:'🇷🇺'},
    {code:'DXB',city:'Dubai',name:'Dubai International',country:'UAE',flag:'🇦🇪'},
    {code:'AUH',city:'Abu Dhabi',name:'Abu Dhabi International',country:'UAE',flag:'🇦🇪'},
    {code:'DOH',city:'Doha',name:'Hamad International',country:'Qatar',flag:'🇶🇦'},
    {code:'RUH',city:'Riyadh',name:'King Khalid International',country:'Saudi Arabia',flag:'🇸🇦'},
    {code:'JED',city:'Jeddah',name:'King Abdulaziz International',country:'Saudi Arabia',flag:'🇸🇦'},
    {code:'KWI',city:'Kuwait City',name:'Kuwait International',country:'Kuwait',flag:'🇰🇼'},
    {code:'MCT',city:'Muscat',name:'Muscat International',country:'Oman',flag:'🇴🇲'},
    {code:'TLV',city:'Tel Aviv',name:'Ben Gurion International',country:'Israel',flag:'🇮🇱'},
    {code:'AMM',city:'Amman',name:'Queen Alia International',country:'Jordan',flag:'🇯🇴'},
    {code:'CAI',city:'Cairo',name:'Cairo International',country:'Egypt',flag:'🇪🇬'},
    {code:'LOS',city:'Lagos',name:'Murtala Mohammed Intl',country:'Nigeria',flag:'🇳🇬'},
    {code:'ABV',city:'Abuja',name:'Nnamdi Azikiwe Intl',country:'Nigeria',flag:'🇳🇬'},
    {code:'ACC',city:'Accra',name:'Kotoka International',country:'Ghana',flag:'🇬🇭'},
    {code:'JNB',city:'Johannesburg',name:'O.R. Tambo International',country:'South Africa',flag:'🇿🇦'},
    {code:'CPT',city:'Cape Town',name:'Cape Town International',country:'South Africa',flag:'🇿🇦'},
    {code:'NBO',city:'Nairobi',name:'Jomo Kenyatta International',country:'Kenya',flag:'🇰🇪'},
    {code:'ADD',city:'Addis Ababa',name:'Bole International',country:'Ethiopia',flag:'🇪🇹'},
    {code:'CMN',city:'Casablanca',name:'Mohammed V International',country:'Morocco',flag:'🇲🇦'},
    {code:'TUN',city:'Tunis',name:'Carthage International',country:'Tunisia',flag:'🇹🇳'},
    {code:'DAR',city:'Dar es Salaam',name:'Julius Nyerere Intl',country:'Tanzania',flag:'🇹🇿'},
    {code:'DKR',city:'Dakar',name:'Blaise Diagne International',country:'Senegal',flag:'🇸🇳'},
    {code:'NRT',city:'Tokyo',name:'Narita International',country:'Japan',flag:'🇯🇵'},
    {code:'HND',city:'Tokyo',name:'Haneda Airport',country:'Japan',flag:'🇯🇵'},
    {code:'KIX',city:'Osaka',name:'Kansai International',country:'Japan',flag:'🇯🇵'},
    {code:'ICN',city:'Seoul',name:'Incheon International',country:'South Korea',flag:'🇰🇷'},
    {code:'PVG',city:'Shanghai',name:'Pudong International',country:'China',flag:'🇨🇳'},
    {code:'PEK',city:'Beijing',name:'Capital International',country:'China',flag:'🇨🇳'},
    {code:'HKG',city:'Hong Kong',name:'Hong Kong International',country:'Hong Kong',flag:'🇭🇰'},
    {code:'TPE',city:'Taipei',name:'Taoyuan International',country:'Taiwan',flag:'🇹🇼'},
    {code:'SIN',city:'Singapore',name:'Changi Airport',country:'Singapore',flag:'🇸🇬'},
    {code:'BKK',city:'Bangkok',name:'Suvarnabhumi Airport',country:'Thailand',flag:'🇹🇭'},
    {code:'KUL',city:'Kuala Lumpur',name:'KLIA',country:'Malaysia',flag:'🇲🇾'},
    {code:'CGK',city:'Jakarta',name:'Soekarno-Hatta Intl',country:'Indonesia',flag:'🇮🇩'},
    {code:'MNL',city:'Manila',name:'Ninoy Aquino Intl',country:'Philippines',flag:'🇵🇭'},
    {code:'SGN',city:'Ho Chi Minh City',name:'Tan Son Nhat Intl',country:'Vietnam',flag:'🇻🇳'},
    {code:'HAN',city:'Hanoi',name:'Noi Bai International',country:'Vietnam',flag:'🇻🇳'},
    {code:'DEL',city:'Delhi',name:'Indira Gandhi International',country:'India',flag:'🇮🇳'},
    {code:'BOM',city:'Mumbai',name:'Chhatrapati Shivaji Maharaj',country:'India',flag:'🇮🇳'},
    {code:'BLR',city:'Bangalore',name:'Kempegowda International',country:'India',flag:'🇮🇳'},
    {code:'MAA',city:'Chennai',name:'Chennai International',country:'India',flag:'🇮🇳'},
    {code:'HYD',city:'Hyderabad',name:'Rajiv Gandhi International',country:'India',flag:'🇮🇳'},
    {code:'CCU',city:'Kolkata',name:'Netaji Subhas Chandra Bose',country:'India',flag:'🇮🇳'},
    {code:'CMB',city:'Colombo',name:'Bandaranaike International',country:'Sri Lanka',flag:'🇱🇰'},
    {code:'DAC',city:'Dhaka',name:'Hazrat Shahjalal Intl',country:'Bangladesh',flag:'🇧🇩'},
    {code:'KHI',city:'Karachi',name:'Jinnah International',country:'Pakistan',flag:'🇵🇰'},
    {code:'LHE',city:'Lahore',name:'Allama Iqbal International',country:'Pakistan',flag:'🇵🇰'},
    {code:'KTM',city:'Kathmandu',name:'Tribhuvan International',country:'Nepal',flag:'🇳🇵'},
    {code:'SYD',city:'Sydney',name:'Kingsford Smith',country:'Australia',flag:'🇦🇺'},
    {code:'MEL',city:'Melbourne',name:'Melbourne Airport',country:'Australia',flag:'🇦🇺'},
    {code:'BNE',city:'Brisbane',name:'Brisbane Airport',country:'Australia',flag:'🇦🇺'},
    {code:'PER',city:'Perth',name:'Perth Airport',country:'Australia',flag:'🇦🇺'},
    {code:'AKL',city:'Auckland',name:'Auckland Airport',country:'New Zealand',flag:'🇳🇿'},
    {code:'NAN',city:'Nadi',name:'Nadi International',country:'Fiji',flag:'🇫🇯'}
  ],
  initAirportInput(inputEl, onSelect) {
    if (!inputEl) return;
    const self = this;
    let dd         = null;   
    let activeIdx  = -1;     
    let currentList = [];    
    function placeDropdown() {
      if (!dd) return;
      var r   = inputEl.getBoundingClientRect();
      var top = r.bottom + 2;
      var ddH = Math.min(320, currentList.length * 56 + 38);
      if (top + ddH > window.innerHeight - 10) {
        top = r.top - ddH - 2;
      }
      dd.style.top   = top + 'px';
      dd.style.left  = r.left + 'px';
      dd.style.width = r.width + 'px';
    }
    function hl(text, q) {
      if (!q || !text) return escHtml(text || '');
      var tl = text.toLowerCase();
      var ql = q.toLowerCase();
      var i  = tl.indexOf(ql);
      if (i === -1) return escHtml(text);
      return escHtml(text.slice(0, i)) +
        '<mark style="background:rgba(0,212,255,0.22);color:#00d4ff;border-radius:3px;padding:0 2px;font-weight:700">' +
        escHtml(text.slice(i, i + q.length)) +
        '</mark>' +
        escHtml(text.slice(i + q.length));
    }
    function escHtml(s) {
      return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function setActive(idx) {
      if (!dd) return;
      var rows = dd.querySelectorAll('.fw-ac-row');
      rows.forEach(function(row, i) {
        if (i === idx) {
          row.style.background   = 'rgba(0,212,255,0.11)';
          row.style.borderLeft   = '3px solid #00d4ff';
          row.scrollIntoView({ block: 'nearest' });
        } else {
          row.style.background   = '';
          row.style.borderLeft   = '3px solid transparent';
        }
      });
      activeIdx = idx;
    }
    function close() {
      if (dd) {
        dd.remove();
        dd = null;
      }
      window.removeEventListener('scroll', placeDropdown, true);
      window.removeEventListener('resize', placeDropdown);
      activeIdx    = -1;
      currentList  = [];
    }
    function open(list, q) {
      close();
      if (!list || list.length === 0) return;
      currentList = list;
      dd = document.createElement('div');
      dd.setAttribute('role', 'listbox');
      dd.setAttribute('aria-label', 'Airport suggestions');
      dd.style.cssText = [
        'position:fixed',               
        'z-index:2147483647',           
        'background:#080f1e',
        'border:1px solid rgba(0,212,255,0.30)',
        'border-top:2px solid #00d4ff',
        'border-radius:0 0 14px 14px',
        'overflow:hidden',
        'overflow-y:auto',
        'max-height:320px',
        'box-shadow:0 20px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,212,255,0.08)',
        'font-family:inherit',
        'scrollbar-width:thin',
        'scrollbar-color:rgba(0,212,255,0.25) transparent',
        'animation:acSlideDown 0.14s ease',
      ].join(';');
      var hdr      = document.createElement('div');
      hdr.style.cssText = [
        'padding:7px 14px',
        'font-size:10px',
        'font-weight:700',
        'letter-spacing:1.5px',
        'color:rgba(0,212,255,0.45)',
        'text-transform:uppercase',
        'background:rgba(0,212,255,0.05)',
        'border-bottom:1px solid rgba(255,255,255,0.05)',
        'user-select:none',
      ].join(';');
      hdr.textContent = list.length + ' Airport' + (list.length !== 1 ? 's' : '') +
                        (q ? '  ·  Searching "' + q + '"' : '  ·  Popular airports');
      dd.appendChild(hdr);
      list.forEach(function(a, i) {
        var row = document.createElement('div');
        row.className = 'fw-ac-row';
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', 'false');
        row.style.cssText = [
          'display:flex',
          'align-items:stretch',
          'cursor:pointer',
          'border-bottom:1px solid rgba(255,255,255,0.04)',
          'border-left:3px solid transparent',
          'transition:background 0.1s, border-color 0.1s',
          'min-height:54px',
          'overflow:hidden',
        ].join(';');
        var hue    = ((a.code.charCodeAt(0) || 65) * 137 + (a.code.charCodeAt(1) || 65) * 43) % 360;
        var stripe = document.createElement('div');
        stripe.style.cssText = 'width:3px;flex-shrink:0;align-self:stretch;background:hsl(' +
                                hue + ',65%,55%);opacity:0.45;';
        row.appendChild(stripe);
        var badge = document.createElement('div');
        badge.style.cssText = [
          'display:flex',
          'flex-direction:column',
          'align-items:center',
          'justify-content:center',
          'width:62px',
          'flex-shrink:0',
          'padding:8px 6px',
          'gap:3px',
          'border-right:1px solid rgba(255,255,255,0.06)',
        ].join(';');
        badge.innerHTML =
          '<span style="font-size:20px;line-height:1">'                                           + (a.flag || '🌍') + '</span>' +
          '<span style="font-family:monospace;font-weight:800;font-size:11px;color:#00d4ff;letter-spacing:0.5px">' + a.code + '</span>';
        row.appendChild(badge);
        var text = document.createElement('div');
        text.style.cssText = 'flex:1;min-width:0;padding:9px 11px;overflow:hidden';
        text.innerHTML =
          '<div style="font-weight:700;font-size:14px;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'      + hl(a.city,    q) + '</div>' +
          '<div style="font-size:11px;color:rgba(148,163,184,0.8);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + hl(a.name,    q) + '</div>' +
          '<div style="font-size:10px;color:rgba(100,130,155,0.65);margin-top:1px">'                                                  + hl(a.country, q) + '</div>';
        row.appendChild(text);
        row.addEventListener('mouseenter', function() { setActive(i); });
        row.addEventListener('mouseleave', function() {
          row.style.background = '';
          row.style.borderLeft = '3px solid transparent';
          if (activeIdx === i) activeIdx = -1;
        });
        function doSelect(e) {
          e.preventDefault();
          e.stopPropagation();
          pick(a);
        }
        row.addEventListener('mousedown', doSelect);
        row.addEventListener('touchend',  doSelect, { passive: false });
        dd.appendChild(row);
      });
      document.body.appendChild(dd);
      placeDropdown();
      window.addEventListener('scroll', placeDropdown, { passive: true, capture: true });
      window.addEventListener('resize', placeDropdown, { passive: true });
    }
    function pick(a) {
      inputEl.value = a.city + ' (' + a.code + ')';
      inputEl.dataset.code = a.code;
      inputEl.setAttribute('data-code', a.code);
      close();
      onSelect && onSelect(a);
    }
    function search(raw) {
      var q = (raw || '').trim();
      if (!q) {
        return self.airports.slice(0, 10);
      }
      var ql = q.toLowerCase();
      var scored = self.airports.map(function(a) {
        var code    = a.code.toLowerCase();
        var city    = a.city.toLowerCase();
        var name    = a.name.toLowerCase();
        var country = a.country.toLowerCase();
        var score   = 0;
        if (code === ql)                   score += 1000;
        if (city === ql)                   score +=  900;
        if (code.startsWith(ql))           score +=  800;
        if (city.startsWith(ql))           score +=  700;
        if (name.startsWith(ql))           score +=  500;
        if (code.includes(ql))             score +=  400;
        if (city.includes(ql))             score +=  350;
        if (name.includes(ql))             score +=  200;
        if (country.startsWith(ql))        score +=  150;
        if (country.includes(ql))          score +=  100;
        return { a: a, s: score };
      })
      .filter(function(x) { return x.s > 0; })
      .sort(function(x, y) { return y.s - x.s; })
      .slice(0, 10)
      .map(function(x) { return x.a; });
      return scored;
    }
    inputEl.addEventListener('focus', function() {
      var q    = inputEl.value.trim();
      var list = search(q);
      open(list, q);
    });
    inputEl.addEventListener('input', function() {
      delete inputEl.dataset.code;
      inputEl.removeAttribute('data-code');
      var q    = inputEl.value.trim();
      var list = search(q);
      open(list, q);
    });
    inputEl.addEventListener('keydown', function(e) {
      if (!dd) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          var q = inputEl.value.trim();
          open(search(q), q);
          setActive(0);
        }
        return;
      }
      var total = currentList.length;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActive(activeIdx < total - 1 ? activeIdx + 1 : 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActive(activeIdx > 0 ? activeIdx - 1 : total - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIdx >= 0 && activeIdx < currentList.length) {
            pick(currentList[activeIdx]);
          }
          break;
        case 'Tab':
          if (activeIdx >= 0 && activeIdx < currentList.length) {
            e.preventDefault();
            pick(currentList[activeIdx]);
          } else {
            close();
          }
          break;
        case 'Escape':
          e.preventDefault();
          close();
          inputEl.blur();
          break;
      }
    });
    inputEl.addEventListener('blur', function() {
      setTimeout(close, 220);
    });
  },
  generateSeats(travelClass) {
    const cfgs = {
      first:    { rows:4,  cols:['A','C','D','F'] },
      business: { rows:8,  cols:['A','B','E','F'] },
      economy:  { rows:26, cols:['A','B','C','D','E','F'] }
    };
    const cfg = cfgs[travelClass] || cfgs.economy;
    const seats = [];
    for (let r = 1; r <= cfg.rows; r++) {
      cfg.cols.forEach(function(c) {
        const isExit = (r===10||r===11) && travelClass==='economy';
        const isWin  = c===cfg.cols[0] || c===cfg.cols[cfg.cols.length-1];
        seats.push({
          id: r+c, row:r, col:c,
          type: isExit?'extra': travelClass==='first'?'first-class': isWin?'window':'available',
          occupied: Math.random()<0.38,
          price: isExit?50: (isWin&&travelClass!=='first')?10:0
        });
      });
    }
    return seats;
  },
  renderSeatMap(container, seats, selected, passengerCount, onToggle) {
    if (!container) return;
    const groups = {
      first:    [['A','C'],['D','F']],
      business: [['A','B'],['E','F']],
      economy:  [['A','B','C'],['D','E','F']]
    };
    const cls = seats[0] && seats[0].type==='first-class' ? 'first' :
                seats.some(function(s){ return s.type==='extra'; }) ? 'economy' : 'business';
    const g = groups[cls] || groups.economy;
    const rows = [];
    seats.forEach(function(s){ if(rows.indexOf(s.row)===-1) rows.push(s.row); });
    let html = '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px;font-size:12px;align-items:center">' +
      '<div style="display:flex;gap:5px;align-items:center"><div style="width:16px;height:16px;border-radius:4px;background:rgba(0,227,150,0.3)"></div>Available</div>' +
      '<div style="display:flex;gap:5px;align-items:center"><div style="width:16px;height:16px;border-radius:4px;background:rgba(124,58,237,0.3)"></div>Window +$10</div>' +
      '<div style="display:flex;gap:5px;align-items:center"><div style="width:16px;height:16px;border-radius:4px;background:rgba(245,200,66,0.3)"></div>Extra Leg +$50</div>' +
      '<div style="display:flex;gap:5px;align-items:center"><div style="width:16px;height:16px;border-radius:4px;background:rgba(148,163,184,0.1)"></div>Taken</div>' +
      '<div style="display:flex;gap:5px;align-items:center"><div style="width:16px;height:16px;border-radius:4px;background:var(--cyan)"></div>Selected</div>' +
      '</div><div style="overflow-x:auto">';
    rows.forEach(function(r) {
      const rs = seats.filter(function(s){ return s.row===r; });
      html += '<div class="seat-row"><span class="seat-row-label">' + r + '</span>';
      g[0].forEach(function(c) {
        const s = rs.find(function(x){ return x.col===c; });
        if (!s) return;
        const isSel = selected.some(function(x){ return x && x.id===s.id; });
        const sc = isSel?'selected': s.occupied?'occupied': s.type;
        html += '<div class="seat '+sc+'" data-id="'+s.id+'" title="'+s.id+(s.price?' +$'+s.price:'')+'">'+s.col+'</div>';
      });
      html += '<div class="seat-gap"></div>';
      g[1].forEach(function(c) {
        const s = rs.find(function(x){ return x.col===c; });
        if (!s) return;
        const isSel = selected.some(function(x){ return x && x.id===s.id; });
        const sc = isSel?'selected': s.occupied?'occupied': s.type;
        html += '<div class="seat '+sc+'" data-id="'+s.id+'" title="'+s.id+(s.price?' +$'+s.price:'')+'">'+s.col+'</div>';
      });
      html += '</div>';
    });
    html += '</div><div style="margin-top:10px;font-size:12px;color:var(--muted)">' +
      selected.filter(Boolean).length + '/' + passengerCount + ' seats selected</div>';
    container.innerHTML = html;
    container.querySelectorAll('.seat:not(.occupied)').forEach(function(el) {
      el.addEventListener('click', function() {
        const s = seats.find(function(x){ return x.id===el.dataset.id; });
        if (s) onToggle(s);
      });
    });
  },
  classMultiplier: { economy:1, business:2.2, first:4 },
  classLabel:      { economy:'Economy', business:'Business Class', first:'First Class' },
  calcPrice(basePrice, travelClass, passengers) {
    const mult = this.classMultiplier[travelClass] || 1;
    let subtotal = 0;
    const breakdown = passengers.map(function(p) {
      let price = basePrice * mult;
      let label = 'Adult';
      const age = parseInt(p.age) || 30;
      if      (age < 2)  { price *= 0.10; label = 'Infant';  }
      else if (age < 12) { price *= 0.75; label = 'Child';   }
      else if (age >= 60){ price *= 0.85; label = 'Senior';  }
      subtotal += price;
      return Object.assign({}, p, { price:price, label:label });
    });
    return { subtotal:subtotal, breakdown:breakdown };
  },
  fmt(n)         { return parseFloat(n||0).toFixed(2); },
  fmtInt(n)      { return Math.floor(n||0).toLocaleString(); },
  today()        { return new Date().toISOString().split('T')[0]; },
  fmtDate(d)     { return d ? new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : '-'; },
  fmtDateTime(d) { return d ? new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '-'; },
  statusBadge(s) {
    const m = { confirmed:'badge-green', pending:'badge-gold', cancelled:'badge-red',
                paid:'badge-green', refunded:'badge-purple', proof_submitted:'badge-cyan' };
    return '<span class="badge ' + (m[s]||'badge-muted') + '">' + (s||'-') + '</span>';
  },
  showModal(id) { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); },
  hideModal(id) { const el=document.getElementById(id); if(el) el.classList.add('hidden'); },
  async validatePromo(code, amount, passengerCount, tripType) {
    try { return await this.api('POST','/api/promo/validate',{code:code,amount:amount,passengerCount:passengerCount,tripType:tripType}); }
    catch(e) { return {valid:false,message:'Invalid promo code'}; }
  },
  setupUploadZone(zone, previewEl, onFile) {
    if (!zone) return;
    const input = zone.querySelector('input[type="file"]');
    zone.addEventListener('dragover', function(e){ e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', function(){ zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', function(e) {
      e.preventDefault(); zone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) { if(input){const dt=new DataTransfer();dt.items.add(f);input.files=dt.files;} showPrev(f); onFile&&onFile(f); }
    });
    if (input) input.addEventListener('change', function(){ const f=input.files[0]; if(f){showPrev(f);onFile&&onFile(f);} });
    function showPrev(f) {
      if (!previewEl) return;
      if (f.type.startsWith('image/')) {
        const r = new FileReader();
        r.onload = function(e){ previewEl.innerHTML='<img src="'+e.target.result+'" style="max-height:160px;border-radius:8px;margin:0 auto;display:block">'; };
        r.readAsDataURL(f);
      } else {
        previewEl.innerHTML = '<div style="padding:10px;background:var(--navy3);border-radius:8px;font-size:13px">📄 '+f.name+' ('+Math.round(f.size/1024)+'KB)</div>';
      }
    }
  },
  chatOpen: false,
  chatMessages: [],
  setupChat() {
    const fab     = document.getElementById('chatFab');
    const chatWin = document.getElementById('chatWindow');
    const closeBtn= document.getElementById('chatClose');
    const sendBtn = document.getElementById('chatSend');
    const input   = document.getElementById('chatInput');
    if (!fab) return;
    const self = this;
    this.chatMessages = [{ type:'bot', text:'Hey! 👋 I\'m **Zephyr**, your FlyWay AI assistant. I can help with bookings, payments, tracking, baggage, promos, and more! What do you need?' }];
    fab.addEventListener('click', function() {
      self.chatOpen = !self.chatOpen;
      if (chatWin) chatWin.style.display = self.chatOpen ? 'flex' : 'none';
      if (self.chatOpen) { self.renderChat(); if(input) input.focus(); const dot=fab.querySelector('.badge-dot'); if(dot) dot.remove(); }
    });
    if (closeBtn) closeBtn.addEventListener('click', function(){ self.chatOpen=false; if(chatWin) chatWin.style.display='none'; });
    async function send() {
      const msg = input ? input.value.trim() : '';
      if (!msg) return;
      if (input) input.value = '';
      self.chatMessages.push({type:'user',text:msg});
      self.chatMessages.push({type:'bot',text:'● ● ●',typing:true});
      self.renderChat();
      await new Promise(function(r){ setTimeout(r, 500+Math.random()*500); });
      self.chatMessages = self.chatMessages.filter(function(m){ return !m.typing; });
      const reply = self.zephyrReply(msg);
      self.chatMessages.push({type:'bot',text:reply.text,escalate:reply.escalate});
      self.renderChat();
      try { await self.api('POST','/api/messages',{name:self.user?self.user.username:'Guest',email:self.user?self.user.email:'',subject:'AI Chat',message:msg,userId:self.user?self.user.id:null}); } catch(e) {}
    }
    if (sendBtn) sendBtn.addEventListener('click', send);
    if (input) input.addEventListener('keydown', function(e){ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} });
  },
  renderChat() {
    const el = document.getElementById('chatMessages');
    if (!el) return;
    el.innerHTML = this.chatMessages.map(function(m) {
      const txt = m.typing ? m.text : m.text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
      const esc = m.escalate ? '<a class="escalate" onclick="window.location.href=\'/contact\'">Talk to a human agent →</a>' : '';
      return '<div class="chat-bubble ' + m.type + '">' + txt + esc + '</div>';
    }).join('');
    el.scrollTop = el.scrollHeight;
  },
  zephyrReply(msg) {
    const m = msg.toLowerCase().trim();
    let text = '', escalate = false;
    if (/^(hi|hello|hey|good morning|good evening|howdy|sup|yo)/.test(m))
      text = 'Hello! 👋 I\'m **Zephyr**, FlyWay\'s AI travel assistant. I\'m here 24/7 to help with bookings, tracking, payments, baggage, and more. What can I help you with?';
    else if (/who are you|your name|what are you/.test(m))
      text = 'I\'m **Zephyr** - FlyWay\'s AI assistant! I help with:\n\n✈ **Booking flights**\n📡 **Flight tracking**\n💳 **Payments** (gift cards, crypto)\n🧳 **Baggage** allowances\n🎟 **Promo codes**\n⭐ **Loyalty points**\n\nJust ask!';
    else if (/book|flight|ticket|reserve|fly/.test(m))
      text = 'To book a flight:\n\n1️⃣ Go to **Book a Flight** in the menu\n2️⃣ Type a city or airport code in the FROM box - **pick from the dropdown**\n3️⃣ Do the same for TO\n4️⃣ Pick date, passengers, class\n5️⃣ Click **Search** - flights are available for every route!\n\nNeed help with a step?';
    else if (/no flight|not found|can\'t find|no drop/.test(m))
      text = 'Make sure to:\n• **Type** in the airport box, then **click the suggestion** from the dropdown\n• Then click the blue **Search** button\n\nFlights exist for every route. Popular ones: JFK→LAX, JFK→LHR, DXB→JFK, SIN→LHR';
    else if (/pay|payment|card|crypto|bitcoin|gift card|giftcard/.test(m))
      text = 'FlyWay accepts:\n\n🎁 **Gift Cards** - Amazon, iTunes, Google Play, Steam, Walmart, Visa & more\n₿ **Crypto** - BTC, ETH, USDT (copy wallet address, upload screenshot)\n💳 **Card** - fills form → shows network fail → redirects to gift card/crypto\n\nBank transfer and mobile wallets are under maintenance.';
    else if (/track|where is|flight status|live/.test(m))
      text = 'Use **Track Flight** in the navigation:\n\n• Enter your flight number: **, FW-100, FW-101** etc.\n• Or paste your **booking reference** from My Bookings\n• See live: status, progress, gate, terminal, weather, altitude\n• Share the tracking link with family! 🔗';
    else if (/promo|discount|code|voucher|coupon/.test(m))
      { text = 'Promo codes are given to loyalty members and through campaigns. 🎟\n\n• Contact support via WhatsApp or Email to request one\n• Enter it at **Step 5 (Extras)** during booking\n• Discounts range from 10% to 100% off'; escalate = true; }
    else if (/cancel|refund/.test(m))
      { text = 'To cancel:\n1. Go to **My Bookings**\n2. Click **Cancel** on your booFW-101king\n3. Refund processed in 5–7 business days\n\nYou\'ll get a notification at each step.'; escalate = true; }
    else if (/bag|luggage|cargo|weight|carry.?on/.test(m))
      text = 'Baggage included free:\n\n✈ **Economy** - 1 carry-on + 1 checked\n💺 **Business** - 1 carry-on + 2 checked\n👑 **First Class** - 1 carry-on + 3 checked\n\nExtra bags: **$50 each** (selected at Step 5)';
    else if (/seat|window|aisle|legroom/.test(m))
      text = 'Choose seats at **Step 4** of booking:\n\n• **Window** - +$10\n• **Extra Legroom** (exit rows) - +$50\n• **Standard** - free\n• **Skip** - auto-assign at check-in\n\nFirst Class has private suites!';
    else if (/license|key|register|sign up/.test(m))
      { text = 'To create an account you need a **license key**.\n\nAvailable on the register page - click any key type to auto-fill:\n🧑 Solo · 🌴 Holiday · 🏔 Adventure · 📚 Student · 👴 Senior · 💑 Couple · 👨‍👩‍👧‍👦 Family · 👥 Group · 💍 Honeymoon · 💼 Business'; escalate = true; }
    else if (/loyalty|points|reward|tier/.test(m))
      text = 'Loyalty tiers:\n🥉 **Bronze** - 0 pts\n🥈 **Silver** - 2,000 pts\n🥇 **Gold** - 5,000 pts\n💎 **Platinum** - 10,000 pts\n\nEarn 50–200 points per confirmed booking!';
    else if (/admin|panel|backdoor|lexy/.test(m))
      text = 'Sorry, there is **NO ACTIVE ADMIN BOARD** accessible to users. If you need admin support, please contact our team directly.';
    else if (/contact|support|human|agent|help|whatsapp|email/.test(m))
      { text = 'Reach our support team:\n\n📧 **Email** - platinumtrack.noreply@gmail.com\n💬 **WhatsApp** - +1 (555) 000-0000\n📞 **Phone** - +1 (555) 000-0000\n\nOr use the **Contact** page to send a message - it shows in the admin panel instantly.'; escalate = true; }
    else if (/weather|temperature|rain/.test(m))
      text = 'Check departure and arrival weather on the **Track Flight** page for any live flight! 🌤\n\nFor destination forecasts, use weather.com or your phone\'s weather app.';
    else if (/family|group|children|kids|infant|baby|senior/.test(m))
      text = 'Group bookings up to **8 passengers** at once!\n\nAuto discounts:\n👶 **Infant** (under 2) - 90% off\n🧒 **Child** (under 12) - 25% off\n👴 **Senior** (60+) - 15% off';
    else if (/price|cost|how much|fare/.test(m))
      text = 'Prices by class:\n✈ **Economy** - base price\n💺 **Business** - 2.2× economy\n👑 **First Class** - 4× economy\n\nPlus: airport tax ($25/pax), service fee ($12.50), VAT (7.5%). Search your route to see exact pricing!';
    else if (/flight type|non.?stop|direct flight|connecting|layover|stopover/.test(m))
      text = 'Here\'s the **Flight Type Guide**:\n\n✈ **Non-stop Flight**\nThe fastest option, with no stops. The plane takes off, lands once, and arrives at the destination.\n\n🛫 **Direct Flight**\nA single flight number that may stop for passengers or refuel, but you usually stay on the same plane. Adds 30-60 minutes to flight time.\n\n🔄 **Connecting Flight**\nAt least two separate planes and flight numbers. You change planes during a layover. Adds 2-4 hours for connections.\n\n**Fastest:** Non-stop\n**Convenience:** Non-stop > Direct > Connecting\n**Cheaper:** Connecting flights are usually the cheapest, while non-stop are the most expensive.\n\nTrack Direct/Connecting flights to see live stop reports! I can also help with average delay times for airlines, minimum layover times, or tips for missed connections.';
    else
      { text = 'Great question! Here\'s what I can help with:\n\n• ✈ How to book a flight\n• 📡 Tracking your flight live\n• 💳 Payment methods\n• 🧳 Baggage allowances\n• 🎟 Getting promo codes\n• 🔔 Notifications and bookings\n\nOr contact our support team for personal help.'; escalate = true; }
    return { text:text, escalate:escalate };
  }
};
document.addEventListener('DOMContentLoaded', function(){ FlyWay.init(); FlyWay.initSocket(); });




FlyWay._socket = null;
FlyWay.initSocket = function() {
  if (this._socket || typeof io === 'undefined') return;
  try {
    this._socket = io();
    if (this.user && this.user.id) this._socket.emit('join_user', this.user.id);
    this._socket.on('connect', function() {
      if (FlyWay.user && FlyWay.user.id) FlyWay._socket.emit('join_user', FlyWay.user.id);
    });
    var uid = this.user ? this.user.id : null;
    if (uid) {
      this._socket.on('notification_' + uid, function(note) {
        FlyWay._incrementNotifBadge();
        FlyWay.toast('info', note.title || 'Notification', note.message || '');
      });
      this._socket.on('booking_updated_' + uid, function() {
        if (typeof loadBookings === 'function') loadBookings();
      });
    }
  } catch(e) {  }
};
FlyWay._incrementNotifBadge = function() {
  var badge = document.getElementById('notifBadge');
  if (badge) {
    var cur = parseInt(badge.textContent) || 0;
    badge.textContent = cur + 1;
    badge.classList.remove('hidden');
  }
};
