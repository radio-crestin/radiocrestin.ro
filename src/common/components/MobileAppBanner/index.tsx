import React from "react";
import Link from "next/link";
import styles from "./styles.module.scss";
import {
  APP_RATING,
  APP_REVIEW_COUNT,
  getAndroidStoreLink,
  getIOSStoreLink,
} from "@/constants/constants";

export default function MobileAppBanner() {
  return (
    <div className={styles.banner}>
      <div className={styles.app_icon}>
        <img
          src="/images/radiocrestin_logo.png"
          alt="Radio Creștin"
          width={52}
          height={52}
        />
      </div>

      <div className={styles.app_info}>
        <span className={styles.app_name}>Radio Creștin</span>
        <span className={styles.app_subtitle}>
          Peste 50 de radiouri creștine
        </span>
        <div className={styles.app_rating}>
          <span className={styles.stars}>★★★★★</span>
          <span className={styles.rating_text}>
            {APP_RATING} ({APP_REVIEW_COUNT}+)
          </span>
        </div>
      </div>

      <div className={styles.store_buttons}>
        <Link
          href={getIOSStoreLink()}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.store_button}
        >
          <img
            src="/images/download_appstore_ro.svg"
            alt="App Store"
            height={40}
          />
        </Link>
        <Link
          href={getAndroidStoreLink()}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.store_button}
        >
          <img
            src="/images/download_playstore_ro.svg"
            alt="Google Play"
            height={40}
          />
        </Link>
      </div>

      <Link
        href="/descarca-aplicatia-radio-crestin"
        target="_blank"
        className={styles.view_button}
      >
        Descarcă
      </Link>
    </div>
  );
}
