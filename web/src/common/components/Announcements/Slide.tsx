import React from "react";
import type { ClickTarget, IAnnouncement, IAnnouncementAction, IAnnouncementButton, IconSize } from "@/models/Announcement";
import { hasBodyText, resolveWebAction } from "@/utils/announcements";
import { colorVars } from "@/utils/announcementColors";
export { colorVars };
import { CloseGlyph } from "./icons";
import { T } from "./strings";
import { hasPrimaryAction } from "./useAnnouncementActions";
import styles from "./styles";

export interface SlideHandlers {
  onPrimary: (announcement: IAnnouncement, target: ClickTarget) => void;
  /** "✕ Ascunde": hide this announcement for good on this device. */
  onDismiss: (announcement: IAnnouncement) => void;
  /** A link in the description (e.g. "Donează"), which navigates by itself. */
  onLink: (announcement: IAnnouncement, href: string) => void;
}

/** The button's icon, as SVG markup prepared at build time (absent for client-fetched items). */
export const ButtonIcon = ({ button }: { button: IAnnouncementButton }) =>
  button.icon_svg ? <span className={styles.ctaIcon} dangerouslySetInnerHTML={{ __html: button.icon_svg }} /> : null;

export const CategoryTag = ({ announcement }: { announcement: IAnnouncement }) =>
  announcement.category?.name ? (
    <span className={styles.tag}>{announcement.category.name}</span>
  ) : null;

interface ActionLinkProps {
  action: IAnnouncementAction | null | undefined;
  className: string;
  onActivate: () => void;
  /** The full label, for a label cut short with an ellipsis. */
  title?: string;
  children: React.ReactNode;
}

/** A link for URL actions (keeps middle-click and "open in new tab"), a button for the page dialog. */
export const ActionControl = ({ action, className, onActivate, title, children }: ActionLinkProps) => {
  const resolved = resolveWebAction(action);
  if (!resolved) return null;
  if (resolved.kind !== "link") {
    return (
      <button type="button" className={className} title={title} onClick={onActivate}>
        {children}
      </button>
    );
  }
  return (
    <a
      className={className}
      title={title}
      href={resolved.href}
      onClick={onActivate}
      {...(resolved.newTab && { target: "_blank", rel: "noopener noreferrer" })}
    >
      {children}
    </a>
  );
};

const STYLE_CLASS = {
  filled: "",
  outline: styles.ctaOutline,
  text: styles.ctaText,
  hidden: "",
} as const;

const Actions = ({ announcement, onPrimary, onDismiss }: { announcement: IAnnouncement } & SlideHandlers) => {
  const { button } = announcement;
  const primary = button && button.style !== "hidden" && button.action?.type !== "none" && (
    <ActionControl
      action={button.action}
      className={`${styles.cta} ${STYLE_CLASS[button.style] ?? ""}`}
      title={button.label}
      onActivate={() => onPrimary(announcement, "button")}
    >
      <span className={styles.ctaLabel}>{button.label}</span>
      <ButtonIcon button={button} />
    </ActionControl>
  );

  // Always last and right-aligned, so it is never mistaken for the main action.
  const dismiss = announcement.dismissible !== false && (
    <button
      type="button"
      className={styles.dismiss}
      aria-label={T.dismissAria}
      onClick={() => onDismiss(announcement)}
    >
      <CloseGlyph />
      {T.dismiss}
    </button>
  );

  if (!primary && !dismiss) return null;
  return (
    <div className={styles.actions}>
      {primary}
      {dismiss}
    </div>
  );
};

interface SlideProps extends SlideHandlers {
  announcement: IAnnouncement;
  /** Accessible name, e.g. "2 din 3" in a carousel. */
  label?: string;
  /** Previous / "i din N" / next, in a carousel with 2+ slides. */
  nav?: React.ReactNode;
  /** The slide the server shows; the pre-paint style may swap it for the rotation's start. */
  serverFirst?: boolean;
  /** Fades in after a navigation. */
  entering?: boolean;
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** The icon tile's minimum size (SPEC "Layout v2"); medium is the stylesheet's default. */
const ICON_PX: Record<IconSize, number> = { small: 40, medium: 52, large: 72 };
export const iconSizeVar = (a: IAnnouncement): React.CSSProperties => {
  const size = a.icon?.size;
  if (!size || size === "medium" || !(size in ICON_PX)) return {};
  return { "--ann-icon": `${ICON_PX[size]}px` } as React.CSSProperties;
};

const isFromControl = (target: EventTarget) => !!(target as HTMLElement).closest("a,button");

/**
 * One announcement: icon | tag, title, body | navigation and buttons. Tapping anywhere but its
 * links and buttons runs the primary action.
 */
const Slide = ({
  announcement: a,
  label = a.title,
  nav,
  serverFirst = false,
  entering = false,
  active = true,
  className = "",
  style,
  ...handlers
}: SlideProps) => {
  const tappable = hasPrimaryAction(a);
  // With a hidden button the card itself is the only control, so it takes keyboard focus.
  const focusable = tappable && a.button?.style === "hidden";

  const onClick = (e: React.MouseEvent) => {
    const bodyLink = (e.target as HTMLElement).closest<HTMLAnchorElement>(`.${styles.body} a[href]`);
    if (bodyLink) handlers.onLink(a, bodyLink.href);
    else if (tappable && !isFromControl(e.target)) handlers.onPrimary(a, "card");
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (focusable && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      handlers.onPrimary(a, "card");
    }
  };

  return (
    <section
      data-ann={a.slug}
      data-ann-a={serverFirst ? "" : undefined}
      data-enter={entering ? "" : undefined}
      className={`${styles.slide} ${tappable ? styles.tappable : ""} ${className}`}
      style={{ ...colorVars(a), ...iconSizeVar(a), ...style }}
      aria-roledescription={T.slide}
      aria-label={label}
      aria-hidden={!active}
      inert={!active}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={focusable && active ? 0 : undefined}
    >
      {a.icon?.url ? (
        <div className={styles.icon}>
          <img src={a.icon.url} alt="" width={110} height={110} loading="lazy" decoding="async" />
        </div>
      ) : (
        <div className={styles.icon} dangerouslySetInnerHTML={{ __html: a.icon?.svg ?? "" }} />
      )}
      <div className={styles.text}>
        <div className={styles.meta}>
          <CategoryTag announcement={a} />
        </div>
        <h3 className={styles.title}>{a.title}</h3>
        {hasBodyText(a.body_html) && <p className={styles.body} dangerouslySetInnerHTML={{ __html: a.body_html }} />}
      </div>
      <div className={styles.side}>
        {nav}
        <Actions announcement={a} {...handlers} />
      </div>
    </section>
  );
};

export default Slide;
