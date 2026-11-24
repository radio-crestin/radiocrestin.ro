// Web Audio side of the station gain (see streamGain.ts): a positive gain on a
// direct stream boosts it through element → GainNode → limiter → speakers.
//
// Routing is one-way: once createMediaElementSource() takes an <audio>
// element, all its sound goes through the AudioContext for good, and a later
// cross-origin source without CORS would play as silence. So the player only
// routes an element for a boosted stream (loaded with crossOrigin=anonymous)
// and mounts a fresh <audio> element for anything else (RadioPlayer's
// audioKey), dropping the routed one with releaseElement().

import { corsKey, webAudioBoostSupported } from "@/utils/streamGain";

interface BoostGraph {
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  limiter: DynamicsCompressorNode;
}

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;
let supported: boolean | null = null;
// The context didn't start after a boosted load (no usable gesture): later
// loads boost only once it runs.
let contextFailed = false;
const graphs = new WeakMap<HTMLMediaElement, BoostGraph>();
// Stream URLs (without their query) that failed to load in CORS mode this
// session: they play un-routed, with the gain clamped at full volume.
const noCorsUrls = new Set<string>();

const getCtor = (): AudioContextCtor | null => {
  if (typeof window === "undefined") return null;
  return (window.AudioContext || (window as any).webkitAudioContext) ?? null;
};

export function boostSupported(): boolean {
  if (supported === null) {
    supported =
      typeof navigator !== "undefined" &&
      webAudioBoostSupported({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints,
        hasAudioContext: !!getCtor(),
      });
  }
  return supported;
}

function getContext(): AudioContext | null {
  if (context && context.state !== "closed") return context;
  const Ctor = getCtor();
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
}

/**
 * Gets the AudioContext ready for a boost, from the player's load (which runs
 * right after the visitor's click): creates it, asks it to resume, and says
 * whether routing now will be audible. A context that isn't running is only
 * trusted while the page has a live user gesture (resume() then succeeds);
 * otherwise (e.g. an autoplay start) the stream plays without a boost.
 */
export function prepareBoostContext(): boolean {
  if (!boostSupported()) return false;
  const ctx = getContext();
  if (!ctx) return false;
  if (ctx.state === "running") return true;
  ctx.resume().catch(() => {});
  if (contextFailed) return false;
  const activation = (navigator as any).userActivation as { isActive?: boolean } | undefined;
  return !!activation?.isActive;
}

/** Resolves true once the context runs, false after `timeoutMs`. */
export function whenContextRunning(timeoutMs: number): Promise<boolean> {
  const ctx = context;
  if (!ctx) return Promise.resolve(false);
  if (ctx.state === "running") return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      ctx.removeEventListener("statechange", onChange);
      resolve(ok);
    };
    const onChange = () => {
      if (ctx.state === "running") done(true);
    };
    const timer = setTimeout(() => done(ctx.state === "running"), timeoutMs);
    ctx.addEventListener("statechange", onChange);
  });
}

/**
 * Resumes a suspended context on the visitor's next gesture (Safari may
 * suspend it, e.g. after an audio interruption). Returns the uninstaller.
 */
export function installContextUnlock(): () => void {
  if (typeof document === "undefined") return () => {};
  const unlock = () => {
    if (context && context.state === "suspended") context.resume().catch(() => {});
  };
  const events = ["pointerdown", "keydown", "touchend"] as const;
  events.forEach((e) => document.addEventListener(e, unlock, { capture: true, passive: true }));
  return () => events.forEach((e) => document.removeEventListener(e, unlock, { capture: true }));
}

export const isRouted = (el: HTMLMediaElement) => graphs.has(el);

/** Routes the element through gain → limiter. Idempotent. */
export function routeElement(el: HTMLMediaElement): boolean {
  if (graphs.has(el)) return true;
  const ctx = getContext();
  if (!ctx) return false;
  try {
    const source = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    // Brick-wall-ish limiter: catches the peaks the boost pushes over 0 dBFS.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    source.connect(gain);
    gain.connect(limiter);
    limiter.connect(ctx.destination);
    graphs.set(el, { source, gain, limiter });
    return true;
  } catch {
    return false;
  }
}

export function setBoost(el: HTMLMediaElement, linear: number) {
  const graph = graphs.get(el);
  if (graph) graph.gain.gain.value = linear;
}

/** Disconnects a routed element that the player no longer uses. */
export function releaseElement(el: HTMLMediaElement) {
  const graph = graphs.get(el);
  if (!graph) return;
  graphs.delete(el);
  try {
    graph.source.disconnect();
    graph.gain.disconnect();
    graph.limiter.disconnect();
  } catch {
    // already disconnected
  }
}

export const markContextFailed = () => {
  contextFailed = true;
};

export const markNoCors = (url: string) => noCorsUrls.add(corsKey(url));
export const knownNoCors = (url: string) => noCorsUrls.has(corsKey(url));
