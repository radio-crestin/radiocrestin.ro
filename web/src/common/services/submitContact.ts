import { CONTACT_API_URL } from "@/constants/constants";
import { captureException } from "@/utils/posthog";

export type SubmitResult =
  | { status: "ok" }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "too_large" | "rate_limited" | "network" | "server" };

/** Text fields and image files of one contact form, ready to send. */
export interface ContactSubmission {
  fields: Record<string, string>;
  files: Record<string, File[]>;
}

export function toFormData({ fields, files }: ContactSubmission): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value !== "") data.append(name, value);
  }
  for (const [name, list] of Object.entries(files)) {
    for (const file of list) data.append(name, file, file.name);
  }
  return data;
}

async function readErrors(response: Response): Promise<Record<string, string>> {
  try {
    const body = await response.json();
    return body && typeof body.errors === "object" ? body.errors : {};
  } catch {
    return {};
  }
}

/**
 * Sends a contact form as multipart/form-data. No custom headers, so the
 * browser makes a simple CORS request without a preflight.
 */
export async function submitContact(submission: ContactSubmission): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetch(CONTACT_API_URL, { method: "POST", body: toFormData(submission) });
  } catch (error) {
    captureException(error, "Contact form network error");
    return { status: "network" };
  }
  if (response.ok) return { status: "ok" };
  if (response.status === 400) return { status: "invalid", errors: await readErrors(response) };
  if (response.status === 413) return { status: "too_large" };
  if (response.status === 429) return { status: "rate_limited" };
  captureException(new Error(`HTTP ${response.status}`), "Contact form server error");
  return { status: "server" };
}
