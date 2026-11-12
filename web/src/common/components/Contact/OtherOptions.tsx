import { CONTACT_COPY } from "./copy";
import { contactOptions } from "./options";
import type { AppContext } from "./appContext";
import type { ContactKind } from "./schema";
import styles from "./styles.module.scss";

/** The form pages' sidebar: every other way to reach us, as compact links. */
export default function OtherOptions({ current, context }: { current: ContactKind; context: AppContext }) {
  const heading = CONTACT_COPY.hub.otherOptions;
  return (
    <aside className={styles.other_options}>
      <h2 className={styles.other_options_title}>{heading}</h2>
      <nav aria-label={heading}>
        {contactOptions(context)
          .filter((option) => option.key !== current)
          .map(({ key, href, title, Icon, external }) => (
            <a
              key={key}
              href={href}
              className={`${styles.other_option} ${key === "whatsapp" ? styles.hub_card_whatsapp : ""}`}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <span className={styles.other_option_icon} aria-hidden="true">
                <Icon />
              </span>
              <span>{title}</span>
            </a>
          ))}
      </nav>
    </aside>
  );
}
