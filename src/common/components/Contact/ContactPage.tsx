import { useEffect, type ReactNode } from "react";
import NavMenu from "@/components/NavMenu";
import FooterLinks from "@/components/FooterLinks";
import { ContextProvider } from "@/context/ContextProvider";
import { initPostHog } from "@/utils/posthog";
import styles from "./styles.module.scss";

interface ContactPageProps {
  /** The page's heading: title, intro… */
  hero: ReactNode;
  /** What follows the heading: the hub's options or a form. */
  children?: ReactNode;
}

/**
 * The shell every contact page shares: one rounded panel like the homepage's,
 * with the logo and settings menu, then a single centered column holding the
 * heading and the page's content, then the footer.
 */
export default function ContactPage({ hero, children }: ContactPageProps) {
  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <ContextProvider initialState={{ stations: [], favouriteStations: [] }}>
      <div className={styles.panel}>
        <div className={styles.panel_decor} aria-hidden="true" />
        <nav className={styles.nav}>
          <a href="/" className={styles.logo}>
            <img src="/images/radiocrestin_logo.png" alt="Logo Radio Creștin" width={40} height={40} />
            <span>Radio Creștin</span>
          </a>
          <NavMenu contactActive />
        </nav>
        <main className={styles.column}>
          <header className={styles.header}>{hero}</header>
          {children}
        </main>
      </div>
      <FooterLinks />
    </ContextProvider>
  );
}
