/* ═══════════════════════════════════════════════════
   HASHFORGE LAB — app.js
   Hash engine, pipeline builder, math inspector, UI
═══════════════════════════════════════════════════ */

'use strict';

// ─── Tab Navigation ───────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// ─── Hash Step Definitions ────────────────────────
const STEPS = {
  charcode_sum: {
    label: '∑ Char Code Sum',
    icon: '∑',
    desc: 'Sums the ASCII/Unicode code points of every character.',
    latex: 'H(s) = \\sum_{i=0}^{n-1} \\text{ord}(s_i)',
    run(state) {
      let v = 0;
      for (const c of state.str) v += c.charCodeAt(0);
      state.val = (state.val + v) >>> 0;
      return { desc: `∑ ord(chars) = ${v}`, val: state.val };
    }
  },
  polynomial_roll: {
    label: 'P(x) Polynomial Rolling',
    icon: 'P',
    desc: 'Each character is weighted by its position using a prime base.',
    latex: 'H(s) = \\sum_{i=0}^{n-1} s_i \\cdot 31^i \\pmod{10^9+9}',
    run(state) {
      const M = 1_000_000_007n;
      const P = 31n;
      let h = 0n;
      let p = 1n;
      for (const c of state.str) {
        h = (h + BigInt(c.charCodeAt(0)) * p) % M;
        p = (p * P) % M;
      }
      state.val = Number(h) >>> 0;
      return { desc: `∑ cᵢ·31ⁱ mod 10⁹⁺⁹ = ${state.val}`, val: state.val };
    }
  },
  xor_fold: {
    label: '⊕ XOR Fold',
    icon: '⊕',
    desc: 'XORs every char code into the accumulator for bit mixing.',
    latex: 'H(s) = h \\oplus c_0 \\oplus c_1 \\oplus \\cdots \\oplus c_{n-1}',
    run(state) {
      for (const c of state.str) state.val ^= c.charCodeAt(0);
      state.val = state.val >>> 0;
      return { desc: `h ⊕ all chars = ${state.val}`, val: state.val };
    }
  },
  modular_exp: {
    label: 'xⁿ Modular Exponent',
    icon: 'xⁿ',
    desc: 'Raises the current hash value to a power mod a large prime.',
    latex: 'H = h^{e} \\pmod{M}, \\quad e = 65537, M = 2^{31}-1',
    run(state) {
      const M = 2147483647n;
      const e = 65537n;
      let base = BigInt(state.val || 1) % M;
      if (base === 0n) base = 1n;
      let result = 1n;
      let exp = e;
      while (exp > 0n) {
        if (exp % 2n === 1n) result = (result * base) % M;
        base = (base * base) % M;
        exp >>= 1n;
      }
      state.val = Number(result) >>> 0;
      return { desc: `h^65537 mod (2³¹-1) = ${state.val}`, val: state.val };
    }
  },
  fibonacci_mix: {
    label: 'φ Fibonacci Mix',
    icon: 'φ',
    desc: 'Multiplies by the golden ratio approximation in integer arithmetic.',
    latex: 'H = \\lfloor h \\cdot \\phi \\rfloor \\pmod{M}, \\quad \\phi = \\frac{1+\\sqrt{5}}{2}',
    run(state) {
      // Fibonacci hashing: multiply by 2654435769 (Knuth constant ≈ 2^32/φ)
      const KNUTH = 2654435769n;
      const M = 2n ** 32n;
      state.val = Number((BigInt(state.val) * KNUTH) % M) >>> 0;
      return { desc: `h · 2654435769 mod 2³² = ${state.val}`, val: state.val };
    }
  },
  prime_multiply: {
    label: 'π Prime Multiply',
    icon: 'π',
    desc: 'Multiplies by a carefully chosen prime to spread bit patterns.',
    latex: 'H = (h \\cdot p) \\pmod{M}, \\quad p = 1000000007',
    run(state) {
      const PRIME = 1000000007n;
      const M = 2n ** 32n;
      state.val = Number((BigInt(state.val) * PRIME) % M) >>> 0;
      return { desc: `h · 1000000007 mod 2³² = ${state.val}`, val: state.val };
    }
  },
  bit_rotate: {
    label: '↻ Bit Rotation',
    icon: '↻',
    desc: 'Rotates bits left by 13 positions, preventing linear collisions.',
    latex: '\\text{ROTL}_{13}(h) = (h \\ll 13) \\mid (h \\gg 19)',
    run(state) {
      const h = state.val >>> 0;
      state.val = ((h << 13) | (h >>> 19)) >>> 0;
      return { desc: `ROTL₁₃(${h}) = ${state.val}`, val: state.val };
    }
  },
  ascii_square: {
    label: 'x² ASCII Square Sum',
    icon: 'x²',
    desc: 'Sums the squares of each char code for non-linear mixing.',
    latex: 'H(s) = \\sum_{i=0}^{n-1} \\text{ord}(s_i)^2 \\pmod{2^{32}}',
    run(state) {
      const M = 2n ** 32n;
      let v = 0n;
      for (const c of state.str) {
        const code = BigInt(c.charCodeAt(0));
        v = (v + code * code) % M;
      }
      state.val = (state.val + Number(v)) >>> 0;
      return { desc: `∑ cᵢ² mod 2³² = ${state.val}`, val: state.val };
    }
  },
  avalanche: {
    label: '⚡ Avalanche Diffusion',
    icon: '⚡',
    desc: 'Murmur3-inspired finalizer that maximally diffuses bits.',
    latex: 'h \\mathrel{\\oplus}= h \\gg 16, \\; h \\mathrel{\\times}= 0x85ebca6b, \\; h \\mathrel{\\oplus}= h \\gg 13',
    run(state) {
      let h = state.val >>> 0;
      h ^= h >>> 16;
      h = Math.imul(h, 0x85ebca6b) >>> 0;
      h ^= h >>> 13;
      h = Math.imul(h, 0xc2b2ae35) >>> 0;
      h ^= h >>> 16;
      state.val = h >>> 0;
      return { desc: `Murmur3 finalize = ${state.val}`, val: state.val };
    }
  },
  salt_inject: {
    label: '💊 Salt Injection',
    icon: '🧂',
    desc: 'Mixes the salt into the hash state using XOR and polynomial blend.',
    latex: 'H = H \\oplus H_{\\text{poly}}(\\text{salt})',
    run(state) {
      const salt = state.salt || 'x';
      let sv = 0;
      let p = 1;
      for (const c of salt) {
        sv = (sv + c.charCodeAt(0) * p) >>> 0;
        p = Math.imul(p, 31) >>> 0;
      }
      state.val = (state.val ^ sv) >>> 0;
      return { desc: `h ⊕ H_poly(salt="${state.salt}") = ${state.val}`, val: state.val };
    }
  },
  rounds: {
    label: '🔄 Iteration Rounds',
    icon: '🔄',
    desc: 'Re-applies the avalanche finalization 8 times for key-stretching.',
    latex: 'H^{(k)}(h) = \\underbrace{A(A(\\cdots A}_{k}(h)\\cdots))',
    run(state) {
      let h = state.val;
      for (let i = 0; i < 8; i++) {
        h ^= h >>> 16;
        h = Math.imul(h, 0x85ebca6b) >>> 0;
        h ^= h >>> 13;
        h = Math.imul(h, 0xc2b2ae35) >>> 0;
        h ^= h >>> 16;
      }
      state.val = h >>> 0;
      return { desc: `8× avalanche rounds = ${state.val}`, val: state.val };
    }
  },
  hex_encode: {
    label: '🔡 Hex Encode',
    icon: '0x',
    desc: 'Converts the 32-bit integer to a zero-padded hex string.',
    latex: '\\text{hex}(h) = \\left\\{ d_7 d_6 \\cdots d_0 \\,:\\, h = \\sum_{k=0}^{7} d_k \\cdot 16^k \\right\\}',
    run(state) {
      const hex = state.val.toString(16).padStart(8, '0');
      state.hexStr = (state.hexStr || '') + hex;
      return { desc: `${state.val} → 0x${hex}`, val: state.val, display: `0x${hex}` };
    }
  },
  modulo_trim: {
    label: '% Modulo Trim',
    icon: '%',
    desc: 'Reduces the hash value to a specific bit range via modulo.',
    latex: 'H_{\\text{final}} = H \\pmod{2^{16}}',
    run(state) {
      state.val = state.val % 65536;
      return { desc: `h mod 65536 = ${state.val}`, val: state.val };
    }
  }
};

// ─── Pipeline State ───────────────────────────────
let pipeline = [];

const stepList = document.getElementById('step-list');
const pipelineViz = document.getElementById('pipeline-viz');
const traceLog = document.getElementById('trace-log');
const hashOutput = document.getElementById('hash-output');
const hashMeta = document.getElementById('hash-meta');
const mathDisplay = document.getElementById('math-display');

function renderPipeline() {
  stepList.innerHTML = '';
  pipelineViz.innerHTML = '';

  if (pipeline.length === 0) {
    pipelineViz.innerHTML = '<div class="pipeline-empty">Add steps to see the pipeline visualize here.</div>';
    return;
  }

  pipeline.forEach((key, i) => {
    const step = STEPS[key];
    // Sidebar step
    const item = document.createElement('div');
    item.className = 'step-item';
    item.innerHTML = `
      <span class="step-num">${i + 1}</span>
      <span class="step-name">${step.icon} ${step.label}</span>
      <button class="step-detail" data-idx="${i}" title="View formula">∫</button>
      <button class="step-del" data-idx="${i}" title="Remove">×</button>
    `;
    stepList.appendChild(item);

    // Viz step
    const vizStep = document.createElement('div');
    vizStep.className = 'viz-step';
    vizStep.id = `viz-${i}`;
    vizStep.innerHTML = `
      <span class="viz-step-icon">${step.icon}</span>
      <span class="viz-step-name">${step.label}</span>
      <span class="viz-step-val" id="vval-${i}">—</span>
    `;
    pipelineViz.appendChild(vizStep);
  });

  // Delete handlers
  stepList.querySelectorAll('.step-del').forEach(btn => {
    btn.addEventListener('click', () => {
      pipeline.splice(+btn.dataset.idx, 1);
      renderPipeline();
    });
  });

  // Formula inspector handlers
  stepList.querySelectorAll('.step-detail').forEach(btn => {
    btn.addEventListener('click', () => showMath(pipeline[+btn.dataset.idx]));
  });
}

function showMath(key) {
  const step = STEPS[key];
  if (!step) return;
  mathDisplay.innerHTML = `
    <p style="font-family:var(--mono);font-size:0.75rem;color:var(--accent);margin-bottom:0.5rem">${step.icon} ${step.label}</p>
    <p style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.75rem">${step.desc}</p>
    <div class="math-block">$$${step.latex}$$</div>
  `;
  if (window.MathJax) MathJax.typesetPromise([mathDisplay]);
}

// ─── Run Hash ─────────────────────────────────────
function runHash(password, salt, steps) {
  const state = {
    str: password + salt,
    val: 0,
    salt: salt,
    hexStr: ''
  };

  const trace = [];

  // Seed from string length × magic constant
  state.val = (password.length * 2166136261) >>> 0;

  const stepOutputs = steps.map((key, i) => {
    const step = STEPS[key];
    const result = step.run(state);
    trace.push({ step: step.label, ...result });
    return result;
  });

  // Final output
  let finalHash;
  if (state.hexStr) {
    finalHash = state.hexStr;
  } else {
    // Produce a multi-word hex by running avalanche + encode twice
    const h1 = state.val;
    let h2 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b) >>> 0;
    h2 = Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35) >>> 0;
    h2 ^= h2 >>> 16;
    finalHash = h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }

  return { finalHash, trace, stepOutputs, stateVal: state.val };
}

document.getElementById('btn-run').addEventListener('click', () => {
  if (pipeline.length === 0) {
    alert('Add at least one step to your pipeline first!');
    return;
  }

  const password = document.getElementById('password-input').value || 'password';
  const salt = document.getElementById('salt-input').value || '';

  const { finalHash, trace, stepOutputs } = runHash(password, salt, pipeline);

  // Update viz values
  stepOutputs.forEach((out, i) => {
    const el = document.getElementById(`vval-${i}`);
    if (el) el.textContent = out.display || String(out.val).slice(0, 12);
  });

  // Show output
  hashOutput.classList.add('animating');
  hashOutput.textContent = finalHash;
  setTimeout(() => hashOutput.classList.remove('animating'), 400);

  const algoName = document.getElementById('algo-name').value || 'Custom';
  hashMeta.textContent = `${algoName} | ${finalHash.length * 4}-bit output | ${pipeline.length} steps`;

  // Trace log
  traceLog.innerHTML = trace.map((t, i) => `
    <div class="trace-entry">
      <strong>${i + 1}. ${t.step}</strong><br>
      <span class="tval">${t.desc}</span>
    </div>
  `).join('');

  // Avalanche effect
  runAvalanche(password, salt, pipeline);
});

// ─── Avalanche Effect ─────────────────────────────
function runAvalanche(password, salt, steps) {
  const grid = document.getElementById('avalanche-grid');
  grid.innerHTML = '';

  const base = runHash(password, salt, steps).finalHash;
  const tests = [
    { label: 'Original', pw: password },
    { label: 'Flip 1st char', pw: flipChar(password, 0) },
    { label: 'Flip mid char', pw: flipChar(password, Math.floor(password.length / 2)) },
    { label: 'Flip last char', pw: flipChar(password, password.length - 1) },
  ];

  tests.forEach(({ label, pw }) => {
    const h = runHash(pw, salt, steps).finalHash;
    const diff = countDifferentChars(base, h);
    const pct = Math.round((diff / base.length) * 100);

    const row = document.createElement('div');
    row.className = 'av-row';
    row.innerHTML = `
      <span class="av-label">${label}</span>
      <span class="av-hash">${h}</span>
      <span class="av-diff">${pct}% Δ</span>
    `;
    grid.appendChild(row);
  });
}

function flipChar(str, idx) {
  const arr = [...str];
  arr[idx] = String.fromCharCode(arr[idx].charCodeAt(0) + 1);
  return arr.join('');
}

function countDifferentChars(a, b) {
  const len = Math.min(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) diff++;
  return diff + Math.abs(a.length - b.length);
}

// ─── Add Step ─────────────────────────────────────
document.getElementById('btn-add-step').addEventListener('click', () => {
  const key = document.getElementById('step-select').value;
  pipeline.push(key);
  renderPipeline();
  showMath(key);
});

document.getElementById('btn-clear').addEventListener('click', () => {
  pipeline = [];
  renderPipeline();
  hashOutput.textContent = '—';
  hashMeta.textContent = '';
  traceLog.innerHTML = '<span class="muted">Run the hash to see trace values.</span>';
  document.getElementById('avalanche-grid').innerHTML = '';
  mathDisplay.innerHTML = '<p class="muted">Select a step to see its formula.</p>';
});

// ─── Presets ──────────────────────────────────────
const PRESETS = {
  simple: ['charcode_sum', 'xor_fold', 'hex_encode'],
  djb2:   ['charcode_sum', 'polynomial_roll', 'prime_multiply', 'hex_encode'],
  secure: ['salt_inject', 'polynomial_roll', 'avalanche', 'modular_exp', 'fibonacci_mix', 'rounds', 'avalanche', 'hex_encode']
};

document.querySelectorAll('.chip-btn[data-preset]').forEach(btn => {
  btn.addEventListener('click', () => {
    pipeline = [...PRESETS[btn.dataset.preset]];
    renderPipeline();
    document.getElementById('btn-run').click();
  });
});

// ─── Scenario Demo Buttons ────────────────────────
document.querySelectorAll('.sc-demo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const demo = btn.dataset.demo;
    // Switch to lab tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="lab"]').classList.add('active');
    document.getElementById('lab').classList.add('active');

    if (demo === 'linkedin') {
      pipeline = ['charcode_sum', 'xor_fold', 'hex_encode'];
      document.getElementById('salt-input').value = '';
      document.getElementById('password-input').value = 'linkedin_password';
    } else if (demo === 'md5') {
      pipeline = ['charcode_sum', 'polynomial_roll', 'hex_encode'];
      document.getElementById('password-input').value = 'weak_password';
    } else if (demo === 'argon2') {
      pipeline = [...PRESETS.secure];
      document.getElementById('salt-input').value = 'r4nd0m$alt#' + Date.now().toString(36);
    } else {
      pipeline = [...PRESETS.secure];
    }

    renderPipeline();
    setTimeout(() => document.getElementById('btn-run').click(), 100);
    document.getElementById('tab-bar').scrollIntoView({ behavior: 'smooth' });
  });
});

// ─── LaTeX Custom Formula Renderer ────────────────
document.getElementById('btn-render-latex').addEventListener('click', () => {
  const latex = document.getElementById('custom-latex').value.trim();
  const out = document.getElementById('latex-output');
  if (!latex) { out.textContent = 'Enter a formula above.'; return; }
  out.innerHTML = `$$${latex}$$`;
  if (window.MathJax) MathJax.typesetPromise([out]);
});

// ─── Password Strength Analyzer ───────────────────
const policyInput = document.getElementById('policy-pw-input');
if (policyInput) {
  policyInput.addEventListener('input', () => {
    analyzePassword(policyInput.value);
  });
}

function analyzePassword(pw) {
  const bar = document.getElementById('strength-bar');
  const feedback = document.getElementById('strength-feedback');
  const entropyDisp = document.getElementById('entropy-display');

  if (!pw) {
    bar.style.width = '0%';
    feedback.textContent = '';
    entropyDisp.textContent = '';
    return;
  }

  // Pool size
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 32;

  const entropy = pool > 0 ? Math.floor(pw.length * Math.log2(pool)) : 0;

  // Score
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (entropy > 60) score++;

  const levels = [
    { pct: 10, color: '#ef4444', label: '⛔ Very Weak' },
    { pct: 25, color: '#f97316', label: '❌ Weak' },
    { pct: 45, color: '#eab308', label: '⚠️ Fair' },
    { pct: 65, color: '#84cc16', label: '✅ Good' },
    { pct: 82, color: '#22c55e', label: '🔐 Strong' },
    { pct: 95, color: '#10b981', label: '🏆 Very Strong' },
    { pct: 100, color: '#06b6d4', label: '💎 Excellent' },
  ];

  const idx = Math.min(score, levels.length - 1);
  const level = levels[idx];

  bar.style.width = level.pct + '%';
  bar.style.background = level.color;

  const tips = [];
  if (pw.length < 12)  tips.push('Use 12+ characters');
  if (!/[A-Z]/.test(pw)) tips.push('Add uppercase letters');
  if (!/[0-9]/.test(pw)) tips.push('Add numbers');
  if (!/[^a-zA-Z0-9]/.test(pw)) tips.push('Add symbols (!@#$%^&*)');

  const crackTime = estimateCrackTime(entropy);
  feedback.textContent = `${level.label}${tips.length ? ' — ' + tips.join(', ') : ''} | Est. crack time: ${crackTime}`;
  entropyDisp.textContent = `Entropy ≈ ${entropy} bits | Pool: ${pool} chars | Length: ${pw.length}`;
}

function estimateCrackTime(entropy) {
  // Assuming 10B hashes/second (fast GPU)
  const seconds = Math.pow(2, entropy) / 10e9 / 2; // average case
  if (seconds < 1)        return '< 1 second';
  if (seconds < 60)       return `${Math.round(seconds)} seconds`;
  if (seconds < 3600)     return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400)    return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`;
  const years = seconds / 31536000;
  if (years < 1000)        return `${Math.round(years)} years`;
  if (years < 1e9)         return `${(years / 1e6).toFixed(1)}M years`;
  if (years < 1e15)        return `${(years / 1e9).toFixed(1)}B years`;
  return 'Heat death of universe';
}

// ─── Init ─────────────────────────────────────────
pipeline = [...PRESETS.djb2];
renderPipeline();

// Wait for MathJax to load then typeset the whole page
window.addEventListener('load', () => {
  setTimeout(() => {
    if (window.MathJax) MathJax.typesetPromise();
  }, 500);
});
