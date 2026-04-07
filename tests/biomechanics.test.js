/**
 * biomechanics.test.js
 * Unit tests for AdaptStance biomechanics module.
 * Run with:  node tests/biomechanics.test.js
 * (No external test runner required — pure Node assertions)
 */

const assert = require('assert');
const {
  angleBetween,
  solveIK,
  shoulderPos,
  estimateBackAngle,
  solvePosture,
  idealPosture,
  checkRange,
} = require('../src/biomechanics');

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

function near(a, b, tol = 0.5) {
  assert(Math.abs(a - b) <= tol, `Expected ${a} ≈ ${b} (tol ${tol})`);
}

// ─── angleBetween ─────────────────────────────────────────────────────────────
console.log('\nangleBetween');

test('right angle (90°)', () => {
  near(angleBetween({ x:0,y:1 }, { x:0,y:0 }, { x:1,y:0 }), 90);
});

test('straight line (180°)', () => {
  near(angleBetween({ x:-1,y:0 }, { x:0,y:0 }, { x:1,y:0 }), 180);
});

test('45° angle', () => {
  near(angleBetween({ x:0,y:1 }, { x:0,y:0 }, { x:1,y:1 }), 45, 1);
});

// ─── solveIK ──────────────────────────────────────────────────────────────────
console.log('\nsolveIK');

test('endpoint matches target', () => {
  const origin = { x:0, y:0 };
  const target = { x:300, y:-400 };
  const ik = solveIK(origin, target, 420, 410, -1);
  near(Math.hypot(ik.joint2.x - target.x, ik.joint2.y - target.y), 0, 1);
});

test('link lengths preserved', () => {
  const origin = { x:0, y:0 };
  const target = { x:200, y:-350 };
  const l1 = 420, l2 = 410;
  const ik = solveIK(origin, target, l1, l2, -1);
  near(Math.hypot(ik.joint1.x - origin.x, ik.joint1.y - origin.y), l1, 2);
  near(Math.hypot(ik.joint2.x - ik.joint1.x, ik.joint2.y - ik.joint1.y), l2, 2);
});

// ─── shoulderPos ─────────────────────────────────────────────────────────────
console.log('\nshoulderPos');

test('upright (0°) → shoulder directly above hip', () => {
  const sh = shoulderPos(550, 0);
  near(sh.x, 0, 1);
  near(sh.y, 550, 1);
});

test('90° lean → shoulder directly in front of hip', () => {
  const sh = shoulderPos(550, 90);
  near(sh.x, 550, 1);
  near(sh.y,   0, 1);
});

// ─── checkRange ───────────────────────────────────────────────────────────────
console.log('\ncheckRange');

test('value inside range → "in"', () => {
  assert.strictEqual(checkRange(100, { min:90, max:110 }), 'in');
});

test('value at boundary → "in"', () => {
  assert.strictEqual(checkRange(90, { min:90, max:110 }), 'in');
});

test('value just outside → "near"', () => {
  assert.strictEqual(checkRange(88, { min:90, max:110 }), 'near');
});

test('value far outside → "out"', () => {
  assert.strictEqual(checkRange(50, { min:90, max:110 }), 'out');
});

// ─── solvePosture ─────────────────────────────────────────────────────────────
console.log('\nsolvePosture');

const DEFAULT_TRIANGLE = {
  hb:   { x: 300, y: 200 },
  fp:   { x:  50, y:-450 },
  seat: { x:   0, y:   0 },
};
const DEFAULT_BODY = {
  forearm: 270, upperarm: 310, torso: 550,
  thigh: 420, lowerleg: 410, foot: 250, hand: 80,
};

test('returns all six angles', () => {
  const p = solvePosture(DEFAULT_TRIANGLE, DEFAULT_BODY, 20);
  ['back','knee','ankle','shoulder','elbow','wrist'].forEach(k =>
    assert(typeof p.angles[k] === 'number', `missing angle: ${k}`)
  );
});

test('back angle matches input', () => {
  const p = solvePosture(DEFAULT_TRIANGLE, DEFAULT_BODY, 30);
  near(p.angles.back, 30, 0.1);
});

test('knee angle within plausible range (30°–160°)', () => {
  const p = solvePosture(DEFAULT_TRIANGLE, DEFAULT_BODY, 20);
  assert(p.angles.knee > 30 && p.angles.knee < 160, `knee = ${p.angles.knee}`);
});

// ─── estimateBackAngle ────────────────────────────────────────────────────────
console.log('\nestimateBackAngle');

test('returns a number between 5° and 75°', () => {
  const a = estimateBackAngle(DEFAULT_TRIANGLE, DEFAULT_BODY);
  assert(a >= 5 && a <= 75, `backAngle = ${a}`);
});

// ─── summary ─────────────────────────────────────────────────────────────────
console.log(`\n──────────────────────────────────`);
console.log(`  Passed: ${passed}   Failed: ${failed}`);
console.log(`──────────────────────────────────\n`);
process.exit(failed > 0 ? 1 : 0);
