import Link from "next/link";
import styles from "./page.module.css";

const visualizations = [
  {
    href: "/page1",
    icon: "⇌",
    title: "Global Alignment",
    desc: "Explore the Needleman–Wunsch algorithm step-by-step. Watch how the dynamic programming matrix fills and trace back the optimal end-to-end alignment.",
  },
  {
    href: "/page2",
    icon: "◎",
    title: "Local Alignment",
    desc: "Discover the Smith–Waterman algorithm. Identify the highest-scoring local subsequence match between two sequences interactively.",
  },
  {
    href: "/page3",
    icon: "◈",
    title: "De Bruijn Graph Assembly",
    desc: "Build a de Bruijn graph from k-mers and reconstruct a genome sequence by finding an Eulerian path through the graph.",
  },
];

const benefits = [
  {
    title: "Active Recall",
    text: "Manipulating parameters and watching outputs change forces active engagement with the material, producing stronger memory consolidation than passive reading.",
  },
  {
    title: "Immediate Feedback",
    text: "Interactive tools provide instant visual confirmation of correct intuition or reveal misconceptions the moment they arise—closing the feedback loop that accelerates learning.",
  },
  {
    title: "Spatial Reasoning",
    text: "Visualizing matrices, graphs, and paths leverages our innate spatial cognition to build mental models that persist far longer than abstract notation alone.",
  },
];

export default function Home() {
  return (
    <>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Interactive Bioinformatics</h1>
        <p className={styles.heroSubtitle}>
          Learn sequence alignment and genome assembly through hands-on
          visualizations.
        </p>
      </section>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Visualizations</h2>
        <div className={styles.cardGrid}>
          {visualizations.map(({ href, icon, title, desc }) => (
            <Link key={href} href={href} className={styles.card}>
              <div className={styles.cardIcon}>{icon}</div>
              <div className={styles.cardTitle}>{title}</div>
              <p className={styles.cardDesc}>{desc}</p>
            </Link>
          ))}
        </div>
      </div>

      <hr className={styles.divider} />

      <div className={`${styles.section} ${styles.learnSection}`}>
        <h2 className={styles.sectionTitle}>Why Interactive, Visual Learning?</h2>
        <div className={styles.learnGrid}>
          {benefits.map(({ title, text }) => (
            <div key={title} className={styles.learnCard}>
              <div className={styles.learnCardTitle}>{title}</div>
              <p className={styles.learnCardText}>{text}</p>
            </div>
          ))}
        </div>

        <p className={styles.citationsTitle}>Research Support</p>
        <ul className={styles.citationsList}>
          <li>
            Freeman, S., et al. (2014). Active learning increases student performance in science, engineering, and mathematics.{" "}
            <em>Proceedings of the National Academy of Sciences, 111</em>(23), 8410–8415.
          </li>
          <li>
            Mayer, R. E. (2009).{" "}
            <em>Multimedia Learning</em> (2nd ed.). Cambridge University Press.
          </li>
          <li>
            Kolb, D. A. (1984).{" "}
            <em>Experiential Learning: Experience as the Source of Learning and Development</em>. Prentice-Hall.
          </li>
          <li>
            Prince, M. (2004). Does active learning work? A review of the research.{" "}
            <em>Journal of Engineering Education, 93</em>(3), 223–231.
          </li>
        </ul>
      </div>
    </>
  );
}
