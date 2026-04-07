/**
 * ui.js
 * Tab navigation, form helpers, results rendering and recommendations
 * for AdaptStance.  Depends on biomechanics.js and renderer.js being
 * loaded first.
 */

'use strict';

// ─── tab navigation ───────────────────────────────────────────────────────────

function showTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.dataset.tab === name) b.classList.add('active');
  });
}

// ─── form helpers ─────────────────────────────────────────────────────────────

function getNum(id) {
  return parseFloat(document.getElementById(id).value) || 0;
}

function setNum(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getTriangle() {
  return {
    hb:   { x: getNum('hb_x'),  y: getNum('hb_y')  },
    fp:   { x: getNum('fp_x'),  y: getNum('fp_y')  },
    seat: { x: 0,               y: 0               },
  };
}

function getBody() {
  return {
    forearm:  getNum('L_forearm'),
    upperarm: getNum('L_upperarm'),
    torso:    getNum('L_torso'),
    thigh:    getNum('L_thigh'),
    lowerleg: getNum('L_lowerleg'),
    foot:     getNum('L_foot'),
    hand:     getNum('L_hand'),
  };
}

function getRanges() {
  const j = ['back', 'knee', 'ankle', 'shoulder', 'elbow', 'wrist'];
  const out = { cruiser: {}, sport: {} };
  j.forEach(k => {
    out.cruiser[k] = { min: getNum(`cr_${k}_min`), max: getNum(`cr_${k}_max`) };
    out.sport[k]   = { min: getNum(`sp_${k}_min`), max: getNum(`sp_${k}_max`) };
  });
  return out;
}

// ─── status helpers ───────────────────────────────────────────────────────────

function statusBadge(status) {
  if (status === 'in')   return '<span class="badge badge-ok">✓ In Range</span>';
  if (status === 'near') return '<span class="badge badge-warn">≈ Near</span>';
  return                        '<span class="badge badge-fail">✗ Out</span>';
}

// ─── main analysis ────────────────────────────────────────────────────────────

function analyze() {
  const triangle = getTriangle();
  const body     = getBody();
  const ranges   = getRanges();

  // Compute postures
  const backAngle      = estimateBackAngle(triangle, body);
  const currentPosture = solvePosture(triangle, body, backAngle);
  const cruiserPosture = idealPosture(triangle, body, ranges.cruiser);
  const sportPosture   = idealPosture(triangle, body, ranges.sport);

  // Render diagrams
  renderSVG('svg-cruiser', cruiserPosture, triangle, 'cruiser', ranges.cruiser);
  renderSVG('svg-sport',   sportPosture,   triangle, 'sport',   ranges.sport);
  renderSVG('svg-current', currentPosture, triangle, 'current');

  // Angle comparison table
  const JOINTS = ['back', 'knee', 'ankle', 'shoulder', 'elbow', 'wrist'];
  const LABELS = {
    back: 'Back (torso lean)', knee: 'Knee', ankle: 'Ankle',
    shoulder: 'Shoulder', elbow: 'Elbow', wrist: 'Wrist',
  };

  const { angles } = currentPosture;
  let tableHtml = '';
  JOINTS.forEach(j => {
    const val  = angles[j];
    const cr   = ranges.cruiser[j];
    const sp   = ranges.sport[j];
    const crSt = checkRange(val, cr);
    const spSt = checkRange(val, sp);
    tableHtml += `
      <tr>
        <td>${LABELS[j]}</td>
        <td><strong>${val.toFixed(1)}°</strong></td>
        <td>${cr.min}° – ${cr.max}°</td>
        <td>${sp.min}° – ${sp.max}°</td>
        <td>${statusBadge(crSt)}</td>
        <td>${statusBadge(spSt)}</td>
      </tr>`;
  });
  document.getElementById('angle-table-body').innerHTML = tableHtml;

  // Summary analysis text
  const crFit = JOINTS.filter(j => checkRange(angles[j], ranges.cruiser[j]) === 'in').length;
  const spFit = JOINTS.filter(j => checkRange(angles[j], ranges.sport[j])   === 'in').length;

  let summaryHtml = `
    <p style="margin-bottom:12px">
      Computed torso lean: <strong style="color:#ccc">${angles.back.toFixed(1)}° from vertical</strong>.
    </p>
    <p style="margin-bottom:6px"><span style="color:#4ec9b0">🏖 Cruiser: <strong>${crFit}/${JOINTS.length}</strong> joints in target range.</span></p>
    <p style="margin-bottom:14px"><span style="color:#ff6b00">🏁 Sport: <strong>${spFit}/${JOINTS.length}</strong> joints in target range.</span></p>`;

  if (crFit >= 5)
    summaryHtml += `<p style="color:#4ec9b0">✓ Current geometry suits <strong>Cruiser mode</strong>.</p>`;
  else if (spFit >= 5)
    summaryHtml += `<p style="color:#ff6b00">✓ Current geometry suits <strong>Sport mode</strong>.</p>`;
  else
    summaryHtml += `<p style="color:#ff9800">⚠ Geometry does not fully match either mode.</p>`;

  document.getElementById('analysis-text').innerHTML = summaryHtml;

  // Recommendations
  const recItems = [];
  JOINTS.forEach(j => {
    const val  = angles[j];
    const cr   = ranges.cruiser[j];
    const sp   = ranges.sport[j];
    const crOk = checkRange(val, cr) === 'in';
    const spOk = checkRange(val, sp) === 'in';
    if (crOk && spOk) return;

    let hint = '';
    if (j === 'back') {
      if      (val < cr.min) hint = 'Raise or pull back the handlebar to increase upright posture.';
      else if (val > sp.max) hint = 'Lower or push forward the handlebar to increase forward lean.';
      else                   hint = 'Fine-tune handlebar height to hit the target range.';
    } else if (j === 'knee') {
      if      (val < sp.min) hint = 'Move footpeg rearward to open the knee angle.';
      else if (val > cr.max) hint = 'Move footpeg forward to reduce the knee angle.';
    } else if (j === 'ankle') {
      hint = 'Adjust footpeg height; lower footpeg increases ankle dorsiflexion.';
    } else if (j === 'shoulder' || j === 'elbow') {
      if      (val < cr.min) hint = 'Move handlebar closer or higher to reduce arm reach.';
      else if (val > cr.max) hint = 'Move handlebar farther or lower for greater arm extension.';
    } else if (j === 'wrist') {
      hint = 'Adjust handlebar rise or sweep to bring wrist into neutral alignment.';
    }

    const borderCol = !crOk ? '#ff6b00' : '#4ec9b0';
    recItems.push(`
      <div style="margin-bottom:10px;padding:10px 14px;background:#1a2030;
                  border-radius:6px;border-left:3px solid ${borderCol}">
        <strong>${LABELS[j]}:</strong> ${val.toFixed(1)}°
        ${!crOk ? `<span style="color:#4ec9b0"> | Cruiser target: ${cr.min}°–${cr.max}°</span>` : ''}
        ${!spOk ? `<span style="color:#ff6b00"> | Sport target: ${sp.min}°–${sp.max}°</span>` : ''}
        ${hint ? `<br><em style="color:#888">→ ${hint}</em>` : ''}
      </div>`);
  });

  document.getElementById('recommendations').innerHTML =
    recItems.length
      ? recItems.join('')
      : '<p style="color:#4caf50">✓ All joints within acceptable ranges for at least one mode.</p>';

  // Show results panel
  document.getElementById('results-placeholder').style.display = 'none';
  document.getElementById('results-content').style.display     = 'block';
  showTab('results');
}

// ─── reset defaults ───────────────────────────────────────────────────────────

async function loadDefaults() {
  try {
    const resp = await fetch('data/defaults.json');
    const d    = await resp.json();

    // Rider triangle
    setNum('hb_x', d.triangle.hb.x);  setNum('hb_y', d.triangle.hb.y);
    setNum('fp_x', d.triangle.fp.x);  setNum('fp_y', d.triangle.fp.y);

    // Body
    Object.entries(d.body).forEach(([k, v]) => setNum(`L_${k}`, v));

    // Ranges
    ['cruiser', 'sport'].forEach(mode => {
      const prefix = mode === 'cruiser' ? 'cr' : 'sp';
      Object.entries(d.ranges[mode]).forEach(([joint, rng]) => {
        setNum(`${prefix}_${joint}_min`, rng.min);
        setNum(`${prefix}_${joint}_max`, rng.max);
      });
    });
  } catch {
    // fallback inline defaults if fetch fails (e.g., opened as file://)
    _applyHardcodedDefaults();
  }
}

function _applyHardcodedDefaults() {
  const map = {
    hb_x:300, hb_y:200, fp_x:50, fp_y:-450,
    L_forearm:270, L_upperarm:310, L_torso:550,
    L_thigh:420, L_lowerleg:410, L_foot:250, L_hand:80,
    cr_back_min:10,  cr_back_max:25,  sp_back_min:35,  sp_back_max:60,
    cr_knee_min:85,  cr_knee_max:115, sp_knee_min:60,  sp_knee_max:90,
    cr_ankle_min:80, cr_ankle_max:100,sp_ankle_min:75, sp_ankle_max:100,
    cr_shoulder_min:20,cr_shoulder_max:45,sp_shoulder_min:45,sp_shoulder_max:75,
    cr_elbow_min:130,cr_elbow_max:165,sp_elbow_min:95, sp_elbow_max:130,
    cr_wrist_min:155,cr_wrist_max:180,sp_wrist_min:135,sp_wrist_max:165,
  };
  Object.entries(map).forEach(([id, val]) => setNum(id, val));
}

// Attach tab buttons on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
  loadDefaults();
});
