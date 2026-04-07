/**
 * renderer.js
 * SVG stick-figure renderer for AdaptStance posture diagrams.
 *
 * Draws a 2-D sagittal-plane (side-view) rider diagram onto an SVG element.
 * No external dependencies.
 */

'use strict';

// ─── coordinate mapping ───────────────────────────────────────────────────────

/**
 * Compute a bounding box over all joint positions + rider triangle hardpoints,
 * then return a mapper function from world-mm to SVG-px.
 *
 * @param {object} joints    map of {x,y} points
 * @param {object} triangle  { hb, fp, seat }
 * @param {number} svgW      SVG viewport width  (px)
 * @param {number} svgH      SVG viewport height (px)
 * @param {number} padding   pixel padding around content (default 40)
 * @returns {function({x,y}) => {x,y}}
 */
function makeMapper(joints, triangle, svgW, svgH, padding = 44) {
  const pts = [
    ...Object.values(joints),
    triangle.hb, triangle.fp, triangle.seat,
  ];
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);

  const extraPad = 180;
  const minX = Math.min(...xs) - extraPad;
  const maxX = Math.max(...xs) + extraPad;
  const minY = Math.min(...ys) - extraPad;
  const maxY = Math.max(...ys) + extraPad;

  const scaleX = (svgW - padding * 2) / (maxX - minX);
  const scaleY = (svgH - padding * 2) / (maxY - minY);
  const scale  = Math.min(scaleX, scaleY) * 0.88;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return pt => ({
    x: svgW / 2 + (pt.x - cx) * scale,
    y: svgH / 2 - (pt.y - cy) * scale,   // flip Y axis
  });
}

// ─── SVG element helpers ──────────────────────────────────────────────────────

function line(p1, p2, stroke, width = 4, dash = '') {
  return `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}"
               x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}"
               stroke="${stroke}" stroke-width="${width}"
               stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
}

function circle(c, r, fill, stroke, sw = 2) {
  return `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r}"
                  fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function text(pos, content, fill, size = 10, anchor = 'start', bold = false) {
  return `<text x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}"
                fill="${fill}" font-size="${size}" font-family="monospace"
                text-anchor="${anchor}" ${bold ? 'font-weight="bold"' : ''}>${content}</text>`;
}

// ─── main render ─────────────────────────────────────────────────────────────

/**
 * Render a posture diagram into the SVG element identified by `svgId`.
 *
 * @param {string}  svgId     id of the target <svg> element
 * @param {object}  posture   { joints, angles } from biomechanics.solvePosture
 * @param {object}  triangle  rider-triangle hardpoints
 * @param {string}  mode      'cruiser' | 'sport' | 'current'
 * @param {object}  [ranges]  optional mode ranges for angle colouring
 */
function renderSVG(svgId, posture, triangle, mode, ranges) {
  const svgEl = document.getElementById(svgId);
  if (!svgEl) return;

  const SVG_W = 380, SVG_H = 460;
  const { joints, angles } = posture;

  // ── colour scheme ──────────────────────────────────────────────────────────
  const palette = {
    cruiser: { body: '#4ec9b0', joint: '#9efce8', label: '#4ec9b0' },
    sport:   { body: '#ff6b00', joint: '#ffbb77', label: '#ff6b00' },
    current: { body: '#8899ff', joint: '#bbccff', label: '#8899ff' },
  };
  const col = palette[mode] || palette.current;

  const map = makeMapper(joints, triangle, SVG_W, SVG_H);

  // Helper: mapped point
  const m = pt => map(pt);

  let html = '';

  // ── ground line ────────────────────────────────────────────────────────────
  const groundY = m({ x: 0, y: triangle.fp.y - 120 }).y;
  html += `<line x1="0" y1="${groundY.toFixed(1)}" x2="${SVG_W}" y2="${groundY.toFixed(1)}"
                 stroke="#2a3040" stroke-width="1" stroke-dasharray="5,4"/>`;

  // ── motorcycle schematic ───────────────────────────────────────────────────
  const seat2d = m(triangle.seat);
  const hb2d   = m(triangle.hb);
  const fp2d   = m(triangle.fp);

  // Structural lines (seat→footpeg spine, dashed handlebar stem)
  html += line(seat2d, fp2d, '#3a4050', 3);
  html += line(seat2d, hb2d, '#3a4050', 2, '5,3');

  // Footpeg bar
  html += `<rect x="${(fp2d.x - 13).toFixed(1)}" y="${(fp2d.y - 4).toFixed(1)}"
                 width="26" height="7" rx="3" fill="#444" stroke="#555" stroke-width="1"/>`;

  // Seat
  html += `<ellipse cx="${seat2d.x.toFixed(1)}" cy="${seat2d.y.toFixed(1)}"
                    rx="22" ry="7" fill="#444" stroke="#555" stroke-width="1"/>`;

  // Handlebar
  html += `<rect x="${(hb2d.x - 15).toFixed(1)}" y="${(hb2d.y - 3).toFixed(1)}"
                 width="30" height="7" rx="3" fill="#444" stroke="#555" stroke-width="1"/>`;

  // ── body segments ──────────────────────────────────────────────────────────
  const segments = [
    [joints.hip,      joints.knee],
    [joints.knee,     joints.ankle],
    [joints.ankle,    joints.foot],
    [joints.hip,      joints.shoulder],
    [joints.shoulder, joints.elbow],
    [joints.elbow,    joints.wrist],
    [joints.wrist,    joints.hand],
    [joints.shoulder, joints.head],
  ];

  segments.forEach(([a, b]) => {
    html += line(m(a), m(b), col.body, 4.5);
  });

  // Head circle
  html += circle(m(joints.head), 18, 'none', col.body, 3);

  // ── annotated joints ──────────────────────────────────────────────────────
  const annotated = [
    { key: 'knee',     label: 'K', angle: angles.knee     },
    { key: 'ankle',    label: 'A', angle: angles.ankle    },
    { key: 'shoulder', label: 'S', angle: angles.shoulder },
    { key: 'elbow',    label: 'E', angle: angles.elbow    },
    { key: 'wrist',    label: 'W', angle: angles.wrist    },
  ];

  annotated.forEach(({ key, label, angle }) => {
    const pp = m(joints[key]);

    // Colour dot based on range compliance if ranges provided
    let dotColor = col.joint;
    if (ranges && ranges[key]) {
      const status = checkRangeLocal(angle, ranges[key]);
      dotColor = status === 'in' ? '#4caf50' : status === 'near' ? '#ff9800' : '#f44336';
    }

    html += circle(pp, 7, '#1a1f2e', dotColor, 2.5);
    html += text({ x: pp.x + 10, y: pp.y - 6 }, `${angle.toFixed(0)}°`, col.label, 10);
  });

  // Hip dot (no angle label needed)
  html += circle(m(joints.hip), 6, col.body, col.joint, 1.5);

  // ── info text ──────────────────────────────────────────────────────────────
  html += text({ x: 8, y: 18 }, `Back: ${angles.back.toFixed(0)}°`, '#666', 9);

  const modeTag = { cruiser: 'CRUISER', sport: 'SPORT', current: 'CURRENT' }[mode] || '';
  html += text(
    { x: SVG_W / 2, y: SVG_H - 6 },
    modeTag, col.label, 11, 'middle', true
  );

  svgEl.innerHTML = html;
}

// local copy (avoids cross-file import complexity in single-file build)
function checkRangeLocal(value, range) {
  if (value >= range.min && value <= range.max) return 'in';
  const margin = (range.max - range.min) * 0.15;
  if (value >= range.min - margin && value <= range.max + margin) return 'near';
  return 'out';
}

if (typeof module !== 'undefined') {
  module.exports = { renderSVG, makeMapper };
}
