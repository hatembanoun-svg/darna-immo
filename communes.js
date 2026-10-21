/* Darna Immo — بلديات العاصمة الـ57 + أحياء وبلديات مجاورة شائعة في LPP
   [الاسم بالعربية، بالفرنسية، مرادفات، خط العرض، خط الطول، المجموعة]
   الإحداثيات تقريبية (±1–2 كم) وتُستعمل فقط لوضع الدبوس على الخريطة. */
(function () {
  'use strict';
  var A = 'a', N = 'n'; // a = بلديات ولاية الجزائر · n = قريبة من العاصمة
  var P = [
    ['الجزائر الوسطى', 'Alger-Centre', ['الجزائر الوسط', 'alger centre ville'], 36.7700, 3.0560, A],
    ['سيدي امحمد', "Sidi M'Hamed", ['سيدي محمد', 'sidi mhamed'], 36.7640, 3.0620, A],
    ['المدنية', 'El Madania', ['كلوزال', 'clos salembier'], 36.7400, 3.0680, A],
    ['المرادية', 'El Mouradia', [], 36.7470, 3.0510, A],
    ['باب الواد', 'Bab El Oued', ['باب الوادي'], 36.7900, 3.0500, A],
    ['القصبة', 'Casbah', ['kasbah'], 36.7850, 3.0600, A],
    ['بولوغين', 'Bologhine', ['بولوغين ابن زيري', 'bologhine ibnou ziri'], 36.8000, 3.0300, A],
    ['وادي قريش', 'Oued Koriche', ['oued kouriche', 'koriche', 'kouriche'], 36.7930, 3.0380, A],
    ['رايس حميدو', 'Raïs Hamidou', ['pointe pescade'], 36.8040, 3.0050, A],
    ['براقي', 'Baraki', [], 36.6670, 3.0990, A],
    ['الكاليتوس', 'Les Eucalyptus', ['eucalyptus', 'الكاليبتوس'], 36.7060, 3.1530, A],
    ['سيدي موسى', 'Sidi Moussa', [], 36.6200, 3.0750, A],
    ['بئر مراد رايس', 'Bir Mourad Raïs', ['بير مراد رايس', 'bmr', 'سعيد حمدين', 'said hamdine', 'saiid hamdin', 'said hamdin', 'hamdine'], 36.7350, 3.0450, A],
    ['بئر خادم', 'Birkhadem', ['بير خادم', 'bir khadem'], 36.7150, 3.0530, A],
    ['جسر قسنطينة', 'Djasr Kasentina', ['gue de constantine', 'jisr kasentina', 'عين النعجة', 'ain naadja'], 36.7210, 3.0870, A],
    ['حيدرة', 'Hydra', [], 36.7440, 3.0300, A],
    ['السحاولة', 'Saoula', ['سحاولة'], 36.7040, 3.0200, A],
    ['بئر توتة', 'Birtouta', ['بير توتة', 'bir touta'], 36.6450, 3.0000, A],
    ['أولاد شبل', 'Ouled Chebel', ['اولاد الشبل'], 36.5994, 2.9944, A],
    ['تسالة المرجة', 'Tessala El Merdja', ['تسالة'], 36.6353, 2.9469, A],
    ['بن عكنون', 'Ben Aknoun', [], 36.7600, 3.0120, A],
    ['بني مسوس', 'Beni Messous', [], 36.7860, 2.9950, A],
    ['بوزريعة', 'Bouzareah', ['bouzaréah'], 36.7870, 3.0120, A],
    ['الأبيار', 'El Biar', [], 36.7650, 3.0300, A],
    ['عين البنيان', 'Aïn Benian', ['عين بنيان', 'ain benyan'], 36.7920, 2.9120, A],
    ['الشراقة', 'Chéraga', ['cheraga'], 36.7640, 2.9640, A],
    ['دالي إبراهيم', 'Dely Ibrahim', ['دالي ابراهيم', 'دلي ابراهيم', 'dely brahim'], 36.7550, 2.9870, A],
    ['أولاد فايت', 'Ouled Fayet', ['اولاد فايت', 'ولاد فايت', 'oulade fayt', 'oulad fayt', 'ouled fayt', 'oulad fayet', 'ouled fayat', 'oulad fayat', 'les lilas', 'les lylas', 'lilas'], 36.7260, 2.9490, A],
    ['الحمامات', 'El Hammamet', ['hammamet', 'حمامات'], 36.7820, 2.9780, A],
    ['عين طاية', 'Aïn Taya', ['عين الطاية', 'ain taya'], 36.7930, 3.2900, A],
    ['باب الزوار', 'Bab Ezzouar', ['bab ezouar', 'bab ezzouar'], 36.7240, 3.1830, A],
    ['برج البحري', 'Bordj El Bahri', ['bordj bahri', 'borj el bahri', 'borj bahri', 'borj ibahri', 'borj ibarhri', 'faizi', 'cite faizi'], 36.7890, 3.2540, A],
    ['برج الكيفان', 'Bordj El Kiffan', ['bordj kiffan', 'bordj el kifan', 'ali amrane', 'aliamrane', 'ali amrani', 'amrane', 'amrani'], 36.7490, 3.1920, A],
    ['الدار البيضاء', 'Dar El Beïda', ['دار البيضاء', 'dar el beida', 'dar beida'], 36.7140, 3.2120, A],
    ['المرسى', 'El Marsa', ['el mersa', 'مرسى'], 36.7980, 3.3220, A],
    ['المحمدية', 'Mohammadia', ['mohamadia', 'el mohammadia', 'محمدية'], 36.7350, 3.1300, A],
    ['بابا حسن', 'Baba Hassen', [], 36.6880, 2.9800, A],
    ['دويرة', 'Douéra', ['الدويرة', 'douera'], 36.6700, 2.9440, A],
    ['درارية', 'Draria', ['الدرارية'], 36.7150, 2.9830, A],
    ['العاشور', 'El Achour', ['عاشور'], 36.7400, 2.9850, A],
    ['الخرايسية', 'Khraïcia', ['خرايسية', 'kheraicia', 'kheraissia', 'khraissia', 'el kheraicia'], 36.6770, 2.9560, A],
    ['بش جراح', 'Bachdjerrah', ['باش جراح', 'bach djerrah', 'bachdjarah'], 36.7200, 3.1170, A],
    ['بوروبة', 'Bourouba', [], 36.7260, 3.1260, A],
    ['الحراش', 'El Harrach', ['حراش', 'harrach'], 36.7170, 3.1370, A],
    ['وادي السمار', 'Oued Smar', ['oued semar'], 36.7080, 3.1650, A],
    ['بلوزداد', 'Belouizdad', ['بلكور', 'belcourt', 'الحامة', 'حامة', 'hamma anassers', 'el hamma'], 36.7480, 3.0710, A],
    ['المقرية', 'El Magharia', ['مقرية', 'el maqaria'], 36.7330, 3.1130, A],
    ['حسين داي', 'Hussein Dey', ['حسين داي'], 36.7400, 3.1010, A],
    ['القبة', 'Kouba', ['el kouba'], 36.7270, 3.0780, A],
    ['حراوة', 'Haraoua', ["h'raoua", 'hraoua', 'الحراوة'], 36.7640, 3.2850, A],
    ['الرغاية', 'Reghaïa', ['reghaia', 'reghaya', 'رغاية', 'korichi', 'كوريشي', 'قريشي', 'amirouche', 'amirouch', 'amirouche', 'عميروش', 'ميروش'], 36.7390, 3.3430, A],
    ['الرويبة', 'Rouïba', ['rouiba', 'رويبة'], 36.7380, 3.2810, A],
    ['المحالمة', 'Mahelma', ['محالمة', 'maalma', "ma'alma", 'maelma', 'maalama'], 36.7010, 2.8780, A],
    ['الرحمانية', 'Rahmania', ['رحمانية'], 36.6900, 2.9100, A],
    ['سويدانية', 'Souidania', ['السويدانية'], 36.7030, 2.9220, A],
    ['سطاوالي', 'Staouéli', ['staoueli', 'ستاوالي', 'سطاوالى'], 36.7570, 2.8890, A],
    ['زرالدة', 'Zéralda', ['zeralda'], 36.7110, 2.8420, A],

    // أحياء وبلديات مجاورة شائعة في إعلانات LPP
    ['سيدي عبد الله', 'Sidi Abdellah', ['sidi abdallah', 'sidi abdelah', 'سيدي عبدالله', 'سيدي عبد اللة', 'sidi benour', 'sidi bennour', 'sidi benoure', 'سيدي بنور', 'سيدي بن نور', 'ville nouvelle sidi abdellah'], 36.6760, 2.8800, N],
    ['حمادي', 'Hammadi', ['hamadi', 'hammedi', 'حمادى', 'الحمادي'], 36.6769, 3.2675, N],
    ['خميس الخشنة', 'Khemis El Khechna', ['خميس الخشنه', 'khemis khechna', 'khemis el khechna'], 36.6500, 3.3500, N],
    ['بودواو', 'Boudouaou', ['boudouaou', 'بودواو البحري'], 36.7300, 3.4100, N],
    ['قورصو', 'Corso', ['كورصو', 'قورصو'], 36.7450, 3.4300, N],
    ['بومرداس', 'Boumerdès', ['boumerdes'], 36.7603, 3.4724, N, 4],
    ['الأربعاء', 'Larbaa', ["l'arbaa", 'larbaa', 'الاربعاء'], 36.5650, 3.1600, N],
    ['القليعة', 'Koléa', ['kolea', 'القلعة'], 36.6380, 2.7650, N],
    ['بوإسماعيل', 'Bou Ismaïl', ['bou ismail', 'بو اسماعيل', 'بواسماعيل'], 36.6430, 2.6930, N],
    ['البليدة', 'Blida', [], 36.4700, 2.8300, N, 4],
    ['بوينان', 'Bouinan', ['بوينان', 'bouinane', 'boinan', 'bouinan', 'bouïnan'], 36.5306, 2.9917, N],
    ['واد العلايق', 'Oued El Alleug', ['وادي العلايق', 'oued alleug', 'oued el aleug', 'oued el alleug'], 36.5553, 2.7903, N],
    ['أولاد سلامة', 'Ouled Selama', ['اولاد سلامة', 'ouled slama', 'oulad slama', 'ouled selama'], 36.5483, 3.1100, N],
    ['تيبازة', 'Tipaza', ['tipasa'], 36.5890, 2.4470, N, 4]
  ];

  // مدن أخرى تُستعمل للمطابقة فقط (لا تظهر في قائمة الاختيار)
  var OTHER = [
    ['الشلف', 'Chlef', 36.1650, 1.3340], ['عين الدفلى', 'Ain Defla', 36.2640, 1.9680],
    ['وهران', 'Oran', 35.6970, -0.6310], ['قسنطينة', 'Constantine', 36.3650, 6.6147],
    ['عنابة', 'Annaba', 36.9000, 7.7670], ['سطيف', 'Setif', 36.1900, 5.4100],
    ['باتنة', 'Batna', 35.5550, 6.1740], ['تيزي وزو', 'Tizi Ouzou', 36.7118, 4.0459],
    ['بجاية', 'Bejaia', 36.7510, 5.0560], ['مستغانم', 'Mostaganem', 35.9310, 0.0890]
  ];

  var all = P.map(function (p) { return { ar: p[0], fr: p[1], aliases: p[2], lat: p[3], lng: p[4], group: p[5], rank: p[6] || 0, listed: true }; })
    .concat(OTHER.map(function (o) { return { ar: o[0], fr: o[1], aliases: [], lat: o[2], lng: o[3], group: 'o', listed: false }; }));
  window.DZ_PLACES = all;

  // ───────── قائمة اختيار البلدية في نموذج النشر ─────────
  function buildSelect() {
    var sel = document.getElementById('pcom');
    if (!sel || sel.options.length > 1) return;
    var fr = !String(document.documentElement.lang || '').toLowerCase().startsWith('ar');
    var ph = document.createElement('option');
    ph.value = '';
    ph.setAttribute('data-ar', '📍 اختر البلدية (لتظهر شقتك على الخريطة)');
    ph.setAttribute('data-fr', '📍 Choisissez la commune (pour apparaître sur la carte)');
    ph.textContent = fr ? ph.getAttribute('data-fr') : ph.getAttribute('data-ar');
    sel.appendChild(ph);
    [['a', 'بلديات الجزائر العاصمة', 'Communes d\'Alger'], ['n', 'أحياء وبلديات مجاورة', 'Quartiers et communes voisines']].forEach(function (g) {
      var og = document.createElement('optgroup');
      og.label = fr ? g[2] : g[1];
      og.setAttribute('data-ar', g[1]); og.setAttribute('data-fr', g[2]);
      all.filter(function (p) { return p.listed && p.group === g[0]; })
        .sort(function (a, b) { return a.ar.localeCompare(b.ar, 'ar'); })
        .forEach(function (p) {
          var o = document.createElement('option');
          o.value = p.ar;
          o.textContent = p.ar + ' — ' + p.fr;
          og.appendChild(o);
        });
      sel.appendChild(og);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildSelect); else buildSelect();
})();
