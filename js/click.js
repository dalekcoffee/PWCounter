// 0.4.9: an audible click on every counter change, so the other player hears each add and each take-away.
// Web Audio, made on the first tap (browsers only allow sound after a user gesture). Up and down have different pitches.

export const CLICK_MS = 60; // long enough to hear clearly across a table, short enough for hold-to-repeat (one step every 110 ms)
export const CLICK_UP_HZ = 1500;
export const CLICK_DOWN_HZ = 950;
export const CLICK_SAME_HZ = 1200;

/** The pitch for a change: higher for an add, lower for a take-away. */
export function clickPitch(d) {
  return d > 0 ? CLICK_UP_HZ : d < 0 ? CLICK_DOWN_HZ : CLICK_SAME_HZ;
}

let ctx = null, noise = null, on = true;

export function setClicks(v) { on = v !== false; }

/** Called from every tap (capture phase): make / wake the audio so the next click can sound. */
export function unlockClicks() {
  if (!on) return;
  try {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      // short sounds that mix with the player's music instead of pausing it (where the browser supports it)
      try { if (navigator.audioSession) navigator.audioSession.type = 'transient'; } catch { /* not supported */ }
      ctx = new AC({ latencyHint: 'interactive' });
      noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.008), ctx.sampleRate);
      const ch = noise.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  } catch { /* no sound on this device */ }
}

/** One click: a short snap of noise and a falling tone, CLICK_MS long. d > 0 add, d < 0 take away. */
export function click(d = 0) {
  if (!on || !ctx) return;
  try {
    if (ctx.state !== 'running') { ctx.resume().catch(() => {}); return; }
    const t = ctx.currentTime + 0.003, dur = CLICK_MS / 1000, f = clickPitch(d);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.7, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
    const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noise;
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    ng.gain.value = 0.3;
    n.connect(hp).connect(ng).connect(ctx.destination);
    n.start(t);
  } catch { /* no sound on this device */ }
}
