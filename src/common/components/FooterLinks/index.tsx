import styles from "./styles.module.scss";

export default function FooterLinks() {
  return (
    <div className={styles.container}>
      <div className={styles.links}>
        <a href="/church-hub">Church Hub</a>
        <span className={styles.separator}>|</span>
        <a href="/statistici">Statistici</a>
        <span className={styles.separator}>|</span>
        <a href="/intrebari-frecvente">Întrebări frecvente</a>
        <span className={styles.separator}>|</span>
        <a href="/privacy-policy">Politica de Confidentialitate</a>
        <span className={styles.separator}>|</span>
        <a href="/terms-of-service">Termeni si Conditii</a>
      </div>
      <div className={styles.links}>
        <a href="https://www.figma.com/file/iXXR3dhUjwfDDZH4FlEZgx/radio_crestin_com" target="_blank" rel="noopener noreferrer">
          Figma
        </a>
        <span className={styles.separator}>|</span>
        <a href="https://github.com/radio-crestin" target="_blank" rel="noopener noreferrer">
          Github
        </a>
        <span className={styles.separator}>|</span>
        <a href="https://api.radiocrestin.ro/api/" target="_blank" rel="noopener noreferrer">
          API
        </a>
      </div>
    </div>
  );
}
