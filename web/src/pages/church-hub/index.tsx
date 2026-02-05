import { useState } from "react";
import Link from "next/link";
import Head from "next/head";

import styles from "./styles.module.scss";

const features = [
  {
    title: "Control Room",
    description: [
      "Interfata principala de prezentare cu previzualizare live",
      "Coada de prezentare cu drag & drop pentru reordonare",
      "Navigare cu tastatura pentru control rapid al slide-urilor",
      "Suport multi-ecran: Primary, Stage, Livestream & Kiosk",
    ],
    image: "/images/church-hub/control-room.png",
  },
  {
    title: "Biblioteca de Cantari",
    description: [
      "Cauta si gaseste instant printre peste 40.000 de cantari",
      "Import inteligent din OpenSong si PowerPoint",
      "Detectare automata a duplicatelor",
      "Suport CCLI pentru tracking licente si copyright",
    ],
    image: "/images/church-hub/songs-list.png",
  },
  {
    title: "Modulul Biblic",
    description: [
      "Cautare inteligenta dupa referinta sau cuvinte cheie",
      "Suport pentru mai multe traduceri ale Bibliei",
      "Navigare rapida prin toate cartile",
      "Previzualizare inainte de prezentare",
    ],
    image: "/images/church-hub/bible.png",
  },
  {
    title: "Integrare Livestream",
    description: [
      "Lansare broadcast YouTube cu un singur click",
      "Comutare scene OBS Studio direct din aplicatie",
      "Mixer audio cu 16+ canale",
      "Comutare automata a scenelor in functie de continut",
    ],
    image: "/images/church-hub/livestream.png",
  },
  {
    title: "Player Muzica",
    description: [
      "Muzica de fundal pentru servicii de inchinare",
      "Organizare pe foldere si gestionare playlist",
      "Mod shuffle pentru redare aleatorie",
      "Control independent al volumului",
    ],
    image: "/images/church-hub/music.png",
  },
  {
    title: "Programe de Servicii",
    description: [
      "Constructor de programe pentru servicii de inchinare",
      "Adauga cantari, versete si slide-uri personalizate",
      "Interfata drag & drop pentru reordonare intuitiva",
      "Import/export programe pentru partajare",
    ],
    image: "/images/church-hub/schedules.png",
  },
  {
    title: "Editor de Ecran",
    description: [
      "Editor vizual WYSIWYG cu drag & resize",
      "Stilizare text: font, dimensiune, culoare, animatii",
      "Auto-scalare text pentru incadrare in container",
      "Integrare OBS Browser Source pentru subtitrari live",
    ],
    image: "/images/church-hub/screen-editor.png",
  },
  {
    title: "Tracker Tonalitati Cantari",
    description: [
      "Urmareste cantarile prezentate recent cu tonalitatile muzicale",
      "Statistici de utilizare pentru fiecare cantare",
      "Vizualizare cronologica organizata pe zile",
      "Referinta rapida pentru membrii trupei muzicale",
    ],
    image: "/images/church-hub/song-key.png",
  },
];

export default function ChurchHubPage() {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  return (
    <>
      <Head>
        <title>Church Hub - Software pentru Biserica | Radio Crestin</title>
        <meta
          name="description"
          content="Church Hub - Sistem modern de prezentare si management pentru livestream-uri de inchinare. Gestioneaza cantari, versete biblice, programe si transmiteri live."
        />
      </Head>
      <main className={styles.page}>
        <section className={styles.hero}>
          <h1>Church Hub</h1>
          <p className={styles.subtitle}>
            Sistem modern de prezentare si management pentru servicii de
            inchinare. Combina gestionarea cantarilor, afisarea versetelor
            biblice, programarea serviciilor, prezentarea multi-ecran si
            integrarea livestream intr-o singura aplicatie.
          </p>
          <div className={styles.download_buttons}>
            <a
              href="https://github.com/radio-crestin/church-hub/releases/latest/download/church-hub-windows-x64.exe"
              className={styles.download_button}
            >
              Descarca pentru Windows
            </a>
            <a
              href="https://github.com/radio-crestin/church-hub/releases/latest/download/church-hub-macos-arm64.dmg"
              className={styles.download_button}
            >
              Descarca pentru macOS
            </a>
          </div>
        </section>

        <div className={styles.screenshot_hero}>
          <img
            src="/images/church-hub/control-room.png"
            alt="Church Hub - Control Room"
            onClick={() => setLightboxImage("/images/church-hub/control-room.png")}
          />
        </div>

        <section className={styles.features}>
          <h2>Functionalitati</h2>
          <div className={styles.feature_grid}>
            {features.map((feature) => (
              <div key={feature.title} className={styles.feature_card}>
                <img
                  className={styles.feature_image}
                  src={feature.image}
                  alt={feature.title}
                  onClick={() => setLightboxImage(feature.image)}
                />
                <div className={styles.feature_content}>
                  <h3>{feature.title}</h3>
                  <ol>
                    {feature.description.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.open_source}>
          <h2>Open Source</h2>
          <p>
            Church Hub este un proiect open-source. Contributiile sunt
            binevenite! Daca vrei sa ajuti la dezvoltare, raporteaza bug-uri sau
            sugereaza functionalitati noi.
          </p>
          <a
            href="https://github.com/radio-crestin/church-hub"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.github_link}
          >
            Vezi pe GitHub
          </a>
        </section>

        <footer className={styles.footer}>
          <div className={styles.footer_links}>
            <Link href="/">Radio Crestin</Link>
            <span className={styles.separator}>|</span>
            <Link href="/privacy-policy">Politica de Confidentialitate</Link>
            <span className={styles.separator}>|</span>
            <Link href="/terms-of-service">Termeni si Conditii</Link>
          </div>
        </footer>
      </main>

      {lightboxImage && (
        <div
          className={styles.lightbox}
          onClick={() => setLightboxImage(null)}
        >
          <button className={styles.lightbox_close} aria-label="Inchide">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className={styles.lightbox_content} onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImage} alt="Screenshot" />
          </div>
        </div>
      )}
    </>
  );
}
