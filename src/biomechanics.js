/**
 * biomechanics.js
 * Core 2D inverse-kinematics and joint-angle calculations for
 * AdaptStance — Adaptive Motorcycle Posture Analyzer.
 *
 * Coordinate system (all units: mm)
 *   Origin  → seat / hip reference point  (0, 0)
 *   X+      → forward  (direction of travel)
 *   Y+      → upward
 *
 * Joints modeled (sagittal / side-view plane):
 *   Lower body : hip  → knee  → ankle  → foot-tip
 *   Upper body : hip  → shoulder → elbow → wrist → hand
 *   Head       : shoulder → head-centre
 */

'use strict';

// ─── constants ────────────────────────────────────────────────────────────────
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Angle (degrees) at vertex B formed by rays B→A and B→C.
 */
function angleBetween(A, B, C) {
  const v1x = A.x - B.x, v1y = A.y - B.y;
  const v2x = C.x - B.x, v2y = C.y - B.y;
  const dot  = v1x * v2x + v1y * v2y;
  const mag  = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (mag < 1e-6) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * RAD;
}

/**
 * 2-link planar IK: place joint1 so that
 *   |origin→joint1| = l1  and  |joint1→target| = l2.
 *
 * @param {object}  origin    {x, y}
 * @param {object}  target    {x, y}
 * @param {number}  l1        proximal segment length (mm)
 * @param {number}  l2        distal segment length (mm)
 * @param {number}  elbowSign +1 → mid-joint deflects left of origin→target line
 *                            -1 → deflects right  (use -1 for forward-knee / downward-elbow)
 * @returns {{ joint1: {x,y}, joint2: {x,y}, reachable: boolean }}
 */
function solveIK(origin, target, l1, l2, elbowSign = 1) {
  const dx  = target.x - origin.x;
  const dy  = target.y - origin.y;
  let   d   = Math.hypot(dx, dy);

  const maxR = l1 + l2;
  const minR = Math.abs(l1 - l2);
  const reachable = d >= minR && d <= maxR;

  // Clamp to achievable reach
  if (d > maxR * 0.999) d = maxR * 0.999;
  if (d < minR * 1.001 + 1e-3) d = minR * 1.001 + 1e-3;

  const theta  = Math.atan2(dy, dx);
  const cosAlp = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const alpha  = Math.acos(Math.max(-1, Math.min(1, cosAlp)));
  const angle1 = theta + elbowSign * alpha;

  return {
    joint1: {
      x: origin.x + l1 * Math.cos(angle1),
      y: origin.y + l1 * Math.sin(angle1),
    },
    joint2: target,
    reachable,
  };
}

// ─── posture model ────────────────────────────────────────────────────────────

/**
 * Given hip position (always 0,0), torso length, and back-lean angle,
 * return shoulder world-position.
 * backAngleDeg: degrees of forward lean from vertical (0 = bolt upright).
 */
function shoulderPos(torsoLen, backAngleDeg) {
  const a = backAngleDeg * DEG;
  return {
    x:  torsoLen * Math.sin(a),
    y:  torsoLen * Math.cos(a),
  };
}

/**
 * Auto-estimate back angle that gives a comfortable arm extension
 * (arms ~70–80 % of total reach) for the given rider triangle.
 *
 * Sweeps backAngle 5°→75°; picks angle that minimises deviation from
 * 75 % arm-reach ratio.
 *
 * @returns {number} back angle in degrees
 */
function estimateBackAngle(triangle, body) {
  const hb = triangle.hb;
  let bestAngle = 20, bestErr = Infinity;

  for (let a = 5; a <= 75; a += 0.5) {
    const sh  = shoulderPos(body.torso, a);
    const arm = body.upperarm + body.forearm;
    const d   = Math.hypot(hb.x - sh.x, hb.y - sh.y);
    const err = Math.abs(d - arm * 0.75);
    if (err < bestErr) { bestErr = err; bestAngle = a; }
  }
  return bestAngle;
}

/**
 * Full 2-D posture solve.
 *
 * @param {object} triangle  { hb:{x,y}, fp:{x,y}, seat:{x,y} }
 * @param {object} body      body segment lengths (mm)
 * @param {number} backAngleDeg
 * @returns {{ joints, angles }}
 */
function solvePosture(triangle, body, backAngleDeg) {
  const hip  = { x: 0, y: 0 };
  const fp   = triangle.fp;
  const hb   = triangle.hb;

  // ── lower body ──────────────────────────────────────────────────────────────
  // knee bends forward → elbowSign = -1 (deflects toward +X from hip→ankle)
  const legIK  = solveIK(hip, fp, body.thigh, body.lowerleg, -1);
  const knee   = legIK.joint1;
  const ankle  = fp;

  // Foot: extends forward from ankle, roughly horizontal
  const foot = { x: ankle.x + body.foot * 0.9, y: ankle.y - body.foot * 0.15 };

  // ── upper body ──────────────────────────────────────────────────────────────
  const sh     = shoulderPos(body.torso, backAngleDeg);
  // elbow bends downward → elbowSign = -1 (deflects toward −Y from shoulder→hb)
  const armIK  = solveIK(sh, hb, body.upperarm, body.forearm, -1);
  const elbow  = armIK.joint1;
  const wrist  = hb;

  // Hand: extends along forearm direction
  const faAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
  const hand    = {
    x: wrist.x + body.hand * Math.cos(faAngle),
    y: wrist.y + body.hand * Math.sin(faAngle),
  };

  // Head: above shoulder, partial lean
  const HEAD_LEN = 240;
  const head = {
    x: sh.x + HEAD_LEN * Math.sin(backAngleDeg * DEG * 0.45),
    y: sh.y + HEAD_LEN * Math.cos(backAngleDeg * DEG * 0.45),
  };

  // ── angles ───────────────────────────────────────────────────────────────────
  // Back: torso lean from vertical (== backAngleDeg by definition)
  const backAngle = backAngleDeg;

  // Knee angle: interior angle at knee joint (hip–knee–ankle)
  const kneeAngle = angleBetween(hip, knee, ankle);

  // Ankle angle: knee–ankle–foot
  const ankleAngle = angleBetween(knee, ankle, foot);

  // Shoulder angle: angle between torso axis and upper arm
  //   torso reference point = virtual point "below" shoulder (toward hip direction)
  const torsoRef = { x: sh.x - body.torso * Math.sin(backAngleDeg * DEG),
                     y: sh.y - body.torso * Math.cos(backAngleDeg * DEG) };
  const shoulderAngle = angleBetween(torsoRef, sh, elbow);

  // Elbow angle: shoulder–elbow–wrist
  const elbowAngle = angleBetween(sh, elbow, wrist);

  // Wrist angle: elbow–wrist–hand
  const wristAngle = angleBetween(elbow, wrist, hand);

  return {
    joints: { hip, knee, ankle, foot, shoulder: sh, elbow, wrist, hand, head },
    angles: {
      back:     backAngle,
      knee:     kneeAngle,
      ankle:    ankleAngle,
      shoulder: shoulderAngle,
      elbow:    elbowAngle,
      wrist:    wristAngle,
    },
  };
}

/**
 * Build an "ideal" posture for a given mode by using the midpoints
 * of its angle ranges as the target back angle, then solving.
 */
function idealPosture(triangle, body, ranges) {
  const backMid = (ranges.back.min + ranges.back.max) / 2;
  return solvePosture(triangle, body, backMid);
}

/**
 * Check whether a value falls inside, near (±15 % of span), or outside a range.
 * @returns {'in'|'near'|'out'}
 */
function checkRange(value, range) {
  if (value >= range.min && value <= range.max) return 'in';
  const margin = (range.max - range.min) * 0.15;
  if (value >= range.min - margin && value <= range.max + margin) return 'near';
  return 'out';
}

// ─── exports (browser-global or Node module) ─────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { angleBetween, solveIK, shoulderPos, estimateBackAngle,
                     solvePosture, idealPosture, checkRange };
}
