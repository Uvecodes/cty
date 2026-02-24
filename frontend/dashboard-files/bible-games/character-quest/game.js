(function () {
  'use strict';

  // ══════════════════════════════════════
  // CONSTANTS
  // ══════════════════════════════════════
  const LEVEL_TITLES = [
    '', 'Seeker','Seeker','Seeker','Seeker','Seeker',
    'Wanderer','Wanderer','Wanderer','Wanderer','Wanderer',
    'Disciple','Disciple','Disciple','Disciple','Disciple',
    'Warrior','Warrior','Warrior','Warrior','Warrior',
    'Champion','Champion','Champion','Champion','Champion',
    'Prophet','Prophet','Prophet','Prophet','Prophet',
    'Apostle','Apostle','Apostle','Apostle','Apostle','Apostle','Apostle','Apostle','Apostle','Apostle',
    'Overcomer','Overcomer','Overcomer','Overcomer','Overcomer','Overcomer','Overcomer','Overcomer','Overcomer','Overcomer',
    'Legend','Legend','Legend','Legend','Legend','Legend','Legend','Legend','Legend','Legend'
  ];
  const XP_PER_LEVEL = 200; // XP needed per level (scales slightly)
  const FF_TIMER_SEC = 8;

  // ══════════════════════════════════════
  // STATE
  // ══════════════════════════════════════
  let ERAS = [], CHARACTERS = [], QUESTS = [], BOSSES = [], DAILY = [];
  let db = null, currentUser = null;

  let state = {
    // player
    playerLevel: 1, xp: 0, fp: 0,
    dailyStreak: 0, lastPlayedDate: null,
    // progress
    unlockedEras: { 1: true },
    characterProgress: {},   // { charId: { questsDone: {}, tierUnlocked: 'seeker', stars: 0 } }
    collectedCards: [],
    bossesDefeated: [],
    eraBadges: {},
    // daily
    dailyCompletedDate: null,
    // navigation
    currentEra: null, currentChar: null,
    currentTier: 'seeker', currentQuestList: [],
    currentQuestIdx: 0,
    // quest session
    questCorrect: 0, questTotal: 0,
    // fast-facts session
    ffStatements: [], ffIdx: 0, ffScore: 0, ffTimer: null,
    // deep-dive session
    ddParts: [], ddPartIdx: 0, ddTotalCorrect: 0,
    // boss session
    currentBoss: null, bossRoundIdx: 0, bossQuestionIdx: 0,
    playerHP: 3, bossProgress: 0, selectedHeroCard: null,
    // levelup queue
    levelupQueue: [],
  };

  // ══════════════════════════════════════
  // BOOT — wait for Firebase
  // ══════════════════════════════════════
  const firebaseWait = window.firebaseReady
    ? window.firebaseReady.catch(() => {})
    : Promise.resolve();

  firebaseWait.then(startApp);

  function startApp() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  async function init() {
    animateLoader();

    if (window.db) {
      db = window.db;
      window.auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) loadCloudProgress().then(afterProgressLoad);
        else { loadLocalProgress(); afterProgressLoad(); }
      });
    } else {
      loadLocalProgress();
      afterProgressLoad();
    }
  }

  async function afterProgressLoad() {
    try {
      [ERAS, CHARACTERS, QUESTS, BOSSES, DAILY] = await Promise.all([
        fetch('./data/eras.json').then(r => r.json()),
        fetch('./data/characters.json').then(r => r.json()),
        fetch('./data/quests.json').then(r => r.json()),
        fetch('./data/bosses.json').then(r => r.json()),
        fetch('./data/daily.json').then(r => r.json()),
      ]);
    } catch (e) {
      console.error('Failed to load game data:', e);
      document.getElementById('splash-loading-text').textContent = 'Failed to load. Check connection.';
      return;
    }

    checkStreak();
    initParticles();
    bindEvents();
    setTimeout(() => showScreen('screen-home'), 1200);
  }

  // ══════════════════════════════════════
  // LOADER ANIMATION
  // ══════════════════════════════════════
  function animateLoader() {
    const bar = document.getElementById('loader-bar');
    const text = document.getElementById('splash-loading-text');
    const steps = ['Loading heroes...','Loading quests...','Loading battles...','Ready!'];
    let pct = 0, step = 0;
    const iv = setInterval(() => {
      pct += 25;
      if (bar) bar.style.width = pct + '%';
      if (text && steps[step]) text.textContent = steps[step++];
      if (pct >= 100) clearInterval(iv);
    }, 280);
  }

  // ══════════════════════════════════════
  // PROGRESS — LOAD / SAVE
  // ══════════════════════════════════════
  function loadLocalProgress() {
    try {
      const s = JSON.parse(localStorage.getItem('cq_v2_progress') || '{}');
      Object.assign(state, s);
    } catch (e) { /* ignore */ }
    if (!state.unlockedEras) state.unlockedEras = { 1: true };
    if (!state.characterProgress) state.characterProgress = {};
    if (!state.collectedCards) state.collectedCards = [];
    if (!state.bossesDefeated) state.bossesDefeated = [];
    if (!state.eraBadges) state.eraBadges = {};
  }

  function saveLocalProgress() {
    const save = {
      playerLevel: state.playerLevel, xp: state.xp, fp: state.fp,
      dailyStreak: state.dailyStreak, lastPlayedDate: state.lastPlayedDate,
      unlockedEras: state.unlockedEras,
      characterProgress: state.characterProgress,
      collectedCards: state.collectedCards,
      bossesDefeated: state.bossesDefeated,
      eraBadges: state.eraBadges,
      dailyCompletedDate: state.dailyCompletedDate,
    };
    localStorage.setItem('cq_v2_progress', JSON.stringify(save));
  }

  async function loadCloudProgress() {
    try {
      const doc = await db.collection('users').doc(currentUser.uid)
        .collection('gameProgress').doc('characterQuest').get();
      if (doc.exists) {
        const d = doc.data();
        Object.keys(d).forEach(k => { if (k !== 'updatedAt') state[k] = d[k]; });
      } else {
        loadLocalProgress();
      }
    } catch (e) { loadLocalProgress(); }
  }

  async function saveProgress() {
    showSaveDot();
    saveLocalProgress();
    if (!currentUser || !db) { hideSaveDot(); return; }
    try {
      await db.collection('users').doc(currentUser.uid)
        .collection('gameProgress').doc('characterQuest').set({
          playerLevel: state.playerLevel, xp: state.xp, fp: state.fp,
          dailyStreak: state.dailyStreak, lastPlayedDate: state.lastPlayedDate,
          unlockedEras: state.unlockedEras,
          characterProgress: state.characterProgress,
          collectedCards: state.collectedCards,
          bossesDefeated: state.bossesDefeated,
          eraBadges: state.eraBadges,
          dailyCompletedDate: state.dailyCompletedDate,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) { /* silent */ }
    hideSaveDot();
  }

  function showSaveDot() {
    const el = document.getElementById('save-dot');
    if (el) el.classList.remove('hidden');
  }
  function hideSaveDot() {
    setTimeout(() => {
      const el = document.getElementById('save-dot');
      if (el) el.classList.add('hidden');
    }, 1500);
  }

  // ══════════════════════════════════════
  // STREAK CHECK
  // ══════════════════════════════════════
  function checkStreak() {
    const today = new Date().toISOString().slice(0, 10);
    if (!state.lastPlayedDate) {
      state.lastPlayedDate = today;
      state.dailyStreak = 1;
    } else {
      const last = new Date(state.lastPlayedDate);
      const now = new Date(today);
      const diff = Math.round((now - last) / 86400000);
      if (diff === 1) {
        state.dailyStreak = (state.dailyStreak || 0) + 1;
        state.lastPlayedDate = today;
      } else if (diff > 1) {
        state.dailyStreak = 1;
        state.lastPlayedDate = today;
      }
    }
    saveLocalProgress();
  }

  // ══════════════════════════════════════
  // XP / LEVEL / FP
  // ══════════════════════════════════════
  function addXP(amount) {
    state.xp += amount;
    let levelled = false;
    while (state.xp >= xpForLevel(state.playerLevel + 1) && state.playerLevel < 60) {
      state.playerLevel++;
      state.levelupQueue.push(state.playerLevel);
      levelled = true;
    }
    refreshHomeUI();
    return levelled;
  }

  function xpForLevel(lvl) {
    return XP_PER_LEVEL * lvl + Math.floor(lvl * lvl * 10);
  }

  function addFP(amount) {
    state.fp += amount;
    refreshAllFP();
  }

  function spendFP(amount) {
    if (state.fp < amount) return false;
    state.fp -= amount;
    refreshAllFP();
    return true;
  }

  function refreshAllFP() {
    ['home-fp-count','era-fp-count','hub-fp-count','card-fp-count'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = state.fp;
    });
  }

  function refreshHomeUI() {
    const xpNeeded = xpForLevel(state.playerLevel + 1);
    const xpPrev = xpForLevel(state.playerLevel);
    const pct = state.playerLevel >= 60 ? 100
      : Math.min(100, Math.round(((state.xp - xpPrev) / (xpNeeded - xpPrev)) * 100));

    setText('player-level-badge', 'Lv ' + state.playerLevel);
    setText('player-title', LEVEL_TITLES[Math.min(state.playerLevel, 60)] || 'Legend');
    setText('player-xp-text', state.xp + ' / ' + xpNeeded + ' XP');
    const fill = document.getElementById('player-xp-fill');
    if (fill) fill.style.width = pct + '%';

    setText('home-fp-count', state.fp);
    const flame = document.getElementById('streak-text');
    if (flame) flame.textContent = state.dailyStreak + ' day streak';

    const dailyDone = state.dailyCompletedDate === new Date().toISOString().slice(0,10);
    setText('daily-sub', dailyDone ? 'Come back tomorrow!' : 'Available now!');
    const dailyBtn = document.getElementById('daily-go-btn');
    if (dailyBtn) dailyBtn.disabled = dailyDone;

    refreshAllFP();
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

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ══════════════════════════════════════
  // PARTICLES (canvas)
  // ══════════════════════════════════════
  function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
      color: ['#7c3aed','#3b82f6','#fbbf24','#22c55e','#ec4899'][Math.floor(Math.random()*5)],
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    draw();

    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }

  // ══════════════════════════════════════
  // ERA MAP
  // ══════════════════════════════════════
  function renderEraMap() {
    const path = document.getElementById('era-path');
    path.innerHTML = '';
    ERAS.forEach((era, i) => {
      const unlocked = !!state.unlockedEras[era.id];
      const chars = CHARACTERS.filter(c => c.era === era.id);
      const done = chars.filter(c => charProgress(c.id).stars > 0).length;
      const pct = Math.round((done / chars.length) * 100);

      if (i > 0) {
        const conn = document.createElement('div');
        conn.className = 'era-connector';
        path.appendChild(conn);
      }

      const node = document.createElement('div');
      node.className = 'era-node' + (unlocked ? '' : ' locked');
      node.style.background = era.bgGradient;
      node.style.borderColor = unlocked ? era.color : 'transparent';
      if (unlocked) node.style.boxShadow = `0 4px 20px ${era.color}33`;
      node.innerHTML = `
        <div class="era-node-emoji">${era.emoji}</div>
        <div class="era-node-info">
          <div class="era-node-name">${era.name}</div>
          <div class="era-node-chars">${chars.length} Characters · Era ${era.id}</div>
        </div>
        <div class="era-node-prog">
          <div class="era-node-prog-bar">
            <div class="era-node-prog-fill" style="width:${pct}%;background:${era.color}"></div>
          </div>
          <span class="era-node-pct" style="color:${era.color}">${pct}%</span>
        </div>
        ${!unlocked ? `<div class="era-node-lock">🔒 ${era.unlockCost} ✨</div>` : ''}
      `;
      if (unlocked) {
        node.addEventListener('click', () => openEraHub(era));
      } else {
        node.addEventListener('click', () => {
          if (state.fp >= era.unlockCost && spendFP(era.unlockCost)) {
            state.unlockedEras[era.id] = true;
            saveProgress();
            renderEraMap();
          }
        });
      }
      path.appendChild(node);
    });
  }

  // ══════════════════════════════════════
  // ERA HUB
  // ══════════════════════════════════════
  function openEraHub(era) {
    state.currentEra = era;
    setText('era-hub-emoji', era.emoji);
    setText('era-hub-title', era.name);
    setText('era-hub-desc', era.description);
    document.getElementById('era-hub-bg').style.background = era.bgGradient;
    setText('hub-fp-count', state.fp);

    const grid = document.getElementById('era-characters-grid');
    grid.innerHTML = '';
    const chars = CHARACTERS.filter(c => c.era === era.id);

    chars.forEach((char, i) => {
      const progress = charProgress(char.id);
      const isUnlocked = canUnlockChar(char);
      const stars = progress.stars || 0;
      const done = Object.keys(progress.questsDone || {}).length;

      const card = document.createElement('div');
      card.className = `era-char-card ${char.rarity}${isUnlocked ? '' : ' locked'}`;
      card.style.animationDelay = (i * 0.06) + 's';
      card.innerHTML = `
        <div class="era-char-card-emoji">${char.emoji}</div>
        <div class="era-char-card-name">${char.name}</div>
        <div class="era-char-card-title">${char.title}</div>
        <div class="era-char-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
        <div class="era-char-progress">${done}/${char.totalQuests} quests</div>
        ${!isUnlocked ? `<div class="era-char-lock">🔒 ${char.unlockCost}✨</div>` : ''}
      `;
      if (isUnlocked) {
        card.addEventListener('click', () => openCharCard(char));
      } else {
        card.addEventListener('click', () => {
          if (state.fp >= char.unlockCost && spendFP(char.unlockCost)) {
            saveProgress();
            openEraHub(era);
          }
        });
      }
      grid.appendChild(card);
    });

    // Boss button
    const boss = BOSSES.find(b => b.eraId === era.id);
    const bossBtn = document.getElementById('btn-boss');
    const bossLock = document.getElementById('boss-lock-icon');
    const bossEmoji = document.getElementById('boss-btn-emoji');
    if (boss) {
      const allDone = chars.every(c => Object.keys(charProgress(c.id).questsDone || {}).length >= c.totalQuests);
      bossBtn.disabled = !allDone;
      if (bossEmoji) bossEmoji.textContent = boss.emoji;
      if (bossLock) bossLock.style.display = allDone ? 'none' : '';
      bossBtn.onclick = allDone ? () => startBoss(boss) : null;
    }

    showScreen('screen-era-hub');
  }

  function canUnlockChar(char) {
    return char.unlockCost === 0 || state.collectedCards.includes(char.id) || state.fp >= char.unlockCost;
  }

  function charProgress(charId) {
    if (!state.characterProgress[charId]) {
      state.characterProgress[charId] = { questsDone: {}, tierUnlocked: 'seeker', stars: 0 };
    }
    return state.characterProgress[charId];
  }

  // ══════════════════════════════════════
  // CHARACTER CARD (3D)
  // ══════════════════════════════════════
  function openCharCard(char) {
    state.currentChar = char;
    state.currentTier = charProgress(char.id).tierUnlocked || 'seeker';

    setText('char-card-era-badge', 'Era ' + char.era + ' · ' + (char.rarity.charAt(0).toUpperCase() + char.rarity.slice(1)));
    setText('char-card-fp-count', state.fp); // id is card-fp-count
    const fpEl = document.getElementById('card-fp-count');
    if (fpEl) fpEl.textContent = state.fp;

    // Front face
    setText('char-big-emoji', char.emoji);
    setText('char-card-name', char.name);
    setText('char-card-title', char.title);

    // Rarity glow
    const glow = document.getElementById('char-rarity-glow');
    if (glow) { glow.className = 'char-rarity-glow ' + char.rarity; }

    // Stats
    const stats = char.stats;
    ['faith','wisdom','courage','strength'].forEach(s => {
      const el = document.getElementById('stat-' + s);
      if (el) setTimeout(() => { el.style.width = (stats[s] * 10) + '%'; }, 300);
    });

    // Back face
    setText('char-bio-text', char.bio);
    setText('char-back-ref', 'Era ' + char.era + ' of 6');

    // Reset flip
    const card3d = document.getElementById('char-3d-card');
    if (card3d) card3d.classList.remove('flipped');

    // Tier buttons
    updateTierButtons(char);

    showScreen('screen-char-card');
  }

  function updateTierButtons(char) {
    const progress = charProgress(char.id);
    const done = Object.keys(progress.questsDone || {}).length;
    const tiers = ['seeker','explorer','warrior'];
    const thresholds = [0, 3, 6]; // quests done needed to unlock
    tiers.forEach((tier, i) => {
      const btn = document.getElementById('tier-btn-' + tier);
      if (!btn) return;
      const unlocked = done >= thresholds[i];
      btn.classList.remove('active','locked');
      if (!unlocked) { btn.classList.add('locked'); return; }
      if (tier === state.currentTier) btn.classList.add('active');
    });
  }

  // ══════════════════════════════════════
  // START QUEST SESSION
  // ══════════════════════════════════════
  function startQuests() {
    const char = state.currentChar;
    const tier = state.currentTier;
    const allQuests = QUESTS.filter(q => q.charId === char.id && q.tier === tier);
    if (!allQuests.length) {
      alert('No quests found for this tier yet!');
      return;
    }
    state.currentQuestList = allQuests;
    state.currentQuestIdx = 0;
    state.questCorrect = 0;
    state.questTotal = allQuests.length;

    // collect card
    if (!state.collectedCards.includes(char.id)) {
      state.collectedCards.push(char.id);
    }

    setText('quest-char-emoji', char.emoji);
    setText('quest-char-name', char.name);
    setText('quest-tier-tag', tier.charAt(0).toUpperCase() + tier.slice(1));
    renderQuest();
    showScreen('screen-quest');
  }

  function renderQuest() {
    const q = state.currentQuestList[state.currentQuestIdx];
    if (!q) return;

    const pct = (state.currentQuestIdx / state.questTotal) * 100;
    const bar = document.getElementById('quest-progress-bar');
    if (bar) bar.style.width = pct + '%';
    setText('quest-counter', (state.currentQuestIdx + 1) + '/' + state.questTotal);

    // Scenario + question
    const scenario = document.getElementById('question-scenario');
    const qtext = document.getElementById('question-text');
    if (scenario) scenario.textContent = q.scenario || '';
    if (qtext) qtext.textContent = q.question || q.instruction || '';

    // Hide all answer areas
    document.querySelectorAll('.answer-area').forEach(a => a.classList.add('hidden'));

    switch (q.type) {
      case 'decision':   renderDecision(q); break;
      case 'who-said':   renderWhoSaid(q);  break;
      case 'fill-in':    renderFillIn(q);   break;
      case 'timeline':   renderTimeline(q); break;
      case 'scramble':   renderScramble(q); break;
      case 'fast-facts': renderFastFacts(q); break;
      case 'deep-dive':  renderDeepDive(q); break;
      default: renderDecision(q);
    }
  }

  // ══════════════════════════════════════
  // QUESTION RENDERERS
  // ══════════════════════════════════════

  // --- DECISION / WHO-SAID ---
  function renderDecision(q) {
    const grid = document.getElementById('choices-grid');
    grid.innerHTML = '';
    const choices = q.choices || [];
    choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = choice.text;
      btn.addEventListener('click', () => handleChoiceAnswer(choice.correct, q, btn, grid));
      grid.appendChild(btn);
    });
    document.getElementById('area-choice').classList.remove('hidden');
  }

  function renderWhoSaid(q) {
    const scenario = document.getElementById('question-scenario');
    if (scenario) scenario.textContent = q.quote ? '\u201c' + q.quote + '\u201d' : '';

    const grid = document.getElementById('choices-grid');
    grid.innerHTML = '';
    (q.characters || []).forEach((name, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = (q.emojis ? q.emojis[i] + ' ' : '') + name;
      btn.addEventListener('click', () => handleChoiceAnswer(i === q.answer, q, btn, grid));
      grid.appendChild(btn);
    });
    document.getElementById('area-choice').classList.remove('hidden');
  }

  function handleChoiceAnswer(correct, q, btn, grid) {
    grid.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
    btn.classList.add(correct ? 'correct' : 'wrong');
    // Highlight correct one if wrong
    if (!correct) {
      const btns = grid.querySelectorAll('.choice-btn');
      const choices = q.choices || q.characters || [];
      choices.forEach((c, i) => {
        const isCorrect = q.choices ? c.correct : i === q.answer;
        if (isCorrect && btns[i]) btns[i].classList.add('correct');
      });
    }
    setTimeout(() => showResult(correct, q), 700);
  }

  // --- FILL-IN ---
  function renderFillIn(q) {
    const verseEl = document.getElementById('fill-verse');
    const optsEl = document.getElementById('fill-options');
    verseEl.innerHTML = q.verse.replace('___', '<span class="fill-blank">___</span>');
    optsEl.innerHTML = '';
    const options = [...(q.options || [])];
    shuffleArr(options.map((text, i) => ({ text, origIdx: i }))).forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'fill-option';
      btn.textContent = opt.text;
      btn.addEventListener('click', () => {
        optsEl.querySelectorAll('.fill-option').forEach(b => b.disabled = true);
        const correct = opt.origIdx === q.answer;
        btn.classList.add(correct ? 'correct' : 'wrong');
        if (!correct) {
          optsEl.querySelectorAll('.fill-option').forEach(b => {
            if (b.textContent === q.options[q.answer]) b.classList.add('correct');
          });
        }
        verseEl.innerHTML = q.verse.replace('___', `<span class="fill-blank">${q.options[q.answer]}</span>`);
        setTimeout(() => showResult(correct, q), 700);
      });
      optsEl.appendChild(btn);
    });
    document.getElementById('area-fill-in').classList.remove('hidden');
  }

  // --- TIMELINE ---
  function renderTimeline(q) {
    const eventsEl = document.getElementById('timeline-events');
    const slotsEl = document.getElementById('timeline-slots');
    eventsEl.innerHTML = '';
    slotsEl.innerHTML = '';
    let selected = [];

    const events = q.events || [];
    const shuffled = shuffleArr([...events]);

    shuffled.forEach(ev => {
      const btn = document.createElement('button');
      btn.className = 'timeline-event-btn';
      btn.textContent = ev.text;
      btn.dataset.id = ev.id;
      btn.addEventListener('click', () => {
        if (btn.classList.contains('placed')) return;
        btn.classList.add('placed');
        selected.push(ev.id);
        const slot = slotsEl.children[selected.length - 1];
        if (slot) {
          slot.textContent = (selected.length) + '. ' + ev.text;
          slot.classList.add('filled');
        }
        if (selected.length === events.length) {
          const correct = selected.every((v, i) => v === q.answer[i]);
          eventsEl.querySelectorAll('.timeline-event-btn').forEach(b => b.disabled = true);
          Array.from(slotsEl.children).forEach(slot => {
            slot.classList.add(correct ? 'correct-slot' : 'wrong-slot');
          });
          setTimeout(() => showResult(correct, q), 800);
        }
      });
      eventsEl.appendChild(btn);
    });

    events.forEach((_, i) => {
      const slot = document.createElement('div');
      slot.className = 'timeline-slot';
      slot.textContent = (i+1) + '.';
      slotsEl.appendChild(slot);
    });

    document.getElementById('area-timeline').classList.remove('hidden');

    document.getElementById('btn-timeline-reset').onclick = () => {
      selected = [];
      eventsEl.querySelectorAll('.timeline-event-btn').forEach(b => {
        b.classList.remove('placed'); b.disabled = false;
      });
      Array.from(slotsEl.children).forEach((slot, i) => {
        slot.textContent = (i+1) + '.';
        slot.className = 'timeline-slot';
      });
    };
  }

  // --- SCRAMBLE ---
  function renderScramble(q) {
    const slotsEl = document.getElementById('scramble-slots');
    const wordsEl = document.getElementById('scramble-words');
    slotsEl.innerHTML = '';
    wordsEl.innerHTML = '';
    let placed = [];

    const words = q.words || [];
    const shuffled = shuffleArr(words.map((w, i) => ({ w, i })));

    shuffled.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'scramble-word-btn';
      btn.textContent = item.w;
      btn.dataset.origIdx = item.i;
      btn.addEventListener('click', () => {
        if (btn.classList.contains('used')) return;
        btn.classList.add('used');
        placed.push(item.i);
        const span = document.createElement('span');
        span.className = 'scramble-slot-item';
        span.textContent = item.w;
        slotsEl.appendChild(span);
        if (placed.length === words.length) {
          const correct = placed.every((v, i) => v === q.answer[i]);
          setTimeout(() => showResult(correct, q), 600);
        }
      });
      wordsEl.appendChild(btn);
    });

    document.getElementById('area-scramble').classList.remove('hidden');

    document.getElementById('btn-scramble-reset').onclick = () => {
      placed = [];
      slotsEl.innerHTML = '';
      wordsEl.querySelectorAll('.scramble-word-btn').forEach(b => b.classList.remove('used'));
    };
  }

  // --- FAST-FACTS ---
  function renderFastFacts(q) {
    if (state.ffTimer) clearInterval(state.ffTimer);
    state.ffStatements = shuffleArr([...(q.statements || [])]);
    state.ffIdx = 0;
    state.ffScore = 0;
    state.ffCurrentQ = q;
    document.getElementById('area-fast-facts').classList.remove('hidden');
    updateFFDisplay();
    startFFTimer();
  }

  function updateFFDisplay() {
    const stmt = state.ffStatements[state.ffIdx];
    if (!stmt) return;
    setText('ff-statement', stmt.text);
    setText('ff-score-text', state.ffScore + ' / ' + state.ffStatements.length);
  }

  function startFFTimer() {
    let remaining = FF_TIMER_SEC;
    const ring = document.getElementById('ff-ring-fill');
    const circumference = 113;
    setText('ff-timer-text', remaining);

    state.ffTimer = setInterval(() => {
      remaining--;
      setText('ff-timer-text', remaining);
      if (ring) {
        const offset = circumference * (1 - remaining / FF_TIMER_SEC);
        ring.style.strokeDashoffset = offset;
        ring.style.stroke = remaining <= 3 ? '#ef4444' : '#fbbf24';
      }
      if (remaining <= 0) {
        clearInterval(state.ffTimer);
        advanceFF(false); // timed out = wrong
      }
    }, 1000);
  }

  function handleFFAnswer(userAnswer) {
    if (state.ffTimer) clearInterval(state.ffTimer);
    const stmt = state.ffStatements[state.ffIdx];
    if (stmt.answer === userAnswer) state.ffScore++;
    advanceFF(stmt.answer === userAnswer);
  }

  function advanceFF(wasCorrect) {
    state.ffIdx++;
    if (state.ffIdx >= state.ffStatements.length) {
      // FF complete
      const total = state.ffStatements.length;
      const correct = state.ffScore >= total * 0.8;
      showResult(correct, state.ffCurrentQ, state.ffScore + '/' + total + ' correct!');
      return;
    }
    // Flash feedback
    const card = document.getElementById('ff-statement-card');
    if (card) {
      card.style.borderColor = wasCorrect ? '#22c55e' : '#ef4444';
      setTimeout(() => { card.style.borderColor = ''; }, 400);
    }
    updateFFDisplay();
    startFFTimer();
  }

  // --- DEEP-DIVE ---
  function renderDeepDive(q) {
    state.ddParts = q.parts || [];
    state.ddPartIdx = 0;
    state.ddTotalCorrect = 0;
    state.ddCurrentQ = q;
    renderDDPart();
    document.getElementById('area-deep-dive').classList.remove('hidden');
  }

  function renderDDPart() {
    const part = state.ddParts[state.ddPartIdx];
    if (!part) return;
    setText('dd-part-indicator', 'Part ' + part.part + ' of ' + state.ddParts.length);
    const choicesEl = document.getElementById('dd-choices');
    choicesEl.innerHTML = '';
    (part.choices || []).forEach((text, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        choicesEl.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
        const correct = i === part.answer;
        btn.classList.add(correct ? 'correct' : 'wrong');
        if (!correct && choicesEl.children[part.answer]) {
          choicesEl.children[part.answer].classList.add('correct');
        }
        if (correct) state.ddTotalCorrect++;
        setTimeout(() => {
          state.ddPartIdx++;
          if (state.ddPartIdx >= state.ddParts.length) {
            showResult(state.ddTotalCorrect === state.ddParts.length, state.ddCurrentQ);
          } else {
            renderDDPart();
          }
        }, 700);
      });
      choicesEl.appendChild(btn);
    });

    // Hint button
    const hintBtn = document.getElementById('btn-dd-hint');
    const hintText = document.getElementById('dd-hint-text');
    if (hintBtn) {
      hintBtn.onclick = () => {
        if (spendFP(5)) {
          if (hintText) {
            hintText.textContent = part.hint || '';
            hintText.classList.remove('hidden');
          }
        }
      };
    }
    if (hintText) hintText.classList.add('hidden');
  }

  // ══════════════════════════════════════
  // SHOW RESULT
  // ══════════════════════════════════════
  function showResult(correct, q, customMsg) {
    const xpGained = correct ? (q.xp || 50) : Math.floor((q.xp || 50) * 0.2);
    const fpGained = correct ? (q.fp || 10) : 0;

    if (correct) state.questCorrect++;
    addXP(xpGained);
    addFP(fpGained);

    // Track quest completion
    const char = state.currentChar;
    if (char && q && q.id) {
      const prog = charProgress(char.id);
      if (!prog.questsDone) prog.questsDone = {};
      prog.questsDone[q.id] = correct;
      // Unlock next tier
      const done = Object.keys(prog.questsDone).length;
      if (done >= 3 && prog.tierUnlocked === 'seeker') prog.tierUnlocked = 'explorer';
      if (done >= 6 && prog.tierUnlocked === 'explorer') prog.tierUnlocked = 'warrior';
      // Stars
      const totalDone = Object.keys(prog.questsDone).length;
      const totalCorrect = Object.values(prog.questsDone).filter(Boolean).length;
      const pct = totalDone > 0 ? totalCorrect / totalDone : 0;
      prog.stars = pct >= 1 ? 3 : pct >= 0.8 ? 2 : pct >= 0.6 ? 1 : 0;
    }

    saveProgress();

    // UI
    setText('result-big-icon', correct ? '🎉' : '💪');
    setText('result-title', correct ? 'Amazing!' : 'Keep Going!');
    setText('result-msg', customMsg || (correct ? 'That\'s correct!' : 'Not quite — the answer is highlighted above.'));
    setText('result-scripture-ref', q.scriptureRef || '');
    setText('result-scripture-text', q.scriptureText || q.feedback || '');
    setText('result-xp', '+' + xpGained + ' XP');
    setText('result-fp', fpGained > 0 ? '+' + fpGained + ' ✨' : '');
    setText('result-feedback', q.feedback || '');

    const card = document.getElementById('result-card');
    if (card) card.className = 'result-card ' + (correct ? 'correct' : 'wrong');

    const nextBtn = document.getElementById('btn-result-next');
    const retryBtn = document.getElementById('btn-result-retry');
    if (nextBtn) nextBtn.classList.toggle('hidden', false);
    if (retryBtn) retryBtn.classList.toggle('hidden', true);

    const overlay = document.getElementById('screen-result');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.classList.add('active');
    }

    // Check level-up queue
    if (state.levelupQueue.length > 0) {
      setTimeout(showLevelUp, 800);
    }
  }

  function advanceQuest() {
    const overlay = document.getElementById('screen-result');
    if (overlay) { overlay.classList.remove('active'); overlay.classList.add('hidden'); }

    state.currentQuestIdx++;
    if (state.currentQuestIdx < state.questTotal) {
      renderQuest();
    } else {
      showQuestComplete();
    }
  }

  function showQuestComplete() {
    // Return to character card
    openCharCard(state.currentChar);
    // Simple feedback via result overlay
    const correct = state.questCorrect;
    const total = state.questTotal;
    setText('result-big-icon', correct === total ? '🏆' : '⭐');
    setText('result-title', correct === total ? 'Perfect!' : 'Tier Complete!');
    setText('result-msg', correct + '/' + total + ' correct');
    setText('result-scripture-ref', '');
    setText('result-scripture-text', '');
    setText('result-xp', '');
    setText('result-fp', '');
    setText('result-feedback', correct === total ? 'Flawless! All quests correct — the next tier is now open.' : 'Good effort! Keep practising to earn more stars.');
    const nextBtn = document.getElementById('btn-result-next');
    if (nextBtn) { nextBtn.textContent = 'Back to Hero Card'; nextBtn.classList.remove('hidden'); }
    const retryBtn = document.getElementById('btn-result-retry');
    if (retryBtn) retryBtn.classList.add('hidden');
    const overlay = document.getElementById('screen-result');
    if (overlay) { overlay.classList.remove('hidden'); overlay.classList.add('active'); }
  }

  // ══════════════════════════════════════
  // BOSS BATTLE
  // ══════════════════════════════════════
  function startBoss(boss) {
    state.currentBoss = boss;
    state.bossRoundIdx = 0;
    state.bossQuestionIdx = 0;
    state.playerHP = 3;
    state.bossProgress = 0;
    state.selectedHeroCard = null;

    setText('boss-emoji-display', boss.emoji);
    setText('boss-name-display', boss.name);
    setText('boss-taunt', boss.tagline);
    document.getElementById('boss-bg').style.background = ERAS.find(e => e.id === boss.eraId)?.bgGradient || '';

    // HP hearts
    ['hp1','hp2','hp3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = '❤️'; el.classList.remove('lost'); }
    });

    renderBossRound();
    showScreen('screen-boss');

    // Boss entrance animation
    const bossEmoji = document.getElementById('boss-emoji-display');
    if (bossEmoji) { bossEmoji.classList.add('boss-entering'); bossEmoji.addEventListener('animationend', () => bossEmoji.classList.remove('boss-entering'), { once: true }); }
  }

  function renderBossRound() {
    const boss = state.currentBoss;
    const round = boss.rounds[state.bossRoundIdx];
    if (!round) { bossVictory(); return; }

    setText('boss-round-label', 'Round ' + round.round);
    state.bossQuestionIdx = 0;

    // Hero cards selection
    const cardRow = document.getElementById('boss-card-row');
    cardRow.innerHTML = '';
    const collected = state.collectedCards.slice(0, 5);
    collected.forEach(charId => {
      const char = CHARACTERS.find(c => c.id === charId);
      if (!char) return;
      const card = document.createElement('div');
      card.className = 'boss-hero-card';
      card.innerHTML = `<div class="boss-hero-emoji">${char.emoji}</div><div class="boss-hero-name">${char.name}</div>`;
      card.addEventListener('click', () => {
        cardRow.querySelectorAll('.boss-hero-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.selectedHeroCard = charId;
      });
      cardRow.appendChild(card);
    });

    renderBossQuestion();
  }

  function renderBossQuestion() {
    const round = state.currentBoss.rounds[state.bossRoundIdx];
    const q = round.questions[state.bossQuestionIdx];
    if (!q) {
      // Round done
      state.bossRoundIdx++;
      const pct = ((state.bossRoundIdx) / state.currentBoss.rounds.length) * 100;
      const bar = document.getElementById('boss-progress-bar');
      if (bar) bar.style.width = pct + '%';
      if (state.bossRoundIdx >= state.currentBoss.rounds.length) {
        bossVictory();
      } else {
        renderBossRound();
      }
      return;
    }

    setText('boss-question-text', q.scenario ? q.scenario + ' — ' + q.question : q.question || q.verse || '');
    const choicesEl = document.getElementById('boss-choices');
    choicesEl.innerHTML = '';

    const choices = q.choices || q.characters || [];
    const isWhoSaid = q.type === 'who-said';

    choices.forEach((choice, i) => {
      const b = document.createElement('button');
      b.className = 'choice-btn';
      b.textContent = isWhoSaid ? ((q.emojis?.[i] || '') + ' ' + choice) : (typeof choice === 'object' ? choice.text : choice);
      b.addEventListener('click', () => {
        choicesEl.querySelectorAll('.choice-btn').forEach(c => c.disabled = true);
        const correct = isWhoSaid ? i === q.answer : (typeof choice === 'object' ? choice.correct : i === q.answer);
        b.classList.add(correct ? 'correct' : 'wrong');
        if (!correct) {
          state.playerHP--;
          updateBossHP();
          if (state.playerHP <= 0) {
            setTimeout(bossRetry, 800);
            return;
          }
        }
        state.bossQuestionIdx++;
        setTimeout(renderBossQuestion, 700);
      });
      choicesEl.appendChild(b);
    });

    // fill-in boss question
    if (q.type === 'fill-in' && q.verse) {
      setText('boss-question-text', q.verse);
      choicesEl.innerHTML = '';
      (q.options || []).forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'choice-btn';
        b.textContent = opt;
        b.addEventListener('click', () => {
          choicesEl.querySelectorAll('.choice-btn').forEach(c => c.disabled = true);
          const correct = i === q.answer;
          b.classList.add(correct ? 'correct' : 'wrong');
          if (!correct) {
            state.playerHP--;
            updateBossHP();
            if (state.playerHP <= 0) { setTimeout(bossRetry, 800); return; }
          }
          state.bossQuestionIdx++;
          setTimeout(renderBossQuestion, 700);
        });
        choicesEl.appendChild(b);
      });
    }
  }

  function updateBossHP() {
    const ids = ['hp1','hp2','hp3'];
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('lost', i >= state.playerHP);
    });
    // Screen shake
    const wrap = document.getElementById('game-wrap');
    if (wrap) { wrap.classList.add('shake'); wrap.addEventListener('animationend', () => wrap.classList.remove('shake'), { once: true }); }
  }

  function bossRetry() {
    state.playerHP = 3;
    state.bossQuestionIdx = 0;
    updateBossHP();
    renderBossRound();
  }

  function bossVictory() {
    const boss = state.currentBoss;
    if (!state.bossesDefeated.includes(boss.id)) {
      state.bossesDefeated.push(boss.id);
    }
    // Unlock next era
    const nextEraId = boss.eraId + 1;
    state.unlockedEras[nextEraId] = true;
    // Badge
    state.eraBadges[boss.eraId] = { badge: boss.rewards.badge, name: boss.rewards.badgeName };
    addXP(boss.rewards.xp);
    addFP(boss.rewards.fp);
    saveProgress();

    // Defeat screen
    setText('defeat-boss-name', boss.name + ' Defeated!');
    setText('badge-big', boss.rewards.badge);
    setText('badge-name', boss.rewards.badgeName);
    setText('defeat-xp', '+' + boss.rewards.xp + ' XP');
    setText('defeat-fp', '+' + boss.rewards.fp + ' ✨');

    const nextEra = ERAS.find(e => e.id === nextEraId);
    const continueBtn = document.getElementById('btn-defeat-continue');
    if (continueBtn) {
      if (nextEra) {
        continueBtn.textContent = 'Enter ' + nextEra.name + ' ▶';
        continueBtn.onclick = () => { renderEraMap(); showScreen('screen-era-map'); };
      } else {
        continueBtn.textContent = 'You Are A Legend! 🏆';
        continueBtn.onclick = () => showScreen('screen-home');
      }
    }

    spawnDefeatConfetti();
    showScreen('screen-boss-defeat');
  }

  function spawnDefeatConfetti() {
    const area = document.getElementById('defeat-confetti');
    area.innerHTML = '';
    const emojis = ['🎉','⭐','🌟','🎊','💫','⚔️','🛡️','👑'];
    for (let i = 0; i < 50; i++) {
      const s = document.createElement('span');
      s.className = 'confetti-piece';
      s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      s.style.left = Math.random() * 100 + '%';
      s.style.animationDuration = (2 + Math.random() * 3) + 's';
      s.style.animationDelay = (Math.random() * 2) + 's';
      s.style.fontSize = (1 + Math.random()) + 'rem';
      area.appendChild(s);
    }
  }

  // ══════════════════════════════════════
  // DAILY CHALLENGE
  // ══════════════════════════════════════
  function openDailyChallenge() {
    const today = new Date().toISOString().slice(0, 10);
    const dayIndex = (new Date(today).getTime() / 86400000) % DAILY.length | 0;
    const q = DAILY[Math.abs(dayIndex) % DAILY.length];
    if (!q) return;

    setText('daily-streak-num', state.dailyStreak);
    setText('daily-question-text', q.verse || q.quote || q.question || '');

    const area = document.getElementById('daily-answer-area');
    area.innerHTML = '';
    area.className = 'answer-area';

    const isDone = state.dailyCompletedDate === today;

    if (isDone) {
      area.innerHTML = '<p style="color:#22c55e;font-weight:700;text-align:center;padding:20px;">✅ Completed today! Come back tomorrow.</p>';
    } else {
      if (q.type === 'fill-in') {
        const verseDiv = document.createElement('div');
        verseDiv.className = 'fill-verse';
        verseDiv.innerHTML = q.verse.replace('___', '<span class="fill-blank">___</span>');
        area.appendChild(verseDiv);
        const opts = document.createElement('div');
        opts.className = 'fill-options';
        (q.options || []).forEach((opt, i) => {
          const btn = document.createElement('button');
          btn.className = 'fill-option';
          btn.textContent = opt;
          btn.addEventListener('click', () => {
            opts.querySelectorAll('.fill-option').forEach(b => b.disabled = true);
            const correct = i === q.answer;
            btn.classList.add(correct ? 'correct' : 'wrong');
            completeDailyChallenge(correct, q);
          });
          opts.appendChild(btn);
        });
        area.appendChild(opts);
      } else if (q.type === 'who-said') {
        const choices = document.createElement('div');
        choices.className = 'choices-grid';
        (q.characters || []).forEach((name, i) => {
          const btn = document.createElement('button');
          btn.className = 'choice-btn';
          btn.textContent = (q.emojis?.[i] || '') + ' ' + name;
          btn.addEventListener('click', () => {
            choices.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
            const correct = i === q.answer;
            btn.classList.add(correct ? 'correct' : 'wrong');
            completeDailyChallenge(correct, q);
          });
          choices.appendChild(btn);
        });
        area.appendChild(choices);
      } else if (q.type === 'decision') {
        const choices = document.createElement('div');
        choices.className = 'choices-grid';
        (q.choices || []).forEach(choice => {
          const btn = document.createElement('button');
          btn.className = 'choice-btn';
          btn.textContent = choice.text;
          btn.addEventListener('click', () => {
            choices.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
            btn.classList.add(choice.correct ? 'correct' : 'wrong');
            completeDailyChallenge(choice.correct, q);
          });
          choices.appendChild(btn);
        });
        area.appendChild(choices);
      }
    }

    startDailyCountdown();
    showScreen('screen-daily');
  }

  function completeDailyChallenge(correct, q) {
    const today = new Date().toISOString().slice(0, 10);
    state.dailyCompletedDate = today;
    const xp = correct ? (q.xp * 3) : q.xp;
    const fp = correct ? (q.fp * 3) : 0;
    addXP(xp); addFP(fp);
    saveProgress();
    setTimeout(() => {
      setText('result-big-icon', correct ? '📅' : '💪');
      setText('result-title', correct ? 'Daily Complete!' : 'Keep Trying!');
      setText('result-msg', correct ? '3× XP earned!' : 'Check tomorrow for a new challenge!');
      setText('result-scripture-ref', q.scriptureRef || '');
      setText('result-scripture-text', '');
      setText('result-xp', '+' + xp + ' XP');
      setText('result-fp', fp > 0 ? '+' + fp + ' ✨' : '');
      setText('result-feedback', q.feedback || '');
      const nextBtn = document.getElementById('btn-result-next');
      if (nextBtn) { nextBtn.textContent = 'Continue ▶'; nextBtn.classList.remove('hidden'); }
      const overlay = document.getElementById('screen-result');
      if (overlay) { overlay.classList.remove('hidden'); overlay.classList.add('active'); }
    }, 700);
  }

  function startDailyCountdown() {
    const countEl = document.getElementById('daily-countdown');
    function update() {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight - now;
      const h = Math.floor(diff / 3600000).toString().padStart(2,'0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2,'0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2,'0');
      if (countEl) countEl.textContent = h + ':' + m + ':' + s;
    }
    update();
    setInterval(update, 1000);
  }

  // ══════════════════════════════════════
  // HALL OF HEROES
  // ══════════════════════════════════════
  function renderHallOfHeroes(filter) {
    const grid = document.getElementById('heroes-grid');
    grid.innerHTML = '';
    const chars = filter && filter !== 'all'
      ? CHARACTERS.filter(c => c.rarity === filter)
      : CHARACTERS;

    chars.forEach(char => {
      const collected = state.collectedCards.includes(char.id);
      const progress = charProgress(char.id);
      const stars = progress.stars || 0;

      const slot = document.createElement('div');
      slot.className = 'hero-slot ' + (collected ? char.rarity : 'silhouette');

      if (collected) {
        slot.innerHTML = `
          <div class="hero-slot-inner">
            <div class="hero-rarity-pip"></div>
            <div class="hero-slot-emoji">${char.emoji}</div>
            <div class="hero-slot-name">${char.name}</div>
            <div class="hero-slot-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
          </div>
        `;
        slot.addEventListener('click', () => {
          state.currentChar = char;
          openCharCard(char);
        });
      } else {
        slot.innerHTML = `
          <div class="hero-slot-inner">
            <div class="hero-slot-emoji">${char.emoji}</div>
            <div class="hero-slot-name">???</div>
            <div class="hero-slot-stars">☆☆☆</div>
          </div>
        `;
      }
      grid.appendChild(slot);
    });
  }

  // ══════════════════════════════════════
  // LEVEL-UP
  // ══════════════════════════════════════
  function showLevelUp() {
    const level = state.levelupQueue.shift();
    if (!level) return;
    setText('levelup-level', 'Level ' + level);
    setText('levelup-new-title', LEVEL_TITLES[Math.min(level, 60)] || 'Legend');
    const overlay = document.getElementById('levelup-overlay');
    if (overlay) overlay.classList.remove('hidden');
  }

  // ══════════════════════════════════════
  // HELPER
  // ══════════════════════════════════════
  function shuffleArr(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ══════════════════════════════════════
  // EVENT BINDING
  // ══════════════════════════════════════
  function bindEvents() {
    refreshHomeUI();

    // HOME
    document.getElementById('btn-home-play').addEventListener('click', () => {
      renderEraMap();
      showScreen('screen-era-map');
    });
    document.getElementById('btn-home-heroes').addEventListener('click', () => {
      renderHallOfHeroes('all');
      showScreen('screen-heroes');
    });
    document.getElementById('daily-go-btn').addEventListener('click', openDailyChallenge);
    document.getElementById('daily-banner').addEventListener('click', openDailyChallenge);

    // ERA MAP → HOME
    document.getElementById('back-era-to-home').addEventListener('click', () => showScreen('screen-home'));

    // ERA HUB → ERA MAP
    document.getElementById('back-hub-to-era').addEventListener('click', () => {
      renderEraMap(); showScreen('screen-era-map');
    });

    // CHAR CARD → ERA HUB
    document.getElementById('back-card-to-hub').addEventListener('click', () => {
      if (state.currentEra) openEraHub(state.currentEra);
    });

    // 3D flip
    document.getElementById('char-3d-scene').addEventListener('click', () => {
      const card = document.getElementById('char-3d-card');
      if (card) card.classList.toggle('flipped');
    });

    // Tier buttons
    ['seeker','explorer','warrior'].forEach(tier => {
      const btn = document.getElementById('tier-btn-' + tier);
      if (btn) btn.addEventListener('click', () => {
        if (btn.classList.contains('locked')) return;
        state.currentTier = tier;
        document.querySelectorAll('.tier-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Start quest
    document.getElementById('btn-start-quest').addEventListener('click', startQuests);

    // QUEST → CHAR CARD
    document.getElementById('back-quest-to-card').addEventListener('click', () => {
      if (state.currentChar) openCharCard(state.currentChar);
    });

    // Fast-facts buttons
    document.getElementById('btn-ff-true').addEventListener('click', () => handleFFAnswer(true));
    document.getElementById('btn-ff-false').addEventListener('click', () => handleFFAnswer(false));

    // RESULT overlay — next
    document.getElementById('btn-result-next').addEventListener('click', () => {
      const overlay = document.getElementById('screen-result');
      if (overlay) { overlay.classList.remove('active'); overlay.classList.add('hidden'); }
      const nextBtn = document.getElementById('btn-result-next');
      if (nextBtn) nextBtn.textContent = 'Continue ▶';
      if (state.currentQuestIdx < state.questTotal) {
        advanceQuest();
      } else {
        if (state.currentChar) openCharCard(state.currentChar);
        else showScreen('screen-home');
      }
    });

    // HEROES filter
    document.getElementById('heroes-filter-row').addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderHallOfHeroes(btn.dataset.filter);
    });

    // HEROES → HOME
    document.getElementById('back-heroes-to-home').addEventListener('click', () => showScreen('screen-home'));

    // DAILY → HOME
    document.getElementById('back-daily-to-home').addEventListener('click', () => showScreen('screen-home'));

    // BOSS DEFEAT buttons
    document.getElementById('btn-defeat-map').addEventListener('click', () => {
      renderEraMap(); showScreen('screen-era-map');
    });

    // LEVEL-UP ok
    document.getElementById('btn-levelup-ok').addEventListener('click', () => {
      const overlay = document.getElementById('levelup-overlay');
      if (overlay) overlay.classList.add('hidden');
      if (state.levelupQueue.length > 0) setTimeout(showLevelUp, 300);
    });
  }

})();
