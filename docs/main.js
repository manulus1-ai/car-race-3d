import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// --- DOM
const canvas = document.getElementById('c');
const elLap = document.getElementById('lap');
const elLapsTotal = document.getElementById('lapsTotal');
const elTime = document.getElementById('time');
const elBest = document.getElementById('best');
const elSpeed = document.getElementById('speed');
const elHits = document.getElementById('hits');
const elScore = document.getElementById('score');
const btnReset = document.getElementById('reset');
const btnMute = document.getElementById('mute');
const toast = document.getElementById('toast');
const mapCanvas = document.getElementById('map');
const mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;

// --- Scene
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setClearColor(0x0b0f14, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b0f14, 45, 160);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);

// Lights
const hemi = new THREE.HemisphereLight(0xdde8ff, 0x1b2a3a, 0.7);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(20, 35, 10);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
dir.shadow.camera.left = -70;
dir.shadow.camera.right = 70;
dir.shadow.camera.top = 70;
dir.shadow.camera.bottom = -70;
dir.shadow.camera.near = 1;
dir.shadow.camera.far = 120;
scene.add(dir);

// Ground (grass)
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x12301f, roughness: 1, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Track parameters (a rounded rectangle)
const TRACK = {
  halfW: 36,
  halfH: 24,
  cornerR: 11,
  width: 7.5,
};

function roundedRectPoints(halfW, halfH, r, segmentsPerCorner = 24) {
  const pts = [];
  const corners = [
    { cx: halfW - r, cz: halfH - r, a0: 0, a1: Math.PI / 2 },
    { cx: -halfW + r, cz: halfH - r, a0: Math.PI / 2, a1: Math.PI },
    { cx: -halfW + r, cz: -halfH + r, a0: Math.PI, a1: (3 * Math.PI) / 2 },
    { cx: halfW - r, cz: -halfH + r, a0: (3 * Math.PI) / 2, a1: 2 * Math.PI },
  ];

  for (let i = 0; i < corners.length; i++) {
    const c = corners[i];
    for (let j = 0; j <= segmentsPerCorner; j++) {
      const t = j / segmentsPerCorner;
      const a = THREE.MathUtils.lerp(c.a0, c.a1, t);
      pts.push(new THREE.Vector3(c.cx + Math.cos(a) * r, 0, c.cz + Math.sin(a) * r));
    }
  }

  return pts;
}

const centerline = roundedRectPoints(TRACK.halfW, TRACK.halfH, TRACK.cornerR, 18);
const curve = new THREE.CatmullRomCurve3(centerline, true, 'catmullrom', 0.08);

// Build track ribbon
function buildRibbon(curve, width, steps = 900) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const up = new THREE.Vector3(0, 1, 0);
  let prev = curve.getPoint(0);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.getPoint(t);
    const p2 = curve.getPoint((t + 1 / steps) % 1);
    const tangent = p2.clone().sub(p).normalize();
    const right = new THREE.Vector3().crossVectors(up, tangent).normalize();

    const leftPt = p.clone().addScaledVector(right, -width / 2);
    const rightPt = p.clone().addScaledVector(right, width / 2);

    positions.push(leftPt.x, 0.02, leftPt.z);
    positions.push(rightPt.x, 0.02, rightPt.z);

    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, t * 20, 1, t * 20);

    if (i < steps) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = i * 2 + 2;
      const d = i * 2 + 3;
      indices.push(a, c, b, b, c, d);
    }

    prev = p;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeBoundingSphere();
  return geom;
}

const trackMat = new THREE.MeshStandardMaterial({
  color: 0x2c2c34,
  roughness: 0.95,
  metalness: 0.02,
});

const track = new THREE.Mesh(buildRibbon(curve, TRACK.width, 900), trackMat);
track.receiveShadow = true;
scene.add(track);

// Track edges (simple posts)
const postGeom = new THREE.CylinderGeometry(0.12, 0.12, 1.1, 10);
const postMat = new THREE.MeshStandardMaterial({ color: 0xdad7d2, roughness: 0.7 });
const postGroup = new THREE.Group();
postGroup.castShadow = true;
scene.add(postGroup);

for (let i = 0; i < 90; i++) {
  const t = i / 90;
  const p = curve.getPoint(t);
  const p2 = curve.getPoint((t + 0.01) % 1);
  const tangent = p2.clone().sub(p).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize();

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.copy(p).addScaledVector(right, (TRACK.width / 2 + 0.7) * side);
    post.position.y = 0.55;
    post.castShadow = true;
    postGroup.add(post);
  }
}

// Start line
const startLine = new THREE.Mesh(
  new THREE.PlaneGeometry(TRACK.width + 1.2, 1.4),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 })
);
startLine.rotation.x = -Math.PI / 2;
startLine.position.set(TRACK.halfW - TRACK.cornerR, 0.025, TRACK.halfH - TRACK.cornerR);
scene.add(startLine);

// Mid checkpoint opposite side
const checkpointPos = new THREE.Vector3(-TRACK.halfW + TRACK.cornerR, 0.02, -TRACK.halfH + TRACK.cornerR);

// Car
const car = new THREE.Group();
scene.add(car);

const body = new THREE.Mesh(
  new THREE.BoxGeometry(1.4, 0.5, 2.6),
  new THREE.MeshStandardMaterial({ color: 0xff3355, roughness: 0.35, metalness: 0.2 })
);
body.castShadow = true;
body.position.y = 0.35;
car.add(body);

const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(1.15, 0.45, 1.2),
  new THREE.MeshStandardMaterial({ color: 0x1b1f2a, roughness: 0.2, metalness: 0.1 })
);
cabin.castShadow = true;
cabin.position.set(0, 0.62, -0.1);
car.add(cabin);

const wheelGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.26, 16);
wheelGeom.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x121215, roughness: 0.95 });

for (const sx of [-0.62, 0.62]) {
  for (const sz of [-0.9, 0.9]) {
    const w = new THREE.Mesh(wheelGeom, wheelMat);
    w.castShadow = true;
    w.position.set(sx, 0.22, sz);
    car.add(w);
  }
}

const carState = {
  pos: new THREE.Vector3(startLine.position.x, 0, startLine.position.z + 2.6),
  vel: new THREE.Vector3(0, 0, 0),
  yaw: -Math.PI / 2,
  speed: 0,
};

car.position.copy(carState.pos);
car.rotation.y = carState.yaw;

// Obstacles (cones/boxes) placed around track
const obstacles = [];
const coneGeom = new THREE.ConeGeometry(0.45, 1.2, 10);
const coneMat = new THREE.MeshStandardMaterial({ color: 0xffb000, roughness: 0.8, metalness: 0.0 });

function placeObstacle(t, offsetRight, height = 0.6) {
  const p = curve.getPoint(t);
  const p2 = curve.getPoint((t + 0.01) % 1);
  const tangent = p2.clone().sub(p).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize();
  const m = new THREE.Mesh(coneGeom, coneMat);
  m.castShadow = true;
  m.position.copy(p).addScaledVector(right, offsetRight);
  m.position.y = height;
  scene.add(m);
  obstacles.push({ mesh: m, r: 0.55 });
}

// Some obstacles at varying offsets (within track width)
for (const spec of [
  [0.08, 0.0], [0.14, 1.6], [0.20, -1.9], [0.31, 1.3], [0.38, -1.2],
  [0.52, 0.0], [0.61, 1.8], [0.69, -1.6], [0.77, 0.0], [0.87, -1.8],
]) {
  placeObstacle(spec[0], spec[1]);
}

// --- Input
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyR') resetRun();
  if (e.code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

const touchState = { left: false, right: false, up: false, down: false };
for (const btn of document.querySelectorAll('.touch-btn')) {
  const action = btn.dataset.action;
  const set = (v) => (touchState[action] = v);
  btn.addEventListener('pointerdown', (e) => {
    set(true);
    btn.setPointerCapture(e.pointerId);
    ensureAudio();
  });
  btn.addEventListener('pointerup', () => set(false));
  btn.addEventListener('pointercancel', () => set(false));
  btn.addEventListener('pointerout', () => set(false));
}

// Tap anywhere to unlock audio
window.addEventListener('pointerdown', () => ensureAudio(), { passive: true });

function inputAxis() {
  const left = keys.has('ArrowLeft') || keys.has('KeyA') || touchState.left;
  const right = keys.has('ArrowRight') || keys.has('KeyD') || touchState.right;
  const up = keys.has('ArrowUp') || keys.has('KeyW') || touchState.up;
  const down = keys.has('ArrowDown') || keys.has('KeyS') || touchState.down;

  return {
    steer: (left ? 1 : 0) + (right ? -1 : 0),
    throttle: (up ? 1 : 0) + (down ? -1 : 0),
    up,
    down,
  };
}

// --- Simple helpers
const tmpV = new THREE.Vector3();
function distXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function isOnTrack(pos) {
  // Distance to centerline approximation by sampling nearest of N points
  // Fast enough for v1.
  let best = 1e9;
  const N = 220;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const p = curve.getPoint(t);
    const d = distXZ(pos, p);
    if (d < best) best = d;
  }
  return best < TRACK.width * 0.55;
}

function closestT(pos) {
  let best = 1e9;
  let bestT = 0;
  const N = 320;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const p = curve.getPoint(t);
    const d = distXZ(pos, p);
    if (d < best) {
      best = d;
      bestT = t;
    }
  }
  return bestT;
}

// --- Game state
const GAME = {
  lapsTotal: 3,
  lap: 0,
  hits: 0,
  score: 0,
  running: true,
  startTime: performance.now(),
  lapStartTime: performance.now(),
  bestLap: null,
  passedCheckpoint: false,
  muted: false,
};
elLapsTotal.textContent = String(GAME.lapsTotal);

function showToast(msg, ms = 900) {
  toast.hidden = false;
  toast.textContent = msg;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toast.hidden = true), ms);
}

function resetRun() {
  carState.pos.set(startLine.position.x, 0, startLine.position.z + 2.6);
  carState.vel.set(0, 0, 0);
  carState.yaw = -Math.PI / 2;
  GAME.lap = 0;
  GAME.hits = 0;
  GAME.score = 0;
  GAME.passedCheckpoint = false;
  GAME.startTime = performance.now();
  GAME.lapStartTime = performance.now();
  GAME.running = true;
  updateUI(0);
  showToast('Go!');
}

btnReset.addEventListener('click', resetRun);

function toggleMute() {
  GAME.muted = !GAME.muted;
  btnMute.textContent = `Sound: ${GAME.muted ? 'Off' : 'On'} (M)`;
  if (audio) audio.gain.gain.value = GAME.muted ? 0 : 0.08;
}
btnMute.addEventListener('click', toggleMute);

// --- Audio (simple WebAudio synth)
let audio = null;
function ensureAudio() {
  if (audio || GAME.muted) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  const gain = ctx.createGain();
  gain.gain.value = 0.08;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  audio = { ctx, osc, gain, filter };
}

function enginePitchFromSpeed(speed) {
  const base = 90;
  const s = THREE.MathUtils.clamp(Math.abs(speed), 0, 26);
  return base + s * 18;
}

function beepCrash() {
  if (!audio || GAME.muted) return;
  const ctx = audio.ctx;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = 240;
  g.gain.value = 0.0;
  o.connect(g);
  g.connect(ctx.destination);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0, t);
  g.gain.linearRampToValueAtTime(0.18, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.start(t);
  o.stop(t + 0.2);
}

// --- Resize
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- Camera follow
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();

function updateCamera(dt) {
  camTarget.set(carState.pos.x, 0.4, carState.pos.z);
  // Behind the car
  const behind = new THREE.Vector3(Math.sin(carState.yaw), 0, Math.cos(carState.yaw)).multiplyScalar(8.2);
  camPos.set(carState.pos.x, 4.3, carState.pos.z).add(behind);
  camera.position.lerp(camPos, 1 - Math.exp(-dt * 5));
  camera.lookAt(camTarget);
}

// --- Simulation
function step(dt) {
  const { steer, throttle } = inputAxis();

  // parameters
  const maxSpeed = 26;
  const accel = 28;
  const brake = 36;
  const turnRate = 2.4;
  const drag = 2.2;
  const offTrackDrag = 5.2;

  // Forward direction in XZ
  const forward = tmpV.set(Math.sin(carState.yaw), 0, Math.cos(carState.yaw)).normalize();

  // Accel/brake
  if (throttle > 0) {
    carState.vel.addScaledVector(forward, accel * dt);
  } else if (throttle < 0) {
    carState.vel.addScaledVector(forward, -brake * dt);
  }

  // Steering scales with speed
  const speed = carState.vel.length();
  const steerStrength = THREE.MathUtils.clamp(speed / 10, 0.0, 1.0);
  carState.yaw += steer * turnRate * steerStrength * dt;

  // Clamp max speed
  if (carState.vel.length() > maxSpeed) carState.vel.setLength(maxSpeed);

  // Drag
  const onTrack = isOnTrack(carState.pos);
  const d = onTrack ? drag : offTrackDrag;
  carState.vel.multiplyScalar(Math.max(0, 1 - d * dt));

  // Integrate
  carState.pos.addScaledVector(carState.vel, dt);

  // Collision with obstacles
  for (const ob of obstacles) {
    const rCar = 0.95;
    const d2 = distXZ(carState.pos, ob.mesh.position);
    if (d2 < rCar + ob.r) {
      // push away
      const push = carState.pos.clone().sub(ob.mesh.position);
      push.y = 0;
      const len = push.length() || 0.0001;
      push.multiplyScalar((rCar + ob.r - len) / len);
      carState.pos.add(push);
      carState.vel.add(push.multiplyScalar(8));
      GAME.hits++;
      GAME.score = Math.max(0, GAME.score - 25);
      beepCrash();
      // move cone slightly
      ob.mesh.position.add(push.multiplyScalar(0.3));
    }
  }

  // Keep within world
  carState.pos.x = THREE.MathUtils.clamp(carState.pos.x, -180, 180);
  carState.pos.z = THREE.MathUtils.clamp(carState.pos.z, -180, 180);

  // Update car visuals
  car.position.set(carState.pos.x, 0, carState.pos.z);
  car.rotation.y = carState.yaw;

  // Engine pitch
  if (audio && !GAME.muted) {
    audio.osc.frequency.value = enginePitchFromSpeed(speed);
    audio.filter.frequency.value = 500 + THREE.MathUtils.clamp(speed, 0, 26) * 28;
  }

  // Lap/checkpoint logic
  const startD = distXZ(carState.pos, startLine.position);
  const chkD = distXZ(carState.pos, checkpointPos);

  if (chkD < 4.2) GAME.passedCheckpoint = true;

  if (startD < 4.0 && GAME.passedCheckpoint) {
    GAME.passedCheckpoint = false;
    const now = performance.now();
    const lapTime = (now - GAME.lapStartTime) / 1000;
    GAME.lapStartTime = now;
    GAME.lap++;

    if (GAME.bestLap == null || lapTime < GAME.bestLap) GAME.bestLap = lapTime;

    // scoring: faster lap = more points
    const base = 250;
    const bonus = Math.max(0, Math.round(200 * (1 / Math.max(8, lapTime)) * 12));
    GAME.score += base + bonus;

    showToast(`Lap ${GAME.lap} — ${lapTime.toFixed(2)}s`);

    if (GAME.lap >= GAME.lapsTotal) {
      GAME.running = false;
      showToast(`Finished! Score ${GAME.score}`, 1800);
    }
  }
}

function drawMinimap() {
  if (!mapCtx) return;

  const W = mapCanvas.width;
  const H = mapCanvas.height;

  // world bounds for scaling (track centered near origin)
  const pad = 8;
  const maxX = TRACK.halfW + TRACK.cornerR + 6;
  const maxZ = TRACK.halfH + TRACK.cornerR + 6;

  const sx = (W - pad * 2) / (maxX * 2);
  const sz = (H - pad * 2) / (maxZ * 2);
  const s = Math.min(sx, sz);

  const toMap = (x, z) => {
    // map origin at center
    const mx = W / 2 + x * s;
    const my = H / 2 + z * s;
    return [mx, my];
  };

  mapCtx.clearRect(0, 0, W, H);

  // background
  mapCtx.fillStyle = 'rgba(0,0,0,0.35)';
  mapCtx.fillRect(0, 0, W, H);

  // track path
  mapCtx.lineWidth = 10;
  mapCtx.lineCap = 'round';
  mapCtx.strokeStyle = 'rgba(255,255,255,0.20)';
  mapCtx.beginPath();
  const N = 220;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPoint(t);
    const [mx, my] = toMap(p.x, p.z);
    if (i === 0) mapCtx.moveTo(mx, my);
    else mapCtx.lineTo(mx, my);
  }
  mapCtx.stroke();

  // centerline
  mapCtx.lineWidth = 2;
  mapCtx.strokeStyle = 'rgba(124, 181, 255, 0.35)';
  mapCtx.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPoint(t);
    const [mx, my] = toMap(p.x, p.z);
    if (i === 0) mapCtx.moveTo(mx, my);
    else mapCtx.lineTo(mx, my);
  }
  mapCtx.stroke();

  // start line marker
  {
    const [sx0, sy0] = toMap(startLine.position.x, startLine.position.z);
    mapCtx.fillStyle = 'rgba(255,255,255,0.75)';
    mapCtx.beginPath();
    mapCtx.arc(sx0, sy0, 3.2, 0, Math.PI * 2);
    mapCtx.fill();
  }

  // checkpoint marker
  {
    const [cx0, cy0] = toMap(checkpointPos.x, checkpointPos.z);
    mapCtx.fillStyle = 'rgba(34,197,94,0.65)';
    mapCtx.beginPath();
    mapCtx.arc(cx0, cy0, 3.2, 0, Math.PI * 2);
    mapCtx.fill();
  }

  // obstacles (small dots)
  mapCtx.fillStyle = 'rgba(255,176,0,0.6)';
  for (const ob of obstacles) {
    const [ox, oy] = toMap(ob.mesh.position.x, ob.mesh.position.z);
    mapCtx.fillRect(ox - 1.5, oy - 1.5, 3, 3);
  }

  // car
  {
    const [x, y] = toMap(carState.pos.x, carState.pos.z);
    const on = isOnTrack(carState.pos);

    mapCtx.save();
    mapCtx.translate(x, y);
    mapCtx.rotate(-carState.yaw);

    // arrow-ish car marker
    mapCtx.fillStyle = on ? 'rgba(255,60,100,0.95)' : 'rgba(239,68,68,0.95)';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6);
    mapCtx.lineTo(4.5, 6);
    mapCtx.lineTo(0, 3.2);
    mapCtx.lineTo(-4.5, 6);
    mapCtx.closePath();
    mapCtx.fill();

    mapCtx.restore();
  }

  // border
  mapCtx.strokeStyle = 'rgba(255,255,255,0.12)';
  mapCtx.lineWidth = 1;
  mapCtx.strokeRect(0.5, 0.5, W - 1, H - 1);
}

function updateUI(dt) {
  elLap.textContent = String(GAME.lap);
  elHits.textContent = String(GAME.hits);
  elScore.textContent = String(GAME.score);

  const t = (performance.now() - GAME.startTime) / 1000;
  elTime.textContent = t.toFixed(1);
  elBest.textContent = GAME.bestLap == null ? '—' : `${GAME.bestLap.toFixed(2)}s`;

  const sp = Math.round(carState.vel.length() * 6);
  elSpeed.textContent = String(sp);

  drawMinimap();
}

// Render loop
let last = performance.now();
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (GAME.running) step(dt);
  updateCamera(dt);
  updateUI(dt);
  renderer.render(scene, camera);
}

resetRun();
animate();
