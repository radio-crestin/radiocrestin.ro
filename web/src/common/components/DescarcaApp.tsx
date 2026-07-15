import React, { useEffect, useState } from "react";
import { isAndroid, isIOS } from "react-device-detect";
import { QRCodeSVG } from "qrcode.react";
import { getIOSStoreLink, getAndroidStoreLink, APP_RATING, APP_REVIEW_COUNT, SHARE_URL } from "@/constants/constants";
import styles from "../../pages/descarca-aplicatia-radio-crestin/styles.module.scss";

export default function DescarcaApp() {
  // Rendered fully on the server so crawlers see the content; both store
  // badges stay visible (mobile users are auto-redirected to their store).
  const [source, setSource] = useState<string | undefined>(undefined);
  const [showToast, setShowToast] = useState(false);
  const [isToastVisible, setIsToastVisible] = useState(false);

  const qrCodeUrl = source ? `${SHARE_URL}/${source}` : `${SHARE_URL}`;

  useEffect(() => {
    const urlSource =
      new URLSearchParams(window.location.search).get("source") || undefined;
    setSource(urlSource);

    if (isIOS) {
      window.location.href = getIOSStoreLink(urlSource);
    } else if (isAndroid) {
      window.location.href = getAndroidStoreLink(urlSource);
    }
  }, []);

  const handleQRCodeClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShowToast(true);
      setTimeout(() => setIsToastVisible(true), 100);
      setTimeout(() => {
        setIsToastVisible(false);
        setTimeout(() => setShowToast(false), 300);
      }, 3000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  return (
    <div className={styles.container}>
      <a href="/" className={styles.back_button}>
        ← Înapoi la website
      </a>

      <div className={styles.content}>
        <h1 className={styles.title}>Descarcă</h1>
        <h2 className={styles.app_name}>Radio Creștin</h2>

        <div className={styles.qr_wrapper} onClick={handleQRCodeClick}>
          <QRCodeSVG
            value={qrCodeUrl}
            size={200}
            level="M"
            bgColor="#ffffff"
            fgColor="#1a1a2e"
          />
        </div>

        <p className={styles.subtitle}>
          Scanează codul QR sau descarcă direct. Aplicația Radio Creștin îți
          oferă gratuit peste 60 de posturi de radio creștine, pe iPhone,
          Android și Apple CarPlay.
        </p>

        <div className={styles.store_links}>
          <a href={getIOSStoreLink(source)} target="_blank">
            <img src="/images/download_appstore_ro.svg" alt="Descarcă Radio Creștin din App Store" className={styles.store_badge} />
          </a>
          <a href={getAndroidStoreLink(source)} target="_blank">
            <img loading="lazy" src="/images/download_playstore_ro.svg" alt="Descarcă Radio Creștin din Google Play" className={styles.store_badge} />
          </a>
        </div>

        <div className={styles.rating}>
          <span className={styles.stars}>★★★★★</span>
          <span className={styles.rating_text}>{APP_RATING} ({APP_REVIEW_COUNT}+ recenzii)</span>
        </div>
      </div>

      {showToast && (
        <div className={`${styles.toast} ${isToastVisible ? styles.toast_visible : ""}`}>
          <div className={styles.toast_content}>
            <svg className={styles.toast_icon} viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z" />
            </svg>
            <span>Link-ul a fost copiat!</span>
          </div>
        </div>
      )}
    </div>
  );
}
