# AdaptStance — Adaptive Motorcycle Posture Analyzer

A browser-based biomechanical tool for designing and validating adaptive-stance
motorcycles that shift between **Cruiser** and **Sport** riding postures by
actuating the handlebar, seat, and footpeg positions.

---

## Live Demo

Deploy to GitHub Pages (see [Deployment](#deployment)) or open `index.html`
directly in a browser.

---

## Features

- **Rider-triangle input** — enter handlebar, seat (origin), and footpeg
  coordinates in mm
- **Body anthropometrics** — forearm, upper arm, torso, thigh, lower leg, foot,
  and hand segment lengths
- **Configurable angle ranges** — set Cruiser and Sport target ranges for all
  six joints: Wrist · Elbow · Shoulder · Back · Knee · Ankle
- **Side-by-side SVG diagrams** — live stick-figure render of Cruiser ideal,
  Sport ideal, and your current geometry
- **Joint-angle comparison table** — per-joint In Range / Near / Out status
- **Adjustment recommendations** — specific handlebar/footpeg moves to hit
  target ranges

---

## Repository Structure

```
adaptstance/
├── index.html                 # Standalone single-page web app
├── src/
│   ├── biomechanics.js        # 2-D IK solver & angle calculations
│   ├── renderer.js            # SVG stick-figure renderer
│   └── ui.js                  # Tab navigation, form helpers, results display
├── data/
│   └── defaults.json          # Default body measurements & angle ranges
├── tests/
│   └── biomechanics.test.js   # Unit tests (Node.js, no external runner)
├── .gitignore
└── README.md
```

---

## Biomechanical Model

A 2-D sagittal-plane (side-view) model is used.

| Chain        | Joints                              | Method         |
|--------------|-------------------------------------|----------------|
| Lower body   | Hip → Knee → Ankle → Foot-tip       | 2-link IK      |
| Upper body   | Shoulder → Elbow → Wrist → Hand     | 2-link IK      |
| Torso        | Hip → Shoulder (driven by back angle)| Analytic       |

**Back angle** (torso lean from vertical) is auto-estimated by finding the angle
at which the arms achieve ≈ 75 % of maximum reach — a comfortable, non-fatiguing
posture. You can override this by adjusting the Cruiser / Sport back-angle ranges.

### Default Angle Ranges

| Joint    | Cruiser        | Sport         |
|----------|---------------|---------------|
| Back     | 10° – 25°     | 35° – 60°     |
| Knee     | 85° – 115°    | 60° – 90°     |
| Ankle    | 80° – 100°    | 75° – 100°    |
| Shoulder | 20° – 45°     | 45° – 75°     |
| Elbow    | 130° – 165°   | 95° – 130°    |
| Wrist    | 155° – 180°   | 135° – 165°   |

Ranges are informed by SAE J1516, ISO 15534-1, and motorcycle ergonomics
literature. All angles except Back are interior (included) joint angles.

---

## Running the Tests

No package installation required.

```bash
node tests/biomechanics.test.js
```

---

## Deployment

### GitHub Pages (recommended)

1. Push this repository to GitHub.
2. Go to **Settings → Pages → Source**: `main` branch, `/ (root)`.
3. Your app is live at `https://<username>.github.io/<repo>/`.

### Local

Simply open `index.html` in any modern browser. The `data/defaults.json` file
is fetched via `fetch()`, so if you open as a `file://` URL the defaults fall
back to hardcoded values in `ui.js` automatically.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push to the branch: `git push origin feat/my-feature`
5. Open a Pull Request

---

## References

- SAE J1516 — Accommodation Tool Reference Point
- ISO 15534-1 — Ergonomic design for the safety of machinery
- Motorcycle ergonomics literature (Msuffert, Watkins, Haworth)

---

## License

MIT — see [LICENSE](LICENSE) file.
