import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faceQ, restQ, topFace, tumbleQ, qMat, rotate, FACE_AXIS, roundedBox, BEVEL, pipTable, FACE_ORDER, PIP_CELLS } from '../js/die3d.js';

const close = (a, b, e = 1e-9) => a.every((x, i) => Math.abs(x - b[i]) < e);
test('each face turns toward the viewer', () => {
  for (let n = 1; n <= 6; n++) assert.ok(close(rotate(qMat(faceQ(n)), FACE_AXIS[n]), [0, 0, 1]), `face ${n}`);
});
test('opposite faces add up to 7', () => {
  for (let n = 1; n <= 6; n++) assert.ok(close(FACE_AXIS[n].map((x) => -x), FACE_AXIS[7 - n]));
});
test('a die at rest shows the rolled number on top, whatever the spin', () => {
  for (let n = 1; n <= 6; n++) for (const s of [-0.35, 0, 0.3]) assert.equal(topFace(restQ(n, s)), n);
});
test('the tumble ends exactly at rest and starts elsewhere', () => {
  const r = restQ(4, 0.1);
  assert.ok(close(tumbleQ(r, [1, 2, 3], 7, 1), r, 1e-12));
  assert.ok(!close(tumbleQ(r, [1, 2, 3], 7.3, 0), r, 1e-3));
});
test('the rounded box is one closed surface with unit normals and bevelled corners', () => {
  const m = roundedBox();
  for (let i = 0; i < m.nor.length; i += 3) assert.ok(Math.abs(Math.hypot(m.nor[i], m.nor[i + 1], m.nor[i + 2]) - 1) < 1e-6);
  let max = 0;
  for (let i = 0; i < m.pos.length; i += 3) { assert.ok(Math.max(Math.abs(m.pos[i]), Math.abs(m.pos[i + 1]), Math.abs(m.pos[i + 2])) <= 1 + 1e-6); max = Math.max(max, Math.hypot(m.pos[i], m.pos[i + 1], m.pos[i + 2])); }
  const corner = Math.sqrt(3) * (1 - BEVEL) + BEVEL; // a sharp cube would reach sqrt(3)
  assert.ok(Math.abs(max - corner) < 1e-6);
  assert.ok(m.idx.length % 3 === 0 && Math.max(...m.idx) < m.pos.length / 3 && m.pos.length / 3 < 65536);
});
test('pip table matches the faces', () => {
  const t = pipTable();
  FACE_ORDER.forEach((f, k) => assert.equal(t.slice(k * 9, k * 9 + 9).reduce((a, b) => a + b, 0), f));
  assert.deepEqual(PIP_CELLS[1], [5]);
});
test('a flat die at rest shows only its face, square on', () => {
  for (let n = 1; n <= 6; n++) assert.ok(close(rotate(qMat(restQ(n, 0, [0, 0])), FACE_AXIS[n]), [0, 0, 1], 1e-12));
});
import { pipOn } from '../js/die3d.js';
test("the shader's pip rule draws every face as PIP_CELLS says", () => {
  for (let v = 1; v <= 6; v++) {
    const cells = [];
    for (let c = 1; c <= 9; c++) { const gx = ((c - 1) % 3) - 1, gy = 1 - Math.floor((c - 1) / 3); if (pipOn(v, gx, gy)) cells.push(c); }
    assert.deepEqual(cells, PIP_CELLS[v], `face ${v}`);
  }
});
