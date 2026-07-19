import React, { useContext, useEffect, useRef, useState } from "react";

import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";
import ThemeToggle from "@/components/ThemeToggle";
import WhatsAppButton from "@/components/WhatsAppButton";
import HeadphoneIcon from "@/icons/Headphone";
import { getValidImageUrl } from "@/utils";
import type { IStation } from "@/models/Station";

// Romanian numeral agreement: 1 stație / 8 stații / 66 de stații
const roPlural = (n: number, singular: string, plural: string) =>
  n === 1 ? `1 ${singular}` : n < 20 ? `${n} ${plural}` : `${n} de ${plural}`;

const PlayIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l11.02-6.86c.66-.41.66-1.39 0-1.8L9.56 4.24A1.05 1.05 0 0 0 8 5.14z" />
  </svg>
);

const Navigation = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const themeToggleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleThemeClick = () => {
    const button = themeToggleRef.current?.querySelector("button");
    button?.click();
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.internal_links}>
        <a href={"/"} className={styles.logo}>
          <img
            loading={"lazy"}
            src={"/images/radiocrestin_logo.png"}
            width={40}
            height={40}
            alt={"Logo Radio Creștin"}
          />
          <span>Radio Creștin</span>
        </a>
      </div>
      <div className={styles.right_content}>
        <ThemeToggle />
        <WhatsAppButton />
      </div>
      <div className={styles.mobile_menu} ref={menuRef}>
        <button
          className={styles.hamburger}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <span className={`${styles.hamburger_line} ${menuOpen ? styles.open : ""}`}></span>
          <span className={`${styles.hamburger_line} ${menuOpen ? styles.open : ""}`}></span>
          <span className={`${styles.hamburger_line} ${menuOpen ? styles.open : ""}`}></span>
        </button>
        {menuOpen && (
          <div className={styles.mobile_dropdown}>
            <div className={styles.menu_item} onClick={handleThemeClick}>
              <span>Temă</span>
              <div ref={themeToggleRef}>
                <ThemeToggle />
              </div>
            </div>
            <a
              href="https://wa.me/40766338046?text=Buna%20ziua%20[radiocrestin.ro]%0A"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.contact_link}
            >
              <span>Contact</span>
              <img src="/icons/whatsapp.svg" alt="WhatsApp" width={20} height={20} />
            </a>
          </div>
        )}
      </div>
    </nav>
  );
};

// The live panel always features the same three flagship stations (the
// perennial top-3 by listeners), so the first paint matches the final layout
// and the static build links to the strongest station pages. Live song and
// listener data streams into the rows once the first metadata fetch lands.
const FEATURED_SLUGS = ["radio-gosen", "rve-suceava", "radio-micul-samaritean"];

const HeaderHomepage = () => {
  const { ctx, setCtx } = useContext(Context);
  const stations: IStation[] = ctx.stations || [];

  const totalListeners = stations.reduce(
    (sum: number, s: IStation) => sum + (s.total_listeners || 0),
    0,
  );

  // Build data ships with listeners zeroed and song names blanked — until the
  // first client fetch arrives the rows show skeleton placeholders.
  const hasLiveData = totalListeners > 0;

  const liveStations = FEATURED_SLUGS.map((slug) =>
    stations.find((s: IStation) => s.slug === slug),
  ).filter(Boolean) as IStation[];

  // Backfill in the unlikely case a featured station disappears from the API
  if (liveStations.length < 3) {
    for (const station of stations) {
      if (liveStations.length >= 3) break;
      if (!liveStations.some((s) => s.slug === station.slug)) {
        liveStations.push(station);
      }
    }
  }

  const playStation = (station: IStation) => {
    setCtx({ selectedStation: station });
    window.history.pushState(null, "", `/${station.slug}/`);
  };

  const handlePlayTop = () => {
    if (liveStations.length > 0) {
      playStation(liveStations[0]);
    }
  };

  const scrollToStations = () => {
    const target = document.querySelector(
      '[data-info="stations-section"]',
    ) as HTMLElement | null;
    if (target) {
      window.scrollTo({ top: target.offsetTop - 90, behavior: "smooth" });
    }
  };

  return (
    <header className={styles.container}>
      <div className={styles.decor} aria-hidden="true" />
      <Navigation />
      <div className={styles.hero}>
        <div className={styles.hero_left}>
          <h1 className={styles.title}>Ascultă Radiouri Creștine Online</h1>
          <p className={styles.subtitle}>
            Muzică creștină, predici și emisiuni pentru toată familia —{" "}
            <strong>{roPlural(stations.length, "stație", "stații")} gratuite</strong>, într-un
            singur loc.
          </p>
          <div className={styles.cta_row}>
            <button className={styles.cta_primary} onClick={handlePlayTop}>
              <PlayIcon />
              Ascultă acum
            </button>
            <button className={styles.cta_secondary} onClick={scrollToStations}>
              Vezi toate stațiile
            </button>
          </div>
        </div>
        <aside className={styles.hero_right}>
          <div className={styles.live_card}>
            <div className={styles.live_card_header}>
              <span className={styles.live_dot} />
              <span>Se ascultă acum</span>
            </div>
            <div className={styles.live_list}>
              {liveStations.map((station) => (
                <a
                  key={station.slug}
                  href={`/${station.slug}/`}
                  className={styles.live_item}
                  draggable={false}
                  onClick={(e) => {
                    e.preventDefault();
                    playStation(station);
                  }}
                >
                  <img
                    src={getValidImageUrl(station.thumbnail_url)}
                    alt={`${station.title} | radiocrestin.ro`}
                    width={52}
                    height={52}
                    loading={"eager"}
                    onError={(e) => {
                      e.currentTarget.src = "/images/radio-white-default.jpg";
                    }}
                  />
                  <div className={styles.live_item_info}>
                    <p className={styles.live_item_name}>{station.title}</p>
                    <p className={styles.live_item_song}>
                      {!hasLiveData ? (
                        <span className={styles.skeleton_line} />
                      ) : station.now_playing?.song?.name ? (
                        <>
                          {station.now_playing.song.name}
                          {station.now_playing.song.artist?.name &&
                            ` · ${station.now_playing.song.artist.name}`}
                        </>
                      ) : (
                        "Transmisiune live"
                      )}
                    </p>
                  </div>
                  {!hasLiveData ? (
                    <span className={styles.skeleton_chip} />
                  ) : (
                    (station.total_listeners || 0) > 0 && (
                      <span className={styles.live_item_listeners}>
                        {station.total_listeners}
                        <HeadphoneIcon />
                      </span>
                    )
                  )}
                </a>
              ))}
            </div>
          </div>
        </aside>
        <figure className={styles.verse}>
          <blockquote>
            {`„Iubesc pe Domnul, căci El aude glasul meu, cererile mele. Da, El Și-a plecat urechea spre mine, de aceea-L voi chema toată viața mea."`}
          </blockquote>
          <figcaption>Psalmii 116:1-2</figcaption>
        </figure>
      </div>
    </header>
  );
};

export default HeaderHomepage;
