"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Navbar.module.css";

const mainLinks = [
  { href: "/", label: "Home" },
  { href: "/page1", label: "Global Alignment" },
  { href: "/page2", label: "Local Alignment" },
];

const otherLinks = [
  { href: "/page3", label: "De Bruijn Graph Assembly" },
  { href: "/page4", label: "BLAST Seed Extension" },
  { href: "/page5", label: "Hidden Markov Models" },
  { href: "/page6", label: "UPGMA Tree Building" },
];

export default function Navbar() {
  const pathname = usePathname();
  const otherActive = otherLinks.some((l) => l.href === pathname);

  return (
    <nav className={styles.navbar}>
      <span className={styles.brand}>BioViz</span>
      <div className={styles.links}>
        {mainLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.link} ${pathname === href ? styles.active : ""}`}
          >
            {label}
          </Link>
        ))}

        {/* "Other" dropdown */}
        <div className={styles.dropdown}>
          <span className={`${styles.link} ${styles.dropdownTrigger} ${otherActive ? styles.active : ""}`}>
            Other ▾
          </span>
          <div className={styles.dropdownMenu}>
            {otherLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`${styles.dropdownItem} ${pathname === href ? styles.dropdownItemActive : ""}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
