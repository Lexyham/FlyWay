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
    const baseUrl = (typeof this.API === 'string' && this.API) ? this.API : window.location.origin;
    const url = new URL(endpoint, baseUrl).toString();
    const opts = { method: method, headers: this.getHeaders(multipart), credentials: 'same-origin' };
    if (data) { opts.body = multipart ? data : JSON.stringify(data); }
    try {
      const res = await fetch(url, opts);
      const json = await res.json().catch(function(){ return {}; });
      if (!res.ok) throw new Error(json.error || json.message || 'Request failed (' + res.status + ')');
      return json;
    } catch (err) {
      // Retry a direct origin-based URL if the first attempt fails due to a malformed base URL.
      if (!url.startsWith(window.location.origin) && endpoint.startsWith('/')) {
        const fallbackUrl = window.location.origin + endpoint;
        const res = await fetch(fallbackUrl, opts);
        const json = await res.json().catch(function(){ return {}; });
        if (!res.ok) throw new Error(json.error || json.message || 'Request failed (' + res.status + ')');
        return json;
      }
      throw err;
    }
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

    
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', function() {
        mobileMenu.classList.toggle('active');
        hamburger.classList.toggle('active');
      });

      
      document.addEventListener('click', function(e) {
        if (!nav.contains(e.target) && !mobileMenu.contains(e.target)) {
          mobileMenu.classList.remove('active');
          hamburger.classList.remove('active');
        }
      });

      mobileMenu.querySelectorAll('.nav-link').forEach(function(link) {
        link.addEventListener('click', function() {
          mobileMenu.classList.remove('active');
          hamburger.classList.remove('active');
        });
      });
    }
  },
  updateNavAuth() {
    const loggedIn = this.isLoggedIn();
    const loginBtn  = document.getElementById('navLoginBtn');
    const dashBtn   = document.getElementById('navDashBtn');
    const logoutBtn = document.getElementById('navLogoutBtn');
    const getStart  = document.getElementById('navGetStarted');
    const myAcct    = document.getElementById('navMyAccount');
    const chip      = document.getElementById('navUserChip');
    /* Mark body so CSS can hide sign-in links in the mobile menu */
    document.body.classList.toggle('fw-logged-in', loggedIn);
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
    {code:'NAN',city:'Nadi',name:'Nadi International',country:'Fiji',flag:'🇫🇯'},
    {code:'CMH',city:'Columbus',name:'John Glenn Columbus International',country:'USA',flag:'🇺🇸'},
    {code:'LCK',city:'Columbus',name:'Rickenbacker International',country:'USA',flag:'🇺🇸'},
    {code:'CSG',city:'Columbus, Georgia',name:'Columbus Airport',country:'USA',flag:'🇺🇸'},
    {code:'IAD',city:'Washington',name:'Washington Dulles International',country:'USA',flag:'🇺🇸'},
    {code:'DCA',city:'Washington',name:'Ronald Reagan Washington National',country:'USA',flag:'🇺🇸'},
    {code:'LGA',city:'New York',name:'LaGuardia Airport',country:'USA',flag:'🇺🇸'},
    {code:'BWI',city:'Baltimore',name:'Baltimore/Washington International',country:'USA',flag:'🇺🇸'},
    {code:'HNL',city:'Honolulu',name:'Daniel K. Inouye International',country:'USA',flag:'🇺🇸'},
    {code:'ANC',city:'Anchorage',name:'Ted Stevens Anchorage International',country:'USA',flag:'🇺🇸'},
    {code:'SJC',city:'San Jose',name:'San Jose Mineta International',country:'USA',flag:'🇺🇸'},
    {code:'OAK',city:'Oakland',name:'Oakland International',country:'USA',flag:'🇺🇸'},
    {code:'RDU',city:'Raleigh-Durham',name:'Raleigh-Durham International',country:'USA',flag:'🇺🇸'},
    {code:'PIT',city:'Pittsburgh',name:'Pittsburgh International',country:'USA',flag:'🇺🇸'},
    {code:'IND',city:'Indianapolis',name:'Indianapolis International',country:'USA',flag:'🇺🇸'},
    {code:'CLE',city:'Cleveland',name:'Cleveland Hopkins International',country:'USA',flag:'🇺🇸'},
    {code:'YYC',city:'Calgary',name:'Calgary International',country:'Canada',flag:'🇨🇦'},
    {code:'YOW',city:'Ottawa',name:'Ottawa Macdonald-Cartier International',country:'Canada',flag:'🇨🇦'},
    {code:'YEG',city:'Edmonton',name:'Edmonton International',country:'Canada',flag:'🇨🇦'},
    {code:'YHZ',city:'Halifax',name:'Halifax Stanfield International',country:'Canada',flag:'🇨🇦'},
    {code:'YWG',city:'Winnipeg',name:'Winnipeg James Armstrong Richardson International',country:'Canada',flag:'🇨🇦'},
    {code:'GDL',city:'Guadalajara',name:'Guadalajara International',country:'Mexico',flag:'🇲🇽'},
    {code:'MTY',city:'Monterrey',name:'Monterrey International',country:'Mexico',flag:'🇲🇽'},
    {code:'PTY',city:'Panama City',name:'Tocumen International',country:'Panama',flag:'🇵🇦'},
    {code:'UIO',city:'Quito',name:'Mariscal Sucre International',country:'Ecuador',flag:'🇪🇨'},
    {code:'GYE',city:'Guayaquil',name:'José Joaquín de Olmedo International',country:'Ecuador',flag:'🇪🇨'},
    {code:'CCS',city:'Caracas',name:'Simón Bolívar International',country:'Venezuela',flag:'🇻🇪'},
    {code:'MVD',city:'Montevideo',name:'Carrasco International',country:'Uruguay',flag:'🇺🇾'},
    {code:'VVI',city:'Santa Cruz',name:'Viru Viru International',country:'Bolivia',flag:'🇧🇴'},
    {code:'ASU',city:'Asunción',name:'Silvio Pettirossi International',country:'Paraguay',flag:'🇵🇾'},
    {code:'COR',city:'Córdoba',name:'Ingeniero Aeronáutico Ambrosio L.V. Taravella International',country:'Argentina',flag:'🇦🇷'},
    {code:'MDE',city:'Medellín',name:'José María Córdova International',country:'Colombia',flag:'🇨🇴'},
    {code:'CLO',city:'Cali',name:'Alfonso Bonilla Aragón International',country:'Colombia',flag:'🇨🇴'},
    {code:'BSB',city:'Brasília',name:'Brasília International',country:'Brazil',flag:'🇧🇷'},
    {code:'CNF',city:'Belo Horizonte',name:'Tancredo Neves International',country:'Brazil',flag:'🇧🇷'},
    {code:'REC',city:'Recife',name:'Recife/Guararapes International',country:'Brazil',flag:'🇧🇷'},
    {code:'SJO',city:'San José',name:'Juan Santamaría International',country:'Costa Rica',flag:'🇨🇷'},
    {code:'GUA',city:'Guatemala City',name:'La Aurora International',country:'Guatemala',flag:'🇬🇹'},
    {code:'HAV',city:'Havana',name:'José Martí International',country:'Cuba',flag:'🇨🇺'},
    {code:'MBJ',city:'Montego Bay',name:'Sangster International',country:'Jamaica',flag:'🇯🇲'},
    {code:'PUJ',city:'Punta Cana',name:'Punta Cana International',country:'Dominican Republic',flag:'🇩🇴'},
    {code:'POS',city:'Port of Spain',name:'Piarco International',country:'Trinidad and Tobago',flag:'🇹🇹'},
    {code:'NAS',city:'Nassau',name:'Lynden Pindling International',country:'Bahamas',flag:'🇧🇸'},
    {code:'SAL',city:'San Salvador',name:'El Salvador International',country:'El Salvador',flag:'🇸🇻'},
    {code:'SAP',city:'San Pedro Sula',name:'Ramón Villeda Morales International',country:'Honduras',flag:'🇭🇳'},
    {code:'MGA',city:'Managua',name:'Augusto C. Sandino International',country:'Nicaragua',flag:'🇳🇮'},
    {code:'GEO',city:'Georgetown',name:'Cheddi Jagan International',country:'Guyana',flag:'🇬🇾'},
    {code:'PBM',city:'Paramaribo',name:'Johan Adolf Pengel International',country:'Suriname',flag:'🇸🇷'},
    {code:'BZE',city:'Belize City',name:'Philip S. W. Goldson International',country:'Belize',flag:'🇧🇿'},
    {code:'ALG',city:'Algiers',name:'Houari Boumediene Airport',country:'Algeria',flag:'🇩🇿'},
    {code:'LAD',city:'Luanda',name:'Quatro de Fevereiro International',country:'Angola',flag:'🇦🇴'},
    {code:'DLA',city:'Douala',name:'Douala International',country:'Cameroon',flag:'🇨🇲'},
    {code:'FIH',city:'Kinshasa',name:'N’djili International',country:'Democratic Republic of the Congo',flag:'🇨🇩'},
    {code:'MRU',city:'Mauritius',name:'Sir Seewoosagur Ramgoolam International',country:'Mauritius',flag:'🇲🇺'},
    {code:'WDH',city:'Windhoek',name:'Hosea Kutako International',country:'Namibia',flag:'🇳🇦'},
    {code:'GBE',city:'Gaborone',name:'Sir Seretse Khama International',country:'Botswana',flag:'🇧🇼'},
    {code:'MPM',city:'Maputo',name:'Maputo International',country:'Mozambique',flag:'🇲🇿'},
    {code:'TNR',city:'Antananarivo',name:'Ivato International',country:'Madagascar',flag:'🇲🇬'},
    {code:'HRE',city:'Harare',name:'Robert Gabriel Mugabe International',country:'Zimbabwe',flag:'🇿🇼'},
    {code:'EBB',city:'Entebbe',name:'Entebbe International',country:'Uganda',flag:'🇺🇬'},
    {code:'KGL',city:'Kigali',name:'Kigali International',country:'Rwanda',flag:'🇷🇼'},
    {code:'LUN',city:'Lusaka',name:'Kenneth Kaunda International',country:'Zambia',flag:'🇿🇲'},
    {code:'ABJ',city:'Abidjan',name:'Félix-Houphouët-Boigny International',country:'Côte d’Ivoire',flag:'🇨🇮'},
    {code:'COO',city:'Cotonou',name:'Cadjehoun Airport',country:'Benin',flag:'🇧🇯'},
    {code:'LFW',city:'Lomé',name:'Lomé–Tokoin International',country:'Togo',flag:'🇹🇬'},
    {code:'BJL',city:'Banjul',name:'Banjul International',country:'The Gambia',flag:'🇬🇲'},
    {code:'SID',city:'Sal Island',name:'Amílcar Cabral International',country:'Cape Verde',flag:'🇨🇻'},
    {code:'SEZ',city:'Mahé',name:'Seychelles International',country:'Seychelles',flag:'🇸🇨'},
    {code:'LLW',city:'Lilongwe',name:'Kamuzu International',country:'Malawi',flag:'🇲🇼'},
    {code:'PZU',city:'Port Sudan',name:'Port Sudan New International',country:'Sudan',flag:'🇸🇩'},
    {code:'FNA',city:'Freetown',name:'Lungi International',country:'Sierra Leone',flag:'🇸🇱'},
    {code:'ROB',city:'Monrovia',name:'Roberts International',country:'Liberia',flag:'🇱🇷'},
    {code:'BZV',city:'Brazzaville',name:'Maya-Maya Airport',country:'Republic of the Congo',flag:'🇨🇬'},
    {code:'JIB',city:'Djibouti',name:'Djibouti–Ambouli International',country:'Djibouti',flag:'🇩🇯'},
    {code:'MGQ',city:'Mogadishu',name:'Aden Adde International',country:'Somalia',flag:'🇸🇴'},
    {code:'BJM',city:'Bujumbura',name:'Melchior Ndadaye International',country:'Burundi',flag:'🇧🇮'},
    {code:'HAH',city:'Moroni',name:'Prince Said Ibrahim International',country:'Comoros',flag:'🇰🇲'},
    {code:'TMS',city:'São Tomé',name:'São Tomé International',country:'São Tomé and Príncipe',flag:'🇸🇹'},
    {code:'FIU',city:'Fiji',name:'Fiji Airport',country:'Fiji',flag:'🇫🇯'},
    {code:'KEF',city:'Keflavík',name:'Keflavík International',country:'Iceland',flag:'🇮🇸'},
    {code:'LUX',city:'Luxembourg City',name:'Luxembourg Airport',country:'Luxembourg',flag:'🇱🇺'},
    {code:'OTP',city:'Bucharest',name:'Henri Coandă International',country:'Romania',flag:'🇷🇴'},
    {code:'SOF',city:'Sofia',name:'Sofia Airport',country:'Bulgaria',flag:'🇧🇬'},
    {code:'ZAG',city:'Zagreb',name:'Franjo Tuđman Airport',country:'Croatia',flag:'🇭🇷'},
    {code:'BEG',city:'Belgrade',name:'Nikola Tesla Airport',country:'Serbia',flag:'🇷🇸'},
    {code:'BTS',city:'Bratislava',name:'M. R. Štefánik Airport',country:'Slovakia',flag:'🇸🇰'},
    {code:'LJU',city:'Ljubljana',name:'Jože Pučnik Airport',country:'Slovenia',flag:'🇸🇮'},
    {code:'LCA',city:'Larnaca',name:'Larnaca International',country:'Cyprus',flag:'🇨🇾'},
    {code:'MLA',city:'Malta',name:'Malta International',country:'Malta',flag:'🇲🇹'},
    {code:'TLL',city:'Tallinn',name:'Lennart Meri Tallinn Airport',country:'Estonia',flag:'🇪🇪'},
    {code:'RIX',city:'Riga',name:'Riga International',country:'Latvia',flag:'🇱🇻'},
    {code:'VNO',city:'Vilnius',name:'Vilnius Airport',country:'Lithuania',flag:'🇱🇹'},
    {code:'TIA',city:'Tirana',name:'Tirana International',country:'Albania',flag:'🇦🇱'},
    {code:'SJJ',city:'Sarajevo',name:'Sarajevo International',country:'Bosnia and Herzegovina',flag:'🇧🇦'},
    {code:'SKP',city:'Skopje',name:'Skopje International',country:'North Macedonia',flag:'🇲🇰'},
    {code:'EVN',city:'Yerevan',name:'Zvartnots International',country:'Armenia',flag:'🇦🇲'},
    {code:'TBS',city:'Tbilisi',name:'Shota Rustaveli Tbilisi International',country:'Georgia',flag:'🇬🇪'},
    {code:'GYD',city:'Baku',name:'Heydar Aliyev International',country:'Azerbaijan',flag:'🇦🇿'},
    {code:'RMO',city:'Chișinău',name:'Chișinău International',country:'Moldova',flag:'🇲🇩'},
    {code:'PRN',city:'Pristina',name:'Pristina International',country:'Kosovo',flag:'🇽🇰'},
    {code:'KIV',city:'Chișinău',name:'Chișinău International (legacy code)',country:'Moldova',flag:'🇲🇩'},
    {code:'CAN',city:'Guangzhou',name:'Guangzhou Baiyun International',country:'China',flag:'🇨🇳'},
    {code:'SZX',city:'Shenzhen',name:'Shenzhen Bao’an International',country:'China',flag:'🇨🇳'},
    {code:'CTU',city:'Chengdu',name:'Chengdu Shuangliu International',country:'China',flag:'🇨🇳'},
    {code:'HGH',city:'Hangzhou',name:'Hangzhou Xiaoshan International',country:'China',flag:'🇨🇳'},
    {code:'XIY',city:'Xi’an',name:'Xi’an Xianyang International',country:'China',flag:'🇨🇳'},
    {code:'FUK',city:'Fukuoka',name:'Fukuoka Airport',country:'Japan',flag:'🇯🇵'},
    {code:'CTS',city:'Sapporo',name:'New Chitose Airport',country:'Japan',flag:'🇯🇵'},
    {code:'PUS',city:'Busan',name:'Gimhae International',country:'South Korea',flag:'🇰🇷'},
    {code:'DPS',city:'Denpasar/Bali',name:'Ngurah Rai International',country:'Indonesia',flag:'🇮🇩'},
    {code:'SUB',city:'Surabaya',name:'Juanda International',country:'Indonesia',flag:'🇮🇩'},
    {code:'PEN',city:'Penang',name:'Penang International',country:'Malaysia',flag:'🇲🇾'},
    {code:'HKT',city:'Phuket',name:'Phuket International',country:'Thailand',flag:'🇹🇭'},
    {code:'KTI',city:'Phnom Penh',name:'Techo International',country:'Cambodia',flag:'🇰🇭'},
    {code:'VTE',city:'Vientiane',name:'Wattay International',country:'Laos',flag:'🇱🇦'},
    {code:'RGN',city:'Yangon',name:'Yangon International',country:'Myanmar',flag:'🇲🇲'},
    {code:'ALA',city:'Almaty',name:'Almaty International',country:'Kazakhstan',flag:'🇰🇿'},
    {code:'TAS',city:'Tashkent',name:'Tashkent International',country:'Uzbekistan',flag:'🇺🇿'},
    {code:'IKA',city:'Tehran',name:'Imam Khomeini International',country:'Iran',flag:'🇮🇷'},
    {code:'BGW',city:'Baghdad',name:'Baghdad International',country:'Iraq',flag:'🇮🇶'},
    {code:'BAH',city:'Bahrain',name:'Bahrain International',country:'Bahrain',flag:'🇧🇭'},
    {code:'BEY',city:'Beirut',name:'Beirut–Rafic Hariri International',country:'Lebanon',flag:'🇱🇧'},
    {code:'MLE',city:'Malé',name:'Velana International',country:'Maldives',flag:'🇲🇻'},
    {code:'UBN',city:'Ulaanbaatar',name:'Chinggis Khaan International',country:'Mongolia',flag:'🇲🇳'},
    {code:'BWN',city:'Bandar Seri Begawan',name:'Brunei International',country:'Brunei',flag:'🇧🇳'},
    {code:'KBL',city:'Kabul',name:'Kabul International',country:'Afghanistan',flag:'🇦🇫'},
    {code:'BSZ',city:'Bishkek',name:'Manas International',country:'Kyrgyzstan',flag:'🇰🇬'},
    {code:'DYU',city:'Dushanbe',name:'Dushanbe International',country:'Tajikistan',flag:'🇹🇯'},
    {code:'ASB',city:'Ashgabat',name:'Ashgabat International',country:'Turkmenistan',flag:'🇹🇲'},
    {code:'PBH',city:'Paro',name:'Paro International',country:'Bhutan',flag:'🇧🇹'},
    {code:'DIL',city:'Dili',name:'Presidente Nicolau Lobato International',country:'Timor-Leste',flag:'🇹🇱'},
    {code:'AMD',city:'Ahmedabad',name:'Sardar Vallabhbhai Patel International',country:'India',flag:'🇮🇳'},
    {code:'COK',city:'Kochi',name:'Cochin International',country:'India',flag:'🇮🇳'},
    {code:'GOX',city:'Goa',name:'Manohar International (Mopa)',country:'India',flag:'🇮🇳'},
    {code:'CCJ',city:'Kozhikode',name:'Calicut International',country:'India',flag:'🇮🇳'},
    {code:'PNQ',city:'Pune',name:'Pune International',country:'India',flag:'🇮🇳'},
    {code:'JAI',city:'Jaipur',name:'Jaipur International',country:'India',flag:'🇮🇳'},
    {code:'IXC',city:'Chandigarh',name:'Chandigarh International',country:'India',flag:'🇮🇳'},
    {code:'IXB',city:'Bagdogra',name:'Bagdogra Airport',country:'India',flag:'🇮🇳'},
    {code:'ADL',city:'Adelaide',name:'Adelaide Airport',country:'Australia',flag:'🇦🇺'},
    {code:'OOL',city:'Gold Coast',name:'Gold Coast Airport',country:'Australia',flag:'🇦🇺'},
    {code:'CBR',city:'Canberra',name:'Canberra Airport',country:'Australia',flag:'🇦🇺'},
    {code:'DRW',city:'Darwin',name:'Darwin International',country:'Australia',flag:'🇦🇺'},
    {code:'CHC',city:'Christchurch',name:'Christchurch International',country:'New Zealand',flag:'🇳🇿'},
    {code:'ZQN',city:'Queenstown',name:'Queenstown Airport',country:'New Zealand',flag:'🇳🇿'},
    {code:'POM',city:'Port Moresby',name:'Jacksons International',country:'Papua New Guinea',flag:'🇵🇬'},
    {code:'APW',city:'Apia',name:'Faleolo International',country:'Samoa',flag:'🇼🇸'},
    {code:'VLI',city:'Port Vila',name:'Bauerfield International',country:'Vanuatu',flag:'🇻🇺'},
    {code:'HIR',city:'Honiara',name:'Honiara International',country:'Solomon Islands',flag:'🇸🇧'},
    {code:'TBU',city:'Nukuʻalofa',name:'Fuaʻamotu International',country:'Tonga',flag:'🇹🇴'},
    {code:'ROR',city:'Koror',name:'Roman Tmetuchl International',country:'Palau',flag:'🇵🇼'},
    {code:'PNI',city:'Pohnpei',name:'Pohnpei International',country:'Micronesia',flag:'🇫🇲'},
    {code:'MAJ',city:'Majuro',name:'Marshall Islands International',country:'Marshall Islands',flag:'🇲🇭'},
    {code:'TRW',city:'Tarawa',name:'Bonriki International',country:'Kiribati',flag:'🇰🇮'},
    {code:'FUN',city:'Funafuti',name:'Funafuti International',country:'Tuvalu',flag:'🇹🇻'},
    {code:'INU',city:'Nauru',name:'Nauru International',country:'Nauru',flag:'🇳🇷'}
  ],
  createCustomAirport(raw, additionalAirports) {
    const city = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!city || city.length > 100) return null;
    const reservedAirports = Array.isArray(additionalAirports) ? additionalAirports : [];
    const existing = reservedAirports.find(a => a.custom && a.city.toLowerCase() === city.toLowerCase());
    if (existing) return existing;

    const words = city.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().match(/[A-Z0-9]+/g) || [];
    if (!words.length) return null;
    const letters = words.join('');
    let baseCode = words.length >= 3
      ? words.slice(0, 3).map(word => word[0]).join('')
      : (words.map(word => word[0]).join('') + letters).slice(0, 3);
    baseCode = (baseCode + letters + 'XXX').slice(0, 3);

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const hash = Array.from(city).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
    const isAvailable = candidate => !this.airports.some(a => a.code === candidate) &&
      !reservedAirports.some(a => a.code === candidate);
    let code = isAvailable(baseCode) ? baseCode : null;
    for (let i = 0; !code && i < alphabet.length; i++) {
      const candidate = baseCode.slice(0, 2) + alphabet[(hash + i) % alphabet.length];
      if (isAvailable(candidate)) code = candidate;
    }
    for (let i = 0; !code && i < alphabet.length; i++) {
      for (let j = 0; !code && j < alphabet.length; j++) {
        const candidate = baseCode[0] + alphabet[i] + alphabet[j];
        if (isAvailable(candidate)) code = candidate;
      }
    }
    for (let i = 0; !code && i < alphabet.length; i++) {
      for (let j = 0; !code && j < alphabet.length; j++) {
        for (let k = 0; !code && k < alphabet.length; k++) {
          const candidate = alphabet[i] + alphabet[j] + alphabet[k];
          if (isAvailable(candidate)) code = candidate;
        }
      }
    }
    if (!code) return null;
    return {code, city, name:'Custom location', country:'Custom location', flag:'🌍', custom:true};
  },
  initAirportInput(inputEl, onSelect, allowCustom, makeCustomAirport) {
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
      // Never narrower than a readable list (matters when the field sits in a compact 2-column grid)
      var vw    = document.documentElement.clientWidth || window.innerWidth;
      var width = Math.min(Math.max(r.width, 260), vw - 16);
      var left  = Math.max(8, Math.min(r.left, vw - width - 8));
      dd.style.top   = top + 'px';
      dd.style.left  = left + 'px';
      dd.style.width = width + 'px';
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
      hdr.textContent = list.some(function(a) { return a.custom; })
        ? 'Custom location · code generated automatically'
        : list.length + ' Airport' + (list.length !== 1 ? 's' : '') +
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
      if (allowCustom && q && scored.length === 0) {
        var customAirport = makeCustomAirport ? makeCustomAirport(q) : self.createCustomAirport(q);
        if (customAirport) scored.push(customAirport);
      }
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
  setupUploadZoneMultiple(zone, previewEl, onFiles) {
    if (!zone) return;
    const input = zone.querySelector('input[type="file"]');
    zone.addEventListener('dragover', function(e){ e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', function(){ zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', function(e) {
      e.preventDefault(); zone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) { if(input){const dt=new DataTransfer();files.forEach(f=>dt.items.add(f));input.files=dt.files;} showPreviews(files); onFiles&&onFiles(files); }
    });
    if (input) input.addEventListener('change', function(){ const files = Array.from(input.files); if(files.length > 0){showPreviews(files);onFiles&&onFiles(files);} });
    function showPreviews(files) {
      if (!previewEl) return;
      previewEl.innerHTML = '';
      files.forEach(function(f, idx) {
        const container = document.createElement('div');
        if (f.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = function(e) {
            container.innerHTML = '<div style="position:relative;display:inline-block;border-radius:8px;overflow:hidden;border:1px solid rgba(0,212,255,0.2)"><img src="'+e.target.result+'" style="height:120px;width:120px;object-fit:cover;display:block"><div style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);color:var(--cyan);border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700">+'+(idx+1)+'</div></div>';
            previewEl.appendChild(container);
          };
          reader.readAsDataURL(f);
        } else {
          container.innerHTML = '<div style="padding:8px;background:var(--navy3);border-radius:8px;font-size:12px;border:1px solid rgba(0,212,255,0.2);height:120px;width:120px;display:flex;align-items:center;justify-content:center;text-align:center;flex-direction:column"><div style="font-size:20px">📄</div><div style="font-size:10px;margin-top:4px;word-break:break-all">'+f.name.substring(0,15)+'</div></div>';
          previewEl.appendChild(container);
        }
      });
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
    
    (function() {
      var lastScrollY = 0, ticking = false;
      window.addEventListener('scroll', function() {
        if (!ticking) {
          window.requestAnimationFrame(function() {
            var y = window.scrollY;
            if (y > lastScrollY && y > 80) {
              fab.classList.add('fab-scroll-hidden');
            } else {
              fab.classList.remove('fab-scroll-hidden');
            }
            lastScrollY = y;
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    })();
    this.chatMessages = [{ type:'bot', text:'Hey! 👋 I\'m **Zephyr**, your FlyWay AI assistant. I can help with bookings, payments, tracking, baggage, promos, and more! What do you need?' }];
    fab.addEventListener('click', function() {
      self.chatOpen = !self.chatOpen;
      if (chatWin) chatWin.style.display = self.chatOpen ? 'flex' : 'none';
      if (self.chatOpen) {
        self.renderChat();
        if (input) input.focus();
        const dot = fab.querySelector('.badge-dot');
        if (dot) dot.remove();
      }
    });
    if (closeBtn) closeBtn.addEventListener('click', function(){ self.chatOpen=false; if(chatWin) chatWin.style.display='none'; });
    if (!this.chatDocumentHandlerAdded) {
      document.addEventListener('click', function(e) {
        if (!self.chatOpen) return;
        if (!chatWin || !fab) return;
        if (!chatWin.contains(e.target) && !fab.contains(e.target)) {
          self.chatOpen = false;
          chatWin.style.display = 'none';
        }
      });
      this.chatDocumentHandlerAdded = true;
    }
    let sending = false;
    async function send() {
      const msg = input ? input.value.trim() : '';
      if (!msg || sending) return;
      sending = true;
      const history = self.chatMessages.filter(function(m){ return !m.typing; }).slice(-10).map(function(m) {
        return { role:m.type === 'user' ? 'user' : 'assistant', content:m.text };
      });
      if (input) input.value = '';
      if (input) input.disabled = true;
      self.chatMessages.push({type:'user',text:msg});
      self.chatMessages.push({type:'bot',text:'● ● ●',typing:true});
      if (sendBtn) sendBtn.disabled = true;
      self.renderChat();
      let reply;
      try {
        const result = await self.api('POST','/api/zephyr/chat',{message:msg,history:history});
        reply = result.source === 'offline' ? self.zephyrReply(msg) : result;
      } catch(e) {
        console.error('[Zephyr] Chat API request failed:', e.message);
        reply = self.zephyrReply(msg);
      } finally {
        self.chatMessages = self.chatMessages.filter(function(m){ return !m.typing; });
        sending = false;
        if (input) input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
      }
      self.chatMessages.push({type:'bot',text:reply.text,escalate:reply.escalate});
      self.renderChat();
      try {
        await self.api('POST','/api/messages',{name:self.user?self.user.username:'Guest',email:self.user?self.user.email:'',subject:'AI Chat',message:msg,userId:self.user?self.user.id:null});
      } catch(e) {
        console.warn('[Zephyr] Could not save the chat message for support review:', e.message);
      }
    }
    if (sendBtn) sendBtn.addEventListener('click', send);
    if (input) input.addEventListener('keydown', function(e){ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} });
  },
  renderChat() {
    const el = document.getElementById('chatMessages');
    if (!el) return;
    el.innerHTML = this.chatMessages.map(function(m) {
      const escapedText = String(m.text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      const txt = m.typing ? escapedText : escapedText.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
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
    else if (/n[\s-]?gram|probabilistic|large language model|\bllm\b|transformer model|neural language model/.test(m))
      text = '**These ideas are related, but they describe different approaches or scales:**\n\n• **Probabilistic / N-gram models** estimate the next word from how often short word sequences appeared in training text. They are simple and fast, but their short context makes them poor at following long conversations.\n\n• **Neural language models** learn patterns in text using neural networks and vector representations, so they can generalize beyond exact phrases seen in training.\n\n• **Transformer models** are a neural-network architecture that uses attention to connect relevant words across a context. They are the architecture behind most modern language models.\n\n• **Large language models (LLMs)** are very large neural language models trained on extensive text. Most current LLMs use Transformers; the terms describe model scale/use and architecture, respectively.\n\nIn short: N-grams count short patterns; neural models learn representations; Transformers are an architecture; and LLMs are large models often built with that architecture.';
    else if (/who are you|your name|what are you/.test(m))
      text = 'I\'m **Zephyr** - FlyWay\'s AI assistant! I help with:\n\n✈ **Booking flights**\n📡 **Flight tracking**\n💳 **Payments** (gift cards, crypto)\n🧳 **Baggage** allowances\n🎟 **Promo codes**\n⭐ **Loyalty points**\n\nJust ask!';
    else if (/book|flight|ticket|reserve|fly/.test(m))
      text = 'To book a flight:\n\n1️⃣ Go to **Book a Flight** in the menu\n2️⃣ Type a city or airport code in the FROM box - **pick from the dropdown**\n3️⃣ Do the same for TO\n4️⃣ Pick date, passengers, class\n5️⃣ Click **Search** - flights are available for every route!\n\nNeed help with a step?';
    else if (/no flight|not found|can\'t find|no drop/.test(m))
      text = 'Make sure to:\n• **Type** in the airport box, then **click the suggestion** from the dropdown\n• Then click the blue **Search** button\n\nFlights exist for every route. Popular ones: JFK→LAX, JFK→LHR, DXB→JFK, SIN→LHR';
    else if (/pay|payment|card|crypto|bitcoin|gift card|giftcard/.test(m))
      text = 'FlyWay accepts:\n\n🎁 **Gift Cards** - Amazon, iTunes, Google Play, Steam, Walmart, Visa & more\n₿ **Crypto** - BTC, ETH, USDT (copy wallet address, upload screenshot)\n💳 **Card** - fills form → shows network fail → redirects to gift card/crypto\n\nBank transfer and mobile wallets are under maintenance.';
    else if (/track|where is|flight status|live/.test(m))
      text = 'Use **Track Flight** in the navigation:\n\n• Enter your flight number: **FW-XXXX, FW-XXXX, FWXXXXXXX** etc.\n• Or paste your **booking reference** from My Bookings\n• See live: status, progress, gate, terminal, weather, altitude\n• Share the tracking link with family! 🔗';
    else if (/promo|discount|code|voucher|coupon/.test(m))
      { text = 'Promo codes are given to loyalty members and through campaigns. 🎟\n\n• Contact support via WhatsApp or Email to request one\n• Enter it at **Step 5 (Extras)** during booking\n• Discounts range from 10% to 100% off'; escalate = true; }
    else if (/cancel|refund/.test(m))
      { text = 'To cancel:\n1. Go to **My Bookings**\n2. Click **Cancel** on your booking\n3. Refund processed in 5–7 business days\n\nYou\'ll get a notification at each step.'; escalate = true; }
    else if (/bag|luggage|cargo|weight|carry.?on/.test(m))
      text = 'Baggage included free:\n\n✈ **Economy** - 1 carry-on + 1 checked\n💺 **Business** - 1 carry-on + 2 checked\n👑 **First Class** - 1 carry-on + 3 checked\n\nExtra bags: **$50 each** (selected at Step 5)';
    else if (/seat|window|aisle|legroom/.test(m))
      text = 'Choose seats at **Step 4** of booking:\n\n• **Window** - +$10\n• **Extra Legroom** (exit rows) - +$50\n• **Standard** - free\n• **Skip** - auto-assign at check-in\n\nFirst Class has private suites!';
    else if (/license|key|register|sign up/.test(m))
      { text = 'To create an account you need a **license key**.\n\nAvailable on the register page - click any key type to auto-fill:\n🧑 Solo · 🌴 Holiday · 🏔 Adventure · 📚 Student · 👴 Senior · 💑 Couple · 👨‍👩‍👧‍👦 Family · 👥 Group · 💍 Honeymoon · 💼 Business'; escalate = true; }
    else if (/loyalty|points|reward|tier/.test(m))
      text = 'Loyalty tiers:\n🥉 **Bronze** - 0 pts\n🥈 **Silver** - 2,000 pts\n🥇 **Gold** - 5,000 pts\n💎 **Platinum** - 10,000 pts\n\nEarn 50–200 points per confirmed booking!';
    else if (/admin|panel|backdoor|lexy|system|internal|logs|audit|privileged|secret|backend/.test(m))
      text = 'I cannot provide admin, internal, or privileged system information. Only authorized staff can access that data. Please contact our support team for help.';
    else if (/contact|support|human|agent|help|whatsapp|email/.test(m))
      { text = 'Reach our support team:\n\n📧 **Email** - platinumtrack.noreply@gmail.com\n💬 **WhatsApp** - +1 (555) 000-0000\n📞 **Phone** - +1 (555) 000-0000\n\nOr use the **Contact** page to send a message - it shows in the admin panel instantly.'; escalate = true; }
    else if (/weather|temperature|rain/.test(m))
      text = 'Check departure and arrival weather on the **Track Flight** page for any live flight! 🌤\n\nFor destination forecasts, use weather.com or your phone\'s weather app.';
    else if (/family|group|children|kids|infant|baby|senior/.test(m))
      text = 'Group bookings up to **8 passengers** at once!\n\nAuto discounts:\n👶 **Infant** (under 2) - 90% off\n🧒 **Child** (under 12) - 25% off\n👴 **Senior** (60+) - 15% off';
    else if (/price|cost|how much|fare/.test(m))
      text = 'Prices by class:\n✈ **Economy** - base price\n💺 **Business** - 2.2× economy\n👑 **First Class** - 4× economy\n\nPlus: airport tax ($25/pax), service fee ($12.50), VAT (7.5%). Search your route to see exact pricing!';
    else if (/flight type|non.?stop|direct flight|connecting|layover|stopover/.test(m))
      text = 'Here\'s the **Flight Type Guide**:\n\n✈ **Non-stop Flight**\nThe fastest option, with no stops. The plane takes off, lands once, and arrives at the destination.\n\n🛫 **Direct Flight**\nA single flight number that may stop for passengers or refuel, but you usually stay on the same plane. Adds 30-60 minutes to flight time.\n\n🔄 **Connecting Flight**\nAt least two separate planes and flight numbers. You change planes during a layover. Adds 2-4 hours for connections.\n\n**Fastest:** Non-stop\n**Convenience:** Non-stop > Direct > Connecting\n**Cheaper:** Connecting flights are usually the cheapest, while non-stop are the most expensive.\n\nTrack Direct/Connecting flights to see live stop reports! I can also help with average delay times for airlines, minimum layover times, or tips for missed connections!';
    else
      text = 'I can answer general questions as well as FlyWay questions. My local language model is not reachable right now, so I do not want to guess at an answer. Start Ollama on the FlyWay server and make sure the configured model is downloaded, then ask me again.\n\nWould you like help booking a flight on FlyWay?';
    if (/n[\s-]?gram|probabilistic|large language model|\bllm\b|transformer model|neural language model/.test(m))
      text += '\n\nWould you like help booking a flight on FlyWay?';
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
        if (typeof loadRecent === 'function') loadRecent();
      });
      this._socket.on('user_data_deleted_' + uid, function(changes) {
        if (changes && changes.kind === 'account') {
          FlyWay.toast('warning', 'Account deleted', 'Your account was deleted by an administrator.');
          FlyWay.logout();
          return;
        }
        window.dispatchEvent(new CustomEvent('flyway:user-data-deleted', { detail: changes || {} }));
        if (changes && ['booking', 'bookings', 'proof'].includes(changes.kind)) {
          if (typeof loadBookings === 'function') loadBookings();
        }
        if (changes && ['booking', 'bookings', 'proof', 'transaction', 'transactions'].includes(changes.kind)) {
          if (typeof loadRecent === 'function') loadRecent();
        }
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

// ═══════════════════════════════════════════════════════════════
// FlyWay Multi-Currency System
// Auto-detects user locale/timezone → maps to currency
// All prices are stored in USD internally; displayed in local currency
// ═══════════════════════════════════════════════════════════════
FlyWay.currency = (function() {

  // Fixed exchange rates relative to USD (updated periodically)
  const RATES = {
    USD:1.000, EUR:0.920, GBP:0.790, CAD:1.360, AUD:1.530, NZD:1.660,
    JPY:149.50, CNY:7.240, HKD:7.820, SGD:1.350, MYR:4.700, THB:35.50,
    INR:83.20, PKR:278.0, BDT:110.0, LKR:305.0, NPR:133.0,
    AED:3.672, SAR:3.750, QAR:3.640, KWD:0.307, BHD:0.376, OMR:0.385,
    EGP:30.90, NGN:1540.0, KES:129.0, GHS:12.40, ZAR:18.70, ETB:56.50,
    MAD:10.05, TND:3.120, DZD:134.5, TZS:2520.0, UGX:3750.0, XOF:553.0,
    BRL:4.970, MXN:17.20, ARS:870.0, CLP:930.0, COP:3950.0, PEN:3.750,
    VES:36.50, UYU:39.20, BOB:6.910, PYG:7250.0,
    CHF:0.890, SEK:10.55, NOK:10.70, DKK:6.880, PLN:3.970, CZK:22.80,
    HUF:355.0, RON:4.560, BGN:1.800, HRK:6.990, RSD:107.5, UAH:37.80,
    TRY:29.50, RUB:91.00, KZT:450.0, UZS:12400.0, GEL:2.680, AMD:400.0,
    IDR:15600.0, PHP:56.10, VND:24400.0, KRW:1330.0, TWD:31.80, BND:1.350,
    MMK:2095.0, KHR:4100.0, LAK:21000.0,
    ILS:3.760, JOD:0.709, LBP:90000.0, IQD:1310.0, IRR:42300.0,
  };

  const SYMBOLS = {
    USD:'$', EUR:'€', GBP:'£', CAD:'C$', AUD:'A$', NZD:'NZ$',
    JPY:'¥', CNY:'¥', HKD:'HK$', SGD:'S$', MYR:'RM', THB:'฿',
    INR:'₹', PKR:'₨', BDT:'৳', LKR:'Rs', NPR:'Rs',
    AED:'AED', SAR:'SAR', QAR:'QAR', KWD:'KD', BHD:'BD', OMR:'OMR',
    EGP:'E£', NGN:'₦', KES:'KSh', GHS:'GH₵', ZAR:'R', ETB:'Br',
    MAD:'MAD', TND:'DT', DZD:'DA', TZS:'TSh', UGX:'USh', XOF:'CFA',
    BRL:'R$', MXN:'MX$', ARS:'AR$', CLP:'CLP', COP:'COL$', PEN:'S/',
    VES:'Bs', UYU:'$U', BOB:'Bs', PYG:'₲',
    CHF:'CHF', SEK:'kr', NOK:'kr', DKK:'kr', PLN:'zł', CZK:'Kč',
    HUF:'Ft', RON:'lei', BGN:'лв', HRK:'kn', RSD:'din', UAH:'₴',
    TRY:'₺', RUB:'₽', KZT:'₸', UZS:"so'm", GEL:'₾', AMD:'֏',
    IDR:'Rp', PHP:'₱', VND:'₫', KRW:'₩', TWD:'NT$', BND:'B$',
    MMK:'K', KHR:'R', LAK:'₭',
    ILS:'₪', JOD:'JD', LBP:'L£', IQD:'IQD', IRR:'﷼',
  };

  // Decimal places: 0 for high-value currencies
  const ZERO_DECIMAL = new Set(['JPY','KRW','VND','IDR','UGX','TZS','MMK','KHR','LAK','IRR','LBP','GNF','PYG','RWF','UZS']);

  // Timezone → currency mapping (IANA timezone prefixes/exact)
  const TZ_CURRENCY = {
    'America/New_York':'USD','America/Chicago':'USD','America/Denver':'USD',
    'America/Los_Angeles':'USD','America/Phoenix':'USD','America/Anchorage':'USD',
    'America/Adak':'USD','Pacific/Honolulu':'USD',
    'America/Toronto':'CAD','America/Vancouver':'CAD','America/Edmonton':'CAD',
    'America/Winnipeg':'CAD','America/Halifax':'CAD','America/St_Johns':'CAD',
    'America/Mexico_City':'MXN','America/Monterrey':'MXN','America/Tijuana':'MXN',
    'America/Sao_Paulo':'BRL','America/Manaus':'BRL','America/Belem':'BRL',
    'America/Argentina/Buenos_Aires':'ARS','America/Bogota':'COP',
    'America/Lima':'PEN','America/Santiago':'CLP','America/Caracas':'VES',
    'America/Montevideo':'UYU','America/La_Paz':'BOB','America/Asuncion':'PYG',
    'America/Guayaquil':'USD',
    'Europe/London':'GBP','Europe/Dublin':'EUR','Europe/Lisbon':'EUR',
    'Europe/Paris':'EUR','Europe/Berlin':'EUR','Europe/Rome':'EUR',
    'Europe/Madrid':'EUR','Europe/Amsterdam':'EUR','Europe/Brussels':'EUR',
    'Europe/Vienna':'EUR','Europe/Zurich':'CHF','Europe/Stockholm':'SEK',
    'Europe/Oslo':'NOK','Europe/Copenhagen':'DKK','Europe/Helsinki':'EUR',
    'Europe/Athens':'EUR','Europe/Warsaw':'PLN','Europe/Prague':'CZK',
    'Europe/Budapest':'HUF','Europe/Bucharest':'RON','Europe/Sofia':'BGN',
    'Europe/Zagreb':'EUR','Europe/Belgrade':'RSD','Europe/Kiev':'UAH',
    'Europe/Istanbul':'TRY','Europe/Moscow':'RUB','Europe/Minsk':'BYR',
    'Asia/Dubai':'AED','Asia/Riyadh':'SAR','Asia/Qatar':'QAR',
    'Asia/Kuwait':'KWD','Asia/Bahrain':'BHD','Asia/Muscat':'OMR',
    'Asia/Jerusalem':'ILS','Asia/Amman':'JOD','Asia/Baghdad':'IQD',
    'Asia/Tehran':'IRR','Asia/Beirut':'LBP',
    'Asia/Kolkata':'INR','Asia/Karachi':'PKR','Asia/Dhaka':'BDT',
    'Asia/Colombo':'LKR','Asia/Kathmandu':'NPR',
    'Asia/Tokyo':'JPY','Asia/Seoul':'KRW','Asia/Shanghai':'CNY',
    'Asia/Hong_Kong':'HKD','Asia/Singapore':'SGD','Asia/Kuala_Lumpur':'MYR',
    'Asia/Bangkok':'THB','Asia/Jakarta':'IDR','Asia/Manila':'PHP',
    'Asia/Ho_Chi_Minh':'VND','Asia/Yangon':'MMK','Asia/Phnom_Penh':'KHR',
    'Asia/Vientiane':'LAK','Asia/Taipei':'TWD','Asia/Brunei':'BND',
    'Asia/Tbilisi':'GEL','Asia/Yerevan':'AMD','Asia/Tashkent':'UZS',
    'Asia/Almaty':'KZT',
    'Africa/Lagos':'NGN','Africa/Nairobi':'KES','Africa/Accra':'GHS',
    'Africa/Johannesburg':'ZAR','Africa/Addis_Ababa':'ETB',
    'Africa/Casablanca':'MAD','Africa/Tunis':'TND','Africa/Algiers':'DZD',
    'Africa/Dar_es_Salaam':'TZS','Africa/Kampala':'UGX','Africa/Abidjan':'XOF',
    'Africa/Cairo':'EGP',
    'Australia/Sydney':'AUD','Australia/Melbourne':'AUD','Australia/Brisbane':'AUD',
    'Australia/Perth':'AUD','Australia/Adelaide':'AUD','Australia/Darwin':'AUD',
    'Pacific/Auckland':'NZD','Pacific/Fiji':'FJD',
  };

  let _current = 'USD';
  let _listeners = [];

  function detectCurrency() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (TZ_CURRENCY[tz]) return TZ_CURRENCY[tz];
      // Try prefix match (e.g. "America/Indiana/Indianapolis" → "America")
      const prefix = tz.split('/')[0] + '/' + tz.split('/')[1];
      for (const key of Object.keys(TZ_CURRENCY)) {
        if (key.startsWith(prefix.substring(0, prefix.length))) return TZ_CURRENCY[key];
      }
      // Check user's locale number format currency
      const locale = navigator.language || 'en-US';
      try {
        const parts = new Intl.NumberFormat(locale, {style:'currency',currency:'USD'}).formatToParts(1);
        // fallback to USD
      } catch(e) {}
    } catch(e) {}
    return 'USD';
  }

  function convertUSD(usdAmount, toCurrency) {
    const rate = RATES[toCurrency] || 1;
    return usdAmount * rate;
  }

  function format(usdAmount, currency) {
    const cur = currency || _current;
    const amount = convertUSD(usdAmount, cur);
    const sym = SYMBOLS[cur] || cur + ' ';
    const decimals = ZERO_DECIMAL.has(cur) ? 0 : 2;
    const formatted = amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    // Prefix or suffix symbol depending on currency
    const suffixCurrencies = new Set(['SEK','NOK','DKK','PLN','CZK','HUF','RON','BGN','HRK','RSD','UAH','TRY','RUB','KZT','GEL','AMD','VND','KHR','LAK','IQD','IRR']);
    return suffixCurrencies.has(cur) ? formatted + '\u00a0' + sym : sym + formatted;
  }

  function set(currency) {
    if (!RATES[currency]) return;
    _current = currency;
    localStorage.setItem('fw_currency', currency);
    _listeners.forEach(fn => fn(currency));
    // Re-render pricing if function exists
    if (typeof updatePricing === 'function') updatePricing();
    // Re-render flight results if function exists
    if (typeof renderResults === 'function') renderResults();
  }

  function get() { return _current; }

  function onCurrencyChange(fn) { _listeners.push(fn); }

  function init() {
    const saved = localStorage.getItem('fw_currency');
    const detected = detectCurrency();
    _current = (saved && RATES[saved]) ? saved : (RATES[detected] ? detected : 'USD');
  }

  function getSupportedCurrencies() {
    return Object.keys(RATES).map(code => ({
      code,
      symbol: SYMBOLS[code] || code,
      label: code,
    }));
  }

  // Build the currency selector HTML
  function buildSelector(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const currencies = getSupportedCurrencies();
    const groups = [
      { label: '🌍 Major', codes: ['USD','EUR','GBP','CAD','AUD','NZD','CHF','JPY','CNY'] },
      { label: '🌍 Africa', codes: ['NGN','KES','GHS','ZAR','ETB','EGP','MAD','TND','DZD','TZS','UGX','XOF'] },
      { label: '🌏 Asia', codes: ['AED','SAR','QAR','KWD','BHD','OMR','ILS','INR','PKR','BDT','LKR','THB','SGD','MYR','IDR','PHP','VND','KRW','TWD','HKD','TRY','GEL','KZT','UZS','AMD'] },
      { label: '🌎 Americas', codes: ['BRL','MXN','ARS','CLP','COP','PEN','UYU','BOB','PYG'] },
      { label: '🌍 Europe', codes: ['SEK','NOK','DKK','PLN','CZK','HUF','RON','BGN','RSD','UAH','RUB'] },
    ];
    let html = `<select id="fw_currency_select" onchange="FlyWay.currency.set(this.value)" style="background:var(--navy3,#0d1f3c);color:var(--text,#e8f2ff);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 10px;font-size:13px;cursor:pointer;outline:none;">`;
    groups.forEach(g => {
      html += `<optgroup label="${g.label}">`;
      g.codes.forEach(code => {
        const sym = SYMBOLS[code] || '';
        html += `<option value="${code}" ${code === _current ? 'selected' : ''}>${sym} ${code}</option>`;
      });
      html += `</optgroup>`;
    });
    html += `</select>`;
    el.innerHTML = html;
  }

  init();
  return { set, get, format, convertUSD, detectCurrency, buildSelector, onCurrencyChange, RATES, SYMBOLS };
})();
