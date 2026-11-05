import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setText, setHidden, setData, setAttr, setProp } from '../js/dom-write.js';

// a stand-in element that counts writes
function fake() {
  const el = { writes: 0, _t: '', _h: false, dataset: {}, attrs: {}, disabled: false };
  Object.defineProperty(el, 'textContent', { get() { return this._t; }, set(v) { this.writes++; this._t = v; } });
  Object.defineProperty(el, 'hidden', { get() { return this._h; }, set(v) { this.writes++; this._h = v; } });
  el.getAttribute = (k) => (k in el.attrs ? el.attrs[k] : null);
  el.setAttribute = (k, v) => { el.writes++; el.attrs[k] = v; };
  return el;
}
test('a value that did not change is not written again', () => {
  const el = fake();
  setText(el, 5); setText(el, 5); setText(el, '5');
  setHidden(el, true); setHidden(el, 1);
  setAttr(el, 'aria-label', 'x'); setAttr(el, 'aria-label', 'x');
  assert.equal(el.writes, 3);
  setData(el, 'len', 2); setData(el, 'len', '2'); assert.equal(el.dataset.len, '2');
  setProp(el, 'disabled', true); setProp(el, 'disabled', true); assert.equal(el.disabled, true);
});
test('null text is empty, not the word null', () => {
  const el = fake(); setText(el, 'a'); setText(el, null); assert.equal(el.textContent, '');
});
