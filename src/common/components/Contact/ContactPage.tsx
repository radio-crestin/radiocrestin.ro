import { useEffect, type ReactNode } from "react";
import NavMenu from "@/components/NavMenu";
import FooterLinks from "@/components/FooterLinks";
import { ContextProvider } from "@/context/ContextProvider";
import { initPostHog } from "@/utils/posthog";
import styles from "./styles.module.scss";

interface ContactPageProps {
  /** Shown inside the rounded panel, under the navigation (title, intro…). */
  hero: ReactNode;
  /** What follows the panel: the hub's cards or a form card. */
  children?: ReactNode;
}

/**
 * The shell every contact page shares, built like the homepage: a rounded
 * panel with the logo and settings menu, then the page content at the same
 * width as the homepage's sections, then the footer.
 */
export default function ContactPage({ hero, children }: ContactPageProps) {
  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <ContextProvider initialState={{ stations: [], favouriteStations: [] }}>
      <header className={styles.panel}>
        <div className={styles.panel_decor} aria-hidden="true" />
        <nav className={styles.nav}>
          <a href="/" className={styles.logo}>
            <img src="/images/radiocrestin_logo.png" alt="Logo Radio Creștin" width={40} height={40} />
            <span>Radio Creștin</span>
          </a>
          <NavMenu />
        </nav>
        <div className={styles.panel_body}>{hero}</div>
      </header>
      {children && <main className={styles.content}>{children}</main>}
      <FooterLinks />
    </ContextProvider>
  );
}
