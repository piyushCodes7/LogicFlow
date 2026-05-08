# LogicFlow — Interactive Virtual Electronics Lab

> **A browser-based electronics and digital-logic learning environment for students, hobbyists, and educators.**



---

## Table of Contents

- [Overview](#overview)
- [Live Features](#live-features)
- [Project Structure](#project-structure)
- [Experiments](#experiments)
- [Design System](#design-system)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Access & Auth Model](#access--auth-model)
- [Navigation & Routing](#navigation--routing)
- [Shared Infrastructure](#shared-infrastructure)
- [Curriculum Mapping](#curriculum-mapping)
- [Pages Reference](#pages-reference)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

LogicFlow is a frontend-only, file-based virtual electronics lab. It provides students with interactive simulations of real laboratory experiments — without requiring physical hardware, a lab booking, or any backend infrastructure.

Every experiment mirrors a real university lab syllabus entry, complete with interactive controls, live waveform/graph rendering, measurement readouts, and observation panels. The platform also includes a Computer Architecture pipeline stepper, a Curriculum Mapping page, a Student Tasks dashboard, and two built-in evaluation quizzes.

**Key goals:**
- Replace passive PDFs with hands-on, interactive simulations
- Cover both analog electronics and digital logic in one coherent journey
- Align with real university syllabi (AKTU, VTU, Anna University, Mumbai University)
- Work entirely in the browser with zero dependencies on a backend server

---

## Live Features

| Feature | Status |
|---|---|
| 7 interactive lab experiments | ✅ Complete |
| Virtual CRO (oscilloscope) + function generator | ✅ Complete |
| PN junction diode V-I curve simulator | ✅ Complete |
| Zener diode voltage regulator | ✅ Complete |
| Half-wave & full-wave rectifier with filter | ✅ Complete |
| D & J-K flip-flop with live timing diagram | ✅ Complete |
| BCD to 7-segment decoder with truth table | ✅ Complete |
| COA pipeline stepper (Fetch→Decode→Execute→WriteBack) | ✅ Complete |
| 2× continuous evaluation quizzes | ✅ Complete |
| Curriculum mapping (4 universities) | ✅ Complete |
| Student tasks dashboard | ✅ Complete |
| Logic Gate Sandbox | ✅ Complete |
| MUX / DEMUX experiment | ✅ Complete |
| ALU implementation experiment | ✅ Complete |

---

## Project Structure

```
logicflow/
│
├── index.html                  # Landing page with hero, access dialog, marketing sections
├── curriculum.html             # Curriculum mapping page
├── sandbox.html                # Logic Gate Sandbox (placeholder)
├── coa.html                    # Computer Architecture pipeline stepper
├── student-tasks.html          # Student task board dashboard
├── eval1.html                  # Continuous Evaluation 1.1 (quiz)
├── eval2.html                  # Continuous Evaluation 1.2 (quiz)
│
├── exp1_components.html        # Experiment 1: Component Familiarization
├── exp2_equipments.html        # Experiment 2: Virtual CRO & Function Generator
├── exp3_diode.html             # Experiment 3: PN Junction Diode
├── exp4_zener.html             # Experiment 4: Zener Diode Voltage Regulator
├── exp5_rectifier.html         # Experiment 5: Rectifier & Filter Circuits
├── exp6_flipflops.html         # Experiment 6: D & J-K Flip-Flops
├── exp7_bcd_decoder.html       # Experiment 7: BCD to 7-Segment Decoder
│
├── css/
│   ├── global.css              # Shared nav, mesh background, CSS variables
│   ├── index.css               # Landing page styles
│   ├── curriculum.css
│   ├── sandbox.css
│   ├── coa.css
│   ├── student-tasks.css
│   ├── eval1.css
│   ├── eval2.css
│   ├── exp1_components.css
│   ├── exp2_equipments.css
│   ├── exp3_diode.css
│   ├── exp4_zener.css
│   ├── exp5_rectifier.css
│   ├── exp6_flipflops.css
│   └── exp7_bcd_decoder.css
│
├── js/
│   ├── nav-shared.js           # Shared nav logic: dropdown, auth state, active links
│   ├── index.js                # Landing page: blob animation, icon parallax, access dialog
│   ├── curriculum.js           # Curriculum data + rendering
│   ├── sandbox.js              # Placeholder background animation
│   ├── coa.js                  # COA pipeline stepper logic
│   ├── student-tasks.js        # Student profile, progress bars, metric animation
│   ├── eval1.js                # Quiz 1 logic
│   ├── eval2.js                # Quiz 2 logic
│   ├── exp1_components.js      # Component inspector + resistor calculator
│   ├── exp2_equipments.js      # CRO canvas renderer + function generator
│   ├── exp3_diode.js           # Shockley equation + V-I Chart.js chart
│   ├── exp4_zener.js           # Zener regulation circuit solver + chart
│   ├── exp5_rectifier.js       # Rectifier + capacitor filter simulation
│   ├── exp6_flipflops.js       # Flip-flop logic + timing diagram canvas
│   └── exp7_bcd_decoder.js     # BCD decoder + 7-segment display renderer
│
└── favicon.png
```

---

## Experiments

### Experiment 1 — Electronic Components Inspector (`exp1_components.html`)
An interactive catalog of 8 fundamental components: Resistor, Capacitor, Inductor, Diode, LED, Transistor, Multimeter, and Breadboard. Each entry shows a physical illustration, schematic symbol, description, and key specifications. The Resistor card includes a live **5-band resistor color-code calculator** with automatic range computation.

### Experiment 2 — Virtual CRO & Function Generator (`exp2_equipments.html`)
A real-time oscilloscope (CRO) canvas simulation driven by a function generator panel. Students can:
- Select **Sine, Square, or Triangle** waveforms
- Adjust **Frequency** (10 Hz – 5 kHz), **Amplitude** (0.1–20 Vpp), and **DC Offset** (±10 V)
- Control **VOLTS/DIV** and **TIME/DIV** on the oscilloscope
- Observe stable waveforms with trigger emulation, phosphor glow effect, and an authentic CRT grid

The canvas renders at ~60 fps using `requestAnimationFrame`, and all waveforms use analytically correct math (sin, sign·sin, arcsin approximation for triangle).

### Experiment 3 — PN Junction Diode (`exp3_diode.html`)
Physics-accurate simulation of the **Shockley diode equation**: `I = Is × (e^(V/nVt) − 1)`. Features:
- Forward / Reverse bias toggle
- Applied voltage slider (scoped per bias mode)
- Temperature slider (0–100 °C) affecting thermal voltage Vt
- Live **Chart.js V-I curve** with animated Q-point marker
- Virtual multimeter (V, I, Power, Status)
- Dynamic observation card (Cut-off / Near Threshold / Active / Reverse)
- One-click **lab report export** (print-ready HTML window)

### Experiment 4 — Zener Diode Voltage Regulator (`exp4_zener.html`)
Simulates a Zener shunt regulator (Vz = 5.1 V, 500 mW) with real KCL-based circuit solving. Sliders for Vin (0–15 V), Rs (50–1000 Ω), and RL (100–10 kΩ). Outputs: Vout, Iz, IL, Pz, and a live **voltage transfer curve** via Chart.js. A status card dynamically reports Regulating / Off / Overpowered state.

### Experiment 5 — Rectifier & Filter Circuits (`exp5_rectifier.html`)
Toggle between **Half-Wave** and **Full-Wave Bridge** topologies. Enable a **capacitor filter** (1–100 µF) and vary RL. Two Chart.js line charts show the AC input and rectified output waveforms simultaneously. Computed metrics: Vdc, ripple voltage (Vrpp), ripple factor (γ), and efficiency (η). Filter uses exponential decay discharge and capacitor charge-switching logic.

### Experiment 6 — Flip-Flop Architecture (`exp6_flipflops.html`)
Simulate **D Flip-Flop (74LS74)** and **J-K Flip-Flop (74LS76)** with:
- Logic input toggles (D or J/K)
- Manual clock push button (rising-edge triggered)
- LED output indicators for Q and Q̅
- Live **timing diagram canvas** — draws CLK, inputs, Q, Q̅ waveforms in real time at ~60 fps
- Asynchronous PRE/CLR override logic

### Experiment 7 — BCD to 7-Segment Decoder (`exp7_bcd_decoder.html`)
Simulates the **IC 7447** BCD decoder driving a common-anode 7-segment display. Four data switches (A–D, LSB to MSB) encode a 4-bit BCD input. The correct segment pattern lights up instantly using a CSS-shaped segment grid with glow effects. A full 16-row truth table highlights the active row, including pseudo-hex states (10–15) per the 7447 standard.

---

## Design System

All pages share a consistent visual language defined in `css/global.css` and per-page CSS files.

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#eceeff` | Page background |
| `--surface` | `rgba(255,255,255,0.55)` | Glassmorphic panels |
| `--border` | `rgba(255,255,255,0.6)` | Panel borders |
| `--cyan` | `#06b6d4` | Primary accent (CRO, BCD) |
| `--amber` | `#F59E0B` | Secondary accent (sliders, Q-point) |
| `--green` | `#10B981` | Success states, rectifier output |
| `--purple` | `#7C3AED` | Sequential logic (flip-flops) |
| `--blue` | `#1A56DB` | Navigation, diode, pipeline |
| `--rose` | `#F43F5E` | Evaluations, error states |

### Typography

| Role | Font |
|---|---|
| Display / Headings | Playfair Display (serif), 600–700 weight |
| Body / UI | System UI stack (`-apple-system`, `SF Pro Display`, etc.) |
| Monospace / Labels | JetBrains Mono |

### Glassmorphism Panels
All lab panels use `backdrop-filter: blur(20px)` with semi-transparent white backgrounds, subtle white borders, and soft box shadows — giving a frosted-glass appearance over the animated mesh gradient background.

### Animated Background
Every page uses a fixed `div.bg-mesh` containing four absolutely-positioned blobs (`div.blob-1` through `blob-4`). Each blob is a large, blurred, softly-colored `div` that drifts via CSS `@keyframes drift` animation, creating a smooth, shifting color mesh behind all content.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 (semantic, accessible) |
| Styling | Vanilla CSS (custom properties, grid, flexbox, backdrop-filter) |
| Logic | Vanilla JavaScript (ES6+, no frameworks) |
| Charting | [Chart.js 4.4.0](https://www.chartjs.org/) (CDN) — diode, zener, rectifier |
| Canvas rendering | Native Canvas 2D API — CRO waveforms, timing diagrams, background blobs |
| Fonts | Google Fonts — Playfair Display, JetBrains Mono |
| State | `sessionStorage` for auth role, student display name, email |
| Build | None — file-based, zero build step required |

---

## Getting Started

No build tools, package managers, or servers are required for local development.

**Option 1 — Open directly**
```bash
# Clone or download the repository
git clone https://github.com/your-username/logicflow.git
cd logicflow

# Open any page in your browser
open index.html
```
> Note: Some browsers block `backdrop-filter` or Canvas on `file://` URLs. Use a local server for the best experience.

**Option 2 — Local server (recommended)**
```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve .

# VS Code
# Install the "Live Server" extension and click "Go Live"
```
Then open `http://localhost:8000` in your browser.

**No environment variables, API keys, or database connections are required.**

---

## Access & Auth Model

LogicFlow uses a lightweight, frontend-only session model via `sessionStorage`. There is no real backend authentication — this is a frontend demonstration.

### Roles

| Role | How to activate | Nav behavior |
|---|---|---|
| `guest` | Click "Enter Lab → Guest access" | App nav shown, no tasks link |
| `student` | Submit email via institution login form | App nav + "My tasks" link shown |
| `faculty` | Submit institution code + email | App nav shown |
| (none) | Not entered yet | Landing/marketing nav shown |

Session data stored in `sessionStorage`:
- `logicflow_session` — role string (`guest`, `student`, `faculty`)
- `logicflow_student_email` — raw email (students only)
- `logicflow_student_display` — formatted display name derived from email

  for now the facality & department (institution) has fix credidential 
  - `institution code` — CHIT2026
  - `department detail` — faculty@chitkara.edu.in
  - `password` — CUFaculty

Sign-out clears all three keys and returns the nav to its marketing state.

---

## Navigation & Routing

All pages (except `index.html`) load `js/nav-shared.js` which handles:

1. **Experiments dropdown** — click-to-toggle with outside-click dismissal
2. **Active link highlighting** — compares `window.location.pathname` filename against nav href targets; highlights the matching link and the "Experiments" trigger if the current page is a sub-experiment
3. **Student nav item** — `#navTasksItem` is hidden unless `sessionStorage` role is `student`
4. **Sign out button** — visible only when any role is set; clears session on click

`index.html` uses its own nav logic in `js/index.js` with dual navbar switching (landing links ↔ app links) driven by auth state.

---

## Shared Infrastructure

### `css/global.css`
Defines:
- CSS custom properties for fonts (`--lf-font-body`, `--lf-font-display`, `--lf-font-mono`)
- Fixed nav offset (`--lf-main-padding-top`) so page content clears the floating pill navbar
- `.bg-mesh` + `.blob-*` animated background system
- Glass pill `nav` component with dropdown styles
- Responsive breakpoint (`max-width: 900px`) hiding nav links on mobile

### `js/nav-shared.js`
Shared across all non-landing pages. Skips execution on `nav.site-nav` (the landing page's nav variant).

---

## Curriculum Mapping

The Curriculum page (`curriculum.html` + `js/curriculum.js`) maps all 12 experiments to four Indian university syllabi:

| University | Code |
|---|---|
| Dr. APJ Abdul Kalam Technical University | AKTU |
| Visvesvaraya Technological University | VTU |
| Anna University, Chennai | Anna |
| University of Mumbai | Mumbai |

Each experiment entry shows: paper code, semester, unit/topic, and Course Outcome (CO). A progress bar indicates lab-record readiness (Aim, Circuit, Observations, Conclusion, Viva Q&A).

---

## Pages Reference

| File | Title | Description |
|---|---|---|
| `index.html` | LogicFlow | Hero landing with animated blob bg, floating electronic component icons, parallax mouse effect, binary particle field, access dialog |
| `curriculum.html` | Curriculum | University tab selector, experiment list with syllabus mapping, lab record legend |
| `sandbox.html` | Logic Gate Sandbox | Coming-soon placeholder with progress indicator |
| `coa.html` | COA Pipeline Stepper | 4-stage instruction pipeline visualization with register bank, flag register, program memory |
| `student-tasks.html` | My Tasks | Student dashboard with assignments, progress bars, quick-open links |
| `eval1.html` | Continuous Evaluation 1.1 | 5-question MCQ quiz covering Experiments 1–4 |
| `eval2.html` | Continuous Evaluation 1.2 | 5-question MCQ quiz covering Experiments 6–8 |
| `exp1_components.html` | Component Inspector | Catalog + inspector with SVG symbols and resistor calculator |
| `exp2_equipments.html` | Virtual CRO | Function generator + oscilloscope canvas simulation |
| `exp3_diode.html` | PN Junction Diode | Shockley equation V-I plotter with Q-point |
| `exp4_zener.html` | Zener Diode Regulator | KCL-based regulator circuit solver |
| `exp5_rectifier.html` | Rectifier Circuits | HW/FW rectifier with capacitor filter |
| `exp6_flipflops.html` | Flip-Flop Architecture | D and J-K flip-flops with timing diagram |
| `exp7_bcd_decoder.html` | BCD to 7-Segment | IC 7447 simulation with 7-segment display |

---

## Roadmap

### Future
- [ ] Backend integration for real student auth and gradebook sync
- [ ] Lab report PDF export (browser print is currently available for Exp 3)
- [ ] Mobile-optimized CRO canvas layout
- [ ] Dark mode variant
- [ ] Faculty dashboard with cohort analytics
- [ ] Shareable experiment configurations via URL parameters

---

## Contributing

LogicFlow is structured to make adding new experiments straightforward:

1. **Create** `expN_name.html` — copy the nav/page structure from an existing experiment
2. **Create** `css/expN_name.css` — follow the established CSS variable conventions
3. **Create** `js/expN_name.js` — implement simulation logic; add the `bgCanvas` guard at the top
4. **Add** the new experiment link to the dropdown in every page's `nav` and in `js/curriculum.js`'s `EXPERIMENTS` array with full university mapping
5. **Add** an `eval` question or two to `js/eval1.js` or `js/eval2.js` if appropriate

**Style rules to follow:**
- Use `var(--surface)` / `var(--border)` for all panel backgrounds and borders
- Fonts: `var(--font-display)` for headings, `var(--font-mono)` for labels/values, `var(--font-body)` for prose
- No external JS libraries beyond Chart.js (already loaded via CDN where needed)
- No build tools — plain HTML/CSS/JS files only

---

## License

This project is a frontend educational demonstration. All simulation physics and circuit models are implemented from first principles for educational accuracy. Chart.js is used under its MIT license.

---

*Built for the classroom — and beyond.*
