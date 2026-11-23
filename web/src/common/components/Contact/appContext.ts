// The mobile app opens /contact/?source=app&platform=android&app_version=…&device_id=…
// These params travel from the hub to each form and are sent with the message.

export const CONTEXT_PARAMS = ["source", "platform", "app_version", "device_id"] as const;

const MAX_LENGTH: Record<(typeof CONTEXT_PARAMS)[number], number> = {
  source: 16,
  platform: 32,
  app_version: 32,
  device_id: 128,
};

export type AppContext = Partial<Record<(typeof CONTEXT_PARAMS)[number], string>>;

export function readAppContext(search: string): AppContext {
  const params = new URLSearchParams(search);
  const context: AppContext = {};
  for (const key of CONTEXT_PARAMS) {
    const value = params.get(key)?.trim();
    if (value) context[key] = value.slice(0, MAX_LENGTH[key]);
  }
  return context;
}

/** `path` with the app context appended as a query string, so links keep it. */
export function withAppContext(path: string, context: AppContext): string {
  const query = new URLSearchParams(context as Record<string, string>).toString();
  return query ? `${path}?${query}` : path;
}
