import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'Missing inline game script');
for (const id of ['gameCanvas','novaBtn','mobileLeftBtn','mobileRightBtn','soundBtn','overlayMenuBtn','pauseBtn']) {
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
  set(obj, name, value) { obj[name] = value; return true; }
});
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    style: {}, classList: { toggle() {}, add() {}, remove() {} },
    textContent: '', innerHTML: '', hidden: false, disabled: false, attrs: {},
    width: id === 'gameCanvas' ? 400 : 0,
    height: id === 'gameCanvas' ? 640 : 0,
    setAttribute(k,v) { this.attrs[k]=v; },
    addEventListener(type, handler) { listeners.set(id+':'+type, handler); },
    getContext() { return context; },
    getBoundingClientRect() { return {left:0,top:0,width:400,height:640}; },
    setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture() {return true;},
    requestFullscreen() {},
    click() { listeners.get(id+':click')?.({preventDefault(){},stopPropagation(){}}); }
  });
  return elements.get(id);
}
const pageEvents = new Map();
const winEvents = new Map();
const document = {
  hidden:false, fullscreenElement:null, getElementById:element,
  addEventListener(type,handler){pageEvents.set(type,handler);},
  exitFullscreen(){}
};
const window = {
  innerWidth:390, innerHeight:720,
  addEventListener(type,handler){winEvents.set(type,handler);}
};
const records = new Map();
const storage = {
  getItem:key=>records.get(key)??null,
  setItem:(key,value)=>records.set(key,value)
};
const source=match[1]+'\nwindow.__test = { loop, frame:()=>game.frame, energy:v=>game.energy=v }';
new Function('window','document','localStorage','requestAnimationFrame','Math','performance',
  source)(window,document,storage,()=>1,Math,{now:()=>1000});
const state = () => JSON.parse(window.render_game_to_text());
assert.equal(state().mode,'menu');
element('playBtn').click();
assert.equal(state().mode,'playing');
assert.equal(element('mobileMoveControls').hidden,false);
assert.equal(element('novaBtn').disabled,true);
window.__test.energy(100);
window.advanceTime(17);
assert.equal(element('novaBtn').disabled,false);
listeners.get('novaBtn:pointerdown')({preventDefault(){},stopPropagation(){}});
window.advanceTime(17);
assert.ok(state().player.boost>0,'Nova Dash not activated');
element('soundBtn').click();
assert.equal(records.get('upjump-sound'),'0');
element('pauseBtn').click();
assert.equal(state().mode,'paused');
assert.equal(element('overlayMenuBtn').hidden,false);
element('overlayMenuBtn').click();
assert.equal(state().mode,'menu');
window.startGame();
document.hidden=true;
pageEvents.get('visibilitychange')();
assert.equal(state().mode,'paused');
document.hidden=false;
pageEvents.get('keydown')({key:'Escape',repeat:false,preventDefault(){}});
assert.equal(state().mode,'playing');
window.startGame();
window.__test.loop(100);
const ticks=window.__test.frame();
window.__test.loop(167);
assert.ok(window.__test.frame()-ticks>=3,'Low-FPS fixed timestep regressed');
console.info('UpJump smoke test: menu, mobile Nova, mute, pause, background and physics passed');
