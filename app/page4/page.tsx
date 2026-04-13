"use client";

import { useState } from "react";
import styles from "./page.module.css";

// ─── BLOSUM62 ─────────────────────────────────────────────────────────────────

const BL62: Record<string, Record<string, number>> = {
  A:{A:4,R:-1,N:-2,D:-2,C:0,Q:-1,E:-1,G:0,H:-2,I:-1,L:-1,K:-1,M:-1,F:-2,P:-1,S:1,T:0,W:-3,Y:-2,V:0},
  R:{A:-1,R:5,N:0,D:-2,C:-3,Q:1,E:0,G:-2,H:0,I:-3,L:-2,K:2,M:-1,F:-3,P:-2,S:-1,T:-1,W:-3,Y:-2,V:-3},
  N:{A:-2,R:0,N:6,D:1,C:-3,Q:0,E:0,G:0,H:1,I:-3,L:-3,K:0,M:-2,F:-3,P:-2,S:1,T:0,W:-4,Y:-2,V:-3},
  D:{A:-2,R:-2,N:1,D:6,C:-3,Q:0,E:2,G:-1,H:-1,I:-3,L:-4,K:-1,M:-3,F:-3,P:-1,S:0,T:-1,W:-4,Y:-3,V:-3},
  C:{A:0,R:-3,N:-3,D:-3,C:9,Q:-3,E:-4,G:-3,H:-3,I:-1,L:-1,K:-3,M:-1,F:-2,P:-3,S:-1,T:-1,W:-2,Y:-2,V:-1},
  Q:{A:-1,R:1,N:0,D:0,C:-3,Q:5,E:2,G:-2,H:0,I:-3,L:-2,K:1,M:0,F:-3,P:-1,S:0,T:-1,W:-2,Y:-1,V:-2},
  E:{A:-1,R:0,N:0,D:2,C:-4,Q:2,E:5,G:-2,H:0,I:-3,L:-3,K:1,M:-2,F:-3,P:-1,S:0,T:-1,W:-3,Y:-2,V:-2},
  G:{A:0,R:-2,N:0,D:-1,C:-3,Q:-2,E:-2,G:6,H:-2,I:-4,L:-4,K:-2,M:-3,F:-3,P:-2,S:0,T:-2,W:-2,Y:-3,V:-3},
  H:{A:-2,R:0,N:1,D:-1,C:-3,Q:0,E:0,G:-2,H:8,I:-3,L:-3,K:-1,M:-2,F:-1,P:-2,S:-1,T:-2,W:-2,Y:2,V:-3},
  I:{A:-1,R:-3,N:-3,D:-3,C:-1,Q:-3,E:-3,G:-4,H:-3,I:4,L:2,K:-3,M:1,F:0,P:-3,S:-2,T:-1,W:-3,Y:-1,V:3},
  L:{A:-1,R:-2,N:-3,D:-4,C:-1,Q:-2,E:-3,G:-4,H:-3,I:2,L:4,K:-2,M:2,F:0,P:-3,S:-2,T:-1,W:-2,Y:-1,V:1},
  K:{A:-1,R:2,N:0,D:-1,C:-3,Q:1,E:1,G:-2,H:-1,I:-3,L:-2,K:5,M:-1,F:-3,P:-1,S:0,T:-1,W:-3,Y:-2,V:-2},
  M:{A:-1,R:-1,N:-2,D:-3,C:-1,Q:0,E:-2,G:-3,H:-2,I:1,L:2,K:-1,M:5,F:0,P:-2,S:-1,T:-1,W:-1,Y:-1,V:1},
  F:{A:-2,R:-3,N:-3,D:-3,C:-2,Q:-3,E:-3,G:-3,H:-1,I:0,L:0,K:-3,M:0,F:6,P:-4,S:-2,T:-2,W:1,Y:3,V:-1},
  P:{A:-1,R:-2,N:-2,D:-1,C:-3,Q:-1,E:-1,G:-2,H:-2,I:-3,L:-3,K:-1,M:-2,F:-4,P:7,S:-1,T:-1,W:-4,Y:-3,V:-2},
  S:{A:1,R:-1,N:1,D:0,C:-1,Q:0,E:0,G:0,H:-1,I:-2,L:-2,K:0,M:-1,F:-2,P:-1,S:4,T:1,W:-3,Y:-2,V:-2},
  T:{A:0,R:-1,N:0,D:-1,C:-1,Q:-1,E:-1,G:-2,H:-2,I:-1,L:-1,K:-1,M:-1,F:-2,P:-1,S:1,T:5,W:-2,Y:-2,V:0},
  W:{A:-3,R:-3,N:-4,D:-4,C:-2,Q:-2,E:-3,G:-2,H:-2,I:-3,L:-2,K:-3,M:-1,F:1,P:-4,S:-3,T:-2,W:11,Y:2,V:-3},
  Y:{A:-2,R:-2,N:-2,D:-3,C:-2,Q:-1,E:-2,G:-3,H:2,I:-1,L:-1,K:-2,M:-1,F:3,P:-3,S:-2,T:-2,W:2,Y:7,V:-1},
  V:{A:0,R:-3,N:-3,D:-3,C:-1,Q:-2,E:-2,G:-3,H:-3,I:3,L:1,K:-2,M:1,F:-1,P:-2,S:-2,T:0,W:-3,Y:-1,V:4},
};

function bl62(a: string, b: string): number {
  return BL62[a]?.[b] ?? 0;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = "seed" | "right" | "left" | "done";

interface BlastStep {
  phase: Phase;
  qPos: number;    // -1 for seed / done
  sPos: number;
  subScore: number;
  runScore: number;
  maxScore: number;
  drop: number;
  atMax: boolean;
  stopped: boolean;
  description: string;
}

interface BlastData {
  query: string;
  subject: string;
  seedStr: string;
  qSeedStart: number;
  qSeedEnd: number;
  sSeedStart: number;
  sSeedEnd: number;
  seedScore: number;
  steps: BlastStep[];
  rightMaxScore: number;
  leftMaxScore: number;
  cumulativeScore: number;
  finalMaxScore: number;
  criticalDrop: number;
}

// ─── Algorithm ───────────────────────────────────────────────────────────────

function runBlast(
  query: string,
  subject: string,
  seedStr: string,
  criticalDrop: number
): BlastData | string {
  const qSeedStart = query.indexOf(seedStr);
  const sSeedStart = subject.indexOf(seedStr);

  if (qSeedStart === -1) return `Seed "${seedStr}" not found in Sequence 1.`;
  if (sSeedStart === -1) return `Seed "${seedStr}" not found in Sequence 2.`;

  const seedLen = seedStr.length;
  const qSeedEnd = qSeedStart + seedLen;
  const sSeedEnd = sSeedStart + seedLen;

  let seedScore = 0;
  for (let i = 0; i < seedLen; i++) {
    seedScore += bl62(query[qSeedStart + i], subject[sSeedStart + i]);
  }

  const steps: BlastStep[] = [];

  // Seed step
  steps.push({
    phase: "seed",
    qPos: -1, sPos: -1,
    subScore: seedScore,
    runScore: seedScore,
    maxScore: seedScore,
    drop: 0,
    atMax: true,
    stopped: false,
    description:
      `Seed "${seedStr}" found at Query positions ${qSeedStart + 1}–${qSeedEnd} ` +
      `and Subject positions ${sSeedStart + 1}–${sSeedEnd}. ` +
      `BLOSUM62 seed score = ${seedScore}. ` +
      `Extension begins from both ends of the seed.`,
  });

  // ── Right extension ──
  let rRun = seedScore, rMax = seedScore;

  for (let off = 0; ; off++) {
    const qp = qSeedEnd + off;
    const sp = sSeedEnd + off;
    if (qp >= query.length || sp >= subject.length) {
      steps.push({
        phase: "right", qPos: -1, sPos: -1,
        subScore: 0, runScore: rRun, maxScore: rMax, drop: rMax - rRun,
        atMax: false, stopped: false,
        description: `Right extension reached sequence boundary after ${off} step${off !== 1 ? "s" : ""}. Max score in right direction: ${rMax}.`,
      });
      break;
    }
    const sc = bl62(query[qp], subject[sp]);
    rRun += sc;
    const prevMax = rMax;
    if (rRun > rMax) rMax = rRun;
    const drop = rMax - rRun;
    const stopped = drop > criticalDrop;
    const atMax = rRun === rMax;
    const sign = sc > 0 ? "+" : "";
    steps.push({
      phase: "right", qPos: qp, sPos: sp,
      subScore: sc, runScore: rRun, maxScore: rMax, drop,
      atMax, stopped,
      description: stopped
        ? `Right extension: ${query[qp]} (Q${qp + 1}) vs ${subject[sp]} (S${sp + 1}) → BLOSUM62 ${sign}${sc}. Running = ${rRun}, Max = ${rMax}, Drop = ${drop} > X=${criticalDrop}. STOP — critical drop exceeded.`
        : atMax
        ? `Right extension: ${query[qp]} (Q${qp + 1}) vs ${subject[sp]} (S${sp + 1}) → BLOSUM62 ${sign}${sc}. Running = ${rRun}, Max = ${rMax} ▲ new max, Drop = 0.`
        : `Right extension: ${query[qp]} (Q${qp + 1}) vs ${subject[sp]} (S${sp + 1}) → BLOSUM62 ${sign}${sc}. Running = ${rRun}, Max = ${rMax}, Drop = ${drop}.`,
    });
    if (stopped) break;
  }

  const rightMaxScore = rMax;

  // ── Left extension ──
  let lRun = seedScore, lMax = seedScore;

  for (let off = 0; ; off++) {
    const qp = qSeedStart - 1 - off;
    const sp = sSeedStart - 1 - off;
    if (qp < 0 || sp < 0) {
      steps.push({
        phase: "left", qPos: -1, sPos: -1,
        subScore: 0, runScore: lRun, maxScore: lMax, drop: lMax - lRun,
        atMax: false, stopped: false,
        description: `Left extension reached sequence boundary after ${off} step${off !== 1 ? "s" : ""}. Max score in left direction: ${lMax}.`,
      });
      break;
    }
    const sc = bl62(query[qp], subject[sp]);
    lRun += sc;
    if (lRun > lMax) lMax = lRun;
    const drop = lMax - lRun;
    const stopped = drop > criticalDrop;
    const atMax = lRun === lMax;
    const sign = sc > 0 ? "+" : "";
    steps.push({
      phase: "left", qPos: qp, sPos: sp,
      subScore: sc, runScore: lRun, maxScore: lMax, drop,
      atMax, stopped,
      description: stopped
        ? `Left extension: ${query[qp]} (Q${qp + 1}) vs ${subject[sp]} (S${sp + 1}) → BLOSUM62 ${sign}${sc}. Running = ${lRun}, Max = ${lMax}, Drop = ${drop} > X=${criticalDrop}. STOP — critical drop exceeded.`
        : atMax
        ? `Left extension: ${query[qp]} (Q${qp + 1}) vs ${subject[sp]} (S${sp + 1}) → BLOSUM62 ${sign}${sc}. Running = ${lRun}, Max = ${lMax} ▲ new max, Drop = 0.`
        : `Left extension: ${query[qp]} (Q${qp + 1}) vs ${subject[sp]} (S${sp + 1}) → BLOSUM62 ${sign}${sc}. Running = ${lRun}, Max = ${lMax}, Drop = ${drop}.`,
    });
    if (stopped) break;
  }

  const leftMaxScore = lMax;
  const cumulativeScore = rightMaxScore + leftMaxScore - seedScore;
  const finalMaxScore = Math.max(rightMaxScore, leftMaxScore);

  steps.push({
    phase: "done", qPos: -1, sPos: -1,
    subScore: 0, runScore: cumulativeScore,
    maxScore: finalMaxScore, drop: 0,
    atMax: true, stopped: false,
    description:
      `Extension complete. ` +
      `Right direction max: ${rightMaxScore}. Left direction max: ${leftMaxScore}. ` +
      `Maximum score = ${finalMaxScore}. ` +
      `Cumulative alignment score = ${rightMaxScore} + ${leftMaxScore} − ${seedScore} (seed) = ${cumulativeScore}.`,
  });

  return {
    query, subject, seedStr,
    qSeedStart, qSeedEnd, sSeedStart, sSeedEnd,
    seedScore, steps,
    rightMaxScore, leftMaxScore, cumulativeScore, finalMaxScore,
    criticalDrop,
  };
}

// ─── Cell state helper ────────────────────────────────────────────────────────

type CellState = "none" | "seed" | "included" | "dropping" | "stop" | "current";

function getCellStates(
  data: BlastData,
  currentStep: number
): { qState: Map<number, CellState>; sState: Map<number, CellState> } {
  const qState = new Map<number, CellState>();
  const sState = new Map<number, CellState>();

  for (let i = data.qSeedStart; i < data.qSeedEnd; i++) qState.set(i, "seed");
  for (let i = data.sSeedStart; i < data.sSeedEnd; i++) sState.set(i, "seed");

  for (let si = 1; si <= currentStep && si < data.steps.length; si++) {
    const s = data.steps[si];
    if (s.qPos < 0) continue;
    const state: CellState = s.stopped ? "stop" : s.atMax ? "included" : "dropping";
    qState.set(s.qPos, state);
    if (s.sPos >= 0) sState.set(s.sPos, state);
  }

  const cur = data.steps[currentStep];
  if (cur && cur.qPos >= 0) {
    qState.set(cur.qPos, "current");
    if (cur.sPos >= 0) sState.set(cur.sPos, "current");
  }

  return { qState, sState };
}

// ─── Component ────────────────────────────────────────────────────────────────

const AA_REGEX = /^[ACDEFGHIKLMNPQRSTVWY]+$/i;
const VALID_AA = new Set("ACDEFGHIKLMNPQRSTVWY");

export default function BlastPage() {
  const [seq1, setSeq1] = useState("ARWILKDFGG");
  const [seq2, setSeq2] = useState("DRWILKDQQQ");
  const [seedInput, setSeedInput] = useState("WIL");
  const [threshold, setThreshold] = useState(11);
  const [minScore, setMinScore] = useState(15);
  const [critDrop, setCritDrop] = useState(5);
  const [data, setData] = useState<BlastData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");

  const handleRun = () => {
    if (data) { setData(null); setCurrentStep(0); setError(""); return; }

    const q = seq1.trim().toUpperCase();
    const s = seq2.trim().toUpperCase();
    const seed = seedInput.trim().toUpperCase();

    if (!q || !s) { setError("Please enter both sequences."); return; }
    if (!seed || seed.length !== 3) { setError("Seed must be exactly 3 amino acids."); return; }
    if (!AA_REGEX.test(q) || !AA_REGEX.test(s) || !AA_REGEX.test(seed)) {
      setError("Only standard amino acid letters allowed (A C D E F G H I K L M N P Q R S T V W Y).");
      return;
    }
    if (q.length > 20 || s.length > 20) { setError("Please keep sequences to 20 characters or fewer."); return; }

    const result = runBlast(q, s, seed, critDrop);
    if (typeof result === "string") { setError(result); return; }

    const seedScore = result.seedScore;
    if (seedScore < threshold) {
      setError(`Seed "${seed}" scores ${seedScore} in BLOSUM62, which is below the threshold T = ${threshold}. Try a different seed or lower the threshold.`);
      return;
    }

    setError("");
    setData(result);
    setCurrentStep(0);
  };

  const step = data?.steps[currentStep];
  const totalSteps = data?.steps.length ?? 0;
  const done = data !== null && currentStep === totalSteps - 1;

  // Sequence display cells
  const renderSeqRow = (
    seq: string,
    stateMap: Map<number, CellState>,
    label: string
  ) => (
    <div className={styles.seqRow}>
      <span className={styles.seqLabel}>{label}</span>
      <div className={styles.seqCells}>
        {Array.from(seq).map((aa, i) => {
          const cs = stateMap.get(i) ?? "none";
          return (
            <div key={i} className={`${styles.cell} ${styles[`cell_${cs}`]}`}>
              <span className={styles.cellPos}>{i + 1}</span>
              <span className={styles.cellAA}>{aa}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const { qState, sState } = data
    ? getCellStates(data, currentStep)
    : { qState: new Map(), sState: new Map() };

  // Build table rows up to currentStep (excluding seed step 0 and boundary steps)
  const tableRows = data
    ? data.steps.slice(1, currentStep + 1).filter((s) => s.qPos >= 0)
    : [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>BLAST Seed Extension</h1>
        <p className={styles.subtitle}>
          Ungapped extension with BLOSUM62 scoring and X-drop termination
        </p>
      </div>

      <div className={styles.workspace}>
        {/* ── Control Panel ── */}
        <div className={styles.controlPanel}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Sequence 1 (Query)</label>
            <input
              className={styles.seqInput}
              value={seq1}
              onChange={(e) => setSeq1(e.target.value.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, ""))}
              placeholder="e.g. ARWILKDFGG"
              maxLength={20}
              spellCheck={false}
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Sequence 2 (Subject)</label>
            <input
              className={styles.seqInput}
              value={seq2}
              onChange={(e) => setSeq2(e.target.value.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, ""))}
              placeholder="e.g. DRWILKDQQQ"
              maxLength={20}
              spellCheck={false}
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Starting Seed (3 AA)</label>
            <input
              className={styles.seqInput}
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, ""))}
              placeholder="e.g. WIL"
              maxLength={3}
              spellCheck={false}
            />
          </div>

          <div className={styles.scoringBox}>
            <div className={styles.scoringTitle}>Parameters</div>
            {[
              { label: "Threshold (T)", value: threshold, set: setThreshold, tip: "Min seed BLOSUM62 score" },
              { label: "Min Score", value: minScore, set: setMinScore, tip: "Min score to report" },
              { label: "Critical Drop (X)", value: critDrop, set: setCritDrop, tip: "Max drop before stop" },
            ].map(({ label, value, set, tip }) => (
              <div key={label} className={styles.paramRow}>
                <div>
                  <div className={styles.paramLabel}>{label}</div>
                  <div className={styles.paramTip}>{tip}</div>
                </div>
                <input
                  type="number"
                  className={styles.paramInput}
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
            {data ? "Reset" : "Run Extension"}
          </button>

          {data && (
            <>
              <div className={styles.stepInfo}>
                <span className={styles.stepCount}>Step {currentStep + 1} / {totalSteps}</span>
                <span className={styles.phaseTag} data-phase={step?.phase}>
                  {step?.phase === "seed" ? "Seed" : step?.phase === "right" ? "→ Right" : step?.phase === "left" ? "← Left" : "Complete"}
                </span>
              </div>
              <div className={styles.navBtns}>
                <button className={styles.navBtn} onClick={() => setCurrentStep((s) => Math.max(0, s - 1))} disabled={currentStep === 0}>← Prev</button>
                <button className={styles.navBtn} onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))} disabled={currentStep === totalSteps - 1}>Next →</button>
              </div>
              <p className={styles.description}>{step?.description}</p>
            </>
          )}

          {/* Legend */}
          <div className={styles.legend}>
            {[
              { cls: styles.cell_seed,     label: "Seed" },
              { cls: styles.cell_included, label: "Included (at max)" },
              { cls: styles.cell_dropping, label: "Dropping" },
              { cls: styles.cell_stop,     label: "Stop (drop > X)" },
              { cls: styles.cell_current,  label: "Current position" },
            ].map(({ cls, label }) => (
              <div key={label} className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${cls}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Visualization Panel ── */}
        <div className={styles.visPanel}>
          {!data ? (
            <div className={styles.placeholder}>
              Enter two amino acid sequences, specify a 3-AA seed, and click{" "}
              <strong>Run Extension</strong> to begin.
            </div>
          ) : (
            <>
              {/* Sequence rows */}
              <div className={styles.seqDisplay}>
                {renderSeqRow(data.query, qState, "Query  ")}
                {renderSeqRow(data.subject, sState, "Subject")}
              </div>

              {/* Score tracker */}
              {step && step.phase !== "done" && (
                <div className={styles.scoreTracker}>
                  {step.phase === "seed" ? (
                    <>
                      <div className={styles.scoreItem}>
                        <div className={styles.scoreLabel}>Seed Score</div>
                        <div className={styles.scoreVal}>{data.seedScore}</div>
                      </div>
                      <div className={styles.scoreItem}>
                        <div className={styles.scoreLabel}>Threshold</div>
                        <div className={styles.scoreVal}>{threshold}</div>
                      </div>
                      <div className={styles.scoreItem}>
                        <div className={styles.scoreLabel}>Critical Drop (X)</div>
                        <div className={styles.scoreVal}>{critDrop}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.scoreItem}>
                        <div className={styles.scoreLabel}>BLOSUM62</div>
                        <div className={styles.scoreVal} style={{ color: step.subScore < 0 ? "#b91c1c" : step.subScore > 0 ? "#065f46" : undefined }}>
                          {step.subScore > 0 ? "+" : ""}{step.subScore}
                        </div>
                      </div>
                      <div className={styles.scoreItem}>
                        <div className={styles.scoreLabel}>Running</div>
                        <div className={styles.scoreVal}>{step.runScore}</div>
                      </div>
                      <div className={styles.scoreItem}>
                        <div className={styles.scoreLabel}>Max</div>
                        <div className={styles.scoreVal}>{step.maxScore}</div>
                      </div>
                      <div className={styles.scoreItem}>
                        <div className={styles.scoreLabel}>Drop</div>
                        <div className={styles.scoreVal} style={{ color: step.drop > critDrop ? "#b91c1c" : step.drop > critDrop * 0.6 ? "#d97706" : undefined }}>
                          {step.drop} / {critDrop}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Extension log table */}
              {tableRows.length > 0 && (
                <div className={styles.tableWrap}>
                  <table className={styles.logTable}>
                    <thead>
                      <tr>
                        <th>Dir</th>
                        <th>Q pos</th>
                        <th>Q</th>
                        <th>S pos</th>
                        <th>S</th>
                        <th>BLOSUM62</th>
                        <th>Running</th>
                        <th>Max</th>
                        <th>Drop</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((s, i) => (
                        <tr
                          key={i}
                          className={
                            s.stopped ? styles.rowStop :
                            s.atMax ? styles.rowMax :
                            styles.rowDrop
                          }
                        >
                          <td>{s.phase === "right" ? "→" : "←"}</td>
                          <td>{s.qPos + 1}</td>
                          <td className={styles.aaCell}>{data.query[s.qPos]}</td>
                          <td>{s.sPos + 1}</td>
                          <td className={styles.aaCell}>{data.subject[s.sPos]}</td>
                          <td style={{ color: s.subScore < 0 ? "#b91c1c" : s.subScore > 0 ? "#065f46" : undefined, fontWeight: 600 }}>
                            {s.subScore > 0 ? "+" : ""}{s.subScore}
                          </td>
                          <td>{s.runScore}</td>
                          <td>{s.maxScore}</td>
                          <td style={{ color: s.drop > critDrop * 0.6 ? "#d97706" : undefined, fontWeight: s.stopped ? 700 : 400 }}>
                            {s.drop}
                          </td>
                          <td>{s.stopped ? "✗ STOP" : s.atMax ? "▲ max" : "↓ drop"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Final result */}
              {done && (
                <div className={styles.resultBox}>
                  <div className={styles.resultTitle}>Extension Complete</div>
                  <div className={styles.resultGrid}>
                    <div className={styles.resultItem}>
                      <div className={styles.resultLabel}>Seed Score</div>
                      <div className={styles.resultVal}>{data.seedScore}</div>
                    </div>
                    <div className={styles.resultItem}>
                      <div className={styles.resultLabel}>Right Max</div>
                      <div className={styles.resultVal}>{data.rightMaxScore}</div>
                    </div>
                    <div className={styles.resultItem}>
                      <div className={styles.resultLabel}>Left Max</div>
                      <div className={styles.resultVal}>{data.leftMaxScore}</div>
                    </div>
                    <div className={`${styles.resultItem} ${styles.resultHighlight}`}>
                      <div className={styles.resultLabel}>Maximum Score</div>
                      <div className={styles.resultVal}>{data.finalMaxScore}</div>
                    </div>
                    <div className={`${styles.resultItem} ${styles.resultHighlight}`}>
                      <div className={styles.resultLabel}>Cumulative Score</div>
                      <div className={styles.resultVal}>{data.cumulativeScore}</div>
                    </div>
                    <div className={styles.resultItem}>
                      <div className={styles.resultLabel}>Reported?</div>
                      <div className={styles.resultVal} style={{ color: data.cumulativeScore >= minScore ? "#065f46" : "#b91c1c" }}>
                        {data.cumulativeScore >= minScore ? "Yes ✓" : `No (< min ${minScore})`}
                      </div>
                    </div>
                  </div>
                  <p className={styles.resultFormula}>
                    Cumulative = right max ({data.rightMaxScore}) + left max ({data.leftMaxScore}) − seed ({data.seedScore}) = <strong>{data.cumulativeScore}</strong>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
