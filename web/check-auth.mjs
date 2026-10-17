import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('./src/auth.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { canOpenViewer } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const response = (body) => async (url, options) => {
  assert.equal(url, '/api/auth');
  assert.equal(options.cache, 'no-store');
  return new Response(JSON.stringify(body));
};
assert.equal(await canOpenViewer('', response({ required: false })), true);
for (const value of [{ required: true }, {}, null, { required: 'false' }, { required: 0 }]) {
  assert.equal(await canOpenViewer('', response(value)), false, 'Only explicit false enables token-free viewing');
}
assert.equal(await canOpenViewer('provided-token', () => assert.fail('Token-bearing viewers rely on server verification')), true);
await assert.rejects(canOpenViewer('', async () => new Response('', { status: 503 })));
console.log('Viewer access check passed: explicit open mode, protected defaults and metadata failure.');
