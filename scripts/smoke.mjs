import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');

// Portal compliance checks
assert.ok(!/X-Frame-Options:\s*(DENY|SAMEORIGIN)/i.test(headers), 'public/_headers must allow portal iframe embedding');
assert.ok(!/fonts\.googleapis\.com/i.test(html), 'External Google Fonts CDN should not block offline/portal ZIP packaging');

const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'Missing inline game script');
for (const id of ['gameCanvas', 'novaBtn', 'mobileLeftBtn', 'mobileRightBtn', 'soundBtn', 'overlayMenuBtn', 'pauseBtn', 'langEnBtn', 'langTrBtn', 'fullscreenBtn']) {
  assert.ok(html.includes('id="' + id + '"'), 'Missing element: ' + id);
}

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
pageEvents.get('keydown')({ key: 'Escape', repeat: false, preventDefault() {} });
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
