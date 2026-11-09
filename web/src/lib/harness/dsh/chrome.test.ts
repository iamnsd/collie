import { describe, expect, test } from "vitest";
import type { StyledLine } from "../../blocks";
import { trimDshComposerChrome } from "./chrome";

// The idiom every harness logic test uses: a plain unstyled row.
const plain = (text: string): StyledLine => ({ segments: [{ text, style: {}, muted: false }] });
const screen = (rows: readonly string[]): StyledLine[] => rows.map(plain);
const texts = (lines: StyledLine[]): string[] => lines.map((l) => l.segments.map((s) => s.text).join(""));

const FRAME_TOP = "┌────────────────────────────────────────┐";
const FRAME_BOTTOM = "└────────────────────────────────────────┘";
const STATUS = [
  "473k/1.0M 47.3%",
  "  deepseek-v4.1-flash · ▄▄▄ 189 tps · cache 99.9%",
  "· learning_infra · #12c9d687",
  "ctx 47% (473k/1.0m)",
];

describe("trimDshComposerChrome", () => {
  test("an empty composer frame plus its usage block come off the tail", () => {
    const lines = screen([
      "some transcript text",
      "",
      FRAME_TOP,
      "│                                        │",
      "│ ⎘ ›                                    │",
      FRAME_BOTTOM,
      ...STATUS,
    ]);
    expect(texts(trimDshComposerChrome(lines))).toEqual(["some transcript text"]);
  });

  test("rounded corners are a frame too", () => {
    const lines = screen([
      "text",
      "╭────────────────────────────────────────╮",
      "│                                        │",
      "╰────────────────────────────────────────╯",
      ...STATUS,
    ]);
    expect(texts(trimDshComposerChrome(lines))).toEqual(["text"]);
  });

  test("a draft inside the box still goes with the frame — Collie's own field mirrors it", () => {
    const lines = screen([
      "text",
      FRAME_TOP,
      "│ fixing the deploy now                  │",
      "│ ⎘ ›                                    │",
      FRAME_BOTTOM,
      ...STATUS,
    ]);
    expect(texts(trimDshComposerChrome(lines))).toEqual(["text"]);
  });

  test("a dialog above the composer survives; only the composer is cut", () => {
    const lines = screen([
      "transcript",
      "┌────────── permission ──────────┐",
      "│ Run `rm -rf node_modules`?     │",
      "│  1. yes    2. no               │",
      "└────────────────────────────────┘",
      FRAME_TOP,
      "│                                        │",
      FRAME_BOTTOM,
      ...STATUS,
    ]);
    expect(texts(trimDshComposerChrome(lines))).toEqual([
      "transcript",
      "┌────────── permission ──────────┐",
      "│ Run `rm -rf node_modules`?     │",
      "│  1. yes    2. no               │",
      "└────────────────────────────────┘",
    ]);
  });

  test("no usage hint under the frame — nothing is claimed, the buffer is returned untouched", () => {
    const lines = screen([
      "text",
      FRAME_TOP,
      "│ body │",
      FRAME_BOTTOM,
      "· just a caption ·",
    ]);
    expect(trimDshComposerChrome(lines)).toBe(lines);
  });

  test("prose under the last border is not a status block — untouched", () => {
    const lines = screen([
      "text",
      FRAME_TOP,
      "│ body │",
      FRAME_BOTTOM,
      "a real answer line that goes on for a while and is not chrome at all",
    ]);
    expect(trimDshComposerChrome(lines)).toBe(lines);
  });

  test("a screen with no frame at all is returned untouched", () => {
    const lines = screen(["plain", "rows", "only"]);
    expect(trimDshComposerChrome(lines)).toBe(lines);
  });

  test("an empty screen is returned untouched", () => {
    expect(trimDshComposerChrome([])).toEqual([]);
  });

  test("a frame whose body breaks the vertical-edge shape is not claimed", () => {
    const lines = screen([
      "text",
      FRAME_TOP,
      "│ body │",
      "prose leaking between the borders",
      FRAME_BOTTOM,
      ...STATUS,
    ]);
    expect(trimDshComposerChrome(lines)).toBe(lines);
  });
});
