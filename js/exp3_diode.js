// ══════════════════════════════════════════════════════════════════════════════
//  LogicFlow — Exp 3: PN Junction Diode  (complete rewrite)
//  Modes:  [Wireless] single diode sim  |  [Wired] drag-drop sandbox
// ══════════════════════════════════════════════════════════════════════════════

// ── Physics constants ───────────────────────────────────────────────────────
const K_BOLTZMANN = 1.380649e-23;
const Q_ELECTRON  = 1.602176634e-19;
const IS_SILICON  = 1e-12;   // saturation current
const N_IDEAL     = 1.0;     // ideality factor

function safeSet(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function thermalVoltage(tempC) {
  return (K_BOLTZMANN * (tempC + 273.15)) / Q_ELECTRON;
}
function diodeCurrent(vd, tempC) {
  const vt = thermalVoltage(tempC);
  return IS_SILICON * (Math.exp(vd / (N_IDEAL * vt)) - 1);
}
function formatI(amps) {
  const a = Math.abs(amps);
  if (a < 1e-9)  return { v: '0.00', u: 'A' };
  if (a < 1e-6)  return { v: (amps*1e9).toFixed(2), u: 'nA' };
  if (a < 1e-3)  return { v: (amps*1e6).toFixed(2), u: 'µA' };
  return           { v: (amps*1e3).toFixed(3), u: 'mA' };
}

// ── Global state ─────────────────────────────────────────────────────────────
let activeMode   = 'wireless'; // 'wireless' | 'wired'
let biasMode     = 'forward';  // 'forward'  | 'reverse'
let temperature  = 25;
let acAmplitude  = 5;    // V peak
let acFrequency  = 50;   // Hz
let seriesR      = 100;  // Ω  (in wireless mode: series resistor)
let animFrameId  = null;
let viChart      = null;
let waveChart    = null;
let animTime     = 0;

// ── Wire sandbox state ────────────────────────────────────────────────────────
let sandboxDiodes = [];   // [{id, x, y, flipped, series}]
let nextDiodeId   = 1;
let dragging      = null; // {id, offX, offY}

// ══════════════════════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  buildViChart();
  buildWaveChart();
  initSliders();
  switchMode('wired'); // Start in wired mode to hide wireless elements
  startAnimation();
  
  // Initialize circuit builder for sandbox
  initCircuitBuilder();
  
  // Initialize press-and-hold eraser
  initEraser();
});

// ── Slider init ───────────────────────────────────────────────────────────────
function initSliders() {
  // Amplitude
  const sAmp = document.getElementById('sid-amp');
  if (sAmp) {
    sAmp.addEventListener('input', () => {
      acAmplitude = parseFloat(sAmp.value);
      const lbl = document.getElementById('lbl-amp');
      if (lbl) lbl.textContent = acAmplitude.toFixed(1) + ' Vp';
      updateAll();
    });
  }
  
  // Frequency
  const sFreq = document.getElementById('sid-freq');
  if (sFreq) {
    sFreq.addEventListener('input', () => {
      acFrequency = parseFloat(sFreq.value);
      const lbl = document.getElementById('lbl-freq');
      if (lbl) lbl.textContent = acFrequency + ' Hz';
      updateAll();
    });
  }
  
  // Temperature
  const sTemp = document.getElementById('sid-temp');
  if (sTemp) {
    sTemp.addEventListener('input', () => {
      temperature = parseInt(sTemp.value);
      const lbl = document.getElementById('lbl-temp');
      if (lbl) lbl.textContent = temperature + ' °C';
      updateAll();
    });
  }
  
  // Series R
  const sRes = document.getElementById('sid-res');
  if (sRes) {
    sRes.addEventListener('input', () => {
      seriesR = parseFloat(sRes.value);
      const lbl = document.getElementById('lbl-res');
      if (lbl) lbl.textContent = seriesR >= 1000 ? (seriesR/1000).toFixed(1)+'kΩ' : seriesR+'Ω';
      updateAll();
    });
  }

  // track fills
  function trackFill(el, colorVar) {
    if (!el) return;
    el.addEventListener('input', () => {
      const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
      el.style.background = `linear-gradient(to right, var(${colorVar}) ${pct}%, rgba(0,0,0,0.1) ${pct}%)`;
    });
    el.dispatchEvent(new Event('input'));
  }
  trackFill(sAmp,  '--rose');
  trackFill(sFreq, '--cyan');
  trackFill(sTemp, '--amber');
  trackFill(sRes,  '--green');
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODE SWITCH
// ══════════════════════════════════════════════════════════════════════════════
function switchMode(mode) {
  activeMode = mode;
  document.getElementById('btn-wireless').classList.toggle('active', mode === 'wireless');
  document.getElementById('btn-wired').classList.toggle('active', mode === 'wired');
  document.getElementById('panel-wireless').style.display = mode === 'wireless' ? '' : 'none';
  document.getElementById('panel-wired').style.display   = mode === 'wired'    ? '' : 'none';

  if (mode === 'wired') {
    if (circuitComponents.length === 0) initCircuitBuilder();
    renderCircuit();
  }
  updateAll();
}

// ══════════════════════════════════════════════════════════════════════════════
//  WIRELESS MODE — V-I curve + live circuit
// ══════════════════════════════════════════════════════════════════════════════
function setBias(mode) {
  biasMode = mode;
  document.getElementById('btn-fwd').classList.toggle('active', mode === 'forward');
  document.getElementById('btn-rev').classList.toggle('active', mode === 'reverse');
  updateAll();
}

function buildViChart() {
  const ctx = document.getElementById('viCanvas').getContext('2d');
  viChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'I–V Curve', data: [], borderColor: '#1A56DB', borderWidth: 2.5, pointRadius: 0, tension: 0.3, fill: false },
        { label: 'Q-point',   data: [], borderColor: '#F59E0B', backgroundColor: '#F59E0B', pointRadius: 8, pointHoverRadius: 10, showLine: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        titleColor: '#475569', bodyColor: '#0f0f1a',
        borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1,
        callbacks: { label: (i) => {
          const f = formatI(i.parsed.y / 1000);
          return `I = ${f.v} ${f.u}`;
        }}
      }},
      scales: {
        x: { type: 'linear',
             title: { display: true, text: 'Voltage (V)', color: '#475569', font: { family: 'JetBrains Mono', size: 10, weight: 600 }},
             ticks: { color: '#64748B', font: { family: 'JetBrains Mono', size: 9 }},
             grid: { color: 'rgba(0,0,0,0.05)' }, border: { color: 'rgba(0,0,0,0.1)' }},
        y: { title: { display: true, text: 'Current (mA)', color: '#475569', font: { family: 'JetBrains Mono', size: 10, weight: 600 }},
             ticks: { color: '#64748B', font: { family: 'JetBrains Mono', size: 9 }},
             grid: { color: 'rgba(0,0,0,0.05)' }, border: { color: 'rgba(0,0,0,0.1)' }}
      }
    }
  });
}

function buildWaveChart() {
  const ctx = document.getElementById('waveCanvas').getContext('2d');
  waveChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'Vin', data: [], borderColor: '#475569', borderWidth: 2, pointRadius: 0, tension: 0.4, borderDash: [6,3] },
        { label: 'Vout (across diode)', data: [], borderColor: '#1A56DB', borderWidth: 2.5, pointRadius: 0, tension: 0 },
        { label: 'I through diode', data: [], borderColor: '#10B981', borderWidth: 2, pointRadius: 0, tension: 0, yAxisID: 'y2' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: '#475569', font: { family: 'JetBrains Mono', size: 9 }, boxWidth: 14, padding: 12 }},
        tooltip: { enabled: false }
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Time (ms)', color: '#475569', font: { family: 'JetBrains Mono', size: 10, weight: 600 }},
             ticks: { color: '#64748B', font: { family: 'JetBrains Mono', size: 9 }},
             grid: { color: 'rgba(0,0,0,0.04)' }},
        y: { title: { display: true, text: 'Voltage (V)', color: '#475569', font: { family: 'JetBrains Mono', size: 9, weight: 600 }},
             ticks: { color: '#64748B', font: { family: 'JetBrains Mono', size: 9 }},
             grid: { color: 'rgba(0,0,0,0.04)' }},
        y2: { position: 'right', title: { display: true, text: 'Current (mA)', color: '#10B981', font: { family: 'JetBrains Mono', size: 9, weight: 600 }},
              ticks: { color: '#10B981', font: { family: 'JetBrains Mono', size: 9 }},
              grid: { display: false }}
      }
    }
  });
}

function updateAll() {
  if (activeMode === 'wireless') updateWireless();
  else updateSandboxReadings();
}

// solve V-I at a given Vs, R, temp
function solveCircuit(vs, r, tempC) {
  // Newton-Raphson to find Vd: (Vs - Vd)/R = Is*(exp(Vd/Vt)-1)
  const vt = thermalVoltage(tempC);
  let vd = vs > 0 ? 0.6 : 0;
  for (let iter = 0; iter < 80; iter++) {
    const f  =  IS_SILICON * (Math.exp(vd / (N_IDEAL * vt)) - 1) - (vs - vd) / r;
    const df =  IS_SILICON * Math.exp(vd / (N_IDEAL * vt)) / (N_IDEAL * vt) + 1 / r;
    const dv = f / df;
    vd -= dv;
    if (Math.abs(dv) < 1e-9) break;
  }
  const id = (vs - vd) / r;
  return { vd, id };
}

function updateWireless() {
  const isF = biasMode === 'forward';

  // ── I-V Curve ──
  const pts = [];
  const vMin = isF ? -0.5 : -3.0;
  const vMax = isF ?  1.2 :  0.5;
  const iMax = isF ?  150 :   20;
  const iMin = isF ?   -5 :   -5;

  for (let i = 0; i <= 300; i++) {
    const vs = vMin + (vMax - vMin) * i / 300;
    const { vd, id } = solveCircuit(vs, seriesR, temperature);
    const iMa = Math.min(Math.max(id * 1000, iMin), iMax);
    pts.push({ x: vs, y: iMa });
  }
  viChart.data.datasets[0].data = pts;

  // ── Q-point at AC peak ──
  const { vd: vdQ, id: idQ } = solveCircuit(isF ? acAmplitude : -acAmplitude, seriesR, temperature);
  const iMaQ = Math.min(Math.max(idQ * 1000, iMin), iMax);
  viChart.data.datasets[1].data = [{ x: vdQ, y: iMaQ }];

  viChart.options.scales.x.min = vMin;
  viChart.options.scales.x.max = vMax;
  viChart.options.scales.y.min = iMin;
  viChart.options.scales.y.max = iMax;
  viChart.update();

  // ── Waveform chart ──
  const T   = 1000 / acFrequency; // period in ms
  const steps = 400;
  const tMax  = 3 * T;
  const vinPts = [], voutPts = [], ioutPts = [];
  let peakId = 0, peakVd = 0;

  for (let i = 0; i <= steps; i++) {
    const t  = i * tMax / steps;
    const vs = acAmplitude * Math.sin(2 * Math.PI * (t / 1000) * acFrequency) * (isF ? 1 : -1);
    const { vd, id } = solveCircuit(vs, seriesR, temperature);
    const iMa = id * 1000;
    vinPts.push({ x: t, y: vs });
    voutPts.push({ x: t, y: vd });
    ioutPts.push({ x: t, y: iMa });
    if (Math.abs(iMa) > Math.abs(peakId)) { peakId = iMa; peakVd = vd; }
  }
  waveChart.data.datasets[0].data = vinPts;
  waveChart.data.datasets[1].data = voutPts;
  waveChart.data.datasets[2].data = ioutPts;
  waveChart.options.scales.x.max = tMax;
  waveChart.update();

  // ── Meter readouts ──
  const { vd: vdNow, id: idNow } = solveCircuit(acAmplitude * (isF ? 1 : -1), seriesR, temperature);
  const fi = formatI(idNow);

  // Ammeter (SVG label)
  const fiNow = formatI(idNow);
  safeSet('meter-ammeter', fiNow.v + ' ' + fiNow.u);
  // Voltmeter across diode (SVG label)
  safeSet('meter-voltmeter', vdNow.toFixed(3) + ' V');
  // Source voltage label (SVG)
  safeSet('meter-vs', (isF ? '+' : '-') + acAmplitude.toFixed(1) + ' V');
  // Thermal voltage (param table)
  safeSet('meter-vt', (thermalVoltage(temperature)*1000).toFixed(2) + ' mV');
  // Circuit R label
  safeSet('circuit-r-lbl', seriesR >= 1000 ? (seriesR/1000).toFixed(1)+'kΩ' : seriesR+'Ω');

  // Card meters
  safeSet('meter-ammeter-card', fiNow.v);
  safeSet('voltmeter-card', vdNow.toFixed(3));
  const amFill = document.getElementById('ammeter-fill');
  const voFill = document.getElementById('voltmeter-fill');
  if (amFill) amFill.style.width = Math.min(100, Math.abs(parseFloat(fiNow.v)) * (fiNow.u === 'mA' ? 1.5 : fiNow.u === 'µA' ? 0.02 : 0.001)) + '%';
  if (voFill) voFill.style.width = Math.min(100, Math.abs(vdNow) / 1.2 * 100) + '%';

  // Diode status
  updateDiodeStatus(vdNow, idNow, isF);

  // Update circuit SVG indicators
  updateCircuitSVG(vdNow, idNow, isF);
}

function updateDiodeStatus(vd, id, isForward) {
  const el = document.getElementById('diode-status');
  let label, color, bg, border;
  if (!isForward) {
    label = '⬅ REVERSE BIAS'; color = '#e11d48'; bg = 'rgba(244,63,94,0.08)'; border = 'rgba(244,63,94,0.3)';
  } else if (vd < 0.3) {
    label = '⬜ CUT-OFF'; color = '#64748b'; bg = 'rgba(100,116,139,0.08)'; border = 'rgba(100,116,139,0.2)';
  } else if (vd < 0.65) {
    label = '🔶 NEAR THRESHOLD'; color = '#d97706'; bg = 'rgba(245,158,11,0.08)'; border = 'rgba(245,158,11,0.3)';
  } else {
    label = '✅ CONDUCTING'; color = '#059669'; bg = 'rgba(16,185,129,0.08)'; border = 'rgba(16,185,129,0.3)';
  }
  el.textContent = label;
  el.style.color = color;
  const card = document.getElementById('status-card');
  card.style.background = bg;
  card.style.borderColor = border;
}

// ── Animated circuit drawing ─────────────────────────────────────────────────
let svgAnimPhase = 0;
function startAnimation() {
  cancelAnimationFrame(animFrameId);
  function tick() {
    svgAnimPhase += 0.04;
    animTime += 0.016;
    updateCircuitAnimation();
    animFrameId = requestAnimationFrame(tick);
  }
  tick();
}

function updateCircuitAnimation() {
  if (activeMode !== 'wireless') return;
  const isF = biasMode === 'forward';
  const { vd, id } = solveCircuit(acAmplitude * Math.sin(svgAnimPhase) * (isF ? 1 : -1), seriesR, temperature);
  const conducting = id > 1e-6;
  const intensity  = Math.min(1, id * seriesR / acAmplitude);

  // Animate current dots in SVG
  const dots = document.querySelectorAll('.current-dot');
  dots.forEach((dot, i) => {
    if (conducting && isF) {
      const t = ((svgAnimPhase * 0.6 + i * 0.33) % 1 + 1) % 1;
      dot.style.opacity = '1';
      // path along circuit: from AC+ → R → D → back
      const progress = t;
      // Simple linear interpolation along the circuit path
      dot.setAttribute('cx', lerpPath(progress, 'x'));
      dot.setAttribute('cy', lerpPath(progress, 'y'));
    } else {
      dot.style.opacity = '0';
    }
  });

  // Diode glow
  const diodeBody = document.getElementById('svg-diode-body');
  if (diodeBody) {
    const glow = conducting ? `drop-shadow(0 0 ${6 * intensity}px #1A56DB)` : 'none';
    diodeBody.style.filter = glow;
    diodeBody.style.fill = conducting ? `rgba(26,86,219,${0.3 + 0.5*intensity})` : 'rgba(26,86,219,0.15)';
  }

  // Ammeter needle glow
  const amEl = document.getElementById('ammeter-glow');
  if (amEl) amEl.setAttribute('r', conducting ? (3 + 3*intensity).toFixed(1) : '0');

  // AC Generator wave indicator
  const genWave = document.getElementById('gen-wave-phase');
  if (genWave) {
    const sinVal = Math.sin(svgAnimPhase);
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const x = 8 + i * 1.6;
      const y = 12 - sinVal * Math.sin(i * Math.PI / 5) * 5;
      pts.push(`${x},${y}`);
    }
    genWave.setAttribute('points', pts.join(' '));
  }
}

// Simple path waypoints for current dot animation (matching SVG coordinates)
const PATH_WAYPOINTS = [
  {x:80, y:85}, {x:155, y:85}, {x:180, y:85}, {x:205, y:85}, // from generator through resistor
  {x:265, y:85}, {x:292, y:85}, {x:320, y:85}, {x:390, y:85}, // through diode
  {x:440, y:85}, {x:480, y:85}, {x:480, y:127}, // to ammeter and down
  {x:480, y:170}, {x:400, y:170}, {x:300, y:170}, {x:200, y:170}, {x:100, y:170}, {x:80, y:170} // return path
];
function lerpPath(t, axis) {
  const n = PATH_WAYPOINTS.length;
  const scaled = t * (n - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = PATH_WAYPOINTS[Math.min(i,   n-1)][axis];
  const b = PATH_WAYPOINTS[Math.min(i+1, n-1)][axis];
  return a + (b - a) * f;
}

function updateCircuitSVG(vd, id, isF) {
  // just a hook for static updates if needed
}

// ── Interactive Circuit Controls ─────────────────────────────────────────────────
let generatorPower = true;
let resistanceIndex = 2; // 100Ω index in [10, 50, 100, 500, 1000, 5000]

const resistanceValues = [10, 50, 100, 500, 1000, 5000];

function toggleGeneratorPower() {
  generatorPower = !generatorPower;
  const gen = document.getElementById('wireless-generator');
  const wave = document.getElementById('gen-wave-phase');
  
  if (generatorPower) {
    gen.style.opacity = '1';
    wave.style.stroke = '#1A56DB';
    acAmplitude = 5; // restore amplitude
  } else {
    gen.style.opacity = '0.5';
    wave.style.stroke = '#64748b';
    acAmplitude = 0; // no signal
  }
  
  // Update amplitude slider
  const sAmp = document.getElementById('sid-amp');
  if (sAmp) {
    sAmp.value = acAmplitude;
    const lbl = document.getElementById('lbl-amp');
    if (lbl) lbl.textContent = acAmplitude.toFixed(1) + ' Vp';
  }
  
  updateAll();
}

function changeResistance() {
  resistanceIndex = (resistanceIndex + 1) % resistanceValues.length;
  seriesR = resistanceValues[resistanceIndex];
  
  // Update slider
  const sRes = document.getElementById('sid-res');
  if (sRes) {
    sRes.value = seriesR;
    const lbl = document.getElementById('lbl-res');
    if (lbl) lbl.textContent = seriesR >= 1000 ? (seriesR/1000).toFixed(1)+'kΩ' : seriesR+'Ω';
  }
  
  // Update circuit display
  const rLbl = document.getElementById('circuit-r-lbl');
  if (rLbl) {
    rLbl.textContent = seriesR >= 1000 ? (seriesR/1000).toFixed(1)+'kΩ' : seriesR+'Ω';
  }
  
  updateAll();
}

function toggleDiodeBias() {
  // Switch between forward and reverse bias
  biasMode = biasMode === 'forward' ? 'reverse' : 'forward';
  
  // Update bias buttons
  document.getElementById('btn-fwd').classList.toggle('active', biasMode === 'forward');
  document.getElementById('btn-rev').classList.toggle('active', biasMode === 'reverse');
  
  // Update diode visual
  const diodeBody = document.getElementById('svg-diode-body');
  if (diodeBody) {
    if (biasMode === 'reverse') {
      // Flip the diode symbol for reverse bias visualization
      diodeBody.setAttribute('points', '295,71 295,99 265,85');
    } else {
      diodeBody.setAttribute('points', '265,71 265,99 295,85');
    }
  }
  
  updateAll();
}


// ══════════════════════════════════════════════════════════════════════════════
//  MANUAL CIRCUIT BUILDER
// ══════════════════════════════════════════════════════════════════════════════
let circuitComponents = [];
let nextComponentId = 1;
let draggedComponent = null;
let selectedComponent = null;
let wireStartPoint = null;
let connections = [];

// Component templates
const componentTemplates = {
  generator: {
    type: 'generator',
    width: 60,
    height: 60,
    connections: [{x: 30, y: 10, side: 'top'}, {x: 30, y: 50, side: 'bottom'}],
    svg: (x, y) => `
      <g transform="translate(${x}, ${y})" class="component-on-canvas" data-id="">
        <circle cx="30" cy="30" r="25" fill="rgba(26,86,219,0.1)" stroke="#1A56DB" stroke-width="2"/>
        <text x="30" y="25" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="#1A56DB" font-weight="700">AC</text>
        <text x="30" y="35" text-anchor="middle" font-family="JetBrains Mono" font-size="6" fill="#1A56DB">GEN</text>
        <circle cx="30" cy="10" r="4" class="connection-point" data-side="top"/>
        <circle cx="30" cy="50" r="4" class="connection-point" data-side="bottom"/>
      </g>
    `
  },
  resistor: {
    type: 'resistor',
    width: 60,
    height: 30,
    connections: [{x: 0, y: 15, side: 'left'}, {x: 60, y: 15, side: 'right'}],
    svg: (x, y) => `
      <g transform="translate(${x}, ${y})" class="component-on-canvas" data-id="">
        <rect x="0" y="10" width="60" height="10" rx="2" fill="#0f172a" stroke="#F59E0B" stroke-width="2"/>
        <polyline points="5,15 10,8 15,22 20,8 25,22 30,8 35,22 40,8 45,22 50,8 55,15" fill="none" stroke="#F59E0B" stroke-width="1.5"/>
        <circle cx="0" cy="15" r="4" class="connection-point" data-side="left"/>
        <circle cx="60" cy="15" r="4" class="connection-point" data-side="right"/>
      </g>
    `
  },
  diode: {
    type: 'diode',
    width: 50,
    height: 40,
    connections: [{x: 0, y: 20, side: 'left'}, {x: 50, y: 20, side: 'right'}],
    svg: (x, y) => `
      <g transform="translate(${x}, ${y})" class="component-on-canvas" data-id="">
        <polygon points="15,10 15,30 30,20" fill="rgba(26,86,219,0.25)" stroke="#1A56DB" stroke-width="2"/>
        <line x1="30" y1="10" x2="30" y2="30" stroke="#1A56DB" stroke-width="3"/>
        <line x1="0" y1="20" x2="15" y2="20" stroke="#1A56DB" stroke-width="2"/>
        <line x1="30" y1="20" x2="50" y2="20" stroke="#1A56DB" stroke-width="2"/>
        <circle cx="0" cy="20" r="4" class="connection-point" data-side="left"/>
        <circle cx="50" cy="20" r="4" class="connection-point" data-side="right"/>
      </g>
    `
  },
  ammeter: {
    type: 'ammeter',
    width: 50,
    height: 50,
    connections: [{x: 0, y: 25, side: 'left'}, {x: 50, y: 25, side: 'right'}],
    svg: (x, y) => `
      <g transform="translate(${x}, ${y})" class="component-on-canvas" data-id="">
        <circle cx="25" cy="25" r="20" fill="rgba(16,185,129,0.1)" stroke="#10B981" stroke-width="2"/>
        <text x="25" y="30" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#10B981" font-weight="700">A</text>
        <circle cx="0" cy="25" r="4" class="connection-point" data-side="left"/>
        <circle cx="50" cy="25" r="4" class="connection-point" data-side="right"/>
      </g>
    `
  },
  voltmeter: {
    type: 'voltmeter',
    width: 40,
    height: 50,
    connections: [{x: 20, y: 0, side: 'top'}, {x: 20, y: 50, side: 'bottom'}],
    svg: (x, y) => `
      <g transform="translate(${x}, ${y})" class="component-on-canvas" data-id="">
        <rect x="5" y="10" width="30" height="30" rx="4" fill="rgba(245,158,11,0.1)" stroke="#F59E0B" stroke-width="2"/>
        <text x="20" y="30" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#F59E0B" font-weight="700">V</text>
        <circle cx="20" cy="0" r="4" class="connection-point" data-side="top"/>
        <circle cx="20" cy="50" r="4" class="connection-point" data-side="bottom"/>
      </g>
    `
  },
  ground: {
    type: 'ground',
    width: 40,
    height: 40,
    connections: [{x: 20, y: 0, side: 'top'}],
    svg: (x, y) => `
      <g transform="translate(${x}, ${y})" class="component-on-canvas" data-id="">
        <line x1="20" y1="0" x2="20" y2="15" stroke="#334155" stroke-width="3"/>
        <line x1="10" y1="20" x2="30" y2="20" stroke="#334155" stroke-width="2"/>
        <line x1="13" y1="25" x2="27" y2="25" stroke="#334155" stroke-width="2"/>
        <line x1="16" y1="30" x2="24" y2="30" stroke="#334155" stroke-width="2"/>
        <circle cx="20" cy="0" r="4" class="connection-point" data-side="top"/>
      </g>
    `
  }
};

// Initialize circuit builder
function initCircuitBuilder() {
  setupDragAndDrop();
  setupCanvasEvents();
}

// Setup drag and drop from palette
function setupDragAndDrop() {
  const componentItems = document.querySelectorAll('.component-item');
  
  componentItems.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedComponent = item.dataset.component;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
  });
}

// Setup canvas events
function setupCanvasEvents() {
  const canvas = document.getElementById('circuit-canvas');
  
  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    canvas.classList.add('drop-zone');
  });
  
  canvas.addEventListener('dragleave', () => {
    canvas.classList.remove('drop-zone');
  });
  
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.classList.remove('drop-zone');
    
    if (draggedComponent) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (800 / rect.width);
      const y = (e.clientY - rect.top) * (400 / rect.height);
      
      addComponentToCanvas(draggedComponent, x, y);
      draggedComponent = null;
    }
  });
}

// Add component to canvas
function addComponentToCanvas(type, x, y) {
  const template = componentTemplates[type];
  if (!template) return;
  
  const component = {
    id: nextComponentId++,
    type: type,
    x: x - template.width / 2,
    y: y - template.height / 2,
    rotation: 0,
    flipped: false
  };
  
  circuitComponents.push(component);
  renderCircuit();
}

// Render circuit
function renderCircuit() {
  const canvas = document.getElementById('circuit-canvas');
  let svgContent = `
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="800" height="400" fill="url(#grid)"/>
  `;
  
  // Render components
  circuitComponents.forEach(component => {
    const template = componentTemplates[component.type];
    if (template) {
      svgContent += template.svg(component.x, component.y).replace('data-id=""', `data-id="${component.id}"`);
    }
  });
  
  // Render connections
  connections.forEach((conn, index) => {
    console.log(`Rendering wire ${index}:`, conn);
    svgContent += `<line x1="${conn.x1}" y1="${conn.y1}" x2="${conn.x2}" y2="${conn.y2}" stroke="#F59E0B" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  });
  
  canvas.innerHTML = svgContent;
  
  // Add event listeners to components
  addComponentEventListeners();
}

// Add event listeners to components
function addComponentEventListeners() {
  const canvas = document.getElementById('circuit-canvas');
  const components = canvas.querySelectorAll('.component-on-canvas');
  
  console.log('Setting up event listeners for', components.length, 'components');
  
  components.forEach(comp => {
    // Make component group interactive
    comp.style.pointerEvents = 'auto';
    comp.style.cursor = 'move';
    
    // Component dragging
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    
    comp.addEventListener('mousedown', (e) => {
      if (e.button === 2) { // Right click
        e.preventDefault();
        console.log('Right-click on component');
        deleteComponent(comp);
        return;
      }
      
      if (e.button === 0) { // Left click - start dragging
        e.preventDefault();
        isDragging = true;
        
        const rect = canvas.getBoundingClientRect();
        const transform = comp.getAttribute('transform');
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)/);
        const currentX = match ? parseFloat(match[1]) : 0;
        const currentY = match ? parseFloat(match[2]) : 0;
        
        dragOffset.x = (e.clientX - rect.left) * (800 / rect.width) - currentX;
        dragOffset.y = (e.clientY - rect.top) * (400 / rect.height) - currentY;
        
        comp.style.opacity = '0.7';
      }
    });
    
    // Global mouse events for dragging
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (800 / rect.width) - dragOffset.x;
      const y = (e.clientY - rect.top) * (400 / rect.height) - dragOffset.y;
      
      // Update component position
      const componentId = comp.getAttribute('data-id');
      const component = circuitComponents.find(c => c.id == componentId);
      if (component) {
        component.x = Math.max(0, Math.min(750, x));
        component.y = Math.max(0, Math.min(350, y));
        
        // Update transform
        comp.setAttribute('transform', `translate(${component.x}, ${component.y})`);
        
        // Update connections
        updateConnectionsForComponent(component);
      }
    };
    
    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        comp.style.opacity = '1';
        
        // Re-render to clean up
        renderCircuit();
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Add hover effect
    comp.addEventListener('mouseenter', () => {
      if (!isDragging) {
        comp.style.filter = 'brightness(1.2)';
      }
    });
    
    comp.addEventListener('mouseleave', () => {
      if (!isDragging) {
        comp.style.filter = 'brightness(1)';
      }
    });
    
    // Add connection point listeners
    const points = comp.querySelectorAll('.connection-point');
    console.log('Found connection points:', points.length);
    points.forEach(point => {
      // Make connection points interactive
      point.style.pointerEvents = 'auto';
      point.style.cursor = 'pointer';
      
      point.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Connection point clicked!');
        handleConnectionPoint(comp, point);
      });
      
      // Add hover effect for connection points
      point.addEventListener('mouseenter', () => {
        if (!wireStartPoint || wireStartPoint.point !== point) {
          point.setAttribute('r', '6');
        }
      });
      
      point.addEventListener('mouseleave', () => {
        if (!wireStartPoint || wireStartPoint.point !== point) {
          point.setAttribute('r', '4');
        }
      });
    });
  });
  
  // Prevent context menu on canvas
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
}

// Update connections when component moves
function updateConnectionsForComponent(movedComponent) {
  const template = componentTemplates[movedComponent.type];
  if (!template) return;
  
  connections.forEach(conn => {
    // Check if connection starts or ends at this component
    const connStartX = movedComponent.x + template.connections[0]?.x || 0;
    const connStartY = movedComponent.y + template.connections[0]?.y || 0;
    const connEndX = movedComponent.x + template.connections[1]?.x || 0;
    const connEndY = movedComponent.y + template.connections[1]?.y || 0;
    
    // Update if connection matches old position (within tolerance)
    if (Math.abs(conn.x1 - connStartX) < 10 && Math.abs(conn.y1 - connStartY) < 10) {
      conn.x1 = connStartX;
      conn.y1 = connStartY;
    }
    if (Math.abs(conn.x2 - connEndX) < 10 && Math.abs(conn.y2 - connEndY) < 10) {
      conn.x2 = connEndX;
      conn.y2 = connEndY;
    }
  });
}


// Handle connection point clicks
function handleConnectionPoint(component, point) {
  console.log('Connection point clicked:', component, point);
  
  if (!wireStartPoint) {
    // Start wire
    const transform = component.getAttribute('transform');
    const match = transform.match(/translate\(([^,]+),\s*([^)]+)/);
    const translateX = match ? parseFloat(match[1]) : 0;
    const translateY = match ? parseFloat(match[2]) : 0;
    
    const pointX = parseFloat(point.getAttribute('cx'));
    const pointY = parseFloat(point.getAttribute('cy'));
    
    wireStartPoint = {
      component: component,
      point: point,
      x: pointX + translateX,
      y: pointY + translateY
    };
    
    // Visual feedback
    point.style.fill = '#10B981';
    point.setAttribute('r', '6');
    console.log('Wire started at:', wireStartPoint.x, wireStartPoint.y);
    
  } else {
    // Complete wire
    const transform = component.getAttribute('transform');
    const match = transform.match(/translate\(([^,]+),\s*([^)]+)/);
    const translateX = match ? parseFloat(match[1]) : 0;
    const translateY = match ? parseFloat(match[2]) : 0;
    
    const pointX = parseFloat(point.getAttribute('cx'));
    const pointY = parseFloat(point.getAttribute('cy'));
    const x = pointX + translateX;
    const y = pointY + translateY;
    
    console.log('Attempting to complete wire from:', wireStartPoint.x, wireStartPoint.y, 'to:', x, y);
    
    // Check if connecting to same point
    if (Math.abs(wireStartPoint.x - x) < 5 && Math.abs(wireStartPoint.y - y) < 5) {
      console.log('Cancelling - same point connection');
      // Cancel connection
      wireStartPoint.point.style.fill = '#1A56DB';
      wireStartPoint.point.setAttribute('r', '4');
      wireStartPoint = null;
      return;
    }
    
    connections.push({
      x1: wireStartPoint.x,
      y1: wireStartPoint.y,
      x2: x,
      y2: y
    });
    
    console.log('Wire completed. Total connections:', connections.length);
    
    // Reset
    wireStartPoint.point.style.fill = '#1A56DB';
    wireStartPoint.point.setAttribute('r', '4');
    wireStartPoint = null;
    
    renderCircuit();
  }
}

// Simplified event listener setup
function addComponentEventListeners() {
  const canvas = document.getElementById('circuit-canvas');
  
  // Clear previous event listeners
  canvas.innerHTML = canvas.innerHTML; // This removes all event listeners
  
  // Add canvas-wide right-click handler
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const target = e.target;
    
    // Find if right-clicked on a component
    const componentGroup = target.closest('.component-on-canvas');
    if (componentGroup) {
      console.log('Right-click on component detected');
      const componentId = componentGroup.getAttribute('data-id');
      deleteComponentById(componentId);
    }
  });
  
  // Set up connection point listeners
  const allComponents = canvas.querySelectorAll('.component-on-canvas');
  allComponents.forEach(comp => {
    const points = comp.querySelectorAll('.connection-point');
    points.forEach(point => {
      point.style.cursor = 'pointer';
      point.style.pointerEvents = 'auto';
      
      point.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Connection point clicked!');
        handleConnectionPoint(comp, point);
      });
      
      point.addEventListener('mouseenter', () => {
        if (!wireStartPoint || wireStartPoint.point !== point) {
          point.setAttribute('r', '6');
        }
      });
      
      point.addEventListener('mouseleave', () => {
        if (!wireStartPoint || wireStartPoint.point !== point) {
          point.setAttribute('r', '4');
        }
      });
    });
  });
}

// Delete component by ID
function deleteComponentById(componentId) {
  circuitComponents = circuitComponents.filter(c => c.id != componentId);
  
  // Remove connections to this component
  connections = connections.filter(conn => {
    const comp1 = findComponentAtPosition(conn.x1, conn.y1);
    const comp2 = findComponentAtPosition(conn.x2, conn.y2);
    return (!comp1 || comp1.id != componentId) && (!comp2 || comp2.id != componentId);
  });
  
  renderCircuit();
  updateCircuitReadings();
}

// ══════════════════════════════════════════════════════════════
//  PRESS-AND-HOLD ERASER FOR WIRE REMOVAL
// ══════════════════════════════════════════════════════════════
let isErasing = false;
let eraserTimer = null;
let eraserCursor = null;

function initEraser() {
  // Create eraser cursor element
  eraserCursor = document.createElement('div');
  eraserCursor.style.cssText = `
    position: fixed;
    width: 30px;
    height: 30px;
    border: 2px solid #ef4444;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.1));
    pointer-events: none;
    z-index: 10000;
    display: none;
    transform: translate(-50%, -50%);
    transition: all 0.1s ease;
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
  `;
  document.body.appendChild(eraserCursor);

  // Add mouse down listener for eraser activation
  document.addEventListener('mousedown', handleEraserStart);
  document.addEventListener('mouseup', handleEraserEnd);
  document.addEventListener('mousemove', handleEraserMove);
  document.addEventListener('click', handleEraserClick);
  
  // Prevent context menu during eraser mode
  document.addEventListener('contextmenu', (e) => {
    if (isErasing) {
      e.preventDefault();
    }
  });
}

function handleEraserStart(e) {
  console.log('Mouse down detected, button:', e.button, 'target:', e.target);
  
  // Only activate eraser on left click (button 0) and not on input elements
  if (e.button !== 0 || e.target.closest('input, button, select, textarea')) {
    console.log('Not left click or on input element, ignoring');
    return;
  }
  
  // Don't activate eraser if dragging components from palette
  if (e.target.closest('.component-item')) {
    console.log('Clicking on component item, ignoring');
    return;
  }
  
  // Don't activate eraser if currently dragging a component on canvas
  if (draggedComponent) {
    console.log('Currently dragging component, ignoring');
    return;
  }
  
  console.log('Starting eraser timer...');
  
  // Start timer for long press (500ms for better responsiveness)
  eraserTimer = setTimeout(() => {
    // Double check we're not dragging now
    if (draggedComponent) {
      console.log('Still dragging component, cancelling eraser');
      return;
    }
    
    console.log('Eraser timer completed, activating eraser');
    isErasing = true;
    eraserCursor.style.display = 'block';
    document.body.style.cursor = 'none';
    document.body.style.userSelect = 'none';
    
    // Show eraser hint
    const hint = document.getElementById('circuit-readings');
    if (hint) {
      hint.innerHTML = '<p style="color:#ef4444;font-size:.8rem">🧹 Eraser active - click elements to delete them</p>';
    }
    
    console.log('Eraser activated successfully');
  }, 500);
}

function handleEraserEnd(e) {
  // Clear timer if eraser wasn't activated
  if (eraserTimer) {
    clearTimeout(eraserTimer);
    eraserTimer = null;
  }
  
  if (isErasing) {
    isErasing = false;
    eraserCursor.style.display = 'none';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Restore hint
    const hint = document.getElementById('circuit-readings');
    if (hint) {
      hint.innerHTML = '<p style="color:var(--muted);font-size:.8rem">Build a circuit and click "Run Sim" to analyze</p>';
    }
  }
}

function handleEraserMove(e) {
  if (!isErasing) return;
  
  // Update eraser cursor position
  eraserCursor.style.left = e.clientX + 'px';
  eraserCursor.style.top = e.clientY + 'px';
  
  // Check if hovering over erasable element
  const elements = document.elementsFromPoint(e.clientX, e.clientY);
  const hasErasable = elements.some(el => 
    el.tagName === 'line' || 
    el.classList.contains('connection-point') || 
    el.closest('.component-on-canvas')
  );
  
  // Change cursor color based on hover state
  if (hasErasable) {
    eraserCursor.style.borderColor = '#dc2626';
    eraserCursor.style.transform = 'translate(-50%, -50%) scale(1.1)';
  } else {
    eraserCursor.style.borderColor = '#ef4444';
    eraserCursor.style.transform = 'translate(-50%, -50%) scale(1)';
  }
}

function handleEraserClick(e) {
  console.log('Eraser click detected, isErasing:', isErasing);
  
  if (!isErasing) {
    console.log('Eraser not active, ignoring click');
    return;
  }
  
  // Check for elements to erase at current position
  const elements = document.elementsFromPoint(e.clientX, e.clientY);
  console.log('Elements at click position:', elements);
  
  for (const element of elements) {
    console.log('Checking element:', element.tagName, element);
    
    // Erase wire lines
    if (element.tagName === 'line') {
      console.log('Found wire line, erasing it');
      eraseWireElement(element);
      break;
    }
    
    // Erase connection points (will remove the wire)
    const connectionPoint = element.closest('.connection-point');
    if (connectionPoint) {
      console.log('Found connection point, erasing it');
      eraseConnectionPoint(connectionPoint);
      break;
    }
    
    // Erase components
    const component = element.closest('.component-on-canvas');
    if (component) {
      console.log('Found component, erasing it');
      const componentId = component.getAttribute('data-id');
      deleteComponentById(componentId);
      break;
    }
  }
  
  console.log('No erasable element found at click position');
}

function eraseWireElement(wireElement) {
  // Get wire coordinates
  const x1 = parseFloat(wireElement.getAttribute('x1'));
  const y1 = parseFloat(wireElement.getAttribute('y1'));
  const x2 = parseFloat(wireElement.getAttribute('x2'));
  const y2 = parseFloat(wireElement.getAttribute('y2'));
  
  console.log('Erasing wire:', x1, y1, x2, y2);
  
  // Remove from connections array using approximate matching
  const initialLength = connections.length;
  connections = connections.filter(conn => {
    const tolerance = 1.0;
    const match1 = Math.abs(conn.x1 - x1) < tolerance && Math.abs(conn.y1 - y1) < tolerance && 
                  Math.abs(conn.x2 - x2) < tolerance && Math.abs(conn.y2 - y2) < tolerance;
    const match2 = Math.abs(conn.x1 - x2) < tolerance && Math.abs(conn.y1 - y2) < tolerance && 
                  Math.abs(conn.x2 - x1) < tolerance && Math.abs(conn.y2 - y1) < tolerance;
    
    if (match1 || match2) {
      console.log('Found matching connection to remove:', conn);
    }
    
    return !match1 && !match2;
  });
  
  console.log('Connections before:', initialLength, 'after:', connections.length);
  
  // Visual feedback - fade out the wire
  wireElement.style.opacity = '0';
  wireElement.style.transition = 'opacity 0.2s';
  
  // Re-render circuit to update the display
  setTimeout(() => {
    renderCircuit();
    updateCanvasInfo();
  }, 200);
}

function updateCanvasInfo() {
  const componentCount = document.getElementById('component-count');
  const connectionCount = document.getElementById('connection-count');
  
  if (componentCount) {
    componentCount.textContent = `${circuitComponents.length} components`;
  }
  if (connectionCount) {
    connectionCount.textContent = `${connections.length} connections`;
  }
}

function eraseConnectionPoint(connectionPoint) {
  // Find the position of this connection point
  const component = connectionPoint.closest('.component-on-canvas');
  if (!component) return;
  
  const transform = component.getAttribute('transform');
  const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
  if (!match) return;
  
  const translateX = parseFloat(match[1]);
  const translateY = parseFloat(match[2]);
  const side = connectionPoint.getAttribute('data-side');
  
  let pointX, pointY;
  if (side === 'left') {
    pointX = 0;
    pointY = 15;
  } else if (side === 'right') {
    pointX = 60;
    pointY = 15;
  } else if (side === 'top') {
    pointX = 30;
    pointY = 0;
  } else if (side === 'bottom') {
    pointX = 30;
    pointY = 50;
  }
  
  const x = pointX + translateX;
  const y = pointY + translateY;
  
  // Remove connections connected to this point
  connections = connections.filter(conn => {
    return !(conn.x1 === x && conn.y1 === y) && !(conn.x2 === x && conn.y2 === y);
  });
  
  // Visual feedback
  connectionPoint.style.fill = '#ef4444';
  connectionPoint.style.transition = 'fill 0.2s';
  
  // Re-render circuit
  setTimeout(() => {
    renderCircuit();
  }, 200);
}


// Build example circuits
function buildExampleCircuit(type) {
  clearCanvas();
  
  switch(type) {
    case 'simple-diode':
      // Simple diode circuit: Generator -> Resistor -> Diode -> Ground
      addComponentToCanvas('generator', 150, 200);
      addComponentToCanvas('resistor', 250, 200);
      addComponentToCanvas('diode', 350, 200);
      addComponentToCanvas('ground', 350, 280);
      
      // Add connections
      setTimeout(() => {
        connections = [
          {x1: 180, y1: 170, x2: 250, y2: 200}, // Generator top to Resistor left
          {x1: 310, y1: 200, x2: 350, y2: 200}, // Resistor right to Diode left
          {x1: 400, y1: 200, x2: 370, y2: 280}, // Diode right to Ground
          {x1: 180, y1: 230, x2: 370, y2: 280}  // Generator bottom to Ground
        ];
        renderCircuit();
        updateCircuitReadings();
      }, 100);
      break;
      
    case 'rectifier':
      // Half-wave rectifier: Generator -> Diode -> Resistor -> Ground
      addComponentToCanvas('generator', 150, 200);
      addComponentToCanvas('diode', 250, 200);
      addComponentToCanvas('resistor', 350, 200);
      addComponentToCanvas('ground', 350, 280);
      
      setTimeout(() => {
        connections = [
          {x1: 180, y1: 170, x2: 250, y2: 200}, // Generator top to Diode left
          {x1: 300, y1: 200, x2: 350, y2: 200}, // Diode right to Resistor left
          {x1: 410, y1: 200, x2: 370, y2: 280}, // Resistor right to Ground
          {x1: 180, y1: 230, x2: 370, y2: 280}  // Generator bottom to Ground
        ];
        renderCircuit();
        updateCircuitReadings();
      }, 100);
      break;
      
    case 'voltage-divider':
      // Voltage divider: Generator -> R1 -> R2 -> Ground
      addComponentToCanvas('generator', 150, 200);
      addComponentToCanvas('resistor', 250, 150);
      addComponentToCanvas('resistor', 250, 250);
      addComponentToCanvas('ground', 250, 320);
      
      setTimeout(() => {
        connections = [
          {x1: 180, y1: 170, x2: 250, y2: 150}, // Generator top to R1 left
          {x1: 310, y1: 150, x2: 310, y2: 250}, // R1 right to R2 right
          {x1: 250, y1: 280, x2: 270, y2: 320}, // R2 bottom to Ground
          {x1: 180, y1: 230, x2: 270, y2: 320}  // Generator bottom to Ground
        ];
        renderCircuit();
        updateCircuitReadings();
      }, 100);
      break;
      
    case 'series-diodes':
      // Series diodes: Generator -> D1 -> D2 -> D3 -> Resistor -> Ground
      addComponentToCanvas('generator', 120, 200);
      addComponentToCanvas('diode', 200, 200);
      addComponentToCanvas('diode', 280, 200);
      addComponentToCanvas('diode', 360, 200);
      addComponentToCanvas('resistor', 440, 200);
      addComponentToCanvas('ground', 440, 280);
      
      setTimeout(() => {
        connections = [
          {x1: 150, y1: 170, x2: 200, y2: 200}, // Generator to D1
          {x1: 250, y1: 200, x2: 280, y2: 200}, // D1 to D2
          {x1: 330, y1: 200, x2: 360, y2: 200}, // D2 to D3
          {x1: 410, y1: 200, x2: 440, y2: 200}, // D3 to Resistor
          {x1: 500, y1: 200, x2: 460, y2: 280}, // Resistor to Ground
          {x1: 150, y1: 230, x2: 460, y2: 280}  // Generator to Ground
        ];
        renderCircuit();
        updateCircuitReadings();
      }, 100);
      break;
  }
}

// Clear canvas
function clearCanvas() {
  circuitComponents = [];
  connections = [];
  wireStartPoint = null;
  renderCircuit();
  updateCircuitReadings();
}

// Run simulation - Real circuit analysis
function runSimulation() {
  console.log('=== Running Circuit Simulation ===');
  
  if (circuitComponents.length === 0) {
    updateCircuitReadings();
    return;
  }
  
  // Analyze circuit topology
  const analysis = analyzeCircuit();
  const readings = calculateCircuitValues(analysis);
  
  // Update display with realistic values
  displayCircuitAnalysis(analysis, readings);
}

// Analyze circuit topology
function analyzeCircuit() {
  const generators = circuitComponents.filter(c => c.type === 'generator');
  const resistors = circuitComponents.filter(c => c.type === 'resistor');
  const diodes = circuitComponents.filter(c => c.type === 'diode');
  const ammeters = circuitComponents.filter(c => c.type === 'ammeter');
  const voltmeters = circuitComponents.filter(c => c.type === 'voltmeter');
  const grounds = circuitComponents.filter(c => c.type === 'ground');
  
  // Check if circuit is complete
  const hasPower = generators.length > 0;
  const hasGround = grounds.length > 0;
  const hasLoad = resistors.length > 0 || diodes.length > 0;
  
  // Check if components are connected
  const connectedComponents = findConnectedComponents();
  
  return {
    hasPower,
    hasGround,
    hasLoad,
    isComplete: hasPower && hasGround && hasLoad,
    connectedComponents,
    generators,
    resistors,
    diodes,
    ammeters,
    voltmeters,
    grounds,
    totalConnections: connections.length
  };
}

// Find connected components using graph theory
function findConnectedComponents() {
  if (connections.length === 0) return [];
  
  const connected = new Set();
  const visited = new Set();
  
  // Start from any component
  if (circuitComponents.length > 0) {
    const startComponent = circuitComponents[0];
    dfsConnect(startComponent, connected, visited);
  }
  
  return Array.from(connected);
}

// Depth-first search to find connected components
function dfsConnect(component, connected, visited) {
  if (visited.has(component.id)) return;
  visited.add(component.id);
  connected.add(component);
  
  // Find connections to this component
  connections.forEach(conn => {
    const comp1 = findComponentAtPosition(conn.x1, conn.y1);
    const comp2 = findComponentAtPosition(conn.x2, conn.y2);
    
    if (comp1 && comp1.id === component.id) {
      dfsConnect(comp2, connected, visited);
    } else if (comp2 && comp2.id === component.id) {
      dfsConnect(comp1, connected, visited);
    }
  });
}

// Find component at specific position
function findComponentAtPosition(x, y) {
  return circuitComponents.find(comp => {
    const template = componentTemplates[comp.type];
    return x >= comp.x && x <= comp.x + template.width &&
           y >= comp.y && y <= comp.y + template.height;
  });
}

// Calculate realistic circuit values
function calculateCircuitValues(analysis) {
  const { generators, resistors, diodes, isComplete } = analysis;
  
  if (!isComplete) {
    return {
      voltage: 0,
      current: 0,
      power: 0,
      status: 'incomplete',
      message: 'Circuit incomplete - missing power, ground, or load'
    };
  }
  
  // Simple DC analysis (assuming 5V generator)
  const supplyVoltage = 5.0;
  let totalResistance = 100; // Default load resistance
  let diodeDrops = 0;
  
  // Calculate total resistance
  if (resistors.length > 0) {
    totalResistance = resistors.length * 100; // 100Ω per resistor
  }
  
  // Calculate diode voltage drops
  if (diodes.length > 0) {
    diodeDrops = diodes.length * 0.7; // 0.7V per silicon diode
  }
  
  // Calculate current using Ohm's law
  const effectiveVoltage = supplyVoltage - diodeDrops;
  const current = effectiveVoltage > 0 ? effectiveVoltage / totalResistance : 0;
  
  // Calculate power
  const power = current * effectiveVoltage;
  
  return {
    voltage: supplyVoltage,
    current: current * 1000, // Convert to mA
    power: power * 1000, // Convert to mW
    diodeDrops,
    totalResistance,
    status: current > 0 ? 'active' : 'blocked',
    message: current > 0 ? 'Circuit is conducting' : 'Circuit is blocked (check diode orientation)'
  };
}

// Display circuit analysis
function displayCircuitAnalysis(analysis, readings) {
  const readingsDiv = document.getElementById('circuit-readings');
  
  const statusColor = readings.status === 'active' ? '#10B981' : 
                     readings.status === 'blocked' ? '#F59E0B' : '#F43F5E';
  
  readingsDiv.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;">
      <div style="background:rgba(26,86,219,0.1);border:1px solid rgba(26,86,219,0.3);border-radius:8px;padding:1rem;">
        <div style="font-family:var(--font-mono);font-size:.7rem;color:#94a3b8;margin-bottom:0.5rem">VOLTAGE</div>
        <div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:700;color:#1A56DB">${readings.voltage.toFixed(1)}V</div>
      </div>
      <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:1rem;">
        <div style="font-family:var(--font-mono);font-size:.7rem;color:#94a3b8;margin-bottom:0.5rem">CURRENT</div>
        <div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:700;color:#10B981">${readings.current.toFixed(2)}mA</div>
      </div>
      <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:1rem;">
        <div style="font-family:var(--font-mono);font-size:.7rem;color:#94a3b8;margin-bottom:0.5rem">POWER</div>
        <div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:700;color:#F59E0B">${readings.power.toFixed(1)}mW</div>
      </div>
      <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:8px;padding:1rem;">
        <div style="font-family:var(--font-mono);font-size:.7rem;color:#94a3b8;margin-bottom:0.5rem">STATUS</div>
        <div style="font-family:var(--font-mono);font-size:1rem;font-weight:700;color:${statusColor}">${readings.status.toUpperCase()}</div>
      </div>
    </div>
    
    <div style="margin-top:1rem;padding:1rem;background:rgba(51,65,85,0.2);border-radius:8px;">
      <div style="font-family:var(--font-mono);font-size:.8rem;color:#94a3b8;margin-bottom:0.5rem">CIRCUIT ANALYSIS</div>
      <div style="font-family:var(--font-mono);font-size:.9rem;color:#e2e8f0;line-height:1.6">
        ${analysis.generators.length} Generator(s) | 
        ${analysis.resistors.length} Resistor(s) | 
        ${analysis.diodes.length} Diode(s) | 
        ${analysis.connections} Connection(s) | 
        ${analysis.connectedComponents.length} Connected Components
      </div>
      <div style="font-family:var(--font-mono);font-size:.85rem;color:${statusColor};margin-top:0.5rem">
        ${readings.message}
      </div>
      ${readings.diodeDrops > 0 ? `
        <div style="font-family:var(--font-mono);font-size:.8rem;color:#fbbf24;margin-top:0.5rem">
          Diode Voltage Drop: ${readings.diodeDrops.toFixed(1)}V (${analysis.diodes.length} × 0.7V)
        </div>
      ` : ''}
      ${readings.totalResistance > 0 ? `
        <div style="font-family:var(--font-mono);font-size:.8rem;color:#a78bfa;margin-top:0.5rem">
          Total Resistance: ${readings.totalResistance}Ω
        </div>
      ` : ''}
    </div>
  `;
}

// Test function to verify circuit builder
function testCircuitBuilder() {
  console.log('=== Testing Circuit Builder ===');
  console.log('Components:', circuitComponents.length);
  console.log('Connections:', connections.length);
  console.log('Wire start point:', wireStartPoint);
  
  // Test adding a simple component
  if (circuitComponents.length === 0) {
    console.log('Adding test component...');
    addComponentToCanvas('resistor', 200, 200);
    setTimeout(() => {
      console.log('Component added. Total components:', circuitComponents.length);
      // Test adding another component
      addComponentToCanvas('diode', 300, 200);
      setTimeout(() => {
        console.log('Second component added. Total components:', circuitComponents.length);
        console.log('Now try clicking the blue connection points to connect them!');
      }, 200);
    }, 100);
  } else {
    console.log('Components already exist. Try clicking connection points to connect them!');
  }
}

// Simple wire test function
function testWireConnection() {
  if (circuitComponents.length >= 2) {
    console.log('Testing automatic wire connection...');
    const comp1 = circuitComponents[0];
    const comp2 = circuitComponents[1];
    
    // Create a test connection
    connections.push({
      x1: comp1.x + 60, // Right side of first component
      y1: comp1.y + 20,
      x2: comp2.x,      // Left side of second component
      y2: comp2.y + 20
    });
    
    console.log('Test wire added. Total connections:', connections.length);
    renderCircuit();
    updateCircuitReadings();
  } else {
    console.log('Need at least 2 components to test wire connection');
  }
}

// Update circuit readings
function updateCircuitReadings() {
  const readingsDiv = document.getElementById('circuit-readings');
  
  if (circuitComponents.length === 0) {
    readingsDiv.innerHTML = '<p style="color:var(--muted);font-size:.8rem">Build a circuit and click "Run Sim" to analyze</p>';
    return;
  }
  
  // Simple analysis - count components
  const generators = circuitComponents.filter(c => c.type === 'generator').length;
  const resistors = circuitComponents.filter(c => c.type === 'resistor').length;
  const diodes = circuitComponents.filter(c => c.type === 'diode').length;
  const meters = circuitComponents.filter(c => c.type === 'ammeter' || c.type === 'voltmeter').length;
  
  readingsDiv.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;">
      <div style="background:rgba(26,86,219,0.1);border:1px solid rgba(26,86,219,0.3);border-radius:8px;padding:1rem;">
        <div style="font-family:var(--font-mono);font-size:.7rem;color:#94a3b8;margin-bottom:0.5rem">GENERATORS</div>
        <div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:700;color:#1A56DB">${generators}</div>
      </div>
      <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:1rem;">
        <div style="font-family:var(--font-mono);font-size:.7rem;color:#94a3b8;margin-bottom:0.5rem">RESISTORS</div>
        <div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:700;color:#F59E0B">${resistors}</div>
      </div>
      <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:1rem;">
        <div style="font-family:var(--font-mono);font-size:.7rem;color:#94a3b8;margin-bottom:0.5rem">DIODES</div>
        <div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:700;color:#10B981">${diodes}</div>
      </div>
      <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:8px;padding:1rem;">
        <div style="font-family:var(--font-mono);font-size:.7rem;color:#94a3b8;margin-bottom:0.5rem">METERS</div>
        <div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:700;color:#8B5CF6">${meters}</div>
      </div>
    </div>
    <div style="margin-top:1rem;padding:1rem;background:rgba(51,65,85,0.2);border-radius:8px;">
      <div style="font-family:var(--font-mono);font-size:.8rem;color:#94a3b8;margin-bottom:0.5rem">CIRCUIT STATUS</div>
      <div style="font-family:var(--font-mono);font-size:.9rem;color:#e2e8f0">
        ${generators > 0 ? '✅ Power source detected' : '⚠️ No power source'} | 
        ${connections.length > 0 ? `${connections.length} connections` : 'No connections'} |
        ${circuitComponents.length} total components
      </div>
    </div>
  `;
}

function renderSandbox() {
  const svg = document.getElementById('sandbox-svg');
  if (!svg) return;

  const W = 700, H = 320;
  const railY  = 160;
  const retY   = 260;
  const startX = 60;
  const endX   = W - 60;

  // Layout diodes evenly
  const spacing = sandboxDiodes.length > 0 ? (endX - startX - 80) / Math.max(sandboxDiodes.length, 1) : 200;
  sandboxDiodes.forEach((d, i) => {
    d.x = startX + 80 + i * spacing;
    d.y = railY;
  });

  // Add mouse event listeners for drag and drop
  svg.onmousedown = handleMouseDown;
  svg.onmousemove = handleMouseMove;
  svg.onmouseup = handleMouseUp;
  svg.onmouseleave = handleMouseUp;

  let svgContent = `
  <!-- Background grid -->
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,0,0,0.04)" stroke-width="1"/>
    </pattern>
    <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <marker id="arrow-fwd" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 Z" fill="#1A56DB"/>
    </marker>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grid)" rx="8"/>

  <!-- AC Generator (left) -->
  <g transform="translate(${startX - 30}, ${(railY + retY)/2 - 28})">
    <rect x="0" y="0" width="56" height="56" rx="28" fill="rgba(26,86,219,0.12)" stroke="#1A56DB" stroke-width="2"/>
    <text x="28" y="14" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#1A56DB" font-weight="700">AC GEN</text>
    <polyline id="sb-gen-wave" points="8,30 13,22 18,38 23,22 28,38 33,22 38,30 43,30" fill="none" stroke="#1A56DB" stroke-width="1.5" stroke-linecap="round"/>
    <text x="28" y="50" text-anchor="middle" font-family="JetBrains Mono" font-size="6" fill="#475569">${acAmplitude.toFixed(0)}V / ${acFrequency}Hz</text>
  </g>

  <!-- Top rail from generator to first node -->
  <line x1="${startX}" y1="${railY}" x2="${sandboxDiodes.length > 0 ? sandboxDiodes[0].x - 32 : endX}" y2="${railY}" stroke="#334155" stroke-width="2.5"/>
  <!-- Bottom return rail -->
  <line x1="${startX}" y1="${retY}" x2="${endX}" y2="${retY}" stroke="#334155" stroke-width="2.5"/>
  <!-- Generator connections -->
  <line x1="${startX-30+28}" y1="${(railY+retY)/2 - 28}" x2="${startX}" y2="${railY}" stroke="#334155" stroke-width="2" stroke-dasharray="4,2"/>
  <line x1="${startX-30+28}" y1="${(railY+retY)/2 + 28}" x2="${startX}" y2="${retY}" stroke="#334155" stroke-width="2" stroke-dasharray="4,2"/>
  <!-- Right return line -->
  <line x1="${endX}" y1="${railY}" x2="${endX}" y2="${retY}" stroke="#334155" stroke-width="2.5"/>

  <!-- Ammeter -->
  <g transform="translate(${endX - 20}, ${railY - 20})">
    <circle cx="20" cy="20" r="18" fill="rgba(16,185,129,0.12)" stroke="#10B981" stroke-width="2"/>
    <text x="20" y="16" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#10B981" font-weight="700">A</text>
    <text x="20" y="26" text-anchor="middle" font-family="JetBrains Mono" font-size="6" fill="#10B981" id="sb-ammeter-txt">0 mA</text>
  </g>
  `;

  // Voltmeter across entire chain
  svgContent += `
  <!-- Voltmeter (dashed, across output) -->
  <rect x="${endX - 80}" y="${retY + 20}" width="50" height="28" rx="6" fill="rgba(245,158,11,0.1)" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="4,2"/>
  <text x="${endX - 55}" y="${retY + 31}" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#F59E0B" font-weight="700">V</text>
  <text x="${endX - 55}" y="${retY + 43}" text-anchor="middle" font-family="JetBrains Mono" font-size="6" fill="#F59E0B" id="sb-voltmeter-txt">0 V</text>
  <line x1="${endX - 55}" y1="${retY + 20}" x2="${endX - 55}" y2="${retY}" stroke="#F59E0B" stroke-width="1" stroke-dasharray="3,3"/>
  `;

  // Draw each diode
  sandboxDiodes.forEach((d, i) => {
    const x = d.x, y = d.y;
    const flip = d.flipped ? -1 : 1;

    // connecting wire segments
    if (i === 0) {
      svgContent += `<line x1="${startX + (sandboxDiodes.length > 0 ? 0 : 0)}" y1="${railY}" x2="${x - 32}" y2="${railY}" stroke="#334155" stroke-width="2.5"/>`;
    }
    if (i < sandboxDiodes.length - 1) {
      svgContent += `<line x1="${x + 32}" y1="${railY}" x2="${sandboxDiodes[i+1].x - 32}" y2="${railY}" stroke="#334155" stroke-width="2.5"/>`;
    } else {
      svgContent += `<line x1="${x + 32}" y1="${railY}" x2="${endX - 40}" y2="${railY}" stroke="#334155" stroke-width="2.5"/>`;
    }

    // Diode symbol (triangle + bar)
    const isDragging = dragging && dragging.id === d.id;
    svgContent += `
    <g id="sb-diode-${d.id}" style="cursor:${isDragging ? 'grabbing' : 'grab'}" onmousedown="startDraggingDiode(${d.id}, event)">
      <!-- Diode body glow -->
      <ellipse cx="${x}" cy="${y}" rx="30" ry="18" fill="${isDragging ? 'rgba(26,86,219,0.15)' : 'rgba(26,86,219,0.08)'}" stroke="${isDragging ? '#1A56DB' : 'rgba(26,86,219,0.3)'}" stroke-width="${isDragging ? 2 : 1}" stroke-dasharray="${isDragging ? '2,2' : '4,2'}" class="sb-diode-aura-${d.id}"/>
      <!-- Triangle -->
      <polygon points="${x + flip*(-18)},${y-14} ${x + flip*(-18)},${y+14} ${x + flip*16},${y}"
               fill="${isDragging ? 'rgba(26,86,219,0.35)' : 'rgba(26,86,219,0.25)'}" stroke="#1A56DB" stroke-width="2.5" id="sb-dpoly-${d.id}"/>
      <!-- Cathode bar -->
      <line x1="${x + flip*16}" y1="${y-14}" x2="${x + flip*16}" y2="${y+14}" stroke="#1A56DB" stroke-width="3"/>
      <!-- Lead wires -->
      <line x1="${x - 32}" y1="${y}" x2="${x + flip*(-18)}" y2="${y}" stroke="#1A56DB" stroke-width="2"/>
      <line x1="${x + flip*16}" y1="${y}" x2="${x + 32}" y2="${y}" stroke="#1A56DB" stroke-width="2"/>
      <!-- A/K labels -->
      <text x="${x + flip*(-26)}" y="${y - 18}" font-family="JetBrains Mono" font-size="8" fill="#1A56DB" text-anchor="middle">A</text>
      <text x="${x + flip*24}" y="${y - 18}" font-family="JetBrains Mono" font-size="8" fill="#1A56DB" text-anchor="middle">K</text>
      <!-- Diode label -->
      <text x="${x}" y="${y + 28}" font-family="JetBrains Mono" font-size="9" font-weight="700" fill="#0f0f1a" text-anchor="middle">${d.label}</text>
      <!-- Controls -->
      <g onclick="flipDiode(${d.id})" style="cursor:pointer">
        <rect x="${x - 18}" y="${y + 32}" width="36" height="14" rx="4" fill="rgba(124,58,237,0.15)" stroke="rgba(124,58,237,0.3)" stroke-width="1"/>
        <text x="${x}" y="${y + 42}" font-family="JetBrains Mono" font-size="7" fill="#7C3AED" text-anchor="middle" font-weight="700">FLIP</text>
      </g>`;

    if (sandboxDiodes.length > 1) {
      svgContent += `
      <g onclick="removeDiode(${d.id})" style="cursor:pointer">
        <rect x="${x + 22}" y="${y - 32}" width="14" height="14" rx="3" fill="rgba(244,63,94,0.15)" stroke="rgba(244,63,94,0.35)" stroke-width="1"/>
        <text x="${x + 29}" y="${y - 22}" font-family="JetBrains Mono" font-size="10" fill="#F43F5E" text-anchor="middle" font-weight="700">×</text>
      </g>`;
    }
    svgContent += `</g>`;
  });

  svgContent += `
  <!-- Add diode buttons -->
  <g onclick="addDiode(false)" style="cursor:pointer">
    <rect x="${W/2 - 65}" y="${retY + 55}" width="60" height="22" rx="6" fill="rgba(26,86,219,0.12)" stroke="rgba(26,86,219,0.35)" stroke-width="1.5"/>
    <text x="${W/2 - 35}" y="${retY + 70}" font-family="JetBrains Mono" font-size="9" fill="#1A56DB" text-anchor="middle" font-weight="700">+ ADD →</text>
  </g>
  <g onclick="addDiode(true)" style="cursor:pointer">
    <rect x="${W/2 + 5}" y="${retY + 55}" width="60" height="22" rx="6" fill="rgba(124,58,237,0.12)" stroke="rgba(124,58,237,0.35)" stroke-width="1.5"/>
    <text x="${W/2 + 35}" y="${retY + 70}" font-family="JetBrains Mono" font-size="9" fill="#7C3AED" text-anchor="middle" font-weight="700">+ ADD ←</text>
  </g>
  `;

  svg.innerHTML = svgContent;
}

// ── Drag and Drop Handlers ───────────────────────────────────────────────────────
function startDraggingDiode(diodeId, event) {
  event.stopPropagation();
  const diode = sandboxDiodes.find(d => d.id === diodeId);
  if (!diode) return;
  
  const svg = document.getElementById('sandbox-svg');
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  
  dragging = { 
    id: diodeId, 
    offX: svgP.x - diode.x, 
    offY: svgP.y - diode.y, 
    originalX: diode.x, 
    originalY: diode.y 
  };
  svg.style.cursor = 'grabbing';
}

function handleMouseDown(e) {
  const svg = document.getElementById('sandbox-svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  
  // Check if clicking on a diode
  for (let d of sandboxDiodes) {
    const dx = svgP.x - d.x;
    const dy = svgP.y - d.y;
    if (Math.sqrt(dx*dx + dy*dy) < 30) {
      dragging = { id: d.id, offX: dx, offY: dy, originalX: d.x, originalY: d.y };
      svg.style.cursor = 'grabbing';
      break;
    }
  }
}

function handleMouseMove(e) {
  if (!dragging) return;
  
  const svg = document.getElementById('sandbox-svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  
  const diode = sandboxDiodes.find(d => d.id === dragging.id);
  if (diode) {
    diode.x = svgP.x - dragging.offX;
    diode.y = svgP.y - dragging.offY;
    
    // Snap to rail
    const railY = 160;
    if (Math.abs(diode.y - railY) < 30) {
      diode.y = railY;
    }
    
    renderSandbox();
  }
}

function handleMouseUp(e) {
  if (!dragging) return;
  
  const svg = document.getElementById('sandbox-svg');
  svg.style.cursor = 'default';
  
  // Check if dropped in valid position
  const diode = sandboxDiodes.find(d => d.id === dragging.id);
  if (diode) {
    // If dropped outside valid area, return to original position
    if (diode.y < 120 || diode.y > 200 || diode.x < 80 || diode.x > 620) {
      diode.x = dragging.originalX;
      diode.y = dragging.originalY;
      renderSandbox();
    } else {
      updateSandboxReadings();
    }
  }
  
  dragging = null;
}

function updateSandboxReadings() {
  if (!sandboxDiodes || sandboxDiodes.length === 0) return;
  
  // For series diodes: sum up voltage drops, check orientation
  const anyReverse = sandboxDiodes.some(d => d.flipped);
  const allForward = sandboxDiodes.every(d => !d.flipped);
  const allReverse = sandboxDiodes.every(d => d.flipped);
  let totalVd = 0, totalId = 0;

  if (!allForward) {
    // Any reverse diode blocks current completely
    totalId = 1e-12; // leakage current only
    totalVd = acAmplitude; // full voltage appears across diodes
  } else {
    // All forward: N diodes in series
    const N = sandboxDiodes.length;
    const vt = thermalVoltage(temperature);
    
    // Newton-Raphson to solve for diode voltage
    let vd1 = 0.6; // initial guess for each diode
    for (let iter = 0; iter < 100; iter++) {
      const id = IS_SILICON * (Math.exp(vd1 / (N_IDEAL * vt)) - 1);
      const vSource = acAmplitude;
      const vR = id * seriesR;
      const vTotal = N * vd1; // total voltage across all diodes
      const f = vTotal + vR - vSource;
      const df = N * IS_SILICON * Math.exp(vd1 / (N_IDEAL * vt)) / (N_IDEAL * vt) + 1 / seriesR;
      const dv = f / df;
      vd1 -= dv;
      if (Math.abs(dv) < 1e-12) break;
    }
    
    totalId = IS_SILICON * (Math.exp(vd1 / (N_IDEAL * vt)) - 1);
    totalVd = vd1 * N;
  }

  const fi = formatI(totalId);
  
  // Update meter displays
  safeSet('sb-ammeter-txt', fi.v + ' ' + fi.u);
  safeSet('sb-voltmeter-txt', totalVd.toFixed(3) + ' V');
  safeSet('sb-ammeter-big', fi.v + ' ' + fi.u);
  safeSet('sb-voltmeter-big', totalVd.toFixed(3) + ' V');

  // Update info panel
  const infoEl = document.getElementById('sandbox-info');
  if (infoEl) {
    const N = sandboxDiodes.length;
    let html = '';
    
    if (!allForward) {
      if (allReverse) {
        html = `<div class="info-line info-blocked">⬅ <strong>ALL REVERSE BIASED</strong> — No forward current flow. Only leakage current (nA range).</div>`;
      } else {
        html = `<div class="info-line info-blocked">🚫 <strong>CURRENT BLOCKED</strong> — One or more reverse diodes block the entire circuit like an open switch.</div>`;
      }
    } else if (N === 1) {
      html = `<div class="info-line info-ok">✅ <strong>SINGLE DIODE</strong> — Normal forward bias. Vf ≈ 0.7V, current flows above knee voltage.</div>`;
    } else {
      const vdrop = totalVd.toFixed(2);
      const current = fi.v + ' ' + fi.u;
      html = `<div class="info-line info-multi">⚡ <strong>${N} DIODES IN SERIES</strong> — Total Vf = ${vdrop}V, Current = ${current}. Each diode adds ~0.7V drop.</div>`;
    }
    infoEl.innerHTML = html;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
//  REPORT EXPORT
// ══════════════════════════════════════════════════════════════════════════════
function printReport() {
  const vt = thermalVoltage(temperature);
  const { vd, id } = solveCircuit(acAmplitude * (biasMode === 'forward' ? 1 : -1), seriesR, temperature);
  const fi = formatI(id);
  const w = window.open('', '_blank');
  w.document.write(`
    <html><head><title>Lab Report — PN Junction Diode</title>
    <style>body{font-family:Arial,sans-serif;max-width:720px;margin:40px auto;color:#111;line-height:1.6}
    h1{color:#1A56DB;border-bottom:2px solid #1A56DB;padding-bottom:8px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
    .box{border:1px solid #ddd;border-radius:6px;padding:12px}
    .box h3{font-size:.8rem;color:#666;margin-bottom:4px;text-transform:uppercase}
    .box p{font-size:1.1rem;font-weight:700}
    table{width:100%;border-collapse:collapse;margin:16px 0;font-size:.85rem}
    th{background:#1A56DB;color:#fff;padding:8px;text-align:left}
    td{padding:7px 8px;border-bottom:1px solid #eee}
    </style></head><body>
    <h1>LogicFlow — PN Junction Diode Lab Report</h1>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
    <p><strong>Bias Mode:</strong> ${biasMode.toUpperCase()} &nbsp; <strong>Series Resistance:</strong> ${seriesR}Ω &nbsp; <strong>Temperature:</strong> ${temperature}°C</p>
    <h2>Operating Point (AC Peak)</h2>
    <div class="grid">
      <div class="box"><h3>Source Voltage</h3><p>${acAmplitude.toFixed(2)} V</p></div>
      <div class="box"><h3>Diode Voltage (Vd)</h3><p>${vd.toFixed(3)} V</p></div>
      <div class="box"><h3>Diode Current (Id)</h3><p>${fi.v} ${fi.u}</p></div>
      <div class="box"><h3>Thermal Voltage (Vt)</h3><p>${(vt*1000).toFixed(2)} mV</p></div>
    </div>
    <h2>Observation Table (Forward Bias)</h2>
    <table><tr><th>Vs (V)</th><th>Vd (V)</th><th>Id</th><th>Region</th></tr>
    ${[0.1,0.3,0.5,0.6,0.65,0.7,0.75,0.8,1.0,1.2].map(vs=>{
      const {vd:v,id:i} = solveCircuit(vs, seriesR, temperature);
      const fi2 = formatI(i);
      const r = v<0.3?'Cut-off':v<0.65?'Near Threshold':'Forward Active';
      return `<tr><td>${vs.toFixed(2)}</td><td>${v.toFixed(3)}</td><td>${fi2.v} ${fi2.u}</td><td>${r}</td></tr>`;
    }).join('')}
    </table>
    <h2>Conclusion</h2>
    <p>The V-I characteristics of the PN junction diode confirm Shockley's equation. Forward knee voltage observed at ≈0.7V for silicon. Temperature increase shifts the curve left (higher Vt).</p>
    <br><hr><p>Student: _________________ &nbsp; Faculty: _________________</p>
    </body></html>`);
  w.document.close(); w.print();
}