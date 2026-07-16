import styles from "./styles.module.scss";

const YEAR = new Date().getFullYear();

interface FooterLinksProps {
  /** Pages that already render DownloadAppBanner above the footer hide the
   *  duplicate store badges. */
  showStoreBadges?: boolean;
}

export default function FooterLinks({ showStoreBadges = true }: FooterLinksProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <a href="/" className={styles.brand_logo}>
              <img
                src="/images/radiocrestin_logo.png"
                alt="Radio Creștin"
                width={36}
                height={36}
                loading="lazy"
              />
              <span>Radio Creștin</span>
            </a>
            <p className={styles.tagline}>
              Radiouri creștine din România și diaspora — muzică, predici și
              emisiuni, gratuit și non-stop.
            </p>
            {showStoreBadges && (
              <div className={styles.store_badges}>
                <a
                  href="https://apps.apple.com/app/6451270471"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    loading="lazy"
                    src="/images/download_appstore_ro.svg"
                    alt="Descarcă din App Store"
                    width={120}
                    height={40}
                  />
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin&hl=en_US"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    loading="lazy"
                    src="/images/download_playstore_ro.svg"
                    alt="Descarcă din Google Play"
                    width={135}
                    height={40}
                  />
                </a>
              </div>
            )}
          </div>

          <nav className={styles.columns} aria-label="Linkuri din subsol">
            <div className={styles.col}>
              <p className={styles.col_title}>Ascultă</p>
              <a href="/">Toate stațiile</a>
              <a href="/muzica-crestina/">Muzică Creștină</a>
              <a href="/predici/">Predici</a>
              <a href="/radio-crestin-pentru-copii/">Radio pentru Copii</a>
            </div>
            <div className={styles.col}>
              <p className={styles.col_title}>Resurse</p>
              <a href="/descarca-aplicatia-radio-crestin/">Aplicația mobilă</a>
              <a href="/statistici/">Statistici</a>
              <a href="/intrebari-frecvente/">Întrebări frecvente</a>
              <a href="/church-hub/">Church Hub</a>
              <a
                href="https://wa.me/40766338046?text=Buna%20ziua%20[radiocrestin.ro]%0A"
                target="_blank"
                rel="noopener noreferrer"
              >
                Contact
              </a>
            </div>
            <div className={styles.col}>
              <p className={styles.col_title}>Dezvoltatori</p>
              <a
                href="https://api.radiocrestin.ro/api/"
                target="_blank"
                rel="noopener noreferrer"
              >
                API
              </a>
              <a
                href="https://github.com/radio-crestin"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <a
                href="https://www.figma.com/file/iXXR3dhUjwfDDZH4FlEZgx/radio_crestin_com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Figma
              </a>
            </div>
            <div className={styles.col}>
              <p className={styles.col_title}>Legal</p>
              <a href="/privacy-policy/">Politica de Confidențialitate</a>
              <a href="/terms-of-service/">Termeni și Condiții</a>
            </div>
          </nav>
        </div>

        <div className={styles.bottom}>
          <p>© {YEAR} Radio Creștin. Toate drepturile rezervate.</p>
          <p>Făcut cu ♥ pentru ascultători.</p>
        </div>
      </div>
    </footer>
  );
}
