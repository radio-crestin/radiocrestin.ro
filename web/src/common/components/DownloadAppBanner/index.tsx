import React, { useContext } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";

export default function DownloadAppBanner() {
  const { ctx } = useContext(Context);
  const stationSlug = ctx?.selectedStation?.slug || "";
  const shareUrl = `https://share.radiocrestin.ro/${stationSlug}`;

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
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                loading="lazy"
                src="/images/download_appstore_ro.svg"
                alt="AppStore Image Radio Crestin"
                width={120}
                height={40}
              />
            </Link>
          </div>
          <div className={styles.link_box}>
            <Link
              href="https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin&hl=en_US"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                loading="lazy"
                src="/images/download_playstore_ro.svg"
                alt="PlayStore Image Radio Crestin"
                width={135}
                height={40}
              />
            </Link>
          </div>
        </div>
      </div>
      <div className={styles.image_container}>
        <img
          loading="lazy"
          className={styles.iphone13_mock_image}
          src="https://radio-crestin.s3.eu-central-1.amazonaws.com/media/public/iphone_desktop_size.png"
          alt="iPhone 13 Radio Crestin"
          width={300}
          height={600}
        />
        <img
          className={styles.iphone13_mobile_image}
          loading="lazy"
          src="https://radio-crestin.s3.eu-central-1.amazonaws.com/media/public/iphone_mob_size.png"
          alt="iPhone 13 Radio Crestin"
          width={200}
          height={400}
        />
      </div>
      <QRCodeSVG
        className={styles.qr_code}
        value={shareUrl}
        size={90}
        level="M"
        bgColor="#f5f5f5"
        fgColor="#1a1a2e"
      />
    </div>
  );
}
