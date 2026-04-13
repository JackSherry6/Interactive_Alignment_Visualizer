"use client";

import { useState } from "react";
import styles from "./page.module.css";

type Phase = "init" | "fill" | "traceback";

interface HMMStep {
  col: number;
  state: number;
  phase: Phase;
  description: string;
}

interface HMMData {
  seq: string;
  viterbi: number[][];
  steps: HMMStep[];
  cellRevealedAt: Map<string, number>;
  tracebackCellAt: Map<string, number>;
  optimalPath: number[];
}

const STATES = ["+", "−"];
const BASES = ["A", "C", "G", "T"];

// CpG island emission probabilities (Durbin et al.)
const EMIT = [
  [0.11, 0.39, 0.39, 0.11], // + (CpG island)
  [0.30, 0.20, 0.20, 0.30], // − (background)
];

function buildViterbi(
  seq: string,
  pStayIsland: number,
  pStayBg: number
): HMMData {
  const n = seq.length;
  const trans = [
    [pStayIsland, 1 - pStayIsland],
    [1 - pStayBg, pStayBg],
  ];
  const logInit = [Math.log(0.5), Math.log(0.5)];
  const logTrans = trans.map((row) => row.map((v) => Math.log(v)));
  const logEmit = EMIT.map((row) => row.map((v) => Math.log(v)));

  const V: number[][] = [new Array(n).fill(-Infinity), new Array(n).fill(-Infinity)];
  const B: number[][] = [new Array(n).fill(-1), new Array(n).fill(-1)];
  const steps: HMMStep[] = [];

  // Initialization
  for (let s = 0; s < 2; s++) {
    const b = BASES.indexOf(seq[0]);
    V[s][0] = logInit[s] + logEmit[s][b];
    steps.push({
      col: 0,
      state: s,
      phase: "init",
      description:
        `Initialize state "${STATES[s]}" at position 1 (obs: ${seq[0]}). ` +
        `log V = log(π) + log(e_${STATES[s]}(${seq[0]})) = ` +
        `${logInit[s].toFixed(3)} + ${logEmit[s][b].toFixed(3)} = ${V[s][0].toFixed(3)}.`,
    });
  }

  // Fill
  for (let t = 1; t < n; t++) {
    const b = BASES.indexOf(seq[t]);
    for (let s = 0; s < 2; s++) {
      let best = -Infinity;
      let bestFrom = 0;
      for (let prev = 0; prev < 2; prev++) {
        const sc = V[prev][t - 1] + logTrans[prev][s];
        if (sc > best) {
          best = sc;
          bestFrom = prev;
        }
      }
      V[s][t] = best + logEmit[s][b];
      B[s][t] = bestFrom;

      const candidates = [0, 1]
        .map(
          (prev) =>
            `${STATES[prev]}→${STATES[s]}: ${(V[prev][t - 1] + logTrans[prev][s]).toFixed(3)}`
        )
        .join(" | ");

      steps.push({
        col: t,
        state: s,
        phase: "fill",
        description:
          `Position ${t + 1} (obs: ${seq[t]}), state "${STATES[s]}": ` +
          `[${candidates}] → best from "${STATES[bestFrom]}". ` +
          `V = ${best.toFixed(3)} + log(e(${seq[t]})) ${logEmit[s][b].toFixed(3)} = ${V[s][t].toFixed(3)}.`,
      });
    }
  }

  // Traceback
  const path = new Array(n).fill(0);
  const bestFinal = V[0][n - 1] >= V[1][n - 1] ? 0 : 1;
  path[n - 1] = bestFinal;
  steps.push({
    col: n - 1,
    state: bestFinal,
    phase: "traceback",
    description:
      `Traceback: best final state at position ${n} is "${STATES[bestFinal]}" ` +
      `(log V = ${V[bestFinal][n - 1].toFixed(3)}).`,
  });

  for (let t = n - 1; t > 0; t--) {
    path[t - 1] = B[path[t]][t];
    steps.push({
      col: t - 1,
      state: path[t - 1],
      phase: "traceback",
      description:
        `Traceback: at position ${t}, state "${STATES[path[t]]}" came from ` +
        `"${STATES[path[t - 1]]}" at position ${t}.`,
    });
  }

  steps.push({
    col: 0,
    state: path[0],
    phase: "traceback",
    description: `Traceback complete! Optimal state path: ${path.map((s) => STATES[s]).join(" ")}`,
  });

  const cellRevealedAt = new Map<string, number>();
  const tracebackCellAt = new Map<string, number>();
  steps.forEach((st, idx) => {
    const key = `${st.state},${st.col}`;
    if (st.phase !== "traceback" && !cellRevealedAt.has(key))
      cellRevealedAt.set(key, idx);
    if (st.phase === "traceback" && !tracebackCellAt.has(key))
      tracebackCellAt.set(key, idx);
  });

  return { seq, viterbi: V, steps, cellRevealedAt, tracebackCellAt, optimalPath: path };
}

export default function HMMPage() {
  const [seqInput, setSeqInput] = useState("CGCGAATTATCGCG");
  const [pIsland, setPIsland] = useState(0.69);
  const [pBg, setPBg] = useState(0.99);
  const [data, setData] = useState<HMMData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");

  const handleRun = () => {
    if (data) {
      setData(null);
      setCurrentStep(0);
      setError("");
      return;
    }
    const seq = seqInput.trim().toUpperCase();
    if (!seq) { setError("Please enter a DNA sequence."); return; }
    if (!/^[ACGT]+$/.test(seq)) { setError("Sequence may only contain A, C, G, T."); return; }
    if (seq.length > 15) { setError("Please keep the sequence to 15 characters or fewer."); return; }
    if (pIsland <= 0 || pIsland >= 1 || pBg <= 0 || pBg >= 1) {
      setError("Transition probabilities must be strictly between 0 and 1.");
      return;
    }
    setError("");
    setData(buildViterbi(seq, pIsland, pBg));
    setCurrentStep(0);
  };

  const step = data?.steps[currentStep];
  const totalSteps = data?.steps.length ?? 0;
  const done = data !== null && currentStep === totalSteps - 1;

  const isRevealed = (s: number, c: number) => {
    if (!data) return false;
    const idx = data.cellRevealedAt.get(`${s},${c}`);
    return idx !== undefined && idx <= currentStep;
  };
  const isTraceback = (s: number, c: number) => {
    if (!data) return false;
    const idx = data.tracebackCellAt.get(`${s},${c}`);
    return idx !== undefined && idx <= currentStep;
  };
  const isCurrent = (s: number, c: number) =>
    !!step && step.state === s && step.col === c;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Hidden Markov Models</h1>
        <p className={styles.subtitle}>
          Viterbi Algorithm — CpG Island Detection, step-by-step
        </p>
      </div>

      <div className={styles.workspace}>
        {/* ── Control Panel ── */}
        <div className={styles.controlPanel}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>DNA Sequence</label>
            <input
              className={styles.seqInput}
              value={seqInput}
              onChange={(e) => setSeqInput(e.target.value.toUpperCase())}
              placeholder="e.g. CGCGAATTATCGCG"
              maxLength={15}
              spellCheck={false}
            />
          </div>

          <div className={styles.scoringBox}>
            <div className={styles.scoringTitle}>Transition Probabilities</div>
            {[
              { label: "p(+|+) stay island", value: pIsland, set: setPIsland },
              { label: "p(−|−) stay backgnd", value: pBg, set: setPBg },
            ].map(({ label, value, set }) => (
              <div key={label} className={styles.scoringRow}>
                <span className={styles.scoringLabel}>{label}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="0.99"
                  className={styles.scoreInput}
                  value={value}
                  onChange={(e) => set(Number(e.target.value))}
                />
              </div>
            ))}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={data ? styles.resetBtn : styles.runBtn}
            onClick={handleRun}
          >
            {data ? "Reset" : "Run Viterbi"}
          </button>

          {data && (
            <>
              <div className={styles.stepInfo}>
                <span className={styles.stepCount}>
                  Step {currentStep + 1} / {totalSteps}
                </span>
                <span className={styles.phaseTag} data-phase={step?.phase}>
                  {step?.phase === "init"
                    ? "Initialization"
                    : step?.phase === "fill"
                    ? "DP Fill"
                    : "Traceback"}
                </span>
              </div>

              <div className={styles.navBtns}>
                <button
                  className={styles.navBtn}
                  onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                  disabled={currentStep === 0}
                >
                  ← Prev
                </button>
                <button
                  className={styles.navBtn}
                  onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
                  disabled={currentStep === totalSteps - 1}
                >
                  Next →
                </button>
              </div>

              <p className={styles.description}>{step?.description}</p>
            </>
          )}
        </div>

        {/* ── Matrix Panel ── */}
        <div className={styles.matrixPanel}>
          {!data ? (
            <div className={styles.placeholder}>
              Enter a DNA sequence and click <strong>Run Viterbi</strong> to
              begin the step-by-step visualization.
            </div>
          ) : (
            <>
              <div className={styles.emitSection}>
                <div className={styles.emitTitle}>Emission Probabilities (fixed — CpG island model)</div>
                <table className={styles.emitTable}>
                  <thead>
                    <tr>
                      <th className={styles.emitHdr}>State</th>
                      {BASES.map((b) => (
                        <th key={b} className={styles.emitHdr}>{b}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {STATES.map((s, si) => (
                      <tr key={s}>
                        <td className={`${styles.emitStateCell} ${si === 0 ? styles.islandCell : styles.bgCell}`}>
                          {s}
                        </td>
                        {EMIT[si].map((p, bi) => (
                          <td key={bi} className={styles.emitValCell}>
                            {p.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.matrixScroll}>
                <table className={styles.matrix}>
                  <thead>
                    <tr>
                      <th className={styles.hCell}>State</th>
                      {data.seq.split("").map((ch, j) => (
                        <th key={j} className={styles.hCell}>
                          <span className={styles.posNum}>{j + 1}</span>
                          <br />
                          <span className={styles.baseChar}>{ch}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {STATES.map((stateName, s) => (
                      <tr key={s}>
                        <th
                          className={`${styles.stateHdr} ${s === 0 ? styles.islandHdr : styles.bgHdr}`}
                        >
                          {stateName}
                        </th>
                        {data.viterbi[s].map((val, t) => {
                          const cur = isCurrent(s, t);
                          const tb = isTraceback(s, t);
                          const rev = isRevealed(s, t);
                          const cls = cur
                            ? styles.cellCurrent
                            : tb
                            ? styles.cellTraceback
                            : rev
                            ? styles.cellRevealed
                            : styles.cellHidden;
                          return (
                            <td key={t} className={`${styles.cell} ${cls}`}>
                              {cur || tb || rev ? val.toFixed(2) : ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {done && (
                <div className={styles.resultBox}>
                  <div className={styles.resultTitle}>Optimal Hidden State Sequence</div>
                  <div className={styles.pathGrid}>
                    {data.seq.split("").map((ch, i) => (
                      <div key={i} className={styles.pathCol}>
                        <span className={styles.pathBase}>{ch}</span>
                        <span
                          className={`${styles.pathState} ${
                            data.optimalPath[i] === 0 ? styles.pathIsland : styles.pathBg
                          }`}
                        >
                          {STATES[data.optimalPath[i]]}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className={styles.resultNote}>
                    <span className={styles.islandDot} /> + = CpG island &nbsp;|&nbsp;
                    <span className={styles.bgDot} /> − = background
                  </p>
                </div>
              )}

              <div className={styles.legend}>
                {[
                  { cls: styles.swCurrent, label: "Current cell" },
                  { cls: styles.swRevealed, label: "Filled" },
                  { cls: styles.swTraceback, label: "Optimal path" },
                  { cls: styles.swHidden, label: "Not yet filled" },
                ].map(({ cls, label }) => (
                  <div key={label} className={styles.legendItem}>
                    <span className={`${styles.swatch} ${cls}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
