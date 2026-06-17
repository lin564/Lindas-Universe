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

  /* ---------- Lead capture (contact + gated downloads) ---------- */
  // When the lead-intake Worker is deployed, set this to its URL (e.g. "/api/lead").
  // While empty, the site degrades gracefully to an email fallback so nothing breaks.
  const LEAD_ENDPOINT = '';

  const FREE_EMAIL = /@(gmail|yahoo|outlook|hotmail|live|icloud|aol|proton(mail)?|gmx|mail)\./i;

  function downloadsCount() {
    return parseInt(localStorage.getItem('hsai_downloads') || '0', 10);
  }

  // Mirrors the server-side scoring so the CRM gets a hint even before sync.
  function scoreLead(d) {
    let s = 0;
    const email = (d.email || '').trim();
    if (email && !FREE_EMAIL.test(email)) s += 40;        // work email
    if ((d.organization || '').trim()) s += 20;
    const role = (d.role || '').toLowerCase();
    if (/chief|c[-\s]?level|\bceo\b|\bcio\b|\bcfo\b|\bcmo\b|\bcoo\b|president|vp|vice president|head of|director|officer|administrator/.test(role)) s += 25;
    else if (/manager|lead|principal/.test(role)) s += 10;
    if ((d.interest || '').trim()) s += 10;
    s += Math.min(downloadsCount() * 5, 20);
    const tier = s >= 70 ? 'hot' : s >= 40 ? 'warm' : 'cold';
    return { score: s, tier: tier };
  }

  function mailtoFallback(d) {
    const subject = encodeURIComponent(
      (d.source === 'download' ? 'Resource request: ' + (d.asset || '') : 'Demo request: ' + (d.organization || d.name)));
    const body = encodeURIComponent(
      'Name: ' + (d.name || '') +
      '\nEmail: ' + (d.email || '') +
      '\nOrganization: ' + (d.organization || 'n/a') +
      '\nRole: ' + (d.role || 'n/a') +
      (d.asset ? '\nResource: ' + d.asset : '') +
      (d.interest ? '\nInterest: ' + d.interest : '') +
      '\n\n' + (d.message || ''));
    window.location.href = 'mailto:info@healthsimai.com?subject=' + subject + '&body=' + body;
  }

  // Returns a promise that resolves true if the lead reached the endpoint.
  function submitLead(d) {
    const payload = Object.assign({}, d, scoreLead(d), {
      downloads_count: downloadsCount(),
      user_agent: navigator.userAgent,
      page: location.pathname,
      ts: new Date().toISOString()
    });
    if (!LEAD_ENDPOINT) {
      mailtoFallback(d);
      return Promise.resolve(false);
    }
    return fetch(LEAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.ok).catch(() => { mailtoFallback(d); return false; });
  }

  function formData(form) {
    const o = {};
    new FormData(form).forEach((v, k) => { o[k] = v; });
    return o;
  }

  function showSuccess(form, msg) {
    let note = form.querySelector('.form-success');
    if (!note) { note = document.createElement('p'); note.className = 'form-success'; form.appendChild(note); }
    note.textContent = msg;
  }

  /* Contact / demo form */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) contactForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!contactForm.checkValidity()) { contactForm.reportValidity(); return; }
    const d = formData(contactForm);
    submitLead(d).then(sent => {
      showSuccess(contactForm, sent
        ? "Thanks — your request is in. A HealthSimAI specialist will reach out shortly."
        : "Opening your email client… If nothing happens, email us at info@healthsimai.com.");
    });
  });

  /* Gated-download modal */
  const modal = document.getElementById('downloadModal');
  if (modal) {
    const titleEl = document.getElementById('modalTitle');
    const assetEl = document.getElementById('modalAsset');
    const dlForm = document.getElementById('downloadForm');
    let lastTrigger = null;

    function openModal(asset) {
      assetEl.value = asset;
      titleEl.textContent = 'Get the ' + asset;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      const first = dlForm.querySelector('input[name="name"]');
      if (first) first.focus();
    }
    function closeModal() {
      modal.hidden = true;
      document.body.style.overflow = '';
      const note = dlForm.querySelector('.form-success');
      if (note) note.remove();
      dlForm.reset();
      if (lastTrigger) lastTrigger.focus();
    }

    document.querySelectorAll('.js-download').forEach(btn => {
      btn.addEventListener('click', () => { lastTrigger = btn; openModal(btn.dataset.doc || 'guide'); });
    });
    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

    dlForm.addEventListener('submit', e => {
      e.preventDefault();
      if (!dlForm.checkValidity()) { dlForm.reportValidity(); return; }
      const d = formData(dlForm);
      localStorage.setItem('hsai_downloads', String(downloadsCount() + 1));
      submitLead(d).then(() => {
        showSuccess(dlForm, "Thanks — we've emailed the " + (d.asset || 'resource') + " to " + d.email + ".");
        setTimeout(closeModal, 3500);
      });
    });
  }
})();
