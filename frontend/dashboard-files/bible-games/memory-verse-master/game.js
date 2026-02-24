(function () {
'use strict';

// ══════════════════════════════════════
// DATA + STATE
// ══════════════════════════════════════
let VERSES = [], LEVELS = [];

const MODE_META = {
  'fill-blank':  { icon: '📝', label: 'Fill in the Blanks' },
  'arrange':     { icon: '🔀', label: 'Arrange the Words' },
  'type-blank':  { icon: '⌨️', label: 'Type the Missing Word' },
  'ref-match':   { icon: '📍', label: 'Match the Reference' },
};

const THEME_ICONS = {
  'Salvation':'✝️','Faith':'🕊️','Love':'❤️','Courage':'⚡','Trust':'🙏','Prayer':'🙌',
  'Hope':'🌟','Peace':'☮️','God\'s Word':'📖','God\'s Nature':'✨','Strength':'💪',
  'Compassion':'💧','Priorities':'🎯','Joy':'😊','Identity':'🌱','Transformation':'🦋',
  'Character':'🌿','Praise':'🎵','Repentance':'💎','Justice':'⚖️','Sacrifice':'🕊️',
  'Resurrection':'🌅','Life':'🌱','Wisdom':'👑','Rest':'🌙','Witness':'💡',
  'Faithfulness':'🔒','Help':'🤝','Protection':'🛡️','Blessing':'🌈','Grace':'🎁',
  'God\'s Presence':'🌍','Purpose':'🎯',
};

let state = {
  currentScreen: 'splash',
  currentLevel: null,
  currentVerse: null,
  progress: { stars: {}, highScore: 0, streak: 0, lastDate: null },

  // study phase
  studyTimer: null,
  studyTimeLeft: 0,

  // quiz timer
  quizTimer: null,
  quizTimeLeft: 0,
  quizStartTime: 0,
  paused: false,
  hintsLeft: 0,

  // scoring
  score: 0,
  totalScore: 0,
  correctCount: 0,
  totalQuestions: 0,

  // fill-blank
  blanks: [],       // [{idx, word, correct, answered, options}]
  currentBlank: 0,

  // arrange
  arrangeWords: [], // [{text, originalIdx}]
  arrangeTarget: [],

  // type-blank
  typeBlanks: [],   // [{idx, word, correct, answered}]
  currentTyped: 0,

  // ref-match
  refVerses: [],    // [{verse, choices, correctIdx, answered}]
  currentRef: 0,

  filterTag: 'all',
};

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
async function init() {
  try {
    const [vRes, lRes] = await Promise.all([
      fetch('./data/verses.json'),
      fetch('./data/levels.json'),
    ]);
    VERSES = await vRes.json();
    LEVELS = await lRes.json();
  } catch (e) {
    console.error('Failed to load data:', e);
    VERSES = []; LEVELS = [];
  }

  loadProgress();

  // Firebase (optional)
  const fw = window.firebaseReady ? window.firebaseReady.catch(() => {}) : Promise.resolve();
  fw.then(() => {
    if (window.auth) window.auth.onAuthStateChanged(() => {});
  });

  bindNav();

  // Splash animation
  let pct = 0;
  const bar = document.getElementById('splash-bar');
  const iv = setInterval(() => {
    pct += 2.5;
    if (bar) bar.style.width = pct + '%';
    if (pct >= 100) { clearInterval(iv); showScreen('home'); }
  }, 40);
}

// ══════════════════════════════════════
// SCREEN MANAGEMENT
// ══════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const s = document.getElementById('screen-' + id);
  if (s) s.classList.add('active');
  state.currentScreen = id;
  if (id === 'home') renderHomeStats();
  if (id === 'levels') buildLevelGrid();
}

// ══════════════════════════════════════
// NAV BINDINGS
// ══════════════════════════════════════
function bindNav() {
  // Home
  document.getElementById('btn-play').onclick = () => {
    const next = nextUnlocked();
    if (next) openPreLevel(next);
    else showScreen('levels');
  };
  document.getElementById('btn-levels').onclick = () => showScreen('levels');
  document.getElementById('btn-howto').onclick = () => showScreen('howto');

  // Levels
  document.getElementById('btn-levels-back').onclick = () => showScreen('home');

  // Pre-level
  document.getElementById('btn-pre-back').onclick = () => showScreen('levels');
  document.getElementById('btn-start').onclick = () => startLevel(state.currentLevel);

  // Game HUD
  document.getElementById('btn-game-menu').onclick = togglePause;
  document.getElementById('btn-hint').onclick = activateHint;
  document.getElementById('btn-resume').onclick = togglePause;
  document.getElementById('btn-hint-pause').onclick = () => { togglePause(); activateHint(); };
  document.getElementById('btn-abandon').onclick = () => { stopAll(); showScreen('levels'); };
  document.getElementById('btn-ready').onclick = endStudyEarly;

  // Arrange
  document.getElementById('btn-arrange-check').onclick = checkArrange;
  document.getElementById('btn-arrange-clear').onclick = clearArrange;

  // Type blank
  document.getElementById('btn-type-submit').onclick = submitTyped;
  document.getElementById('type-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitTyped();
  });

  // Complete screen
  document.getElementById('btn-next-level').onclick = goNextLevel;
  document.getElementById('btn-replay').onclick = () => startLevel(state.currentLevel);
  document.getElementById('btn-complete-menu').onclick = () => showScreen('home');

  // How to play
  document.getElementById('btn-howto-back').onclick = () => showScreen('home');
  document.getElementById('btn-howto-play').onclick = () => {
    const next = nextUnlocked();
    if (next) openPreLevel(next); else showScreen('levels');
  };
}

// ══════════════════════════════════════
// HOME STATS
// ══════════════════════════════════════
function renderHomeStats() {
  const done = Object.keys(state.progress.stars).length;
  const totalStars = Object.values(state.progress.stars).reduce((a,b) => a+b, 0);
  document.getElementById('stat-done').textContent = done;
  document.getElementById('stat-stars').textContent = totalStars;
  document.getElementById('stat-streak').textContent = state.progress.streak || 0;
  document.getElementById('stat-best').textContent = state.progress.highScore || 0;

  // Particles
  const pc = document.getElementById('home-particles');
  pc.innerHTML = '';
  const icons = ['📖','✝️','🕊️','⭐','🙏','🌟','💡','🎵','✨','📜'];
  icons.forEach((ic, i) => {
    const s = document.createElement('span');
    s.textContent = ic;
    s.style.left = (5 + i * 10) + '%';
    s.style.bottom = '0';
    s.style.animationDuration = (8 + i % 5) + 's';
    s.style.animationDelay = (i * 0.7) + 's';
    pc.appendChild(s);
  });
}

function nextUnlocked() {
  for (let i = 0; i < LEVELS.length; i++) {
    if (!state.progress.stars[LEVELS[i].id]) return LEVELS[i];
  }
  return LEVELS[0];
}

// ══════════════════════════════════════
// LEVEL GRID
// ══════════════════════════════════════
function buildLevelGrid() {
  const done = Object.keys(state.progress.stars).length;
  document.getElementById('levels-progress-text').textContent = done + ' / ' + LEVELS.length;

  // Filter tabs
  const tags = ['all', ...new Set(LEVELS.map(l => l.tag.toLowerCase()))];
  const filterEl = document.getElementById('levels-filter');
  filterEl.innerHTML = '';
  tags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'filter-tab' + (tag === state.filterTag ? ' active' : '');
    btn.textContent = tag === 'all' ? 'All Levels' : tag.charAt(0).toUpperCase() + tag.slice(1);
    btn.onclick = () => { state.filterTag = tag; buildLevelGrid(); };
    filterEl.appendChild(btn);
  });

  const grid = document.getElementById('levels-grid');
  grid.innerHTML = '';
  const filtered = state.filterTag === 'all'
    ? LEVELS
    : LEVELS.filter(l => l.tag.toLowerCase() === state.filterTag);

  filtered.forEach(level => {
    const unlocked = isUnlocked(level.id);
    const stars = state.progress.stars[level.id] || 0;
    const card = document.createElement('div');
    card.className = 'level-card' + (!unlocked ? ' locked' : '') + (stars > 0 ? ' completed' : '');
    const modeMeta = MODE_META[level.mode] || {};
    const tagCls = level.tag.toLowerCase();
    card.innerHTML = `
      <span class="lc-num">Level ${level.id}</span>
      <span class="lc-icon">${level.icon}</span>
      <span class="lc-name">${level.name}</span>
      <span class="lc-tag ${tagCls}">${level.tag}</span>
      <span class="lc-mode">${modeMeta.icon || ''} ${modeMeta.label || level.mode}</span>
      <div class="lc-stars">
        ${[1,2,3].map(i => `<span class="${stars >= i ? 'earned' : ''}">⭐</span>`).join('')}
      </div>
      ${!unlocked ? '<span class="lc-lock">🔒</span>' : ''}
    `;
    if (unlocked) card.onclick = () => openPreLevel(level);
    else card.onclick = () => showToast('Complete Level ' + (level.id - 1) + ' first!');
    grid.appendChild(card);
  });
}

function isUnlocked(levelId) {
  if (levelId === 1) return true;
  return !!state.progress.stars[levelId - 1];
}

// ══════════════════════════════════════
// PRE-LEVEL
// ══════════════════════════════════════
function openPreLevel(level) {
  state.currentLevel = level;
  // Pick a random verse from the pool
  const pool = level.versePool.map(id => VERSES.find(v => v.id === id)).filter(Boolean);
  const verse = pool[Math.floor(Math.random() * pool.length)];
  state.currentVerse = verse;

  showScreen('prelevel');

  const modeMeta = MODE_META[level.mode] || {};
  document.getElementById('pre-tag').textContent = level.tag;
  document.getElementById('pre-mode-badge').textContent = (modeMeta.icon || '') + ' ' + (modeMeta.label || level.mode);
  document.getElementById('pre-title').textContent = level.name;
  document.getElementById('pre-subtitle').textContent = level.subtitle;

  document.getElementById('pre-verse-text').textContent = '\u201c' + verse.verse + '\u201d';
  document.getElementById('pre-verse-ref').textContent = '— ' + verse.ref;
  document.getElementById('pre-context-text').textContent = verse.context;

  // Meta rows
  const readRow = document.getElementById('pre-read-row');
  if (level.mode === 'ref-match') {
    readRow.style.display = 'none';
  } else {
    readRow.style.display = '';
    document.getElementById('pre-read-time').textContent = level.readTime;
  }
  document.getElementById('pre-quiz-time').textContent = level.timeLimit;
  document.getElementById('pre-hints-text').textContent =
    level.hints === 0 ? 'No hints available' : `${level.hints} hint${level.hints > 1 ? 's' : ''} available`;

  const blanksRow = document.getElementById('pre-blanks-row');
  if (level.mode === 'fill-blank' || level.mode === 'type-blank') {
    blanksRow.style.display = '';
    document.getElementById('pre-blanks-text').textContent = `${level.blanks} word${level.blanks > 1 ? 's' : ''} to recall`;
  } else {
    blanksRow.style.display = 'none';
  }

  // Stars
  const earned = state.progress.stars[level.id] || 0;
  const starsEl = document.getElementById('pre-stars-earned');
  starsEl.innerHTML = [1,2,3].map(i =>
    `<span class="${earned >= i ? 'earned' : ''}">⭐</span>`
  ).join('');
}

// ══════════════════════════════════════
// START LEVEL
// ══════════════════════════════════════
function startLevel(level) {
  state.currentLevel = level;
  state.paused = false;
  state.score = 0;
  state.correctCount = 0;
  state.totalQuestions = 0;
  state.hintsLeft = level.hints;
  state.quizTimeLeft = level.timeLimit;

  document.getElementById('hud-level-name').textContent = level.icon + ' ' + level.name;
  document.getElementById('hint-count').textContent = level.hints;
  document.getElementById('btn-hint').disabled = level.hints === 0;
  document.getElementById('pause-overlay').classList.add('hidden');
  document.getElementById('answer-flash').classList.remove('show');

  updateTimerRing(1);
  updateProgress(0);

  showScreen('game');

  if (level.mode === 'ref-match') {
    // No study phase for ref-match
    startRefMatch();
  } else {
    startStudyPhase();
  }
}

// ══════════════════════════════════════
// STUDY PHASE
// ══════════════════════════════════════
function startStudyPhase() {
  const level = state.currentLevel;
  const verse = state.currentVerse;

  showPhase('study');

  // Populate study card
  const themeIcon = THEME_ICONS[verse.theme] || '📖';
  document.getElementById('study-theme-icon').textContent = themeIcon;
  document.getElementById('study-era').textContent = verse.era;
  document.getElementById('study-verse').textContent = '\u201c' + verse.verse + '\u201d';
  document.getElementById('study-ref').textContent = '— ' + verse.ref;

  state.studyTimeLeft = level.readTime;
  document.getElementById('study-countdown').textContent = state.studyTimeLeft;
  document.getElementById('study-countdown').className = 'study-bar-label';
  document.getElementById('study-bar').style.width = '100%';

  // Countdown
  clearInterval(state.studyTimer);
  state.studyTimer = setInterval(() => {
    if (state.paused) return;
    state.studyTimeLeft--;
    const el = document.getElementById('study-countdown');
    const bar = document.getElementById('study-bar');
    el.textContent = state.studyTimeLeft;
    bar.style.width = ((state.studyTimeLeft / level.readTime) * 100) + '%';

    if (state.studyTimeLeft <= 3) el.className = 'study-bar-label urgent';
    else if (state.studyTimeLeft <= 5) el.className = 'study-bar-label warn';

    if (state.studyTimeLeft <= 0) {
      clearInterval(state.studyTimer);
      startQuizPhase();
    }
  }, 1000);
}

function endStudyEarly() {
  clearInterval(state.studyTimer);
  startQuizPhase();
}

// ══════════════════════════════════════
// QUIZ PHASE ROUTER
// ══════════════════════════════════════
function startQuizPhase() {
  const level = state.currentLevel;
  showPhase('quiz');

  // Mode strip
  const modeMeta = MODE_META[level.mode] || {};
  document.getElementById('mode-icon').textContent = modeMeta.icon || '';
  document.getElementById('mode-desc').textContent = modeMeta.label || level.mode;

  // Hide all mode panels
  ['mode-fill-blank', 'mode-arrange', 'mode-type-blank', 'mode-ref-match'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });

  startQuizTimer();

  if (level.mode === 'fill-blank') startFillBlank();
  else if (level.mode === 'arrange') startArrange();
  else if (level.mode === 'type-blank') startTypeBlank();
  else if (level.mode === 'ref-match') startRefMatch();
}

// ══════════════════════════════════════
// QUIZ TIMER
// ══════════════════════════════════════
function startQuizTimer() {
  stopQuizTimer();
  state.quizStartTime = Date.now();
  state.quizTimer = setInterval(() => {
    if (state.paused) return;
    state.quizTimeLeft--;
    const frac = Math.max(0, state.quizTimeLeft / state.currentLevel.timeLimit);
    updateTimerRing(frac);
    document.getElementById('hud-timer').textContent = state.quizTimeLeft;

    const arc = document.getElementById('timer-arc');
    if (state.quizTimeLeft <= 5) arc.className = 'timer-arc urgent';
    else if (state.quizTimeLeft <= 15) arc.className = 'timer-arc warn';
    else arc.className = 'timer-arc';

    if (state.quizTimeLeft <= 0) {
      stopQuizTimer();
      timeUp();
    }
  }, 1000);
}

function stopQuizTimer() {
  clearInterval(state.quizTimer);
  state.quizTimer = null;
}

function updateTimerRing(frac) {
  const circumference = 113.1;
  const offset = circumference * (1 - frac);
  document.getElementById('timer-arc').style.strokeDashoffset = offset;
  document.getElementById('hud-timer').textContent = state.quizTimeLeft;
}

function timeUp() {
  showToast('⏱ Time\'s up!');
  setTimeout(() => completeLevel(false), 800);
}

// ══════════════════════════════════════
// MODE: FILL BLANK
// ══════════════════════════════════════
function startFillBlank() {
  const level = state.currentLevel;
  const verse = state.currentVerse;
  document.getElementById('mode-fill-blank').classList.remove('hidden');

  // Build blanks
  state.blanks = generateBlanks(verse, level.blanks, 'choices');
  state.currentBlank = 0;
  state.totalQuestions = state.blanks.length;

  renderFillBlank();
}

function renderFillBlank() {
  const verse = state.currentVerse;
  const blanks = state.blanks;
  const current = state.currentBlank;

  // Verse display with blanks
  const words = tokenizeVerse(verse.verse);
  const fillVerse = document.getElementById('fill-verse');
  fillVerse.innerHTML = '';

  words.forEach((token, ti) => {
    const blankIdx = blanks.findIndex(b => b.tokenIdx === ti);
    if (blankIdx !== -1) {
      const b = blanks[blankIdx];
      const span = document.createElement('span');
      span.className = 'blank-slot' +
        (b.answered ? ' answered' : '') +
        (blankIdx === current && !b.answered ? ' current-blank' : '');
      span.textContent = b.answered ? b.correct : '___';
      fillVerse.appendChild(span);
      fillVerse.appendChild(document.createTextNode(' '));
    } else {
      fillVerse.appendChild(document.createTextNode(token + ' '));
    }
  });

  // Nav
  document.getElementById('blank-current').textContent = current + 1;
  document.getElementById('blank-total').textContent = blanks.length;

  // Progress
  updateProgress(state.correctCount / state.totalQuestions);

  // Choices for current blank
  const grid = document.getElementById('choices-grid');
  grid.innerHTML = '';
  if (current < blanks.length && !blanks[current].answered) {
    const b = blanks[current];
    b.options.forEach((opt, oi) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = opt;
      btn.style.animationDelay = (oi * 0.06) + 's';
      btn.onclick = () => selectFillBlank(opt, btn, b);
      grid.appendChild(btn);
    });
  }
}

function selectFillBlank(chosen, btn, blank) {
  const isCorrect = normalizeWord(chosen) === normalizeWord(blank.correct);
  blank.answered = true;

  document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);

  if (isCorrect) {
    btn.classList.add('correct');
    state.correctCount++;
    const pts = calcPoints(true);
    state.score += pts;
    state.totalScore = (state.progress.highScore || 0);
    showFlash(true, pts);
    spawnSparks(btn);
  } else {
    btn.classList.add('wrong');
    // Highlight correct
    document.querySelectorAll('.choice-btn').forEach(b => {
      if (normalizeWord(b.textContent) === normalizeWord(blank.correct)) b.classList.add('correct');
    });
    showFlash(false, 0);
  }

  renderFillBlank(); // Update verse display

  setTimeout(() => {
    state.currentBlank++;
    if (state.currentBlank >= state.blanks.length) {
      stopQuizTimer();
      setTimeout(completeLevel, 500);
    } else {
      renderFillBlank();
    }
  }, 1200);
}

// ══════════════════════════════════════
// MODE: ARRANGE
// ══════════════════════════════════════
function startArrange() {
  const verse = state.currentVerse;
  document.getElementById('mode-arrange').classList.remove('hidden');

  // Tokenize and shuffle
  const words = tokenizeVerse(verse.verse);
  state.arrangeWords = words.map((w, i) => ({ text: w, originalIdx: i, inTarget: false }));
  shuffleArray(state.arrangeWords);
  state.arrangeTarget = [];
  state.totalQuestions = 1;

  renderArrange();
}

function renderArrange() {
  // Target area
  const targetEl = document.getElementById('arrange-target');
  targetEl.innerHTML = '';
  if (state.arrangeTarget.length === 0) {
    const ph = document.createElement('span');
    ph.className = 'arrange-placeholder';
    ph.textContent = 'Tap words below to place them here';
    targetEl.appendChild(ph);
  } else {
    state.arrangeTarget.forEach((w, ti) => {
      const tile = document.createElement('button');
      tile.className = 'word-tile in-target';
      tile.textContent = w.text;
      tile.style.animationDelay = (ti * 0.04) + 's';
      tile.onclick = () => removeFromTarget(ti);
      targetEl.appendChild(tile);
    });
  }

  // Bank
  const bankEl = document.getElementById('arrange-bank');
  bankEl.innerHTML = '';
  state.arrangeWords.filter(w => !w.inTarget).forEach((w, bi) => {
    const tile = document.createElement('button');
    tile.className = 'word-tile';
    tile.textContent = w.text;
    tile.style.animationDelay = (bi * 0.04) + 's';
    tile.onclick = () => addToTarget(w);
    bankEl.appendChild(tile);
  });
}

function addToTarget(word) {
  word.inTarget = true;
  state.arrangeTarget.push(word);
  renderArrange();
}

function removeFromTarget(idx) {
  const word = state.arrangeTarget.splice(idx, 1)[0];
  word.inTarget = false;
  renderArrange();
}

function clearArrange() {
  state.arrangeTarget.forEach(w => w.inTarget = false);
  state.arrangeTarget = [];
  renderArrange();
}

function checkArrange() {
  if (state.arrangeTarget.length === 0) { showToast('Place some words first!'); return; }

  const correct = tokenizeVerse(state.currentVerse.verse);
  const placed = state.arrangeTarget.map(w => normalizeWord(w.text));
  const correctNorm = correct.map(w => normalizeWord(w));

  const targetEl = document.getElementById('arrange-target');
  const isCorrect = placed.length === correctNorm.length &&
    placed.every((w, i) => w === correctNorm[i]);

  if (isCorrect) {
    targetEl.classList.add('correct-anim');
    state.correctCount = 1;
    const pts = calcPoints(true, 2);
    state.score += pts;
    showFlash(true, pts);
    launchConfetti();
    stopQuizTimer();
    setTimeout(() => { targetEl.classList.remove('correct-anim'); completeLevel(); }, 1000);
  } else {
    targetEl.classList.add('wrong-anim');
    showFlash(false, 0);
    setTimeout(() => targetEl.classList.remove('wrong-anim'), 700);

    // Give partial credit for percentage correct
    let matches = 0;
    const len = Math.max(placed.length, correctNorm.length);
    for (let i = 0; i < Math.min(placed.length, correctNorm.length); i++) {
      if (placed[i] === correctNorm[i]) matches++;
    }
    const pct = matches / len;
    if (pct >= 0.8) showToast('Very close! ' + matches + '/' + correctNorm.length + ' words correct.');
    else if (pct >= 0.5) showToast(matches + '/' + correctNorm.length + ' words in place. Keep trying!');
    else showToast('Check the order again. ' + matches + ' words match.');
  }
}

// ══════════════════════════════════════
// MODE: TYPE BLANK
// ══════════════════════════════════════
function startTypeBlank() {
  const level = state.currentLevel;
  const verse = state.currentVerse;
  document.getElementById('mode-type-blank').classList.remove('hidden');

  state.typeBlanks = generateBlanks(verse, level.blanks, 'type');
  state.currentTyped = 0;
  state.totalQuestions = state.typeBlanks.length;

  renderTypeBlank();
  setTimeout(() => document.getElementById('type-input').focus(), 200);
}

function renderTypeBlank() {
  const verse = state.currentVerse;
  const blanks = state.typeBlanks;
  const current = state.currentTyped;

  // Verse display
  const words = tokenizeVerse(verse.verse);
  const typeVerse = document.getElementById('type-verse');
  typeVerse.innerHTML = '';

  words.forEach((token, ti) => {
    const blankIdx = blanks.findIndex(b => b.tokenIdx === ti);
    if (blankIdx !== -1) {
      const b = blanks[blankIdx];
      const span = document.createElement('span');
      span.className = 'blank-slot' +
        (b.answered ? ' answered' : '') +
        (blankIdx === current && !b.answered ? ' current-blank' : '');
      span.textContent = b.answered ? b.correct : '___';
      typeVerse.appendChild(span);
      typeVerse.appendChild(document.createTextNode(' '));
    } else {
      typeVerse.appendChild(document.createTextNode(token + ' '));
    }
  });

  // Nav
  document.getElementById('type-blank-num').textContent = current + 1;
  document.getElementById('type-blank-total').textContent = blanks.length;

  // Clear input
  const input = document.getElementById('type-input');
  input.value = '';
  input.className = 'type-input';
  input.placeholder = 'Type word ' + (current + 1) + ' of ' + blanks.length + '…';

  updateProgress(state.correctCount / state.totalQuestions);
}

function submitTyped() {
  const input = document.getElementById('type-input');
  const typed = input.value.trim();
  if (!typed) return;

  const blank = state.typeBlanks[state.currentTyped];
  if (!blank) return;

  const isCorrect = fuzzyMatch(typed, blank.correct);
  blank.answered = true;

  if (isCorrect) {
    input.classList.add('correct-input');
    blank.correct = blank.correct; // keep original for display
    state.correctCount++;
    const pts = calcPoints(true);
    state.score += pts;
    showFlash(true, pts);
    spawnSparks(input);
  } else {
    input.classList.add('wrong-input');
    showFlash(false, 0, blank.correct);
  }

  renderTypeBlank();

  setTimeout(() => {
    state.currentTyped++;
    if (state.currentTyped >= state.typeBlanks.length) {
      stopQuizTimer();
      setTimeout(completeLevel, 500);
    } else {
      renderTypeBlank();
      setTimeout(() => document.getElementById('type-input').focus(), 100);
    }
  }, 1300);
}

// ══════════════════════════════════════
// MODE: REF MATCH
// ══════════════════════════════════════
function startRefMatch() {
  const level = state.currentLevel;
  showPhase('quiz');

  // Mode strip
  const modeMeta = MODE_META['ref-match'];
  document.getElementById('mode-icon').textContent = modeMeta.icon;
  document.getElementById('mode-desc').textContent = modeMeta.label;
  ['mode-fill-blank','mode-arrange','mode-type-blank'].forEach(id =>
    document.getElementById(id).classList.add('hidden')
  );
  document.getElementById('mode-ref-match').classList.remove('hidden');

  // Pick verses from pool
  const pool = level.versePool.map(id => VERSES.find(v => v.id === id)).filter(Boolean);
  const count = Math.min(pool.length, 4);
  shuffleArray(pool);
  const picked = pool.slice(0, count);

  state.refVerses = picked;
  state.currentRef = 0;
  state.totalQuestions = picked.length;

  startQuizTimer();
  renderRefMatch();
}

function renderRefMatch() {
  const refs = state.refVerses;
  const idx = state.currentRef;
  if (idx >= refs.length) {
    stopQuizTimer();
    completeLevel();
    return;
  }

  const v = refs[idx];
  document.getElementById('ref-verse-text').textContent = '\u201c' + v.verse + '\u201d';
  document.getElementById('ref-current').textContent = idx + 1;
  document.getElementById('ref-total').textContent = refs.length;
  updateProgress(state.correctCount / state.totalQuestions);

  // Build choices: correct + 3 distractors from pool
  const pool = LEVELS.find(l => l.id === state.currentLevel.id).versePool
    .map(id => VERSES.find(vv => vv.id === id)).filter(Boolean);
  const distractors = pool.filter(p => p.id !== v.id);
  shuffleArray(distractors);
  const choices = [v, ...distractors.slice(0, 3)];
  shuffleArray(choices);

  const choicesEl = document.getElementById('ref-choices');
  choicesEl.innerHTML = '';
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'ref-btn';
    btn.textContent = choice.ref;
    btn.onclick = () => selectRef(choice, btn, v);
    choicesEl.appendChild(btn);
  });
}

function selectRef(chosen, btn, correct) {
  const isCorrect = chosen.id === correct.id;
  document.querySelectorAll('.ref-btn').forEach(b => b.disabled = true);

  if (isCorrect) {
    btn.classList.add('correct');
    state.correctCount++;
    const pts = calcPoints(true);
    state.score += pts;
    showFlash(true, pts);
    spawnSparks(btn);
  } else {
    btn.classList.add('wrong');
    document.querySelectorAll('.ref-btn').forEach(b => {
      const refVerseObj = VERSES.find(v => v.ref === b.textContent);
      if (refVerseObj && refVerseObj.id === correct.id) b.classList.add('correct');
    });
    showFlash(false, 0);
  }

  setTimeout(() => {
    state.currentRef++;
    if (state.currentRef >= state.refVerses.length) {
      stopQuizTimer();
      setTimeout(completeLevel, 300);
    } else {
      renderRefMatch();
    }
  }, 1300);
}

// ══════════════════════════════════════
// HINT
// ══════════════════════════════════════
function activateHint() {
  if (state.hintsLeft <= 0) { showToast('No hints left!'); return; }
  state.hintsLeft--;
  document.getElementById('hint-count').textContent = state.hintsLeft;
  document.getElementById('btn-hint').disabled = state.hintsLeft === 0;

  const mode = state.currentLevel.mode;
  if (mode === 'fill-blank') {
    const blank = state.blanks[state.currentBlank];
    if (blank) showToast('💡 Hint: starts with "' + blank.correct[0].toUpperCase() + '"');
  } else if (mode === 'type-blank') {
    const blank = state.typeBlanks[state.currentTyped];
    if (blank) showToast('💡 Hint: "' + blank.correct.slice(0, 2) + '…"');
  } else if (mode === 'arrange') {
    const correct = tokenizeVerse(state.currentVerse.verse);
    showToast('💡 First word: "' + correct[0] + '"');
  } else if (mode === 'ref-match') {
    const v = state.refVerses[state.currentRef];
    if (v) showToast('💡 Book: ' + v.ref.split(' ')[0]);
  }
}

// ══════════════════════════════════════
// PAUSE
// ══════════════════════════════════════
function togglePause() {
  state.paused = !state.paused;
  document.getElementById('pause-overlay').classList.toggle('hidden', !state.paused);
}

function stopAll() {
  clearInterval(state.studyTimer);
  stopQuizTimer();
  state.paused = false;
}

// ══════════════════════════════════════
// COMPLETE LEVEL
// ══════════════════════════════════════
function completeLevel(success = true) {
  stopAll();
  const level = state.currentLevel;
  const verse = state.currentVerse;
  const timeUsed = level.timeLimit - state.quizTimeLeft;

  // Stars
  let stars = 1;
  const accuracy = state.totalQuestions > 0 ? state.correctCount / state.totalQuestions : 0;
  if (accuracy === 1 && timeUsed < level.starThresholds[0]) stars = 3;
  else if (accuracy >= 0.67 && timeUsed < level.starThresholds[1]) stars = 2;
  else stars = 1;

  if (!success) stars = 1;

  // Score
  const prevStars = state.progress.stars[level.id] || 0;
  if (stars > prevStars) state.progress.stars[level.id] = stars;
  if (state.score > (state.progress.highScore || 0)) state.progress.highScore = state.score;

  // Streak
  const today = new Date().toDateString();
  if (state.progress.lastDate !== today) {
    state.progress.streak = (state.progress.streak || 0) + 1;
    state.progress.lastDate = today;
  }
  saveProgress();

  // Show complete screen
  showScreen('complete');

  // Stars animation
  const starsEl = document.getElementById('complete-stars');
  starsEl.innerHTML = [1,2,3].map(i =>
    `<span class="${stars >= i ? 'earned' : ''}" style="animation-delay:${(i-1)*0.2}s">⭐</span>`
  ).join('');

  document.getElementById('complete-title').textContent = stars === 3 ? '🌟 Perfect!' : stars === 2 ? 'Well Done!' : 'Level Complete!';
  document.getElementById('complete-score').textContent = state.score.toLocaleString();
  document.getElementById('complete-time').textContent = formatTime(timeUsed);

  // Verse reveal
  document.getElementById('complete-verse-text').textContent = '\u201c' + verse.verse + '\u201d';
  document.getElementById('complete-verse-ref').textContent = '— ' + verse.ref;

  // Lesson
  document.getElementById('lesson-text').textContent = verse.lesson;

  // Next button
  const nextId = level.id + 1;
  const nextLevel = LEVELS.find(l => l.id === nextId);
  document.getElementById('btn-next-level').style.display = nextLevel ? '' : 'none';

  if (stars >= 2) launchConfetti();
}

function goNextLevel() {
  const next = LEVELS.find(l => l.id === state.currentLevel.id + 1);
  if (next) openPreLevel(next);
  else showScreen('levels');
}

// ══════════════════════════════════════
// HELPERS — QUIZ GENERATION
// ══════════════════════════════════════
function tokenizeVerse(text) {
  // Split on spaces, keep punctuation attached to words
  return text.split(/\s+/).filter(Boolean);
}

function generateBlanks(verse, count, kind) {
  const words = tokenizeVerse(verse.verse);
  const keywords = verse.keywords || [];

  // Find candidate indices (prioritize keywords)
  const candidates = [];
  keywords.forEach(kw => {
    const idx = words.findIndex((w, i) =>
      normalizeWord(w) === normalizeWord(kw) && !candidates.some(c => c.tokenIdx === i)
    );
    if (idx !== -1) candidates.push({ tokenIdx: idx, word: words[idx], correct: normalizeWord(words[idx]) });
  });

  // Fill remaining with long words
  if (candidates.length < count) {
    const used = new Set(candidates.map(c => c.tokenIdx));
    words.forEach((w, i) => {
      if (candidates.length >= count) return;
      if (used.has(i)) return;
      const norm = normalizeWord(w);
      if (norm.length >= 4 && !/^\d+$/.test(norm)) {
        candidates.push({ tokenIdx: i, word: w, correct: norm });
        used.add(i);
      }
    });
  }

  // Trim to requested count
  const selected = candidates.slice(0, count);

  // For fill-blank mode, generate choices
  if (kind === 'choices') {
    return selected.map(b => ({
      tokenIdx: b.tokenIdx,
      word: b.word,
      correct: b.correct,
      answered: false,
      options: buildChoices(b.correct, words),
    }));
  }
  return selected.map(b => ({ tokenIdx: b.tokenIdx, word: b.word, correct: b.correct, answered: false }));
}

function buildChoices(correct, allWords) {
  const pool = new Set();

  // Words from verse (different from correct)
  allWords.forEach(w => {
    const n = normalizeWord(w);
    if (n !== correct && n.length >= 3) pool.add(n);
  });

  // Common Bible words as fillers
  const fillers = [
    'God','Lord','love','grace','faith','peace','hope','light','heart','soul',
    'life','truth','word','spirit','glory','prayer','mercy','eternal','saved','blessed',
    'strength','kingdom','righteous','servant','mighty','afraid','still','trust','never',
  ];
  fillers.forEach(f => {
    if (normalizeWord(f) !== correct) pool.add(normalizeWord(f));
  });

  const candidates = [...pool].filter(w => w !== correct);
  shuffleArray(candidates);

  const chosen = candidates.slice(0, 3);
  const options = [correct, ...chosen];
  shuffleArray(options);
  return options;
}

function normalizeWord(w) {
  return (w || '').toLowerCase().replace(/[.,;:!?()\u2018\u2019\u201c\u201d\u2014\u2013\-]/g, '').trim();
}

function fuzzyMatch(typed, correct) {
  const t = normalizeWord(typed);
  const c = normalizeWord(correct);
  if (t === c) return true;
  // Allow 1 character difference for words ≥ 5 chars
  if (c.length >= 5 && levenshtein(t, c) <= 1) return true;
  return false;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m+1 }, (_, i) => Array.from({ length: n+1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// ══════════════════════════════════════
// SCORING
// ══════════════════════════════════════
function calcPoints(correct, multiplier = 1) {
  if (!correct) return 0;
  const base = 15;
  const timeBonus = Math.floor(state.quizTimeLeft / state.currentLevel.timeLimit * 10);
  return (base + timeBonus) * multiplier;
}

// ══════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════
function showPhase(name) {
  document.getElementById('phase-study').classList.toggle('hidden', name !== 'study');
  document.getElementById('phase-quiz').classList.toggle('hidden', name !== 'quiz');
}

function updateProgress(frac) {
  document.getElementById('hud-progress-bar').style.width = (frac * 100) + '%';
}

function showFlash(correct, pts, hint) {
  const el = document.getElementById('answer-flash');
  el.className = 'answer-flash show ' + (correct ? 'correct-flash' : 'wrong-flash');
  document.getElementById('flash-icon').textContent = correct ? '✓' : '✗';
  document.getElementById('flash-msg').textContent = correct
    ? ['Great!', 'Excellent!', 'Correct!', 'Perfect!', 'Nice one!'][Math.floor(Math.random()*5)]
    : (hint ? 'Answer: ' + hint : 'Wrong!');
  document.getElementById('flash-pts').textContent = correct ? '+' + pts : '';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1000);
}

function spawnSparks(fromEl) {
  const layer = document.getElementById('sparks-layer');
  const r = fromEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const colors = ['#f5c518','#2ecc71','#3498db','#9b59b6','#e74c3c','#1abc9c'];
  for (let i = 0; i < 12; i++) {
    const s = document.createElement('div');
    s.className = 'spark';
    const angle = (i / 12) * 2 * Math.PI;
    const dist = 50 + Math.random() * 40;
    s.style.cssText = `left:${cx}px;top:${cy}px;width:8px;height:8px;
      background:${colors[i % colors.length]};
      --tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;
      animation-duration:${0.5 + Math.random()*0.3}s;`;
    layer.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

function launchConfetti() {
  const layer = document.getElementById('confetti-layer');
  const colors = ['#f5c518','#e74c3c','#2ecc71','#3498db','#9b59b6','#e67e22','#1abc9c'];
  for (let i = 0; i < 70; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.top = '-10px';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.width = (5 + Math.random() * 8) + 'px';
      el.style.height = (5 + Math.random() * 8) + 'px';
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      el.style.animationDuration = (2.5 + Math.random() * 2.5) + 's';
      el.style.animationDelay = (Math.random() * 0.3) + 's';
      layer.appendChild(el);
      setTimeout(() => el.remove(), 6000);
    }, i * 25);
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2400);
}

// ══════════════════════════════════════
// SAVE / LOAD
// ══════════════════════════════════════
function saveProgress() {
  localStorage.setItem('mvmProgress', JSON.stringify(state.progress));
}
function loadProgress() {
  try {
    const s = localStorage.getItem('mvmProgress');
    if (s) state.progress = { ...state.progress, ...JSON.parse(s) };
  } catch(e) {}
}

// ══════════════════════════════════════
// UTILS
// ══════════════════════════════════════
function formatTime(secs) {
  if (secs < 60) return secs + 's';
  return Math.floor(secs / 60) + 'm ' + (secs % 60) + 's';
}
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ══════════════════════════════════════
// BOOT
// ══════════════════════════════════════
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
