// Write to the DOM only when the value really changes. Re-writing the same text or attribute still makes the
// browser restyle and lay out again, which is what made every tap cost a full board update on slow devices.
export function setText(el, v) { const s = v == null ? '' : String(v); if (el.textContent !== s) el.textContent = s; }
export function setHidden(el, v) { const b = !!v; if (el.hidden !== b) el.hidden = b; }
export function setProp(el, k, v) { if (el[k] !== v) el[k] = v; }
export function setData(el, k, v) { const s = String(v); if (el.dataset[k] !== s) el.dataset[k] = s; }
export function setAttr(el, k, v) { const s = String(v); if (el.getAttribute(k) !== s) el.setAttribute(k, s); }
