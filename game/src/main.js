import { BEST_KEY, STEP, MISSIONS, RING_PRECISION_DIST, SKY_CRATE_COUNT, SCORE_SPEED_RING, SPEED_RING_MIN, SCORE_SURGEON, SCORE_SHARPSHOOTER, SCORE_CLEAN_SWEEP, SCORE_UNTOUCHED } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_RING, EVENT_ZONE, EVENT_LANDED, EVENT_MISSION_DONE, EVENT_DROP, EVENT_BALLOON, EVENT_ON_FIRE, EVENT_NEAR_MISS, EVENT_CRATE, EVENT_BULLSEYE } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { createRenderer, SCREEN_TITLE, SCREEN_BRIEF, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_FAIL, SCREEN_MISSION_DONE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

export function createScorer() {
  let preciseStreak = 0;
  let bullseyeStreak = 0;
  let retried = false;
  let prevPassedRings = 0;
  let prevPassedZones = 0;
  let prevRingsHit = 0;
  let prevZonesHit = 0;
  let prevMission = 1;
  let totalBonus = 0;
  const log = [];

  function countPassed(list) {
    let n = 0;
    for (const o of list) if (o.passed) n += 1;
    return n;
  }

  function award(world, pts, text) {
    totalBonus += pts;
    world.state.score += pts;
    world.state.scoreParts.bonus += pts;
    log.push({ text, pts });
    if (world.state.messageT > 2.35 && world.state.message) {
      world.state.message += ` — ${text}`;
      world.state.messageT = 2.4;
    } else {
      world.state.message = text;
      world.state.messageT = 2.4;
    }
    return text;
  }

  function apply(world, events) {
    const paid = [];
    const s = world.state;
    if (s.mission !== prevMission) {
      preciseStreak = 0;
      bullseyeStreak = 0;
      prevMission = s.mission;
    }
    const passedRings = countPassed(world.course.rings);
    if (passedRings > prevPassedRings && s.ringsHit === prevRingsHit) preciseStreak = 0;
    prevPassedRings = passedRings;
    prevRingsHit = s.ringsHit;
    const passedZones = countPassed(world.course.zones);
    if (passedZones > prevPassedZones && s.zonesHit === prevZonesHit) bullseyeStreak = 0;
    prevPassedZones = passedZones;
    prevZonesHit = s.zonesHit;

    if (events & EVENT_RING) {
      const ring = world.course.rings.find((r) => r.hit && r.hitT === s.time);
      if (ring) {
        const err = Math.hypot(s.x - ring.x, s.alt - ring.alt);
        if (err < RING_PRECISION_DIST) {
          preciseStreak += 1;
          if (preciseStreak >= 2) {
            paid.push(award(world, SCORE_SURGEON * preciseStreak, `SURGEON x${preciseStreak} +${SCORE_SURGEON * preciseStreak}`));
          }
        } else {
          preciseStreak = 0;
        }
        if (s.speed >= SPEED_RING_MIN) {
          paid.push(award(world, SCORE_SPEED_RING, `FULL SEND +${SCORE_SPEED_RING}`));
        }
      }
    }
    if (events & EVENT_BULLSEYE) {
      bullseyeStreak += 1;
      if (bullseyeStreak >= 2) {
        paid.push(award(world, SCORE_SHARPSHOOTER * bullseyeStreak, `SHARPSHOOTER x${bullseyeStreak} +${SCORE_SHARPSHOOTER * bullseyeStreak}`));
      }
    } else if (events & EVENT_ZONE) {
      bullseyeStreak = 0;
    }
    if (events & EVENT_MISSION_DONE && s.mission === 2 && s.cratesCollected >= SKY_CRATE_COUNT) {
      paid.push(award(world, SCORE_CLEAN_SWEEP, `CLEAN SWEEP +${SCORE_CLEAN_SWEEP}`));
    }
    if (events & EVENT_LANDED && !retried && s.damage === 0) {
      paid.push(award(world, SCORE_UNTOUCHED, `UNTOUCHED +${SCORE_UNTOUCHED}`));
    }
    return paid;
  }

  function noteRetry() {
    retried = true;
    preciseStreak = 0;
    bullseyeStreak = 0;
  }

  function reset() {
    preciseStreak = 0;
    bullseyeStreak = 0;
    retried = false;
    prevPassedRings = 0;
    prevPassedZones = 0;
    prevRingsHit = 0;
    prevZonesHit = 0;
    prevMission = 1;
    totalBonus = 0;
    log.length = 0;
  }

  return {
    apply,
    noteRetry,
    reset,
    get totalBonus() { return totalBonus; },
    get log() { return log; },
  };
}

function boot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
  const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

  const canvas = document.getElementById('game');
  const status = document.getElementById('status');
  const world = createWorld(createRandom(seed));
  const fx = createEffects(seed);
  const renderer = createRenderer(canvas, fx);

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
    const scorer = createScorer();
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
          scorer.reset();
          startMission(1);
        }
        else if (screen === SCREEN_BRIEF) launch();
        else if (screen === SCREEN_FAIL) {
          world.retryMission(failedMission);
          scorer.noteRetry();
          startMission(failedMission);
        } else if (screen === SCREEN_MISSION_DONE) startMission(world.state.mission);
        else if (screen === SCREEN_WIN) {
          world.reset();
          scorer.reset();
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
      fx.update(STEP, world.state, events, world);
      const bonuses = scorer.apply(world, events);
      audio.engine(world.state.throttle, screen === SCREEN_PLAY);
      if (events & EVENT_RING) audio.ring(world.state.streak);
      if (events & EVENT_ZONE) audio.zone();
      if (events & EVENT_DROP) audio.drop();
      if (events & EVENT_BALLOON) audio.balloon();
      if (events & EVENT_ON_FIRE) audio.combo();
      if (events & EVENT_NEAR_MISS) audio.nearMiss();
      if (events & EVENT_CRATE) audio.crate();
      if (events & EVENT_BULLSEYE) audio.bullseye();
      if (bonuses.length > 0) audio.combo();
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
        scorer.reset();
        startMission(1);
      } else if (screen === SCREEN_BRIEF) launch();
    });

    announce('Sky Courier. Press Space or click to fly.');
    requestAnimationFrame(frame);
  }

  if (shot) runShot(shot);
  else runGame();
}

if (typeof window !== 'undefined') boot();
