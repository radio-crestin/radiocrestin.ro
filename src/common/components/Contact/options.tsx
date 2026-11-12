import type { ReactElement } from "react";
import { CONTACT_COPY, CONTACT_PATHS } from "./copy";
import { withAppContext, type AppContext } from "./appContext";
import { whatsappUrl } from "./links";
import { AlertIcon, BulbIcon, MegaphoneIcon, MessageIcon, RadioIcon, WhatsAppIcon } from "./icons";
import type { ContactKind } from "./schema";

export interface ContactOption {
  key: ContactKind | "whatsapp";
  href: string;
  title: string;
  text: string;
  Icon: () => ReactElement;
  external?: boolean;
}

const FORM_ICONS: [ContactKind, () => ReactElement][] = [
  ["general", MessageIcon],
  ["feedback", BulbIcon],
  ["report", AlertIcon],
  ["station", RadioIcon],
  ["announcement", MegaphoneIcon],
];

/** Every way to reach us, in hub order: the five forms, then WhatsApp. */
export function contactOptions(context: AppContext): ContactOption[] {
  const { cards, whatsappCard } = CONTACT_COPY.hub;
  return [
    ...FORM_ICONS.map(([kind, Icon]) => ({
      key: kind,
      href: withAppContext(CONTACT_PATHS[kind], context),
      title: cards[kind].title,
      text: cards[kind].text,
      Icon,
    })),
    { key: "whatsapp", href: whatsappUrl(context), ...whatsappCard, Icon: WhatsAppIcon, external: true },
  ];
}
