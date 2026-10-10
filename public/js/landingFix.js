

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {

    
    
    
    
    var liveFeed = document.getElementById('liveFeed');
    if (liveFeed && liveFeed.children.length === 0) {
      var seedRoutes = ['JFK → LHR', 'DXB → SIN', 'LAX → NRT', 'LHR → JFK', 'SIN → CDG'];
      var seedNames  = ['Amara O.', 'James K.', 'Sofia L.', 'David M.', 'Fatima H.'];
      var route = seedRoutes[Math.floor(Math.random() * seedRoutes.length)];
      var name  = seedNames[Math.floor(Math.random()  * seedNames.length)];
      var el = document.createElement('div');
      el.style.cssText = [
        'display:flex', 'align-items:center', 'gap:12px',
        'padding:10px 12px', 'background:var(--navy3)',
        'border-radius:10px', 'border:1px solid var(--border)',
        'font-size:13px'
      ].join(';');
      el.innerHTML = '<span style="font-size:18px">✈</span>'
        + '<div style="flex:1"><div style="font-weight:600">' + name + '</div>'
        + '<div style="color:var(--muted);font-size:12px">' + route + ' · Economy</div></div>'
        + '<div style="text-align:right"><div style="font-family:var(--font-h);font-weight:700;color:var(--cyan)">$'
        + (Math.floor(Math.random() * 600) + 150)
        + '</div><div style="font-size:10px;color:var(--muted)">just now</div></div>';
      liveFeed.appendChild(el);
    }

  }); 

})();
