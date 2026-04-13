"use client";

import { useState } from "react";
import styles from "./page.module.css";

type Phase = "init" | "fill" | "traceback";

interface AlignStep {
  row: number;
  col: number;
  phase: Phase;
  description: string;
}

interface AlignmentData {
  seq1: string;
  seq2: string;
  matrix: number[][];
  steps: AlignStep[];
  cellRevealedAt: Map<string, number>;
  tracebackCellAt: Map<string, number>;
  aligned1: string;
  aligned2: string;
  score: number;
}

function buildAlignment(
  seq1: string,
  seq2: string,
  match: number,
  mismatch: number,
  gap: number
): AlignmentData {
  const m = seq1.length;
  const n = seq2.length;
  const mat: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  const steps: AlignStep[] = [];

  // ── Initialization ──
  mat[0][0] = 0;
  steps.push({
    row: 0, col: 0, phase: "init",
    description:
      "Initialize cell (0, 0) = 0. This is the starting point — no characters have been aligned yet, so the cost is zero.",
  });

  for (let i = 1; i <= m; i++) {
    mat[i][0] = i * gap;
    steps.push({
      row: i, col: 0, phase: "init",
      description:
        `Initialize cell (${i}, 0) = ${i} × gap (${gap}) = ${mat[i][0]}. ` +
        `This represents aligning the first ${i} character${i > 1 ? "s" : ""} of Seq 1 ` +
        `against ${i} gap${i > 1 ? "s" : ""} in Seq 2.`,
    });
  }

  for (let j = 1; j <= n; j++) {
    mat[0][j] = j * gap;
    steps.push({
      row: 0, col: j, phase: "init",
      description:
        `Initialize cell (0, ${j}) = ${j} × gap (${gap}) = ${mat[0][j]}. ` +
        `This represents aligning ${j} gap${j > 1 ? "s" : ""} in Seq 1 against the first ` +
        `${j} character${j > 1 ? "s" : ""} of Seq 2.`,
    });
  }

  // ── Fill ──
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const isMatch = seq1[i - 1] === seq2[j - 1];
      const diagScore = mat[i - 1][j - 1] + (isMatch ? match : mismatch);
      const upScore = mat[i - 1][j] + gap;
      const leftScore = mat[i][j - 1] + gap;
      mat[i][j] = Math.max(diagScore, upScore, leftScore);

      const sources: string[] = [];
      if (diagScore === mat[i][j])
        sources.push(
          `diagonal (${isMatch ? "match" : "mismatch"} '${seq1[i - 1]}'↔'${seq2[j - 1]}': ` +
            `${mat[i - 1][j - 1]} + ${isMatch ? match : mismatch} = ${diagScore})`
        );
      if (upScore === mat[i][j])
        sources.push(`up (gap: ${mat[i - 1][j]} + ${gap} = ${upScore})`);
      if (leftScore === mat[i][j])
        sources.push(`left (gap: ${mat[i][j - 1]} + ${gap} = ${leftScore})`);

      steps.push({
        row: i, col: j, phase: "fill",
        description:
          `Fill cell (${i}, ${j}): comparing '${seq1[i - 1]}' (Seq 1) with '${seq2[j - 1]}' (Seq 2). ` +
          `Score = ${mat[i][j]}, chosen from ${sources.join(" or ")}.`,
      });
    }
  }

  // ── Traceback ──
  let i = m, j = n;
  let a1 = "", a2 = "";

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const isMatch = seq1[i - 1] === seq2[j - 1];
      const diagScore = mat[i - 1][j - 1] + (isMatch ? match : mismatch);
      if (mat[i][j] === diagScore) {
        a1 = seq1[i - 1] + a1;
        a2 = seq2[j - 1] + a2;
        steps.push({
          row: i, col: j, phase: "traceback",
          description:
            `Traceback (${i}, ${j}) → diagonal: '${seq1[i - 1]}' aligned with '${seq2[j - 1]}' — ` +
            `${isMatch ? "match ✓" : "mismatch"}.`,
        });
        i--; j--;
        continue;
      }
    }
    if (i > 0 && mat[i][j] === mat[i - 1][j] + gap) {
      a1 = seq1[i - 1] + a1;
      a2 = "-" + a2;
      steps.push({
        row: i, col: j, phase: "traceback",
        description: `Traceback (${i}, ${j}) → up: '${seq1[i - 1]}' in Seq 1 aligned with a gap '-' in Seq 2.`,
      });
      i--;
      continue;
    }
    a1 = "-" + a1;
    a2 = seq2[j - 1] + a2;
    steps.push({
      row: i, col: j, phase: "traceback",
      description: `Traceback (${i}, ${j}) → left: gap '-' in Seq 1 aligned with '${seq2[j - 1]}' in Seq 2.`,
    });
    j--;
  }

  steps.push({
    row: 0, col: 0, phase: "traceback",
    description:
      "Traceback complete — reached (0, 0). The optimal global alignment has been found!",
  });

  // Build lookup maps for O(1) rendering queries
  const cellRevealedAt = new Map<string, number>();
  const tracebackCellAt = new Map<string, number>();
  steps.forEach((s, idx) => {
    const key = `${s.row},${s.col}`;
    if (s.phase !== "traceback" && !cellRevealedAt.has(key))
      cellRevealedAt.set(key, idx);
    if (s.phase === "traceback" && !tracebackCellAt.has(key))
      tracebackCellAt.set(key, idx);
  });

  return {
    seq1, seq2,
    matrix: mat,
    steps,
    cellRevealedAt,
    tracebackCellAt,
    aligned1: a1,
    aligned2: a2,
    score: mat[m][n],
  };
}

export default function GlobalAlignmentPage() {
  const [seq1Input, setSeq1Input] = useState("ATGCTA");
  const [seq2Input, setSeq2Input] = useState("ATCTA");
  const [matchScore, setMatchScore] = useState(1);
  const [mismatchScore, setMismatchScore] = useState(-1);
  const [gapPenalty, setGapPenalty] = useState(-2);
  const [data, setData] = useState<AlignmentData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");

  const handleRun = () => {
    if (data) {
      // Reset
      setData(null);
      setCurrentStep(0);
      setError("");
      return;
    }
    const s1 = seq1Input.trim().toUpperCase();
    const s2 = seq2Input.trim().toUpperCase();
    if (!s1 || !s2) { setError("Please enter both sequences."); return; }
    if (!/^[ACGT]+$/.test(s1) || !/^[ACGT]+$/.test(s2)) {
      setError("Sequences may only contain A, C, G, T.");
      return;
    }
    if (s1.length > 12 || s2.length > 12) {
      setError("Please keep sequences to 12 characters or fewer.");
      return;
    }
    setError("");
    setData(buildAlignment(s1, s2, matchScore, mismatchScore, gapPenalty));
    setCurrentStep(0);
  };

  const step = data?.steps[currentStep];
  const totalSteps = data?.steps.length ?? 0;
  const done = data !== null && currentStep === totalSteps - 1;

  const isRevealed = (r: number, c: number) => {
    if (!data) return false;
    const idx = data.cellRevealedAt.get(`${r},${c}`);
    return idx !== undefined && idx <= currentStep;
  };
  const isTraceback = (r: number, c: number) => {
    if (!data) return false;
    const idx = data.tracebackCellAt.get(`${r},${c}`);
    return idx !== undefined && idx <= currentStep;
  };
  const isCurrent = (r: number, c: number) =>
    !!step && step.row === r && step.col === c;

  const matchLine = data
    ? data.aligned1
        .split("")
        .map((ch, idx) =>
          ch !== "-" && ch === data.aligned2[idx] ? "|" : " "
        )
        .join("")
    : "";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Global Alignment</h1>
        <p className={styles.subtitle}>
          Needleman–Wunsch Algorithm — step-by-step visualization
        </p>
      </div>

      <div className={styles.workspace}>
        {/* ── Control Panel ── */}
        <div className={styles.controlPanel}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Sequence 1</label>
            <input
              className={styles.seqInput}
              value={seq1Input}
              onChange={(e) => setSeq1Input(e.target.value.toUpperCase())}
              placeholder="e.g. ATGCTA"
              maxLength={12}
              spellCheck={false}
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Sequence 2</label>
            <input
              className={styles.seqInput}
              value={seq2Input}
              onChange={(e) => setSeq2Input(e.target.value.toUpperCase())}
              placeholder="e.g. ATCTA"
              maxLength={12}
              spellCheck={false}
            />
          </div>

          <div className={styles.scoringBox}>
            <div className={styles.scoringTitle}>Scoring Parameters</div>
            {[
              { label: "Match", value: matchScore, set: setMatchScore },
              { label: "Mismatch", value: mismatchScore, set: setMismatchScore },
              { label: "Gap", value: gapPenalty, set: setGapPenalty },
            ].map(({ label, value, set }) => (
              <div key={label} className={styles.scoringRow}>
                <span className={styles.scoringLabel}>{label}</span>
                <input
                  type="number"
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
            {data ? "Reset" : "Run Alignment"}
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
                    ? "Matrix Fill"
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
                  onClick={() =>
                    setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))
                  }
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
              Enter two DNA sequences and click{" "}
              <strong>Run Alignment</strong> to begin the step-by-step
              visualization.
            </div>
          ) : (
            <>
              <div className={styles.matrixScroll}>
                <table className={styles.matrix}>
                  <thead>
                    <tr>
                      <th className={styles.hCell} />
                      <th className={styles.hCell} />
                      {data.seq2.split("").map((ch, j) => (
                        <th key={j} className={styles.hCell}>
                          {ch}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.matrix.map((row, i) => (
                      <tr key={i}>
                        <th className={styles.hCell}>
                          {i === 0 ? "" : data.seq1[i - 1]}
                        </th>
                        {row.map((val, j) => {
                          const cur = isCurrent(i, j);
                          const tb = isTraceback(i, j);
                          const rev = isRevealed(i, j);
                          const cls = cur
                            ? styles.cellCurrent
                            : tb
                            ? styles.cellTraceback
                            : rev
                            ? styles.cellRevealed
                            : styles.cellHidden;
                          return (
                            <td key={j} className={`${styles.cell} ${cls}`}>
                              {cur || tb || rev ? val : ""}
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
                  <div className={styles.resultTitle}>
                    Optimal Alignment — Score: {data.score}
                  </div>
                  <pre className={styles.alnPre}>
                    <span className={styles.alnLabel}>Seq 1  </span>
                    {data.aligned1}
                    {"\n"}
                    <span className={styles.alnLabel}>       </span>
                    {matchLine}
                    {"\n"}
                    <span className={styles.alnLabel}>Seq 2  </span>
                    {data.aligned2}
                  </pre>
                </div>
              )}

              <div className={styles.legend}>
                {[
                  { cls: styles.swCurrent, label: "Current cell" },
                  { cls: styles.swRevealed, label: "Filled" },
                  { cls: styles.swTraceback, label: "Traceback path" },
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
