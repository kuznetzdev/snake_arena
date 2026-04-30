'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const TICK_HZ = 30;
const SNAPSHOT_HZ = 20;
const WORLD = 9000;
const HALF = WORLD / 2;
const GAP = 9;
const RADIUS = 10;
const TAU = Math.PI * 2;
const COLORS = [200, 275, 335, 155, 38, 2, 122, 225, 50, 300];
const BOT_NAMES = 'Cobra Python Mamba Viper Anaconda Boa Asp Phantom Nox Zeus Shadow Blade Venom Storm Omega Raptor Sector Cipher'.split(' ');
const DEFAULT_CONFIG = Object.freeze({ bots: 14, food: 900, obstacles: 34 });

let config = { ...DEFAULT_CONFIG };
let food = [];
let obstacles = [];
let snakes = new Map();
let lastSnapshot = null;
let lastTick = Date.now();
let startedAt = Date.now();
let matchStartedAt = Date.now();

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function dist2(a, b) { const dx = a.x - b.x; const dy = a.y - b.y; return dx * dx + dy * dy; }
function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
function segDist2(px, py, ax, ay, bx, by) { const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay; const c = vx * vx + vy * vy; const t = c ? clamp((wx * vx + wy * vy) / c, 0, 1) : 0; const x = ax + vx * t, y = ay + vy * t; const dx = px - x, dy = py - y; return dx * dx + dy * dy; }
function safeName(name) { return String(name || 'Player').trim().slice(0, 16) || 'Player'; }
function now() { return Date.now(); }
function id(prefix = 'p') { return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function getLanUrls() { const urls = []; for (const infos of Object.values(os.networkInterfaces())) for (const info of infos || []) if (info.family === 'IPv4' && !info.internal) urls.push(`http://${info.address}:${PORT}`); return urls; }
function sanitizeConfig(input = {}) { return { bots: clamp(Number(input.bots ?? config.bots), 0, 40) | 0, food: clamp(Number(input.food ?? config.food), 150, 1800) | 0, obstacles: clamp(Number(input.obstacles ?? config.obstacles), 0, 90) | 0 }; }

class Obstacle { constructor(x, y, r) { this.x = x; this.y = y; this.r = r; } hit(x, y, pad = 0) { return Math.hypot(x - this.x, y - this.y) < this.r + pad; } }
class Food { constructor(x = rand(-HALF + 80, HALF - 80), y = rand(-HALF + 80, HALF - 80), v = rand(3, 6.5)) { this.id = id('f'); this.x = x; this.y = y; this.v = v; this.h = pick(COLORS); } }

class Brain {
  constructor() { this.t = 0; this.tx = 0; this.ty = 0; this.kind = pick(['eat', 'hunt', 'trap', 'coward']); this.safe = rand(0, TAU); this.mode = 'eat'; }
  dangerAt(s, x, y) {
    let d = 0;
    const wall = Math.min(HALF - Math.abs(x), HALF - Math.abs(y));
    if (wall < 160) d += (160 - wall) * 1.2;
    for (const ob of obstacles) { const od = Math.hypot(x - ob.x, y - ob.y) - ob.r; if (od < 180) d += (180 - od) * 1.7; }
    for (const other of snakes.values()) {
      if (!other.alive) continue;
      for (let i = other === s ? 13 : 2; i < other.body.length; i += 5) { const p = other.body[i]; const dd = Math.hypot(x - p.x, y - p.y); if (dd < 95) d += (95 - dd) * (other === s ? 1 : 1.6); }
    }
    return d;
  }
  bestAngle(s, desired, far = 500) {
    let best = desired, score = -Infinity;
    for (let i = 0; i < 13; i++) {
      const a = desired + (i / 12 - 0.5) * Math.PI * 1.1;
      let sc = -Math.abs(angleDiff(s.angle, a)) * 18;
      for (let k = 1; k <= 5; k++) { const q = k / 5; const px = s.head.x + Math.cos(a) * far * q; const py = s.head.y + Math.sin(a) * far * q; sc -= this.dangerAt(s, px, py) * (1.25 / k); sc += Math.min(HALF - Math.abs(px), HALF - Math.abs(py)) * 0.025; }
      if (sc > score) { score = sc; best = a; }
    }
    this.safe = best;
    return best;
  }
  findFood(s) {
    let best = null, score = -Infinity;
    for (let i = 0; i < food.length; i += food.length > 850 ? 2 : 1) {
      const f = food[i]; const dd = dist(s.head, f); if (dd > 850) continue;
      const need = (100 - s.health) * 0.04 + (100 - s.boost) * 0.02;
      const sc = f.v * 90 * (1 + need) / (dd + 45) - this.dangerAt(s, f.x, f.y) * 0.012;
      if (sc > score) { score = sc; best = f; }
    }
    return best;
  }
  think(s, dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.22;
    let threat = null, prey = null, danger = 0;
    for (const ob of obstacles) { const od = Math.hypot(s.head.x - ob.x, s.head.y - ob.y) - ob.r; if (od < 220) danger += 220 - od; }
    for (const other of snakes.values()) {
      if (!other.alive || other === s) continue;
      const hd = dist(s.head, other.head);
      if (hd < 740 && other.len > s.len * 1.12) threat = other;
      if (hd < 740 && s.len > other.len * 1.18) prey = other;
      for (let i = 2; i < other.body.length; i += 4) { const p = other.body[i]; const dd = Math.hypot(s.head.x - p.x, s.head.y - p.y); if (dd < 130) danger += 130 - dd; }
    }
    if (danger > 150 || threat) { const a = threat ? Math.atan2(s.head.y - threat.head.y, s.head.x - threat.head.x) : this.safe; const b = this.bestAngle(s, a, 720); this.tx = s.head.x + Math.cos(b) * 720; this.ty = s.head.y + Math.sin(b) * 720; this.mode = 'run'; return; }
    if (s.health < 45 || s.boost < 18 || !prey || this.kind === 'eat') { const f = this.findFood(s); if (f) { this.tx = f.x; this.ty = f.y; this.mode = s.health < 28 ? 'survive' : 'eat'; return; } }
    if (prey && s.health > 28 && s.boost > 18 && Math.random() < 0.65) { const lead = this.kind === 'trap' ? 250 : 150; const side = this.kind === 'trap' ? 110 : 0; this.tx = prey.head.x + Math.cos(prey.angle) * lead + Math.cos(prey.angle + Math.PI / 2) * side; this.ty = prey.head.y + Math.sin(prey.angle) * lead + Math.sin(prey.angle + Math.PI / 2) * side; this.mode = this.kind === 'trap' ? 'trap' : 'hunt'; return; }
    const a = rand(0, TAU); this.tx = s.head.x + Math.cos(a) * 650; this.ty = s.head.y + Math.sin(a) * 650; this.mode = 'roam';
  }
  control(s) { const a = Math.atan2(this.ty - s.head.y, this.tx - s.head.x); const safe = this.bestAngle(s, a, this.mode === 'run' ? 380 : 260); const d = Math.hypot(this.tx - s.head.x, this.ty - s.head.y); const boost = ((this.mode === 'run' && d > 180) || (this.mode === 'hunt' && d > 170) || (this.mode === 'survive' && s.health < 24 && d > 170)) && s.boost > 10 && s.health > 18; return { angle: safe, boost }; }
}

class Snake {
  constructor({ snakeId, name, h, bot = false, x = 0, y = 0 }) {
    this.id = snakeId; this.name = safeName(name); this.h = h; this.bot = bot; this.alive = true; this.len = bot ? 18 + Math.random() * 30 : 15; this.score = 0; this.kills = 0; this.deaths = 0; this.health = 100; this.boost = 100; this.boosting = false; this.angle = rand(0, TAU); this.targetAngle = this.angle; this.speed = 0; this.prev = { x, y }; this.input = { angle: this.angle, boost: false, lastSeen: now() }; this.path = [];
    for (let i = 0; i < 140; i++) this.path.push({ x: x - Math.cos(this.angle) * i * 4, y: y - Math.sin(this.angle) * i * 4 });
    this.body = []; this.brain = bot ? new Brain() : null; this.rebuildBody();
  }
  get head() { return this.path[0]; }
  total() { return Math.floor(this.score + this.len * 2); }
  pointAt(distance) { let acc = 0; for (let i = 1; i < this.path.length; i++) { const a = this.path[i - 1], b = this.path[i], seg = dist(a, b); if (acc + seg >= distance) { const t = (distance - acc) / Math.max(0.001, seg); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; } acc += seg; } return this.path[this.path.length - 1]; }
  rebuildBody() { this.body = []; for (let i = 0; i < Math.max(10, Math.floor(this.len)); i++) this.body.push(this.pointAt(i * GAP)); }
  trimPath() { const need = (this.len + 42) * GAP; let acc = 0; for (let i = 1; i < this.path.length; i++) { acc += dist(this.path[i - 1], this.path[i]); if (acc > need) { this.path.length = i + 1; return; } } }
  update(dt) {
    if (!this.alive) return;
    if (this.bot) { this.brain.think(this, dt); const c = this.brain.control(this); this.targetAngle = c.angle; this.boosting = c.boost; } else { this.targetAngle = Number.isFinite(this.input.angle) ? this.input.angle : this.angle; this.boosting = !!this.input.boost; }
    this.boosting = this.boosting && this.boost > 0 && this.len > 10; this.angle += clamp(angleDiff(this.angle, this.targetAngle), -8.8 * dt, 8.8 * dt);
    const base = 190 + Math.min(80, this.len * 0.18); const fast = 365 + Math.min(100, this.len * 0.16); this.health = Math.max(0, this.health - ((this.bot ? 0.50 : 0.72) + (this.boosting ? 2.9 : 0)) * dt); if (this.health <= 0) { this.die(null); return; }
    if (this.boosting) { this.boost = Math.max(0, this.boost - 32 * dt); if (this.boost <= 0) { this.boost = 0; this.boosting = false; } if (this.boosting && Math.random() < 5 * dt) this.len = Math.max(10, this.len - 0.3); }
    this.speed = this.boosting ? fast : base; const old = this.head; this.prev = { x: old.x, y: old.y }; const nx = old.x + Math.cos(this.angle) * this.speed * dt; const ny = old.y + Math.sin(this.angle) * this.speed * dt; this.path.unshift({ x: nx, y: ny });
    if (Math.abs(nx) > HALF - 30 || Math.abs(ny) > HALF - 30) { this.path[0].x = clamp(nx, -HALF + 30, HALF - 30); this.path[0].y = clamp(ny, -HALF + 30, HALF - 30); this.die(null); return; }
    this.trimPath(); this.rebuildBody(); this.eatFood();
  }
  eatFood() { for (let i = food.length - 1; i >= 0; i--) { const f = food[i]; const rr = RADIUS + f.v + 2; if (dist2(this.head, f) < rr * rr) { this.len += f.v * 0.75; this.health = Math.min(100, this.health + f.v * 2); this.boost = Math.min(100, this.boost + f.v * 3); this.score += f.v * 8; food.splice(i, 1); } } }
  die(killer) { if (!this.alive) return; this.alive = false; this.deaths += 1; for (let i = 0; i < this.body.length; i += this.bot ? 1 : 2) { const p = this.body[i]; food.push(new Food(p.x + rand(-10, 10), p.y + rand(-10, 10), rand(3, 6))); } if (killer && killer.alive) { killer.score += this.len * 25; killer.len += Math.min(12, this.len * 0.08); killer.kills += 1; } }
  snapshot() { return { id: this.id, name: this.name, h: this.h, bot: this.bot, alive: this.alive, len: Math.floor(this.len), score: this.total(), kills: this.kills, deaths: this.deaths, health: Math.floor(this.health), boost: Math.floor(this.boost), angle: this.angle, head: this.head, body: this.body.filter((_, i) => i % 2 === 0) }; }
}

function spawnObstacles() { obstacles = []; let guard = 0; while (obstacles.length < config.obstacles && guard++ < config.obstacles * 50) { const r = rand(42, 112), x = rand(-HALF + 250, HALF - 250), y = rand(-HALF + 250, HALF - 250); if (Math.hypot(x, y) < 700) continue; if (obstacles.some(o => Math.hypot(x - o.x, y - o.y) < r + o.r + 260)) continue; obstacles.push(new Obstacle(x, y, r)); } }
function insideObstacle(x, y, pad = 0) { return obstacles.some(o => o.hit(x, y, pad)); }
function spawnFood() { let guard = 0; while (food.length < config.food && guard++ < config.food * 4) { const x = rand(-HALF + 90, HALF - 90), y = rand(-HALF + 90, HALF - 90); if (insideObstacle(x, y, 50)) continue; food.push(new Food(x, y)); } }
function randomSpawn() { for (let i = 0; i < 80; i++) { const x = rand(-HALF * 0.8, HALF * 0.8), y = rand(-HALF * 0.8, HALF * 0.8); if (!insideObstacle(x, y, 190)) return { x, y }; } return { x: 0, y: 0 }; }
function makeSnake({ snakeId = id('p'), name = 'Player', h = pick(COLORS), bot = false } = {}) { const p = randomSpawn(); return new Snake({ snakeId, name, h, bot, x: p.x, y: p.y }); }
function spawnBot() { const s = makeSnake({ snakeId: id('b'), name: pick(BOT_NAMES), h: pick(COLORS), bot: true }); snakes.set(s.id, s); }
function maintainBots() { const aliveBots = [...snakes.values()].filter(s => s.bot && s.alive).length; if (aliveBots < config.bots) spawnBot(); }
function cleanupPlayers() { const t = now(); for (const [sid, s] of snakes) if (!s.bot && t - s.input.lastSeen > 20000) snakes.delete(sid); }
function resetWorld({ keepPlayers = true } = {}) { const players = keepPlayers ? [...snakes.values()].filter(s => !s.bot).map(s => ({ id: s.id, name: s.name, h: s.h, kills: s.kills, deaths: s.deaths })) : []; food = []; obstacles = []; snakes = new Map(); spawnObstacles(); for (const p of players) { const s = makeSnake({ snakeId: p.id, name: p.name, h: p.h, bot: false }); s.kills = p.kills; s.deaths = p.deaths; snakes.set(s.id, s); } for (let i = 0; i < config.bots; i++) spawnBot(); spawnFood(); matchStartedAt = now(); makeSnapshot(); }
function getStats() { const list = [...snakes.values()]; return { players: list.filter(s => !s.bot).length, bots: list.filter(s => s.bot).length, alive: list.filter(s => s.alive).length, food: food.length, obstacles: obstacles.length, uptimeMs: now() - startedAt, matchMs: now() - matchStartedAt }; }
function collisions() {
  const alive = [...snakes.values()].filter(s => s.alive);
  for (const s of alive) for (const o of obstacles) { const rr = o.r + RADIUS; if (dist2(s.head, o) < rr * rr || segDist2(o.x, o.y, s.prev.x, s.prev.y, s.head.x, s.head.y) < rr * rr) { s.die(null); break; } }
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) { const a = alive[i], b = alive[j]; if (!a.alive || !b.alive) continue; const rr = (RADIUS + RADIUS) * 0.95; const hit = dist2(a.head, b.head) < rr * rr || segDist2(a.head.x, a.head.y, b.prev.x, b.prev.y, b.head.x, b.head.y) < rr * rr || segDist2(b.head.x, b.head.y, a.prev.x, a.prev.y, a.head.x, a.head.y) < rr * rr; if (hit) { const gap = Math.abs(a.len - b.len) / Math.max(a.len, b.len); if (gap < 0.08) { a.die(null); b.die(null); } else if (a.len < b.len) a.die(b); else b.die(a); } }
  for (const s of alive) { if (!s.alive) continue; for (const o of alive) { if (!o.alive) continue; const start = s === o ? 13 : 1; for (let i = start; i < o.body.length; i++) { const p = o.body[i], rr = RADIUS + RADIUS * 0.8; if (dist2(s.head, p) < rr * rr || segDist2(p.x, p.y, s.prev.x, s.prev.y, s.head.x, s.head.y) < rr * rr) { s.die(o === s ? null : o); break; } } if (!s.alive) break; } }
}
function tick() { const t = now(); const dt = Math.min(0.05, (t - lastTick) / 1000); lastTick = t; spawnFood(); maintainBots(); cleanupPlayers(); for (const s of snakes.values()) s.update(dt); collisions(); }
function makeSnapshot() { lastSnapshot = { world: WORLD, time: now(), config, stats: getStats(), snakes: [...snakes.values()].map(s => s.snapshot()), food: food.filter((_, i) => i % 2 === 0).map(f => ({ x: f.x, y: f.y, v: f.v, h: f.h })), obstacles: obstacles.map(o => ({ x: o.x, y: o.y, r: o.r })) }; }
function infoPayload() { return { port: PORT, localUrl: `http://localhost:${PORT}`, hostUrl: `http://localhost:${PORT}/host.html`, lanUrls: getLanUrls(), config, stats: getStats(), startedAt: new Date(startedAt).toISOString(), matchStartedAt: new Date(matchStartedAt).toISOString() }; }
function sendJson(res, status, data) { const body = JSON.stringify(data); res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body); }
function readBody(req) { return new Promise((resolve, reject) => { let body = ''; req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); }); req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } }); req.on('error', reject); }); }
function serveStatic(req, res) { const url = new URL(req.url, `http://${req.headers.host}`); const file = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, ''); const full = path.normalize(path.join(PUBLIC_DIR, file)); if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; } fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end('Not found'); return; } const ext = path.extname(full).toLowerCase(); const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : ext === '.json' ? 'application/json; charset=utf-8' : 'application/octet-stream'; res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(data); }); }

resetWorld({ keepPlayers: false });
setInterval(tick, 1000 / TICK_HZ);
setInterval(makeSnapshot, 1000 / SNAPSHOT_HZ);
makeSnapshot();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/api/info') { sendJson(res, 200, infoPayload()); return; }
    if (req.method === 'GET' && url.pathname === '/api/settings') { sendJson(res, 200, { config, stats: getStats() }); return; }
    if (req.method === 'POST' && url.pathname === '/api/settings') { const body = await readBody(req); config = sanitizeConfig(body); resetWorld({ keepPlayers: true }); sendJson(res, 200, { ok: true, config, stats: getStats() }); return; }
    if (req.method === 'POST' && url.pathname === '/api/reset') { resetWorld({ keepPlayers: true }); sendJson(res, 200, { ok: true, config, stats: getStats() }); return; }
    if (req.method === 'POST' && url.pathname === '/api/join') { const body = await readBody(req); const sid = id('p'); const s = makeSnake({ snakeId: sid, name: safeName(body.name), h: pick(COLORS), bot: false }); snakes.set(sid, s); sendJson(res, 200, { id: sid, world: WORLD }); return; }
    if (req.method === 'POST' && url.pathname === '/api/input') { const body = await readBody(req); const s = snakes.get(String(body.id || '')); if (!s || s.bot) { sendJson(res, 404, { ok: false }); return; } if (!s.alive && body.respawn) { const fresh = makeSnake({ snakeId: s.id, name: s.name, h: s.h, bot: false }); fresh.kills = s.kills; fresh.deaths = s.deaths; snakes.set(s.id, fresh); } else { s.input.angle = Number(body.angle); s.input.boost = !!body.boost; s.input.lastSeen = now(); } sendJson(res, 200, { ok: true }); return; }
    if (req.method === 'GET' && url.pathname === '/api/state') { sendJson(res, 200, lastSnapshot || {}); return; }
    if (req.method === 'GET' && url.pathname === '/api/health') { sendJson(res, 200, { ok: true, ...getStats() }); return; }
    if (req.method === 'GET') { serveStatic(req, res); return; }
    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Snake Arena LAN server: http://localhost:${PORT}`);
  for (const u of getLanUrls()) console.log(`LAN: ${u}`);
});
