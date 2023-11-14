import React from "react";
import Link from "next/link";
import styles from "./styles.module.scss";

export default function DownloadAppBanner() {
  return (
    <div className={styles.download_app_banner}>
      <div className={styles.text_container}>
        <h2 className={styles.main_heading}>
          Descarcă aplicația Radio Creștin
        </h2>
        <p className={styles.sub_heading}>
          Toate posturile tale preferate într-un singur loc, gratis și fără
          reclame.
        </p>
        <div className={styles.link_container}>
          <div className={styles.link_box}>
            <Link
              href="https://apps.apple.com/app/6451270471"
              target={"_blank"}
            >
              <img
                loading={"lazy"}
                src={"/images/appstore.svg"}
                alt={"AppStore Image Radio Crestin"}
              />
            </Link>
          </div>
          <div className={styles.link_box}>
            <Link
              href="https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin&hl=en_US"
              target={"_blank"}
            >
              <img
                loading={"lazy"}
                src={"/images/playstore.svg"}
                alt={"PlayStore Image Radio Crestin"}
              />
            </Link>
          </div>
          <div className={styles.link_box}>
            <Link
              href="https://appgallery.huawei.com/app/C109055331"
              target={"_blank"}
            >
              <img
                loading={"lazy"}
                src={"/images/appgallery.svg"}
                alt={"AppGallery Image Radio Crestin"}
              />
            </Link>
          </div>
        </div>
      </div>
      <div className={styles.image_container}>
        <img
          loading={"lazy"}
          className={styles.iphone12_mock_image}
          src={"/images/iphone12-mock.png"}
          alt={"iPhone 12 Radio Crestin"}
        />
        <img
          loading={"lazy"}
          src={"/images/iphone12_mobile.png"}
          alt={"iPhone 12 Radio Crestin"}
        />
      </div>
      <img
        loading={"lazy"}
        className={styles.qr_code}
        src={"/images/qr-code.png"}
        alt={"QR Code Radio Crestin"}
      />
    </div>
  );
}
