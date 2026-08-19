import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, getDoc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgoARkUtqmeg4JDpLLpr1mzS8f0VDMFE0",
  authDomain: "blimmo.firebaseapp.com",
  projectId: "blimmo",
  storageBucket: "blimmo.firebasestorage.app",
  messagingSenderId: "566587628949",
  appId: "1:566587628949:web:78c8e8c154f903f159aa9c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const adsCol = collection(db, "clients");

// Language state – French is default
let currentLang = 'fr';

// Data mappings – Arabic (default)
const PT = { aadl:"AADL", social:"Social", lpp:"LPP", lsp:"LSP", villa:"فيلا", maison:"منزل", appart:"شقة", residence:"ريزيدنس", local:"محل" };
const OP = { kira:"كراء", bay3:"بيع", achat:"شراء", tbadol:"تبادل" };
const ROOMS = { f1:"F1", f2:"F2", f3:"F3", f4:"F4", f5:"F5", f6:"F6+" };
const COND = { neuf:"جديد", utilise:"مستعمل" };
const STATUS = { dispo:"متوفر", reserved:"محجوز", sold:"تم البيع", rented:"تم الكراء" };

// Data mappings – French
const PT_FR = { aadl:"AADL", social:"Social", lpp:"LPP", lsp:"LSP", villa:"Villa", maison:"Maison", appart:"Appartement", residence:"Résidence", local:"Local commercial" };
const OP_FR = { kira:"Location", bay3:"Vente", achat:"Achat", tbadol:"Échange" };
const COND_FR = { neuf:"Neuf", utilise:"Occasion" };
const STATUS_FR = { dispo:"Disponible", reserved:"Réservé", sold:"Vendu", rented:"Loué" };

// Helpers to get label in current language
function lPT(k)  { return (currentLang==='fr' ? PT_FR[k]  : PT[k])  || k; }
function lOP(k)  { return (currentLang==='fr' ? OP_FR[k]  : OP[k])  || k; }
function lCOND(k){ return (currentLang==='fr' ? COND_FR[k]: COND[k]) || k; }
function lSTATUS(k){ return (currentLang==='fr' ? STATUS_FR[k]: STATUS[k]) || k; }
const STATUS_COLORS = { dispo:"#15803D", reserved:"#B45309", sold:"#B91C1C", rented:"#9E6D3E" };
const TYPE_COLORS = { aadl:"#1C5FAD", social:"#6B21A8", lpp:"#C2410C", lsp:"#059669", villa:"#8B5A2B", maison:"#2F6B47", appart:"#1C5FAD", residence:"#6A1B9A", local:"#C2410C" };
const OP_COLORS = { kira:"#C9A84C", bay3:"#CE1126", achat:"#0E6B56", tbadol:"#374151" };

// ══════════════════════════════════════════════════════
// SMART SEARCH ENGINE v2 – بحث ذكي عام (عربي ⇄ فرنسي/لاتيني)
// ══════════════════════════════════════════════════════
//
// المشكلة مع النسخة السابقة: قاموس مرادفات يدوي محدود — أي اسم مكان غير مُدرَج
// (مثل "عميروش" أو "سيدي بنور") لا يُطابق إطلاقاً.
//
// الحل الجديد: محرك تحويل صوتي عام (Transliteration) يُحوّل أي كلمة عربية
// إلى "بصمة صوتية لاتينية" وأي كلمة فرنسية/لاتينية إلى نفس البصمة، ثم يقارن
// البصمتين. هذا يعمل مع أي اسم — مُدرَج بالقاموس أو لا — لأنه يعتمد على
// الأصوات الفعلية للحروف، وليس على حفظ كل اسم يدوياً.
// القاموس اليدوي يبقى موجوداً كطبقة دقة إضافية فوق هذا المحرك العام.

// ── خريطة تحويل: حرف عربي → الصوت اللاتيني المقابل (كما يُكتب بالفرنسية في الجزائر) ──
const ARABIC_TO_LATIN_SOUND = {
  'ا':'a', 'أ':'a', 'إ':'a', 'آ':'a', 'ء':'',
  'ب':'b', 'ت':'t', 'ث':'t',
  'ج':'j', 'ح':'h', 'خ':'q',   // خ → q (يطابق kh → q في اللاتيني)
  'د':'d', 'ذ':'d', 'ر':'r', 'ز':'z',
  'س':'s', 'ش':'x',             // ش → x (يطابق ch → x في اللاتيني)
  'ص':'s', 'ض':'d',
  'ط':'t', 'ظ':'d', 'ع':'', 'غ':'g',
  'ف':'f', 'ق':'k', 'ك':'k', 'ل':'l',
  'م':'m', 'ن':'n', 'ه':'h', 'ة':'a',
  'و':'u', 'ي':'i', 'ى':'a', 'ئ':'i', 'ؤ':'u',  // و → u يطابق ou → u
  ' ':' ',
};

// تحويل كلمة عربية إلى بصمة صوتية لاتينية مبسّطة (للمقارنة الصوتية)
function arabicToPhonetic(str) {
  let out = '';
  for (const ch of str) {
    out += ARABIC_TO_LATIN_SOUND[ch] !== undefined ? ARABIC_TO_LATIN_SOUND[ch] : ch;
  }
  return out;
}

// تبسيط كلمة لاتينية/فرنسية إلى نفس "مستوى" البصمة الصوتية
// (إزالة أحرف العلة المزدوجة، توحيد أصوات متشابهة في الفرنسية الجزائرية)
function latinToPhonetic(str) {
  return str
    .toLowerCase()
    .replace(/ou/g, 'u')       // ou الفرنسية → u (Ouled → uld، تطابق "أولاد" → uld)
    .replace(/ch/g, 'x')       // ch → x (حرف خاص نتجنب به التعارض مع 'c' و'h' منفردين)
    .replace(/kh/g, 'q')       // kh → q
    .replace(/gh/g, 'g')
    .replace(/qu/g, 'k')
    .replace(/c(?!h)/g, 'k')
    .replace(/ph/g, 'f')
    .replace(/[éèêë]/g, 'e')
    .replace(/[àâ]/g, 'a')
    .replace(/[îï]/g, 'i')
    .replace(/[ô]/g, 'o')
    .replace(/[ûù]/g, 'u')
    .replace(/y/g, 'i')
    .replace(/[aeiou]{2,}/g, m => m[0])
    .replace(/(.)\1+/g, '$1')
    .replace(/[^a-z ]/g, '');
}

// تبسيط البصمة العربية أيضاً (إزالة التكرار وأحرف العلة الزائدة) لمطابقة أعمّ
function simplifyPhonetic(str) {
  return str
    .replace(/[aeiou]{2,}/g, m => m[0])
    .replace(/(.)\1+/g, '$1')
    .replace(/[^a-z]/g, c => c === ' ' ? ' ' : '');
}

// ── البصمة الصوتية الموحّدة لأي نص (عربي أو فرنسي) ──
function phoneticFingerprint(str) {
  if (!str) return '';
  const hasArabic = /[\u0600-\u06FF]/.test(str);
  const raw = hasArabic ? arabicToPhonetic(str) : latinToPhonetic(str);
  return simplifyPhonetic(raw.toLowerCase()).replace(/\s+/g, ' ').trim();
}

// ── قاموس دقيق لأهم البلديات والولايات (طبقة دقة إضافية فوق المحرك الصوتي العام) ──
const COMMUNE_SYNONYMS = [
  ['سيدي عبد الله', 'Sidi Abdellah'],
  ['الرغاية', 'Reghaia'],
  ['أولاد فايت', 'Ouled Fayet'],
  ['الدار البيضاء', 'Dar El Beida'],
  ['حسين داي', 'Hussein Dey'],
  ['باب الزوار', 'Bab Ezzouar'],
  ['برج البحري', 'Bordj El Bahri'],
  ['القبة', 'El Kouba', 'Kouba'],
  ['بئر مراد رايس', 'Bir Mourad Rais'],
  ['الحراش', 'El Harrach'],
  ['بوزريعة', 'Bouzareah'],
  ['شراقة', 'Cheraga'],
  ['الأبيار', 'El Biar'],
  ['بن عكنون', 'Ben Aknoun'],
  ['زرالدة', 'Zeralda'],
  ['الجزائر الوسطى', 'Alger Centre'],
  ['باب الوادي', 'Bab El Oued'],
  ['المرادية', 'El Mouradia'],
  ['درارية', 'Draria'],
  ['الرويبة', 'Rouiba'],
  ['وادي السمار', 'Oued Smar'],
  ['دالي إبراهيم', 'Dely Ibrahim'],
  ['حيدرة', 'Hydra'],
  ['عين بنيان', 'Ain Benian'],
  ['سطاوالي', 'Staoueli'],
  ['برج الكيفان', 'Bordj El Kiffan'],
  ['المحمدية', 'El Mohammadia'],
  ['عين طاية', 'Ain Taya'],
  ['الأربعاء', 'Larbaa'],
  ['الكاليتوس', 'Les Eucalyptus'],
  ['بئر خادم', 'Birkhadem'],
  ['الشراقة', 'Cheraga'],
  ['سيدي بنور', 'Sidi Bennour'],
  ['عميروش', 'Amirouche'],
  ['عين الدفلى', 'Ain Defla'],
  ['البليدة', 'Blida'],
  ['بومرداس', 'Boumerdes'],
  ['تيبازة', 'Tipaza'],
  ['الشلف', 'Chlef'],
  ['وهران', 'Oran'],
  ['قسنطينة', 'Constantine'],
  ['عنابة', 'Annaba'],
  ['سطيف', 'Setif'],
  ['باتنة', 'Batna'],
  ['تيزي وزو', 'Tizi Ouzou'],
  ['بجاية', 'Bejaia'],
  ['مستغانم', 'Mostaganem'],
];

// ── قاموس مرادفات عامة لمصطلحات عقارية شائعة ──
const GENERAL_SYNONYMS = [
  ['شقة', 'appartement', 'appart'],
  ['فيلا', 'villa'],
  ['منزل', 'maison', 'بيت'],
  ['محل', 'local', 'magasin'],
  ['ريزيدنس', 'residence'],
  ['كراء', 'location', 'louer'],
  ['بيع', 'vente', 'vendre'],
  ['شراء', 'achat', 'acheter'],
  ['تبادل', 'echange'],
  ['جديد', 'neuf', 'nouveau'],
  ['مستعمل', 'occasion'],
  ['متوفر', 'disponible', 'dispo'],
];

const ALL_SYNONYM_GROUPS = [...COMMUNE_SYNONYMS, ...GENERAL_SYNONYMS];

// ── تطبيع نصي بسيط (للمقارنة الحرفية المباشرة قبل اللجوء للصوتيات) ──
function normalizeText(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/[-_,،.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── خريطة مرادفات مبنية من القاموس اليدوي (للمطابقة الدقيقة السريعة) ──
const SYNONYM_EXPANSION_MAP = (() => {
  const map = {};
  ALL_SYNONYM_GROUPS.forEach(group => {
    const normalizedGroup = group.map(normalizeText);
    normalizedGroup.forEach(word => {
      if (!map[word]) map[word] = new Set();
      normalizedGroup.forEach(w => map[word].add(w));
    });
  });
  return map;
})();

function expandSearchTerm(term) {
  const norm = normalizeText(term);
  if (SYNONYM_EXPANSION_MAP[norm]) return [...SYNONYM_EXPANSION_MAP[norm]];
  for (const key in SYNONYM_EXPANSION_MAP) {
    if (key.includes(norm) || norm.includes(key)) return [...SYNONYM_EXPANSION_MAP[key]];
  }
  return [norm];
}

// ── مسافة Levenshtein لالتقاط الأخطاء الإملائية ──
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = a[i-1] === b[j-1]
        ? matrix[i-1][j-1]
        : 1 + Math.min(matrix[i-1][j-1], matrix[i-1][j], matrix[i][j-1]);
    }
  }
  return matrix[a.length][b.length];
}

// ── مطابقة كلمة بحث ضد نص هدف، بـ3 طبقات متدرجة: حرفي → مرادفات → صوتي ──
function termMatchesHaystack(term, haystackNorm, haystackPhonetic) {
  const normTerm = normalizeText(term);
  if (!normTerm) return false;

  // الطبقة 1: مطابقة حرفية مباشرة (الأسرع)
  if (haystackNorm.includes(normTerm)) return true;

  // الطبقة 2: مرادفات من القاموس اليدوي (دقة عالية للأسماء الشائعة)
  const expanded = expandSearchTerm(term);
  for (const exp of expanded) {
    if (exp && haystackNorm.includes(exp)) return true;
  }

  // الطبقة 3: مطابقة صوتية عامة — تعمل مع أي اسم غير مُدرَج بالقاموس
  // شرط: البصمة الصوتية ≥ 4 أحرف لتجنب التطابقات الوهمية مع الكلمات القصيرة
  if (normTerm.length >= 4) {
    const termPhonetic = phoneticFingerprint(term);
    if (termPhonetic.length >= 4 && haystackPhonetic.includes(termPhonetic)) return true;

    // تسامح إملائي إضافي على المستوى الصوتي
    if (termPhonetic.length >= 4) {
      const phoneticWords = haystackPhonetic.split(' ').filter(w => w.length >= 3);
      for (const w of phoneticWords) {
        const threshold = termPhonetic.length <= 5 ? 1 : 2;
        if (levenshteinDistance(w, termPhonetic) <= threshold) return true;
      }
    }
  }

  return false;
}

// ── الدالة الرئيسية: هل إعلان معيّن يطابق نص البحث؟ ──
function adMatchesSearch(ad, searchRaw) {
  const search = (searchRaw || '').trim();
  if (!search) return true;

  const words = search.split(/\s+/).filter(Boolean);

  const haystackFields = [
    ad.title || '', ad.commune || '', ad.desc || '',
    lPT(ad.type) || '', PT[ad.type] || '', PT_FR[ad.type] || '',
    lOP(ad.op) || '', OP[ad.op] || '', OP_FR[ad.op] || '',
  ];
  const haystackRaw = haystackFields.join(' ');
  const haystackNorm = normalizeText(haystackRaw);
  const haystackPhonetic = phoneticFingerprint(haystackRaw);

  return words.every(word => termMatchesHaystack(word, haystackNorm, haystackPhonetic));
}

// ── وضع الصفحة: home (الرئيسية - معاينة) أو listings (كل العقارات) ──
const PAGE_MODE = document.body.dataset.mode === 'listings' ? 'listings' : 'home';
let dataLoaded = false;
let dataLoadError = false;

// State
let DATA = [];
let fTypes = new Set(['aadl','social','lpp','lsp','villa','maison','appart','residence','local']);
let fOp = 'all';
let fRooms = 'all';
let fCondition = 'all';
let fStatus = 'all';
let fSearch = '';
let fCommune = '';
let priceMin = 0;
let priceMax = Infinity;
let displayList = [];
const favs = new Set(); // مجموعة IDs المفضلة

// Helper functions
function getTypeColor(type) { return TYPE_COLORS[type] || '#0D3B2E'; }
function getOpColor(op) { return OP_COLORS[op] || '#0D3B2E'; }
function getStatusColor(status) { return STATUS_COLORS[status] || '#555'; }

function applyFilters() {
  displayList = DATA.filter(ad => {
    if (!fTypes.has(ad.type)) return false;
    if (fOp !== 'all' && ad.op !== fOp) return false;
    if (fRooms !== 'all' && ad.rooms !== fRooms) return false;
    if (fCondition !== 'all' && ad.condition !== fCondition) return false;
    if (fStatus !== 'all' && ad.status !== fStatus) return false;
    if (fCommune && !adMatchesSearch(ad, fCommune)) return false;
    const price = Number(ad.price) || 0;
    if (price < priceMin || price > priceMax) return false;
    if (fSearch && !adMatchesSearch(ad, fSearch)) return false;
    return true;
  });
  sortAndRender();
}

function sortAndRender() {
  const sortVal = document.getElementById('srt')?.value || 'new';
  if (sortVal === 'pa') displayList.sort((a, b) => (a.price || 0) - (b.price || 0));
  else if (sortVal === 'pd') displayList.sort((a, b) => (b.price || 0) - (a.price || 0));
  else displayList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (PAGE_MODE === 'home') {
    renderHomePreview();
  } else {
    renderAds(displayList);
  }
}

function renderAds(list) {
  const grid = document.getElementById('grid');
  const rnSpan = document.getElementById('rn');
  if (!grid) return;
  const T = LANG[currentLang];
  if (rnSpan) rnSpan.innerText = list.length;
  const liveCountEl = document.getElementById('liveAdCount');
  if (liveCountEl) liveCountEl.innerText = DATA.length;

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div style="font-size:48px;margin-bottom:12px">🔍</div><h3>${T.noAds}</h3><p>${T.noAdsSub}</p></div>`;
    return;
  }

  grid.innerHTML = list.map(ad => buildCardHTML(ad)).join('');
  // تحديث عداد الكاروسيل بعد رسم البطاقات
  requestAnimationFrame(() => updateCarouselCount());
}

// ── قالب بطاقة عقار مشترك (تستخدمه الشبكة الكاملة ومعاينة الرئيسية) ──
const CARD_TYPE_BG = {
  aadl:'linear-gradient(135deg,#DBEAFE,#BFDBFE)',
  social:'linear-gradient(135deg,#EDE9FE,#DDD6FE)',
  lpp:'linear-gradient(135deg,#FEE2E2,#FECACA)',
  lsp:'linear-gradient(135deg,#D1FAE5,#A7F3D0)',
  villa:'linear-gradient(135deg,#FEF3C7,#FDE68A)',
  maison:'linear-gradient(135deg,#DCFCE7,#BBF7D0)',
  appart:'linear-gradient(135deg,#E0F2FE,#BAE6FD)',
  residence:'linear-gradient(135deg,#F3E8FF,#E9D5FF)',
  local:'linear-gradient(135deg,#FFE4E6,#FECDD3)',
};
const CARD_TYPE_ICON = {
  aadl:'🏗️', social:'🏠', lpp:'🏢', lsp:'🌿',
  villa:'🏡', maison:'🏠', appart:'🏢', residence:'🏙️', local:'🛍️',
};

function buildCardHTML(ad) {
  const bg = CARD_TYPE_BG[ad.type] || 'linear-gradient(135deg,#E8F5EE,#C8E6D9)';
  const icon = CARD_TYPE_ICON[ad.type] || '🏘️';
  const safePhone = (ad.phone||'').replace(/'/g,"&#39;");
  const safeTitle = (ad.title||'').replace(/'/g,"&#39;").replace(/"/g,'&quot;');
  const imgHtml = ad.imgBase64
    ? `<img src="${ad.imgBase64}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"/>`
    : `<div class="cimg-ph" style="background:${bg}">${icon}</div>`;
  return `
  <div class="card" onclick="openD('${ad.id}')">
    <div class="cimg">
      ${imgHtml}
      <span class="bt" style="background:${getTypeColor(ad.type)}">${lPT(ad.type)}</span>
      <span class="bo" style="background:${getOpColor(ad.op)};color:#fff">${lOP(ad.op)}</span>
      <div class="status-badge" style="background:${getStatusColor(ad.status)}">${lSTATUS(ad.status)}</div>
      ${ad.feat ? '<div style="position:absolute;top:8px;right:8px;background:linear-gradient(135deg,#F0C855,#C9A84C);color:#0D3B2E;font-size:10px;font-weight:700;padding:3px 9px;border-radius:50px">⭐ مميز</div>' : ''}
    </div>
    <div class="cbody">
      <div class="ctitle">${ad.title || `${lPT(ad.type)} - ${lOP(ad.op)}`}</div>
      <div class="cloc">📍 ${ad.commune || (currentLang==='fr'?'Alger':'الجزائر')}</div>
      <div class="cspecs">
        <span>🛏️ ${ROOMS[ad.rooms] || ad.rooms || '?'}</span>
        <span>📐 ${ad.area || '?'} m²</span>
        ${ad.avgRating ? `<span>⭐ ${Number(ad.avgRating).toFixed(1)}</span>` : ''}
      </div>
      <div class="cfoot">
        <div class="price">${Number(ad.price).toLocaleString('fr-DZ')} <small>DA</small></div>
      </div>
      <button class="btn-wa" style="width:100%;justify-content:center;margin-top:10px" onclick="event.stopPropagation();openWA('${safePhone}','${safeTitle}')">
        📩 راسلني الآن واتساب
      </button>
      <button class="btn-call" style="width:100%;justify-content:center;margin-top:6px" onclick="event.stopPropagation();dial('${ad.phone||''}')">
        📞 اتصل بي الآن
      </button>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════
// معاينة "أحدث العقارات" في الصفحة الرئيسية (6 فقط)
// ══════════════════════════════════════════════════════
const HOME_PREVIEW_COUNT = 6;

function skeletonCardsHTML(n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<div class="skeleton-card"><div class="sk-img"></div><div class="sk-line w60"></div><div class="sk-line w40"></div></div>`;
  }
  return out;
}

function homeSearchIsActive() {
  return !!(fSearch && fSearch.trim()) || fOp !== 'all';
}

function buildListingsUrl() {
  const params = new URLSearchParams();
  if (fSearch && fSearch.trim()) params.set('search', fSearch.trim());
  if (fOp !== 'all') params.set('transaction', fOp === 'bay3' ? 'sale' : (fOp === 'kira' ? 'rent' : fOp));
  return 'listings.html' + (params.toString() ? ('?' + params.toString()) : '');
}

function renderHomeLoading() {
  const grid = document.getElementById('homeGrid');
  if (!grid) return;
  grid.classList.remove('home-error-mode');
  grid.innerHTML = skeletonCardsHTML(HOME_PREVIEW_COUNT);
  const titleEl = document.getElementById('homeSectionTitle');
  if (titleEl) {
    const fr = currentLang === 'fr';
    titleEl.innerHTML = fr ? 'Chargement des annonces…' : 'جارٍ تحميل العقارات...';
  }
}

window.retryLoadAds = function() {
  dataLoadError = false;
  renderHomeLoading();
  startFirebaseListener();
};

function renderHomeError() {
  const grid = document.getElementById('homeGrid');
  if (!grid) return;
  const fr = currentLang === 'fr';
  grid.innerHTML = `<div class="home-status-box">
    <div class="icon">⚠️</div>
    <div>${fr ? "Impossible de charger les annonces." : 'تعذّر تحميل الإعلانات.'}</div>
    <button class="btn-retry" onclick="retryLoadAds()">${fr ? 'Réessayer' : 'إعادة المحاولة'}</button>
  </div>`;
}

function renderHomePreview() {
  const grid = document.getElementById('homeGrid');
  if (!grid) return;
  const fr = currentLang === 'fr';

  if (dataLoadError) { renderHomeError(); return; }
  if (!dataLoaded) { renderHomeLoading(); return; }

  const searchActive = homeSearchIsActive();
  const totalCount = searchActive ? displayList.length : DATA.length;
  const items = displayList.slice(0, HOME_PREVIEW_COUNT);

  // ── عنوان القسم + العداد ──
  const titleEl = document.getElementById('homeSectionTitle');
  const noteEl  = document.getElementById('homeSearchNote');
  const viewAllBtn = document.getElementById('homeViewAllBtn');
  if (titleEl) {
    titleEl.innerHTML = searchActive
      ? (fr ? `Résultats <span class="cnt">${totalCount}</span>` : `نتائج البحث <span class="cnt">${totalCount}</span>`)
      : (fr ? `Dernières annonces <span class="cnt">${totalCount}</span>` : `أحدث العقارات <span class="cnt">— ${totalCount} ${totalCount>1?'إعلانات':'إعلان'}</span>`);
  }
  if (noteEl) {
    noteEl.style.display = searchActive ? 'block' : 'none';
    noteEl.textContent = searchActive
      ? (fr ? `${totalCount} annonce(s) trouvée(s)` : `تم العثور على ${totalCount} عقار`)
      : '';
  }
  if (viewAllBtn) {
    viewAllBtn.href = buildListingsUrl();
    viewAllBtn.innerHTML = searchActive
      ? (fr ? 'Voir tous les résultats →' : 'عرض جميع النتائج ←')
      : (fr ? 'Voir toutes les annonces →' : 'عرض جميع العقارات ←');
  }

  if (items.length === 0) {
    const T = LANG[currentLang];
    grid.innerHTML = `<div class="home-status-box"><div class="icon">🔍</div><div>${T.noAds}</div><div style="font-size:12px;margin-top:4px">${T.noAdsSub}</div></div>`;
    return;
  }

  grid.innerHTML = items.map(ad => buildCardHTML(ad)).join('');
  requestAnimationFrame(() => updateHomeArrows());
}

// ── أسهم التنقل (كمبيوتر فقط) ──
window.homeScroll = function(dir) {
  const grid = document.getElementById('homeGrid');
  if (!grid) return;
  const card = grid.querySelector('.card');
  const step = card ? (card.getBoundingClientRect().width + 16) : 300;
  grid.scrollBy({ left: dir * step, behavior: 'smooth' });
};

function updateHomeArrows() {
  const grid = document.getElementById('homeGrid');
  const prevBtn = document.getElementById('homeArrowPrev');
  const nextBtn = document.getElementById('homeArrowNext');
  if (!grid || !prevBtn || !nextBtn) return;
  const hasOverflow = grid.scrollWidth > grid.clientWidth + 4;
  prevBtn.style.visibility = hasOverflow ? 'visible' : 'hidden';
  nextBtn.style.visibility = hasOverflow ? 'visible' : 'hidden';
}

// ── رابط "تجاوز الإعلانات" — ينقل المستخدم لتبويب الأسعار والنصائح ──
window.skipToGuides = function() {
  if (typeof switchTab === 'function') window.switchTab('prices');
};

// Global functions for HTML calls
let currentAdId = null;
let selectedRating = 0;

window.openD = function(id) {
  const ad = DATA.find(x => x.id === id);
  if (!ad) return;
  const T = LANG[currentLang];
  currentAdId = id;
  selectedRating = 0;

  // ── Schema ديناميكي SEO ──
  injectAdSchema(ad);

  // ── Meta Pixel: ViewContent ──
  if (typeof fbq !== 'undefined') {
    fbq('track', 'ViewContent', {
      content_name: ad.title || `${lPT(ad.type)} - ${lOP(ad.op)}`,
      content_category: lPT(ad.type),
      content_ids: [id],
      value: Number(ad.price) || 0,
      currency: 'DZD'
    });
  }

  document.getElementById('mtt').innerHTML = ad.title || `${lPT(ad.type)} - ${lOP(ad.op)}`;
  const TYPE_ICON_MODAL = {
    aadl:'🏗️', social:'🏠', lpp:'🏢', lsp:'🌿',
    villa:'🏡', maison:'🏠', appart:'🏢', residence:'🏙️', local:'🛍️'
  };
  const modalIcon = TYPE_ICON_MODAL[ad.type] || '🏘️';
  const TYPE_BG_MODAL = {
    aadl:'linear-gradient(135deg,#DBEAFE,#BFDBFE)',
    social:'linear-gradient(135deg,#EDE9FE,#DDD6FE)',
    lpp:'linear-gradient(135deg,#FEE2E2,#FECACA)',
    lsp:'linear-gradient(135deg,#D1FAE5,#A7F3D0)',
    villa:'linear-gradient(135deg,#FEF3C7,#FDE68A)',
    maison:'linear-gradient(135deg,#DCFCE7,#BBF7D0)',
    appart:'linear-gradient(135deg,#E0F2FE,#BAE6FD)',
    residence:'linear-gradient(135deg,#F3E8FF,#E9D5FF)',
    local:'linear-gradient(135deg,#FFE4E6,#FECDD3)',
  };
  if (ad.imgBase64) {
    document.getElementById('mimg').innerHTML =
      `<img src="${ad.imgBase64}" alt="${ad.title||''}" style="width:100%;height:100%;object-fit:cover"/>`;
    document.getElementById('mimg').style.background = '';
  } else {
    document.getElementById('mimg').style.background = TYPE_BG_MODAL[ad.type] || 'linear-gradient(135deg,#E8F5EE,#C8E6D9)';
    document.getElementById('mimg').innerHTML =
      `<div class="mimg-ph" style="background:transparent">${modalIcon}</div>`;
  }
  document.getElementById('mbg').innerHTML = `
    <span class="bt" style="background:${getTypeColor(ad.type)};position:static">${lPT(ad.type)}</span>
    <span class="bo" style="background:${getOpColor(ad.op)};position:static;color:#fff">${lOP(ad.op)}</span>
    <span style="background:${getStatusColor(ad.status)};color:white;padding:5px 13px;border-radius:50px">${lSTATUS(ad.status)}</span>
  `;
  document.getElementById('mds').innerHTML = ad.desc || (currentLang==='fr'?'Aucune description.':'لا يوجد وصف إضافي.');
  document.getElementById('msp').innerHTML = `
    <div class="mspec"><strong>📍 ${ad.commune||'—'}</strong>${T.specComm}</div>
    <div class="mspec"><strong>🛏️ ${ROOMS[ad.rooms]||ad.rooms||'?'}</strong>${T.specRooms}</div>
    <div class="mspec"><strong>📐 ${ad.area||'?'} m²</strong>${T.specArea}</div>
    <div class="mspec"><strong>💰 ${Number(ad.price).toLocaleString('fr-DZ')} DA</strong>${T.specPrice}</div>
    <div class="mspec"><strong>🔧 ${lCOND(ad.condition)}</strong>${T.specCond}</div>
    <div class="mspec"><strong>📅 ${ad.date||'—'}</strong>${T.specDate}</div>
  `;

  // Views
  document.getElementById('mviewsNum').textContent = ad.views || 0;

  // Avg rating badge
  const avgEl = document.getElementById('mavgStars');
  avgEl.innerHTML = ad.avgRating ? `⭐ ${Number(ad.avgRating).toFixed(1)} <span>(${ad.ratingCount||0})</span>` : '';

  // i18n labels
  document.getElementById('shareLinkLabel').textContent = currentLang==='fr'?'Copier le lien':'نسخ رابط الإعلان';
  document.getElementById('commentsTitle').textContent  = currentLang==='fr'?'Commentaires':'التعليقات';
  document.getElementById('ratingTitle').textContent    = currentLang==='fr'?'Avis':'التقييمات';
  document.getElementById('ratingCountLabel').textContent = currentLang==='fr'?'avis':'تقييم';
  document.getElementById('reviewStarsLabel').textContent = currentLang==='fr'?'Votre note':'اختر تقييمك';
  document.getElementById('reviewText').placeholder     = currentLang==='fr'?'Ajouter un commentaire (optionnel)...':'أضف تعليقاً (اختياري)...';
  document.getElementById('submitReviewBtn').textContent= currentLang==='fr'?"Envoyer l'avis":'إرسال التقييم';
  document.getElementById('commentName').placeholder    = currentLang==='fr'?'Votre nom (optionnel)':'اسمك (اختياري)';
  document.getElementById('commentText').placeholder    = currentLang==='fr'?'Ajouter un commentaire...':'أضف تعليقاً...';
  document.getElementById('commentBtn').textContent     = currentLang==='fr'?'Envoyer':'إرسال';
  document.getElementById('mcall').textContent          = T.callBtn;

  // Reset stars UI
  document.querySelectorAll('#reviewStars .star').forEach(s=>s.classList.remove('on'));
  document.getElementById('reviewText').value = '';

  // Social
  const safePhone = (ad.phone||'').replace(/'/g,'');
  const safeTitle = (ad.title||'').replace(/'/g,'').replace(/"/g,'');
  document.getElementById('socialBtns').innerHTML = `
    <button class="social-icon fb" onclick="openFB()">📘 Facebook</button>
    <button class="social-icon messenger" onclick="openMessenger()">💬 Messenger</button>
    <button class="social-icon whatsapp" onclick="openWA('${safePhone}','${safeTitle}')">💚 WhatsApp</button>
  `;
  document.getElementById('mcall').onclick = () => dial(ad.phone);
  document.getElementById('mwa').onclick   = () => openWA(ad.phone||'', ad.title||'');

  // Increment views
  updateDoc(doc(db,'clients',id),{views:(ad.views||0)+1}).catch(()=>{});

  loadRatings(id);
  loadComments(id);
  document.getElementById('dm').classList.add('open');
};

// ── Stars hover interaction ──
document.getElementById('reviewStars').addEventListener('mouseover', e => {
  const v = e.target.dataset.v;
  if (!v) return;
  document.querySelectorAll('#reviewStars .star').forEach(s => {
    s.classList.toggle('on', Number(s.dataset.v) >= Number(v));
  });
});
document.getElementById('reviewStars').addEventListener('mouseleave', () => {
  document.querySelectorAll('#reviewStars .star').forEach(s => {
    s.classList.toggle('on', Number(s.dataset.v) >= selectedRating);
  });
});
document.getElementById('reviewStars').addEventListener('click', e => {
  const v = e.target.dataset.v;
  if (!v) return;
  selectedRating = Number(v);
  document.querySelectorAll('#reviewStars .star').forEach(s => {
    s.classList.toggle('on', Number(s.dataset.v) >= selectedRating);
  });
});

// ── Load ratings from Firestore ──
async function loadRatings(adId) {
  try {
    const snap = await getDoc(doc(db,'ratings',adId));
    const data  = snap.exists() ? snap.data() : {};
    const reviews = data.reviews || [];
    const count = reviews.length;
    const avg   = count ? (reviews.reduce((s,r)=>s+r.rating,0)/count) : 0;

    document.getElementById('ratingAvgNum').textContent = count ? avg.toFixed(1) : '—';
    document.getElementById('ratingCount').textContent  = count;
    const stars = '★'.repeat(Math.round(avg)) + '☆'.repeat(5-Math.round(avg));
    document.getElementById('ratingAvgStars').textContent = count ? stars : '☆☆☆☆☆';

    // Bars 5→1
    const bars = [5,4,3,2,1].map(n => {
      const cnt = reviews.filter(r=>r.rating===n).length;
      const pct = count ? Math.round(cnt/count*100) : 0;
      return `<div class="rating-bar">
        <small>${n}</small>
        <div class="rating-bar-fill"><div class="rating-bar-fill-inner" style="width:${pct}%"></div></div>
        <small>${cnt}</small>
      </div>`;
    }).join('');
    document.getElementById('ratingBars').innerHTML = bars;
  } catch(e) { console.error(e); }
}

// ── Submit review ──
window.submitReview = async function() {
  if (!currentAdId || !selectedRating) {
    toast(currentLang==='fr'?'⚠️ Choisissez une note':'⚠️ اختر تقييماً أولاً','red');
    return;
  }
  const text = document.getElementById('reviewText').value.trim();
  const review = { rating: selectedRating, text, date: new Date().toLocaleDateString('fr-DZ') };
  try {
    const ref  = doc(db,'ratings',currentAdId);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data().reviews||[]) : [];
    const updated  = [...existing, review];
    const avg = updated.reduce((s,r)=>s+r.rating,0)/updated.length;
    await setDoc(ref,{reviews:updated},{merge:true});
    await updateDoc(doc(db,'clients',currentAdId),{avgRating:avg,ratingCount:updated.length});
    selectedRating = 0;
    document.querySelectorAll('#reviewStars .star').forEach(s=>s.classList.remove('on'));
    document.getElementById('reviewText').value = '';
    loadRatings(currentAdId);
    toast(currentLang==='fr'?'✅ Avis envoyé!':'✅ تم إرسال تقييمك!');
  } catch(e) { toast('❌ Error','red'); }
};

// ── Load comments ──
async function loadComments(adId) {
  const list = document.getElementById('commentsList');
  list.innerHTML = `<div class="no-comments">${currentLang==='fr'?'Chargement...':'جارٍ التحميل...'}</div>`;
  try {
    const snap = await getDoc(doc(db,'comments',adId));
    const comments = snap.exists() ? (snap.data().items||[]) : [];
    if (!comments.length) {
      list.innerHTML = `<div class="no-comments">${currentLang==='fr'?'Aucun commentaire encore.':'لا توجد تعليقات بعد.'}</div>`;
      return;
    }
    list.innerHTML = [...comments].reverse().map(c=>`
      <div class="comment-item">
        <div class="comment-meta">
          <span class="comment-author">👤 ${c.name||'مجهول'}</span>
          <span class="comment-date">${c.date||''}</span>
        </div>
        <div class="comment-text">${c.text}</div>
      </div>
    `).join('');
  } catch(e) { list.innerHTML = ''; }
}

// ── Submit comment ──
window.submitComment = async function() {
  if (!currentAdId) return;
  const name = document.getElementById('commentName').value.trim() || (currentLang==='fr'?'Anonyme':'مجهول');
  const text = document.getElementById('commentText').value.trim();
  if (!text) { toast(currentLang==='fr'?'⚠️ Écrivez un commentaire':'⚠️ اكتب تعليقاً أولاً','red'); return; }
  const item = { name, text, date: new Date().toLocaleDateString('fr-DZ') };
  try {
    const ref  = doc(db,'comments',currentAdId);
    const snap = await getDoc(ref);
    const items = snap.exists() ? (snap.data().items||[]) : [];
    await setDoc(ref,{items:[...items,item]},{merge:true});
    document.getElementById('commentText').value = '';
    loadComments(currentAdId);
    toast(currentLang==='fr'?'✅ Commentaire ajouté!':'✅ تم إضافة تعليقك!');
  } catch(e) { toast('❌ Error','red'); }
};

// ── Copy ad link ──
window.copyAdLink = function() {
  const T = LANG[currentLang];
  const link = `${location.origin}${location.pathname}#ad-${currentAdId}`;
  navigator.clipboard.writeText(link).then(()=>toast(T.toastCopied)).catch(()=>{
    const ad = DATA.find(x=>x.id===currentAdId);
    const text = ad?`${lPT(ad.type)} - ${ad.commune} - ${Number(ad.price).toLocaleString()} DA`:'Darna Immo';
    if(navigator.share) navigator.share({title:'Darna Immo',text,url:link});
    else toast(T.toastCopied);
  });
};

window.openFB = () => window.open('https://www.facebook.com/100090394402814/', '_blank');
window.openMessenger = () => window.open('https://m.me/100090394402814', '_blank');
window.openWA = function(phone, title) {
  // ── Meta Pixel: Contact ──
  if (typeof fbq !== 'undefined') fbq('track', 'Contact', { content_name: title });
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) clean = '213' + clean.slice(1);
  const msg = encodeURIComponent(`السلام عليكم، أنا مهتم بإعلانك "${title}" على دارنا إيمو.`);
  window.open(`https://wa.me/${clean}?text=${msg}`, '_blank');
};
window.shareNews = function() {
  const text = '🚨 خطأ قد يكلفك ملايين!\nقبل شراء أي عقار في الجزائر، تأكد من:\n📄 عقد الملكية\n📘 الدفتر العقاري\n📑 شهادة الحالة الرهنية\n🏗 شهادة المطابقة\n\nاكتشف المزيد على منصة دارنا إيمو 🏠';
  if (navigator.share) {
    navigator.share({ title: 'نصيحة عقارية – دارنا إيمو', text });
  } else {
    navigator.clipboard.writeText(text).then(() => toast('✅ تم نسخ النصيحة — شاركها مع أصدقائك!'));
  }
};
window.shareAd = function(id) {
  const T = LANG[currentLang];
  const ad = DATA.find(x => x.id === id);
  const text = ad ? `${lPT(ad.type)} - ${ad.commune} - ${Number(ad.price).toLocaleString()} DA` : 'Darna Immo';
  if (navigator.share) navigator.share({ title: 'Darna Immo', text });
  else navigator.clipboard.writeText(text).then(() => toast(T.toastCopied));
};
window.dial = function(num) {
  const T = LANG[currentLang];
  // ── Meta Pixel: Contact ──
  if (typeof fbq !== 'undefined') fbq('track', 'Contact');
  toast(`${T.toastCalling}${num}`);
  setTimeout(() => window.location.href = `tel:${num}`, 800);
};
window.tfav = function(e, id) {
  e.stopPropagation();
  const T = LANG[currentLang];
  const btn = document.getElementById(`fv${id}`);
  if (favs.has(id)) {
    favs.delete(id);
    if (btn) btn.innerText = '🤍';
    toast(T.toastFavRem);
  } else {
    favs.add(id);
    if (btn) btn.innerText = '❤️';
    toast(T.toastFavAdd);
  }
};
window.af = function() {
  fCommune = document.getElementById('fcm').value;
  priceMin = parseFloat(document.getElementById('pmin').value) || 0;
  priceMax = parseFloat(document.getElementById('pmax').value) || Infinity;
  applyFilters();
};
window.sl = function() { sortAndRender(); };
window.doSearch = function() {
  fSearch = document.getElementById('searchQ').value;
  // ── Meta Pixel: Search ──
  if (typeof fbq !== 'undefined' && fSearch.trim()) {
    fbq('track', 'Search', { search_string: fSearch.trim() });
  }
  applyFilters();
};
window.cm = function(id) { document.getElementById(id).classList.remove('open'); };
window.cov = function(e, id) { if (e.target.id === id) window.cm(id); };
window.toast = function(msg, cls) {
  const tst = document.getElementById('tst');
  tst.textContent = msg;
  tst.className = 'toast' + (cls ? ' ' + cls : '');
  tst.classList.add('show');
  setTimeout(() => tst.classList.remove('show'), 2800);
};
window.openPost = function() { document.getElementById('pm').classList.add('open'); };
window.sub = async function() {
  const T = LANG[currentLang];
  const loc = document.getElementById('pl').value.trim();
  const phone = document.getElementById('ph').value.trim();
  const priceRaw = document.getElementById('pp').value.trim();
  if (!loc || !phone || !priceRaw) {
    toast(T.toastFillAll, 'red');
    return;
  }
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 9 || cleanPhone.length > 13) {
    toast(T.toastBadPhone, 'red');
    return;
  }
  const btn = document.querySelector('.btn-submit');
  btn.disabled = true;
  btn.textContent = T.toastPosting;
  try {
      const docData = {
        type: document.getElementById('pt').value,
        op: document.getElementById('po').value,
        rooms: document.getElementById('pr').value,
        condition: document.getElementById('pcond').value,
        status: document.getElementById('pstat').value,
        title: `${PT[document.getElementById('pt').value]} - ${loc}`,
        commune: loc.split(/[-–]/)[0].trim(),
        area: parseInt(document.getElementById('pa').value) || 0,
        price: parseInt(priceRaw) || 0,
        desc: document.getElementById('pd').value || '',
        phone: phone,
        date: new Date().toISOString().slice(0, 10),
        createdAt: Date.now(),
        views: 0
      };
      if (uploadedImgBase64) docData.imgBase64 = uploadedImgBase64;
      await addDoc(adsCol, docData);
    window.cm('pm');
    document.getElementById('pl').value = '';
    document.getElementById('ph').value = '';
    document.getElementById('pp').value = '';
    document.getElementById('pa').value = '';
    document.getElementById('pd').value = '';
    resetImgUpload();
    toast(T.toastPosted);
  } catch (e) {
    toast(T.toastFailed, 'red');
  }
  btn.disabled = false;
  btn.textContent = T.submitBtn;
};

// ══════════════════════════════════════════════════════
// FILTER SYSTEM – نظام فلاتر موحد بدون أخطاء
// ══════════════════════════════════════════════════════
//
// مبدأ التصميم:
//   • State واحد مركزي (fTypes, fOp, fRooms …)
//   • دالة واحدة syncChipUI() تُحدّث مظهر كل الأزرار (Sidebar + Drawer + Strip)
//   • كل زر عند الضغط: يُعدّل State ثم يستدعي syncChipUI() + applyFilters()
//   • لا cloneNode، لا chip.click()، لا تعارض
//
// ──────────────────────────────────────────────────────

// ── تحديث مظهر كل الأزرار بناءً على State الحالي ──
function syncChipUI() {
  // نوع العقار – متعدد الاختيار (toggle)
  document.querySelectorAll('[data-group="type"]').forEach(btn => {
    btn.classList.toggle('on', fTypes.has(btn.dataset.val));
  });
  // "الكل" لنوع العقار: مضاء إذا كل الأنواع مختارة
  const allTypesSelected = Object.keys(PT).every(k => fTypes.has(k));
  document.querySelectorAll('[data-group="type-all"]').forEach(btn => {
    btn.classList.toggle('on', allTypesSelected);
  });

  // نوع العملية – اختيار واحد
  document.querySelectorAll('[data-group="op"]').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.val === fOp);
  });
  document.querySelectorAll('[data-group="op-all"]').forEach(btn => {
    btn.classList.toggle('on', fOp === 'all');
  });

  // الغرف – اختيار واحد
  document.querySelectorAll('[data-group="rooms"]').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.val === fRooms);
  });
  document.querySelectorAll('[data-group="rooms-all"]').forEach(btn => {
    btn.classList.toggle('on', fRooms === 'all');
  });

  // الحالة – اختيار واحد
  document.querySelectorAll('[data-group="cond"]').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.val === fCondition);
  });
  document.querySelectorAll('[data-group="cond-all"]').forEach(btn => {
    btn.classList.toggle('on', fCondition === 'all');
  });

  // حالة الإعلان – اختيار واحد
  document.querySelectorAll('[data-group="status"]').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.val === fStatus);
  });
  document.querySelectorAll('[data-group="status-all"]').forEach(btn => {
    btn.classList.toggle('on', fStatus === 'all');
  });

  // شريط الموبايل
  document.querySelectorAll('[data-group="strip"]').forEach(btn => {
    const v = btn.dataset.val;
    if (!v) { // زر "الكل"
      btn.classList.toggle('on', allTypesSelected);
    } else {
      btn.classList.toggle('on', fTypes.has(v) && fTypes.size === 1 && [...fTypes][0] === v);
    }
  });
}

// ── صانع زر عام ──
function makeChip(text, groupAttr, valAttr, onClickFn, extraClass='') {
  const btn = document.createElement('button');
  btn.className = 'chip' + (extraClass ? ' ' + extraClass : '');
  btn.dataset.group = groupAttr;
  if (valAttr !== null) btn.dataset.val = valAttr;
  btn.innerText = text;
  btn.addEventListener('click', () => { onClickFn(); syncChipUI(); applyFilters(); });
  return btn;
}

// ── بناء الفلاتر في Sidebar والـ Drawer (نفس الأزرار، نفس الـ group) ──
function buildFilterSection(typeDiv, opDiv, roomDiv, condDiv, statusDiv) {
  if (!typeDiv) return;

  // ── نوع العقار ──
  // "الكل" لنوع العقار: يُعيد تحديد كل الأنواع
  const typeAllBtn = makeChip('الكل', 'type-all', null, () => {
    Object.keys(PT).forEach(k => fTypes.add(k));
  });
  typeDiv.appendChild(typeAllBtn);

  Object.keys(PT).forEach(t => {
    const btn = makeChip(PT[t], 'type', t, () => {
      if (fTypes.has(t) && fTypes.size > 1) fTypes.delete(t);
      else if (!fTypes.has(t)) fTypes.add(t);
      // إذا أصبح لا شيء محدداً، أعد اختيار هذا النوع
      if (fTypes.size === 0) fTypes.add(t);
    });
    typeDiv.appendChild(btn);
  });

  // ── نوع العملية ──
  if (opDiv) {
    opDiv.appendChild(makeChip('الكل', 'op-all', null, () => { fOp = 'all'; }));
    Object.keys(OP).forEach(o => {
      opDiv.appendChild(makeChip(OP[o], 'op', o, () => { fOp = fOp === o ? 'all' : o; }));
    });
  }

  // ── الغرف ──
  if (roomDiv) {
    roomDiv.appendChild(makeChip('الكل', 'rooms-all', null, () => { fRooms = 'all'; }));
    Object.keys(ROOMS).forEach(r => {
      roomDiv.appendChild(makeChip(ROOMS[r], 'rooms', r, () => { fRooms = fRooms === r ? 'all' : r; }));
    });
  }

  // ── حالة العقار ──
  if (condDiv) {
    condDiv.appendChild(makeChip('الكل', 'cond-all', null, () => { fCondition = 'all'; }));
    Object.keys(COND).forEach(c => {
      condDiv.appendChild(makeChip(COND[c], 'cond', c, () => { fCondition = fCondition === c ? 'all' : c; }));
    });
  }

  // ── حالة الإعلان ──
  if (statusDiv) {
    statusDiv.appendChild(makeChip('الكل', 'status-all', null, () => { fStatus = 'all'; }));
    Object.keys(STATUS).forEach(s => {
      statusDiv.appendChild(makeChip(STATUS[s], 'status', s, () => { fStatus = fStatus === s ? 'all' : s; }));
    });
  }
}

function initFilters() {
  // ── Sidebar ──
  buildFilterSection(
    document.getElementById('typeChips'),
    document.getElementById('opChips'),
    document.getElementById('roomChips'),
    document.getElementById('conditionChips'),
    document.getElementById('statusChips')
  );

  // ── Mobile Drawer (نفس المنطق، نفس الـ data-group ← نفس syncChipUI) ──
  buildFilterSection(
    document.getElementById('typeChipsMob'),
    document.getElementById('opChipsMob'),
    document.getElementById('roomChipsMob'),
    document.getElementById('conditionChipsMob'),
    document.getElementById('statusChipsMob')
  );

  // ── Mobile Strip (شريط سريع فوق الشبكة) ──
  const mobStrip = document.getElementById('mobStrip');
  if (mobStrip) {
    const stripAll = makeChip('الكل', 'strip', null, () => {
      Object.keys(PT).forEach(k => fTypes.add(k));
    });
    mobStrip.appendChild(stripAll);

    ['aadl','social','lpp','lsp','villa','maison','appart','local'].forEach(t => {
      const btn = makeChip(PT[t], 'strip', t, () => {
        fTypes = new Set([t]);
      });
      btn.style.whiteSpace = 'nowrap';
      btn.style.flexShrink = '0';
      mobStrip.appendChild(btn);
    });

    // ── فاصل مرئي ──
    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px;background:var(--border);flex-shrink:0;align-self:stretch;margin:4px 0';
    mobStrip.appendChild(sep);

    // ── بيع / كراء كفلتر عملية سريع ──
    const opBtns = [];
    [{v:'all',ar:'🔄 الكل'},{v:'bay3',ar:'🏷️ بيع'},{v:'kira',ar:'🔑 كراء'}].forEach(({v,ar}) => {
      const btn = document.createElement('button');
      btn.className = 'chip' + (v === 'all' ? ' on' : '');
      btn.style.cssText = 'white-space:nowrap;flex-shrink:0';
      btn.innerText = ar;
      btn.dataset.opval = v;
      btn.addEventListener('click', () => {
        fOp = v;
        opBtns.forEach(b => b.classList.toggle('on', b.dataset.opval === v));
        applyFilters();
      });
      opBtns.push(btn);
      mobStrip.appendChild(btn);
    });
  }

  // ── تحديث لغة الأزرار عند تغيير اللغة ──
  // (يتم عبر applyTranslation الذي يستدعي syncFilterLabels)

  // حالة البداية: كل شيء مفعّل
  syncChipUI();
}

// ── تحديث نصوص الأزرار عند تغيير اللغة ──
function syncFilterLabels() {
  const T = LANG[currentLang];
  const allLabel = T.all;

  document.querySelectorAll('[data-group="type-all"]').forEach(b => { b.innerText = allLabel; });
  document.querySelectorAll('[data-group="type"]').forEach(b => { b.innerText = lPT(b.dataset.val); });
  document.querySelectorAll('[data-group="op-all"]').forEach(b => { b.innerText = allLabel; });
  document.querySelectorAll('[data-group="op"]').forEach(b => { b.innerText = lOP(b.dataset.val); });
  document.querySelectorAll('[data-group="rooms-all"]').forEach(b => { b.innerText = allLabel; });
  document.querySelectorAll('[data-group="cond-all"]').forEach(b => { b.innerText = allLabel; });
  document.querySelectorAll('[data-group="cond"]').forEach(b => {
    b.innerText = b.dataset.val === 'neuf' ? T.condNeuf : T.condUsed;
  });
  document.querySelectorAll('[data-group="status-all"]').forEach(b => { b.innerText = allLabel; });
  document.querySelectorAll('[data-group="status"]').forEach(b => {
    if (b.dataset.val === 'dispo')    b.innerText = T.statDispo;
    if (b.dataset.val === 'reserved') b.innerText = T.statReserved;
    if (b.dataset.val === 'sold')     b.innerText = T.statSold;
    if (b.dataset.val === 'rented')   b.innerText = T.statRented;
  });
  document.querySelectorAll('[data-group="strip"]').forEach(b => {
    if (!b.dataset.val) b.innerText = allLabel;
    else b.innerText = lPT(b.dataset.val);
  });
}

// ── شاشة الترحيب ──
window.showWelcome = function() {
  const ws = document.getElementById('welcomeScreen');
  if (!ws) return;
  ws.style.display = 'flex';
  ws.classList.remove('hide');
  // إعادة تشغيل الأنيميشن
  ws.style.animation = 'none';
  ws.offsetHeight; // reflow
  ws.style.animation = '';
};

window.chooseOp = function(op) {
  // تطبيق الفلتر المختار
  if (op !== 'all') {
    fOp = op;
    // مزامنة أزرار العملية في الفلاتر
    document.querySelectorAll('[data-group="op"]').forEach(b => {
      b.classList.toggle('on', b.dataset.val === op);
    });
    document.querySelectorAll('[data-group="op-all"]').forEach(b => b.classList.remove('on'));
  }
  // إخفاء الشاشة بأنيميشن
  const ws = document.getElementById('welcomeScreen');
  if (ws) {
    ws.classList.add('hide');
    setTimeout(() => { ws.style.display = 'none'; }, 400);
  }
  // تطبيق الفلاتر
  applyFilters();
};
window.openFilterDrawer = function() {
  document.getElementById('filterDrawer').classList.add('open');
  document.getElementById('filterOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
};
window.closeFilterDrawer = function() {
  document.getElementById('filterDrawer').classList.remove('open');
  document.getElementById('filterOverlay').classList.remove('open');
  document.body.style.overflow = '';
};
window.syncMobFilter = function(type, val) {
  if (type === 'commune') {
    fCommune = val;
    const mainSel = document.getElementById('fcm');
    if (mainSel) mainSel.value = val;
    applyFilters();
  }
};
window.applyMobFilters = function() {
  fCommune = document.getElementById('fcmMob').value;
  priceMin = parseFloat(document.getElementById('pminMob').value) || 0;
  priceMax = parseFloat(document.getElementById('pmaxMob').value) || Infinity;
  // مزامنة Sidebar
  const mainSel = document.getElementById('fcm');
  if (mainSel) mainSel.value = fCommune;
  const pminEl = document.getElementById('pmin');
  const pmaxEl = document.getElementById('pmax');
  if (pminEl) pminEl.value = document.getElementById('pminMob').value;
  if (pmaxEl) pmaxEl.value = document.getElementById('pmaxMob').value;
  applyFilters();
  closeFilterDrawer();
};

// Populate select options
function initSelects() {
  const ptSelect = document.getElementById('pt');
  const poSelect = document.getElementById('po');
  Object.keys(PT).forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.dataset.val = t;
    opt.innerText = PT[t];
    ptSelect.appendChild(opt);
  });
  Object.keys(OP).forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.dataset.val = o;
    opt.innerText = OP[o];
    poSelect.appendChild(opt);
  });
}

// Firebase listener
function startFirebaseListener() {
  if (PAGE_MODE === 'home') renderHomeLoading();
  const q = query(adsCol, orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    DATA = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    dataLoaded = true;
    dataLoadError = false;
    applyFilters();
  }, (error) => {
    console.error("Firebase error:", error);
    dataLoadError = true;
    toast(LANG[currentLang].toastDbErr, "red");
    if (PAGE_MODE === 'home') renderHomeError();
  });
}

// ── Bilingual translations ──────────────────────────────────────────────────
const LANG = {
  ar: {
    dir: 'rtl', htmlLang: 'ar',
    heroTitle: 'ابحث عن <span>دارك</span> هنا',
    heroSub: 'جميع إعلانات العقارات في الجزائر العاصمة',
    searchPlaceholder: 'ابحث بالحي أو البلدية...',
    searchBtn: '🔍 بحث',
    tabAds: 'الإعلانات', tabPrices: 'الأسعار', tabArticles: 'المقالات', tabLegal: 'النصائح القانونية',
    statAds: 'إعلان نشط', statComm: 'بلدية', statAadl: 'حي LPP', statAlger: 'الجزائر العاصمة',
    tagVillaHero: '🏛️ فيلا', tagMaisonHero: '🏡 منزل', tagLocalHero: '🛍️ محل', tagResidenceHero: '🏫 ريزيدونس',
    tagVilla: '🏡 فيلا · منزل', tagLocal: '🛍️ محل · ريزيدنس',
    fabLabel: 'أضف إعلانك مجاناً',
    postBtnLabel: 'نشر إعلان', all: 'الكل',
    mobFilterBtn: '🔍 فلاتر البحث',
    drawerTitle: '🔍 فلاتر البحث',
    filterType: '🏷️ نوع العقار', filterOp: '🤝 نوع المعاملة',
    filterRooms: '🛏️ عدد الغرف', filterCond: '🔧 حالة العقار',
    filterStatus: '📢 حالة الإعلان', filterComm: '📍 البلدية',
    filterPrice: '💰 نطاق السعر (دج)',
    allComm: 'كل البلديات', priceFrom: 'من', priceTo: 'إلى',
    applyBtn: '✅ تطبيق الفلاتر',
    sortNew: 'الأحدث أولاً', sortCheap: 'الأرخص أولاً', sortExp: 'الأغلى أولاً',
    showing: 'عرض', adWord: 'إعلان',
    callBtn: '📞 اتصل الآن', waBtn: 'WhatsApp',
    shareLinkLabel: 'نسخ رابط الإعلان',
    ratingTitle: 'التقييمات', ratingCountLabel: 'تقييم',
    reviewStarsLabel: 'اختر تقييمك', reviewTextPh: 'أضف تعليقاً (اختياري)...',
    submitReviewBtn: 'إرسال التقييم',
    commentsTitle: 'التعليقات',
    commentNamePh: 'اسمك (اختياري)', commentTextPh: 'أضف تعليقاً...', commentBtn: 'إرسال',
    postTitle: '📣 نشر إعلان جديد', postSub: 'مجاني – بدون تسجيل – فوري',
    fldType: 'نوع العقار', fldOp: 'المعاملة', fldRooms: 'الغرف',
    fldArea: 'المساحة (م²)', fldAreaPh: 'مثال: 85',
    fldCond: 'حالة العقار', fldStatus: 'حالة الإعلان',
    fldLoc: 'البلدية والحي', fldLocPh: 'مثال: سيدي عبد الله – حي 3000 مسكن',
    fldPrice: 'السعر (دج)', fldPricePh: 'مثال: 40000',
    fldPhone: 'رقم الهاتف', fldPhonePh: '07XX XX XX XX',
    fldDesc: 'وصف العقار', fldDescPh: 'الطابق، التوجيه، المرافق، ملاحظات...',
    submitBtn: '🚀 نشر الإعلان مجاناً',
    toastPosted: '✅ تم نشر إعلانك بنجاح!',
    toastFavAdd: '❤️ أضيفت للمفضلة', toastFavRem: 'تمت الإزالة',
    toastCopied: '📋 تم النسخ!', toastCalling: '📞 جارٍ الاتصال بـ ',
    toastFillAll: '⚠️ يرجى ملء الحقول الضرورية',
    toastBadPhone: '⚠️ رقم الهاتف غير صحيح',
    toastPosting: '⏳ جارٍ النشر...',
    toastFailed: '❌ فشل النشر',
    toastDbErr: '⚠️ مشكلة في الاتصال بقاعدة البيانات',
    specComm: 'البلدية', specRooms: 'الغرف', specArea: 'المساحة',
    specPrice: 'السعر', specCond: 'الحالة', specDate: 'تاريخ النشر',
    noAds: 'لا توجد إعلانات', noAdsSub: 'جرّب تغيير معايير البحث',
    condNeuf: 'جديد', condUsed: 'مستعمل',
    statDispo: 'متوفر', statReserved: 'محجوز', statSold: 'تم البيع', statRented: 'تم الكراء',
    footerText: 'منصة الجزائر العاصمة للعقارات والسكن الاجتماعي',
    privacy: 'سياسة الخصوصية', terms: 'شروط الاستخدام',
    contact: 'اتصل بنا', about: 'حول الموقع',
    pages: {
      privacy: {
        title: '🔒 سياسة الخصوصية',
        content: `<h3 style="margin-bottom:10px">جمع البيانات</h3>
          <p>نجمع فقط المعلومات التي تقدمها طوعياً عند نشر إعلان (رقم الهاتف، الموقع، وصف العقار). لا نجمع أي بيانات شخصية أخرى دون موافقتك.</p>
          <h3 style="margin:14px 0 8px">استخدام البيانات</h3>
          <p>تُستخدم البيانات حصرياً لعرض إعلانك على المنصة والتواصل بين البائعين والمشترين. لا نبيع أي بيانات لأطراف ثالثة.</p>
          <h3 style="margin:14px 0 8px">الكوكيز</h3>
          <p>نستخدم Firebase لإدارة قاعدة البيانات. قد تُخزَّن بعض البيانات محلياً لتحسين تجربة المستخدم.</p>
          <h3 style="margin:14px 0 8px">حذف البيانات</h3>
          <p>يمكنك طلب حذف إعلانك في أي وقت عبر التواصل معنا على: <strong>contact@darnaimmo.dz</strong></p>`
      },
      terms: {
        title: '📋 شروط الاستخدام',
        content: `<h3 style="margin-bottom:10px">شروط النشر</h3>
          <p>يُسمح فقط بنشر إعلانات عقارية حقيقية تخص الجزائر العاصمة. يُمنع نشر محتوى مضلل أو احتيالي.</p>
          <h3 style="margin:14px 0 8px">المسؤولية</h3>
          <p>دارنا إيمو منصة وسيطة فقط ولا تتحمل أي مسؤولية عن صحة المعلومات المنشورة من طرف المستخدمين.</p>
          <h3 style="margin:14px 0 8px">الإعلانات المحظورة</h3>
          <p>يُحظر نشر: إعلانات وهمية، أرقام هواتف خاطئة، أسعار مضللة، أو أي محتوى مخالف للقانون الجزائري.</p>
          <h3 style="margin:14px 0 8px">الحقوق</h3>
          <p>نحتفظ بحق إزالة أي إعلان يخالف هذه الشروط دون إشعار مسبق.</p>`
      },
      contact: {
        title: '📬 اتصل بنا',
        content: `<p style="margin-bottom:12px">نحن هنا للمساعدة! تواصل معنا عبر:</p>
          <p>📧 البريد الإلكتروني: <strong>contact@darnaimmo.dz</strong></p>
          <p style="margin-top:10px">📘 فيسبوك: <a href="https://www.facebook.com/100090394402814/" target="_blank" style="color:#1877F2">صفحة دارنا إيمو</a></p>
          <p style="margin-top:10px">⏰ أوقات الرد: الأحد – الخميس، 9:00 – 17:00</p>
          <p style="margin-top:16px;color:#888;font-size:13px">للإبلاغ عن إعلان مشبوه أو طلب حذف إعلانك، أرسل لنا رسالة مع رابط الإعلان.</p>`
      },
      about: {
        title: 'ℹ️ حول الموقع',
        content: `<p style="margin-bottom:12px"><strong>دارنا إيمو</strong> منصة عقارية جزائرية مجانية متخصصة في الجزائر العاصمة.</p>
          <p>تتيح للمواطنين نشر وتصفح إعلانات السكن الاجتماعي (AADL، Social، LPP)، الشقق، الفيلات، المنازل، والمحلات التجارية.</p>
          <h3 style="margin:14px 0 8px">مميزاتنا</h3>
          <p>✅ نشر مجاني بدون تسجيل<br>✅ تحديث فوري للإعلانات<br>✅ تواصل مباشر عبر WhatsApp والهاتف<br>✅ فلاتر متقدمة للبحث</p>
          <p style="margin-top:14px;color:#888;font-size:13px">الإصدار 6.0 · © ${new Date().getFullYear()} Darna Immo · جميع الحقوق محفوظة</p>`
      }
    }
  },
  fr: {
    dir: 'rtl', htmlLang: 'ar',
    heroTitle: 'Trouvez votre <span>bien</span> ici',
    heroSub: 'Toutes les annonces immobilières d\'Alger',
    searchPlaceholder: 'Rechercher par quartier ou commune...',
    searchBtn: '🔍 Chercher',
    tabAds: 'Annonces', tabPrices: 'Prix', tabArticles: 'Articles', tabLegal: 'Conseils juridiques',
    statAds: 'annonce active', statComm: 'commune', statAadl: 'quartier LPP', statAlger: 'Alger',
    tagVillaHero: '🏛️ Villa', tagMaisonHero: '🏡 Maison', tagLocalHero: '🛍️ Local', tagResidenceHero: '🏫 Résidence',
    tagVilla: '🏡 Villa · Maison', tagLocal: '🛍️ Local · Résidence',
    fabLabel: 'Publier une annonce',
    postBtnLabel: 'Publier', all: 'Tous',
    mobFilterBtn: '🔍 Filtres de recherche',
    drawerTitle: '🔍 Filtres de recherche',
    filterType: '🏷️ Type de bien', filterOp: '🤝 Type d\'opération',
    filterRooms: '🛏️ Nb. de pièces', filterCond: '🔧 État du bien',
    filterStatus: '📢 Statut annonce', filterComm: '📍 Commune',
    filterPrice: '💰 Fourchette de prix (DA)',
    allComm: 'Toutes les communes', priceFrom: 'De', priceTo: 'À',
    applyBtn: '✅ Appliquer les filtres',
    sortNew: 'Plus récents', sortCheap: 'Moins chers', sortExp: 'Plus chers',
    showing: 'Affichage de', adWord: 'annonce(s)',
    callBtn: '📞 Appeler maintenant', waBtn: 'WhatsApp',
    shareLinkLabel: 'Copier le lien',
    ratingTitle: 'Avis', ratingCountLabel: 'avis',
    reviewStarsLabel: 'Votre note', reviewTextPh: 'Ajouter un commentaire (optionnel)...',
    submitReviewBtn: "Envoyer l'avis",
    commentsTitle: 'Commentaires',
    commentNamePh: 'Votre nom (optionnel)', commentTextPh: 'Ajouter un commentaire...', commentBtn: 'Envoyer',
    postTitle: '📣 Publier une annonce', postSub: 'Gratuit – Sans inscription – Immédiat',
    fldType: 'Type de bien', fldOp: 'Opération', fldRooms: 'Pièces',
    fldArea: 'Surface (m²)', fldAreaPh: 'Ex: 85',
    fldCond: 'État', fldStatus: 'Statut',
    fldLoc: 'Commune et quartier', fldLocPh: 'Ex: Sidi Abdallah – Cité 3000 logements',
    fldPrice: 'Prix (DA)', fldPricePh: 'Ex: 40000',
    fldPhone: 'Téléphone', fldPhonePh: '07XX XX XX XX',
    fldDesc: 'Description du bien', fldDescPh: 'Étage, orientation, équipements, remarques...',
    submitBtn: '🚀 Publier gratuitement',
    toastPosted: '✅ Annonce publiée avec succès!',
    toastFavAdd: '❤️ Ajouté aux favoris', toastFavRem: 'Retiré des favoris',
    toastCopied: '📋 Copié!', toastCalling: '📞 Appel en cours vers ',
    toastFillAll: '⚠️ Veuillez remplir les champs obligatoires',
    toastBadPhone: '⚠️ Numéro de téléphone invalide',
    toastPosting: '⏳ Publication en cours...',
    toastFailed: '❌ Échec de la publication',
    toastDbErr: '⚠️ Problème de connexion à la base de données',
    specComm: 'Commune', specRooms: 'Pièces', specArea: 'Surface',
    specPrice: 'Prix', specCond: 'État', specDate: 'Date de publication',
    noAds: 'Aucune annonce', noAdsSub: 'Essayez de modifier vos critères de recherche',
    condNeuf: 'Neuf', condUsed: 'Occasion',
    statDispo: 'Disponible', statReserved: 'Réservé', statSold: 'Vendu', statRented: 'Loué',
    footerText: 'La plateforme immobilière d\'Alger',
    privacy: 'Politique de confidentialité', terms: 'Conditions d\'utilisation',
    contact: 'Nous contacter', about: 'À propos',
    pages: {
      privacy: {
        title: '🔒 Politique de confidentialité',
        content: `<h3 style="margin-bottom:10px">Collecte des données</h3>
          <p>Nous collectons uniquement les informations que vous fournissez volontairement lors de la publication d'une annonce (numéro de téléphone, localisation, description). Aucune autre donnée personnelle n'est collectée sans votre consentement.</p>
          <h3 style="margin:14px 0 8px">Utilisation des données</h3>
          <p>Les données sont utilisées exclusivement pour afficher votre annonce et faciliter le contact entre vendeurs et acheteurs. Nous ne vendons aucune donnée à des tiers.</p>
          <h3 style="margin:14px 0 8px">Cookies</h3>
          <p>Nous utilisons Firebase pour gérer la base de données. Certaines données peuvent être stockées localement pour améliorer l'expérience utilisateur.</p>
          <h3 style="margin:14px 0 8px">Suppression des données</h3>
          <p>Vous pouvez demander la suppression de votre annonce à tout moment en nous contactant: <strong>contact@darnaimmo.dz</strong></p>`
      },
      terms: {
        title: '📋 Conditions d\'utilisation',
        content: `<h3 style="margin-bottom:10px">Conditions de publication</h3>
          <p>Seules les annonces immobilières réelles concernant la wilaya d'Alger sont autorisées. Tout contenu trompeur ou frauduleux est strictement interdit.</p>
          <h3 style="margin:14px 0 8px">Responsabilité</h3>
          <p>Darna Immo est une plateforme intermédiaire et n'est pas responsable de l'exactitude des informations publiées par les utilisateurs.</p>
          <h3 style="margin:14px 0 8px">Annonces interdites</h3>
          <p>Il est interdit de publier: des annonces fictives, de faux numéros de téléphone, des prix trompeurs, ou tout contenu contraire à la législation algérienne.</p>
          <h3 style="margin:14px 0 8px">Droits</h3>
          <p>Nous nous réservons le droit de supprimer toute annonce ne respectant pas ces conditions sans préavis.</p>`
      },
      contact: {
        title: '📬 Nous contacter',
        content: `<p style="margin-bottom:12px">Nous sommes là pour vous aider ! Contactez-nous via:</p>
          <p>📧 Email: <strong>contact@darnaimmo.dz</strong></p>
          <p style="margin-top:10px">📘 Facebook: <a href="https://www.facebook.com/100090394402814/" target="_blank" style="color:#1877F2">Page Darna Immo</a></p>
          <p style="margin-top:10px">⏰ Heures de réponse: Dimanche – Jeudi, 9h00 – 17h00</p>
          <p style="margin-top:16px;color:#888;font-size:13px">Pour signaler une annonce suspecte ou demander la suppression de la vôtre, envoyez-nous un message avec le lien de l'annonce.</p>`
      },
      about: {
        title: 'ℹ️ À propos',
        content: `<p style="margin-bottom:12px"><strong>Darna Immo</strong> est une plateforme immobilière algérienne gratuite, spécialisée dans la wilaya d'Alger.</p>
          <p>Elle permet aux citoyens de publier et consulter des annonces pour le logement social (AADL, Social, LPP), appartements, villas, maisons et locaux commerciaux.</p>
          <h3 style="margin:14px 0 8px">Nos atouts</h3>
          <p>✅ Publication gratuite sans inscription<br>✅ Mise à jour instantanée<br>✅ Contact direct via WhatsApp et téléphone<br>✅ Filtres de recherche avancés</p>
          <p style="margin-top:14px;color:#888;font-size:13px">Version 6.0 · © ${new Date().getFullYear()} Darna Immo · Tous droits réservés</p>`
      }
    }
  }
};

function applyTranslation(lang) {
  const T = LANG[lang];
  currentLang = lang;

  // ── Hero (قد لا يكون موجوداً في listings.html) ──
  const heroTitleEl = document.getElementById('heroTitle'); if (heroTitleEl) heroTitleEl.innerHTML = T.heroTitle;
  const heroSubEl = document.getElementById('heroSub'); if (heroSubEl) heroSubEl.textContent = T.heroSub;
  const searchQEl = document.getElementById('searchQ'); if (searchQEl) searchQEl.placeholder = T.searchPlaceholder;
  const searchBtnEl = document.getElementById('searchBtn'); if (searchBtnEl) searchBtnEl.textContent = T.searchBtn;

  // ── Hero tags ──
  const tagLPPEl = document.getElementById('tagLPP'); if (tagLPPEl) tagLPPEl.textContent = '🏪 LPP';
  const tagSocialEl = document.getElementById('tagSocial'); if (tagSocialEl) tagSocialEl.textContent = '🏘️ Social';
  const tagVilla2El = document.getElementById('tagVilla2'); if (tagVilla2El) tagVilla2El.textContent = T.tagVillaHero;
  const tagMaisonEl = document.getElementById('tagMaison'); if (tagMaisonEl) tagMaisonEl.textContent = T.tagMaisonHero;
  const tagLocal2El = document.getElementById('tagLocal2'); if (tagLocal2El) tagLocal2El.textContent = T.tagLocalHero;
  const tagAADLEl = document.getElementById('tagAADL'); if (tagAADLEl) tagAADLEl.textContent = '🏢 AADL';
  const tagResidenceEl = document.getElementById('tagResidence'); if (tagResidenceEl) tagResidenceEl.textContent = T.tagResidenceHero;

  // ── Tab labels ──
  const tabAdsEl = document.getElementById('tabLabelAds'); if (tabAdsEl) tabAdsEl.textContent = T.tabAds;
  const tabPricesEl = document.getElementById('tabLabelPrices'); if (tabPricesEl) tabPricesEl.textContent = T.tabPrices;
  const tabArticlesEl = document.getElementById('tabLabelArticles'); if (tabArticlesEl) tabArticlesEl.textContent = T.tabArticles;
  const tabLegalEl = document.getElementById('tabLabelLegal'); if (tabLegalEl) tabLegalEl.textContent = T.tabLegal;

  // ── Stats ──
  const statL0El = document.getElementById('statL0'); if (statL0El) statL0El.textContent = T.statAds;
  const statL1El = document.getElementById('statL1'); if (statL1El) statL1El.textContent = T.statComm;
  const statL2El = document.getElementById('statL2'); if (statL2El) statL2El.textContent = T.statAadl;
  const statL3El = document.getElementById('statL3'); if (statL3El) statL3El.textContent = T.statAlger;

  // ── Header post button ──
  const postBtnSpan = document.querySelector('#postBtn span'); if (postBtnSpan) postBtnSpan.textContent = T.postBtnLabel;

  // ── Lang button ──
  const langBtnEl = document.getElementById('langBtn'); if (langBtnEl) langBtnEl.textContent = lang === 'ar' ? 'FR' : 'عربي';

  // ── FAB ──
  const fabLabel = document.getElementById('fabLabel');
  if (fabLabel) fabLabel.textContent = T.fabLabel;

  // ── Mobile filter button ──
  const mobFilterBtn = document.getElementById('mobFilterBtn');
  if (mobFilterBtn) mobFilterBtn.textContent = T.mobFilterBtn;

  // ── Sidebar filter titles ──
  const sidebarMap = {
    sidebarFType: T.filterType, sidebarFOp: T.filterOp,
    sidebarFRooms: T.filterRooms, sidebarFCond: T.filterCond,
    sidebarFStatus: T.filterStatus, sidebarFComm: T.filterComm,
    sidebarFPrice: T.filterPrice
  };
  Object.entries(sidebarMap).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = text;
  });

  // ── Filter drawer title & section titles ──
  const drawerTitle = document.getElementById('drawerTitle');
  if (drawerTitle) drawerTitle.textContent = T.drawerTitle;
  const drawerMap = {
    drawerFType: T.filterType, drawerFOp: T.filterOp,
    drawerFRooms: T.filterRooms, drawerFCond: T.filterCond,
    drawerFStatus: T.filterStatus, drawerFComm: T.filterComm,
    drawerFPrice: T.filterPrice
  };
  Object.entries(drawerMap).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = text;
  });

  // ── كل نصوص الـ chips (Sidebar + Drawer + Strip) بدالة واحدة ──
  syncFilterLabels();

  // ── Sidebar commune + price ──
  const fcm = document.getElementById('fcm');
  if (fcm && fcm.options[0]) fcm.options[0].text = T.allComm;
  const pmin = document.getElementById('pmin'); if (pmin) pmin.placeholder = T.priceFrom;
  const pmax = document.getElementById('pmax'); if (pmax) pmax.placeholder = T.priceTo;
  const sidebarApplyBtn = document.getElementById('sidebarApplyBtn');
  if (sidebarApplyBtn) sidebarApplyBtn.textContent = T.applyBtn;

  // ── Drawer commune + price ──
  const fcmMob = document.getElementById('fcmMob');
  if (fcmMob && fcmMob.options[0]) fcmMob.options[0].text = T.allComm;
  const pminMob = document.getElementById('pminMob'); if (pminMob) pminMob.placeholder = T.priceFrom;
  const pmaxMob = document.getElementById('pmaxMob'); if (pmaxMob) pmaxMob.placeholder = T.priceTo;
  const drawerApplyBtn = document.getElementById('drawerApplyBtn');
  if (drawerApplyBtn) drawerApplyBtn.textContent = T.applyBtn;

  // ── Topbar ──
  const showingLabelEl = document.getElementById('showingLabel'); if (showingLabelEl) showingLabelEl.textContent = T.showing;
  const adWordLabelEl = document.getElementById('adWordLabel'); if (adWordLabelEl) adWordLabelEl.textContent = T.adWord;
  const sortOptNew   = document.getElementById('sortOptNew');
  const sortOptCheap = document.getElementById('sortOptCheap');
  const sortOptExp   = document.getElementById('sortOptExp');
  if (sortOptNew)   sortOptNew.textContent   = T.sortNew;
  if (sortOptCheap) sortOptCheap.textContent = T.sortCheap;
  if (sortOptExp)   sortOptExp.textContent   = T.sortExp;

  // ── Post modal ──
  document.querySelector('.pmhead-title').textContent = T.postTitle;
  document.querySelector('.pmhead-sub').textContent   = T.postSub;
  const labels = document.querySelectorAll('.pmbody .fg label');
  const labelMap = [T.fldType, T.fldOp, T.fldRooms, T.fldArea, T.fldCond, T.fldStatus, T.fldLoc, T.fldPrice, T.fldPhone, T.fldDesc];
  labels.forEach((el, i) => { if (labelMap[i]) el.textContent = labelMap[i]; });
  document.querySelectorAll('#pt option').forEach(o => { o.text = lPT(o.value); });
  document.querySelectorAll('#po option').forEach(o => { o.text = lOP(o.value); });
  const pcond = document.getElementById('pcond');
  if (pcond) { pcond.options[0].text = T.condNeuf; pcond.options[1].text = T.condUsed; }
  const pstat = document.getElementById('pstat');
  if (pstat) { pstat.options[0].text = T.statDispo; pstat.options[1].text = T.statReserved; pstat.options[2].text = T.statSold; pstat.options[3].text = T.statRented; }
  const pa = document.getElementById('pa'); if (pa) pa.placeholder = T.fldAreaPh;
  const pl = document.getElementById('pl'); if (pl) pl.placeholder = T.fldLocPh;
  const pp = document.getElementById('pp'); if (pp) pp.placeholder = T.fldPricePh;
  const ph = document.getElementById('ph'); if (ph) ph.placeholder = T.fldPhonePh;
  const pd = document.getElementById('pd'); if (pd) pd.placeholder = T.fldDescPh;
  const submitBtn = document.querySelector('.btn-submit');
  if (submitBtn && !submitBtn.disabled) submitBtn.textContent = T.submitBtn;

  // ── حقل الصورة ──
  const imgUploadLabel = document.querySelector('#imgUploadArea .img-upload-label');
  const imgUploadHint  = document.querySelector('#imgUploadArea .img-upload-hint');
  if (imgUploadLabel) imgUploadLabel.textContent = lang === 'fr' ? 'Appuyez pour choisir une photo' : 'اضغط لاختيار صورة';
  if (imgUploadHint)  imgUploadHint.textContent  = lang === 'fr' ? 'JPG / PNG – Max 2MB' : 'JPG / PNG – الحجم الأقصى 2MB';

  // ── Detail modal static elements ──
  const mcall = document.getElementById('mcall');
  if (mcall) mcall.textContent = T.callBtn;
  const shareLinkLabel = document.getElementById('shareLinkLabel');
  if (shareLinkLabel) shareLinkLabel.textContent = T.shareLinkLabel;
  const ratingTitle = document.getElementById('ratingTitle');
  if (ratingTitle) ratingTitle.textContent = T.ratingTitle;
  const ratingCountLabel = document.getElementById('ratingCountLabel');
  if (ratingCountLabel) ratingCountLabel.textContent = T.ratingCountLabel;
  const reviewStarsLabel = document.getElementById('reviewStarsLabel');
  if (reviewStarsLabel) reviewStarsLabel.textContent = T.reviewStarsLabel;
  const reviewText = document.getElementById('reviewText');
  if (reviewText) reviewText.placeholder = T.reviewTextPh;
  const submitReviewBtn = document.getElementById('submitReviewBtn');
  if (submitReviewBtn) submitReviewBtn.textContent = T.submitReviewBtn;
  const commentsTitle = document.getElementById('commentsTitle');
  if (commentsTitle) commentsTitle.textContent = T.commentsTitle;
  const commentName = document.getElementById('commentName');
  if (commentName) commentName.placeholder = T.commentNamePh;
  const commentText = document.getElementById('commentText');
  if (commentText) commentText.placeholder = T.commentTextPh;
  const commentBtn = document.getElementById('commentBtn');
  if (commentBtn) commentBtn.textContent = T.commentBtn;

  // ── Footer ──
  const footerTextEl = document.getElementById('footerText'); if (footerTextEl) footerTextEl.textContent = T.footerText;
  const footLinks = document.querySelectorAll('footer a');
  const linkKeys = ['privacy','terms','contact','about'];
  const emojis = ['🔒','📋','📬','ℹ️'];
  footLinks.forEach((el, i) => {
    if (linkKeys[i] && T[linkKeys[i]]) el.textContent = `${emojis[i]} ${T[linkKeys[i]]}`;
  });

  // ── معاينة الصفحة الرئيسية: رابط "تجاوز الإعلانات" وتلميح السحب ──
  const fr = lang === 'fr';
  const skipLinkEl = document.getElementById('skipAdsLink');
  if (skipLinkEl) skipLinkEl.textContent = fr ? 'Passer les annonces et découvrir les prix et conseils ↓' : 'تجاوز الإعلانات واكتشف الأسعار والنصائح ↓';
  const dragHintEl = document.getElementById('homeDragHint');
  if (dragHintEl) dragHintEl.textContent = fr ? '← Faites glisser pour voir plus' : 'اسحب لمشاهدة المزيد ←';

  // ── صفحة listings.html: رابط العودة وعنوان الصفحة ──
  const listingsBackEl = document.getElementById('listingsBack');
  if (listingsBackEl) listingsBackEl.textContent = fr ? "→ Retour à l'accueil" : '→ العودة للرئيسية';
  const listingsTitleEl = document.getElementById('listingsTitle');
  if (listingsTitleEl) listingsTitleEl.textContent = fr ? '🏠 Toutes les annonces' : '🏠 جميع العقارات';

  // ── Re-render ads ──
  sortAndRender();
}

window.toggleLang = function() {
  const newLang = currentLang === 'ar' ? 'fr' : 'ar';
  applyTranslation(newLang);
};

// Page modals
window.openPage = function(page) {
  const T = LANG[currentLang];
  const p = T.pages[page];
  if (p) {
    document.getElementById('pageTitle').innerHTML = p.title;
    document.getElementById('pageContent').innerHTML = p.content;
    document.getElementById('pageModal').classList.add('open');
  }
};

window.closePage = function() { document.getElementById('pageModal').classList.remove('open'); };

// ── تبديل التبويبات الرئيسية ──
window.switchTab = function(name) {
  const panels = ['ads','prices','articles','legal'];
  panels.forEach(p => {
    const panel = document.getElementById('tabPanel-' + p);
    const btn = document.getElementById('tabbtn-' + p);
    if (!panel || !btn) return;
    if (p === name) { panel.classList.add('active'); btn.classList.add('active'); }
    else { panel.classList.remove('active'); btn.classList.remove('active'); }
  });
  const tabbar = document.getElementById('tabbar');
  if (tabbar) tabbar.scrollIntoView({behavior:'smooth', block:'start'});
};

// ── (صفحة listings.html فقط) قراءة معايير البحث من رابط URL وتطبيقها ──
function applyUrlParamsToFilters() {
  if (PAGE_MODE !== 'listings') return;
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const transaction = params.get('transaction');
  const commune = params.get('commune');
  const search = params.get('search');

  if (type && PT[type]) {
    fTypes = new Set([type]);
  }
  if (transaction) {
    if (transaction === 'sale') fOp = 'bay3';
    else if (transaction === 'rent') fOp = 'kira';
    else if (OP[transaction]) fOp = transaction;
  }
  if (commune) {
    fCommune = decodeURIComponent(commune).replace(/[-_]/g, ' ');
    const fcm = document.getElementById('fcm'); if (fcm) fcm.value = fCommune;
    const fcmMob = document.getElementById('fcmMob'); if (fcmMob) fcmMob.value = fCommune;
  }
  if (search) {
    fSearch = decodeURIComponent(search);
    const searchQ = document.getElementById('searchQ'); if (searchQ) searchQ.value = fSearch;
  }
  syncChipUI();
}

// Initialize everything
initSelects();
initFilters();
applyUrlParamsToFilters();
startFirebaseListener();

// Apply French as default language after DOM is ready
setTimeout(() => applyTranslation('fr'), 150);

// ── رفع الصورة ──
let uploadedImgBase64 = null;

window.handleImgUpload = function(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast('⚠️ حجم الصورة يتجاوز 2MB', 'red'); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    uploadedImgBase64 = e.target.result;
    const preview = document.getElementById('imgPreviewPost');
    const placeholder = document.getElementById('imgUploadPlaceholder');
    const removeBtn = document.getElementById('imgRemoveBtn');
    preview.src = uploadedImgBase64;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    removeBtn.style.display = 'flex';
  };
  reader.readAsDataURL(file);
};

window.removeImg = function(e) {
  e.stopPropagation();
  uploadedImgBase64 = null;
  document.getElementById('imgFileInput').value = '';
  document.getElementById('imgPreviewPost').style.display = 'none';
  document.getElementById('imgUploadPlaceholder').style.display = 'block';
  document.getElementById('imgRemoveBtn').style.display = 'none';
};

function resetImgUpload() {
  uploadedImgBase64 = null;
  const input = document.getElementById('imgFileInput');
  if (input) input.value = '';
  const preview = document.getElementById('imgPreviewPost');
  if (preview) preview.style.display = 'none';
  const placeholder = document.getElementById('imgUploadPlaceholder');
  if (placeholder) placeholder.style.display = 'block';
  const removeBtn = document.getElementById('imgRemoveBtn');
  if (removeBtn) removeBtn.style.display = 'none';
}

// ── مولّد الوصف الذكي بالذكاء الاصطناعي (Claude API) ──
window.generateSmartDesc = async function() {
  const btn   = document.getElementById('aiDescBtn');
  const icon  = document.getElementById('aiDescIcon');
  const label = document.getElementById('aiDescLabel');
  const status = document.getElementById('aiDescStatus');

  // جمع بيانات النموذج
  const ptVal   = document.getElementById('pt').value;
  const poVal   = document.getElementById('po').value;
  const prVal   = document.getElementById('pr').value;
  const paVal   = document.getElementById('pa').value;
  const plVal   = document.getElementById('pl').value.trim();
  const ppVal   = document.getElementById('pp').value;
  const condVal = document.getElementById('pcond').value;

  if (!plVal || !ppVal) {
    status.textContent = '⚠️ أدخل البلدية والسعر أولاً';
    status.style.display = 'block';
    status.style.background = '#FFF0F2';
    status.style.color = '#CE1126';
    setTimeout(() => status.style.display = 'none', 3000);
    return;
  }

  // تحويل القيم لنص مقروء
  const typeLabels = { aadl:'AADL', social:'السكن الاجتماعي', lpp:'LPP', lsp:'LSP',
    villa:'فيلا', maison:'منزل', appart:'شقة', residence:'ريزيدنس', local:'محل تجاري' };
  const opLabels   = { kira:'للكراء', bay3:'للبيع', achat:'للشراء', tbadol:'للتبادل' };
  const roomLabels = { f1:'F1', f2:'F2', f3:'F3', f4:'F4', f5:'F5', f6:'F6+' };
  const condLabels = { neuf:'جديد', utilise:'مستعمل' };

  const propType = typeLabels[ptVal] || ptVal;
  const opType   = opLabels[poVal]   || poVal;
  const rooms    = roomLabels[prVal] || prVal;
  const area     = paVal ? `${paVal} م²` : 'غير محدد';
  const price    = ppVal ? `${Number(ppVal).toLocaleString('fr-DZ')} دج` : 'غير محدد';
  const cond     = condLabels[condVal] || condVal;

  const prompt = `أنت خبير في التسويق العقاري الجزائري. اكتب وصفاً إعلانياً احترافياً وجذاباً لعقار بالمواصفات التالية:

نوع العقار: ${propType} ${rooms}
العملية: ${opType}
الموقع: ${plVal}
المساحة: ${area}
السعر: ${price}
الحالة: ${cond}

القواعد:
- الأسلوب: عربي فصيح مع بعض العبارات الجزائرية الشائعة
- الطول: 3-4 جمل مركّزة فقط (لا إطالة)
- اذكر الموقع وميزة الحي بإيجاز
- اختم بعبارة تحث على الاتصال
- لا تذكر السعر (موجود في حقل مستقل)
- لا تضف عنواناً أو رقم هاتف

أعطني فقط نص الوصف بدون أي تعليق أو تمهيد.`;

  // تحديث حالة الزر
  btn.disabled = true;
  icon.textContent = '⏳';
  label.textContent = 'جارٍ التوليد...';
  status.style.display = 'none';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data.content?.map(b => b.text || '').join('').trim();

    if (text) {
      document.getElementById('pd').value = text;
      // أنيميشن نجاح
      icon.textContent = '✅';
      label.textContent = 'تم التوليد! يمكنك التعديل';
      btn.style.background = 'linear-gradient(135deg,#15803D,#166534)';
      status.textContent = '✨ تم إنشاء الوصف — راجعه وعدّل حسب الحاجة';
      status.style.background = '#EAF5EF';
      status.style.color = '#0D3B2E';
      status.style.display = 'block';
      setTimeout(() => {
        icon.textContent = '✨';
        label.textContent = 'ولّد وصفاً ذكياً بالذكاء الاصطناعي';
        btn.style.background = 'linear-gradient(135deg,#5E35B1,#7B1FA2)';
      }, 3000);
    } else {
      throw new Error('empty response');
    }
  } catch (err) {
    console.error('AI desc error:', err);
    icon.textContent = '❌';
    label.textContent = 'فشل التوليد — حاول مرة أخرى';
    status.textContent = '❌ تعذّر الاتصال بالذكاء الاصطناعي. اكتب الوصف يدوياً.';
    status.style.background = '#FFF0F2';
    status.style.color = '#CE1126';
    status.style.display = 'block';
    setTimeout(() => {
      icon.textContent = '✨';
      label.textContent = 'ولّد وصفاً ذكياً بالذكاء الاصطناعي';
      btn.style.background = 'linear-gradient(135deg,#5E35B1,#7B1FA2)';
      status.style.display = 'none';
    }, 4000);
  } finally {
    btn.disabled = false;
  }
};

// ── Schema ديناميكي لكل إعلان (SEO) ──
function injectAdSchema(ad) {
  const old = document.getElementById('dynamic-ad-schema');
  if (old) old.remove();

  const roomsNum = ad.rooms ? parseInt(ad.rooms.replace('f','')) || null : null;

  const schemaObj = {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    "name": ad.title || `${lPT(ad.type)} ${ad.rooms?.toUpperCase()||''} - ${ad.commune||'الجزائر'}`,
    "description": ad.desc || `${lPT(ad.type)} ${lOP(ad.op)} في ${ad.commune||'الجزائر العاصمة'}`,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": ad.commune || "Alger",
      "addressRegion": "Alger",
      "addressCountry": "DZ"
    },
    "offers": {
      "@type": "Offer",
      "price": String(ad.price || 0),
      "priceCurrency": "DZD",
      "availability": ad.status === 'dispo'
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut"
    }
  };

  if (ad.area) schemaObj.floorSize = { "@type":"QuantitativeValue", "value":String(ad.area), "unitCode":"MTK" };
  if (roomsNum) schemaObj.numberOfRooms = roomsNum;

  if (ad.op === 'kira') {
    schemaObj.offers.priceSpecification = {
      "@type":"UnitPriceSpecification",
      "price": String(ad.price||0),
      "priceCurrency":"DZD",
      "referenceQuantity": { "@type":"QuantitativeValue","value":"1","unitCode":"MON" }
    };
  }

  const script = document.createElement('script');
  script.id = 'dynamic-ad-schema';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schemaObj);
  document.head.appendChild(script);
}

window.calcEstimate = function() {
  const area  = parseFloat(document.getElementById('calcArea').value);
  const price = parseFloat(document.getElementById('calcPriceM').value);
  const res   = document.getElementById('calcResult');
  if (!area || !price) {
    res.innerHTML = '<span style="color:#F0C855">⚠️ أدخل المساحة والسعر للمتر المربع</span>';
    res.style.display = 'block'; return;
  }
  const total   = area * price;
  const taxFees = total * 0.05;
  const totalSantime = total * 100;
  res.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div>
        <div style="font-size:11px;color:rgba(255,255,255,.6);margin-bottom:3px">📐 المساحة</div>
        <div style="font-size:15px;font-weight:700;color:#fff">${area.toLocaleString('fr-DZ')} م²</div>
      </div>
      <div>
        <div style="font-size:11px;color:rgba(255,255,255,.6);margin-bottom:3px">💰 السعر/م²</div>
        <div style="font-size:15px;font-weight:700;color:#fff">${price.toLocaleString('fr-DZ')} دج</div>
      </div>
      <div style="grid-column:1/-1;background:rgba(240,200,85,.15);border-radius:8px;padding:12px">
        <div style="font-size:11px;color:rgba(255,255,255,.7);margin-bottom:4px">📋 التقييم الإداري الإجمالي</div>
        <div style="font-size:20px;font-weight:900;color:#F0C855">${total.toLocaleString('fr-DZ')} دج</div>
        <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px">${(totalSantime/1e6).toFixed(0)} مليون سنتيم</div>
      </div>
      <div style="grid-column:1/-1;background:rgba(206,17,38,.15);border-radius:8px;padding:12px">
        <div style="font-size:11px;color:rgba(255,255,255,.7);margin-bottom:4px">📑 رسوم التسجيل التقريبية (5%)</div>
        <div style="font-size:18px;font-weight:900;color:#FF8A8A">${taxFees.toLocaleString('fr-DZ')} دج</div>
      </div>
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:10px">⚠️ هذا تقدير إداري أدنى — أسعار السوق الفعلية قد تكون أعلى</div>
  `;
  res.style.display = 'block';
};

// ── PWA: تسجيل Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}
