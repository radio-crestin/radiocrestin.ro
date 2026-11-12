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

export default function ContactHub() {
  const context = useAppContext();
  const copy = CONTACT_COPY.hub;
  const options = contactOptions(context);
  const forms = options.filter((option) => option.key !== "whatsapp");
  const whatsapp = options.find((option) => option.key === "whatsapp");

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
      <nav className={styles.options} aria-label={copy.cardsHeading}>
        {forms.map((option) => (
          <OptionRow key={option.key} option={option} />
        ))}
        {/* WhatsApp comes last, set apart: the forms keep messages organized. */}
        {whatsapp && (
          <div className={styles.options_last}>
            <OptionRow option={whatsapp} />
          </div>
        )}
      </nav>
    </ContactPage>
  );
}
