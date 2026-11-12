import { CONTACT_COPY } from "./copy";
import type { ContactKind, FieldError } from "./schema";

export interface FieldCopy {
  label: string;
  hint?: string;
  placeholder?: string;
  options?: Record<string, string>;
}

/** Fills {name} placeholders: fill("{count}/{max}", { count: 3, max: 80 }) → "3/80". */
export const fill = (template: string, params: Record<string, string | number> = {}) =>
  template.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match));

export function fieldCopy(kind: ContactKind, name: string): FieldCopy {
  const formFields = CONTACT_COPY[kind].fields as Record<string, FieldCopy>;
  const shared = CONTACT_COPY.contactFields as Record<string, FieldCopy>;
  return formFields[name] ?? shared[name] ?? { label: name };
}

export function errorText(error: FieldError): string {
  const messages = CONTACT_COPY.errors as Record<string, string>;
  return fill(messages[error.code] ?? CONTACT_COPY.errors.required, error.params);
}
