(function () {
  'use strict';

  // ══════════════════════════════════════
  // STATE
  // ══════════════════════════════════════
  let WORLDS = [];
  let QUESTIONS = [];

  let state = {
    coins: 0,
    unlockedLevels: {},
    completedLevels: {},
    stickers: [],
    currentWorld: null,
    currentLevelIdx: null,
    currentQuestions: [],
    qIdx: 0,
    correctCount: 0,
    orderSelected: [],
  };

  let currentUser = null;
  let db = null;

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  async function init() {
    try {
      [WORLDS, QUESTIONS] = await Promise.all([
        fetch('./data/worlds.json').then(r => r.json()),
        fetch('./data/questions.json').then(r => r.json()),
      ]);
    } catch (e) {
      console.error('Failed to load game data', e);
      return;
    }

    if (window.auth && window.db) {
      db = window.db;
      window.auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) loadCloudProgress();
        else { loadLocalProgress(); refreshCoinDisplays(); }
      });
    } else {
      loadLocalProgress();
      refreshCoinDisplays();
    }

    if (!state.unlockedLevels['1-1']) state.unlockedLevels['1-1'] = true;

    bindEvents();
    showScreen('screen-home');
    animateLeo('leo-home');
  }

  // ══════════════════════════════════════
  // DATA LOADING / SAVING
  // ══════════════════════════════════════
  function loadLocalProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem('bpc_progress') || '{}');
      state.coins = saved.coins || 0;
      state.unlockedLevels = saved.unlockedLevels || { '1-1': true };
      state.completedLevels = saved.completedLevels || {};
      state.stickers = saved.stickers || [];
    } catch (e) { /* ignore */ }
  }

  function saveLocalProgress() {
    localStorage.setItem('bpc_progress', JSON.stringify({
      coins: state.coins,
      unlockedLevels: state.unlockedLevels,
      completedLevels: state.completedLevels,
      stickers: state.stickers,
    }));
  }

  async function loadCloudProgress() {
    try {
      const doc = await db.collection('users').doc(currentUser.uid)
        .collection('gameProgress').doc('biblePuzzle').get();
      if (doc.exists) {
        const d = doc.data();
        state.coins = d.coins || 0;
        state.unlockedLevels = d.unlockedLevels || { '1-1': true };
        state.completedLevels = d.completedLevels || {};
        state.stickers = d.stickers || [];
      } else {
        loadLocalProgress();
      }
      refreshCoinDisplays();
    } catch (e) {
      loadLocalProgress();
      refreshCoinDisplays();
    }
  }

  async function saveProgress() {
    saveLocalProgress();
    if (!currentUser || !db) return;
    try {
      await db.collection('users').doc(currentUser.uid)
        .collection('gameProgress').doc('biblePuzzle').set({
          coins: state.coins,
          unlockedLevels: state.unlockedLevels,
          completedLevels: state.completedLevels,
          stickers: state.stickers,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) { /* silent */ }
  }

  // ══════════════════════════════════════
  // SCREEN NAVIGATION
  // ══════════════════════════════════════
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
    });
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('hidden');
      el.classList.add('active');
    }
  }

  function refreshCoinDisplays() {
    ['home-coin-count','world-coin-count','level-coin-count','sticker-coin-count'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = state.coins;
    });
  }

  // ══════════════════════════════════════
  // LEO ANIMATIONS
  // ══════════════════════════════════════
  function animateLeo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('leo-bounce');
    void el.offsetWidth;
    el.classList.add('leo-bounce');
  }

  // ══════════════════════════════════════
  // NARRATION
  // ══════════════════════════════════════
  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.88;
    utt.pitch = 1.1;
    utt.lang = 'en-US';
    const voices = window.speechSynthesis.getVoices();
    const female = voices.find(v =>
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('google uk english female'));
    if (female) utt.voice = female;
    window.speechSynthesis.speak(utt);
    animateLeo('leo-narrate');
  }

  // ══════════════════════════════════════
  // WORLD MAP
  // ══════════════════════════════════════
  function renderWorldMap() {
    const grid = document.getElementById('worlds-grid');
    grid.innerHTML = '';
    WORLDS.forEach(world => {
      const prog = getLevelProgress(world);
      const isLocked = prog.unlocked === 0;
      const card = document.createElement('div');
      card.className = 'world-card' + (isLocked ? ' locked' : '');
      card.style.background = world.bgGradient;
      card.style.borderColor = world.color;
      card.innerHTML = `
        <div class="world-emoji">${world.emoji}</div>
        <div class="world-name">${world.name}</div>
        <div class="world-progress-wrap">
          <div class="world-prog-bar" style="width:${prog.pct}%;background:${world.color}"></div>
        </div>
        <div class="world-prog-label">${prog.done}/${world.levels.length} levels</div>
        ${isLocked ? '<div class="world-lock">🔒</div>' : ''}
      `;
      if (!isLocked) card.addEventListener('click', () => openWorldLevels(world));
      grid.appendChild(card);
    });
  }

  function getLevelProgress(world) {
    let done = 0, unlocked = 0;
    world.levels.forEach(lvl => {
      const key = `${world.id}-${lvl.level}`;
      if (state.unlockedLevels[key]) unlocked++;
      if (state.completedLevels[key]) done++;
    });
    return { done, unlocked, pct: Math.round((done / world.levels.length) * 100) };
  }

  // ══════════════════════════════════════
  // LEVEL MAP
  // ══════════════════════════════════════
  function openWorldLevels(world) {
    state.currentWorld = world;
    document.getElementById('level-screen-title').textContent = world.name;
    document.getElementById('world-hero-emoji').textContent = world.emoji;
    document.getElementById('world-hero-desc').textContent = world.description;

    const list = document.getElementById('levels-list');
    list.innerHTML = '';
    world.levels.forEach(lvl => {
      const key = `${world.id}-${lvl.level}`;
      const unlocked = !!state.unlockedLevels[key];
      const completed = state.completedLevels[key];
      const stars = completed ? completed.stars : 0;
      const btn = document.createElement('button');
      btn.className = 'level-btn' + (unlocked ? '' : ' locked') + (completed ? ' done' : '');
      btn.style.setProperty('--world-color', world.color);
      btn.innerHTML = `
        <span class="lvl-num">${lvl.level}</span>
        <span class="lvl-name">${lvl.name}</span>
        <span class="lvl-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>
        ${!unlocked ? '<span class="lvl-lock">🔒</span>' : ''}
      `;
      if (unlocked) btn.addEventListener('click', () => startLevel(world, lvl));
      list.appendChild(btn);
    });
    showScreen('screen-levels');
  }

  // ══════════════════════════════════════
  // QUESTION ENGINE
  // ══════════════════════════════════════
  function startLevel(world, lvl) {
    state.currentWorld = world;
    state.currentLevelIdx = lvl.level;
    state.qIdx = 0;
    state.correctCount = 0;
    state.currentQuestions = lvl.questions
      .map(qid => QUESTIONS.find(q => q.id === qid))
      .filter(Boolean);
    showScreen('screen-question');
    renderQuestion();
  }

  function renderQuestion() {
    const q = state.currentQuestions[state.qIdx];
    if (!q) return;

    const pct = (state.qIdx / state.currentQuestions.length) * 100;
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('q-counter').textContent = `${state.qIdx + 1}/${state.currentQuestions.length}`;
    document.getElementById('question-text').textContent = q.question;
    document.getElementById('narrate-bubble').textContent = q.narration;

    document.querySelectorAll('.answer-area').forEach(a => a.classList.add('hidden'));

    switch (q.type) {
      case 'picture-pick': renderPicturePick(q); break;
      case 'who-is-this':  renderWhoIsThis(q);   break;
      case 'hear-tap':     renderHearTap(q);      break;
      case 'order-it':     renderOrderIt(q);      break;
      case 'true-false':   renderTrueFalse(q);    break;
    }

    setTimeout(() => speak(q.narration), 500);
  }

  function renderPicturePick(q) {
    const container = document.getElementById('choices-picture-pick');
    container.innerHTML = '';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-big';
      btn.textContent = opt;
      btn.addEventListener('click', () => handleAnswer(i === q.answer, q));
      container.appendChild(btn);
    });
    document.getElementById('area-picture-pick').classList.remove('hidden');
  }

  function renderWhoIsThis(q) {
    document.getElementById('clue-display').textContent = q.clue;
    const container = document.getElementById('choices-who-is-this');
    container.innerHTML = '';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-name';
      btn.textContent = opt;
      btn.addEventListener('click', () => handleAnswer(i === q.answer, q));
      container.appendChild(btn);
    });
    document.getElementById('area-who-is-this').classList.remove('hidden');
  }

  function renderHearTap(q) {
    document.getElementById('sentence-display').textContent = q.sentence;
    const container = document.getElementById('choices-hear-tap');
    container.innerHTML = '';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'word-tile';
      btn.textContent = opt;
      btn.addEventListener('click', () => handleAnswer(i === q.answer, q));
      container.appendChild(btn);
    });
    document.getElementById('area-hear-tap').classList.remove('hidden');
  }

  function renderOrderIt(q) {
    state.orderSelected = [];
    const itemsEl = document.getElementById('order-items');
    const slotsEl = document.getElementById('order-slots');
    itemsEl.innerHTML = '';
    slotsEl.innerHTML = '';

    const shuffled = q.items.map((text, i) => ({ text, origIdx: i }));
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    shuffled.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'order-item';
      btn.textContent = item.text;
      btn.dataset.origIdx = item.origIdx;
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.classList.add('selected');
        state.orderSelected.push(item.origIdx);
        const slot = slotsEl.children[state.orderSelected.length - 1];
        if (slot) { slot.textContent = item.text; slot.classList.add('filled'); }
        if (state.orderSelected.length === q.items.length) {
          const correct = state.orderSelected.every((v, idx) => v === q.answer[idx]);
          setTimeout(() => handleAnswer(correct, q), 300);
        }
      });
      itemsEl.appendChild(btn);
    });

    q.items.forEach(() => {
      const slot = document.createElement('div');
      slot.className = 'order-slot';
      slot.textContent = '?';
      slotsEl.appendChild(slot);
    });

    document.getElementById('area-order-it').classList.remove('hidden');
  }

  function renderTrueFalse(q) {
    document.getElementById('btn-true').onclick = () => handleAnswer(q.answer === true, q);
    document.getElementById('btn-false').onclick = () => handleAnswer(q.answer === false, q);
    document.getElementById('area-true-false').classList.remove('hidden');
  }

  // ══════════════════════════════════════
  // ANSWER + FEEDBACK
  // ══════════════════════════════════════
  function handleAnswer(correct, q) {
    if (correct) state.correctCount++;

    document.getElementById('feedback-icon').textContent = correct ? '🎉' : '💪';
    document.getElementById('feedback-title').textContent = correct ? 'Amazing!' : 'Good try!';
    document.getElementById('feedback-msg').textContent = q.feedback;
    document.getElementById('stars-earned').textContent = correct ? '⭐' : '';

    const overlay = document.getElementById('screen-feedback');
    overlay.classList.remove('hidden');
    overlay.classList.add('active');

    speak((correct ? 'Amazing! ' : 'Good try! ') + q.feedback);
  }

  function advanceQuestion() {
    const overlay = document.getElementById('screen-feedback');
    overlay.classList.remove('active');
    overlay.classList.add('hidden');
    state.qIdx++;
    if (state.qIdx < state.currentQuestions.length) {
      renderQuestion();
    } else {
      completeLevelFlow();
    }
  }

  // ══════════════════════════════════════
  // LEVEL COMPLETE
  // ══════════════════════════════════════
  function completeLevelFlow() {
    const world = state.currentWorld;
    const lvlIdx = state.currentLevelIdx;
    const key = `${world.id}-${lvlIdx}`;
    const total = state.currentQuestions.length;
    const allCorrect = state.correctCount === total;
    const pct = state.correctCount / total;

    // Stars (for display only — advancement requires 100%)
    let stars = 0;
    if (pct >= 0.6) stars = 1;
    if (pct >= 0.8) stars = 2;
    if (pct >= 1.0) stars = 3;

    const prev = state.completedLevels[key];
    if (!prev || prev.stars < stars) state.completedLevels[key] = { stars };

    const nextLvlIdx = lvlIdx + 1;
    const nextLvl = world.levels.find(l => l.level === nextLvlIdx);
    const isLastLevel = !nextLvl;

    // Only unlock the next level on a perfect score
    if (allCorrect) {
      if (nextLvl) {
        state.unlockedLevels[`${world.id}-${nextLvlIdx}`] = true;
      } else {
        const nextWorld = WORLDS.find(w => w.id === world.id + 1);
        if (nextWorld) state.unlockedLevels[`${nextWorld.id}-1`] = true;
      }
    }

    // Sticker only on perfect last-level finish
    const stickerUnlocked = isLastLevel && allCorrect && !state.stickers.includes(world.stickerName);
    if (stickerUnlocked) state.stickers.push(world.stickerName);

    // Coins only on perfect score
    const coinsEarned = allCorrect ? 10 : 0;
    state.coins += coinsEarned;

    saveProgress();
    refreshCoinDisplays();

    // UI — title and message
    document.getElementById('complete-title').textContent = allCorrect ? 'Level Complete! 🎉' : 'Almost There! 💪';
    document.getElementById('complete-message').textContent = allCorrect
      ? (isLastLevel ? 'You finished this world! Amazing!' : 'Perfect score — next level unlocked!')
      : `You got ${state.correctCount} out of ${total}. Get ALL ${total} right to unlock the next level!`;

    document.getElementById('complete-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);

    // Coins row
    const coinsRow = document.getElementById('complete-coins-row');
    coinsRow.style.display = allCorrect ? '' : 'none';
    document.getElementById('earned-coins').textContent = coinsEarned;

    // Sticker
    const stickerEl = document.getElementById('sticker-unlock');
    if (stickerUnlocked) {
      stickerEl.style.display = 'block';
      document.getElementById('sticker-big').textContent = world.sticker;
      document.getElementById('sticker-name').textContent = world.stickerName;
    } else {
      stickerEl.style.display = 'none';
    }

    // Navigation buttons
    const btnNext  = document.getElementById('btn-next-level');
    const btnRetry = document.getElementById('btn-retry-level');
    const thisLvl  = world.levels.find(l => l.level === lvlIdx);

    if (allCorrect) {
      btnRetry.style.display = 'none';
      btnNext.style.display = '';
      if (nextLvl) {
        btnNext.textContent = 'Next Level ▶';
        btnNext.onclick = () => startLevel(world, nextLvl);
      } else {
        btnNext.textContent = 'World Map 🗺️';
        btnNext.onclick = () => { renderWorldMap(); showScreen('screen-worlds'); };
      }
      spawnConfetti();
      speak('Wonderful! Perfect score! You earned ' + coinsEarned + ' stars!');
    } else {
      btnNext.style.display = 'none';
      btnRetry.style.display = '';
      btnRetry.onclick = () => startLevel(world, thisLvl);
      speak('Almost! You got ' + state.correctCount + ' out of ' + total + '. Try again to unlock the next level!');
    }

    showScreen('screen-level-complete');
  }

  // ══════════════════════════════════════
  // CONFETTI
  // ══════════════════════════════════════
  function spawnConfetti() {
    const area = document.getElementById('confetti-area');
    area.innerHTML = '';
    const emojis = ['🎉','⭐','🌟','🎊','💫','🦁'];
    for (let i = 0; i < 20; i++) {
      const s = document.createElement('span');
      s.className = 'confetti-piece';
      s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      s.style.left = Math.random() * 100 + '%';
      s.style.animationDelay = (Math.random() * 1) + 's';
      s.style.fontSize = (1 + Math.random() * 1.5) + 'rem';
      area.appendChild(s);
    }
  }

  // ══════════════════════════════════════
  // STICKER BOOK
  // ══════════════════════════════════════
  function renderStickerBook() {
    const grid = document.getElementById('sticker-grid');
    grid.innerHTML = '';
    WORLDS.forEach(world => {
      const earned = state.stickers.includes(world.stickerName);
      const el = document.createElement('div');
      el.className = 'sticker-slot' + (earned ? ' earned' : '');
      el.innerHTML = `
        <div class="sticker-emoji">${earned ? world.sticker : '❓'}</div>
        <div class="sticker-label">${earned ? world.stickerName : '???'}</div>
      `;
      grid.appendChild(el);
    });
  }

  // ══════════════════════════════════════
  // EVENT BINDING
  // ══════════════════════════════════════
  function bindEvents() {
    document.getElementById('btn-play').addEventListener('click', () => {
      renderWorldMap();
      showScreen('screen-worlds');
    });

    document.getElementById('back-to-home').addEventListener('click', () => showScreen('screen-home'));

    document.getElementById('back-to-worlds').addEventListener('click', () => {
      renderWorldMap();
      showScreen('screen-worlds');
    });

    document.getElementById('back-to-levels').addEventListener('click', () => {
      if (state.currentWorld) openWorldLevels(state.currentWorld);
    });

    document.getElementById('btn-next').addEventListener('click', advanceQuestion);

    document.getElementById('btn-world-map').addEventListener('click', () => {
      renderWorldMap();
      showScreen('screen-worlds');
    });

    document.getElementById('btn-reset-order').addEventListener('click', () => {
      const q = state.currentQuestions[state.qIdx];
      if (q && q.type === 'order-it') renderOrderIt(q);
    });

    document.getElementById('btn-speak').addEventListener('click', () => {
      const q = state.currentQuestions[state.qIdx];
      if (q) speak(q.narration);
    });

    document.getElementById('leo-home').addEventListener('click', () => {
      speak('Hi! I am Leo! Let us learn about the Bible together! Tap Play to start!');
      animateLeo('leo-home');
    });

    document.getElementById('back-to-home-from-stickers').addEventListener('click', () => showScreen('screen-home'));

    document.getElementById('btn-stickers').addEventListener('click', () => {
      renderStickerBook();
      showScreen('screen-stickers');
    });
  }

  // ══════════════════════════════════════
  // BOOT — wait for Firebase config fetch before starting
  // ══════════════════════════════════════
  function startApp() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // window.firebaseReady is the Promise set by firebase-config.js.
  // Wait for it (success or failure) so window.auth/window.db are populated.
  const firebaseWait = window.firebaseReady
    ? window.firebaseReady.catch(() => {})
    : Promise.resolve();

  firebaseWait.then(startApp);

})();
