import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const protocolUri = uri(compile('./src/protocol.ts'));
const { AudioEngine } = await import(uri(compile('./src/audio.ts').replace("'./protocol'", JSON.stringify(protocolUri))));

let context;
class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  starts = [];
  constructor() { context = this; }
  async resume() { this.state = 'running'; }
  createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
  createBuffer(channels, frames, rate) { return { duration: frames / rate, copyToChannel() {} }; }
  createBufferSource() {
    const owner = this;
    return { buffer: null, connect() {}, start(time) { owner.starts.push({ time, duration: this.buffer.duration }); } };
  }
}
globalThis.AudioContext = FakeAudioContext;

const engine = new AudioEngine(message => assert.fail(message));
await engine.unlock();
engine.handleConfig({ kind: 'audio-config', streamType: 102, codec: 3, sampleRate: 48000, channels: 2, name: 'media', description: new Uint8Array() });
// The observed phone sends roughly 400 ms bursts, with intact RTP sequence numbers.
// Neither small jitter nor a later burst may rewind the already scheduled timeline.
const packet = { kind: 'audio-packet', streamType: 102, timestampUs: 0, data: new Uint8Array(1024 * 2 * 2) };
for (const arrival of [0, .43, .85, 1.29, 1.71]) {
  context.currentTime = arrival;
  for (let i = 0; i < 20; i++) engine.handlePacket(packet);
}
assert.equal(context.starts.length, 100);
assert.ok(context.starts[0].time >= .45, 'Music needs enough initial buffering for a 400 ms delivery gap');
for (let i = 1; i < context.starts.length; i++) {
  const previous = context.starts[i - 1];
  assert.ok(Math.abs(context.starts[i].time - previous.time - previous.duration) < 1e-8, 'Music buffers must remain contiguous without overlap or jitter gaps');
}
// A genuine long interruption must recover instead of scheduling buffers in the past.
context.currentTime = 10;
engine.handlePacket(packet);
assert.ok(context.starts.at(-1).time > 10);

const voice = new AudioEngine(message => assert.fail(message));
await voice.unlock();
voice.handleConfig({ kind: 'audio-config', streamType: 100, codec: 3, sampleRate: 48000, channels: 1, name: 'speechrecognition', description: new Uint8Array() });
voice.handlePacket({ ...packet, streamType: 100, data: new Uint8Array(480 * 2) });
assert.ok(context.starts[0].time <= .2, 'Voice must not inherit the music buffer delay');
console.log('Audio scheduling check passed: burst delivery, contiguous timeline, underrun recovery and voice latency.');
