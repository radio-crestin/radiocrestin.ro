import Image from "next/image";

import styles from './styles.module.scss';
import qr_code from "@/images/qr-code.webp"
import playstore from "@/images/playstore.svg"
import appstore from "@/images/appstore.svg"

const BannerApp = () => {
  return (
    <div className={styles.container_banner}>
      <div className={styles.content_left}>
        <h1 className={styles["chakra-text"]}>
          Între timp descarcă aplicația Radio Creștin
        </h1>
        <p className={styles["chakra-text"]}>
          Toate posturile tale preferate într-un singur loc, gratis și fără reclame.
        </p>
        <div className={styles.apps_download}>
          <a href="https://apps.apple.com/app/6451270471" target={"_blank"}>
            <Image
              alt="AppStore Image Radio Crestin"
              loading="lazy"
              width="150"
              height="47"
              src={appstore.src}
            />
          </a>
          <a style={{ position: "relative" }} target={"_blank"}
            href="https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin&amp;hl=en_US">
            <Image
              alt="PlayStore Image Radio Crestin"
              loading="lazy"
              width="150"
              height="53"
              src={playstore.src}
            />
          </a>
        </div>
      </div>
      <div className={styles.QR_code}>
        <Image
          alt="QR Code Radio Crestin"
          loading="lazy"
          width="90"
          height="90"
          src={qr_code.src}
        />
      </div>
    </div>
  );
};

export default BannerApp;
