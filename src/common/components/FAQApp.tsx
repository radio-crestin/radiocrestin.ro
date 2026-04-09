import React, { ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import DownloadAppBanner from "@/components/DownloadAppBanner";
import FooterLinks from "@/components/FooterLinks";
import { ContextProvider } from "@/context/ContextProvider";
import styles from "../../pages/intrebari-frecvente/styles.module.scss";

interface FaqItem {
  question: string;
  answer: ReactNode;
}

const faqData: FaqItem[] = [
  {
    question: "Ce este Radio Creștin?",
    answer:
      "Radio Creștin (radiocrestin.ro) este o platformă online gratuită care îți permite să asculți o varietate de stații radio creștine din România și din întreaga lume. Oferim acces rapid și ușor la muzică creștină, predici, emisiuni și conținut spiritual.",
  },
  {
    question: "Este gratuit să ascult radio pe această platformă?",
    answer:
      "Da, Radio Creștin este complet gratuit. Nu este nevoie de înregistrare sau abonament pentru a asculta oricare dintre stațiile radio disponibile pe platformă.",
  },
  {
    question: "Cum pot asculta un post de radio?",
    answer:
      "Pentru a asculta un post de radio, pur și simplu accesează pagina principală și apasă pe stația dorită. Redarea va începe automat. Poți folosi controalele de redare pentru a opri, relua sau ajusta volumul.",
  },
  {
    question: "Pot asculta Radio Creștin pe dispozitivul mobil?",
    answer: (
      <>
        Da, poți asculta Radio Creștin pe mobil în două moduri: direct din
        browser (site-ul este complet responsiv) sau prin aplicația noastră
        dedicată. Aplicația suportă și Apple CarPlay, astfel încât poți asculta
        radio creștin direct din mașină. Descarcă aplicația gratuită pentru{" "}
        <a
          href="https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin"
          target="_blank"
          rel="noopener noreferrer"
        >
          Android (Google Play)
        </a>{" "}
        sau{" "}
        <a
          href="https://apps.apple.com/ro/app/radio-crestin/id6451270471"
          target="_blank"
          rel="noopener noreferrer"
        >
          iOS (App Store)
        </a>
        .
      </>
    ),
  },
  {
    question: "Cum pot adăuga o stație radio nouă pe platformă?",
    answer: (
      <>
        Dacă dorești să adaugi o stație radio creștină pe platformă, te rugăm să
        ne contactezi pe{" "}
        <a
          href="https://wa.me/40766338046?text=Buna%20ziua%20[radiocrestin.ro]%0A"
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>{" "}
        cu detaliile stației (nume, link stream, descriere). Vom analiza cererea
        și vom reveni cu un răspuns.
      </>
    ),
  },
  {
    question: "Ce fac dacă un post de radio nu funcționează?",
    answer: (
      <>
        Dacă întâmpini probleme cu un post de radio (nu se încarcă, se oprește
        frecvent), încearcă să reîncarci pagina sau să verifici conexiunea ta la
        internet. Dacă problema persistă, te rugăm să ne semnalezi pe{" "}
        <a
          href="https://wa.me/40766338046?text=Buna%20ziua%20[radiocrestin.ro]%0A"
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
        .
      </>
    ),
  },
  {
    question: "Pot asculta Radio Creștin în fundal?",
    answer:
      "Da, poți asculta Radio Creștin în fundal în timp ce folosești alte aplicații sau navigezi pe alte site-uri. Pe dispozitivele mobile, redarea continuă chiar și când ecranul este blocat.",
  },
  {
    question: "Cum pot vedea ce melodie se redă în acest moment?",
    answer:
      "Informațiile despre melodia curentă (titlu, artist) sunt afișate direct pe player-ul stației, dacă stația radio transmite aceste date. Nu toate stațiile oferă această funcționalitate.",
  },
];

function FAQContent() {
  return (
    <div className={styles.pageWrapper}>
      <header className={styles.header}>
        <a href="/" className={styles.logoLink}>
          <img
            src="/images/radiocrestin_logo.png"
            alt="Radio Crestin"
            width={40}
            height={40}
          />
          <span>Radio Creștin</span>
        </a>
        <ThemeToggle />
      </header>

      <main className={styles.container}>
        <h1>Întrebări Frecvente</h1>
        <p className={styles.intro}>
          Găsește răspunsuri la cele mai frecvente întrebări despre platforma
          Radio Creștin.
        </p>

        <div className={styles.faqList}>
          {faqData.map((item, index) => (
            <div key={index} className={styles.faqItem}>
              <h2 className={styles.question}>{item.question}</h2>
              <p className={styles.answer}>{item.answer}</p>
            </div>
          ))}
        </div>

        <div className={styles.contact}>
          <h2>Nu ai găsit răspunsul?</h2>
          <p>
            Dacă ai alte întrebări, ne poți contacta pe{" "}
            <a
              href="https://wa.me/40766338046?text=Buna%20ziua%20[radiocrestin.ro]%0A"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          </p>
        </div>
      </main>

      <DownloadAppBanner />
      <FooterLinks />
    </div>
  );
}

export default function FAQApp() {
  return (
    <ContextProvider initialState={{ stations: [], favouriteStations: [] }}>
      <FAQContent />
    </ContextProvider>
  );
}
