// input.js — keyboard state + discrete action events.
//
// createInput() -> {
//   held: { yawLeft, yawRight, pitchUp, pitchDown, fast },  // booleans, live-updated
//   pollActions(): Array<'absorb'|'tree'|'boulder'|'robot'|'transfer'|'hyperspace'|'uturn'|'mute'|'start'>,
//   destroy(): void   // removes listeners (not required by contract, provided for hygiene)
// }

// View rotation uses WASD (primary) with arrow keys kept as a secondary
// option — both work simultaneously. Absorb has moved to Space / left mouse.
const YAW_LEFT_KEYS = new Set(['KeyA', 'ArrowLeft']);
const YAW_RIGHT_KEYS = new Set(['KeyD', 'ArrowRight']);
const PITCH_UP_KEYS = new Set(['KeyW', 'ArrowUp']);
const PITCH_DOWN_KEYS = new Set(['KeyS', 'ArrowDown']);
const FAST_KEYS = new Set(['ShiftLeft', 'ShiftRight']);

// Action keys map to a single fired-once action per keydown (no auto-repeat).
const ACTION_KEYS = {
  Space: 'absorb',
  KeyT: 'tree',
  KeyB: 'boulder',
  KeyR: 'robot',
  KeyQ: 'transfer',
  KeyH: 'hyperspace',
  KeyE: 'uturn',
  KeyM: 'mute',
  Enter: 'start',
};

const ALL_GAME_KEYS = new Set([
  ...YAW_LEFT_KEYS,
  ...YAW_RIGHT_KEYS,
  ...PITCH_UP_KEYS,
  ...PITCH_DOWN_KEYS,
  ...FAST_KEYS,
  ...Object.keys(ACTION_KEYS),
]);

export function createInput(canvas = null) {
  const held = {
    yawLeft: false,
    yawRight: false,
    pitchUp: false,
    pitchDown: false,
    fast: false,
  };

  // Mouse cursor in canvas pixel coords (512×384) — fine aim within the FOV.
  // Keyboard still rotates the view; the mouse only nudges the crosshair.
  const cursor = { x: 256, y: 192 };
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const w = canvas.width, h = canvas.height;
    cursor.x = Math.max(0, Math.min(w - 1, (e.clientX - rect.left) * (w / rect.width)));
    cursor.y = Math.max(0, Math.min(h - 1, (e.clientY - rect.top) * (h / rect.height)));
  }
  if (canvas) canvas.addEventListener('mousemove', onMouseMove);

  function onMouseDown(e) {
    if (e.button === 0) {
      e.preventDefault();
      actionQueue.push('absorb');
    }
  }
  function onContextMenu(e) {
    e.preventDefault();
  }
  if (canvas) {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);
  }

  let actionQueue = [];
  // Track which action keys are currently down so we don't repeat-fire
  // while the OS sends synthetic repeat keydown events.
  const activeActionKeys = new Set();

  function updateHeld(code, isDown) {
    if (YAW_LEFT_KEYS.has(code)) held.yawLeft = isDown;
    if (YAW_RIGHT_KEYS.has(code)) held.yawRight = isDown;
    if (PITCH_UP_KEYS.has(code)) held.pitchUp = isDown;
    if (PITCH_DOWN_KEYS.has(code)) held.pitchDown = isDown;
    if (FAST_KEYS.has(code)) held.fast = isDown;
  }

  function onKeyDown(e) {
    const code = e.code;

    if (ALL_GAME_KEYS.has(code)) {
      e.preventDefault();
    }

    updateHeld(code, true);

    const action = ACTION_KEYS[code];
    if (action) {
      if (!activeActionKeys.has(code)) {
        activeActionKeys.add(code);
        actionQueue.push(action);
      }
    }
  }

  function onKeyUp(e) {
    const code = e.code;

    if (ALL_GAME_KEYS.has(code)) {
      e.preventDefault();
    }

    updateHeld(code, false);
    activeActionKeys.delete(code);
  }

  function onBlur() {
    // Release everything so keys don't get "stuck" held when focus is lost.
    held.yawLeft = false;
    held.yawRight = false;
    held.pitchUp = false;
    held.pitchDown = false;
    held.fast = false;
    activeActionKeys.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  function pollActions() {
    const drained = actionQueue;
    actionQueue = [];
    return drained;
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    if (canvas) {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
    }
  }

  return { held, cursor, pollActions, destroy };
}
