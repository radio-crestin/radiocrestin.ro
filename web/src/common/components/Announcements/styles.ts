// Class names for the announcement components. The styles are global, in
// public/styles/_announcements.scss, and every class there starts with "ann-".
const styles: Record<string, string> = new Proxy(
  {},
  { get: (_, name) => (typeof name === "string" ? `ann-${name}` : undefined) },
);

export default styles;
