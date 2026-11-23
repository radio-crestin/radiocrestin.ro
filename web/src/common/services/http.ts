// Shared fetch helpers for the radiocrestin.ro API: base URL, timeouts and
// the transient-error rules that keep expected failures out of PostHog.

export const API_BASE = "https://api.radiocrestin.ro/api/v1";

// AbortSignal.timeout polyfill for older browsers (Safari < 16, older WebViews)
export const timeoutSignal = (ms: number): AbortSignal => {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
  }, ms);
  return controller.signal;
};

// Transient network errors (iOS background suspension, intermittent connectivity)
// are expected during long listening sessions — don't report them to PostHog.
export const isTransientNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return msg === "Load failed"              // Safari/iOS fetch failure
    || msg === "Failed to fetch"            // Chrome offline/network error
    || msg === "NetworkError when attempting to fetch resource." // Firefox
    || error.name === "AbortError"          // Request aborted
    || error.name === "TimeoutError";       // AbortSignal.timeout
};

// Upstream infrastructure hiccups (nginx 502/503/504 during deploys or restarts,
// 429 rate limiting, 408 request timeout) are transient and out of the client's
// control. Like network errors, they should degrade gracefully to fallback data
// instead of flooding PostHog with thousands of "HTTP 503" exceptions.
export const isTransientHttpStatus = (status: number): boolean =>
  status === 408 || status === 425 || status === 429 || status >= 500;

// Thrown for transient upstream conditions (5xx, rate limits, or a 200 response
// whose body isn't valid JSON — e.g. a captive portal / proxy HTML page). These
// are swallowed into fallback values and never reported as exceptions.
export class TransientUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientUpstreamError";
  }
}

export const isTransient = (error: unknown): boolean =>
  error instanceof TransientUpstreamError || isTransientNetworkError(error);

// Parse a successful (2xx) response body as JSON. A 200 with a non-JSON body
// (HTML from a proxy/captive portal, or an empty body) used to throw a
// SyntaxError that was reported to PostHog; treat it as transient instead.
export const parseJsonOrThrowTransient = async (response: Response): Promise<any> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new TransientUpstreamError("Upstream returned a non-JSON response body");
  }
};
