// Pure rules of the opponent drawer: open / closed, and what a drag means. No DOM.
export const DRAG_MIN = 10; // px of movement before a touch counts as a drag instead of a tap
export const DRAG_FLIP = 36; // px along the drawer's axis that opens or closes it

export const initialDrawer = () => ({ open: false });
export const toggleDrawer = (d) => ({ open: !d.open });
export const setDrawer = (d, open) => (d.open === open ? d : { open });

/** The finger's movement turned into the STAGE's own y direction (the stage is rotated in landscape). */
export function toStageDy(land, dx, dy) {
  if (land === 'right') return -dx; // stage turned 90° clockwise: its y axis points to screen -x
  if (land === 'left') return dx; // turned 90° counter-clockwise: its y axis points to screen +x
  return dy;
}

/** A finished drag: true / false = open / close, null = it was a tap (or too small), so toggle. */
export function dragResult(wasOpen, stageDy) {
  if (Math.abs(stageDy) < DRAG_MIN) return null;
  if (wasOpen) return stageDy > -DRAG_FLIP; // only a real upward drag closes it
  return stageDy >= DRAG_FLIP; // only a real downward drag opens it
}

/** While dragging: how far the body is open, 0..1, given the body's height. */
export function dragProgress(wasOpen, stageDy, bodyH) {
  if (!(bodyH > 0)) return wasOpen ? 1 : 0;
  const p = (wasOpen ? 1 : 0) + stageDy / bodyH;
  return Math.min(1, Math.max(0, p));
}
