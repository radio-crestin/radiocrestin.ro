import React, { useContext, useEffect, useRef, useState } from "react";

import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";
import ThemeToggle from "@/components/ThemeToggle";
import WhatsAppButton from "@/components/WhatsAppButton";
import HeadphoneIcon from "@/icons/Headphone";
import PlayIcon from "@/icons/Play";
import { getValidImageUrl, roPlural } from "@/utils";
import type { IStation } from "@/models/Station";

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
              <span className={styles.menu_icon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={17} height={17}>
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              </span>
              <span className={styles.menu_label}>Temă</span>
              <div ref={themeToggleRef} className={styles.menu_trailing}>
                <ThemeToggle />
              </div>
            </div>
            <div className={styles.menu_divider} aria-hidden="true" />
            <a href="/descarca-aplicatia-radio-crestin/" target="_blank" rel="noopener noreferrer" className={styles.menu_item}>
              <span className={`${styles.menu_icon} ${styles.menu_icon_accent}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={17} height={17}>
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
              </span>
              <span className={styles.menu_label}>Descarcă aplicația</span>
            </a>
            <a
              href="https://wa.me/40766338046?text=Buna%20ziua%20[radiocrestin.ro]%0A"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.menu_item}
            >
              <span className={`${styles.menu_icon} ${styles.menu_icon_whatsapp}`} aria-hidden="true">
                <img src="/icons/whatsapp.svg" alt="" width={18} height={18} />
              </span>
              <span className={styles.menu_label}>Contact</span>
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

  // Baked into the static HTML so the primary CTA is a real crawlable link
  // (and still works before hydration by navigating to the station page).
  const topStation = liveStations[0];

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
          {/* Fixed-height slot: stays empty until the first live fetch lands, so
              the badge fades in without ever moving the title below */}
          <div className={styles.eyebrow_slot}>
            {hasLiveData && (
              <p className={styles.eyebrow}>
                <span className={styles.live_dot} />
                <span>
                  <strong>{roPlural(totalListeners, "persoană", "persoane")}</strong> ascultă chiar
                  acum
                </span>
              </p>
            )}
          </div>
          <h1 className={styles.title}>
            Ascultă <span className={styles.title_accent}>Radiouri Creștine</span> Online
          </h1>
          <p className={styles.subtitle}>
            Muzică creștină, predici și emisiuni pentru toată familia —{" "}
            <strong>{roPlural(stations.length, "stație", "stații")} gratuite</strong>, într-un
            singur loc.
          </p>
          <div className={styles.cta_row}>
            <a
              className={styles.cta_primary}
              href={topStation ? `/${topStation.slug}/` : "/"}
              onClick={(e) => {
                if (!topStation) return;
                e.preventDefault();
                playStation(topStation);
              }}
            >
              <PlayIcon />
              Ascultă acum
            </a>
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
                  <span className={styles.live_thumb}>
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
                    <span className={styles.thumb_play} aria-hidden="true">
                      <PlayIcon size={16} />
                    </span>
                  </span>
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
      </div>
    </header>
  );
};

export default HeaderHomepage;
