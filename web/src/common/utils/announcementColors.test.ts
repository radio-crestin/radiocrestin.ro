import { describe, expect, it } from "vitest";
import type { IAnnouncement } from "@/models/Announcement";
import { colorVars, textOn } from "@/utils/announcementColors";

const announcement = (extra: Partial<IAnnouncement>) => ({ slug: "a", title: "T", ...extra }) as IAnnouncement;

describe("textOn", () => {
  it("picks white on dark colours and black on light ones", () => {
    expect(textOn("#0F6E63")).toBe("#FFFFFF");
    expect(textOn("#FFE600")).toBe("#111111");
    expect(textOn("not-a-colour")).toBe("#FFFFFF");
  });
});

describe("colorVars", () => {
  it("writes nothing when no colour is set, so the site theme applies", () => {
    expect(colorVars(announcement({ category: { slug: "c", name: "C" }, button: { label: "B" } as never }))).toEqual({});
  });

  it("spends the button colour on the button only, and tints the tag and icon with the category's", () => {
    expect(colorVars(announcement({ category: { slug: "c", name: "C", color: "#0F6E63" } }))).toEqual({
      "--tag-bg": "color-mix(in srgb, #0F6E63 var(--tag-tint), transparent)",
      "--tag-fg": "color-mix(in srgb, #0F6E63 var(--tag-ink), var(--tag-ink-base))",
      "--icon-bg": "color-mix(in srgb, #0F6E63 10%, var(--a-ctrl))",
    });
    expect(
      colorVars(announcement({ button: { label: "B", color: "#25D366", text_color: "#000000" } as never })),
    ).toEqual({ "--c": "#25D366", "--btn-fg": "#000000" });
  });

  it("ignores colours that are not plain hex", () => {
    expect(
      colorVars(
        announcement({
          category: { slug: "c", name: "C", color: "red; background:url(x)" },
          button: { label: "B", color: "#25D366)", text_color: "javascript:" } as never,
        }),
      ),
    ).toEqual({});
  });
});
