/* ============ HealthSimAI — script.js ============ */
(function () {
  'use strict';

  /* ---------- Header scroll state ---------- */
  const header = document.getElementById('siteHeader');
  const stickyCta = document.getElementById('stickyCta');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 24);
    stickyCta.classList.toggle('visible', window.scrollY > 600);
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
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  /* ---------- Animated counters ---------- */
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  const countObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        countObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('.vp-number').forEach(el => countObserver.observe(el));

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

  /* ---------- ROI Calculator ---------- */
  const bedsInput = document.getElementById('bedsInput');
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

    // Benchmarks: $2.3M total / 300 beds, scaled by ALOS headroom above the
    // 4.4-day optimized baseline; OR savings ~$50K per suite per year.
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

  /* ---------- Case study carousel ---------- */
  const track = document.getElementById('carouselTrack');
  const cards = track.children;
  const dotsWrap = document.getElementById('carouselDots');
  let current = 0;
  let autoTimer;

  for (let i = 0; i < cards.length; i++) {
    const dot = document.createElement('button');
    dot.setAttribute('aria-label', 'Go to case study ' + (i + 1));
    dot.addEventListener('click', () => goTo(i, true));
    dotsWrap.appendChild(dot);
  }
  const dots = dotsWrap.children;

  function goTo(i, manual) {
    current = (i + cards.length) % cards.length;
    track.style.transform = 'translateX(-' + current * 100 + '%)';
    for (let d = 0; d < dots.length; d++) dots[d].classList.toggle('active', d === current);
    if (manual) restartAuto();
  }
  function restartAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => goTo(current + 1), 8000);
  }
  document.getElementById('prevCase').addEventListener('click', () => goTo(current - 1, true));
  document.getElementById('nextCase').addEventListener('click', () => goTo(current + 1, true));
  goTo(0);
  restartAuto();

  /* ---------- Contact form ---------- */
  const form = document.getElementById('contactForm');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(form);
    const subject = encodeURIComponent('Demo request — ' + (data.get('organization') || data.get('name')));
    const body = encodeURIComponent(
      'Name: ' + data.get('name') +
      '\nEmail: ' + data.get('email') +
      '\nOrganization: ' + (data.get('organization') || '—') +
      '\nInterest: ' + (data.get('interest') || '—') +
      '\n\n' + (data.get('message') || ''));
    window.location.href = 'mailto:info@healthsimai.com?subject=' + subject + '&body=' + body;
    const note = document.createElement('p');
    note.className = 'form-success';
    note.textContent = 'Opening your email client… If nothing happens, email us at info@healthsimai.com.';
    form.appendChild(note);
    setTimeout(() => note.remove(), 8000);
  });
})();
