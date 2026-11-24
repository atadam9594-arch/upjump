import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(process.argv[2] || new URL('../public/index.html', import.meta.url), 'utf8');
const isPortalBuild = html.includes('/* CRAZYGAMES_BUILD */ true');
const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');

// Portal compliance checks
assert.ok(!/X-Frame-Options:\s*(DENY|SAMEORIGIN)/i.test(headers), 'public/_headers must allow portal iframe embedding');
assert.ok(!/fonts\.googleapis\.com/i.test(html), 'External Google Fonts CDN should not block offline/portal ZIP packaging');

const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'Missing inline game script');
for (const id of ['gameCanvas', 'novaBtn', 'mobileLeftBtn', 'mobileRightBtn', 'soundBtn', 'overlayMenuBtn', 'pauseBtn', 'langEnBtn', 'langTrBtn', 'skipCoach']) {
  assert.ok(html.includes('id="' + id + '"'), 'Missing element: ' + id);
}

assert.equal(html.includes('id="fullscreenBtn"'), !isPortalBuild);

const listeners = new Map();
const elements = new Map();
const context = new Proxy({}, {
  get(obj, name) {
    if (name === 'createLinearGradient' || name === 'createRadialGradient')
      return () => ({ addColorStop() {} });
    return obj[name] ?? (() => {});
  },
  set(obj, name, value) { obj[name] = value; return true; },
});

function element(id) {
  if (!elements.has(id)) elements.set(id, {
    style: {},
    classList: { toggle() {}, add() {}, remove() {} },
    textContent: '',
    innerHTML: '',
    hidden: false,
    disabled: false,
    attrs: {},
    width: id === 'gameCanvas' ? 400 : 0,
    height: id === 'gameCanvas' ? 640 : 0,
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(type, handler) { listeners.set(id + ':' + type, handler); },
    getContext() { return context; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 640 }; },
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture() { return true; },
    requestFullscreen() {},
    click() { listeners.get(id + ':click')?.({ preventDefault() {}, stopPropagation() {} }); },
  });
  return elements.get(id);
}

const pageEvents = new Map();
const winEvents = new Map();
const document = {
  hidden: false,
  fullscreenElement: null,
  fullscreenEnabled: true,
  documentElement: { lang: 'tr' },
  getElementById: element,
  addEventListener(type, handler) { pageEvents.set(type, handler); },
  exitFullscreen() {},
};
const window = {
  innerWidth: 390,
  innerHeight: 720,
  devicePixelRatio: 2,
  addEventListener(type, handler) { winEvents.set(type, handler); },
};
const records = new Map();
const storage = {
  getItem: key => records.get(key) ?? null,
  setItem: (key, value) => records.set(key, value),
};

const source = match[1] + '\nwindow.__test = { loop, frame:()=>game.frame, energy:v=>game.energy=v, player:()=>game.player }';
new Function('window', 'document', 'localStorage', 'requestAnimationFrame', 'Math', 'performance', source)(
  window, document, storage, () => 1, Math, { now: () => 1000 }
);

const state = () => JSON.parse(window.render_game_to_text());

// 1. Menu & High-DPI check
assert.equal(state().mode, 'menu');
assert.equal(element('gameCanvas').width, 800, 'High-DPI backing width should scale with devicePixelRatio');
assert.equal(element('gameCanvas').height, 1280, 'High-DPI backing height should scale with devicePixelRatio');

// 2. Language switcher check
element('langEnBtn').click();
assert.equal(records.get('upjump-lang'), 'en');
assert.equal(state().lang, 'en');
element('langTrBtn').click();
assert.equal(records.get('upjump-lang'), 'tr');

// 3. Play, mobile controls, and Nova Dash check
element('playBtn').click();
assert.equal(state().mode, 'playing');
assert.equal(element('mobileMoveControls').hidden, false);
assert.equal(element('novaBtn').disabled, true);
window.__test.energy(100);
window.advanceTime(17);
assert.equal(element('novaBtn').disabled, false);
listeners.get('novaBtn:pointerdown')({ preventDefault() {}, stopPropagation() {} });
window.advanceTime(17);
assert.ok(state().player.boost > 0, 'Nova Dash not activated');

// 4. WASD movement check
pageEvents.get('keydown')({ key: 'd', repeat: false, preventDefault() {} });
window.advanceTime(50);
assert.ok(state().player.vx > 0, 'D key steering should move player right');
pageEvents.get('keyup')({ key: 'd' });

// 5. Sound mute persistence check
element('soundBtn').click();
assert.equal(records.get('upjump-sound'), '0');

// 6. Pause & return to menu check
element('pauseBtn').click();
assert.equal(state().mode, 'paused');
assert.equal(element('overlayMenuBtn').hidden, false);
element('overlayMenuBtn').click();
assert.equal(state().mode, 'menu');

// 7. Visibility auto-pause & Escape resume
window.startGame();
document.hidden = true;
pageEvents.get('visibilitychange')();
assert.equal(state().mode, 'paused');
document.hidden = false;
pageEvents.get('keydown')({ key: isPortalBuild ? 'p' : 'Escape', repeat: false, preventDefault() {} });
assert.equal(state().mode, 'playing');

// 8. Portal SDK ad-break pause/resume bridge
assert.ok(window.UpJumpPortal, 'Missing UpJumpPortal SDK bridge');
window.UpJumpPortal.pauseForAd();
assert.equal(state().mode, 'paused', 'pauseForAd should pause active gameplay');
window.UpJumpPortal.resumeAfterAd();
assert.equal(state().mode, 'playing', 'resumeAfterAd should resume gameplay paused by ad');

// 9. Low-FPS fixed-timestep simulation check
window.startGame();
window.__test.loop(100);
const ticks = window.__test.frame();
window.__test.loop(167);
assert.ok(window.__test.frame() - ticks >= 3, 'Low-FPS fixed timestep regressed');

console.info('UpJump smoke test: portal compliance, DPR, i18n, WASD, Nova, audio, pause, ad hooks, and fixed-step physics passed');

// Fresh players fill Nova with actual pickups and clear the practice drone.
window.startGame();
assert.equal(state().hud.coaching, true);
assert.equal(element('missionWrap').hidden, true);
pageEvents.get('keydown')({ key: 'ArrowRight', repeat: false, preventDefault() {} });
window.advanceTime(100);
pageEvents.get('keyup')({ key: 'ArrowRight' });
for (let i = 0; i < 100 && state().hud.energy < 100; i++) window.advanceTime(17);
assert.equal(state().hud.energy, 100, 'The opening star route must charge Nova');
assert.ok(state().hazards.length, 'A practice drone should appear once Nova is ready');
pageEvents.get('keydown')({ key: ' ', code: 'Space', repeat: false, preventDefault() {} });
window.advanceTime(200);
assert.equal(state().hud.dronesSmashed, 1);
assert.equal(state().hud.coaching, false);
assert.equal(element('missionWrap').hidden, false);
assert.equal(records.get('upjump-coach-v1'), '1');
for (let i = 0; i < 3; i++) {
  window.startGame();
  const initialBest = state().hud.best;
  assert.equal(state().hud.coaching, false);
  assert.equal(state().hud.energy, 0);
  assert.equal(state().hud.combo, 0);
  window.__test.player().y = 900;
  window.__test.player().vy = 1;
  window.advanceTime(17);
  assert.equal(state().mode, 'game_over');
  assert.ok(state().hud.best >= initialBest);
  assert.ok(/m kaldı/.test(element('overlayLead').textContent));
  element('playBtn').click();
  assert.equal(state().mode, 'playing');
}
records.delete('upjump-coach-v1');
window.startGame();
element('skipCoach').click();
assert.equal(state().hud.coaching, false);
assert.equal(records.get('upjump-coach-v1'), '1');

console.info('UpJump first-run pickup route, drone collision, skip persistence, and three replays passed');

// Portal frame dimensions and touch controller state.
window.innerWidth = 907;
window.innerHeight = 510;
window.devicePixelRatio = 1;
winEvents.get('resize')();
assert.equal(element('gameWrapper').style.height, '490px');
assert.equal(element('gameCanvas').width, 400);
window.innerWidth = 320;
window.innerHeight = 568;
winEvents.get('resize')();
assert.equal(element('gameWrapper').style.width, '320px');
const press = { pointerId: 1, preventDefault() {}, stopPropagation() {} };
listeners.get('mobileLeftBtn:pointerdown')(press);
window.advanceTime(100);
assert.ok(state().player.vx < 0);
listeners.get('mobileLeftBtn:lostpointercapture')(press);
window.advanceTime(300);
assert.ok(Math.abs(state().player.vx) < 0.1);
console.info('UpJump 907 × 510 / DPR 1, 320px portrait fit, and touch release passed');
