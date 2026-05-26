"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteNav.module.css";

const links = [
  { href: "#about", label: "More Info", external: false },
  {
    href: "https://meetings.elkdonis-arts.org",
    label: "Meetings",
    external: true,
  },
];

export default function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.logo}>
        <span className={styles.logoVenture}>EAC</span>
      </Link>
      <ul className={styles.links}>
        {links.map((l) =>
          l.external ? (
            <li key={l.href}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                {l.label}
              </a>
            </li>
          ) : (
            <li key={l.href}>
              <a
                href={l.href}
                className={`${styles.link} ${pathname === "/" ? styles.active : ""}`}
              >
                {l.label}
              </a>
            </li>
          )
        )}
      </ul>
    </nav>
  );
}
