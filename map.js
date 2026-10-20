/* Darna Immo — خريطة شقق LPP التفاعلية (دبابيس الأسعار)
   تعتمد على Leaflet + markercluster وتُغذّى من app.js عبر window.DarnaMap.render(list) */
(function () {
  'use strict';

  var isFr = function () { return !String(document.documentElement.lang || '').toLowerCase().startsWith('ar'); };
  var t = function (ar, fr) { return isFr() ? fr : ar; };

  // ───────── إحداثيات تقريبية لمراكز البلديات (±1–2 كم) ─────────
  // الإعلانات لا تحمل إحداثيات، لذلك يُحدَّد الموقع من اسم البلدية. إن أضفت لاحقاً lat/lng للإعلان فسيُستعمل مباشرة.
  var PLACES = [
    [['سيدي عبد الله', 'sidi abdellah', 'sidi abdallah'], 36.6800, 2.8570],
    [['الرغاية', 'reghaia'], 36.7390, 3.3430],
    [['أولاد فايت', 'ouled fayet'], 36.7260, 2.9490],
    [['الدار البيضاء', 'dar el beida'], 36.7140, 3.2120],
    [['حسين داي', 'hussein dey'], 36.7400, 3.1010],
    [['باب الزوار', 'bab ezzouar'], 36.7240, 3.1830],
    [['برج البحري', 'bordj el bahri'], 36.7890, 3.2540],
    [['القبة', 'el kouba', 'kouba'], 36.7270, 3.0780],
    [['بئر مراد رايس', 'bir mourad rais'], 36.7340, 3.0420],
    [['الحراش', 'el harrach', 'harrach'], 36.7170, 3.1370],
    [['بوزريعة', 'bouzareah'], 36.7870, 3.0120],
    [['شراقة', 'الشراقة', 'cheraga'], 36.7640, 2.9640],
    [['الأبيار', 'el biar'], 36.7650, 3.0300],
    [['بن عكنون', 'ben aknoun'], 36.7600, 3.0120],
    [['زرالدة', 'zeralda'], 36.7110, 2.8420],
    [['الجزائر الوسطى', 'alger centre', 'sidi mhamed'], 36.7700, 3.0560],
    [['باب الوادي', 'bab el oued'], 36.7900, 3.0500],
    [['المرادية', 'el mouradia'], 36.7470, 3.0510],
    [['درارية', 'draria'], 36.7150, 2.9830],
    [['الرويبة', 'rouiba'], 36.7380, 3.2810],
    [['وادي السمار', 'oued smar'], 36.7080, 3.1650],
    [['دالي إبراهيم', 'dely ibrahim'], 36.7550, 2.9870],
    [['حيدرة', 'hydra'], 36.7440, 3.0300],
    [['عين بنيان', 'ain benian'], 36.7920, 2.9120],
    [['سطاوالي', 'staoueli'], 36.7570, 2.8890],
    [['برج الكيفان', 'bordj el kiffan'], 36.7490, 3.1920],
    [['المحمدية', 'el mohammadia', 'mohammadia'], 36.7350, 3.1300],
    [['عين طاية', 'ain taya'], 36.7930, 3.2900],
    [['الكاليتوس', 'les eucalyptus', 'eucalyptus'], 36.7060, 3.1530],
    [['بئر خادم', 'birkhadem'], 36.7150, 3.0530],
    [['الأربعاء', 'larbaa'], 36.5650, 3.1600],
    [['البليدة', 'blida'], 36.4700, 2.8300],
    [['بومرداس', 'boumerdes'], 36.7660, 3.4770],
    [['تيبازة', 'tipaza'], 36.5890, 2.4470],
    [['الشلف', 'chlef'], 36.1650, 1.3340],
    [['عين الدفلى', 'ain defla'], 36.2640, 1.9680],
    [['وهران', 'oran'], 35.6970, -0.6310],
    [['قسنطينة', 'constantine'], 36.3650, 6.6147],
    [['عنابة', 'annaba'], 36.9000, 7.7670],
    [['سطيف', 'setif'], 36.1900, 5.4100],
    [['باتنة', 'batna'], 35.5550, 6.1740],
    [['تيزي وزو', 'tizi ouzou'], 36.7118, 4.0459],
    [['بجاية', 'bejaia'], 36.7510, 5.0560],
    [['مستغانم', 'mostaganem'], 35.9310, 0.0890]
  ];

  function norm(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f\u064B-\u0652\u0640]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/[-_–—.,()/]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var INDEX = PLACES.map(function (p) { return { aliases: p[0].map(norm), lat: p[1], lng: p[2] }; });

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // يرجع {lat,lng} أو null — بإزاحة ثابتة صغيرة حتى لا تتطابق دبابيس نفس البلدية
  function geoFor(ad) {
    var lat = parseFloat(ad.lat), lng = parseFloat(ad.lng);
    if (isFinite(lat) && isFinite(lng)) return { lat: lat, lng: lng };
    var hay = ' ' + norm([ad.commune, ad.title, ad.desc].join(' | ')) + ' ';
    var best = null, bestLen = 0;
    INDEX.forEach(function (p) {
      p.aliases.forEach(function (a) {
        if (a.length > bestLen && hay.indexOf(a) !== -1) { best = p; bestLen = a.length; }
      });
    });
    if (!best) return null;
    var h = hash(String(ad.id));
    var dx = ((h & 0xffff) / 0xffff - 0.5) * 0.011;
    var dy = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 0.009;
    return { lat: best.lat + dy, lng: best.lng + dx };
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
    var cls = 'dm-pin-label ' + (ad.op === 'kira' ? 'rent' : 'sale') + (ad.feat ? ' feat' : '') + (isNew(ad) ? ' fresh' : '');
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

  function updateChip(mapped, fresh) {
    var chip = $('mapLive');
    if (!chip) return;
    if (!mapped) { chip.hidden = true; return; }
    chip.hidden = false;
    chip.innerHTML = '<i></i><b>' + mapped + '</b> ' + t('شقة LPP على الخريطة', 'LPP sur la carte') +
      (fresh ? ' <em>· ' + fresh + ' ' + t('جديدة', fresh > 1 ? 'nouveaux' : 'nouveau') + '</em>' : '');
  }

  function render(list) {
    state.list = list || [];
    if (!map) return;

    if (layer) map.removeLayer(layer);
    layer = makeLayer();
    markers = {}; byId = {};
    var pts = [], fresh = 0;

    state.list.forEach(function (ad) {
      var g = geoFor(ad);
      if (!g) return;
      byId[ad.id] = ad;
      var m = L.marker([g.lat, g.lng], { icon: pinIcon(ad), riseOnHover: true }).bindPopup(popupHTML(ad), { maxWidth: 280, minWidth: 240, autoPanPadding: [16, 70] });
      layer.addLayer(m);
      markers[ad.id] = m;
      pts.push([g.lat, g.lng]);
      if (isNew(ad)) fresh++;
    });
    map.addLayer(layer);
    updateChip(pts.length, fresh);

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
    map = L.map(el, { zoomControl: false, minZoom: 6, maxZoom: 18, scrollWheelZoom: false, worldCopyJump: false }).setView([36.745, 3.05], 11);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
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
    relabel: function () { if (map && state.loaded) render(state.list); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
