'use strict';

/* ═══════════════════════════════════════════════════════════
   CASE METADATA
═══════════════════════════════════════════════════════════ */
const CASES = {
  nominative:    { ru:'Именительный', en:'Nominative',    q:'Кто? Что?',      color:'#4ADE80' },
  genitive:      { ru:'Родительный',  en:'Genitive',      q:'Кого? Чего?',    color:'#60A5FA' },
  dative:        { ru:'Дательный',    en:'Dative',        q:'Кому? Чему?',    color:'#C084FC' },
  accusative:    { ru:'Винительный',  en:'Accusative',    q:'Кого? Что?',     color:'#FB923C' },
  instrumental:  { ru:'Творительный', en:'Instrumental',  q:'Кем? Чем?',      color:'#22D3EE' },
  prepositional: { ru:'Предложный',   en:'Prepositional', q:'О ком? О чём?',  color:'#F472B6' },
};
const CK = Object.keys(CASES);

/* ═══════════════════════════════════════════════════════════
   KNOWN WORD LISTS
═══════════════════════════════════════════════════════════ */

// Personal & question pronouns — exact case lookup
const PRONOUNS = {
  'я':['nominative'], 'ты':['nominative'], 'он':['nominative'],
  'она':['nominative'], 'оно':['nominative'], 'мы':['nominative'],
  'вы':['nominative'], 'они':['nominative'],

  'меня':['genitive','accusative'], 'тебя':['genitive','accusative'],
  'его':['genitive','accusative'],  'него':['genitive','accusative'],
  'её':['genitive','accusative'],   'ее':['genitive','accusative'],
  'неё':['genitive','accusative'],  'нее':['genitive','accusative'],
  'нас':['genitive','accusative','prepositional'],
  'вас':['genitive','accusative','prepositional'],
  'их':['genitive','accusative'],   'них':['genitive','accusative','prepositional'],

  'мне':['dative','prepositional'], 'тебе':['dative','prepositional'],
  'ему':['dative'], 'нему':['dative'],
  'ей':['dative','instrumental'],   'ней':['dative','instrumental','prepositional'],
  'нам':['dative'], 'вам':['dative'],
  'им':['dative','instrumental'],   'ним':['dative','instrumental'],

  'мной':['instrumental'], 'мною':['instrumental'],
  'тобой':['instrumental'],'тобою':['instrumental'],
  'нею':['instrumental'],  'ею':['instrumental'],
  'нами':['instrumental'], 'вами':['instrumental'], 'ними':['instrumental'],

  'нём':['prepositional'], 'нем':['prepositional'],

  // Question pronouns
  'кто':['nominative'],
  'что':['nominative','accusative'],
  'кого':['genitive','accusative'],
  'чего':['genitive'],
  'кому':['dative'],   'чему':['dative'],
  'кем':['instrumental'], 'чем':['instrumental','prepositional'],
  'ком':['prepositional'], 'чём':['prepositional'],
  'чей':['nominative'], 'чья':['nominative'], 'чьё':['nominative'], 'чьи':['nominative'],
};

// Preposition → case(s) it governs
const PREPS = {
  // Pure genitive
  'без':['genitive'], 'вместо':['genitive'], 'вне':['genitive'],
  'внутри':['genitive'], 'вокруг':['genitive'], 'впереди':['genitive'],
  'для':['genitive'], 'до':['genitive'], 'из':['genitive'],
  'из-за':['genitive'], 'из-под':['genitive'],
  'кроме':['genitive'], 'мимо':['genitive'], 'напротив':['genitive'],
  'около':['genitive'], 'от':['genitive'], 'ото':['genitive'],
  'после':['genitive'], 'посреди':['genitive'], 'против':['genitive'],
  'сзади':['genitive'], 'среди':['genitive'], 'у':['genitive'],
  'вдоль':['genitive'], 'позади':['genitive'], 'вблизи':['genitive'],
  'прежде':['genitive'], 'снаружи':['genitive'], 'возле':['genitive'],
  'ради':['genitive'], 'насчёт':['genitive'], 'относительно':['genitive'],

  // Pure dative
  'к':['dative'], 'ко':['dative'],
  'благодаря':['dative'], 'вопреки':['dative'],
  'навстречу':['dative'], 'согласно':['dative'],
  'по':['dative'],

  // Accusative + Prepositional (в/на — direction vs location)
  'в':['accusative','prepositional'], 'во':['accusative','prepositional'],
  'на':['accusative','prepositional'],

  // Accusative + Instrumental (за/под — motion vs position)
  'за':['accusative','instrumental'],
  'под':['accusative','instrumental'], 'подо':['accusative','instrumental'],

  // Pure accusative
  'через':['accusative'], 'про':['accusative'],
  'сквозь':['accusative'], 'спустя':['accusative'],

  // Pure instrumental
  'над':['instrumental'], 'надо':['instrumental'],
  'перед':['instrumental'], 'передо':['instrumental'],

  // Instrumental + Genitive
  'с':['instrumental','genitive'], 'со':['instrumental','genitive'],
  'между':['instrumental','genitive'],

  // Pure prepositional
  'о':['prepositional'], 'об':['prepositional'],
  'обо':['prepositional'], 'при':['prepositional'],
};
const PREP_SET = new Set(Object.keys(PREPS));

// Words that are not inflected nouns/adjectives
const PARTICLES = new Set([
  'и','а','но','или','да','нет','не','ни','же','бы','ли','ведь',
  'вот','уж','лишь','только','даже','именно','уже','ещё','еще',
  'тоже','также','зато','однако','хотя','если','когда','пока',
  'как','где','куда','откуда','почему','зачем','потому','поэтому',
  'так','вдруг','очень','совсем','совершенно','почти','скоро',
  'сейчас','теперь','тогда','всегда','иногда','здесь','там',
  'туда','сюда','везде','нигде','никуда','хорошо','плохо',
  'быстро','медленно','тут','уж','именно','просто','именно',
]);

/* ═══════════════════════════════════════════════════════════
   ENDING RULES
   Each rule: [regex, {case: score}]
   ALL matching rules accumulate (no break).
   Most specific patterns listed first to dominate scoring.
═══════════════════════════════════════════════════════════ */
const RULES = [
  // ─── Unambiguous plural ──────────────────────────────────
  [/ами$|ями$/,        { instrumental:96 }],
  [/ах$|ях$/,         { prepositional:96 }],
  [/ам$|ям$/,         { dative:96 }],

  // ─── Instrumental singular ───────────────────────────────
  [/ью$/,             { instrumental:94 }],          // 3rd decl: тетрадью
  [/ием$|ией$/,       { instrumental:88 }],           // 2nd decl ие/ия: здание + ией
  [/ом$|ем$|ём$/,     { instrumental:90 }],           // m/n: столом, полем
  [/ою$|ею$|ёю$/,     { instrumental:84 }],           // long fem: рукою
  [/ым$|им$/,         { instrumental:86 }],           // adj m/n: красивым

  // ─── Genitive plural ─────────────────────────────────────
  [/ов$|ев$|ёв$/,     { genitive:93 }],
  [/ей$/,             { genitive:68, instrumental:52 }],

  // ─── Adjective endings (unambiguous) ─────────────────────
  [/ого$|его$/,       { genitive:86, accusative:48 }],   // adj gen/acc m
  [/ому$|ему$/,       { dative:90 }],                    // adj dat m/n
  [/ую$|юю$/,         { accusative:92 }],                // adj acc f
  [/ый$|ий$/,         { nominative:90 }],                // adj nom m
  [/ая$|яя$/,         { nominative:88 }],                // adj nom f
  [/ое$|ее$/,         { nominative:86 }],                // adj nom n
  [/ые$|ие$/,         { nominative:84 }],                // adj nom pl
  [/ой$/,             { nominative:58, instrumental:58 }], // adj: большой / большой (inst f)

  // ─── -ия / -ие nouns ─────────────────────────────────────
  [/ии$/,             { genitive:62, dative:62, prepositional:62 }],
  [/ию$/,             { dative:74, accusative:58 }],
  [/ия$/,             { nominative:74, genitive:40 }],

  // ─── Accusative feminine (1st decl) ──────────────────────
  [/[аеёиоуыэюя]у$/,  { accusative:72, dative:52 }],   // vowel + у: руку
  [/у$/,              { accusative:65, dative:58 }],
  [/ю$/,              { accusative:60, dative:60 }],

  // ─── Ambiguous short endings ─────────────────────────────
  [/а$/,              { nominative:60, genitive:54 }],   // мама / стола
  [/я$/,              { nominative:58, genitive:48 }],   // дядя / поля
  [/ы$/,              { nominative:60, genitive:57 }],   // книги pl / женщины gen
  [/е$/,              { dative:52, prepositional:55, nominative:24 }],
  [/и$/,              { genitive:46, dative:40, prepositional:42, nominative:34 }],
  [/ь$/,              { nominative:54, accusative:50, genitive:18, dative:18, prepositional:18 }],
  [/й$/,              { nominative:82 }],                // nominative m adj/noun

  // ─── Consonant-final (2nd decl masc nominative) ──────────
  [/[бвгджзклмнпрстфхцчшщ]$/, { nominative:70, genitive:26 }],
];

/* ═══════════════════════════════════════════════════════════
   EXAMPLES
═══════════════════════════════════════════════════════════ */
const EXAMPLES = [
  'Мама мыла раму.',
  'Я иду в школу каждый день.',
  'Книга студента лежит на столе.',
  'Мы говорили с другом о работе.',
  'Я часто думаю о Москве.',
  'Надо дать ребёнку игрушку.',
];

/* ═══════════════════════════════════════════════════════════
   TOKENIZER
   Produces tokens: Russian words (with hyphens), spaces, punctuation
═══════════════════════════════════════════════════════════ */
function tokenize(text) {
  return text.match(/[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*|\s+|[^\sа-яёА-ЯЁ]+/g) || [];
}

/* ═══════════════════════════════════════════════════════════
   CORE: analyse a single Russian word
═══════════════════════════════════════════════════════════ */
function analyseWord(word, prevLow) {
  const low = word.toLowerCase();

  // Preposition?
  if (PREP_SET.has(low)) return { kind:'prep', word, low };

  // Particle / conjunction / adverb?
  if (PARTICLES.has(low)) return { kind:'part', word, low };

  // Pronoun exact match?
  if (PRONOUNS[low]) {
    return { kind:'noun', word, low, cases: PRONOUNS[low], reason:'pronoun (known form)' };
  }

  // Score accumulator
  const sc = { nominative:0, genitive:0, dative:0, accusative:0, instrumental:0, prepositional:0 };
  let reason = 'ending pattern';

  // ── Preposition context (strong signal) ──────────────────
  if (prevLow && PREPS[prevLow]) {
    const govCases = PREPS[prevLow];
    govCases.forEach(c => { sc[c] += 130; });
    reason = `after preposition «${prevLow}»`;
  }

  // ── Ending rules (accumulate all matches) ────────────────
  for (const [re, pts] of RULES) {
    if (re.test(low)) {
      for (const [c, s] of Object.entries(pts)) sc[c] += s;
    }
  }

  // ── Derive top cases (70% of max threshold) ──────────────
  const max = Math.max(...Object.values(sc));
  if (max === 0) return { kind:'noun', word, low, cases:[], reason:'undetermined' };

  const thresh = max * 0.70;
  const topCases = CK.filter(k => sc[k] >= thresh).sort((a,b) => sc[b]-sc[a]);

  return { kind:'noun', word, low, cases: topCases, sc, reason };
}

/* ═══════════════════════════════════════════════════════════
   ANALYSE FULL TEXT
═══════════════════════════════════════════════════════════ */
function analyseText(text) {
  const raw = tokenize(text);
  const out = [];
  let prevLow = null;
  let firstRussian = true;

  for (const tok of raw) {
    // Whitespace
    if (/^\s+$/.test(tok)) { out.push({ kind:'sp', raw:tok }); continue; }
    // Non-Russian
    if (!/[а-яёА-ЯЁ]/.test(tok)) { out.push({ kind:'pt', raw:tok }); continue; }

    const res = analyseWord(tok, prevLow);
    res.raw = tok;

    // First Russian word in sentence → nominative bias (subject heuristic)
    if (res.kind === 'noun' && firstRussian && !prevLow) {
      if (res.sc) {
        res.sc.nominative = (res.sc.nominative||0) + 22;
        const max = Math.max(...Object.values(res.sc));
        const thresh = max * 0.70;
        res.cases = CK.filter(k => res.sc[k] >= thresh).sort((a,b) => res.sc[b]-res.sc[a]);
      }
    }

    if (res.kind !== 'sp' && res.kind !== 'pt') firstRussian = false;

    // Track previous Russian word for preposition context
    prevLow = (res.kind === 'prep') ? res.low : null;

    out.push(res);
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════
   CSS CLASS for a token
═══════════════════════════════════════════════════════════ */
function cssClass(t) {
  if (t.kind === 'prep') return 'prep-word';
  if (t.kind === 'part') return 'plain';
  if (!t.cases || t.cases.length === 0) return 'ambiguous';
  if (t.cases.length >= 4) return 'ambiguous';
  return t.cases[0]; // colour by most-likely case
}

/* ═══════════════════════════════════════════════════════════
   RENDER RESULTS
═══════════════════════════════════════════════════════════ */
function render(tokens) {
  const out = document.getElementById('textOut');
  out.innerHTML = '';

  const counts = {}; CK.forEach(k => counts[k] = 0);
  let nounTotal = 0;

  for (const t of tokens) {
    if (t.kind === 'sp') { out.appendChild(document.createTextNode(t.raw)); continue; }
    if (t.kind === 'pt') {
      const s = document.createElement('span');
      s.textContent = t.raw; s.style.color = '#475569';
      out.appendChild(s); continue;
    }

    const span = document.createElement('span');
    span.textContent = t.word || t.raw;
    span.className = 'tok ' + cssClass(t);
    span.addEventListener('mouseenter', onEnter);
    span.addEventListener('mouseleave', onLeave);
    span.addEventListener('mousemove',  onMove);
    span._data = t;
    out.appendChild(span);

    if (t.kind === 'noun' && t.cases && t.cases.length > 0) {
      nounTotal++;
      counts[t.cases[0]]++;
    }
  }

  renderStats(counts, nounTotal);
  renderLegend();
  document.getElementById('results').classList.add('visible');
  document.getElementById('results').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

/* ─── Stats ─────────────────────────────────────────────── */
function renderStats(counts, total) {
  const grid = document.getElementById('statsGrid');
  grid.innerHTML = '';
  let any = false;
  CK.forEach(k => {
    if (!counts[k]) return;
    any = true;
    const info = CASES[k];
    const pct = total ? Math.round(counts[k]/total*100) : 0;
    const div = document.createElement('div');
    div.className = 'stat';
    div.style.borderColor = info.color + '35';
    div.innerHTML =
      `<span class="stat-num" style="color:${info.color}">${counts[k]}</span>` +
      `<div class="stat-name" style="color:${info.color}">${info.ru}</div>` +
      `<div class="stat-en">${info.en} · ${pct}%</div>`;
    grid.appendChild(div);
  });
  if (!any) {
    grid.innerHTML = '<div class="msg">No inflected Russian words detected.</div>';
  }
}

/* ─── Legend ─────────────────────────────────────────────── */
function renderLegend() {
  const el = document.getElementById('legend');
  if (el.children.length) return;
  CK.forEach(k => {
    const info = CASES[k];
    const div = document.createElement('div');
    div.className = 'leg';
    div.innerHTML =
      `<div class="leg-dot" style="background:${info.color}"></div>` +
      `<div>` +
        `<div class="leg-ru" style="color:${info.color}">${info.ru}</div>` +
        `<div class="leg-en">${info.en}</div>` +
        `<div class="leg-q">${info.q}</div>` +
      `</div>`;
    el.appendChild(div);
  });
}

/* ═══════════════════════════════════════════════════════════
   TOOLTIP
═══════════════════════════════════════════════════════════ */
const tip = document.getElementById('tip');

function buildTip(t) {
  let h = `<div class="tip-word">${t.word || t.raw}</div>`;

  if (t.kind === 'prep') {
    h += `<div style="color:#94A3B8;font-size:13px;margin-bottom:8px">Preposition · предлог</div>`;
    const gov = PREPS[t.low];
    if (gov) {
      h += `<div class="tip-gov">Governs:</div>`;
      gov.forEach(c => {
        const i = CASES[c];
        h += `<span class="tip-tag" style="background:${i.color}22;color:${i.color}">${i.ru} (${i.en})</span>`;
      });
    }
  } else if (t.kind === 'part') {
    h += `<div style="color:#94A3B8;font-size:13px">Conjunction / Particle / Adverb</div>`;
  } else if (!t.cases || t.cases.length === 0) {
    h += `<div style="color:#94A3B8;font-size:13px">Case could not be determined</div>`;
  } else {
    const plural = t.cases.length > 1;
    h += `<div style="font-size:11px;color:#64748B;margin-bottom:6px">` +
         `${plural ? 'Possible cases' : 'Case'}:</div>`;
    t.cases.forEach((c, i) => {
      const info = CASES[c];
      const conf = i === 0 ? '●' : '◌';
      h += `<span class="tip-tag" style="background:${info.color}22;color:${info.color}">` +
           `${conf} ${info.ru} · ${info.en}</span> `;
    });
    if (t.reason) {
      h += `<div class="tip-reason">Hint: ${t.reason}</div>`;
    }
    if (plural) {
      h += `<div class="tip-reason" style="opacity:.6">Multiple cases share this ending.<br>Context determines the exact case.</div>`;
    }
  }
  return h;
}

function placeTip(e) {
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = e.clientX + 18, y = e.clientY + 18;
  if (x + tw > vw - 12) x = e.clientX - tw - 14;
  if (y + th > vh - 12) y = e.clientY - th - 14;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}

function onEnter(e) {
  tip.innerHTML = buildTip(e.currentTarget._data);
  tip.classList.add('show');
  placeTip(e);
}
function onLeave()  { tip.classList.remove('show'); }
function onMove(e)  { placeTip(e); }

/* ═══════════════════════════════════════════════════════════
   VERB DETECTION
   Returns true if a word is likely a Russian verb.
   Focuses on unambiguous endings to avoid false positives.
═══════════════════════════════════════════════════════════ */
function isLikelyVerb(word) {
  const low = word.toLowerCase();
  return /[аеёиоуыэюя]ть$/.test(low) ||  // infinitive: читать, петь
         /ться$/.test(low)             ||  // reflexive infinitive: читаться
         /тись$/.test(low)             ||  // reflexive infinitive (variant)
         /чь$/.test(low)               ||  // infinitive: мочь, стричь
         /чься$/.test(low)             ||  // reflexive: стричься
         /[её]шь$/.test(low)           ||  // 2nd sg present: читаешь, поёшь
         /ишь$/.test(low);                 // 2nd sg present: говоришь
}

/* ═══════════════════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════════════════ */
function analyze() {
  const text = document.getElementById('inp').value.trim();
  if (!text) return;
  if (!/[а-яёА-ЯЁ]/.test(text)) {
    document.getElementById('statsGrid').innerHTML =
      '<div class="msg">Please enter Russian (Cyrillic) text.</div>';
    document.getElementById('textOut').innerHTML = '';
    document.getElementById('results').classList.add('visible');
    return;
  }
  const russianWords = text.match(/[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*/g) || [];
  if (russianWords.length === 1 && isLikelyVerb(russianWords[0])) {
    document.getElementById('statsGrid').innerHTML =
      `<div class="msg" style="color:#FCD34D">` +
      `«${russianWords[0]}» is a verb — verbs do not have grammatical cases in Russian.<br>` +
      `<span style="font-size:12px;opacity:0.65">Only nouns, pronouns, and adjectives decline by case.</span>` +
      `</div>`;
    document.getElementById('textOut').innerHTML = '';
    document.getElementById('results').classList.add('visible');
    return;
  }
  const tokens = analyseText(text);
  render(tokens);
}

function loadEx(i) {
  document.getElementById('inp').value = EXAMPLES[i];
  analyze();
}

// Ctrl+Enter shortcut
document.getElementById('inp').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); analyze(); }
});
