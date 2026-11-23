import ContactPage from "./ContactPage";
import { CONTACT_COPY } from "./copy";
import { useAppContext } from "./useAppContext";
import { contactOptions, type ContactOption } from "./options";
import { ArrowIcon } from "./icons";
import styles from "./styles.module.scss";

function OptionRow({ option }: { option: ContactOption }) {
  const { href, title, text, Icon, external, key } = option;
  return (
    <a
      href={href}
      className={`${styles.option} ${key === "whatsapp" ? styles.option_whatsapp : ""}`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span className={styles.option_icon} aria-hidden="true">
        <Icon />
      </span>
      <span className={styles.option_body}>
        <strong className={styles.option_title}>{title}</strong>
        <span className={styles.option_text}>{text}</span>
      </span>
      <span className={styles.option_arrow} aria-hidden="true">
        <ArrowIcon />
      </span>
    </a>
  );
}

const GROUPS = [
  { key: "forms", options: ["general", "feedback", "report", "station", "announcement"] },
  { key: "chat", options: ["whatsapp"] },
] as const;

export default function ContactHub() {
  const context = useAppContext();
  const copy = CONTACT_COPY.hub;
  const options = contactOptions(context);

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
      <nav className={styles.groups} aria-label={copy.cardsHeading}>
        {GROUPS.map((group) => (
          <section
            key={group.key}
            className={styles.group}
            aria-labelledby={group.key === "chat" ? `contact-group-${group.key}` : undefined}
          >
            {group.key === "chat" && (
              <h2 className={styles.group_title} id={`contact-group-${group.key}`}>
                {copy.groups.chat}
              </h2>
            )}
            <div className={styles.options}>
              {options
                .filter((option) => (group.options as readonly string[]).includes(option.key))
                .map((option) => (
                  <OptionRow key={option.key} option={option} />
                ))}
            </div>
          </section>
        ))}
      </nav>
    </ContactPage>
  );
}
