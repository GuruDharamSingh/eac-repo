"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteNav.module.css";

const links = [
  { href: "/", label: "Home" },
  { href: "/manifesto", label: "Manifesto" },
  { href: "/workshops", label: "Workshops" },
  { href: "/about", label: "About" },
];

export default function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.logo}>
        <span className={styles.logoReligath}>EAC</span>
      </Link>
      <ul className={styles.links}>
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className={`${styles.link} ${pathname === l.href ? styles.active : ""}`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
