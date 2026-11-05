import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('version is the same everywhere', () => {
  const v = /APP_VERSION = '([^']+)'/.exec(read('js/version.js'))[1];
  assert.equal(JSON.parse(read('package.json')).version, v);
  assert.match(read('sw.js'), new RegExp(`const VERSION = '${v.replace(/\./g, '\\.')}'`));
  assert.match(read('CHANGELOG.md'), new RegExp(`## ${v.replace(/\./g, '\\.')}`));
});

test('every file the service worker caches exists, and every app module is cached', () => {
  const list = [...read('sw.js').matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]).filter((p) => p !== './');
  for (const p of list) assert.ok(existsSync(new URL(`../${p}`, import.meta.url)), `${p} is missing`);
  for (const m of ['js/app.js', 'js/state.js', 'js/calc.js', 'js/random.js', 'js/version.js', 'css/app.css']) assert.ok(list.includes(m), `${m} is not cached`);
});

test('manifest is installable', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some((i) => i.sizes === '192x192'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(existsSync(new URL(`../${i.src}`, import.meta.url)));
});

test('custom domain', () => {
  assert.equal(read('CNAME').trim(), 'pwcounter.dalek.coffee');
});

test('overlays sit inside the stage (so they turn with it) and no native dialog is used', () => {
  const html = read('index.html');
  const stageEnd = html.lastIndexOf('</div>\n  <noscript>');
  for (const id of ['ov-calc', 'ov-dice', 'ov-set', 'ov-confirm']) {
    const at = html.indexOf(`id="${id}"`);
    assert.ok(at > html.indexOf('id="stage"') && at < stageEnd, id);
  }
  assert.doesNotMatch(html, /<dialog[\s>]/);
});
