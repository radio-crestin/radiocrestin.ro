import Link from "next/link";
import React from "react";

import styles from "./styles.module.scss";
import WhatsAppButton from "@/components/WhatsAppButton";

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
    <div className={styles.external_links}>
      <WhatsAppButton />
    </div>
  </nav>
);

const ContentLeft = () => {
  return (
    <div className={styles.station}>
      <div className={styles.station_details}>
        <h1 className={styles.station_title}>Bine ați venit</h1>
        <p className={styles.station_description}>
          „Iubesc pe Domnul, căci El aude glasul meu, cererile mele. Da, El Și-a
          plecat urechea spre mine, de aceea-L voi chema toată viața mea.”
          <br />- Psalmii 116:1-2
        </p>
      </div>
    </div>
  );
};

const HeaderHomepage = () => {
  return (
    <>
      <header className={styles.container}>
        <Navigation />
        <div className={styles.content_section} style={{ height: "150px" }}>
          <ContentLeft />
        </div>
        <img
          className={styles.vector_yellow}
          src={"/images/vector_lemon.svg"}
          alt={"vector_yellow"}
        />
      </header>
    </>
  );
};

export default HeaderHomepage;
