import React, { useEffect, type ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import FooterLinks from "@/components/FooterLinks";
import { ContextProvider } from "@/context/ContextProvider";
import { initPostHog } from "@/utils/posthog";
import styles from "./styles.module.scss";

/** The shell every contact page shares: logo, theme toggle, a centered card, footer. */
export default function ContactPage({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <ContextProvider initialState={{ stations: [], favouriteStations: [] }}>
      <div className={styles.page}>
        <header className={styles.header}>
          <a href="/" className={styles.logo_link}>
            <img src="/images/radiocrestin_logo.png" alt="Radio Creștin" width={40} height={40} />
            <span>Radio Creștin</span>
          </a>
          <ThemeToggle />
        </header>
        <main className={styles.card}>{children}</main>
        <FooterLinks />
      </div>
    </ContextProvider>
  );
}
