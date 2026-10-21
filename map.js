/* Darna Immo — خريطة شقق LPP التفاعلية (دبابيس الأسعار)
   تعتمد على Leaflet + markercluster وتُغذّى من app.js عبر window.DarnaMap.render(list) */
(function () {
  'use strict';

  var isFr = function () { return !String(document.documentElement.lang || '').toLowerCase().startsWith('ar'); };
  var t = function (ar, fr) { return isFr() ? fr : ar; };

  // ───────── مطابقة البلدية → إحداثيات (البيانات في communes.js) ─────────
  // الإعلانات لا تحمل إحداثيات، فيُحدَّد الموقع من نص البلدية. إن أضفت لاحقاً lat/lng للإعلان فسيُستعمل مباشرة.
  function norm(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f\u064B-\u0652\u0640]/g, '')
      .replace(/['’`]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ئ/g, 'ي').replace(/ؤ/g, 'و').replace(/[ڨڤ]/g, 'ق').replace(/گ/g, 'ك').replace(/([a-z])\1+/g, '$1')
      .replace(/[-_–—.,()/:;|]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var INDEX = [];
  (window.DZ_PLACES || []).forEach(function (p) {
    var names = [p.ar, p.fr].concat(p.aliases || []);
    if (p.ar.indexOf('ال') === 0 && p.ar.length > 6) names.push(p.ar.slice(2));
    var seen = {};
    var aliases = names.map(norm).filter(function (a) { if (!a || a.length < 4 || seen[a]) return false; seen[a] = 1; return true; });
    INDEX.push({ name: p.ar, aliases: aliases, lat: p.lat, lng: p.lng, rank: p.rank || 0 });
  });

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // أطول اسم مطابق داخل النص
  function bestMatch(text) {
    var hay = ' ' + norm(text) + ' ';
    if (hay.trim() === '') return null;
    var best = null, bestLen = 0;
    INDEX.forEach(function (p) {
      p.aliases.forEach(function (a) {
        var eff = a.length - p.rank;
        if (eff > bestLen && hay.indexOf(a) !== -1) { best = p; bestLen = eff; }
      });
    });
    return best;
  }

  // ───────── مطابقة تقريبية: تتسامح مع اختلاف حرف أو حرفين في الاسم ─────────
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var rowMin = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function tolerance(len) { return len <= 4 ? 0 : (len <= 7 ? 1 : 2); }

  function fuzzyMatch(text) {
    var words = norm(text).split(' ').filter(Boolean);
    if (!words.length) return null;
    var best = null, bestScore = 1e9;
    for (var i = 0; i < words.length; i++) {
      var gram = '';
      for (var n = 0; n < 4 && i + n < words.length; n++) {
        gram += words[i + n];                     // بدون مسافات: "برج كيفان" = "برجكيفان"
        if (gram.length < 4) continue;
        INDEX.forEach(function (p) {
          p.aliases.forEach(function (a) {
            var al = a.replace(/ /g, '');
            var tol = tolerance(al.length);
            if (Math.abs(al.length - gram.length) > tol) return;
            var d = tol === 0 ? (al === gram ? 0 : 9) : lev(gram, al, tol);
            if (d <= tol) {
              var score = d * 10 - al.length + p.rank * 3; // الأقل مسافة ثم الأطول اسماً (والمدينة الكبرى أقل أولوية)
              if (score < bestScore) { bestScore = score; best = p; }
            }
          });
        });
      }
    }
    return best;
  }

  // أحياء مرقّمة مثل Q12 وQ24 وQ35: تقع في منطقة المحالمة وسيدي عبد الله
  var SIDI_ABDELLAH = { name: 'سيدي عبد الله', lat: 36.6760, lng: 2.8800 };
  // مواضع الأحياء من لقطة خرائط Google (دقة تقريبية ±400 م). الحي غير المذكور هنا يوضع وسط المنطقة.
  var QUARTERS = { '12': [36.6757, 2.8872], '35': [36.6817, 2.8695], '24': [36.6319, 2.8708], '19': [36.6496, 2.8937] };
  function quarterPlace(n) {
    var c = QUARTERS[String(parseInt(n, 10))];
    return { name: SIDI_ABDELLAH.name, lat: c ? c[0] : SIDI_ABDELLAH.lat, lng: c ? c[1] : SIDI_ABDELLAH.lng, quarter: String(n), tight: !!c };
  }
  function quarterMatch(text) {
    var m = /(?:^|[^a-z0-9])q\s*\.?\s*(\d{1,3})(?![0-9])/i.exec(String(text || '').toLowerCase());
    return m ? quarterPlace(m[1]) : null;
  }

  // برامج LPP المعروفة بعدد مساكنها عندما يُكتب الرقم وحده
  function siteMatch(text) {
    var t = String(text || '');
    if (/(^|\D)(2058|1200)(\D|$)/.test(t)) return quarterPlace('12');
    if (/(^|\D)514(\D|$)/.test(t)) return { name: 'المحالمة', lat: 36.6651, lng: 2.8821, tight: true };
    return null;
  }

  // إن ذُكرت ولاية (تيبازة/البليدة/بومرداس) مع بلدية قريبة الاسم، فالبلدية هي الأدق
  function matchText(text) {
    var e = bestMatch(text);
    if (e && e.rank > 0) { var f = fuzzyMatch(text); if (f && f.rank === 0) return f; }
    return e || fuzzyMatch(text);
  }

  // اسم البلدية أو رقم البرنامج: عند المحالمة/سيدي عبد الله يُفضَّل رقم البرنامج لأنه أدق (مثل 514)
  function resolve(text) {
    var m = matchText(text), sm = siteMatch(text);
    if (sm && (!m || m.name === 'المحالمة' || m.name === 'سيدي عبد الله')) return sm;
    return m || sm;
  }

  var unmatched = {};
  var CENTER = { lat: 36.745, lng: 3.085 };

  // يرجع {lat,lng,approx}: الأولوية لحقل البلدية، ثم العنوان، ثم الوصف
  function geoFor(ad) {
    var lat = parseFloat(ad.lat), lng = parseFloat(ad.lng);
    if (isFinite(lat) && isFinite(lng)) return { lat: lat, lng: lng, approx: false };
    var h = hash(String(ad.id));
    var p = quarterMatch(ad.commune) || resolve(ad.commune) || quarterMatch(ad.title) || resolve(ad.title) || bestMatch(ad.desc);
    if (p) {
      var spread = p.tight ? 0.0028 : 0.010;
      var dx = ((h & 0xffff) / 0xffff - 0.5) * spread;
      var dy = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * spread * 0.8;
      if (p.quarter && !p.tight) { // حي Q بلا موضع مقاس: يُوزَّع حول وسط المنطقة بموضع ثابت لكل رقم
        var hq = hash('Q' + p.quarter);
        dx += ((hq & 0xffff) / 0xffff - 0.5) * 0.012;
        dy += (((hq >>> 16) & 0xffff) / 0xffff - 0.5) * 0.010;
      }
      return { lat: p.lat + dy, lng: p.lng + dx, approx: false, place: p.name };
    }
    // بلدية غير معروفة: يظهر الإعلان بموقع تقريبي في العاصمة بدل أن يختفي
    var key = String(ad.commune || '').trim() || '—';
    unmatched[key] = (unmatched[key] || 0) + 1;
    var ux = ((h & 0xffff) / 0xffff - 0.5) * 0.16;
    var uy = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 0.10;
    return { lat: CENTER.lat + uy, lng: CENTER.lng + ux, approx: true };
  }

  // ───────── تنسيق ─────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function trim1(n) { return String(Math.round(n * 10) / 10).replace(/\.0$/, ''); }
  function createdMs(ad) {
    var c = ad.createdAt;
    if (c && typeof c.toMillis === 'function') return c.toMillis();
    return Number(c) || 0;
  }
  // يقبل "2 800 000" و"2.800.000" و"2800000 DA"
  function priceOf(ad) {
    var s = String(ad.price == null ? '' : ad.price).replace(/[^\d.]/g, '');
    if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    var n = Number(s);
    return isFinite(n) ? n : 0;
  }
  // البيع: بالسنتيم (1 دج = 100 سنتيم)، الكراء: بالآلاف — فارغ إذا لا يوجد سعر
  function shortPrice(ad) {
    var p = priceOf(ad);
    if (!p) return '';
    if (ad.op === 'kira') return trim1(p / 1000) + (isFr() ? ' k' : ' ألف');
    var c = p * 100;
    return c >= 1e9 ? trim1(c / 1e9) + (isFr() ? ' Md' : ' مليار') : trim1(c / 1e6) + (isFr() ? ' M' : ' مليون');
  }
  function longPrice(ad) {
    var p = priceOf(ad);
    if (!p) return t('السعر عند الاتصال', 'Prix sur demande');
    var da = p.toLocaleString('fr-DZ') + ' DA' + (ad.op === 'kira' ? (isFr() ? ' / mois' : ' / شهر') : '');
    if (ad.op === 'kira') return da;
    var c = p * 100;
    var cent = c >= 1e9 ? trim1(c / 1e9) + (isFr() ? ' Md de centimes' : ' مليار سنتيم') : trim1(c / 1e6) + (isFr() ? ' M de centimes' : ' مليون سنتيم');
    return da + ' · ' + cent;
  }
  function ago(ms) {
    if (!ms) return '';
    var m = Math.max(1, Math.round((Date.now() - ms) / 60000));
    if (m < 60) return isFr() ? 'il y a ' + m + ' min' : 'منذ ' + m + ' د';
    var h = Math.round(m / 60);
    if (h < 24) return isFr() ? 'il y a ' + h + ' h' : 'منذ ' + h + ' س';
    var d = Math.round(h / 24);
    return isFr() ? 'il y a ' + d + ' j' : 'منذ ' + d + ' يوم';
  }
  var ROOMS = { f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4', f5: 'F5', f6: 'F6+' };

  // ───────── الحالة ─────────
  var map = null, layer = null, meDot = null;
  var markers = {}, byId = {};
  var state = { list: [], loaded: false, error: false, lastKey: '' };
  var tickerTimer = null, tickerIdx = 0;

  function $(id) { return document.getElementById(id); }

  function makeLayer() {
    if (typeof L.markerClusterGroup === 'function') {
      return L.markerClusterGroup({
        showCoverageOnHover: false, maxClusterRadius: 46, chunkedLoading: true,
        iconCreateFunction: function (c) {
          return L.divIcon({ html: '<span>' + c.getChildCount() + '</span>', className: 'dm-cluster', iconSize: [42, 42] });
        }
      });
    }
    return L.layerGroup();
  }

  function popupHTML(ad) {
    var title = ad.title || ((ad.rooms ? (ROOMS[ad.rooms] || ad.rooms) + ' · ' : '') + 'LPP');
    var img = ad.imgBase64 ? '<img class="dm-pop-img" src="' + esc(ad.imgBase64) + '" alt="" loading="lazy">' : '<div class="dm-pop-img dm-pop-ph">🏢</div>';
    var specs = [];
    if (ad.rooms) specs.push('🛏️ ' + esc(ROOMS[ad.rooms] || ad.rooms));
    if (ad.area) specs.push('📐 ' + esc(ad.area) + ' m²');
    return '<div class="dm-pop" data-id="' + esc(ad.id) + '">' + img +
      '<div class="dm-pop-body">' +
      '<div class="dm-pop-title">' + esc(title) + '</div>' +
      '<div class="dm-pop-price">' + esc(longPrice(ad)) + '</div>' +
      (ad.__approx ? '<div class="dm-pop-note">' + t('📍 الموقع تقريبي — العاصمة', '📍 Position approximative — Alger') + '</div>' : '') +
      '<div class="dm-pop-meta">📍 ' + esc(ad.commune || (isFr() ? 'Alger' : 'الجزائر')) + (specs.length ? ' · ' + specs.join(' · ') : '') + '</div>' +
      '<div class="dm-pop-actions">' +
      '<button type="button" class="dm-btn dm-wa" data-act="wa">WhatsApp</button>' +
      '<button type="button" class="dm-btn dm-call" data-act="call">📞 ' + t('اتصل', 'Appeler') + '</button>' +
      '</div>' +
      '<button type="button" class="dm-more" data-act="more">' + t('عرض التفاصيل ←', 'Voir les détails →') + '</button>' +
      '</div></div>';
  }

  function isNew(ad) { return Date.now() - createdMs(ad) < 72 * 3600 * 1000; }

  function pinIcon(ad) {
    var cls = 'dm-pin-label ' + (ad.op === 'kira' ? 'rent' : 'sale') + (ad.feat ? ' feat' : '') + (isNew(ad) ? ' fresh' : '') + (ad.__approx ? ' approx' : '');
    return L.divIcon({
      html: '<span class="' + cls + '">' + esc(shortPrice(ad) || (ROOMS[ad.rooms] || 'LPP')) + '</span>',
      className: 'dm-pin', iconSize: [0, 0], iconAnchor: [0, 0]
    });
  }

  function setState(s) {
    state.loaded = (s === 'ready');
    state.error = (s === 'error');
    var ov = $('mapOverlay');
    if (!ov) return;
    if (s === 'loading') {
      ov.className = 'dm-overlay show';
      ov.innerHTML = '<div class="dm-spin"></div><div>' + t('جارٍ تحميل شقق LPP…', 'Chargement des LPP…') + '</div>';
    } else if (s === 'error') {
      ov.className = 'dm-overlay show';
      ov.innerHTML = '<div>⚠️ ' + t('تعذّر تحميل الإعلانات', 'Impossible de charger les annonces') + '</div><button type="button" class="dm-btn dm-call" onclick="retryLoadAds&&retryLoadAds()">' + t('إعادة المحاولة', 'Réessayer') + '</button>';
    } else {
      ov.className = 'dm-overlay';
      ov.innerHTML = '';
    }
  }

  function updateChip(mapped, fresh, approx) {
    var chip = $('mapLive');
    if (!chip) return;
    if (!mapped) { chip.hidden = true; return; }
    chip.hidden = false;
    chip.innerHTML = '<i></i><b>' + mapped + '</b> ' + t('شقة LPP على الخريطة', 'LPP sur la carte') +
      (fresh ? ' <em>· ' + fresh + ' ' + t('جديدة', fresh > 1 ? 'nouveaux' : 'nouveau') + '</em>' : '') +
      (approx ? ' <small>· ' + approx + ' ' + t('بموقع تقريبي', 'position approx.') + '</small>' : '');
  }

  function render(list) {
    state.list = list || [];
    if (!map) return;

    if (layer) map.removeLayer(layer);
    layer = makeLayer();
    markers = {}; byId = {};
    var pts = [], fresh = 0, approx = 0;
    unmatched = {};

    state.list.forEach(function (ad) {
      var g = geoFor(ad);
      if (!g) return;
      ad.__approx = !!g.approx;
      if (g.approx) approx++;
      byId[ad.id] = ad;
      var m = L.marker([g.lat, g.lng], { icon: pinIcon(ad), riseOnHover: true }).bindPopup(popupHTML(ad), { maxWidth: 280, minWidth: 240, autoPanPadding: [16, 70] });
      layer.addLayer(m);
      markers[ad.id] = m;
      pts.push([g.lat, g.lng]);
      if (isNew(ad)) fresh++;
    });
    map.addLayer(layer);
    updateChip(pts.length, fresh, approx);
    debugPanel();

    var empty = $('mapEmpty');
    if (empty) empty.hidden = pts.length > 0 || !state.loaded;

    var key = Object.keys(markers).sort().join(',');
    if (key !== state.lastKey) {
      state.lastKey = key;
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.18), { maxZoom: 13 });
      else if (pts.length === 1) map.setView(pts[0], 14);
    }
    renderTicker();
  }

  // لوحة تشخيص: افتح الموقع بإضافة ?debugmap لعرض البلديات التي لم تُعرَف
  function debugPanel() {
    if (location.search.indexOf('debugmap') === -1) return;
    var box = $('dmDebug');
    if (!box) { box = document.createElement('div'); box.id = 'dmDebug'; box.className = 'dm-debug'; document.body.appendChild(box); }
    var keys = Object.keys(unmatched).sort(function (a, b) { return unmatched[b] - unmatched[a]; });
    box.innerHTML = '<b>' + keys.length + ' بلدية غير معروفة</b><br>' + (keys.length ? keys.map(function (k) { return esc(k) + ' (' + unmatched[k] + ')'; }).join('<br>') : '✔ كل الإعلانات عُرف موقعها');
  }

  // ───────── شريط آخر العقارات ─────────
  function renderTicker() {
    var el = $('mapTicker');
    if (!el) return;
    var items = state.list.slice().sort(function (a, b) { return createdMs(b) - createdMs(a); }).slice(0, 6);
    clearInterval(tickerTimer);
    if (!items.length) { el.hidden = true; return; }
    el.hidden = false;
    var box = el.querySelector('.tk-track');
    box.innerHTML = items.map(function (ad, i) {
      var rooms = ad.rooms ? (ROOMS[ad.rooms] || ad.rooms) : 'LPP';
      var op = ad.op === 'kira' ? t('كراء', 'Location') : t('بيع', 'Vente');
      return '<button type="button" class="tk-item' + (i === 0 ? ' on' : '') + '" data-id="' + esc(ad.id) + '">' +
        (Date.now() - createdMs(ad) < 7 * 86400000 ? '<span class="tk-new">' + t('جديد', 'Nouveau') + '</span> ' : '') +
        '<b>' + esc(rooms) + '</b> · ' + op + ' · ' + esc(ad.commune || (isFr() ? 'Alger' : 'الجزائر')) + (shortPrice(ad) ? ' · <strong>' + esc(shortPrice(ad)) + '</strong>' : '') +
        (createdMs(ad) ? ' <small>' + ago(createdMs(ad)) + '</small>' : '') + '</button>';
    }).join('');
    tickerIdx = 0;
    if (items.length > 1) {
      tickerTimer = setInterval(function () {
        if (el.matches(':hover')) return;
        var nodes = box.querySelectorAll('.tk-item');
        nodes[tickerIdx].classList.remove('on');
        tickerIdx = (tickerIdx + 1) % nodes.length;
        nodes[tickerIdx].classList.add('on');
      }, 3600);
    }
  }

  // ───────── تفاعلات ─────────
  function focusAd(id) {
    var m = markers[id];
    var stage = $('mapStage');
    if (!m || !map) return;
    if (stage) {
      var top = stage.getBoundingClientRect().top + window.scrollY - 54;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
    var open = function () { m.openPopup(); };
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 14), { animate: true });
    if (layer && typeof layer.zoomToShowLayer === 'function') layer.zoomToShowLayer(m, open); else open();
  }

  function nearMe() {
    var btn = $('mapNear');
    if (!navigator.geolocation) return;
    if (btn) btn.classList.add('busy');
    navigator.geolocation.getCurrentPosition(function (pos) {
      if (btn) btn.classList.remove('busy');
      var ll = [pos.coords.latitude, pos.coords.longitude];
      if (meDot) map.removeLayer(meDot);
      meDot = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#1C5FAD', fillOpacity: 1 }).addTo(map);
      var nearest = null, nd = Infinity;
      Object.keys(markers).forEach(function (id) {
        var d = map.distance(ll, markers[id].getLatLng());
        if (d < nd) { nd = d; nearest = id; }
      });
      if (nearest) {
        map.fitBounds(L.latLngBounds([ll, markers[nearest].getLatLng()]).pad(0.5), { maxZoom: 15 });
        setTimeout(function () { markers[nearest] && markers[nearest].openPopup(); }, 450);
      } else {
        map.setView(ll, 14);
      }
    }, function () { if (btn) btn.classList.remove('busy'); }, { enableHighAccuracy: true, timeout: 9000 });
  }

  function bind() {
    var root = $('homeMap');
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var pop = b.closest('.dm-pop');
      var ad = pop && byId[pop.dataset.id];
      if (!ad) return;
      if (b.dataset.act === 'wa' && window.openWA) window.openWA(ad.phone || '', ad.title || 'LPP');
      else if (b.dataset.act === 'call' && window.dial) window.dial(ad.phone || '');
      else if (b.dataset.act === 'more' && window.openD) window.openD(ad.id);
    });
    var tk = $('mapTicker');
    if (tk) tk.addEventListener('click', function (e) {
      var b = e.target.closest('.tk-item');
      if (b) focusAd(b.dataset.id);
    });
    var near = $('mapNear');
    if (near) near.addEventListener('click', nearMe);
    var reset = $('mapReset');
    if (reset) reset.addEventListener('click', function () {
      var pts = Object.keys(markers).map(function (id) { return markers[id].getLatLng(); });
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.18), { maxZoom: 13 });
      else map.setView([36.745, 3.05], 11);
    });
    // التكبير بالعجلة بعد النقر على الخريطة فقط، حتى لا تعيق تمرير الصفحة
    map.on('focus', function () { map.scrollWheelZoom.enable(); });
    map.on('blur', function () { map.scrollWheelZoom.disable(); });
    // تمييز الدبوس عند المرور على بطاقته
    document.addEventListener('mouseover', function (e) {
      var c = e.target.closest && e.target.closest('.card[data-id]');
      if (!c) return;
      var m = markers[c.dataset.id];
      if (m && m._icon) m._icon.classList.add('dm-pin-active');
    });
    document.addEventListener('mouseout', function (e) {
      var c = e.target.closest && e.target.closest('.card[data-id]');
      if (!c) return;
      var m = markers[c.dataset.id];
      if (m && m._icon) m._icon.classList.remove('dm-pin-active');
    });
  }

  function init() {
    var el = $('homeMap');
    if (!el) return;
    if (!window.L) {
      el.innerHTML = '<div class="dm-fallback">' + t('تعذّر تحميل الخريطة. الإعلانات متوفرة في الأسفل.', 'La carte est indisponible. Les annonces sont plus bas.') + '</div>';
      return;
    }
    map = L.map(el, { zoomControl: false, attributionControl: false, minZoom: 6, maxZoom: 18, scrollWheelZoom: false, worldCopyJump: false }).setView([36.745, 3.05], 11);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.control.attribution({ position: 'topleft', prefix: false }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    bind();
    setState(state.loaded ? 'ready' : 'loading');
    if (state.loaded) { setState('ready'); render(state.list); }
    setTimeout(function () { map.invalidateSize(); }, 300);
  }

  window.DarnaMap = {
    render: function (list) { state.loaded = true; state.list = list || []; setState('ready'); render(list); },
    setState: setState,
    focus: focusAd,
    probe: function (text) { var g = geoFor({ id: 'probe', commune: text }); return { place: g.place || null, approx: g.approx, lat: g.lat, lng: g.lng }; },
    relabel: function () { if (map && state.loaded) render(state.list); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
