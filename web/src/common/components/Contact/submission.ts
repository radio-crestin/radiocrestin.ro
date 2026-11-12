import type { ContactSubmission } from "@/services/submitContact";
import type { AppContext } from "./appContext";
import { fieldsOf, isVisible, type ContactKind, type Errors, type Values } from "./schema";

interface Extras {
  context: AppContext;
  honeypot: string;
  elapsedMs: number;
  turnstileToken: string;
}

/** What the API receives: only the fields visible for these answers, plus the anti-spam and app context fields. */
export function buildSubmission(
  kind: ContactKind,
  values: Values,
  files: Record<string, File[]>,
  { context, honeypot, elapsedMs, turnstileToken }: Extras,
): ContactSubmission {
  const fields: Record<string, string> = {
    kind,
    confirm_url: honeypot,
    elapsed_ms: String(Math.max(0, Math.round(elapsedMs))),
    source: context.source || "web",
    platform: context.platform ?? "",
    app_version: context.app_version ?? "",
    device_id: context.device_id ?? "",
    turnstile_token: turnstileToken,
  };
  const submissionFiles: Record<string, File[]> = {};
  for (const field of fieldsOf(kind)) {
    if (!isVisible(field, values)) continue;
    if (field.type === "images") submissionFiles[field.name] = files[field.name] ?? [];
    else fields[field.name] = (values[field.name] ?? "").trim();
  }
  return { fields, files: submissionFiles };
}

/** The API's {field: code} errors, with the limits the messages mention. */
export function fromServerErrors(kind: ContactKind, serverErrors: Record<string, string>): Errors {
  const byName = new Map(fieldsOf(kind).map((field) => [field.name, field]));
  const errors: Errors = {};
  for (const [name, code] of Object.entries(serverErrors)) {
    const field = byName.get(name);
    const limit: Record<string, Record<string, number> | undefined> = {
      too_long: field?.maxLength ? { max: field.maxLength } : undefined,
      too_short: field?.minLength ? { min: field.minLength } : undefined,
      too_many_files: field?.maxFiles ? { max: field.maxFiles } : undefined,
    };
    const params = limit[code];
    errors[name] = { code: String(code), params };
  }
  return errors;
}
