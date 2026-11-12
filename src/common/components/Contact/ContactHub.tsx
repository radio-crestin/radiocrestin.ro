import React from "react";
import ContactPage from "./ContactPage";
import { CONTACT_COPY, CONTACT_PATHS } from "./copy";
import { withAppContext } from "./appContext";
import { useAppContext } from "./useAppContext";
import { WHATSAPP_URL } from "./links";
import { AlertIcon, BulbIcon, MessageIcon, MegaphoneIcon, RadioIcon } from "./icons";
import type { ContactKind } from "./schema";
import styles from "./styles.module.scss";

const CARDS: { kind: ContactKind; Icon: () => React.ReactElement }[] = [
  { kind: "general", Icon: MessageIcon },
  { kind: "feedback", Icon: BulbIcon },
  { kind: "report", Icon: AlertIcon },
  { kind: "station", Icon: RadioIcon },
  { kind: "announcement", Icon: MegaphoneIcon },
];

export default function ContactHub() {
  const context = useAppContext();
  const copy = CONTACT_COPY.hub;

  return (
    <ContactPage>
      <h1 className={styles.title}>{copy.title}</h1>
      <p className={styles.intro}>{copy.intro}</p>

      <nav className={styles.hub_cards}>
        {CARDS.map(({ kind, Icon }) => (
          <a key={kind} href={withAppContext(CONTACT_PATHS[kind], context)} className={styles.hub_card}>
            <span className={styles.hub_icon} aria-hidden="true">
              <Icon />
            </span>
            <span className={styles.hub_text}>
              <strong>{copy.cards[kind].title}</strong>
              <span>{copy.cards[kind].text}</span>
            </span>
            <span className={styles.hub_arrow} aria-hidden="true">
              ›
            </span>
          </a>
        ))}
      </nav>

      <p className={styles.whatsapp}>
        {CONTACT_COPY.common.whatsappPrefix}{" "}
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          {CONTACT_COPY.common.whatsappLink}
        </a>
      </p>
    </ContactPage>
  );
}
