import { describe, it, expect } from "vitest";
import { extractWikilinks, wikilinkToSlug } from "./wikilink-plugin";

describe("extractWikilinks", () => {
  it("extracts wikilinks from markdown text", () => {
    const text =
      "See [[projects/karen]] and [[companies/maison]] for details.";
    expect(extractWikilinks(text)).toEqual([
      "projects/karen",
      "companies/maison",
    ]);
  });

  it("returns empty array for no links", () => {
    expect(extractWikilinks("No links here.")).toEqual([]);
  });

  it("handles links with display text", () => {
    const text = "Check [[projects/karen|Karen App]] out.";
    expect(extractWikilinks(text)).toEqual(["projects/karen"]);
  });
});

describe("wikilinkToSlug", () => {
  it("converts wikilink to .md path", () => {
    expect(wikilinkToSlug("projects/karen")).toBe("projects/karen.md");
  });

  it("does not double-add .md", () => {
    expect(wikilinkToSlug("projects/karen.md")).toBe("projects/karen.md");
  });
});
