import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');

// Portal compliance checks
assert.ok(!/X-Frame-Options:\s*(DENY|SAMEORIGIN)/i.test(headers), 'public/_headers must allow portal iframe embedding');
assert.ok(!/fonts\.googleapis\.com/i.test(html), 'External Google Fonts CDN should not block offline/portal ZIP packaging');

const artKeys=JSON.parse(html.match(/const ASSET_KEYS=(\[[^;]+\]);/)[1]);
for(const key of artKeys){const bytes=readFileSync(new URL('../public/assets/kenney/'+key+'.png',import.meta.url));assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a','PNG signature '+key);}
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'Missing inline game script');
for (const id of ['gameCanvas', 'novaBtn', 'mobileLeftBtn', 'mobileRightBtn', 'soundBtn', 'overlayMenuBtn', 'pauseBtn', 'langEnBtn', 'langTrBtn', 'fullscreenBtn']) {
  assert.ok(html.includes('id="' + id + '"'), 'Missing element: ' + id);
}

const listeners = new Map();
const elements = new Map();
let spriteDraws=0;
const context = new Proxy({}, {
  get(obj, name) {
    if(name==='drawImage')return ()=>{spriteDraws++};
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
  Image:class{constructor(){this.complete=true;this.naturalWidth=128;this.naturalHeight=128;}},
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

const source = match[1] + '\nwindow.__test = { loop, frame:()=>game.frame, energy:v=>game.energy=v, player:()=>game.player, game:()=>game, biome:getBiomeState, records:()=>({bestScore,bestAlt}), fit, setAlt:v=>{game.dist=v;totalScore(game)}, target:nextTarget, rescue:()=>rescueExpedition(game), win:()=>winExpedition(game) }';
new Function('window', 'document', 'localStorage', 'requestAnimationFrame', 'Math', 'performance', source)(
  window, document, storage, () => 1, Math, { now: () => 1000 }
);

const state = () => JSON.parse(window.render_game_to_text());

// 1. Menu & High-DPI check
assert.equal(state().mode, 'menu');
assert.equal(state().art.ready,29);
assert.ok(spriteDraws>0,'PNG render path must draw assets');
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

// Nova Ascension regression suite
assert.equal(window.__test.biome(1400).idx,4,'Deep Nova must be reachable');
assert.equal(window.__test.target(0),80);
assert.equal(window.__test.target(1400),1500);
window.startGame();
window.advanceTime(1000);
assert.ok(state().progression.stars>=1,'Starter route should collect a star without movement');
const g=window.__test.game();
const pad=g.platforms.find(p=>p.type==='normal'&&!p.broken&&p.y<400);
g.stars=[];g.drones=[];g.hitStop=0;g.highestBounce=640;
const bounce=()=>{g.player.x=pad.x+pad.w/2-g.player.w/2;g.player.y=pad.y-g.player.h-1;g.player.vx=0;g.player.vy=2;window.advanceTime(17);};
bounce();
const energy=g.energy, bonus=g.bonus;
bounce();
assert.equal(g.energy,energy,'Repeat bounce must not farm energy');
assert.equal(g.bonus,bonus,'Repeat bounce must not farm points');
window.__test.setAlt(220);
element('pauseBtn').click();element('overlayMenuBtn').click();
assert.equal(state().progression.unlocked,3);
element('suitBtn').click();
assert.equal(state().progression.suit,1);
assert.equal(records.get('upjump-suit'),'1');
window.innerWidth=907;window.innerHeight=510;window.__test.fit();
assert.ok(parseInt(element('gameWrapper').style.height)<=510);
// Sky Frontiers modes and rescue regression checks
element('expeditionBtn').click();window.startGame();
assert.equal(state().course.mode,'expedition');
assert.equal(window.__test.rescue(),false);
window.__test.game().checkpoint=80;
assert.equal(window.__test.rescue(),true);
assert.equal(window.__test.rescue(),false);
assert.equal(state().course.rescued,true);
window.__test.setAlt(220);window.advanceTime(17);
assert.equal(state().course.won,true);
assert.equal(state().mode,'game_over');
assert.equal(records.get('upjump-expedition-wins'),'1');
window.__test.win();assert.equal(records.get('upjump-expedition-wins'),'1');
element('overlayMenuBtn').click();element('endlessBtn').click();window.startGame();
window.__test.setAlt(220);window.advanceTime(17);
assert.equal(state().mode,'playing');assert.equal(state().course.mode,'endless');
assert.ok(window.__test.game().platforms.some(p=>p.risk),'Risk route must be generated');
// Campaign progression and deterministic first route
element('overlayMenuBtn').click();element('expeditionBtn').click();element('stageNext').click();window.startGame();
assert.equal(state().course.stage,1);assert.equal(state().course.goal,250);
const route=JSON.stringify(window.__test.game().platforms.map(p=>[p.x,p.y,p.type]));
window.startGame();assert.equal(JSON.stringify(window.__test.game().platforms.map(p=>[p.x,p.y,p.type])),route,'Campaign route must be replayable');
window.__test.game().starsCollected=100;window.__test.game().perfectLandings=100;
window.__test.setAlt(250);window.advanceTime(17);
assert.equal(state().course.medal,3);assert.equal(state().course.unlocked,2);
assert.equal(JSON.parse(records.get('upjump-campaign-medals'))[1],3);
element('playBtn').click();assert.equal(state().course.stage,2);assert.equal(state().course.goal,280);
console.info('UpJump smoke test: portal compliance, DPR, i18n, WASD, Nova, audio, pause, ad hooks, and fixed-step physics passed');
