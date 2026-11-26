// Sky Courier — boot and the one loop: input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. Screens: title, mission brief, play, paused, mission failed,
// mission complete, win.
//
// ?seed=N fixes the course. ?shot=start|play|drop|land (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_RING, EVENT_ZONE, EVENT_LANDED, EVENT_MISSION_DONE, EVENT_DROP } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_BRIEF, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_FAIL, SCREEN_MISSION_DONE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts one visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let failedMission = 1;

  function announce(message) {
    status.textContent = message;
  }

  function startMission(mission) {
    screen = SCREEN_BRIEF;
    announce(`Mission ${mission}: ${MISSIONS[mission - 1].name}. Press Space to launch.`);
  }

  function launch() {
    screen = SCREEN_PLAY;
    accumulator = 0;
    announce(`Mission ${world.state.mission} — ${MISSIONS[world.state.mission - 1].goal}.`);
  }

  function endGame(win) {
    if (win) {
      screen = SCREEN_WIN;
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(`All missions complete. Final score ${world.state.score}.`);
    } else {
      screen = SCREEN_FAIL;
      announce(`Down. ${world.state.crashReason}`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) {
        world.reset();
        startMission(1);
      }
      else if (screen === SCREEN_BRIEF) launch();
      else if (screen === SCREEN_FAIL) {
        world.retryMission(failedMission);
        startMission(failedMission);
      } else if (screen === SCREEN_MISSION_DONE) startMission(world.state.mission);
      else if (screen === SCREEN_WIN) {
        world.reset();
        startMission(1);
      } else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    const events = world.step(STEP, input.read(STEP), false);
    audio.engine(world.state.throttle, screen === SCREEN_PLAY);
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_ZONE) audio.zone();
    if (events & EVENT_DROP) audio.drop();
    if (events & EVENT_LANDED) {
      audio.land();
      endGame(true);
    } else if (world.state.over) {
      audio.crash();
      failedMission = world.state.mission;
      endGame(false);
    } else if (events & EVENT_MISSION_DONE) {
      screen = SCREEN_MISSION_DONE;
      announce(`Mission ${world.state.mission - 1} complete. Score ${world.state.score}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, true);
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, world, screen, best);
  }

  // Leaving the tab pauses a running game rather than flying unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  canvas.addEventListener('mousedown', () => {
    audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_WIN) {
      world.reset();
      startMission(1);
    } else if (screen === SCREEN_BRIEF) launch();
  });

  announce('Sky Courier. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
