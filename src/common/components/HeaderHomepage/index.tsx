import Link from "next/link";
import React from "react";

import styles from "./styles.module.scss";
import WhatsAppButton from "@/components/WhatsAppButton";
import InstallMobileAppButton from "@/components/InstallMobileAppButton";

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
    {/*<WhatsAppButton />*/}
    <div className={styles.external_links}>
      <Link href="https://github.com/radio-crestin" target={"_blank"}>
        <img src="./icons/Github.png" alt="Github icon" />
      </Link>
      <Link
        href="https://graphql-viewer.radio-crestin.com/?endpoint=cc_BYFxAcGcC4HpYOYCcCG5gEcA2A6VATASwHsBaAYyQFNIRCA7Hc4gW1gDcBGRVdbIA&query=cc_I4VwpgTgngBA4mALgZUQQ0QSwPYDsDOMA3jPulnoSZgCYzYQ2QxaIA2YMA7mAEb6ZEnMAFs0mNqUQQwaEQH0QESQAcI2AB5R5ZGXMXKYACzb4d02QqWTERkCN65xbAzezoXbTGTC5IhJnwAYwhMFQpcGECQsIj5NCC41g4osGDQ8JxceS9cAGsYADNZRCUwHIw0xHkVbDIYWrJ8AAovEUEALhgARgAaekZIeV4oLpIVEF4vfCMwGi7omABfAEpiGFoWQRTojIiYXIKJqe9ZuiWYEEyRTmozK4PK3CDtEUIsG7I5FWWYXGwuDU2GgoJhcABzdabD5Vb6kPCQ6h0Jw3Fh2BxOCSuGBoCBYepIv5yTi2eyOZzYi5UmAyABumDAXCoGzoXwghE++DQ4M41K+cXB6iuzM2KM4DCYECkGCy8kQ2HMMrw8kF2GF635ss2EuY1IuQA&variables=cc_N4XyA"
        target={"_blank"}
      >
        <img src="./icons/GraphQLIcon.png" alt="GraphQLIcon icon" />
      </Link>
      <Link
        href="https://www.figma.com/file/iXXR3dhUjwfDDZH4FlEZgx/radio_crestin_com"
        target={"_blank"}
      >
        <img src="./icons/FigmaIcon2.png" alt="Figma icon" />
      </Link>
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
        <InstallMobileAppButton />
        <header className={styles.container}>
          <Navigation />
          <div className={styles.content_section} style={{height: "150px"}}>
            <ContentLeft />
          </div>
          <img
              className={styles.vector_yellow}
              src={"/images/vector_yellow.svg"}
              alt={"vector_yellow"}
          />
        </header>
      </>
  );
};

export default HeaderHomepage;
