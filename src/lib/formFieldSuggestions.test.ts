import { describe, it, expect } from "vitest";
import {
  ESSENTIAL_KEYS,
  fieldKeyFor,
  isAdded,
  questionProblem,
  SUGGESTIONS,
  SUGGESTION_GROUPS,
} from "@/lib/formFieldSuggestions";

describe("SUGGESTIONS", () => {
  it("has unique, API-valid keys and labels", () => {
    const keys = SUGGESTIONS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(SUGGESTIONS.map((s) => s.label.toLowerCase())).size).toBe(SUGGESTIONS.length);
    for (const key of keys) expect(key).toMatch(/^[a-zA-Z0-9_]+$/);
  });

  it("only uses types and rules every booking surface handles", () => {
    for (const s of SUGGESTIONS) {
      expect(["text", "email", "phone", "number", "date"]).toContain(s.field_type);
      expect(["none", "email_format", "phone_format", "name_format"]).toContain(s.validation_rule);
    }
  });

  it("pairs email and phone types with their validation", () => {
    for (const s of SUGGESTIONS) {
      if (s.field_type === "email") expect(s.validation_rule).toBe("email_format");
      if (s.field_type === "phone") expect(s.validation_rule).toBe("phone_format");
    }
  });

  it("puts every suggestion in a known group and keeps the essentials required", () => {
    for (const s of SUGGESTIONS) expect(SUGGESTION_GROUPS).toContain(s.group);
    for (const key of ESSENTIAL_KEYS) {
      const s = SUGGESTIONS.find((x) => x.key === key);
      expect(s?.is_required).toBe(true);
      expect(s?.group).toBe("Essentials");
    }
  });

  it("uses labels the organizer booking view can read name and phone from", () => {
    expect(SUGGESTIONS.find((s) => s.key === "full_name")?.label).toMatch(/name/i);
    expect(SUGGESTIONS.find((s) => s.key === "phone")?.label).toMatch(/phone/i);
  });
});

describe("isAdded", () => {
  const email = SUGGESTIONS.find((s) => s.key === "email")!;

  it("matches by key", () => {
    expect(isAdded(email, [{ field_key: "email", label: "Your mail" }])).toBe(true);
  });

  it("matches by label, ignoring case and spacing", () => {
    expect(isAdded(email, [{ field_key: "field_123", label: "  EMAIL address " }])).toBe(true);
  });

  it("is false when nothing matches", () => {
    expect(isAdded(email, [{ field_key: "age", label: "Age" }])).toBe(false);
    expect(isAdded(email, [])).toBe(false);
  });
});

describe("fieldKeyFor", () => {
  it("makes API-valid keys from labels", () => {
    expect(fieldKeyFor("Favourite colour?")).toBe("favourite_colour");
    expect(fieldKeyFor("  Ünïcode & symbols!! ")).toMatch(/^[a-zA-Z0-9_]+$/);
    expect(fieldKeyFor("???")).toBe("question");
  });

  it("keeps keys unique within the event", () => {
    expect(fieldKeyFor("City", ["city"])).toBe("city_2");
    expect(fieldKeyFor("City", ["city", "city_2"])).toBe("city_3");
  });

  it("caps the length", () => {
    expect(fieldKeyFor("a".repeat(200)).length).toBeLessThanOrEqual(40);
  });
});

describe("questionProblem", () => {
  it("requires a label", () => {
    expect(questionProblem({ label: "  ", validation_rule: "none" })).toMatch(/question/i);
    expect(questionProblem({ label: "Age", validation_rule: "none" })).toBeNull();
  });

  it("requires a compiling pattern for the custom rule", () => {
    expect(questionProblem({ label: "Code", validation_rule: "custom_regex", custom_regex: "" })).toMatch(/pattern/i);
    expect(questionProblem({ label: "Code", validation_rule: "custom_regex", custom_regex: "([" })).toMatch(/valid/i);
    expect(questionProblem({ label: "Code", validation_rule: "custom_regex", custom_regex: "^[0-9]+$" })).toBeNull();
  });
});
