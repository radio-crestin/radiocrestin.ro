// The share action (Web Share API, else the link copied with a notice) and the playbacks the
// player reports before the announcements code counts them (count_on: playbacks).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
};

/** A minimal document: the notice element share.ts appends to the body. */
const fakeDocument = () => {
  const body: { children: any[]; append: (el: any) => void } = {
    children: [],
    append: (el) => body.children.push(el),
  };
  return {
    body,
    createElement: () => ({ hidden: false, textContent: "", className: "", attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } }),
  };
};

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("localStorage", memoryStorage());
});
afterEach(() => vi.unstubAllGlobals());

describe("playbacks before the announcements code", () => {
  it("wait in storage, then are counted in order once it takes over, then directly", async () => {
    const { reportPlayback, countPlaybacksWith } = await import("./playbacks");
    reportPlayback("radio-x");
    reportPlayback("radio-y");
    expect(JSON.parse(localStorage.getItem("announcements-playbacks")!)).toEqual(["radio-x", "radio-y"]);
    const counted: string[] = [];
    countPlaybacksWith((s) => counted.push(s));
    expect(counted).toEqual(["radio-x", "radio-y"]);
    expect(localStorage.getItem("announcements-playbacks")).toBeNull();
    reportPlayback("radio-z");
    expect(counted).toEqual(["radio-x", "radio-y", "radio-z"]);
    expect(localStorage.getItem("announcements-playbacks")).toBeNull();
  });

  it("survive a page load (a page without announcements, e.g. a category)", async () => {
    (await import("./playbacks")).reportPlayback("radio-x");
    vi.resetModules();
    const counted: string[] = [];
    (await import("./playbacks")).countPlaybacksWith((s) => counted.push(s));
    expect(counted).toEqual(["radio-x"]);
  });

  it("ignore corrupt storage", async () => {
    localStorage.setItem("announcements-playbacks", "{oops");
    const { reportPlayback, countPlaybacksWith } = await import("./playbacks");
    reportPlayback("radio-x");
    const counted: string[] = [];
    countPlaybacksWith((s) => counted.push(s));
    expect(counted).toEqual(["radio-x"]);
  });
});

describe("share action", () => {
  it("uses the Web Share API with the text and a tagged link", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    const { shareLink } = await import("./share");
    await shareLink("https://www.radiocrestin.ro/app", "Ascultă");
    expect(share).toHaveBeenCalledWith({
      text: "Ascultă",
      url: "https://www.radiocrestin.ro/app?utm_source=native_share&utm_medium=share",
    });
  });

  it("closing the share sheet copies nothing", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(Object.assign(new Error("closed"), { name: "AbortError" })),
      clipboard: { writeText },
    });
    await (await import("./share")).shareLink(null, null);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("without it, copies the website's link and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const doc = fakeDocument();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal("document", doc);
    vi.stubGlobal("window", { setTimeout: () => 0 });
    await (await import("./share")).shareLink(null, null);
    expect(writeText).toHaveBeenCalledWith("https://www.radiocrestin.ro/?utm_source=copy_link&utm_medium=share");
    const [notice] = doc.body.children;
    expect([notice.textContent, notice.className, notice.attrs.role, notice.hidden]).toEqual([
      "Linkul a fost copiat", "ann-notice", "status", false,
    ]);
  });

  it("when copying fails too, shows the link to copy by hand", async () => {
    const doc = fakeDocument();
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    vi.stubGlobal("document", doc);
    vi.stubGlobal("window", { setTimeout: () => 0 });
    await (await import("./share")).shareLink("https://example.org/x", null);
    expect(doc.body.children[0].textContent).toBe("Copiază linkul: https://example.org/x");
  });
});
