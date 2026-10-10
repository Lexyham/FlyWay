/**
 * FlyWay Dashboard – Shared Sidebar Toggle
 * Handles the navbar ☰ button toggling the .site-sidebar on all dashboard pages.
 * Include this AFTER main.js on every dashboard page.
 */
(function () {
  'use strict';

  function init() {
    var sidebar  = document.getElementById('sidebar');
    var navHamburger = document.getElementById('navHamburger'); // navbar ☰ button
    var overlay  = document.getElementById('sidebarOverlay');

    if (!sidebar) return;

    // Create overlay if not present in HTML
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebarOverlay';
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }

    function openSidebar() {
      sidebar.classList.add('open');
      overlay.classList.add('active');
      document.body.classList.add('nav-open');
      if (navHamburger) navHamburger.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
      document.body.classList.remove('nav-open');
      if (navHamburger) navHamburger.setAttribute('aria-expanded', 'false');
    }

    function toggleSidebar() {
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    }

    // Navbar hamburger ☰
    if (navHamburger) {
      navHamburger.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleSidebar();
      });
    }

    // Overlay click → close
    overlay.addEventListener('click', closeSidebar);

    // Clicking a sidebar nav link closes on mobile
    sidebar.querySelectorAll('.sidebar-nav-item').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth <= 768) closeSidebar();
      });
    });

    // On resize to desktop, always close (sidebar becomes static again)
    window.addEventListener('resize', function () {
      if (window.innerWidth > 768) closeSidebar();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
