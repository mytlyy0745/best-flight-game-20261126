export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;
  let throttle = 0.7;
  let dropQueued = false;

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    keys.add(k);
    if (k === ' ' || k === 'Enter') actions |= ACTION_CONFIRM;
    if (k === 'p' || k === 'Escape') actions |= ACTION_PAUSE;
    if (k === 'm') actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function read(dt) {
    let pitch = 0;
    let roll = 0;
    if (keys.has('ArrowUp') || keys.has('w')) pitch += 1;
    if (keys.has('ArrowDown') || keys.has('s')) pitch -= 1;
    if (keys.has('ArrowLeft') || keys.has('a')) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) roll += 1;
    if (keys.has('Shift')) throttle = clamp(throttle + dt * 0.5, 0, 1);
    if (keys.has('Control') || keys.has('c')) throttle = clamp(throttle - dt * 0.5, 0, 1);
    if (keys.has('b') || keys.has('x')) throttle = Math.max(0.15, throttle - dt * 2.5);

    if (mouseDown) {
      const rect = canvas.getBoundingClientRect();
      const nx = (mouseX - rect.left) / rect.width - 0.5;
      const ny = (mouseY - rect.top) / rect.height - 0.5;
      roll = clamp(nx * 3, -1, 1);
      pitch = clamp(-ny * 3, -1, 1);
    }

    if (keys.has(' ')) {
      dropQueued = true;
      keys.delete(' ');
    }
    const drop = dropQueued;
    dropQueued = false;
    return { pitch: clamp(pitch, -1, 1), roll: clamp(roll, -1, 1), throttle, drop };
  }

  function takeActions() {
    const a = actions;
    actions = 0;
    return a;
  }

  return { read, takeActions };
}
