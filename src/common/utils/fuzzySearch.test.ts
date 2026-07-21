import { describe, it, expect } from "vitest";
import { createSearchMatcher, normalizeSearchText } from "@/utils/fuzzySearch";

// Real station titles the matcher has to serve (from fallback-stations.json).
const TITLES = [
  "Aripi Spre Cer",
  "Radio Filadelfia",
  "Radio Flacăra Rusaliilor",
  "Radio Vocea Creștinilor",
  "Radio Vocea Sperantei",
  "Radio Micul Samaritean",
  "RVE Bucuresti",
  "RVE Cluj",
  "Radio ALT FM Arad",
  "Radio 9 FM - Moldova Noua",
  "Radio Elim Air",
  "Radio Joy",
];

const matching = (query: string) =>
  TITLES.filter((t) => createSearchMatcher(query)(t));

describe("normalizeSearchText", () => {
  it("lowercases and strips Romanian diacritics (both comma and cedilla forms)", () => {
    expect(normalizeSearchText("Flacăra")).toBe("flacara");
    expect(normalizeSearchText("Creștinilor")).toBe("crestinilor"); // ș U+0219
    expect(normalizeSearchText("Creştinilor")).toBe("crestinilor"); // ş U+015F
    expect(normalizeSearchText("Speranța")).toBe("speranta");
    expect(normalizeSearchText("ÎNĂLȚARE")).toBe("inaltare");
  });
});

describe("createSearchMatcher", () => {
  it("empty query matches everything (clearing the box shows all stations)", () => {
    expect(matching("")).toEqual(TITLES);
    expect(matching("   ")).toEqual(TITLES);
  });

  it("null/undefined targets never match (stations without a current song)", () => {
    const matches = createSearchMatcher("radio");
    expect(matches(null)).toBe(false);
    expect(matches(undefined)).toBe(false);
  });

  it("plain substring still works, case-insensitively", () => {
    expect(matching("filadelfia")).toEqual(["Radio Filadelfia"]);
    expect(matching("RVE")).toEqual(["RVE Bucuresti", "RVE Cluj"]);
  });

  it("finds diacritic titles from a bare-ASCII query", () => {
    expect(matching("flacara")).toEqual(["Radio Flacăra Rusaliilor"]);
    expect(matching("crestinilor")).toEqual(["Radio Vocea Creștinilor"]);
  });

  it("finds ASCII titles from a diacritic query", () => {
    expect(matching("speranța")).toEqual(["Radio Vocea Sperantei"]);
  });

  it("forgives one typo in medium words", () => {
    expect(matching("cluh")).toContain("RVE Cluj"); // substitution
    expect(matching("firadelfia")).toContain("Radio Filadelfia"); // substitution
    expect(matching("samaritan")).toContain("Radio Micul Samaritean"); // dropped letter
  });

  it("counts an adjacent transposition as a single typo", () => {
    expect(matching("fialdelfia")).toContain("Radio Filadelfia");
    expect(matching("flacraa")).toContain("Radio Flacăra Rusaliilor");
  });

  it("forgives two typos only in long words", () => {
    expect(matching("bukurset")).toContain("RVE Bucuresti"); // 8 chars: k→c + ts swap
    expect(matching("cluhh")).not.toContain("RVE Cluj"); // 5 chars, 2 edits — too far
  });

  it("matches unfinished words as prefixes, typos included", () => {
    expect(matching("bucur")).toEqual(["RVE Bucuresti"]);
    expect(matching("sperant")).toEqual(["Radio Vocea Sperantei"]);
    expect(matching("samarit")).toEqual(["Radio Micul Samaritean"]);
  });

  it("keeps short words strict — no typos, prefix only", () => {
    expect(matching("cer")).toEqual(["Aripi Spre Cer"]);
    expect(matching("cei")).toEqual([]); // must NOT fuzzy onto "cer"
    expect(matching("joy")).toEqual(["Radio Joy"]);
  });

  it("requires every word of a multi-word query to match", () => {
    expect(matching("vocea sperantei")).toEqual(["Radio Vocea Sperantei"]);
    expect(matching("vocea inexistent")).toEqual([]);
  });

  it("matches multi-word queries regardless of word order", () => {
    expect(matching("cluj rve")).toEqual(["RVE Cluj"]);
  });

  it("survives punctuation and digits in titles", () => {
    expect(matching("moldova noua")).toEqual(["Radio 9 FM - Moldova Noua"]);
    expect(matching("alt fm")).toEqual(["Radio ALT FM Arad"]);
  });

  it("punctuation-only queries match nothing instead of everything", () => {
    expect(matching("...")).toEqual([]);
  });
});
