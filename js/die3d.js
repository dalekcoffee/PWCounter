// A real 3D die: ONE rounded box (a cube with bevelled edges and corners, one continuous mesh with smooth
// normals, so there is no seam between the faces), pips drawn by the shader on the surface. WebGL 1, no libraries.
// The math at the top is pure (tested); createDice() needs a DOM and returns null when WebGL is missing.

export const BEVEL = 0.24; // radius of the rounded edges, in half-sizes (the die spans -1..1)

// Which face shows which number: opposite faces add up to 7.
export const FACE_AXIS = { 1: [0, 0, 1], 6: [0, 0, -1], 2: [0, 1, 0], 5: [0, -1, 0], 3: [1, 0, 0], 4: [-1, 0, 0] };
// Pips as cells of a 3x3 grid (1 = top left ... 9 = bottom right), as on the 2D dice.
export const PIP_CELLS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

// ---- quaternions [x, y, z, w] ----
export const qAxis = (ax, a) => { const l = Math.hypot(...ax) || 1, s = Math.sin(a / 2); return [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, Math.cos(a / 2)]; };
export const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
// column-major 3x3 rotation matrix
export function qMat(q) {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
  ];
}
export const rotate = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];

// The turn that brings face n toward the viewer (+z).
export function faceQ(n) {
  switch (n) {
    case 1: return [0, 0, 0, 1];
    case 6: return qAxis([0, 1, 0], Math.PI);
    case 2: return qAxis([1, 0, 0], Math.PI / 2);
    case 5: return qAxis([1, 0, 0], -Math.PI / 2);
    case 3: return qAxis([0, 1, 0], -Math.PI / 2);
    case 4: return qAxis([0, 1, 0], Math.PI / 2);
    default: throw new RangeError('face 1..6');
  }
}

// How the die rests: face n toward the viewer, turned by `spin` about the view axis, and tipped a little
// (`tilt` radians) so the bevels of two other faces show: it reads as a solid block, not a flat tile.
export function restQ(n, spin = 0, tilt = [-0.32, 0.26]) {
  return qMul(qMul(qAxis([1, 0, 0], tilt[0]), qAxis([0, 1, 0], tilt[1])), qMul(qAxis([0, 0, 1], spin), faceQ(n)));
}

// The face that points most toward the viewer for a rotation q.
export function topFace(q) {
  const m = qMat(q);
  let best = 0, face = 0;
  for (const n of [1, 2, 3, 4, 5, 6]) { const z = rotate(m, FACE_AXIS[n])[2]; if (z > best) { best = z; face = n; } }
  return face;
}

const easeOut = (t) => 1 - (1 - t) ** 3;
// The tumble: at t = 0 it is `turns` half-turns away about `axis`, at t = 1 exactly at rest.
export function tumbleQ(rest, axis, turns, t) {
  const k = Math.min(1, Math.max(0, t));
  return qMul(rest, qAxis(axis, turns * Math.PI * (1 - easeOut(k))));
}

// One axis of sample points from -1 to 1: dense in the two bevels, sparse on the flat middle.
export function axisSamples(r = BEVEL, steps = 12) {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push(-1 + r * (1 - Math.cos((i / steps) * Math.PI / 2)));
  out.push(-0.33, 0.33);
  for (let i = steps; i >= 0; i--) out.push(1 - r * (1 - Math.cos((i / steps) * Math.PI / 2)));
  return out;
}

// The rounded box: a cube grid whose points are pulled onto a rounded box (inner box + sphere of radius r).
// Returns positions, normals, the cube point (the shader finds the face and the pips from it) and indices.
export function roundedBox(r = BEVEL, steps = 12) {
  const s = axisSamples(r, steps), n = s.length, inner = 1 - r;
  const pos = [], nor = [], cube = [], idx = [];
  const faces = [[0, 1, 2, 1], [0, 1, 2, -1], [1, 2, 0, 1], [1, 2, 0, -1], [2, 0, 1, 1], [2, 0, 1, -1]]; // [u, v, axis, sign]
  for (const [u, v, w, sg] of faces) {
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = [0, 0, 0]; p[u] = s[i]; p[v] = s[j]; p[w] = sg;
      const c = p.map((x) => Math.max(-inner, Math.min(inner, x)));
      const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], l = Math.hypot(...d);
      const nn = d.map((x) => x / l);
      pos.push(c[0] + nn[0] * r, c[1] + nn[1] * r, c[2] + nn[2] * r);
      nor.push(...nn); cube.push(...p);
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
      const a = base + i * n + j, b = a + n;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), cube: new Float32Array(cube), idx: new Uint16Array(idx) };
}

// 6 faces x 9 cells: 1 where a pip is. Face order as in FACE_ORDER (the shader's order).
export const FACE_ORDER = [1, 6, 2, 5, 3, 4];
export function pipTable() {
  const t = [];
  for (const f of FACE_ORDER) for (let c = 1; c <= 9; c++) t.push(PIP_CELLS[f].includes(c) ? 1 : 0);
  return t;
}

// ---------------- WebGL ----------------
const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCube;
uniform mat3 uRot; uniform float uDist; uniform float uFocal;
varying vec3 vNor; varying vec3 vCube; varying vec3 vView;
void main() {
  vec3 p = uRot * aPos;
  vNor = uRot * aNor; vCube = aCube;
  vec3 cam = vec3(0.0, 0.0, uDist);
  vView = normalize(cam - p);
  float z = uDist - p.z;
  gl_Position = vec4(p.xy * uFocal, (z - uDist) * z * 0.25, z);
}`;
const FS = `
precision mediump float;
varying vec3 vNor; varying vec3 vCube; varying vec3 vView;
uniform float uPips[54];
void main() {
  vec3 a = abs(vCube);
  float f; vec2 uv; float sg;
  if (a.z >= a.x && a.z >= a.y) { sg = sign(vCube.z); f = sg > 0.0 ? 0.0 : 1.0; uv = vec2(vCube.x * sg, vCube.y); }
  else if (a.y >= a.x) { sg = sign(vCube.y); f = sg > 0.0 ? 2.0 : 3.0; uv = vec2(vCube.x, -vCube.z * sg); }
  else { sg = sign(vCube.x); f = sg > 0.0 ? 4.0 : 5.0; uv = vec2(-vCube.z * sg, vCube.y); }
  // pips: dark dimples, the 1 a bigger red one
  float pip = 0.0; vec2 off = vec2(0.0);
  float rad = f == 0.0 ? 0.25 : 0.165;
  for (int i = 0; i < 54; i++) {
    float fi = floor(float(i) / 9.0);
    if (fi == f && uPips[i] > 0.5) {
      float c = float(i) - fi * 9.0;
      vec2 ctr = vec2(mod(c, 3.0) - 1.0, 1.0 - floor(c / 3.0)) * 0.5;
      vec2 d = uv - ctr;
      float m = 1.0 - smoothstep(rad - 0.018, rad + 0.006, length(d));
      if (m > pip) { pip = m; off = d / rad; }
    }
  }
  vec3 n = normalize(vNor);
  vec3 L = normalize(vec3(-0.45, 0.65, 0.85));
  vec3 H = normalize(L + normalize(vView));
  float dif = max(dot(n, L), 0.0);
  float hemi = 0.5 + 0.5 * n.y;
  float spec = pow(max(dot(n, H), 0.0), 48.0);
  vec3 ivory = vec3(0.975, 0.945, 0.87);
  vec3 col = ivory * (0.30 + 0.22 * hemi + 0.62 * dif) + vec3(0.06, 0.035, 0.0) * (1.0 - dif);
  col += vec3(1.0) * spec * 0.38;
  // inside a pip: dark (or red), lit from the far side like a hollow
  vec3 ink = f == 0.0 ? vec3(0.78, 0.17, 0.12) : vec3(0.10, 0.11, 0.20);
  float hollow = clamp(0.55 + 0.45 * dot(off, -vec2(L.x, L.y)), 0.0, 1.0);
  vec3 pc = ink * (0.45 + 0.75 * hollow) * (0.55 + 0.5 * dif);
  col = mix(col, pc, pip);
  gl_FragColor = vec4(col, 1.0);
}`;

function program(gl) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

// One die drawn in one canvas. view = how big the canvas is compared with the die (the die spans 2 units).
function dieView(canvas, mesh) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) return null;
  const prog = program(gl);
  gl.useProgram(prog);
  const buf = (data, name, size) => {
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };
  buf(mesh.pos, 'aPos', 3); buf(mesh.nor, 'aNor', 3); buf(mesh.cube, 'aCube', 3);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
  gl.uniform1fv(gl.getUniformLocation(prog, 'uPips'), pipTable());
  const U = (n) => gl.getUniformLocation(prog, n);
  const uRot = U('uRot'), uDist = U('uDist'), uFocal = U('uFocal');
  const DIST = 7, FOCAL = DIST / 1.75; // a long lens (little distortion); the canvas spans +-1.75 die units
  gl.uniform1f(uDist, DIST); gl.uniform1f(uFocal, FOCAL);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.clearColor(0, 0, 0, 0);
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  return {
    get lost() { return lost || gl.isContextLost(); },
    draw(q) {
      if (lost) return;
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix3fv(uRot, false, qMat(q));
      gl.drawElements(gl.TRIANGLES, mesh.idx.length, gl.UNSIGNED_SHORT, 0);
    },
  };
}

// Two dice. roll(n1, n2, ms) tumbles them onto the numbers; show(n1, n2) puts them at rest.
export function createDice(canvases, random = Math.random) {
  let mesh, views;
  try {
    mesh = roundedBox();
    views = canvases.map((c) => dieView(c, mesh));
  } catch { return null; }
  if (views.some((v) => !v)) return null;
  let raf = 0;
  const FLAT = [0, 0]; // at rest the die lies square to the viewer: only the rolled face shows
  const rests = [restQ(1, 0, FLAT), restQ(1, 0, FLAT)];
  const drawAll = (qs) => views.forEach((v, i) => v.draw(qs[i]));
  return {
    get ok() { return !views.some((v) => v.lost); },
    show(n1, n2) {
      cancelAnimationFrame(raf);
      rests[0] = restQ(n1, 0, FLAT); rests[1] = restQ(n2, 0, FLAT);
      drawAll(rests);
    },
    roll(n1, n2, ms, done) {
      cancelAnimationFrame(raf);
      this.show(n1, n2);
      const spins = [0, 1].map(() => {
        const ax = [random() - 0.5, random() - 0.5, random() - 0.5];
        return { ax, turns: 5 + Math.floor(random() * 3) * 2 + random() * 0.5 };
      });
      const t0 = performance.now();
      const frame = (now) => {
        const t = (now - t0) / ms;
        drawAll(rests.map((r, i) => tumbleQ(r, spins[i].ax, spins[i].turns, t)));
        if (t < 1) raf = requestAnimationFrame(frame); else done?.();
      };
      raf = requestAnimationFrame(frame);
    },
  };
}
