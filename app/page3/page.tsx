"use client";

import { useState, useMemo } from "react";
import styles from "./page.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DBEdge {
  from: string;
  to: string;
  kmer: string;
  count: number;
}

interface DBGraph {
  nodes: string[];
  edges: DBEdge[];
  inDeg: Map<string, number>;
  outDeg: Map<string, number>;
  cycleNodes: Set<string>;
  repeatNodes: Set<string>;
  repeatEdges: Set<string>;
}

interface Contig {
  path: string[];
  sequence: string;
  color: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTIG_COLORS = [
  "#2563eb", "#16a34a", "#d97706", "#dc2626",
  "#7c3aed", "#0891b2", "#be185d", "#65a30d",
];

const SVG_W = 680;
const SVG_H = 460;
const NODE_R = 22;
const DEFAULT_READS = ["ACGTAC", "CGTACG", "GTACGT"];

// ─── Tarjan SCC — cycle detection ────────────────────────────────────────────

function findCycleNodes(nodes: string[], adj: Map<string, string[]>): Set<string> {
  let counter = 0;
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycleNodes = new Set<string>();

  function sc(v: string) {
    index.set(v, counter);
    lowlink.set(v, counter++);
    stack.push(v);
    onStack.add(v);
    for (const w of (adj.get(v) ?? [])) {
      if (!index.has(w)) {
        sc(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }
    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do { w = stack.pop()!; onStack.delete(w); scc.push(w); } while (w !== v);
      if (scc.length > 1) scc.forEach((n) => cycleNodes.add(n));
      if (scc.length === 1 && (adj.get(scc[0]) ?? []).includes(scc[0]))
        cycleNodes.add(scc[0]);
    }
  }

  for (const v of nodes) if (!index.has(v)) sc(v);
  return cycleNodes;
}

// ─── Build De Bruijn Graph ────────────────────────────────────────────────────

function buildGraph(reads: string[], k: number): DBGraph {
  const edgeCounts = new Map<string, number>();
  for (const read of reads) {
    if (read.length < k) continue;
    for (let i = 0; i <= read.length - k; i++) {
      const km = read.slice(i, i + k);
      edgeCounts.set(km, (edgeCounts.get(km) ?? 0) + 1);
    }
  }

  const nodeSet = new Set<string>();
  for (const km of edgeCounts.keys()) {
    nodeSet.add(km.slice(0, k - 1));
    nodeSet.add(km.slice(1));
  }
  const nodes = Array.from(nodeSet);

  const edges: DBEdge[] = [];
  for (const [km, count] of edgeCounts)
    edges.push({ from: km.slice(0, k - 1), to: km.slice(1), kmer: km, count });

  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  nodes.forEach((n) => { inDeg.set(n, 0); outDeg.set(n, 0); });
  edges.forEach((e) => {
    outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  });

  const repeatEdges = new Set<string>();
  edges.forEach((e) => { if (e.count > 1) repeatEdges.add(e.kmer); });

  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n, []));
  edges.forEach((e) => adj.get(e.from)?.push(e.to));

  const cycleNodes = findCycleNodes(nodes, adj);

  const repeatNodes = new Set<string>();
  nodes.forEach((n) => {
    if ((inDeg.get(n) ?? 0) > 1 && (outDeg.get(n) ?? 0) > 1) repeatNodes.add(n);
  });

  return { nodes, edges, inDeg, outDeg, cycleNodes, repeatNodes, repeatEdges };
}

// ─── Contig Finding ───────────────────────────────────────────────────────────

function findContigs(graph: DBGraph): Contig[] {
  const { nodes, edges, inDeg, outDeg } = graph;
  const isBranching = (n: string) =>
    (inDeg.get(n) ?? 0) !== 1 || (outDeg.get(n) ?? 0) !== 1;

  const adj = new Map<string, { to: string; kmer: string }[]>();
  nodes.forEach((n) => adj.set(n, []));
  edges.forEach((e) => adj.get(e.from)?.push({ to: e.to, kmer: e.kmer }));

  const visitedEdges = new Set<string>();
  const contigs: Contig[] = [];

  for (const start of nodes) {
    for (const { to: next, kmer } of adj.get(start) ?? []) {
      const eKey = `${start}→${kmer}`;
      if (visitedEdges.has(eKey)) continue;
      visitedEdges.add(eKey);

      const path = [start, next];
      let cur = next;

      while (!isBranching(cur)) {
        const nexts = adj.get(cur) ?? [];
        if (nexts.length === 0) break;
        const { to: nxt, kmer: nkm } = nexts[0];
        const nKey = `${cur}→${nkm}`;
        if (visitedEdges.has(nKey)) break;
        visitedEdges.add(nKey);
        path.push(nxt);
        cur = nxt;
        if (cur === start) break;
      }

      const sequence = path[0] + path.slice(1).map((n) => n[n.length - 1]).join("");
      contigs.push({
        path,
        sequence,
        color: CONTIG_COLORS[contigs.length % CONTIG_COLORS.length],
      });
    }
  }

  return contigs;
}

// ─── Force-Directed Layout ────────────────────────────────────────────────────

function computeLayout(
  nodes: string[],
  edges: DBEdge[],
  W: number,
  H: number
): Map<string, { x: number; y: number }> {
  if (nodes.length === 0) return new Map();
  const pos = new Map<string, { x: number; y: number }>();
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.36;

  nodes.forEach((n, i) => {
    const a = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    pos.set(n, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  });

  if (nodes.length === 1) return pos;

  const k = Math.sqrt((W * H) / nodes.length) * 0.72;

  for (let it = 0; it < 200; it++) {
    const temp = 18 * (1 - it / 200);
    const d = new Map<string, { dx: number; dy: number }>();
    nodes.forEach((n) => d.set(n, { dx: 0, dy: 0 }));

    // Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const u = nodes[i], v = nodes[j];
        const pu = pos.get(u)!, pv = pos.get(v)!;
        const dx = pu.x - pv.x, dy = pu.y - pv.y;
        const dist = Math.max(Math.hypot(dx, dy), 1);
        const f = (k * k) / dist;
        const du = d.get(u)!, dv = d.get(v)!;
        du.dx += (dx / dist) * f;  du.dy += (dy / dist) * f;
        dv.dx -= (dx / dist) * f;  dv.dy -= (dy / dist) * f;
      }
    }

    // Attraction along edges
    const seen = new Set<string>();
    for (const e of edges) {
      if (e.from === e.to) continue;
      const key = `${e.from}|${e.to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const pu = pos.get(e.from)!, pv = pos.get(e.to)!;
      const dx = pv.x - pu.x, dy = pv.y - pu.y;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const f = (dist * dist) / k;
      const du = d.get(e.from)!, dv = d.get(e.to)!;
      du.dx += (dx / dist) * f;  du.dy += (dy / dist) * f;
      dv.dx -= (dx / dist) * f;  dv.dy -= (dy / dist) * f;
    }

    const pad = 58;
    for (const n of nodes) {
      const p = pos.get(n)!, dp = d.get(n)!;
      const mag = Math.hypot(dp.dx, dp.dy);
      if (mag > 0) {
        const mv = Math.min(mag, temp);
        p.x += (dp.dx / mag) * mv;
        p.y += (dp.dy / mag) * mv;
      }
      p.x = Math.max(pad, Math.min(W - pad, p.x));
      p.y = Math.max(pad, Math.min(H - pad, p.y));
    }
  }

  return pos;
}

// ─── SVG Edge Helpers ─────────────────────────────────────────────────────────

function edgePath(
  x1: number, y1: number,
  x2: number, y2: number,
  curved: boolean,
  selfLoop: boolean
): string {
  if (selfLoop) {
    return (
      `M ${x1 - 12} ${y1 - NODE_R} ` +
      `C ${x1 - 48} ${y1 - 80} ${x1 + 48} ${y1 - 80} ` +
      `${x1 + 12} ${y1 - NODE_R}`
    );
  }
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.max(Math.hypot(dx, dy), 1);
  const sx = x1 + (dx / len) * NODE_R, sy = y1 + (dy / len) * NODE_R;
  const ex = x2 - (dx / len) * NODE_R, ey = y2 - (dy / len) * NODE_R;
  if (curved) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const ox = (-dy / len) * 30, oy = (dx / len) * 30;
    return `M ${sx} ${sy} Q ${mx + ox} ${my + oy} ${ex} ${ey}`;
  }
  return `M ${sx} ${sy} L ${ex} ${ey}`;
}

function labelPos(
  x1: number, y1: number,
  x2: number, y2: number,
  curved: boolean,
  selfLoop: boolean
): { x: number; y: number } {
  if (selfLoop) return { x: x1, y: y1 - 72 };
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.max(Math.hypot(dx, dy), 1);
  if (curved) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    return { x: mx + (-dy / len) * 36, y: my + (dx / len) * 36 };
  }
  return { x: (x1 + x2) / 2 + (-dy / len) * 12, y: (y1 + y2) / 2 + (dx / len) * 12 - 4 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeBruijnPage() {
  const [reads, setReads] = useState<string[]>(DEFAULT_READS);
  const [newRead, setNewRead] = useState("");
  const [k, setK] = useState(3);
  const [showContigs, setShowContigs] = useState(false);
  const [inputError, setInputError] = useState("");

  const graph = useMemo(() => buildGraph(reads, k), [reads, k]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => computeLayout(graph.nodes, graph.edges, SVG_W, SVG_H), [reads, k]);
  const contigs = useMemo(() => (showContigs ? findContigs(graph) : []), [graph, showContigs]);

  const edgeContigColor = useMemo(() => {
    const m = new Map<string, string>();
    contigs.forEach((c) => {
      for (let i = 0; i < c.path.length - 1; i++) {
        const e = graph.edges.find((e) => e.from === c.path[i] && e.to === c.path[i + 1]);
        if (e) m.set(e.kmer, c.color);
      }
    });
    return m;
  }, [contigs, graph.edges]);

  const pairSet = useMemo(() => {
    const s = new Set<string>();
    graph.edges.forEach((e) => s.add(`${e.from}|${e.to}`));
    return s;
  }, [graph.edges]);

  const needsCurve = (from: string, to: string) =>
    pairSet.has(`${from}|${to}`) && pairSet.has(`${to}|${from}`);

  const addRead = () => {
    const r = newRead.trim().toUpperCase();
    if (!r) return;
    if (!/^[ACGT]+$/.test(r)) { setInputError("Only A, C, G, T allowed."); return; }
    if (r.length < k) { setInputError(`Read must be ≥ ${k} characters (current k).`); return; }
    if (reads.length >= 10) { setInputError("Maximum 10 reads."); return; }
    setInputError("");
    setReads((prev) => [...prev, r]);
    setNewRead("");
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>De Bruijn Graph Assembly</h1>
        <p className={styles.subtitle}>
          Build a De Bruijn graph from k-mers, detect cycles and repeats, and collapse paths into contigs
        </p>
      </div>

      <div className={styles.workspace}>

        {/* ── Control Panel ── */}
        <div className={styles.controlPanel}>

          <div className={styles.inputGroup}>
            <label className={styles.label}>K-mer size (k)</label>
            <div className={styles.kRow}>
              <button className={styles.kBtn} onClick={() => setK((v) => Math.max(2, v - 1))}>−</button>
              <span className={styles.kValue}>{k}</span>
              <button className={styles.kBtn} onClick={() => setK((v) => Math.min(8, v + 1))}>+</button>
            </div>
            <p className={styles.kHint}>Nodes = {k - 1}-mers &nbsp;·&nbsp; Edges = {k}-mers</p>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Add Read</label>
            <div className={styles.addRow}>
              <input
                className={styles.seqInput}
                value={newRead}
                onChange={(e) => setNewRead(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && addRead()}
                placeholder={`≥${k} chars, e.g. ACGTA`}
                spellCheck={false}
              />
              <button className={styles.addBtn} onClick={addRead}>+</button>
            </div>
            {inputError && <p className={styles.fieldError}>{inputError}</p>}
          </div>

          <div className={styles.inputGroup}>
            <div className={styles.readListHeader}>
              <label className={styles.label}>Reads ({reads.length}/10)</label>
              {reads.length > 0 && (
                <button className={styles.clearBtn} onClick={() => { setReads([]); setShowContigs(false); }}>
                  Clear all
                </button>
              )}
            </div>
            <div className={styles.readList}>
              {reads.length === 0 && <p className={styles.emptyReads}>No reads added yet.</p>}
              {reads.map((r, i) => (
                <div key={i} className={styles.readItem}>
                  <span className={styles.readSeq}>{r}</span>
                  <button className={styles.removeBtn} onClick={() => setReads((p) => p.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
          </div>

          {graph.nodes.length > 0 && (
            <div className={styles.statsBox}>
              {[
                { label: "Nodes", val: graph.nodes.length },
                { label: "Edges", val: graph.edges.length },
                { label: "Cycle nodes", val: graph.cycleNodes.size },
                { label: "Repeat nodes", val: graph.repeatNodes.size },
                { label: "Repeat edges", val: graph.repeatEdges.size },
              ].map(({ label, val }) => (
                <div key={label} className={styles.statRow}>
                  <span className={styles.statLabel}>{label}</span>
                  <span className={styles.statVal}>{val}</span>
                </div>
              ))}
            </div>
          )}

          <button
            className={showContigs ? styles.contigBtnOn : styles.contigBtnOff}
            onClick={() => setShowContigs((v) => !v)}
            disabled={graph.nodes.length === 0}
          >
            {showContigs ? "Hide Contigs" : "Collapse into Contigs"}
          </button>

          <div className={styles.legend}>
            <div className={styles.legendSection}>Nodes</div>
            {[
              { cls: styles.swNormal, label: "Normal" },
              { cls: styles.swCycle,  label: "In a cycle" },
              { cls: styles.swRepeat, label: "Repeat junction" },
              { cls: styles.swBoth,   label: "Cycle + repeat" },
            ].map(({ cls, label }) => (
              <div key={label} className={styles.legendItem}>
                <span className={`${styles.nodeSwatch} ${cls}`} />
                <span>{label}</span>
              </div>
            ))}
            <div className={styles.legendSection} style={{ marginTop: 8 }}>Edges</div>
            {[
              { cls: styles.swEdgeNormal, label: "Normal" },
              { cls: styles.swEdgeRepeat, label: "Repeat (×>1, dashed)" },
            ].map(({ cls, label }) => (
              <div key={label} className={styles.legendItem}>
                <span className={`${styles.edgeSwatch} ${cls}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Graph Panel ── */}
        <div className={styles.graphPanel}>
          {graph.nodes.length === 0 ? (
            <div className={styles.placeholder}>
              Add DNA reads to build the De Bruijn graph.
              <span className={styles.placeholderSub}>
                Nodes are {k - 1}-mers · Edges are {k}-mers
              </span>
            </div>
          ) : (
            <>
              <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className={styles.svg}>
                <defs>
                  {[
                    { id: "arr",        fill: "#8aaccc" },
                    { id: "arr-repeat", fill: "#7c3aed" },
                    ...CONTIG_COLORS.map((fill, i) => ({ id: `arr-c${i}`, fill })),
                  ].map(({ id, fill }) => (
                    <marker key={id} id={id} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill={fill} />
                    </marker>
                  ))}
                </defs>

                {/* Edges */}
                {graph.edges.map((e) => {
                  const pu = layout.get(e.from), pv = layout.get(e.to);
                  if (!pu || !pv) return null;
                  const selfLoop = e.from === e.to;
                  const curved = !selfLoop && needsCurve(e.from, e.to);
                  const d = edgePath(pu.x, pu.y, pv.x, pv.y, curved, selfLoop);
                  const lp = labelPos(pu.x, pu.y, pv.x, pv.y, curved, selfLoop);
                  const contigColor = edgeContigColor.get(e.kmer);
                  const isRepeat = graph.repeatEdges.has(e.kmer);

                  let stroke = "#8aaccc", markerId = "arr", strokeW = 1.5;
                  let dash: string | undefined;
                  if (contigColor) {
                    stroke = contigColor;
                    markerId = `arr-c${CONTIG_COLORS.indexOf(contigColor)}`;
                    strokeW = 2.5;
                  } else if (isRepeat) {
                    stroke = "#7c3aed"; markerId = "arr-repeat"; strokeW = 2; dash = "5,3";
                  }

                  return (
                    <g key={e.kmer}>
                      <path d={d} stroke={stroke} strokeWidth={strokeW} strokeDasharray={dash} fill="none" markerEnd={`url(#${markerId})`} />
                      <text x={lp.x} y={lp.y} textAnchor="middle" fontSize="10" fill={stroke} fontFamily="'Courier New',monospace" fontWeight="700">
                        {e.kmer[e.kmer.length - 1]}{e.count > 1 ? `×${e.count}` : ""}
                      </text>
                    </g>
                  );
                })}

                {/* Nodes */}
                {graph.nodes.map((n) => {
                  const p = layout.get(n);
                  if (!p) return null;
                  const isCycle = graph.cycleNodes.has(n);
                  const isRepeat = graph.repeatNodes.has(n);
                  let fill = "#ffffff", stroke = "#1e3a5f", strokeW = 1.5;
                  if (isCycle && isRepeat) { fill = "#fce7f3"; stroke = "#be185d"; strokeW = 2.5; }
                  else if (isCycle)        { fill = "#fef3c7"; stroke = "#d97706"; strokeW = 2; }
                  else if (isRepeat)       { fill = "#ede9fe"; stroke = "#7c3aed"; strokeW = 2; }

                  return (
                    <g key={n}>
                      <circle cx={p.x} cy={p.y} r={NODE_R} fill={fill} stroke={stroke} strokeWidth={strokeW} />
                      <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontFamily="'Courier New',monospace" fontWeight="700" fill="#0a1628">
                        {n}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {showContigs && (
                <div className={styles.contigsPanel}>
                  <div className={styles.contigsTitle}>
                    Assembled Contigs
                    <span className={styles.contigsCount}>{contigs.length}</span>
                  </div>
                  {contigs.length === 0 ? (
                    <p className={styles.noContigs}>No collapsible paths found — every node is a branching junction.</p>
                  ) : (
                    <div className={styles.contigsList}>
                      {contigs.map((c, i) => (
                        <div key={i} className={styles.contigRow}>
                          <span className={styles.contigDot} style={{ background: c.color }} />
                          <code className={styles.contigSeq}>{c.sequence}</code>
                          <span className={styles.contigLen}>{c.sequence.length} bp</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
