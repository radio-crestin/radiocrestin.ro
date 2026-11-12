import React, { useEffect, useRef, useState } from "react";
import { submitContact } from "@/services/submitContact";
import { trackContactSubmitted } from "@/utils/posthog";
import ContactPage from "./ContactPage";
import Field, { inputId, type StationOption } from "./Field";
import ImagePicker from "./ImagePicker";
import Turnstile from "./Turnstile";
import { CONTACT_COPY, CONTACT_PATHS } from "./copy";
import { errorText, fieldCopy, fill } from "./copyText";
import { withAppContext } from "./appContext";
import { useAppContext } from "./useAppContext";
import { buildSubmission, fromServerErrors } from "./submission";
import { FORMS, fieldsOf, isVisible, validate, type ContactKind, type Errors, type FieldDef, type Values } from "./schema";
import { CheckIcon } from "./icons";
import { PRIVACY_URL } from "./links";
import styles from "./styles.module.scss";

interface ContactFormProps {
  kind: ContactKind;
  /** Stations for the announcement form's picker, sorted by title. */
  stations?: StationOption[];
}

type Phase = "editing" | "sending" | "sent";

const BANNERS = {
  invalid: CONTACT_COPY.common.errorBanner,
  too_large: CONTACT_COPY.common.tooLarge,
  rate_limited: CONTACT_COPY.common.rateLimited,
  network: CONTACT_COPY.common.network,
  server: CONTACT_COPY.common.server,
};

const isRequired = (field: FieldDef, values: Values) =>
  typeof field.required === "function" ? field.required(values) : !!field.required;

/** ?station=<slug> on the announcement form preselects that station. */
function initialValues(kind: ContactKind, stations: StationOption[]): Values {
  if (kind !== "announcement" || typeof window === "undefined") return {};
  const slug = new URLSearchParams(window.location.search).get("station");
  return stations.some((s) => s.slug === slug) ? { about: "station", station_slug: slug! } : {};
}

function focusField(name: string) {
  const element = document.getElementById(inputId(name));
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
  element?.focus({ preventScroll: true });
}

export default function ContactForm({ kind, stations = [] }: ContactFormProps) {
  const copy = CONTACT_COPY[kind];
  const context = useAppContext();
  const [values, setValues] = useState<Values>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [imageErrors, setImageErrors] = useState<Record<string, string | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [phase, setPhase] = useState<Phase>("editing");
  const [banner, setBanner] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const startedAt = useRef(0);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
    setValues(initialValues(kind, stations));
  }, [kind, stations]);

  const fileCounts = Object.fromEntries(Object.entries(files).map(([name, list]) => [name, list.length]));

  function setValue(name: string, value: string) {
    const next = { ...values, [name]: value };
    setValues(next);
    // After the first attempt, errors follow the answers as they change.
    if (submitted) setErrors(validate(kind, next, fileCounts));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const found = validate(kind, values, fileCounts);
    setErrors(found);
    const firstInvalid = fieldsOf(kind).find((f) => found[f.name] && isVisible(f, values));
    if (firstInvalid) {
      setBanner(BANNERS.invalid);
      focusField(firstInvalid.name);
      return;
    }

    setPhase("sending");
    setBanner(null);
    const submission = buildSubmission(kind, values, files, {
      context,
      honeypot,
      elapsedMs: Date.now() - startedAt.current,
      turnstileToken,
    });
    const result = await submitContact(submission);
    if (result.status === "ok") {
      trackContactSubmitted(kind, submission.fields.source);
      setPhase("sent");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setPhase("editing");
    setTurnstileReset((n) => n + 1);
    if (result.status === "invalid") {
      const serverErrors = fromServerErrors(kind, result.errors);
      setErrors(serverErrors);
      const fieldWithError = fieldsOf(kind).find((f) => serverErrors[f.name]);
      setBanner(serverErrors.turnstile_token ? errorText(serverErrors.turnstile_token) : BANNERS.invalid);
      if (fieldWithError) focusField(fieldWithError.name);
      return;
    }
    setBanner(BANNERS[result.status]);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function reset() {
    setValues({});
    setFiles({});
    setErrors({});
    setImageErrors({});
    setSubmitted(false);
    setBanner(null);
    startedAt.current = Date.now();
    setPhase("editing");
  }

  const backLink = (
    <a href={withAppContext(CONTACT_PATHS.hub, context)} className={styles.back_link}>
      ‹ {CONTACT_COPY.common.backToHub}
    </a>
  );

  if (phase === "sent") {
    return (
      <ContactPage>
        <div className={styles.success} role="status">
          <span className={styles.success_icon}>
            <CheckIcon />
          </span>
          <h1 className={styles.title}>{CONTACT_COPY.common.successTitle}</h1>
          <p className={styles.intro}>{fill(CONTACT_COPY.common.successBody, { email: values.email ?? "" })}</p>
          <div className={styles.success_actions}>
            <button type="button" className={styles.secondary_button} onClick={reset}>
              {CONTACT_COPY.common.successAgain}
            </button>
            <a href="/" className={styles.submit}>
              {CONTACT_COPY.common.successHome}
            </a>
          </div>
        </div>
      </ContactPage>
    );
  }

  function renderField(field: FieldDef) {
    if (!isVisible(field, values)) return null;
    const required = isRequired(field, values);
    const shownError = errors[field.name] ? errorText(errors[field.name]) : undefined;
    if (field.type === "images") {
      const imageError = imageErrors[field.name];
      return (
        <div key={field.name} className={styles.field}>
          <label className={styles.label} htmlFor={inputId(field.name)}>
            {fieldCopy(kind, field.name).label}
            <span className={styles.optional}> {CONTACT_COPY.common.optional}</span>
          </label>
          {fieldCopy(kind, field.name).hint && <p className={styles.hint}>{fieldCopy(kind, field.name).hint}</p>}
          <ImagePicker
            name={field.name}
            maxFiles={field.maxFiles ?? 1}
            files={files[field.name] ?? []}
            onChange={(list) => setFiles((current) => ({ ...current, [field.name]: list }))}
            onError={(code) => setImageErrors((current) => ({ ...current, [field.name]: code }))}
          />
          {(imageError || shownError) && (
            <p className={styles.error} role="alert">
              {shownError ?? errorText({ code: imageError!, params: { max: field.maxFiles ?? 1 } })}
            </p>
          )}
        </div>
      );
    }
    return (
      <Field
        key={field.name}
        field={field}
        copy={fieldCopy(kind, field.name)}
        value={values[field.name] ?? ""}
        error={shownError}
        required={required}
        stations={stations}
        onChange={(value) => setValue(field.name, value)}
      />
    );
  }

  const sections = copy as { sections?: Record<string, string> };

  return (
    <ContactPage>
      <div ref={topRef} />
      {backLink}
      <h1 className={styles.title}>{copy.title}</h1>
      <p className={styles.intro}>{copy.intro}</p>

      {banner && (
        <div className={styles.banner} role="alert">
          {banner}
        </div>
      )}

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {FORMS[kind].map((section, index) => {
          const fields = section.fields.filter((field) => isVisible(field, values));
          if (fields.length === 0) return null;
          const heading =
            section.title === "contact"
              ? CONTACT_COPY.common.yourDetails
              : section.title && sections.sections?.[section.title];
          return (
            <section key={index} className={styles.section}>
              {heading && <h2 className={styles.section_title}>{heading}</h2>}
              {section.title === "contact" && <p className={styles.hint}>{CONTACT_COPY.common.yourDetailsHint}</p>}
              {section.fields.map(renderField)}
            </section>
          );
        })}

        {/* Honeypot: people never see or fill it; bots that fill every field get filtered by the API. */}
        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor="contact-confirm-url">Confirm URL</label>
          <input
            id="contact-confirm-url"
            name="confirm_url"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <Turnstile onToken={setTurnstileToken} resetKey={turnstileReset} />

        <button type="submit" className={styles.submit} disabled={phase === "sending"}>
          {phase === "sending" && <span className={styles.spinner} aria-hidden="true" />}
          {phase === "sending" ? CONTACT_COPY.common.sending : CONTACT_COPY.common.send}
        </button>
        <p className={styles.privacy}>
          {CONTACT_COPY.common.privacyPrefix} <a href={PRIVACY_URL}>{CONTACT_COPY.common.privacyLink}</a>.
        </p>
      </form>
    </ContactPage>
  );
}
