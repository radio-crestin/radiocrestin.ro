import React, { useContext } from "react";

import styles from "./styles.module.scss";
import { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import { SHARE_URL } from "@/constants/constants";


export default function ShareOnSocial() {
  const { ctx } = useContext(Context);
  const station = ctx?.selectedStation as IStation;
  if(!station) return null;
  const url = `${SHARE_URL}/${station.slug}`
  const message = `Ascultă și tu ${station.title}: \n${url}`
  const facebookShareLink =  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(message)}`;
  const whatsappShareLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  return (
      <div className={styles.buttonContainer}>
        <span className={styles.label}>Distribuie</span>
        <a href={facebookShareLink} target="_blank" rel="noopener noreferrer" className={`${styles.button} ${styles.facebookButton}`} title="Trimite pe Facebook">
            <img src="./icons/facebook.svg" alt="Facebook" className={styles.socialIcon} />
        </a>
        <a href={whatsappShareLink} target="_blank" rel="noopener noreferrer" className={`${styles.button} ${styles.whatsappButton}`} title="Trimite pe WhatsApp">
          <img src="./icons/whatsapp.svg" alt="WhatsApp" className={styles.socialIcon} />
        </a>
      </div>
  );
}
