import { describe, expect, it } from "vitest";
import { isEmail, isHttpUrl, validate } from "./schema";

const codes = (errors: ReturnType<typeof validate>) =>
  Object.fromEntries(Object.entries(errors).map(([name, error]) => [name, error.code]));

describe("validate general", () => {
  it("needs a message and an email; the name is optional", () => {
    expect(codes(validate("general", {}))).toEqual({ message: "required", email: "required" });
  });

  it("accepts a complete message", () => {
    expect(validate("general", { message: "Bună ziua, am o întrebare.", email: "a@b.ro" })).toEqual({});
  });

  it("asks for a longer message and a valid email", () => {
    const errors = validate("general", { message: "Salut", email: "not-an-email" });
    expect(errors.message).toEqual({ code: "too_short", params: { min: 10 } });
    expect(errors.email.code).toBe("invalid_email");
  });

  it("rejects more pictures than allowed", () => {
    const errors = validate("general", { message: "x".repeat(20), email: "a@b.ro" }, { images: 4 });
    expect(errors.images).toEqual({ code: "too_many_files", params: { max: 3 } });
  });
});

describe("validate station", () => {
  const station = {
    station_name: "Radio Test",
    website: "https://radiotest.ro",
    denomination: "baptist",
    name: "Ion",
    email: "ion@exemplu.ro",
  };

  it("accepts a suggestion with a website", () => {
    expect(validate("station", station)).toEqual({});
  });

  it("needs the website or the listen link", () => {
    expect(codes(validate("station", { ...station, website: "" }))).toEqual({
      listen_url: "need_website_or_listen_url",
    });
  });

  it("asks which denomination when it is 'other'", () => {
    expect(codes(validate("station", { ...station, denomination: "other" }))).toEqual({
      denomination_other: "required",
    });
  });

  it("rejects an unknown denomination and a non-http link", () => {
    const errors = codes(validate("station", { ...station, denomination: "x", facebook_url: "javascript:alert(1)" }));
    expect(errors).toEqual({ denomination: "invalid_choice", facebook_url: "invalid_url" });
  });
});

describe("validate announcement", () => {
  const announcement = {
    about: "general",
    title: "Concert de Crăciun",
    summary: "Vă așteptăm la concert.",
    name: "Ana",
    email: "ana@exemplu.ro",
  };

  it("accepts a general announcement", () => {
    expect(validate("announcement", announcement)).toEqual({});
  });

  it("needs a station when it is about one", () => {
    expect(codes(validate("announcement", { ...announcement, about: "station" }))).toEqual({
      station_slug: "required",
    });
  });

  it("needs the end date after the start date", () => {
    const errors = validate("announcement", { ...announcement, starts_on: "2026-12-20", ends_on: "2026-12-10" });
    expect(codes(errors)).toEqual({ ends_on: "end_before_start" });
  });

  it("limits the title length", () => {
    const errors = validate("announcement", { ...announcement, title: "x".repeat(81) });
    expect(errors.title).toEqual({ code: "too_long", params: { max: 80 } });
  });
});

describe("validate report", () => {
  const report = { station_slug: "rve-timisoara", problem: "not_playing", email: "a@b.ro" };

  it("needs only the station, the problem and an email", () => {
    expect(validate("report", report)).toEqual({});
    expect(codes(validate("report", {}))).toEqual({ station_slug: "required", problem: "required", email: "required" });
  });

  it("asks for details when the problem is something else", () => {
    expect(codes(validate("report", { ...report, problem: "other" }))).toEqual({ message: "required" });
    expect(validate("report", { ...report, problem: "other", message: "Se aude ecou." })).toEqual({});
  });

  it("rejects an unknown problem", () => {
    expect(codes(validate("report", { ...report, problem: "x" }))).toEqual({ problem: "invalid_choice" });
  });
});

describe("validate feedback", () => {
  const feedback = { suggestion_type: "feature", message: "Aș vrea o alarmă cu postul preferat.", email: "a@b.ro" };

  it("accepts an idea without an area", () => {
    expect(validate("feedback", feedback)).toEqual({});
  });

  it("needs the type and a message of at least 10 characters", () => {
    expect(codes(validate("feedback", { email: "a@b.ro", message: "scurt" }))).toEqual({
      suggestion_type: "required",
      message: "too_short",
    });
  });

  it("rejects an unknown area", () => {
    expect(codes(validate("feedback", { ...feedback, area: "radio" }))).toEqual({ area: "invalid_choice" });
  });
});

describe("format checks", () => {
  it("knows an email", () => {
    expect(isEmail("nume@exemplu.ro")).toBe(true);
    expect(isEmail("nume@exemplu")).toBe(false);
    expect(isEmail("nu me@exemplu.ro")).toBe(false);
  });

  it("accepts only http(s) links with a domain", () => {
    expect(isHttpUrl("https://radio.ro/live")).toBe(true);
    expect(isHttpUrl("http://stream.radio.ro:8000/live.mp3")).toBe(true);
    expect(isHttpUrl("ftp://radio.ro")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("radio.ro")).toBe(false);
  });
});
