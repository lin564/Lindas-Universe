/* ============ HealthSimAI script.js ============ */
(function () {
  'use strict';

  /* ---------- Header scroll state ---------- */
  const header = document.getElementById('siteHeader');
  const stickyCta = document.getElementById('stickyCta');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 24);
    stickyCta.classList.toggle('visible', window.scrollY > 700);
  }, { passive: true });

  /* ---------- Mobile nav ---------- */
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  navToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  mainNav.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => mainNav.classList.remove('open')));

  /* ---------- Active nav link on scroll ---------- */
  const navLinks = Array.from(mainNav.querySelectorAll('a'));
  const sections = navLinks
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(a =>
          a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(s => sectionObserver.observe(s));

  /* ---------- Reveal on scroll ---------- */
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  /* ---------- Solution tabs ---------- */
  const tabs = document.querySelectorAll('#solutionTabs .tab');
  const panels = document.querySelectorAll('#solutionTabs .tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach(p => { p.hidden = true; p.classList.remove('active'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const panel = document.getElementById('panel-' + tab.dataset.tab);
      panel.hidden = false;
      panel.classList.add('active');
    });
  });

  /* ---------- Impact estimator ---------- */
  const bedsInput = document.getElementById('bedsInput');
  if (bedsInput) {
  const alosInput = document.getElementById('alosInput');
  const orInput = document.getElementById('orInput');
  const fmt = v => v >= 10 ? '$' + Math.round(v) + 'M' : '$' + v.toFixed(1) + 'M';

  function updateSliderFill(input) {
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--fill', pct + '%');
  }

  function calcROI() {
    const beds = +bedsInput.value;
    const alos = +alosInput.value;
    const ors = +orInput.value;

    document.getElementById('bedsOut').textContent = beds;
    document.getElementById('alosOut').textContent = alos.toFixed(1);
    document.getElementById('orOut').textContent = ors;

    // Illustrative benchmarks: ~$2.3M total / 300 beds, scaled by ALOS
    // headroom above a 4.4-day optimized baseline; OR ~$50K per suite/year.
    const alosFactor = Math.max(0.3, Math.min(1.6, (alos - 4.4) / (7.5 - 4.4)));
    const flow = (beds / 300) * 1.4 * alosFactor;
    const or = ors * 0.05;
    const maint = (beds / 300) * 0.3;
    const total = flow + or + maint;

    document.getElementById('flowSavings').textContent = fmt(flow);
    document.getElementById('orSavings').textContent = fmt(or);
    document.getElementById('maintSavings').textContent = fmt(maint);
    document.getElementById('totalSavings').textContent = fmt(total);
  }

  [bedsInput, alosInput, orInput].forEach(input => {
    input.addEventListener('input', () => { updateSliderFill(input); calcROI(); });
    updateSliderFill(input);
  });
  calcROI();
  }

  /* ---------- Dashboard: live clock ---------- */
  const clock = document.getElementById('dashClock');
  function tickClock() {
    if (!clock) return;
    clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  tickClock();
  setInterval(tickClock, 30000);

  /* ---------- Dashboard: gently drifting KPIs ---------- */
  const kpiRanges = [
    { id: 'kpiEd', min: 38, max: 46 },
    { id: 'kpiBed', min: 84, max: 90 },
    { id: 'kpiPts', min: 1190, max: 1280, comma: true },
    { id: 'kpiStaff', min: 90, max: 94 },
    { id: 'kpiOr', min: 74, max: 79 }
  ];
  setInterval(() => {
    const k = kpiRanges[Math.floor(Math.random() * kpiRanges.length)];
    const el = document.getElementById(k.id);
    if (!el) return;
    const current = parseInt(el.textContent.replace(/,/g, ''), 10);
    let next = current + (Math.random() < 0.5 ? -1 : 1) * (k.comma ? Math.ceil(Math.random() * 8) : 1);
    next = Math.max(k.min, Math.min(k.max, next));
    el.textContent = k.comma ? next.toLocaleString('en-US') : String(next);
  }, 3500);

  /* ---------- Animated counters (scenario cards) ---------- */
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const duration = 1100;
    const start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = target * eased;
      el.textContent = prefix + (el.dataset.comma ? Math.round(v).toLocaleString('en-US') : v.toFixed(decimals)) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  const scenNums = document.querySelectorAll('.scen-num, .count-up');
  const scenObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        scenObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  scenNums.forEach(el => scenObserver.observe(el));

  const runBtn = document.getElementById('runScenario');
  if (runBtn) runBtn.addEventListener('click', () => scenNums.forEach(animateCount));

  /* ---------- Contact form ---------- */
  const form = document.getElementById('contactForm');
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(form);
    const subject = encodeURIComponent('Demo request: ' + (data.get('organization') || data.get('name')));
    const body = encodeURIComponent(
      'Name: ' + data.get('name') +
      '\nEmail: ' + data.get('email') +
      '\nOrganization: ' + (data.get('organization') || 'n/a') +
      '\nInterest: ' + (data.get('interest') || 'n/a') +
      '\n\n' + (data.get('message') || ''));
    window.location.href = 'mailto:info@healthsimai.com?subject=' + subject + '&body=' + body;
    const note = document.createElement('p');
    note.className = 'form-success';
    note.textContent = 'Opening your email client… If nothing happens, email us at info@healthsimai.com.';
    form.appendChild(note);
    setTimeout(() => note.remove(), 8000);
  });
})();
