// The fields of each contact form, in display order, with the same limits the
// API enforces (POST /api/v1/contact/). Rendering and validation both read this.

export type ContactKind = "general" | "feedback" | "report" | "station" | "announcement";

export type FieldType =
  | "text"
  | "email"
  | "url"
  | "tel"
  | "textarea"
  | "choice"
  | "select"
  | "station"
  | "date"
  | "images";

export type Values = Record<string, string>;

export interface FieldDef {
  name: string;
  type: FieldType;
  required?: boolean | ((values: Values) => boolean);
  showIf?: (values: Values) => boolean;
  maxLength?: number;
  minLength?: number;
  maxFiles?: number;
  options?: readonly string[];
  rows?: number;
  counter?: boolean;
  /** Shares a row with the next half-width field on wide screens. */
  half?: boolean;
}

export interface SectionDef {
  /** Key of the section heading in the form's copy, or "contact" for "Your contact details". */
  title?: string;
  fields: FieldDef[];
}

export const DENOMINATIONS = [
  "pentecostal",
  "baptist",
  "brethren",
  "adventist",
  "orthodox",
  "lords_army",
  "roman_catholic",
  "greek_catholic",
  "reformed",
  "lutheran",
  "evangelical",
  "nondenominational",
  "other",
  "unknown",
] as const;

const aboutStation = (v: Values) => v.about === "station";
const otherProblem = (v: Values) => v.problem === "other";
const otherDenomination = (v: Values) => v.denomination === "other";

const contactSection = (nameRequired: boolean): SectionDef => ({
  title: "contact",
  fields: [
    { name: "name", type: "text", required: nameRequired, maxLength: 100, half: true },
    { name: "email", type: "email", required: true, maxLength: 254, half: true },
    { name: "phone", type: "tel", maxLength: 40 },
  ],
});

export const FORMS: Record<ContactKind, SectionDef[]> = {
  general: [
    {
      title: "message",
      fields: [
        { name: "message", type: "textarea", required: true, minLength: 10, maxLength: 5000, rows: 6 },
        { name: "images", type: "images", maxFiles: 3 },
      ],
    },
    contactSection(false),
  ],
  feedback: [
    {
      title: "idea",
      fields: [
        { name: "suggestion_type", type: "choice", required: true, options: ["feature", "improvement", "bug", "other"] },
        { name: "area", type: "select", options: ["app", "website", "car", "tv", "other"] },
        { name: "message", type: "textarea", required: true, minLength: 10, maxLength: 5000, rows: 5 },
        { name: "images", type: "images", maxFiles: 3 },
      ],
    },
    contactSection(false),
  ],
  report: [
    {
      title: "problem",
      fields: [
        { name: "station_slug", type: "station", required: true },
        {
          name: "problem",
          type: "choice",
          required: true,
          options: ["not_playing", "poor_quality", "wrong_song_info", "wrong_details", "inappropriate_content", "other"],
        },
        { name: "message", type: "textarea", required: otherProblem, maxLength: 3000, rows: 4 },
        { name: "images", type: "images", maxFiles: 3 },
      ],
    },
    contactSection(false),
  ],
  station: [
    {
      title: "station",
      fields: [
        { name: "station_name", type: "text", required: true, maxLength: 120 },
        { name: "website", type: "url", maxLength: 500, half: true },
        { name: "listen_url", type: "url", maxLength: 500, half: true },
        { name: "description", type: "textarea", maxLength: 1500, rows: 3 },
        { name: "denomination", type: "select", required: true, options: DENOMINATIONS },
        {
          name: "denomination_other",
          type: "text",
          required: true,
          maxLength: 100,
          showIf: otherDenomination,
        },
        { name: "mission", type: "textarea", maxLength: 1000, rows: 3 },
        { name: "logo", type: "images", maxFiles: 1 },
      ],
    },
    {
      title: "extra",
      fields: [
        { name: "station_email", type: "email", maxLength: 254 },
        { name: "facebook_url", type: "url", maxLength: 500 },
        { name: "note", type: "textarea", maxLength: 2000, rows: 3 },
      ],
    },
    contactSection(true),
  ],
  announcement: [
    {
      title: "what",
      fields: [
        { name: "about", type: "choice", required: true, options: ["station", "general"] },
        { name: "station_slug", type: "station", required: true, showIf: aboutStation },
        { name: "title", type: "text", required: true, maxLength: 80, counter: true },
        { name: "summary", type: "textarea", required: true, maxLength: 280, rows: 3, counter: true },
        { name: "details", type: "textarea", maxLength: 5000, rows: 5 },
        { name: "link", type: "url", maxLength: 500 },
        { name: "images", type: "images", maxFiles: 3 },
      ],
    },
    {
      title: "when",
      fields: [
        { name: "starts_on", type: "date", half: true },
        { name: "ends_on", type: "date", half: true },
      ],
    },
    contactSection(true),
  ],
};

export const fieldsOf = (kind: ContactKind): FieldDef[] =>
  FORMS[kind].flatMap((section) => section.fields);

export const isVisible = (field: FieldDef, values: Values) =>
  !field.showIf || field.showIf(values);

const isRequired = (field: FieldDef, values: Values) =>
  typeof field.required === "function" ? field.required(values) : !!field.required;

/** Same rule as the API: an email has one @, no spaces, and a dotted domain. */
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** People type "radio.ro" or "www.radio.ro"; links without a scheme get https://, as on the server. */
export const withScheme = (value: string) =>
  /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;

export const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
};

const isDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

export interface FieldError {
  code: string;
  params?: Record<string, number>;
}

export type Errors = Record<string, FieldError>;

function checkField(field: FieldDef, value: string, fileCount: number): FieldError | null {
  if (field.type === "images") {
    return field.maxFiles && fileCount > field.maxFiles
      ? { code: "too_many_files", params: { max: field.maxFiles } }
      : null;
  }
  if (!value) return null;
  if (field.maxLength && value.length > field.maxLength)
    return { code: "too_long", params: { max: field.maxLength } };
  if (field.minLength && value.length < field.minLength)
    return { code: "too_short", params: { min: field.minLength } };
  if (field.type === "email" && !isEmail(value)) return { code: "invalid_email" };
  if (field.type === "url" && !isHttpUrl(withScheme(value))) return { code: "invalid_url" };
  if (field.type === "date" && !isDate(value)) return { code: "invalid_date" };
  if (field.options && !field.options.includes(value)) return { code: "invalid_choice" };
  return null;
}

/** Errors for the visible fields of a form; `fileCounts` maps image fields to how many files they hold. */
export function validate(
  kind: ContactKind,
  values: Values,
  fileCounts: Record<string, number> = {},
): Errors {
  const errors: Errors = {};
  for (const field of fieldsOf(kind)) {
    if (!isVisible(field, values)) continue;
    const value = (values[field.name] ?? "").trim();
    if (!value && field.type !== "images" && isRequired(field, values)) {
      errors[field.name] = { code: "required" };
      continue;
    }
    const error = checkField(field, value, fileCounts[field.name] ?? 0);
    if (error) errors[field.name] = error;
  }
  if (kind === "station" && !values.website?.trim() && !values.listen_url?.trim()) {
    errors.listen_url ??= { code: "need_website_or_listen_url" };
  }
  if (kind === "announcement" && values.starts_on && values.ends_on && !errors.ends_on) {
    if (values.ends_on < values.starts_on) errors.ends_on = { code: "end_before_start" };
  }
  return errors;
}
