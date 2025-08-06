"use client";

import React from "react";

import styles from "./styles.module.scss";

interface WhatsAppButtonProps {
  isPlayerOn?: boolean;
}

export default function WhatsAppButton({ isPlayerOn = false }: WhatsAppButtonProps) {
  return (
    <a
      href="https://wa.me/40766338046?text=Buna%20ziua%20[radiocrestin.ro]%0A"
      target="_blank"
      className={`${styles.contactButton} ${
        isPlayerOn ? styles.contactButtonPlayerIsOn : ""
      }`}
      aria-label="Contact us on WhatsApp"
    >
      Contact
    </a>
  );
}
