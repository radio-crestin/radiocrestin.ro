import Link from "next/link";

import styles from "./styles.module.scss";

export default function FooterLinks() {
  return (
    <div className={styles.container}>
      <div className={styles.links}>
        <Link href="/church-hub">Church Hub</Link>
        <span className={styles.separator}>|</span>
        <Link href="/statistici">Statistici</Link>
        <span className={styles.separator}>|</span>
        <Link href="/intrebari-frecvente">Întrebări frecvente</Link>
        <span className={styles.separator}>|</span>
        <Link href="/privacy-policy">Politica de Confidentialitate</Link>
        <span className={styles.separator}>|</span>
        <Link href="/terms-of-service">Termeni si Conditii</Link>
      </div>
      <div className={styles.links}>
        <Link href="https://www.figma.com/file/iXXR3dhUjwfDDZH4FlEZgx/radio_crestin_com" target="_blank" rel="noopener noreferrer">
          Figma
        </Link>
        <span className={styles.separator}>|</span>
        <Link href="https://github.com/radio-crestin" target="_blank" rel="noopener noreferrer">
          Github
        </Link>
        <span className={styles.separator}>|</span>
        <Link href="https://api.radiocrestin.ro/api/" target="_blank" rel="noopener noreferrer">
          API
        </Link>
      </div>
    </div>
  );
}
