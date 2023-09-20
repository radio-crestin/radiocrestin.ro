import Image from 'next/image'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.description}>

      </div>

      <div className={styles.center}>
        <h1>Revenim în curând.</h1>
        <h3>Pregătim o noua versiune a website-ului.</h3>
      </div>

      <div className={styles.grid}>
        <a
          href="https://github.com/radio-crestin/radiocrestin.ro"
          className={styles.card}
          target="_blank"
          rel="noopener noreferrer"
        >
          Github
        </a>
      </div>
    </main>
  )
}
