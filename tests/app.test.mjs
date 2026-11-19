import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('version is the same everywhere', () => {
  const v = /APP_VERSION = '([^']+)'/.exec(read('js/version.js'))[1];
  assert.equal(JSON.parse(read('package.json')).version, v);
  assert.match(read('sw.js'), new RegExp(`const VERSION = '${v.replace(/\./g, '\\.')}'`));
  assert.ok(read('index.html').includes(`<meta name="pwc-version" content="${v}">`), 'index.html carries the version (sw.js checks it)');
  assert.ok(read('index.html').includes(`href="css/app.css?v=${v}"`), 'the page asks for this version of the stylesheet');
  assert.ok(read('css/app.css').includes(`--pwc-v: "${v}"`), 'the stylesheet carries the version (index.html checks it)');
  assert.match(read('sw.js'), /const STAMPED = \[[^\]]*'index.html'[^\]]*'js\/version.js'[^\]]*'css\/app.css'/, 'the service worker checks the page, the scripts and the stylesheet');
  assert.match(read('CHANGELOG.md'), new RegExp(`## ${v.replace(/\./g, '\\.')}`));
});

test('every file the service worker caches exists, and every app module is cached', () => {
  const list = [...read('sw.js').matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]).filter((p) => p !== './');
  for (const p of list) assert.ok(existsSync(new URL(`../${p}`, import.meta.url)), `${p} is missing`);
  for (const m of ['js/app.js', 'js/state.js', 'js/calc.js', 'js/random.js', 'js/version.js', 'css/app.css']) assert.ok(list.includes(m), `${m} is not cached`);
});

test('manifest is installable', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'fullscreen');
  assert.deepEqual(m.display_override, ['fullscreen', 'standalone']);
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

test('every module the page preloads is in the offline shell, and the QR encoder loads only when needed', () => {
  const html = read('index.html'), sw = read('sw.js');
  const pre = [...html.matchAll(/rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(pre.length > 10);
  for (const f of pre) assert.ok(sw.includes(`'${f}'`), f);
  assert.ok(!pre.includes('js/qr.js') && !pre.includes('js/vendor/qrcodegen.js'));
  assert.ok(sw.includes("'js/qr.js'") && sw.includes("'js/vendor/qrcodegen.js'")); // still there offline
});

test('every script parses (a syntax error in app.js stops the whole page and no other test would notice)', async () => {
  const { spawnSync } = await import('node:child_process');
  const { readdirSync } = await import('node:fs');
  const dir = new URL('../js/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => new URL(f, dir).pathname);
  assert.ok(files.length > 10);
  for (const f of files) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}: ${r.stderr}`);
  }
});
