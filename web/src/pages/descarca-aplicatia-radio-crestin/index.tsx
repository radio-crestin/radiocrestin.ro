import { useEffect, useState } from "react";
import Head from "next/head";
import { isAndroid, isIOS } from "react-device-detect";
import Layout from "@/components/Layout";
import Link from "next/link";
import { useRouter } from "next/router";
import { getIOSStoreLink, getAndroidStoreLink, APP_RATING, APP_REVIEW_COUNT, SHARE_URL } from "@/constants/constants";
import { QRCodeSVG } from "qrcode.react";
import styles from "./styles.module.scss";

const meta = {
  title: "Descarcă Aplicația Radio Crestin | iOS și Android",
  description:
    "Descarcă gratuit aplicația Radio Crestin pe iPhone sau Android. Ascultă cele mai bune posturi de radio crestine din România, fără reclame.",
  keywords:
    "descarcă radio crestin, aplicație radio crestin, radio crestin ios, radio crestin android, aplicație radio, descarcă gratuit, app store, google play",
  imageUrl:
    "https://radio-crestin.s3.eu-central-1.amazonaws.com/media/public/iphone_desktop_size.png",
  fullURL: "https://www.radiocrestin.ro/descarca-aplicatia-radio-crestin",
};

export default function DescarcaAplicatia() {
  const router = useRouter();
  const source = router.query.source as string | undefined;
  const qrCodeUrl = source ? `${SHARE_URL}/${source}` : `${SHARE_URL}`;

  const [isClient, setIsClient] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isToastVisible, setIsToastVisible] = useState(false);

  useEffect(() => {
    setIsClient(true);

    if (isIOS) {
      window.location.href = getIOSStoreLink(source);
    } else if (isAndroid) {
      window.location.href = getAndroidStoreLink(source);
    }
  }, [source]);

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

  if (!isClient) {
    return null;
  }

  return (
    <Layout {...meta} hideAppBanner>
      {/* SoftwareApplication schema - all values are constants, safe for JSON-LD */}
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Radio Crestin",
              operatingSystem: "Android, iOS",
              applicationCategory: "MultimediaApplication",
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: APP_RATING,
                reviewCount: APP_REVIEW_COUNT,
                bestRating: "5",
                worstRating: "1",
              },
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "RON",
              },
            }),
          }}
        />
      </Head>
      <div className={styles.container}>
        <Link href="/" className={styles.back_button}>
          ← Înapoi la website
        </Link>

        <div className={styles.content}>
          <h1 className={styles.title}>Descarcă</h1>
          <h2 className={styles.app_name}>Radio Crestin</h2>

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
            Scanează codul QR sau descarcă direct
          </p>

          <div className={styles.store_links}>
            {isIOS && (
              <Link href={getIOSStoreLink(source)} target="_blank">
                <img
                  src="/images/download_appstore_ro.svg"
                  alt="AppStore Image Radio Crestin"
                  className={styles.store_badge}
                />
              </Link>
            )}
            {isAndroid && (
              <Link href={getAndroidStoreLink(source)} target="_blank">
                <img
                  loading="lazy"
                  src="/images/download_playstore_ro.svg"
                  alt="PlayStore Image Radio Crestin"
                  className={styles.store_badge}
                />
              </Link>
            )}
            {!isIOS && !isAndroid && (
              <>
                <Link href={getIOSStoreLink(source)} target="_blank">
                  <img
                    src="/images/download_appstore_ro.svg"
                    alt="AppStore Image Radio Crestin"
                    className={styles.store_badge}
                  />
                </Link>
                <Link href={getAndroidStoreLink(source)} target="_blank">
                  <img
                    loading="lazy"
                    src="/images/download_playstore_ro.svg"
                    alt="PlayStore Image Radio Crestin"
                    className={styles.store_badge}
                  />
                </Link>
              </>
            )}
          </div>

          <div className={styles.rating}>
            <span className={styles.stars}>★★★★★</span>
            <span className={styles.rating_text}>{APP_RATING} ({APP_REVIEW_COUNT}+ recenzii)</span>
          </div>
        </div>

        {showToast && (
          <div
            className={`${styles.toast} ${isToastVisible ? styles.toast_visible : ""}`}
          >
            <div className={styles.toast_content}>
              <svg
                className={styles.toast_icon}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z" />
              </svg>
              <span>Link-ul a fost copiat!</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
