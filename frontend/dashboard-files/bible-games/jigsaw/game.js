(function () {
'use strict';

// ══════════════════════════════════════
// CONFIG
// ══════════════════════════════════════
const TAB       = 0.30;   // tab height as fraction of piece edge
const SNAP_R    = 0.45;   // snap radius as fraction of piece size
const SCENE_W   = 600;
const SCENE_H   = 600;

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════
let LEVELS = [];
let db = null, currentUser = null;

let state = {
  currentScreen: 'splash',
  currentLevel: null,
  pieces: [],
  dragPiece: null,
  dragOffX: 0, dragOffY: 0,
  placedCount: 0,
  timeLeft: 0,
  timerInterval: null,
  hintsLeft: 0,
  hintActive: false,
  hintTimer: null,
  paused: false,
  score: 0,
  progress: { completed: {}, stars: {} },  // levelId -> stars (1-3)
  eraFilter: 'all'
};

// ══════════════════════════════════════
// CANVAS / DOM REFS
// ══════════════════════════════════════
let puzzleCanvas, pCtx;
let sceneCanvas;        // offscreen — full scene
let boardX, boardY, boardW, boardH;
let pieceW, pieceH, tabPx;
let isMobile = false;

// ══════════════════════════════════════
// SCENE ICONS (per level)
// ══════════════════════════════════════
const SCENE_ICONS = [
  '🌳','⛵','🌈','🌟','🌾','🔥','🌊','⛰️','🍞','🏯',
  '⚔️','🏛️','🔥','🦁','🐋','⭐','⛰️','🌊','🍷','✝️'
];

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
async function init() {
  try {
    const r = await fetch('./data/levels.json');
    LEVELS = await r.json();
  } catch(e) {
    console.error('Failed to load levels:', e);
    LEVELS = [];
  }

  loadProgress();

  puzzleCanvas = document.getElementById('puzzle-canvas');
  pCtx = puzzleCanvas.getContext('2d');
  sceneCanvas = document.createElement('canvas');
  sceneCanvas.width = SCENE_W;
  sceneCanvas.height = SCENE_H;

  isMobile = window.innerWidth < 768;
  window.addEventListener('resize', () => { isMobile = window.innerWidth < 768; resizeCanvas(); });

  bindNav();

  // Firebase
  const fw = window.firebaseReady ? window.firebaseReady.catch(() => {}) : Promise.resolve();
  fw.then(() => {
    if (window.db) {
      db = window.db;
      window.auth.onAuthStateChanged(u => { currentUser = u; });
    }
  });

  // Splash
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
  if (id === 'home') updateHomeStats();
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
  document.getElementById('btn-abandon').onclick = () => { stopTimer(); showScreen('levels'); };

  // Complete
  document.getElementById('btn-next-level').onclick = goNextLevel;
  document.getElementById('btn-replay').onclick = () => startLevel(state.currentLevel);
  document.getElementById('btn-complete-menu').onclick = () => showScreen('home');

  // How to Play
  document.getElementById('btn-howto-back').onclick = () => showScreen('home');
  document.getElementById('btn-howto-play').onclick = () => {
    const next = nextUnlocked();
    if (next) openPreLevel(next);
    else showScreen('levels');
  };

  // Puzzle canvas events
  puzzleCanvas.addEventListener('pointerdown', onDown, { passive: false });
  puzzleCanvas.addEventListener('pointermove', onMove, { passive: false });
  puzzleCanvas.addEventListener('pointerup', onUp);
  puzzleCanvas.addEventListener('pointercancel', onUp);
  puzzleCanvas.addEventListener('contextmenu', e => { e.preventDefault(); rotateDragging(); });
  let lastTap = 0;
  puzzleCanvas.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTap < 350) rotateDragging(e);
    lastTap = now;
  });
  document.addEventListener('keydown', e => { if (e.key === 'r' || e.key === 'R') rotateDragging(); });
}

// ══════════════════════════════════════
// HOME STATS
// ══════════════════════════════════════
function updateHomeStats() {
  const done = Object.keys(state.progress.stars).length;
  const totalStars = Object.values(state.progress.stars).reduce((a,b) => a+b, 0);
  document.getElementById('stat-done').textContent = done;
  document.getElementById('stat-stars').textContent = totalStars;
  const lastId = Math.max(0, ...Object.keys(state.progress.stars).map(Number));
  const lastLevel = LEVELS.find(l => l.id === lastId);
  document.getElementById('stat-era').textContent = lastLevel ? lastLevel.era.split(' ')[1] || lastLevel.era : '—';

  // Spawn home particles
  const container = document.getElementById('home-particles');
  container.innerHTML = '';
  const icons = ['✝️','🕊️','⭐','🙏','📖','🌟','🧩','🌈'];
  icons.forEach((ic, i) => {
    const span = document.createElement('span');
    span.textContent = ic;
    span.style.left = (10 + i * 12) + '%';
    span.style.top = (20 + (i % 3) * 25) + '%';
    span.style.animationDelay = (i * 0.8) + 's';
    span.style.animationDuration = (6 + i % 3) + 's';
    container.appendChild(span);
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

  const eras = ['all', ...new Set(LEVELS.map(l => l.era))];
  const tabsEl = document.getElementById('era-tabs');
  tabsEl.innerHTML = '';
  eras.forEach(era => {
    const t = document.createElement('button');
    t.className = 'era-tab' + (era === state.eraFilter ? ' active' : '');
    t.textContent = era === 'all' ? 'All Levels' : era;
    t.onclick = () => { state.eraFilter = era; buildLevelGrid(); };
    tabsEl.appendChild(t);
  });

  const grid = document.getElementById('levels-grid');
  grid.innerHTML = '';
  LEVELS.filter(l => state.eraFilter === 'all' || l.era === state.eraFilter).forEach((level, idx) => {
    const unlocked = isUnlocked(level.id);
    const stars = state.progress.stars[level.id] || 0;
    const card = document.createElement('div');
    card.className = 'level-card' + (!unlocked ? ' locked' : '') + (stars > 0 ? ' completed' : '');
    card.innerHTML = `
      <span class="lc-num">Level ${level.id}</span>
      <span class="lc-icon">${SCENE_ICONS[level.id - 1]}</span>
      <span class="lc-title">${level.title}</span>
      <span class="lc-tag">${level.tag}</span>
      <span class="lc-grid">${level.grid}×${level.grid}</span>
      <div class="lc-stars">
        <span class="${stars >= 1 ? 'earned' : ''}">⭐</span>
        <span class="${stars >= 2 ? 'earned' : ''}">⭐</span>
        <span class="${stars >= 3 ? 'earned' : ''}">⭐</span>
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
// PRE-LEVEL SCREEN
// ══════════════════════════════════════
function openPreLevel(level) {
  state.currentLevel = level;
  showScreen('prelevel');

  document.getElementById('pre-tag').textContent = level.tag;
  document.getElementById('pre-title').textContent = level.title;
  document.getElementById('pre-subtitle').textContent = level.subtitle;
  document.getElementById('pre-grid-size').textContent = `${level.grid}×${level.grid} grid — ${level.grid*level.grid} pieces`;
  document.getElementById('pre-time').textContent = formatTime(level.timeLimit);
  document.getElementById('pre-hints').textContent = level.hints === 0 ? 'No hints available' : `${level.hints} hint${level.hints > 1 ? 's' : ''} available`;
  document.getElementById('pre-verse').textContent = '"' + level.verse + '"';
  document.getElementById('pre-ref').textContent = '— ' + level.scripture;
  document.getElementById('pre-grid-label').textContent = `${level.grid}×${level.grid}`;

  const rotRow = document.getElementById('pre-rotation-row');
  rotRow.style.display = level.rotation ? '' : 'none';

  const starsEl = document.getElementById('pre-stars-display');
  const earned = state.progress.stars[level.id] || 0;
  starsEl.innerHTML = '⭐'.repeat(3).split('').map((s,i) => `<span class="${i < earned ? 'earned' : ''}">${s}</span>`).join('');

  // Draw preview
  const pc = document.getElementById('pre-canvas');
  const sz = pc.parentElement.offsetWidth || 300;
  pc.width = sz; pc.height = sz;
  drawScene(level.scene, pc.getContext('2d'), sz, sz);
  // Draw grid lines
  const pc2 = pc.getContext('2d');
  const g = level.grid;
  pc2.strokeStyle = 'rgba(255,255,255,0.25)';
  pc2.lineWidth = 1.5;
  for (let i = 1; i < g; i++) {
    pc2.beginPath(); pc2.moveTo(sz/g*i, 0); pc2.lineTo(sz/g*i, sz); pc2.stroke();
    pc2.beginPath(); pc2.moveTo(0, sz/g*i); pc2.lineTo(sz, sz/g*i); pc2.stroke();
  }
}

// ══════════════════════════════════════
// START LEVEL
// ══════════════════════════════════════
function startLevel(level) {
  state.currentLevel = level;
  state.pieces = [];
  state.dragPiece = null;
  state.placedCount = 0;
  state.score = 0;
  state.paused = false;
  state.hintsLeft = level.hints;
  state.timeLeft = level.timeLimit;
  state.hintActive = false;
  document.getElementById('pause-overlay').classList.add('hidden');

  showScreen('game');
  document.getElementById('hud-title').textContent = level.title;
  document.getElementById('hint-count').textContent = level.hints;
  const hintBtn = document.getElementById('btn-hint');
  hintBtn.disabled = level.hints === 0;
  updateTimer();
  updateProgress();

  resizeCanvas();
  drawScene(level.scene, sceneCanvas.getContext('2d'), SCENE_W, SCENE_H);
  generatePieces(level);
  buildTray();
  renderLoop();
  startTimer();
}

// ══════════════════════════════════════
// CANVAS RESIZE
// ══════════════════════════════════════
function resizeCanvas() {
  const level = state.currentLevel;
  if (!level) return;
  isMobile = window.innerWidth < 768;

  if (isMobile) {
    const trayH = 130;
    const hudH = 58;
    const avH = window.innerHeight - hudH - trayH - 10;
    const avW = window.innerWidth;
    const bSize = Math.min(avW - 20, avH);
    boardW = bSize; boardH = bSize;
    boardX = (avW - bSize) / 2;
    boardY = hudH + (avH - bSize) / 2 + 5;
    puzzleCanvas.width = avW;
    puzzleCanvas.height = avH + hudH;
    puzzleCanvas.style.height = (avH + hudH) + 'px';
  } else {
    const hudH = 58;
    const trayW = 200;
    const avW = window.innerWidth - trayW - 20;
    const avH = window.innerHeight - hudH - 20;
    const bSize = Math.min(avW - 40, avH - 20, 600);
    boardW = bSize; boardH = bSize;
    boardX = (avW - bSize) / 2 + 10;
    boardY = hudH + (avH - bSize) / 2 + 10;
    puzzleCanvas.width = window.innerWidth - trayW;
    puzzleCanvas.height = window.innerHeight;
    puzzleCanvas.style.height = window.innerHeight + 'px';
  }

  pieceW = boardW / level.grid;
  pieceH = boardH / level.grid;
  tabPx  = pieceW * TAB;
}

// ══════════════════════════════════════
// SCENE DRAWING  (20 unique biblical scenes)
// ══════════════════════════════════════
function drawScene(id, ctx, W, H) {
  ctx.clearRect(0, 0, W, H);

  function sky(c1, c2, h) {
    const g = ctx.createLinearGradient(0, 0, 0, H*(h||0.65));
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H*(h||0.65));
  }
  function ground(c1, c2, top) {
    top = top||0.62;
    const g = ctx.createLinearGradient(0, H*top, 0, H);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, H*top, W, H);
  }
  function em(e, x, y, s) {
    ctx.save(); ctx.font = s + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e, x, y); ctx.restore();
  }
  function mtn(cx, py, w, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(cx-w/2, H*0.63); ctx.lineTo(cx, py); ctx.lineTo(cx+w/2, H*0.63); ctx.fill();
  }
  function wave(y, col, amp) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, y);
    for(let i=0;i<=8;i++) ctx.quadraticCurveTo(W/8*(i+.5), y-(amp||15), W/8*(i+1), y);
    ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.fill();
  }
  function star(x, y, s, col) {
    ctx.fillStyle = col||'rgba(255,255,220,0.9)';
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI*2); ctx.fill();
  }
  function stars(n, alpha) {
    for(let i=0;i<n;i++) star(Math.random()*W, Math.random()*H*0.65, Math.random()*1.5+.3, `rgba(255,255,220,${alpha||0.7})`);
  }
  function ray(cx, cy, angle, len, col) {
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(angle);
    ctx.fillStyle=col||'rgba(255,240,150,0.12)';
    ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(4,0); ctx.lineTo(1.5,len); ctx.lineTo(-1.5,len); ctx.fill();
    ctx.restore();
  }
  function cloud(x,y,w,col) {
    ctx.fillStyle=col||'rgba(100,120,160,0.7)';
    [0,.3,.6,1].forEach((t,i)=>{ ctx.beginPath(); ctx.ellipse(x+w*t*.8,y-i*4,w*(.18+i*.04),H*.04,0,0,Math.PI*2); ctx.fill(); });
  }
  function rect(x,y,w,h,col,r) {
    ctx.fillStyle=col; ctx.beginPath();
    if(r){ctx.roundRect(x,y,w,h,r);} else ctx.rect(x,y,w,h);
    ctx.fill();
  }

  switch(id) {
  case 1: // Garden of Eden
    sky('#87d7ab','#3c9e6a'); ground('#2d5a27','#1a3a18');
    em('☀️',W*.82,H*.13,W*.13);
    em('🌳',W*.5,H*.38,W*.22); em('🌲',W*.2,H*.45,W*.14); em('🌲',W*.78,H*.46,W*.13);
    em('🍎',W*.6,H*.51,W*.09); em('🌸',W*.25,H*.7,W*.09); em('🌼',W*.7,H*.75,W*.08);
    em('🦋',W*.78,H*.4,W*.07); em('🕊️',W*.28,H*.27,W*.09); em('🦌',W*.15,H*.74,W*.1);
    em('🌿',W*.75,H*.67,W*.08); em('🐦',W*.62,H*.24,W*.06);
    break;
  case 2: // Noah's Ark
    sky('#1a2a4a','#2c4a6a');
    cloud(W*.1,H*.2,W*.2,'rgba(50,55,75,0.8)'); cloud(W*.4,H*.15,W*.22,'rgba(45,50,70,0.8)'); cloud(W*.75,H*.22,W*.18,'rgba(55,60,80,0.8)');
    wave(H*.55,'#1a3a5c',20); wave(H*.62,'#0d2a4a',15); wave(H*.72,'#091e35',10);
    em('🌈',W*.5,H*.3,W*.25); em('⛵',W*.5,H*.58,W*.22);
    em('🕊️',W*.28,H*.42,W*.09); em('🐘',W*.18,H*.72,W*.1); em('🦒',W*.76,H*.7,W*.1); em('🦁',W*.55,H*.75,W*.09);
    em('⛈️',W*.78,H*.14,W*.12);
    break;
  case 3: // Rainbow Covenant
    sky('#7ec8e3','#b8e4f9',0.55); ground('#5a8a3a','#3d6128',0.52);
    em('☀️',W*.15,H*.15,W*.14);
    // Rainbow arc
    [.85,.78,.71,.64,.57].forEach((r,i)=>{
      const cols=['#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db'];
      ctx.strokeStyle=cols[i]; ctx.lineWidth=W*.018;
      ctx.beginPath(); ctx.arc(W*.5,H*.6,W*r,Math.PI,0); ctx.stroke();
    });
    em('☁️',W*.25,H*.25,W*.12); em('☁️',W*.7,H*.2,W*.1); em('☁️',W*.5,H*.12,W*.08);
    em('🤝',W*.5,H*.72,W*.11); em('🌳',W*.18,H*.58,W*.13); em('🌳',W*.82,H*.56,W*.12);
    em('🕊️',W*.5,H*.42,W*.09);
    break;
  case 4: // Abraham's Stars
    sky('#060c1a','#0d1f3c');
    // Stars field
    for(let i=0;i<120;i++) star(Math.random()*W, Math.random()*H*.7, Math.random()*2+.5,'rgba(255,255,200,'+(.3+Math.random()*.7)+')');
    // Moon
    em('🌙',W*.82,H*.12,W*.12);
    // Milky way glow
    ctx.fillStyle='rgba(100,120,200,0.07)'; ctx.beginPath(); ctx.ellipse(W*.5,H*.35,W*.45,H*.12,-.2,0,Math.PI*2); ctx.fill();
    ground('#1a1205','#0d0d00',0.7);
    mtn(W*.5,H*.42,W*.3,'#080f20'); mtn(W*.2,H*.52,W*.25,'#060c1a'); mtn(W*.8,H*.55,W*.2,'#060c1a');
    em('👴',W*.38,H*.76,W*.1); em('✨',W*.62,H*.5,W*.08); em('⭐',W*.5,H*.2,W*.13);
    break;
  case 5: // Joseph's Dream
    sky('#f0c060','#e89030',0.5); ground('#c4852a','#8b5e1a',0.48);
    // Palace
    rect(W*.15,H*.3,W*.7,H*.38,'#c9a64a'); rect(W*.2,H*.35,W*.6,H*.33,'#b8922c');
    [0,1,2,3].forEach(i=>{ rect(W*(.22+i*.18),H*.32,W*.06,H*.36,'#8b6914'); });
    rect(W*.35,H*.55,W*.3,H*.13,'#5a3d0a'); // door
    em('👘',W*.5,H*.52,W*.18); em('🌾',W*.15,H*.65,W*.09); em('🌾',W*.8,H*.63,W*.09);
    em('👑',W*.5,H*.22,W*.1); em('⭐',W*.5,H*.1,W*.1);
    em('🌙',W*.2,H*.1,W*.08); em('☀️',W*.78,H*.12,W*.09);
    break;
  case 6: // Burning Bush
    sky('#e87c2a','#f0ac50',0.5); ground('#8b5e1a','#5a3d0a',0.48);
    mtn(W*.55,H*.25,W*.4,'#5a4020'); mtn(W*.2,H*.4,W*.28,'#4a3518'); mtn(W*.82,H*.42,W*.24,'#4a3518');
    em('🌵',W*.15,H*.65,W*.1);
    // Bush fire
    ctx.fillStyle='rgba(255,100,0,0.3)'; ctx.beginPath(); ctx.ellipse(W*.45,H*.52,W*.14,H*.12,0,0,Math.PI*2); ctx.fill();
    em('🔥',W*.42,H*.5,W*.16); em('🌿',W*.48,H*.56,W*.12);
    for(let i=0;i<8;i++) ray(W*.44,H*.5, i*Math.PI/4, H*.18,'rgba(255,180,50,0.15)');
    em('👞',W*.6,H*.72,W*.09); em('👞',W*.68,H*.72,W*.09);
    em('👨',W*.65,H*.65,W*.1);
    break;
  case 7: // Red Sea Parting
    sky('#1a3a6a','#2a5298',0.5);
    // Parted sea walls
    ctx.fillStyle='#1a5fa0';
    ctx.beginPath(); ctx.moveTo(0,H*.45); ctx.lineTo(W*.28,H*.45); ctx.quadraticCurveTo(W*.32,H*.5,W*.3,H); ctx.lineTo(0,H); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W,H*.45); ctx.lineTo(W*.72,H*.45); ctx.quadraticCurveTo(W*.68,H*.5,W*.7,H); ctx.lineTo(W,H); ctx.fill();
    // Sea wall face
    ctx.fillStyle='rgba(30,100,180,0.6)';
    ctx.beginPath(); ctx.moveTo(W*.28,H*.45); ctx.lineTo(W*.35,H*.5); ctx.lineTo(W*.32,H); ctx.lineTo(W*.3,H); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W*.72,H*.45); ctx.lineTo(W*.65,H*.5); ctx.lineTo(W*.68,H); ctx.lineTo(W*.7,H); ctx.fill();
    // Dry ground path
    ground('#c4a46a','#a07840',0.72);
    rect(W*.3,H*.72,W*.4,H*.28,'#b8963c');
    em('☁️',W*.5,H*.1,W*.15); em('🔆',W*.5,H*.28,W*.12);
    em('👤',W*.42,H*.68,W*.08); em('👤',W*.5,H*.69,W*.08); em('👤',W*.58,H*.68,W*.08);
    em('🌊',W*.15,H*.55,W*.1); em('🌊',W*.82,H*.55,W*.1);
    break;
  case 8: // Ten Commandments
    sky('#1a1a2a','#2a1a2a');
    // Storm
    ctx.fillStyle='rgba(60,40,80,0.7)'; ctx.beginPath(); ctx.ellipse(W*.5,H*.15,W*.6,H*.18,0,0,Math.PI*2); ctx.fill();
    em('⛈️',W*.3,H*.1,W*.12); em('⛈️',W*.72,H*.12,W*.1);
    // Lightning
    ctx.strokeStyle='#fff9a0'; ctx.lineWidth=3;
    [[W*.45,0,W*.38,H*.35],[W*.6,0,W*.55,H*.3]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
    mtn(W*.5,H*.3,W*.5,'#2a1a1a'); mtn(W*.2,H*.45,W*.3,'#1a0f0f'); mtn(W*.82,H*.48,W*.25,'#1a0f0f');
    ground('#3a2a1a','#1a1208',0.7);
    em('📜',W*.42,H*.58,W*.14); em('📜',W*.6,H*.58,W*.14);
    em('⚡',W*.5,H*.15,W*.1);
    for(let i=0;i<6;i++) ray(W*.5,H*.35,i*Math.PI/3,H*.35,'rgba(255,230,100,0.08)');
    break;
  case 9: // Manna from Heaven
    sky('#e8d4a0','#f0e4c0',0.5); ground('#c4a050','#a07828',0.48);
    // Desert
    mtn(W*.2,H*.42,W*.25,'#b88c3c'); mtn(W*.75,H*.44,W*.2,'#b08035');
    // Manna flakes falling
    for(let i=0;i<30;i++){
      const x=Math.random()*W, y=Math.random()*H*.55;
      ctx.fillStyle='rgba(255,255,240,0.85)';
      ctx.beginPath(); ctx.arc(x,y,W*.008,0,Math.PI*2); ctx.fill();
    }
    em('☁️',W*.25,H*.1,W*.14); em('☁️',W*.65,H*.08,W*.16); em('☁️',W*.5,H*.05,W*.12);
    em('✨',W*.5,H*.2,W*.1);
    em('🍞',W*.3,H*.6,W*.09); em('🍞',W*.5,H*.62,W*.1); em('🍞',W*.7,H*.6,W*.08);
    em('👤',W*.4,H*.7,W*.08); em('👤',W*.55,H*.71,W*.08); em('🏕️',W*.78,H*.68,W*.1);
    break;
  case 10: // Walls of Jericho
    sky('#e8a840','#f0c060',0.5); ground('#c4852a','#8b5e1a',0.48);
    // City walls
    const wallCol='#c4a050'; const brickCol='#a07030';
    rect(W*.1,H*.25,W*.8,H*.38,wallCol); rect(W*.1,H*.25,W*.8,H*.04,brickCol);
    // Bricks
    for(let r=0;r<5;r++) for(let c=0;c<8;c++){
      rect(W*(.11+c*.098)+r%2*W*.049, H*(.27+r*.068), W*.09, H*.06, r%2===0&&c%2===0?'rgba(0,0,0,0.1)':'transparent');
    }
    // Battlements
    [0,1,2,3,4,5,6].forEach(i=>{ rect(W*(.12+i*.115),H*.22,W*.07,H*.05,'#b89030'); });
    // Walls cracking
    ctx.strokeStyle='rgba(100,60,0,0.6)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(W*.35,H*.25); ctx.lineTo(W*.32,H*.63); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W*.65,H*.27); ctx.lineTo(W*.68,H*.63); ctx.stroke();
    em('🎺',W*.2,H*.68,W*.09); em('🎺',W*.55,H*.7,W*.09); em('🎺',W*.75,H*.67,W*.09);
    em('💥',W*.5,H*.38,W*.13);
    em('👤',W*.12,H*.72,W*.07); em('👤',W*.88,H*.72,W*.07);
    break;
  case 11: // David and Goliath
    sky('#e8a028','#f0c060',0.45);
    mtn(W*.5,H*.3,W*.6,'#8b5e1a'); mtn(W*.15,H*.4,W*.35,'#7a5018'); mtn(W*.85,H*.42,W*.3,'#7a5018');
    ground('#6a4820','#3a2810',0.42);
    // Valley
    ctx.fillStyle='#5a8030'; ctx.beginPath(); ctx.ellipse(W*.5,H*.7,W*.4,H*.15,0,0,Math.PI*2); ctx.fill();
    // Goliath
    em('🗡️',W*.65,H*.42,W*.2); em('🛡️',W*.72,H*.56,W*.11);
    ctx.fillStyle='#a07030'; ctx.beginPath(); ctx.ellipse(W*.68,H*.52,W*.06,H*.1,0,0,Math.PI*2); ctx.fill(); // body
    // David
    em('🧑',W*.32,H*.6,W*.09); em('🪨',W*.42,H*.55,W*.07);
    em('⚔️',W*.5,H*.35,W*.09);
    em('☀️',W*.85,H*.1,W*.11); em('🦅',W*.25,H*.25,W*.07);
    break;
  case 12: // Solomon's Temple
    sky('#6a9ec8','#a8c8e8',0.5); ground('#8b7030','#5a4820',0.48);
    // Temple columns
    const cols2=['#e8d890','#d4c470','#c4b050'];
    rect(W*.05,H*.15,W*.9,H*.5,'#d4c470');
    [0,1,2,3,4,5].forEach(i=>{ rect(W*(.1+i*.138),H*.15,W*.06,H*.5,cols2[i%3]); });
    // Roof
    ctx.fillStyle='#a08020'; ctx.beginPath(); ctx.moveTo(W*.03,H*.16); ctx.lineTo(W*.5,H*.04); ctx.lineTo(W*.97,H*.16); ctx.closePath(); ctx.fill();
    // Door
    rect(W*.41,H*.45,W*.18,H*.2,'#5a3d0a');
    ctx.fillStyle='#7a5010'; ctx.beginPath(); ctx.arc(W*.5,H*.45,W*.09,Math.PI,0); ctx.fill();
    em('✨',W*.5,H*.1,W*.08); em('✨',W*.2,H*.2,W*.06); em('✨',W*.82,H*.2,W*.06);
    em('🕯️',W*.25,H*.55,W*.08); em('🕯️',W*.75,H*.55,W*.08);
    em('🙏',W*.5,H*.62,W*.08); em('☁️',W*.5,H*.22,W*.12);
    break;
  case 13: // Elijah's Fire
    sky('#0d1a0d','#1a2a1a',0.5);
    mtn(W*.5,H*.28,W*.5,'#1a1208'); mtn(W*.15,H*.42,W*.3,'#0f0c05'); mtn(W*.85,H*.45,W*.28,'#0f0c05');
    ground('#1a1208','#0d0d00',0.65);
    // Altar 1 (wet)
    rect(W*.25,H*.57,W*.22,H*.1,'#8b6914'); rect(W*.22,H*.62,W*.28,H*.05,'#7a5810');
    // Altar 2 (fire)
    rect(W*.55,H*.57,W*.22,H*.1,'#8b6914'); rect(W*.52,H*.62,W*.28,H*.05,'#7a5810');
    // Fire from heaven
    ctx.fillStyle='rgba(255,150,0,0.25)'; ctx.beginPath(); ctx.arc(W*.66,H*.38,W*.12,0,Math.PI*2); ctx.fill();
    em('🔥',W*.64,H*.5,W*.18);
    // Fire beams
    for(let i=0;i<8;i++) ray(W*.66,H*.55,i*Math.PI/4,H*.3,'rgba(255,120,0,0.2)');
    em('💧',W*.34,H*.55,W*.06); em('💧',W*.3,H*.6,W*.05);
    em('🙏',W*.28,H*.68,W*.08);
    stars(40,0.6);
    em('⭐',W*.5,H*.1,W*.09);
    break;
  case 14: // Daniel's Lions Den
    sky('#0d1117','#1a1a2a',0.5);
    // Stone pit
    rect(0,H*.4,W,H*.6,'#3a2a1a');
    ctx.fillStyle='#2a1a0a'; ctx.beginPath(); ctx.ellipse(W*.5,H*.68,W*.42,H*.2,0,0,Math.PI*2); ctx.fill();
    // Stone walls
    [0,1,2,3,4].forEach(r=>[0,1,2,3,4].forEach(c=>{
      rect(c*W*.22-W*.04,H*(.42+r*.1),W*.2,H*.09,'rgba(70,50,30,'+(0.3+Math.random()*.2)+')');
    }));
    // Opening above
    const grd = ctx.createRadialGradient(W*.5,H*.08,W*.05,W*.5,H*.08,W*.35);
    grd.addColorStop(0,'rgba(255,220,100,0.4)'); grd.addColorStop(1,'transparent');
    ctx.fillStyle=grd; ctx.fillRect(0,0,W,H*.45);
    em('🦁',W*.25,H*.65,W*.13); em('🦁',W*.72,H*.67,W*.12); em('🦁',W*.5,H*.75,W*.11);
    em('🙏',W*.5,H*.58,W*.1);
    em('👼',W*.5,H*.35,W*.1); em('⭐',W*.5,H*.05,W*.08);
    stars(25,0.8);
    break;
  case 15: // Jonah's Whale
    sky('#0d1a2a','#1a3055',0.5);
    wave(H*.4,'#0d3a6a',25); wave(H*.5,'#0a2a55',20); wave(H*.62,'#061830',15);
    em('⛈️',W*.7,H*.1,W*.13); em('⛵',W*.65,H*.35,W*.12);
    // Whale
    ctx.fillStyle='#2a4a6a';
    ctx.beginPath(); ctx.ellipse(W*.38,H*.64,W*.32,H*.15,-.15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1e3a55'; ctx.beginPath();
    ctx.ellipse(W*.1,H*.6,W*.08,H*.06,.3,0,Math.PI*2); ctx.fill();
    em('🐋',W*.36,H*.6,W*.22);
    em('🌊',W*.15,H*.48,W*.1); em('🌊',W*.78,H*.5,W*.08);
    em('🌙',W*.18,H*.12,W*.1); em('⭐',W*.45,H*.08,W*.07); em('⭐',W*.75,H*.05,W*.06);
    em('🙏',W*.38,H*.75,W*.06);
    break;
  case 16: // Star of Bethlehem
    sky('#040a12','#0a1830');
    stars(80,0.8);
    // THE Star
    ctx.fillStyle='rgba(255,240,150,0.25)'; ctx.beginPath(); ctx.arc(W*.5,H*.12,W*.15,0,Math.PI*2); ctx.fill();
    for(let i=0;i<12;i++) ray(W*.5,H*.12,i*Math.PI/6,H*.45,'rgba(255,240,150,0.12)');
    em('⭐',W*.5,H*.1,W*.14);
    ground('#1a0f05','#120a00',0.72);
    mtn(W*.15,H*.5,W*.2,'#100a00'); mtn(W*.8,H*.52,W*.18,'#0f0900');
    // Stable
    ctx.fillStyle='#3a2010'; ctx.beginPath(); ctx.moveTo(W*.35,H*.85); ctx.lineTo(W*.5,H*.68); ctx.lineTo(W*.65,H*.85); ctx.fill();
    rect(W*.38,H*.75,W*.24,H*.1,'#2a1508');
    em('🌟',W*.5,H*.72,W*.08); em('👶',W*.5,H*.82,W*.07);
    em('🐫',W*.2,H*.78,W*.1); em('🐫',W*.76,H*.79,W*.09);
    em('👑',W*.5,H*.5,W*.08);
    em('🌙',W*.82,H*.08,W*.09);
    break;
  case 17: // Sermon on the Mount
    sky('#87c8e8','#b8e4f8',0.5); ground('#5a9a40','#3a7028',0.48);
    mtn(W*.5,H*.25,W*.5,'#6a9a50'); mtn(W*.15,H*.38,W*.3,'#5a8a42'); mtn(W*.85,H*.4,W*.28,'#5a8a42');
    em('☀️',W*.85,H*.1,W*.12); em('☁️',W*.2,H*.18,W*.1); em('☁️',W*.55,H*.12,W*.09);
    // Crowd
    ['👤','👤','👤','🧑','👩','👦'].forEach((e,i)=>{
      em(e, W*(.15+i*.14), H*(.7+Math.sin(i)*.03), W*.08);
    });
    em('🕊️',W*.5,H*.28,W*.09); em('🕊️',W*.35,H*.35,W*.06); em('🕊️',W*.65,H*.34,W*.06);
    // Jesus figure on hill
    ctx.fillStyle='#fff8f0'; ctx.beginPath(); ctx.ellipse(W*.5,H*.5,W*.05,H*.12,0,0,Math.PI*2); ctx.fill();
    em('👐',W*.5,H*.48,W*.12);
    break;
  case 18: // Walking on Water
    sky('#0d1a2a','#1a3055',0.45);
    em('🌙',W*.8,H*.08,W*.1); stars(50,0.7);
    wave(H*.42,'#0a2a5a',28); wave(H*.52,'#071e45',22); wave(H*.64,'#051530',18); wave(H*.76,'#03101f',14);
    em('⛈️',W*.3,H*.08,W*.12); em('⛈️',W*.7,H*.1,W*.1);
    ctx.strokeStyle='rgba(255,255,200,0.4)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(W*.5,H*.08); ctx.lineTo(W*.5,H*.55); ctx.stroke();
    em('🚢',W*.72,H*.55,W*.12);
    em('🌊',W*.15,H*.52,W*.09); em('🌊',W*.82,H*.5,W*.08);
    em('💨',W*.3,H*.38,W*.08); em('💨',W*.65,H*.35,W*.07);
    em('👣',W*.5,H*.58,W*.07); em('👤',W*.5,H*.52,W*.09);
    em('✨',W*.5,H*.3,W*.09); em('✨',W*.4,H*.45,W*.06); em('✨',W*.6,H*.47,W*.06);
    break;
  case 19: // Last Supper
    sky('#2a1a0a','#1a1005',0.6);
    // Room walls
    rect(0,H*.08,W,H*.65,'#2a1808'); rect(0,H*.08,W,H*.04,'#1a1005');
    // Table
    ctx.fillStyle='#5a3010'; ctx.beginPath(); ctx.ellipse(W*.5,H*.72,W*.45,H*.08,0,0,Math.PI*2); ctx.fill();
    rect(W*.05,H*.7,W*.9,H*.12,'#4a2808');
    // Tablecloth
    rect(W*.06,H*.68,W*.88,H*.06,'rgba(240,230,210,0.85)');
    em('🍷',W*.3,H*.68,W*.07); em('🍞',W*.5,H*.66,W*.09); em('🍷',W*.7,H*.68,W*.07);
    em('🕯️',W*.15,H*.6,W*.07); em('🕯️',W*.82,H*.6,W*.07); em('🕯️',W*.5,H*.58,W*.06);
    // Figures
    ['👤','👤','👤','👤','👤','👤'].forEach((e,i)=>{ em(e,W*(.12+i*.155),H*.62,W*.07); });
    em('✝️',W*.5,H*.28,W*.1);
    break;
  case 20: // Resurrection
    sky('#1a0808','#4a1a0a',0.45);
    // Dawn light
    const dawn = ctx.createRadialGradient(W*.5,H*.6,W*.05,W*.5,H*.6,W*.7);
    dawn.addColorStop(0,'rgba(255,200,80,0.5)'); dawn.addColorStop(0.4,'rgba(255,120,30,0.15)'); dawn.addColorStop(1,'transparent');
    ctx.fillStyle=dawn; ctx.fillRect(0,0,W,H);
    ground('#2a1a0a','#1a0d05',0.6);
    mtn(W*.15,H*.42,W*.22,'#1a0d05'); mtn(W*.82,H*.45,W*.2,'#180c04');
    // Tomb
    rect(W*.25,H*.5,W*.5,H*.25,'#5a4030'); ctx.fillStyle='#3a2820';
    ctx.beginPath(); ctx.ellipse(W*.5,H*.5,W*.2,H*.15,0,0,Math.PI*2); ctx.fill();
    // Stone rolled away
    ctx.fillStyle='#8a7060'; ctx.beginPath(); ctx.ellipse(W*.2,H*.62,W*.1,H*.12,-.3,0,Math.PI*2); ctx.fill();
    // Brilliant light
    const lt = ctx.createRadialGradient(W*.5,H*.58,W*.02,W*.5,H*.58,W*.3);
    lt.addColorStop(0,'rgba(255,255,200,0.9)'); lt.addColorStop(0.3,'rgba(255,200,100,0.4)'); lt.addColorStop(1,'transparent');
    ctx.fillStyle=lt; ctx.fillRect(0,0,W,H);
    for(let i=0;i<10;i++) ray(W*.5,H*.58,i*Math.PI/5,H*.5,'rgba(255,240,150,0.15)');
    em('✝️',W*.5,H*.2,W*.14); em('👼',W*.38,H*.5,W*.09); em('👼',W*.62,H*.5,W*.09);
    em('🌸',W*.22,H*.75,W*.08); em('🌸',W*.75,H*.73,W*.08);
    em('✨',W*.5,H*.42,W*.1); em('✨',W*.32,H*.55,W*.06); em('✨',W*.68,H*.55,W*.06);
    em('🌅',W*.5,H*.85,W*.12);
    break;
  }
}

// ══════════════════════════════════════
// PIECE GENERATION
// ══════════════════════════════════════
function generatePieces(level) {
  const g = level.grid;
  // Determine edge types
  const rightEdge = [];  // rightEdge[col][row]
  const bottomEdge = []; // bottomEdge[col][row]
  for (let c = 0; c < g; c++) {
    rightEdge[c] = [];
    bottomEdge[c] = [];
    for (let r = 0; r < g; r++) {
      rightEdge[c][r]  = (c < g-1) ? (((c * 7 + r * 3 + c*r) % 2 === 0) ? 'tab' : 'blank') : 'flat';
      bottomEdge[c][r] = (r < g-1) ? (((c * 5 + r * 11 + c+r) % 2 === 0) ? 'tab' : 'blank') : 'flat';
    }
  }

  state.pieces = [];
  const pw = pieceW, ph = pieceH, tab = tabPx;

  for (let r = 0; r < g; r++) {
    for (let c = 0; c < g; c++) {
      const top    = r === 0 ? 'flat' : (bottomEdge[c][r-1] === 'tab' ? 'blank' : 'tab');
      const right  = rightEdge[c][r];
      const bottom = bottomEdge[c][r];
      const left   = c === 0 ? 'flat' : (rightEdge[c-1][r] === 'tab' ? 'blank' : 'tab');

      // Pre-render piece image
      const cvs = document.createElement('canvas');
      cvs.width  = Math.ceil(pw + tab * 2);
      cvs.height = Math.ceil(ph + tab * 2);
      const cx = cvs.getContext('2d');

      drawPiecePath(cx, { top, right, bottom, left }, pw, ph, tab);
      cx.save(); cx.clip();
      cx.drawImage(sceneCanvas, tab - c*pw, tab - r*ph, pw*g, ph*g);
      cx.restore();

      // Edge stroke
      cx.save();
      drawPiecePath(cx, { top, right, bottom, left }, pw, ph, tab);
      cx.strokeStyle = 'rgba(0,0,0,0.35)'; cx.lineWidth = 1.5; cx.stroke();
      // Inner highlight
      cx.strokeStyle = 'rgba(255,255,255,0.1)'; cx.lineWidth = 0.8; cx.stroke();
      cx.restore();

      // Correct board position
      const correctX = boardX + c * pw - tab;
      const correctY = boardY + r * ph - tab;

      // Random rotation for hard levels
      let rotation = 0;
      if (level.rotation) {
        rotation = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
      }

      state.pieces.push({
        id: r * g + c, col: c, row: r,
        top, right, bottom, left,
        canvas: cvs,
        correctX, correctY,
        x: 0, y: 0,
        placed: false,
        rotation,
        trayX: 0, trayY: 0,
        inTray: true,
        scale: 1,
        alpha: 1,
        snapAnim: 0,
      });
    }
  }

  // Shuffle
  shuffleArray(state.pieces);
}

function drawPiecePath(ctx, edges, pw, ph, tab) {
  const x = tab, y = tab, x2 = tab + pw, y2 = tab + ph;
  ctx.beginPath();
  ctx.moveTo(x, y);
  jigsawEdge(ctx, x, y, x2, y, edges.top, W => W);
  jigsawEdge(ctx, x2, y, x2, y2, edges.right, W => W);
  jigsawEdge(ctx, x2, y2, x, y2, edges.bottom, W => W);
  jigsawEdge(ctx, x, y2, x, y, edges.left, W => W);
  ctx.closePath();
}

function jigsawEdge(ctx, x1, y1, x2, y2, type) {
  if (type === 'flat') { ctx.lineTo(x2, y2); return; }
  const d = type === 'tab' ? 1 : -1;
  const len = Math.hypot(x2-x1, y2-y1);
  const nx = -(y2-y1)/len * d;
  const ny =  (x2-x1)/len * d;
  const t1x = x1+(x2-x1)*.27, t1y = y1+(y2-y1)*.27;
  const mx  = (x1+x2)/2,      my  = (y1+y2)/2;
  const t2x = x1+(x2-x1)*.73, t2y = y1+(y2-y1)*.73;
  const ht = len * TAB * 0.95;
  ctx.lineTo(t1x, t1y);
  ctx.bezierCurveTo(t1x+nx*ht*.45, t1y+ny*ht*.45, mx+nx*ht-  (x2-x1)*.1, my+ny*ht-(y2-y1)*.1, mx+nx*ht, my+ny*ht);
  ctx.bezierCurveTo(mx+nx*ht+(x2-x1)*.1, my+ny*ht+(y2-y1)*.1, t2x+nx*ht*.45, t2y+ny*ht*.45, t2x, t2y);
  ctx.lineTo(x2, y2);
}

// ══════════════════════════════════════
// TRAY
// ══════════════════════════════════════
function buildTray() {
  const tray = document.getElementById('tray-inner');
  tray.innerHTML = '';
  state.pieces.forEach(p => {
    const el = document.createElement('canvas');
    el.className = 'tray-piece';
    const tSize = isMobile ? 80 : 80;
    el.width  = p.canvas.width;
    el.height = p.canvas.height;
    const tc = el.getContext('2d');
    tc.save();
    if (p.rotation !== 0) {
      tc.translate(el.width/2, el.height/2);
      tc.rotate(p.rotation * Math.PI/180);
      tc.translate(-el.width/2, -el.height/2);
    }
    tc.drawImage(p.canvas, 0, 0);
    tc.restore();
    el.style.width = tSize + 'px';
    el.style.height = tSize + 'px';
    el.dataset.pieceId = p.id;
    el.addEventListener('pointerdown', onTrayPieceDown, { passive: false });
    p.trayEl = el;
    tray.appendChild(el);
  });
}

// ══════════════════════════════════════
// DRAG — TRAY PIECE START
// ══════════════════════════════════════
function onTrayPieceDown(e) {
  e.preventDefault();
  const pieceId = parseInt(e.currentTarget.dataset.pieceId);
  const p = state.pieces.find(p => p.id === pieceId && !p.placed);
  if (!p) return;
  if (state.paused) return;

  const rect = puzzleCanvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (puzzleCanvas.width / rect.width);
  const cy = (e.clientY - rect.top)  * (puzzleCanvas.height / rect.height);

  p.inTray = false;
  p.x = cx - p.canvas.width  / 2;
  p.y = cy - p.canvas.height / 2;
  state.dragPiece = p;
  state.dragOffX = p.canvas.width  / 2;
  state.dragOffY = p.canvas.height / 2;

  if (p.trayEl) p.trayEl.classList.add('dragging');
  puzzleCanvas.setPointerCapture(e.pointerId);
}

// ══════════════════════════════════════
// DRAG — CANVAS
// ══════════════════════════════════════
function onDown(e) {
  e.preventDefault();
  if (state.paused) return;
  const rect = puzzleCanvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (puzzleCanvas.width  / rect.width);
  const cy = (e.clientY - rect.top)  * (puzzleCanvas.height / rect.height);

  // Find top-most non-placed piece under cursor
  for (let i = state.pieces.length - 1; i >= 0; i--) {
    const p = state.pieces[i];
    if (p.placed || p.inTray) continue;
    if (cx >= p.x && cx <= p.x + p.canvas.width &&
        cy >= p.y && cy <= p.y + p.canvas.height) {
      state.dragPiece = p;
      state.dragOffX = cx - p.x;
      state.dragOffY = cy - p.y;
      // Bring to top
      state.pieces.splice(i, 1);
      state.pieces.push(p);
      puzzleCanvas.setPointerCapture(e.pointerId);
      return;
    }
  }
}

function onMove(e) {
  e.preventDefault();
  if (!state.dragPiece || state.paused) return;
  const rect = puzzleCanvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (puzzleCanvas.width  / rect.width);
  const cy = (e.clientY - rect.top)  * (puzzleCanvas.height / rect.height);
  state.dragPiece.x = cx - state.dragOffX;
  state.dragPiece.y = cy - state.dragOffY;
}

function onUp(e) {
  const p = state.dragPiece;
  if (!p) return;
  state.dragPiece = null;
  if (p.trayEl) p.trayEl.classList.remove('dragging');

  // Check snap
  const dx = p.x - p.correctX;
  const dy = p.y - p.correctY;
  const dist = Math.hypot(dx, dy);
  const threshold = pieceW * SNAP_R;
  const correctRot = (p.rotation % 360 + 360) % 360 === 0;

  if (dist < threshold && correctRot) {
    snapPiece(p);
  }
}

function snapPiece(p) {
  p.placed = true;
  p.x = p.correctX;
  p.y = p.correctY;
  p.inTray = false;
  p.snapAnim = 1;
  state.placedCount++;

  // Remove from tray
  if (p.trayEl) { p.trayEl.remove(); p.trayEl = null; }

  updateProgress();
  playSnapEffect(p);

  if (state.placedCount === state.pieces.length) {
    setTimeout(completeLevel, 600);
  }
}

function rotateDragging(e) {
  if (e) e.preventDefault();
  const p = state.dragPiece;
  if (!p) return;
  p.rotation = (p.rotation + 90) % 360;
  // Refresh tray image if still in tray context
  showToast('↻ Rotated');
}

// ══════════════════════════════════════
// RENDER LOOP
// ══════════════════════════════════════
let renderActive = false;
function renderLoop() {
  if (state.currentScreen !== 'game') { renderActive = false; return; }
  renderActive = true;
  requestAnimationFrame(renderFrame);
}

function renderFrame() {
  if (state.currentScreen !== 'game') return;
  const ctx = pCtx;
  const W = puzzleCanvas.width, H = puzzleCanvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b0f1a'); bg.addColorStop(1, '#10162a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Board ghost
  drawBoard(ctx);

  // Draw hint overlay
  if (state.hintActive) drawHint(ctx);

  // Placed pieces
  state.pieces.filter(p => p.placed).forEach(p => drawPieceOnBoard(ctx, p));

  // Floating pieces (not placed, not dragging)
  state.pieces.filter(p => !p.placed && !p.inTray && p !== state.dragPiece).forEach(p => drawPieceOnBoard(ctx, p));

  // Dragging piece (on top)
  if (state.dragPiece) drawPieceOnBoard(ctx, state.dragPiece, true);

  requestAnimationFrame(renderFrame);
}

function drawBoard(ctx) {
  // Board background
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.roundRect(boardX - 8, boardY - 8, boardW + 16, boardH + 16, 12); ctx.fill();

  // Grid ghost outlines
  const g = state.currentLevel.grid;
  for (let r = 0; r < g; r++) {
    for (let c = 0; c < g; c++) {
      const px = boardX + c * pieceW;
      const py = boardY + r * pieceH;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, pieceW, pieceH);
    }
  }
}

function drawHint(ctx) {
  // Show ghost positions of unplaced pieces
  ctx.save();
  ctx.globalAlpha = 0.22;
  const g = state.currentLevel.grid;
  state.pieces.filter(p => !p.placed).forEach(p => {
    ctx.drawImage(p.canvas, p.correctX, p.correctY, p.canvas.width, p.canvas.height);
  });
  ctx.restore();
}

function drawPieceOnBoard(ctx, p, isDragging) {
  ctx.save();
  const cx = p.x + p.canvas.width  / 2;
  const cy = p.y + p.canvas.height / 2;

  if (p.rotation !== 0) {
    ctx.translate(cx, cy);
    ctx.rotate(p.rotation * Math.PI / 180);
    ctx.translate(-cx, -cy);
  }

  if (isDragging) {
    ctx.shadowColor = 'rgba(245,197,24,0.6)';
    ctx.shadowBlur = 20;
    ctx.globalAlpha = 0.92;
  }

  if (p.snapAnim > 0) {
    const s = 1 + Math.sin(p.snapAnim * Math.PI) * 0.12;
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
    p.snapAnim = Math.max(0, p.snapAnim - 0.08);
  }

  ctx.drawImage(p.canvas, p.x, p.y);

  if (isDragging && p.rotation === 0) {
    // Show snap guide if near correct position
    const dx = p.x - p.correctX, dy = p.y - p.correctY;
    if (Math.hypot(dx, dy) < pieceW * SNAP_R * 1.5) {
      ctx.shadowColor = 'rgba(20,160,133,0.9)';
      ctx.shadowBlur = 18;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(p.canvas, p.correctX, p.correctY);
    }
  }

  ctx.restore();
}

function playSnapEffect(p) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:${boardX+p.col*pieceW}px;top:${boardY+p.row*pieceH}px;
    width:${pieceW}px;height:${pieceH}px;border-radius:4px;pointer-events:none;z-index:100;
    animation:snap-bounce 0.4s ease forwards, place-glow 0.5s ease forwards;
    background:rgba(20,160,133,0.25);`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 500);
}

// ══════════════════════════════════════
// HINT
// ══════════════════════════════════════
function activateHint() {
  if (state.hintsLeft <= 0) { showToast('No hints left!'); return; }
  if (state.hintActive) return;
  state.hintsLeft--;
  state.hintActive = true;
  document.getElementById('hint-count').textContent = state.hintsLeft;
  document.getElementById('btn-hint').disabled = state.hintsLeft === 0;
  clearTimeout(state.hintTimer);
  state.hintTimer = setTimeout(() => { state.hintActive = false; }, 2500);
  showToast('💡 Hint active for 2.5 seconds');
}

// ══════════════════════════════════════
// TIMER
// ══════════════════════════════════════
function startTimer() {
  stopTimer();
  state.timerInterval = setInterval(() => {
    if (state.paused) return;
    state.timeLeft--;
    updateTimer();
    if (state.timeLeft <= 0) {
      stopTimer();
      // Out of time — complete with 1 star
      completeLevel(true);
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

function updateTimer() {
  const el = document.getElementById('hud-timer');
  el.textContent = formatTime(state.timeLeft);
  el.classList.toggle('urgent', state.timeLeft <= 30 && state.timeLeft > 0);
}

function updateProgress() {
  const total = state.pieces.length;
  const pct = total > 0 ? (state.placedCount / total) * 100 : 0;
  document.getElementById('hud-progress-bar').style.width = pct + '%';
}

function togglePause() {
  state.paused = !state.paused;
  document.getElementById('pause-overlay').classList.toggle('hidden', !state.paused);
}

// ══════════════════════════════════════
// LEVEL COMPLETE
// ══════════════════════════════════════
function completeLevel(outOfTime) {
  stopTimer();
  const level = state.currentLevel;
  const timeUsed = level.timeLimit - state.timeLeft;
  const total = state.pieces.length;
  const placed = state.placedCount;

  // Stars: 3 = fast + all placed, 2 = ok, 1 = slow/timeout
  let stars = 1;
  if (!outOfTime && placed === total) {
    if (timeUsed < level.timeLimit * 0.5) stars = 3;
    else if (timeUsed < level.timeLimit * 0.8) stars = 2;
    else stars = 2;
  }
  if (outOfTime) stars = 1;

  // Score
  const timeBonus = Math.max(0, state.timeLeft * 5);
  const hintPenalty = (level.hints - state.hintsLeft) * 50;
  const pieceScore = placed * 20;
  state.score = pieceScore + timeBonus - hintPenalty;

  // Save
  const prevStars = state.progress.stars[level.id] || 0;
  if (stars > prevStars) state.progress.stars[level.id] = stars;
  saveProgress();

  // Show complete screen
  showScreen('complete');
  const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  document.getElementById('complete-stars').innerHTML = [...starStr].map(s => `<span>${s}</span>`).join('');
  document.getElementById('complete-title').textContent = outOfTime ? 'Time\'s Up!' : 'Puzzle Complete!';
  document.getElementById('complete-score').textContent = state.score.toLocaleString();
  document.getElementById('complete-time').textContent = formatTime(timeUsed) + ' used';

  // Fact card
  document.getElementById('fact-scene-name').textContent = level.title;
  document.getElementById('fact-text').textContent = level.fact;
  document.getElementById('fact-verse').textContent = '"' + level.verse + '"';
  document.getElementById('fact-ref').textContent = '— ' + level.scripture;
  document.getElementById('fact-lesson').textContent = level.lesson;

  // Next button
  const nextId = level.id + 1;
  const nextLevel = LEVELS.find(l => l.id === nextId);
  const nextBtn = document.getElementById('btn-next-level');
  nextBtn.style.display = nextLevel ? '' : 'none';

  if (stars === 3 || !outOfTime) launchConfetti();
}

function goNextLevel() {
  const current = state.currentLevel;
  const next = LEVELS.find(l => l.id === current.id + 1);
  if (next) openPreLevel(next);
  else showScreen('levels');
}

// ══════════════════════════════════════
// CONFETTI
// ══════════════════════════════════════
function launchConfetti() {
  const layer = document.getElementById('confetti-layer');
  const colors = ['#f5c518','#e74c3c','#2ecc71','#3498db','#9b59b6','#e67e22','#1abc9c'];
  for (let i = 0; i < 80; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.top = '-12px';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.width = (6 + Math.random() * 8) + 'px';
      el.style.height = (6 + Math.random() * 8) + 'px';
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      el.style.animationDuration = (2 + Math.random() * 3) + 's';
      el.style.animationDelay = (Math.random() * 0.5) + 's';
      layer.appendChild(el);
      setTimeout(() => el.remove(), 5500);
    }, i * 20);
  }
}

// ══════════════════════════════════════
// SAVE / LOAD
// ══════════════════════════════════════
function saveProgress() {
  localStorage.setItem('jigsawProgress', JSON.stringify(state.progress));
}
function loadProgress() {
  try {
    const s = localStorage.getItem('jigsawProgress');
    if (s) state.progress = JSON.parse(s);
  } catch(e) {}
}

// ══════════════════════════════════════
// UTILS
// ══════════════════════════════════════
function formatTime(secs) {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.abs(secs) % 60;
  return m + ':' + String(s).padStart(2, '0');
}
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
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
