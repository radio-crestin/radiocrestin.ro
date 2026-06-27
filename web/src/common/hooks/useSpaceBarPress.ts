import { useEffect } from "react";

/**
 * Resolve a stable element to attach keyboard listeners to. In some embedded
 * webviews / early script execution `document.body` can be null — falling back
 * to <html> (documentElement) or the document itself means we never call
 * add/removeEventListener on null (the reported "Cannot read properties of null
 * (reading 'addEventListener')" crash). Returns null when there is no document
 * at all (SSR), in which case the hook becomes a no-op.
 */
export const resolveKeyboardTarget = (
  doc: Document | null | undefined,
): Document | HTMLElement | null => {
  if (!doc) return null;
  return doc.body ?? doc.documentElement ?? doc;
};

/** True when the event target is a form field or contentEditable element. */
export const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as (HTMLElement & { tagName?: string }) | null;
  const tag = el?.tagName?.toLowerCase?.();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return el?.getAttribute?.("contentEditable") === "true";
};

/** True for the space bar across legacy/modern keyboard APIs. */
export const isSpaceKey = (e: KeyboardEvent): boolean =>
  e.key === " " || e.code === "Space" || e.keyCode === 32;

const useSpaceBarPress = (callback: () => void) => {
  useEffect(() => {
    const target = resolveKeyboardTarget(
      typeof document !== "undefined" ? document : null,
    );
    if (!target) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSpaceKey(e) && !isEditableTarget(e.target)) {
        e.preventDefault();
      }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (isSpaceKey(e) && !isEditableTarget(e.target)) {
        callback();
      }
    };

    target.addEventListener("keyup", handleKeyPress as EventListener);
    target.addEventListener("keydown", handleKeyDown as EventListener);

    return () => {
      target.removeEventListener("keyup", handleKeyPress as EventListener);
      target.removeEventListener("keydown", handleKeyDown as EventListener);
    };
  }, [callback]);
};

export default useSpaceBarPress;
