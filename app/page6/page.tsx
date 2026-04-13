"use client";

import { useState } from "react";
import styles from "./page.module.css";

interface TreeNode {
  name: string;
  height: number;
  left?: TreeNode;
  right?: TreeNode;
  size: number;
}

type StepPhase = "initial" | "find" | "merge" | "done";

interface UPGMAStep {
  matrix: number[][];
  labels: string[];
  highlightI: number;
  highlightJ: number;
  phase: StepPhase;
  description: string;
  tree?: TreeNode;
}

function getLeafOrder(node: TreeNode): string[] {
  if (!node.left && !node.right) return [node.name];
  return [...getLeafOrder(node.left!), ...getLeafOrder(node.right!)];
}

function buildUPGMA(names: string[], inputDist: number[][]): UPGMAStep[] {
  const steps: UPGMAStep[] = [];
  let labels = [...names];
  let matrix = inputDist.map((r) => [...r]);
  let nodes: TreeNode[] = labels.map((name) => ({ name, height: 0, size: 1 }));

  // Step 0: show initial matrix
  steps.push({
    matrix: matrix.map((r) => [...r]),
    labels: [...labels],
    highlightI: -1,
    highlightJ: -1,
    phase: "initial",
    description:
      "Initial distance matrix. Each cell shows the pairwise distance between two taxa. Find the minimum off-diagonal value to begin.",
  });

  while (labels.length > 1) {
    // Find minimum
    let minDist = Infinity;
    let minI = 0, minJ = 1;
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        if (matrix[i][j] < minDist) {
          minDist = matrix[i][j];
          minI = i;
          minJ = j;
        }
      }
    }

    // Step: highlight minimum pair
    steps.push({
      matrix: matrix.map((r) => [...r]),
      labels: [...labels],
      highlightI: minI,
      highlightJ: minJ,
      phase: "find",
      description:
        `Minimum distance = ${minDist.toFixed(3)} between "${labels[minI]}" and "${labels[minJ]}". ` +
        `These two taxa will be merged into a new node at height ${(minDist / 2).toFixed(3)} (= d/2).`,
    });

    // Merge
    const height = minDist / 2;
    const ni = nodes[minI];
    const nj = nodes[minJ];
    const newNode: TreeNode = {
      name: `(${labels[minI]},${labels[minJ]})`,
      height,
      left: ni,
      right: nj,
      size: ni.size + nj.size,
    };

    // Compute new distances (weighted average)
    const remaining: number[] = [];
    const remLabels: string[] = [];
    const remNodes: TreeNode[] = [];
    for (let k = 0; k < labels.length; k++) {
      if (k === minI || k === minJ) continue;
      const d =
        (matrix[minI][k] * ni.size + matrix[minJ][k] * nj.size) /
        (ni.size + nj.size);
      remaining.push(d);
      remLabels.push(labels[k]);
      remNodes.push(nodes[k]);
    }

    const newSize = remLabels.length + 1;
    const newMatrix: number[][] = Array.from({ length: newSize }, () =>
      new Array(newSize).fill(0)
    );
    // New node is index 0; remaining taxa fill 1..n
    for (let a = 0; a < remLabels.length; a++) {
      newMatrix[0][a + 1] = remaining[a];
      newMatrix[a + 1][0] = remaining[a];
    }
    for (let a = 0; a < remLabels.length; a++) {
      for (let b = 0; b < remLabels.length; b++) {
        const oldA = labels.indexOf(remLabels[a]);
        const oldB = labels.indexOf(remLabels[b]);
        newMatrix[a + 1][b + 1] = matrix[oldA][oldB];
      }
    }

    const newLabels = [newNode.name, ...remLabels];
    const newNodes = [newNode, ...remNodes];

    const isDone = newLabels.length === 1;
    const finalTree = isDone ? newNode : undefined;

    const distUpdates = remLabels
      .map((l, i) => `d(new,${l})=${remaining[i].toFixed(3)}`)
      .join(", ");

    steps.push({
      matrix: newMatrix,
      labels: newLabels,
      highlightI: 0,
      highlightJ: -1,
      phase: isDone ? "done" : "merge",
      description: isDone
        ? `Final merge! "${labels[minI]}" and "${labels[minJ]}" joined at height ${height.toFixed(3)}. Tree construction complete.`
        : `Merged "${labels[minI]}" and "${labels[minJ]}" → new node at height ${height.toFixed(3)}. ` +
          `Updated distances: ${distUpdates}. Reduced matrix from ${labels.length}×${labels.length} to ${newLabels.length}×${newLabels.length}.`,
      tree: finalTree,
    });

    labels = newLabels;
    matrix = newMatrix;
    nodes = newNodes;
  }

  // Attach final tree to last step if not already set
  if (steps[steps.length - 1].phase === "done" && nodes[0]) {
    steps[steps.length - 1].tree = nodes[0];
  }

  return steps;
}

// ── SVG Dendrogram ──────────────────────────────────────────────
function Dendrogram({ tree }: { tree: TreeNode }) {
  const W = 420;
  const PAD_LEFT = 16;
  const PAD_RIGHT = 100;
  const PAD_V = 24;
  const leafOrder = getLeafOrder(tree);
  const n = leafOrder.length;
  const H = Math.max(160, n * 44 + PAD_V * 2);

  // Find max height for scaling
  function maxH(node: TreeNode): number {
    return Math.max(
      node.height,
      node.left ? maxH(node.left) : 0,
      node.right ? maxH(node.right) : 0
    );
  }
  const maxHeight = maxH(tree) || 1;

  const xScale = (h: number) =>
    PAD_LEFT + (h / maxHeight) * (W - PAD_LEFT - PAD_RIGHT);

  const leafY = new Map<string, number>();
  leafOrder.forEach((name, i) => {
    leafY.set(name, PAD_V + i * ((H - PAD_V * 2) / Math.max(n - 1, 1)));
  });

  function getY(node: TreeNode): number {
    if (!node.left && !node.right) return leafY.get(node.name) ?? 0;
    return (getY(node.left!) + getY(node.right!)) / 2;
  }

  const lines: React.ReactNode[] = [];
  let key = 0;

  function renderNode(node: TreeNode) {
    const x = xScale(node.height);
    const y = getY(node);

    if (node.left && node.right) {
      const xl = xScale(node.left.height);
      const xr = xScale(node.right.height);
      const yl = getY(node.left);
      const yr = getY(node.right);

      // Vertical connector at this node's x
      lines.push(
        <line key={key++} x1={x} y1={yl} x2={x} y2={yr} stroke="#1e3a5f" strokeWidth={2} />
      );
      // Horizontal to left child
      lines.push(
        <line key={key++} x1={x} y1={yl} x2={xl} y2={yl} stroke="#1e3a5f" strokeWidth={2} />
      );
      // Horizontal to right child
      lines.push(
        <line key={key++} x1={x} y1={yr} x2={xr} y2={yr} stroke="#1e3a5f" strokeWidth={2} />
      );

      renderNode(node.left);
      renderNode(node.right);
    } else {
      // Leaf: horizontal line to right edge
      lines.push(
        <line key={key++} x1={x} y1={y} x2={W - PAD_RIGHT + 4} y2={y} stroke="#1e3a5f" strokeWidth={2} />
      );
      lines.push(
        <circle key={key++} cx={x} cy={y} r={3} fill="#1e3a5f" />
      );
      lines.push(
        <text
          key={key++}
          x={W - PAD_RIGHT + 10}
          y={y + 4}
          fontSize={12}
          fill="#0a1628"
          fontFamily='"Courier New", monospace'
          fontWeight={700}
        >
          {node.name}
        </text>
      );
    }
  }

  renderNode(tree);

  // Root tick line from left edge to root node
  const rootX = xScale(tree.height);
  const rootY = getY(tree);
  lines.push(
    <line key={key++} x1={PAD_LEFT} y1={rootY} x2={rootX} y2={rootY} stroke="#1e3a5f" strokeWidth={2} />
  );
  lines.push(
    <circle key={key++} cx={rootX} cy={rootY} r={4} fill="#1e3a5f" />
  );

  // Height axis ticks
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const h = (maxHeight / tickCount) * i;
    const tx = xScale(h);
    lines.push(
      <line key={key++} x1={tx} y1={H - 10} x2={tx} y2={H - 4} stroke="#8aaccc" strokeWidth={1} />
    );
    lines.push(
      <text key={key++} x={tx} y={H} textAnchor="middle" fontSize={9} fill="#8aaccc">
        {h.toFixed(1)}
      </text>
    );
  }

  return (
    <svg width={W} height={H} className={styles.treeSvg}>
      {lines}
    </svg>
  );
}

// ── Main Component ───────────────────────────────────────────────
const DEFAULT_NAMES = ["Human", "Chimp", "Gorilla", "Orang"];
const DEFAULT_DIST = [
  [0, 4, 6, 10],
  [4, 0, 6, 10],
  [6, 6, 0, 10],
  [10, 10, 10, 0],
];

export default function UPGMAPage() {
  const [names, setNames] = useState<string[]>([...DEFAULT_NAMES]);
  const [dist, setDist] = useState<number[][]>(DEFAULT_DIST.map((r) => [...r]));
  const [steps, setSteps] = useState<UPGMAStep[] | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");

  const n = names.length;

  const handleRun = () => {
    if (steps) {
      setSteps(null);
      setCurrentStep(0);
      setError("");
      return;
    }
    for (const name of names) {
      if (!name.trim()) { setError("All taxon names must be non-empty."); return; }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j && dist[i][j] <= 0) {
          setError("All pairwise distances must be positive."); return;
        }
        if (Math.abs(dist[i][j] - dist[j][i]) > 1e-9) {
          setError("Distance matrix must be symmetric."); return;
        }
      }
    }
    setError("");
    setSteps(buildUPGMA(names, dist));
    setCurrentStep(0);
  };

  const setName = (i: number, val: string) => {
    const next = [...names];
    next[i] = val;
    setNames(next);
  };

  const setDistVal = (i: number, j: number, val: number) => {
    const next = dist.map((r) => [...r]);
    next[i][j] = val;
    next[j][i] = val;
    setDist(next);
  };

  const step = steps?.[currentStep];
  const totalSteps = steps?.length ?? 0;
  const done = steps !== null && currentStep === totalSteps - 1;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>UPGMA Tree Building</h1>
        <p className={styles.subtitle}>
          Unweighted Pair Group Method with Arithmetic Mean — step-by-step
        </p>
      </div>

      <div className={styles.workspace}>
        {/* ── Control Panel ── */}
        <div className={styles.controlPanel}>
          <div className={styles.sectionTitle}>Taxon Names</div>
          {names.map((name, i) => (
            <div key={i} className={styles.inputGroup}>
              <label className={styles.label}>Taxon {i + 1}</label>
              <input
                className={styles.taxonInput}
                value={name}
                onChange={(e) => setName(i, e.target.value)}
                placeholder={`Taxon ${i + 1}`}
                maxLength={12}
                spellCheck={false}
              />
            </div>
          ))}

          <div className={styles.sectionTitle}>Distances (upper triangle)</div>
          <div className={styles.distGrid}>
            {names.map((ni, i) =>
              names.map((nj, j) => {
                if (j <= i) return null;
                return (
                  <div key={`${i}-${j}`} className={styles.distRow}>
                    <span className={styles.distLabel}>
                      {ni.slice(0, 3)}↔{nj.slice(0, 3)}
                    </span>
                    <input
                      type="number"
                      min="0.1"
                      step="0.5"
                      className={styles.distInput}
                      value={dist[i][j]}
                      onChange={(e) => setDistVal(i, j, Number(e.target.value))}
                    />
                  </div>
                );
              })
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={steps ? styles.resetBtn : styles.runBtn}
            onClick={handleRun}
          >
            {steps ? "Reset" : "Build Tree"}
          </button>

          {steps && (
            <>
              <div className={styles.stepInfo}>
                <span className={styles.stepCount}>
                  Step {currentStep + 1} / {totalSteps}
                </span>
                <span className={styles.phaseTag} data-phase={step?.phase}>
                  {step?.phase === "initial"
                    ? "Initial"
                    : step?.phase === "find"
                    ? "Find Min"
                    : step?.phase === "merge"
                    ? "Merge"
                    : "Done"}
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

        {/* ── Main Panel ── */}
        <div className={styles.matrixPanel}>
          {!steps ? (
            <div className={styles.placeholder}>
              Set taxon names and distances, then click{" "}
              <strong>Build Tree</strong> to begin the step-by-step
              visualization.
            </div>
          ) : (
            <>
              {step && (
                <>
                  <div className={styles.matrixLabel}>Distance Matrix</div>
                  <div className={styles.matrixScroll}>
                    <table className={styles.matrix}>
                      <thead>
                        <tr>
                          <th className={styles.hCell} />
                          {step.labels.map((l, j) => (
                            <th key={j} className={styles.hCell}>
                              {l.length > 8 ? l.slice(0, 7) + "…" : l}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {step.matrix.map((row, i) => (
                          <tr key={i}>
                            <th className={styles.hCell}>
                              {step.labels[i].length > 8
                                ? step.labels[i].slice(0, 7) + "…"
                                : step.labels[i]}
                            </th>
                            {row.map((val, j) => {
                              const isMin =
                                step.phase === "find" &&
                                ((i === step.highlightI && j === step.highlightJ) ||
                                  (i === step.highlightJ && j === step.highlightI));
                              const isNew =
                                (step.phase === "merge" || step.phase === "done") &&
                                (i === 0 || j === 0) &&
                                i !== j;
                              const isDiag = i === j;
                              const cls = isDiag
                                ? styles.cellDiag
                                : isMin
                                ? styles.cellMin
                                : isNew
                                ? styles.cellNew
                                : styles.cellRevealed;
                              return (
                                <td key={j} className={`${styles.cell} ${cls}`}>
                                  {isDiag ? "—" : val.toFixed(2)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {done && step?.tree && (
                <div className={styles.resultBox}>
                  <div className={styles.resultTitle}>Resulting Dendrogram</div>
                  <div className={styles.treeWrap}>
                    <Dendrogram tree={step.tree} />
                  </div>
                  <p className={styles.treeNote}>
                    X-axis = evolutionary distance (height). Each internal node
                    height = d/2 at time of merge.
                  </p>
                </div>
              )}

              <div className={styles.legend}>
                {[
                  { cls: styles.swMin, label: "Minimum pair" },
                  { cls: styles.swNew, label: "New node distances" },
                  { cls: styles.swDiag, label: "Diagonal (self)" },
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
