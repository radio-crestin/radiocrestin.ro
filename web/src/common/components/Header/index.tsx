import Link from "next/link";
import React, { useContext, useState, useEffect, useRef } from "react";

import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";
import ShareOnSocial from "@/components/ShareOnSocial";
import ThemeToggle from "@/components/ThemeToggle";
import WhatsAppButton from "@/components/WhatsAppButton";
import StationRating from "@/components/Reviews/StationRating";

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
        <Link href={"/"} className={styles.logo}>
          <img
            loading={"lazy"}
            src={"/images/radiocrestin_logo.png"}
            width={40}
            height={40}
            alt={"AppStore Image Radio Crestin"}
          />
          <span>Radio Creștin</span>
        </Link>
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

const ContentLeft = () => {
  const { ctx } = useContext(Context);
  const { selectedStation } = ctx;

  if (!selectedStation) return null;

  return (
    <div className={styles.left_content}>
      {ctx.selectedStation && (
        <>
          {selectedStation.now_playing?.song?.thumbnail_url ? (
            <div className={styles.container_img_plus_thumb}>
              <img
                loading={"lazy"}
                src={selectedStation.now_playing?.song?.thumbnail_url}
                alt={selectedStation.title}
                width={230}
                height={230}
                onError={(e) => {
                  e.currentTarget.src = '/images/radio-white-default.jpg';
                }}
              />
              <img
                loading={"lazy"}
                src={selectedStation?.thumbnail_url}
                alt={selectedStation.title}
                className={styles.img_thumb}
                width={230}
                height={230}
                onError={(e) => {
                  e.currentTarget.src = '/images/radio-white-default.jpg';
                }}
              />
            </div>
          ) : (
            <img
              loading={"lazy"}
              src={selectedStation?.thumbnail_url}
              alt={selectedStation.title}
              width={230}
              height={230}
              onError={(e) => {
                e.currentTarget.src = '/images/radio-white-default.jpg';
              }}
            />
          )}
          <div className={styles.station_info}>
            <h2 className={styles.station_title}>
              {selectedStation.now_playing?.song?.name || selectedStation.title}
            </h2>
            <p className={styles.station_artist}>
              {selectedStation.now_playing?.song?.artist?.name}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

const ContentRight = () => {
  const { ctx } = useContext(Context);

  return (
    <div className={styles.right_content}>
      <div className={styles.station_details}>
        <div className={styles.title_container}>
          <img
            src={ctx.selectedStation?.thumbnail_url}
            alt="Radio Crestin"
            height={100}
            width={100}
            onError={(e) => {
              e.currentTarget.src = '/images/radio-white-default.jpg';
            }}
          />
          <h1 className={styles.station_title}>{ctx.selectedStation?.title}</h1>
        </div>

        {ctx.selectedStation && (
          <StationRating
            stationId={ctx.selectedStation.id}
            stationTitle={ctx.selectedStation.title}
            reviewsStats={ctx.selectedStation.reviews_stats}
          />
        )}

        <p className={styles.nr_listeners_desktop}>
          {ctx.selectedStation?.total_listeners || 1} persoane ascultă împreună
          cu tine acest radio
        </p>
        <p className={styles.nr_listeners_mobile}>
          {ctx.selectedStation?.total_listeners || 1} ascultători
        </p>
        <p className={styles.station_description}>
          {ctx.selectedStation?.description}
        </p>

        <div className={styles.share_on_social}>
          <ShareOnSocial />
        </div>
      </div>
    </div>
  );
};

const Header = () => {
  return (
    <>
      <header className={styles.container}>
        <Navigation />
        <div className={styles.content_section}>
          <ContentLeft />
          <ContentRight />
        </div>
      </header>
    </>
  );
};

export default Header;
