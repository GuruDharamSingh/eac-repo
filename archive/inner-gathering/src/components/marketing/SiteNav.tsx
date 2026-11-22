"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, Modal, Stack, Text } from "@mantine/core";
import { BaroqueSignup } from "@elkdonis/ui";
import styles from "./SiteNav.module.css";

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [checking, setChecking] = useState(false);

  function onPortalClick() {
    router.push('/feed');
  }

  return (
    <>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoVenture}>EAC</span>
        </Link>
        <ul className={styles.links}>
          <li>
            <Link
              href="/about"
              className={`${styles.link} ${pathname === "/about" ? styles.active : ""}`}
            >
              More About
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={onPortalClick}
              className={styles.linkButton}
              disabled={checking}
            >
              {checking ? "Checking..." : "Web-Portal"}
            </button>
          </li>
        </ul>
      </nav>

      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false);
          setShowAuth(false);
        }}
        centered
        size="md"
        title={showAuth ? "Enter the web-portal" : "Inner Gathering web-portal"}
      >
        {showAuth ? (
          <BaroqueSignup
            initialMode="signup"
            showToggle
            onSuccess={() => router.push("/feed?welcome=1")}
          />
        ) : (
          <Stack gap="md">
            <Text size="sm">
              The web-portal is where the collective feed, workshops, meetings, and community updates live.
            </Text>
            <Button onClick={() => setShowAuth(true)} color="eacSky">
              Log in / Sign up
            </Button>
          </Stack>
        )}
      </Modal>
    </>
  );
}
