/* Darna Immo — تأثيرات: بطاقات 3D، ترجمة العناصر الثابتة، وبطاقة الدليل القانوني */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var isFr = function () { return !String(document.documentElement.lang || '').toLowerCase().startsWith('ar'); };

  // ───────── ترجمة العناصر التي تحمل data-ar / data-fr ─────────
  function applyI18n() {
    var fr = isFr();
    document.querySelectorAll('[data-ar][data-fr]').forEach(function (el) {
      el.textContent = fr ? el.getAttribute('data-fr') : el.getAttribute('data-ar');
    });
    document.querySelectorAll('[data-ar-ph][data-fr-ph]').forEach(function (el) {
      el.placeholder = fr ? el.getAttribute('data-fr-ph') : el.getAttribute('data-ar-ph');
    });
  }
  window.DarnaI18n = { apply: applyI18n };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyI18n); else applyI18n();

  // ───────── بطاقات 3D: ميل مع المؤشر (للشاشات التي فيها فأرة فقط) ─────────
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fine && !reduce) {
    var cur = null;
    var reset = function (c) {
      c.classList.remove('tilting');
      c.style.removeProperty('--rx');
      c.style.removeProperty('--ry');
    };
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('.card');
      if (cur && cur !== c) reset(cur);
      cur = c || null;
      if (!c) return;
      var r = c.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--ry', ((x - 0.5) * 12).toFixed(2) + 'deg');
      c.style.setProperty('--rx', ((0.5 - y) * 12).toFixed(2) + 'deg');
      c.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      c.classList.add('tilting');
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { if (cur) { reset(cur); cur = null; } });
  }

  // ───────── بطاقة الدليل القانوني (مرة واحدة في الجلسة) ─────────
  var KEY = 'dz_legal_sheet';
  var shown = false;
  try { shown = sessionStorage.getItem(KEY) === '1'; } catch (e) {}

  function anyModalOpen() {
    return !!document.querySelector('.overlay.open, #filterDrawer.open');
  }
  function onAdsTab() {
    var p = $('tabPanel-ads');
    return !p || p.classList.contains('active');
  }
  function showSheet() {
    var s = $('legalSheet');
    if (!s || shown || anyModalOpen() || !onAdsTab()) return;
    shown = true;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    s.hidden = false;
    requestAnimationFrame(function () { s.classList.add('show'); });
  }
  function hideSheet() {
    var s = $('legalSheet');
    if (!s) return;
    s.classList.remove('show');
    setTimeout(function () { s.hidden = true; }, 300);
  }
  window.DarnaSheet = {
    close: hideSheet,
    go: function () {
      hideSheet();
      if (window.switchTab) window.switchTab('legal');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!shown && $('legalSheet')) {
    // 1) بعد 30 ثانية من التصفح
    setTimeout(showSheet, 30000);
    // 2) عند تجاوز ثلثي الصفحة
    window.addEventListener('scroll', function onScroll() {
      var depth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (depth > 0.66) { window.removeEventListener('scroll', onScroll); setTimeout(showSheet, 800); }
    }, { passive: true });
    // 3) نيّة المغادرة على الحاسوب
    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget && e.clientY <= 0) showSheet();
    });
  }
})();
