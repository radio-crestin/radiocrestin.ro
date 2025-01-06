import React, { useContext } from "react";

import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";

export default function WhatsAppButton() {
  const { ctx } = useContext(Context);
  return (
    <a
      href="https://wa.me/40766338046?text=Buna%20ziua%20[radiocrestin.ro]%0A"
      target="_blank"
      className={`${styles.contactButton} ${
        ctx?.selectedStation ? styles.contactButtonPlayerIsOn : ""
      }`}
      aria-label="Contact us on WhatsApp"
    >
      Contact
    </a>
  );
}
