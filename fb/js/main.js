/* js/main.js
Role: All game logic, rendering, input handling, sound, persistence, and main loop.
Single-file game to be included in index.html.
*/

/* ========= Configuration constants (physics & gameplay) ========= */
// Units are in pixels and seconds (converted from ms delta)
const CONFIG = {
  GRAVITY: 1500,                // px/s^2 gravity acceleration (stronger for mobile playability)
  FLAP_VELOCITY: -380,          // px/s flap impulse (instantaneous velocity set)
  TERMINAL_VELOCITY: 900,       // px/s maximum falling speed
  BIRD_X: 100,                  // px horizontal position of bird
  BIRD_RADIUS: 14,              // px radius for collision & drawing
  PIPE_WIDTH: 78,               // px pipe width
  PIPE_GAP: 160,                // px base gap height (will vary)
  PIPE_SPACING: 220,            // px horizontal spacing between pipe centers
  PIPE_SPEED: 140,              // px/s speed pipes move left
  MIN_GAP_Y: 80,                // minimal y for gap top
  MAX_GAP_Y_MARGIN: 120,        // margin from bottom to ensure gap within screen
  SPAWN_OFFSET: 20,             // spawn offscreen offset
  SCORE_X: 20,
  PARALLAX_SPEEDS: [10, 30],    // px/s for background layers
  MAX_PARTICLES: 60,            // pool size for small particles
  PIPE_POOL: 6,                 // how many pipes to pool (each pair counts as 1)
  SFX_VOLUME: 0.08,             // master volume
};

/* ========= Canvas & Device Pixel handling ========= */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let DPR = Math.max(window.devicePixelRatio || 1, 1);
let vw = window.innerWidth;
let vh = window.innerHeight;

/* ========= DOM elements ========= */
const playBtn = document.getElementById('playBtn');
const retryBtn = document.getElementById('retryBtn');
const shareBtn = document.getElementById('shareBtn');
const flapBtn = document.getElementById('flapBtn');
const titleScreen = document.getElementById('titleScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const pauseBanner = document.getElementById('pauseBanner');
const fpsEl = document.getElementById('fps');

/* ========= Game state machine ========= */
const STATE = {
  LOADING: 'loading',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAMEOVER: 'gameover'
};
let state = STATE.LOADING;

/* ========= Timing ========= */
let lastTime = 0;
let accumulator = 0;

/* ========= Game objects ========= */
const bird = {
  x: CONFIG.BIRD_X,
  y: 200,
  vy: 0,
  radius: CONFIG.BIRD_RADIUS,
  angle: 0,             // current rotation in radians (tilt)
  targetAngle: 0,       // smoothing target
  alive: true,
};

let pipes = [];         // pooled pipe pairs (each item: {x, gapY, passed})
let particles = [];     // particle pool
let pipePoolIndex = 0;

/* ========= Background (offscreen) for parallax layers ========= */
let bgCanvases = [];    // offscreen canvases for static parallax layer rendering

/* ========= Scoring & persistence ========= */
let score = 0;
let bestScore = 0;
const STORAGE_KEY = 'flappy_highscore_v1';

/* ========= Audio (WebAudio procedural SFX) ========= */
let audioCtx = null;
let masterGain = null;
let sfxReady = false;
const sfx = {}; // will hold functions to play sfx

/* ========= Performance trackers ========= */
let showFPS = true;
let frameCount = 0, fpsTime = 0;

/* ========= Utility helpers ========= */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function randRange(a, b) { return a + Math.random() * (b - a); }

/* ========== Resize handling ========== */
function resizeCanvas(){
  vw = window.innerWidth;
  vh = window.innerHeight;
  DPR = Math.max(window.devicePixelRatio || 1, 1);
  canvas.style.width = vw + 'px';
  canvas.style.height = vh + 'px';
  canvas.width = Math.floor(vw * DPR);
  canvas.height = Math.floor(vh * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // rebuild parallax offscreen layers sized to viewport
  rebuildParallax();
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => { setTimeout(resizeCanvas, 120); });

/* ========= Offscreen parallax builder ========= */
function rebuildParallax(){
  bgCanvases = [];
  // simple cloud layer + hills layer drawn to offscreen canvases
  const layers = [
    {h: Math.floor(vh*0.5), draw: drawCloudsLayer},
    {h: Math.floor(vh*0.5), draw: drawHillsLayer}
  ];
  layers.forEach((layer, i) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.floor(vw * DPR));
    c.height = Math.max(1, Math.floor(layer.h * DPR));
    const g = c.getContext('2d');
    g.setTransform(DPR,0,0,DPR,0,0);
    layer.draw(g, vw, layer.h, i);
    bgCanvases.push({canvas:c, height:layer.h});
  });
}

/* Procedural background layer: clouds */
function drawCloudsLayer(g, w, h, idx){
  g.clearRect(0,0,w,h);
  g.fillStyle = '#cfeff3';
  g.fillRect(0,0,w,h);
  // draw soft clouds
  g.globalAlpha = 0.9;
  for(let i=0;i<8;i++){
    const x = Math.random()*w;
    const y = Math.random()*h*0.6;
    const r = 30+Math.random()*80;
    const grd = g.createRadialGradient(x,y,r*0.2,x,y,r);
    grd.addColorStop(0,'rgba(255,255,255,0.95)');
    grd.addColorStop(1,'rgba(255,255,255,0.0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
  }
  g.globalAlpha = 1;
}

/* Procedural background layer: hills */
function drawHillsLayer(g, w, h, idx){
  g.clearRect(0,0,w,h);
  g.fillStyle = '#7fc8b5';
  g.beginPath();
  g.moveTo(0,h);
  for(let x=0;x<=w;x+=20){
    const y = h - 40 - 40*Math.sin((x/ w)*Math.PI*2 + idx*0.5) - 20*Math.sin((x/100)+idx);
    g.lineTo(x,y);
  }
  g.lineTo(w,h);
  g.closePath();
  g.fill();
  // simple foreground grass
  g.fillStyle = '#6fb399';
  g.fillRect(0,h-18,w,18);
}

/* ========= Pipe pool init ========= */
function initPipes(){
  pipes = new Array(CONFIG.PIPE_POOL);
  for(let i=0;i<pipes.length;i++){
    pipes[i] = createPipePair(-1000);
  }
  pipePoolIndex = 0;
}

/* Create a pipe pair object with reuse in mind */
function createPipePair(x){
  return {
    x: x,
    gapY: vh/2,
    width: CONFIG.PIPE_WIDTH,
    gap: CONFIG.PIPE_GAP,
    passed: false,
    active: false
  };
}

/* Spawn a pipe by reusing pooled objects */
function spawnPipe(x){
  const p = pipes[pipePoolIndex];
  pipePoolIndex = (pipePoolIndex + 1) % pipes.length;
  p.x = x;
  const minGap = CONFIG.MIN_GAP_Y;
  const maxGapTop = vh - CONFIG.MAX_GAP_Y_MARGIN - CONFIG.PIPE_GAP;
  p.gapY = clamp(randRange(minGap, maxGapTop), minGap, maxGapTop);
  // give slight variance to gap size
  p.gap = CONFIG.PIPE_GAP + randRange(-20, 40);
  p.passed = false;
  p.active = true;
  return p;
}

/* ========= Particle pool ========= */
function initParticles(){
  particles = new Array(CONFIG.MAX_PARTICLES);
  for(let i=0;i<particles.length;i++){
    particles[i] = {x:0,y:0,vx:0,vy:0,life:0,ttl:0,active:false};
  }
}

/* Emit small burst at x,y */
function emitParticles(x,y,count=12){
  for(let i=0;i<count;i++){
    for(let j=0;j<particles.length;j++){
      const part = particles[j];
      if(!part.active){
        const ang = randRange(0,Math.PI*2);
        const spd = randRange(60,220);
        part.x = x; part.y = y;
        part.vx = Math.cos(ang)*spd;
        part.vy = Math.sin(ang)*spd;
        part.ttl = randRange(0.4,0.9);
        part.life = 0;
        part.active = true;
        break;
      }
    }
  }
}

/* ========= Audio helpers: procedural simple SFX with WebAudio ========= */
function initAudio(){
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = CONFIG.SFX_VOLUME;
    masterGain.connect(audioCtx.destination);
    sfxReady = true;

    // SFX: flap - short chirp
    sfx.flap = function(){
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(720, t+0.06);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t+0.12);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t+0.12);
    };

    // SFX: score - tiny bell
    sfx.score = function(){
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type='sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1320, t+0.09);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t+0.12);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t+0.12);
    };

    // SFX: hit - quick noise + low thud
    sfx.hit = function(){
      const t = audioCtx.currentTime;
      // low thud
      const b = audioCtx.createOscillator();
      const bg = audioCtx.createGain();
      b.type='square';
      b.frequency.setValueAtTime(140, t);
      bg.gain.setValueAtTime(0.16, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t+0.4);
      b.connect(bg); bg.connect(masterGain);
      b.start(t); b.stop(t+0.4);

      // short noise click
      const bufferSize = audioCtx.sampleRate * 0.03;
      const buf = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
      const noise = audioCtx.createBufferSource();
      const ng = audioCtx.createGain();
      ng.gain.setValueAtTime(0.08, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t+0.06);
      noise.buffer = buf;
      noise.connect(ng); ng.connect(masterGain);
      noise.start(t); noise.stop(t+0.06);
    };

  }catch(e){
    console.warn('Audio not supported', e);
    sfxReady = false;
  }
}

/* Attempt to resume audio on first user gesture (required on mobile) */
function ensureAudioUnlocked(){
  if(!audioCtx) initAudio();
  if(audioCtx && audioCtx.state === 'suspended'){
    audioCtx.resume().catch(()=>{ /* ignore */ });
  }
}

/* ========= Persistence ========= */
function loadBest(){
  try{
    const b = localStorage.getItem(STORAGE_KEY);
    bestScore = b ? parseInt(b,10) || 0 : 0;
  }catch(e){ bestScore = 0; }
}
function saveBest(){
  try{ localStorage.setItem(STORAGE_KEY, String(bestScore)); }catch(e){}
}

/* ========= Input handlers ========= */
function flap(){
  if(state === STATE.READY){
    startGame();
  }
  if(state === STATE.PLAYING && bird.alive){
    bird.vy = CONFIG.FLAP_VELOCITY;
    bird.targetAngle = -0.5; // tilt up
    ensureAudioUnlocked();
    if(sfx.flap) sfx.flap();
  }
  if(state === STATE.GAMEOVER){
    // shortcut: flap does nothing
  }
}

function onPointerDown(e){
  e.preventDefault && e.preventDefault();
  flap();
}

/* Buttons */
playBtn.addEventListener('click', () => { ensureAudioUnlocked(); startGame(); });
retryBtn.addEventListener('click', () => { resetGame(); startGame(); });
shareBtn.addEventListener('click', shareScore);
flapBtn.addEventListener('touchstart', onPointerDown, {passive:false});
flapBtn.addEventListener('mousedown', onPointerDown);

/* Global input */
window.addEventListener('touchstart', (e)=>{
  // allow touches outside UI to flap (but ignore if tapping UI controls)
  const el = e.target;
  if(el === playBtn || el === retryBtn || el === shareBtn || el === flapBtn) return;
  onPointerDown(e);
},{passive:false});

window.addEventListener('mousedown', (e) => { onPointerDown(e); });
window.addEventListener('keydown', (e) => {
  if(e.code === 'Space') { e.preventDefault(); onPointerDown(e); }
  if(e.key === 'p' || e.key === 'P') togglePause();
});

/* Visibility / focus handling to pause */
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && state === STATE.PLAYING) pauseGame();
});
window.addEventListener('blur', ()=>{ if(state === STATE.PLAYING) pauseGame(); });

/* ========= Game state transitions ========= */
function goToReady(){
  state = STATE.READY;
  titleScreen.classList.remove('hidden');
  gameOverScreen.classList.add('hidden');
  pauseBanner.classList.add('hidden');
  bird.y = vh/2;
  bird.vy = 0;
  bird.angle = 0;
  bird.targetAngle = 0;
  bird.alive = true;
  score = 0;
}
function startGame(){
  // hide title
  titleScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  pauseBanner.classList.add('hidden');
  // initialize pipes with spawn in future
  initPipes();
  initParticles();
  // position upcoming pipes across the right side
  const initialX = vw + CONFIG.SPAWN_OFFSET;
  for(let i=0;i<pipes.length;i++){
    spawnPipe(initialX + i * CONFIG.PIPE_SPACING);
  }
  state = STATE.PLAYING;
}
function pauseGame(){
  if(state !== STATE.PLAYING) return;
  state = STATE.PAUSED;
  pauseBanner.classList.remove('hidden');
}
function resumeGame(){
  if(state !== STATE.PAUSED) return;
  state = STATE.PLAYING;
  pauseBanner.classList.add('hidden');
}
function togglePause(){
  if(state === STATE.PLAYING) pauseGame();
  else if(state === STATE.PAUSED) resumeGame();
}
function gameOver(){
  state = STATE.GAMEOVER;
  bird.alive = false;
  finalScoreEl.textContent = `Score: ${score}`;
  if(score > bestScore){ bestScore = score; saveBest(); }
  bestScoreEl.textContent = `Best: ${bestScore}`;
  gameOverScreen.classList.remove('hidden');
  if(sfx.hit) sfx.hit();
  emitParticles(bird.x, bird.y, 28);
}

/* ========= Collision detection (AABB for pipes & ground) ========= */
function checkCollisions(){
  // ground collision
  const groundY = vh - 18;
  if(bird.y + bird.radius >= groundY){
    return true;
  }
  // ceiling
  if(bird.y - bird.radius <= 0) {
    bird.y = bird.radius; bird.vy = 0;
  }

  // pipes
  for(let i=0;i<pipes.length;i++){
    const p = pipes[i];
    if(!p.active) continue;
    const bx = bird.x;
    const by = bird.y;
    const r = bird.radius;
    // top pipe rect
    const left = p.x;
    const right = p.x + p.width;
    const top = 0;
    const bottom = p.gapY;
    if(aabbCircleCollision(left, top, right-left, bottom-top, bx, by, r)) return true;
    // bottom pipe rect
    const top2 = p.gapY + p.gap;
    const bottom2 = vh;
    if(aabbCircleCollision(left, top2, right-left, bottom2-top2, bx, by, r)) return true;
  }
  return false;
}

/* AABB vs circle collision */
function aabbCircleCollision(ax, ay, aw, ah, cx, cy, cr){
  // find closest point on aabb to circle center
  const nearestX = clamp(cx, ax, ax+aw);
  const nearestY = clamp(cy, ay, ay+ah);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return (dx*dx + dy*dy) < (cr*cr);
}

/* ========= Update loop ========= */
function update(dt){
  if(state !== STATE.PLAYING) {
    // still animate small background parallax
    updateParticles(dt); // keep particles animating on menus too
    return;
  }

  // Bird physics: semi-implicit Euler integration
  bird.vy += CONFIG.GRAVITY * dt;
  bird.vy = clamp(bird.vy, -9999, CONFIG.TERMINAL_VELOCITY);
  bird.y += bird.vy * dt;

  // bird tilt smoothing: target depends on vy
  bird.targetAngle = clamp(mapRange(bird.vy, CONFIG.FLAP_VELOCITY, CONFIG.TERMINAL_VELOCITY, -0.6, 0.9), -1.2, 1.1);
  bird.angle += (bird.targetAngle - bird.angle) * clamp(12 * dt, 0, 1);

  // move pipes and scoring
  for(let i=0;i<pipes.length;i++){
    const p = pipes[i];
    if(!p.active) continue;
    p.x -= CONFIG.PIPE_SPEED * dt;
    // score detection when pipe passes bird.x and not yet counted
    if(!p.passed && (p.x + p.width) < bird.x){
      p.passed = true;
      score += 1;
      ensureAudioUnlocked();
      if(sfx.score) sfx.score();
      emitParticles(bird.x + 10, bird.y, 8);
    }
    // respawn if offscreen left
    if(p.x + p.width < -CONFIG.SPAWN_OFFSET){
      // place at rightmost + spacing
      const rightmost = findRightmostPipe();
      p.x = rightmost + CONFIG.PIPE_SPACING;
      p.gapY = clamp(randRange(CONFIG.MIN_GAP_Y, vh - CONFIG.MAX_GAP_Y_MARGIN - p.gap), CONFIG.MIN_GAP_Y, vh - CONFIG.MAX_GAP_Y_MARGIN - p.gap);
      p.gap = CONFIG.PIPE_GAP + randRange(-20, 40);
      p.passed = false;
    }
  }

  updateParticles(dt);

  // Check collisions
  if(checkCollisions()){
    if(bird.alive) gameOver();
  }
}

/* Map a range to another */
function mapRange(v, a1, a2, b1, b2){
  const t = (v - a1) / (a2 - a1);
  return b1 + t * (b2 - b1);
}

/* Find rightmost pipe x */
function findRightmostPipe(){
  let m = -Infinity;
  for(let i=0;i<pipes.length;i++) if(pipes[i].active) m = Math.max(m, pipes[i].x);
  if(!isFinite(m)) m = vw;
  return m;
}

/* ========= Particles update ========= */
function updateParticles(dt){
  for(let i=0;i<particles.length;i++){
    const p = particles[i];
    if(!p.active) continue;
    p.life += dt;
    if(p.life >= p.ttl){ p.active = false; continue; }
    // simple physics
    p.vy += CONFIG.GRAVITY * 0.3 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

/* ========= Render loop ========= */
function render(){
  ctx.clearRect(0,0,vw,vh);

  // draw parallax layers from offscreen canvases
  for(let i=0;i<bgCanvases.length;i++){
    const b = bgCanvases[i];
    const speed = CONFIG.PARALLAX_SPEEDS[i] || (10*(i+1));
    // compute x offset based on time
    const offsetX = (performance.now() / 1000 * speed) % vw;
    // two draws to tile horizontally
    ctx.save();
    ctx.globalAlpha = (i===0 ? 0.95 : 1);
    const sy = i===0 ? 0 : vh - b.height - 10;
    ctx.drawImage(b.canvas, -offsetX, sy, vw, b.height);
    ctx.drawImage(b.canvas, vw - offsetX, sy, vw, b.height);
    ctx.restore();
  }

  // draw pipes
  for(let i=0;i<pipes.length;i++){
    const p = pipes[i];
    if(!p.active) continue;
    drawPipe(ctx, p.x, 0, p.width, p.gapY, p.gap);
  }

  // draw ground
  drawGround(ctx);

  // draw bird
  drawBird(ctx, bird.x, bird.y, bird.radius, bird.angle);

  // draw particles
  for(let i=0;i<particles.length;i++){
    const p = particles[i];
    if(!p.active) continue;
    const t = p.life / p.ttl;
    ctx.globalAlpha = 1 - t;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,200,60,${1-t})`;
    ctx.arc(p.x, p.y, 3*(1-t)+1, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // draw score (large)
  ctx.save();
  ctx.font = `${Math.round(Math.max(22, vw*0.08))}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 6;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  if(state === STATE.PLAYING || state === STATE.PAUSED){
    ctx.strokeText(String(score), vw/2, 80);
    ctx.fillText(String(score), vw/2, 80);
  }
  ctx.restore();

  // show FPS optionally
  if(showFPS){
    fpsEl.textContent = `${Math.round(frameCount/(fpsTime||1))} FPS`;
  }
}

/* Draw functions (procedural) */
function drawPipe(g, x, y, w, gapY, gap){
  g.save();
  // top pipe
  g.fillStyle = '#2d8a6b';
  g.fillRect(x, y, w, gapY);
  // bottom pipe
  g.fillRect(x, gapY + gap, w, vh - (gapY + gap) - 18);
  // pipe rim (rounded)
  g.fillStyle = '#2b7f63';
  g.fillRect(x - 6, gapY - 12, w + 12, 12); // top rim
  g.fillRect(x - 6, gapY + gap, w + 12, 12); // bottom rim
  g.restore();
}

function drawGround(g){
  g.save();
  const gh = 18;
  g.fillStyle = '#566b55';
  g.fillRect(0, vh - gh, vw, gh);
  // small stripes to add texture
  g.fillStyle = 'rgba(255,255,255,0.03)';
  for(let x=0;x<vw;x+=6) g.fillRect(x, vh-gh, 3, gh);
  g.restore();
}

function drawBird(g, x, y, r, angle){
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  // body
  g.beginPath();
  g.fillStyle = '#ffdd57';
  g.ellipse(0,0, r*1.2, r, 0, 0, Math.PI*2);
  g.fill();
  // wing
  g.fillStyle = '#f2b400';
  g.beginPath();
  g.ellipse(-r*0.1, 0, r*0.6, r*0.4, Math.PI/3, 0, Math.PI*2);
  g.fill();
  // eye
  g.fillStyle = '#222';
  g.beginPath();
  g.arc(r*0.4, -r*0.35, r*0.18, 0, Math.PI*2);
  g.fill();
  // beak
  g.fillStyle = '#ff7a00';
  g.beginPath();
  g.moveTo(r*0.9, -r*0.05);
  g.lineTo(r*1.3, r*0.12);
  g.lineTo(r*0.9, r*0.32);
  g.closePath();
  g.fill();

  g.restore();
}

/* ========= Main loop harness ========= */
function mainLoop(ts){
  if(!lastTime) lastTime = ts;
  const deltaMS = ts - lastTime;
  lastTime = ts;
  // convert to seconds
  let dt = Math.min(0.05, deltaMS / 1000); // clamp dt to avoid huge jumps after tabbing
  // update FPS counters
  frameCount++;
  fpsTime = lerp(fpsTime, Math.max(1, deltaMS/1000), 0.1);

  if(state !== STATE.PAUSED){
    update(dt);
  }
  render();

  // update FPS readout per second
  requestAnimationFrame(mainLoop);
}

/* simple lerp for smoothing */
function lerp(a,b,t){ return a + (b-a)*t; }

/* ========= Initialization / Boot ========= */
function boot(){
  resizeCanvas();
  loadBest();
  initParticles();
  initPipes();
  initAudio(); // create AudioContext if permitted
  // show title
  goToReady();
  // start RAF
  requestAnimationFrame(mainLoop);
  state = STATE.READY; // ensure Ready shown
  // show best on title screen
  bestScoreEl.textContent = `Best: ${bestScore}`;
}

/* Some helpers for share */
function shareScore(){
  const text = `I scored ${score} in Flappy (vanilla) — can you beat me?`;
  if(navigator.share){
    navigator.share({title:'Flappy Score', text});
  } else {
    // fallback copy to clipboard or open mail
    const url = encodeURIComponent(location.href);
    const subject = encodeURIComponent('My Flappy Score');
    const body = encodeURIComponent(`${text}\nPlay here: ${location.href}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }
}

/* Reset game to Ready state */
function resetGame(){
  bird.y = vh/2;
  bird.vy = 0;
  bird.angle = 0;
  score = 0;
  initParticles();
  initPipes();
  goToReady();
}

/* Utility to gradually show FPS properly */
function updateFPSDisplay(){
  // smoothing frame counter
  if(!showFPS) return;
  // compute approx FPS: we display nothing heavy; handled in render
}

/* expose minimal debug methods in dev console */
window.__flappy = {
  resetGame, spawnPipe, get state(){return state}, setFPSVisible(v){ showFPS = !!v; fpsEl.style.display = showFPS ? 'block':'none' }
};

/* ========= Start app ========= */
boot();

/* ========= Small tests & dev helpers (run in console if needed) ========= */
/*
Test ideas (these are also in step-by-step deliverables):
- Tap the screen three times quickly -> bird should move up and rotate to -0.5 rad.
- Let the bird fall into a pipe -> Game Over screen appears, particles burst, and hit sound plays.
- Score increases by 1 when bird passes each pipe pair.
- Reload the page and watch best score persist (localStorage).
*/
