import { describe, it, expect } from "bun:test";
import { escapeLikePattern } from "../src/lib/sql-escape";

describe("escapeLikePattern", () => {
  it("returns plain strings unchanged", () => {
    expect(escapeLikePattern("coffee")).toBe("coffee");
    expect(escapeLikePattern("Coffee and pastry")).toBe("Coffee and pastry");
  });

  it("escapes the % wildcard", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("%discount%")).toBe("\\%discount\\%");
  });

  it("escapes the _ wildcard", () => {
    expect(escapeLikePattern("_private")).toBe("\\_private");
    expect(escapeLikePattern("hello_world")).toBe("hello\\_world");
  });

  it("escapes the backslash escape character", () => {
    expect(escapeLikePattern("C:\\Users")).toBe("C:\\\\Users");
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("escapes a mix of wildcards", () => {
    expect(escapeLikePattern("_%\\")).toBe("\\_\\%\\\\");
    expect(escapeLikePattern("50% off_sale\\")).toBe("50\\% off\\_sale\\\\");
  });

  it("handles empty string", () => {
    expect(escapeLikePattern("")).toBe("");
  });
});
