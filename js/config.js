// config.js — central tunable configuration (single source of truth).
//
// Every gameplay/physics/visual number lives in Babs.CONFIG so the whole game
// can be retuned from one place. The bare consts below (CANVAS_WIDTH, ropeLength,
// HOUSE_STYLES, shrinkScale, ...) are DERIVED from CONFIG and kept as globals
// because the rest of the code (and the test suite) reads them by bare name.
// Change a value in CONFIG and it flows everywhere.

window.Babs = window.Babs || {};

Babs.CONFIG = {
  // ---- world / canvas (each lane is its own width x height physics world) ----
  world: {
    width: 550, height: 700, platformY: 620,
    gravityY: 1.2,
    groundInset: 120, groundThickness: 30, groundFriction: 1.0
  },
  // ---- the dropped house ("box") base size (shrink rule still scales it) ----
  box: { width: 137, height: 81 },
  // ---- player-tunable speed multipliers (live, driven by the lobby sliders) ----
  //      drop     = how fast a released house falls (engine gravity + initial kick)
  //      pendulum = crane swing angular speed (visual swing + drop trajectory stay in sync)
  speed: { drop: 2.0, pendulum: 2.0 },
  // ---- frame-rate-independent simulation: advance the sim in fixed real-time slices
  //      so wall-clock game speed is identical on a 60Hz laptop, a 144Hz monitor, and
  //      under heavy 4-lane load. maxStepsPerFrame caps catch-up after a stall/tab-switch.
  timing: { fixedStepMs: 1000 / 60, maxStepsPerFrame: 5, maxFrameMs: 250 },
  // ---- render performance: cap the canvas backing-store resolution. A 3x retina phone
  //      would otherwise fill 9x the pixels every frame; 2x stays crisp at ~half the cost.
  render: { maxDPR: 2 },
  // ---- swinging crane / pendulum + drop kinematics ----
  crane: {
    pivotX: 275,            // CANVAS_WIDTH / 2
    ropeLength: 265,
    hangOffset: 465,        // 200 + 265: crane sits this far above the tower top
    swingBase: 1.75, swingPerDrop: 0.04,   // angular speed grows with progress
    thetaMax: 0.52,
    vxFactor: 0.006, vxClamp: 1.2, dropVelocityY: 1.6,
    windAngleFactor: 0.05, gearSpinFactor: 0.05
  },
  // ---- camera / pivot follow + screen-shake flash ----
  camera: {
    swingTimeStep: 0.013, windLerp: 0.03, pivotLerp: 0.08, cameraLerp: 0.08,
    restAnchor: 470, maxPivotY: 50, flashDecay: 0.04,
    autoScrollSpeed: 0.35   // survival camera creep per fixed step (rise that pushes you off the bottom)
  },
  // ---- houses shrink as you climb: full < 200m, then -10% per 100m (min 40%) ----
  shrink: { fullBelow: 200, stepMeters: 100, stepAmount: 0.1, min: 0.4, metersPerDrop: 10 },
  // ---- when a dropped house is considered "settled" enough to judge ----
  settle: { minFrames: 25, settleSpeed: 0.4, timeoutFrames: 260, offScreenMargin: 120 },
  // ---- placement verdict thresholds (StackEvaluator reads these) ----
  evaluate: {
    perfectFirst: 16, perfectFactor: 0.13,
    maxOffsetFirst: 150, maxOffsetFactor: 0.7,
    missedBelowPlatform: 100, notOnTopFactor: 0.4,
    wobbleThreshold: 35, comboTarget: 3, lockEvery: 5,
    perfectParticles: 16, normalParticles: 8
  },
  // ---- continuous collapse / fell-off-beside-the-tower detection ----
  collapse: {
    belowPlatform: 70, xOutLeft: -100, xOutRight: 100,
    tiltAngle: 0.48, tiltCount: 3,
    besideSpeed: 1.4, besideMargin: 8
  },
  // ---- "new level" wooden scaffold bridge built every lockEvery drops ----
  scaffold: { minWidthFactor: 1.25, widthFactor: 1.15, height: 16, gap: 26, recenterBias: 0.7, edgePad: 8 },
  // ---- sabotage / spell block sizing & friction ----
  hazards: {
    junkScale: 0.68, junkMassMult: 5, zapRespawnMs: 700,
    anvilWMult: 1.3, anvilHMult: 1.15, anvilMass: 3.5,
    iceFriction: 0.02, normalFriction: 0.95, frictionStatic: 1.0, frictionAir: 0.02
  },
  // ---- random global gale ----
  wind: {
    force: 0.00011, forceYOffset: 0.35,
    gustChance: 0.6, gustMin: 0.9, gustRange: 0.7,
    spikeMag: 2.8, calmThreshold: 0.3, labelMult: 9,
    firstDelayMin: 3500, firstDelayRange: 3000,
    cadenceMin: 4500, cadenceRange: 4000, alertMs: 2600
  },
  // ---- game-over bottom-up demolition chain ----
  demolition: { fallFrames: 7, introWait: 18, junkForgetBelow: 400, debrisCount: 16, explosionShards: 28, explosionPuffs: 8 },
  // ---- battle ----
  battle: { leadHouses: 5 },
  // ---- AI aim/think timing ----
  ai: { thinkDelayMs: 1200, tickMs: 100, aimTolerance: 16 },
  // ---- combo spell energy ----
  spell: { startEnergy: 2, anvilCost: 2, defaultCost: 1 },
  // ---- audio ----
  audio: { panicCooldownFrames: 40, bgmVolume: 0.12, sfxVolume: 0.6 },
  // ---- toast banner lifetime (frames) ----
  toast: { frames: 90 },
  // ---- palettes ----
  styles: {
    houses: [
      { wall: '#fef3c7', trim: '#d97706' },
      { wall: '#fde68a', trim: '#b45309' },
      { wall: '#e0f2fe', trim: '#0369a1' },
      { wall: '#dcfce7', trim: '#15803d' },
      { wall: '#fce7f3', trim: '#9d174d' },
      { wall: '#ede9fe', trim: '#6d28d9' },
      { wall: '#ffedd5', trim: '#c2410c' }
    ],
    colorPool: ['#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#10b981', '#f97316']
  }
};

// ---------------------------------------------------------------------------
// Matter aliases & bare globals derived from CONFIG (read everywhere by name).
// ---------------------------------------------------------------------------
const Engine = Matter.Engine, Bodies = Matter.Bodies, Composite = Matter.Composite, Body = Matter.Body;

const CANVAS_WIDTH = Babs.CONFIG.world.width, CANVAS_HEIGHT = Babs.CONFIG.world.height, PLATFORM_Y = Babs.CONFIG.world.platformY;
const DEFAULT_BOX_WIDTH = Babs.CONFIG.box.width, DEFAULT_BOX_HEIGHT = Babs.CONFIG.box.height;
const pivotX = Babs.CONFIG.crane.pivotX;
const ropeLength = Babs.CONFIG.crane.ropeLength;
const HANG_OFFSET = Babs.CONFIG.crane.hangOffset;
const HOUSE_STYLES = Babs.CONFIG.styles.houses;

// Houses shrink as you climb: full size < 200m, then -10% per 100m (min 40%).
function shrinkScale(drops) {
  const s = Babs.CONFIG.shrink;
  const altitude = drops * s.metersPerDrop;
  if (altitude < s.fullBelow) return 1.0;
  const steps = Math.floor((altitude - s.fullBelow) / s.stepMeters) + 1;
  return Math.max(s.min, 1.0 - s.stepAmount * steps);
}
