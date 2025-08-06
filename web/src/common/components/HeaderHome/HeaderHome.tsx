"use client";

import Link from "next/link";
import React from "react";

import styles from "./styles.module.scss";
import Rating from "@/common/components/Rating/Rating";
import { getStationRating } from "@/common/utils";
import ShareOnSocial from "@/common/components/ShareOnSocial/ShareOnSocial";
import ThemeToggle from "@/common/components/ThemeToggle/ThemeToggle";
import WhatsAppButton from "@/common/components/WhatsAppButton/WhatsAppButton";
import { IStationExtended } from "@/common/models/Station";

const Navigation = () => (
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
        <h1>Radio Creștin</h1>
      </Link>
    </div>
    <div className={styles.right_content}>
      <ThemeToggle />
      <WhatsAppButton />
    </div>
  </nav>
);

const HeaderHome = () => {
  return (
    <>
      <header className={styles.container}>
        <Navigation />
        <div className={styles.content_section}>
          <div className={styles.welcome_container}>
            <div className={styles.station_details}>
              <div className={styles.title_container}>
                <h1 className={styles.station_title}>Bine ați venit</h1>
              </div>
              <p className={styles.station_description}>
                &ldquo;Iubesc pe Domnul, căci El aude glasul meu, cererile mele. Da, El Și-a plecat urechea spre mine, de aceea-L voi chema toată viața mea.&rdquo;
                <br />
                <br />
                <strong>- Psalmii 116:1-2</strong>
              </p>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default HeaderHome;
