// A QR code as an inline SVG string (pure). Dark modules on a white square with a 4-module quiet zone, so phone cameras read it.
import qrcodegen from './vendor/qrcodegen.js';

export const QUIET = 4;

/** `text` -> '<svg ...>' (our own string: only numbers and fixed markup go in). */
export function qrSvg(text, { dark = '#0b1020', light = '#ffffff' } = {}) {
  const qr = qrcodegen.QrCode.encodeText(String(text), qrcodegen.QrCode.Ecc.MEDIUM);
  const n = qr.size + QUIET * 2;
  let d = '';
  for (let y = 0; y < qr.size; y++) {
    let x = 0;
    while (x < qr.size) {
      if (!qr.getModule(x, y)) { x++; continue; }
      let w = 1;
      while (x + w < qr.size && qr.getModule(x + w, y)) w++;
      d += `M${x + QUIET},${y + QUIET}h${w}v1h-${w}z`;
      x += w;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code with the room link"><rect width="${n}" height="${n}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
