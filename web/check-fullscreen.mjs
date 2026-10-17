import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('./src/fullscreen.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { fullscreenResolution, matchFullscreenDisplay, FullscreenViewer } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

assert.deepEqual(fullscreenResolution(1920, 1080, 1), { width: 1920, height: 1080 });
assert.deepEqual(fullscreenResolution(2560, 1440, 1.5), { width: 3840, height: 2160 });
assert.deepEqual(fullscreenResolution(5120, 1440, 1), { width: 3840, height: 1080 });
assert.deepEqual(fullscreenResolution(393, 852, 3), { width: 1180, height: 2556 });
assert.deepEqual(fullscreenResolution(320, 480, 1), { width: 480, height: 720 });
assert.throws(() => fullscreenResolution(0, 1080, 1));

const current = { width: 1280, height: 720, fps: 30, uiScale: 85, hevc: true };
const requests = [];
const request = async (url, options) => {
  requests.push({ url, options });
  return new Response(JSON.stringify(options.method === 'POST' ? { ok: true } : current));
};
assert.equal(await matchFullscreenDisplay({ width: 1920, height: 1080 }, 'a b', new AbortController().signal, request), true);
assert.equal(requests[1].url, '/api/display?token=a%20b');
assert.deepEqual(JSON.parse(requests[1].options.body), { width: 1920, height: 1080, fps: 30, uiScale: 85, hevc: true });
requests.length = 0;
assert.equal(await matchFullscreenDisplay(current, '', new AbortController().signal, request), false);
assert.equal(requests.length, 1, 'Already matching dimensions must not reconnect CarPlay');

function element() {
  const target = new EventTarget();
  const classes = new Set();
  return Object.assign(target, {
    hidden: true, disabled: false, focused: false,
    classList: {
      add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); return enabled; },
    },
    setAttribute() {}, focus() { this.focused = true; },
  });
}

function fixture(apply, denied = false) {
  const doc = new EventTarget();
  const win = new EventTarget();
  const app = element(), button = element(), exitButton = element(), focusExit = element();
  let nextTimer = 0;
  const timers = new Map();
  const order = [], notifications = [];
  Object.assign(win, {
    innerWidth: 800, innerHeight: 600, devicePixelRatio: 1.5,
    requestAnimationFrame: callback => queueMicrotask(callback),
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
  });
  Object.assign(doc, {
    fullscreenElement: null,
    getElementById: () => focusExit,
    async exitFullscreen() { this.fullscreenElement = null; this.dispatchEvent(new Event('fullscreenchange')); },
  });
  app.requestFullscreen = async () => {
    order.push('fullscreen');
    if (denied) throw new Error('Fullscreen denied');
    win.innerWidth = 2560; win.innerHeight = 1440;
    doc.fullscreenElement = app;
    doc.dispatchEvent(new Event('fullscreenchange'));
  };
  globalThis.window = win;
  globalThis.document = doc;
  const viewer = new FullscreenViewer(app, button, exitButton, async (size, signal) => {
    order.push('resolution');
    return apply(size, signal);
  }, message => notifications.push(message), () => {});
  return { viewer, doc, app, button, exitButton, focusExit, order, notifications, timers };
}

const normal = fixture(async size => {
  assert.deepEqual(size, { width: 3840, height: 2160 }, 'Measure after native fullscreen, not the old window size');
  return true;
});
normal.app.classList.add('focus-mode');
await normal.viewer.enter();
assert.deepEqual(normal.order, ['fullscreen', 'resolution']);
assert.equal(normal.app.classList.contains('immersive-mode'), true);
assert.equal(normal.exitButton.hidden, false);
await normal.doc.exitFullscreen(); // Simulate browser Esc / native exit rather than our button.
assert.equal(normal.app.classList.contains('immersive-mode'), false);
assert.equal(normal.app.classList.contains('focus-mode'), true, 'Restore the original Focus layout');
assert.equal(normal.exitButton.hidden, true);
assert.equal(normal.focusExit.focused, true);

const denied = fixture(() => assert.fail('Denied fullscreen must not change global display settings'), true);
await denied.viewer.enter();
assert.equal(denied.app.classList.contains('immersive-mode'), false);
assert.equal(denied.button.disabled, false);
assert.equal(denied.notifications.length, 1);

let release, started;
const didStart = new Promise(resolve => { started = resolve; });
let posts = 0;
const delayed = fixture((size, signal) => matchFullscreenDisplay(size, '', signal, async (_url, options) => {
  if (options.method === 'POST') { posts++; return new Response('{"ok":true}'); }
  started();
  return new Promise(resolve => { release = () => resolve(new Response(JSON.stringify(current))); });
}));
const entering = delayed.viewer.enter();
await didStart;
await delayed.viewer.exit();
release();
await entering;
assert.equal(posts, 0, 'Exiting during display discovery must cancel the pending resolution change');
assert.equal(delayed.notifications.length, 0);
console.log('Fullscreen check passed: physical pixels, bounds/aspect, preserved settings, native exit, denial and cancellation.');
