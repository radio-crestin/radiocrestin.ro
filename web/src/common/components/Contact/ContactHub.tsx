import ContactPage from "./ContactPage";
import { CONTACT_COPY } from "./copy";
import { useAppContext } from "./useAppContext";
import { contactOptions, type ContactOption } from "./options";
import { ArrowIcon } from "./icons";
import styles from "./styles.module.scss";

function HubCard({ option }: { option: ContactOption }) {
  const { href, title, text, Icon, external, key } = option;
  return (
    <a
      href={href}
      className={`${styles.hub_card} ${key === "whatsapp" ? styles.hub_card_whatsapp : ""}`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span className={styles.hub_icon} aria-hidden="true">
        <Icon />
      </span>
      <strong className={styles.hub_card_title}>{title}</strong>
      <span className={styles.hub_card_text}>{text}</span>
      <span className={styles.hub_arrow} aria-hidden="true">
        <ArrowIcon />
      </span>
    </a>
  );
}

export default function ContactHub() {
  const context = useAppContext();
  const copy = CONTACT_COPY.hub;

  const hero = (
    <>
      <p className={styles.eyebrow}>{copy.eyebrow}</p>
      <h1 className={styles.hero_title}>
        {copy.title.before}
        <span className={styles.hero_accent}>{copy.title.accent}</span>
        {copy.title.after}
      </h1>
      <p className={styles.hero_intro}>{copy.intro}</p>
    </>
  );

  return (
    <ContactPage hero={hero}>
      <h2 className={styles.content_heading}>{copy.cardsHeading}</h2>
      <nav className={styles.hub_grid} aria-label={copy.cardsHeading}>
        {contactOptions(context).map((option) => (
          <HubCard key={option.key} option={option} />
        ))}
      </nav>
    </ContactPage>
  );
}
