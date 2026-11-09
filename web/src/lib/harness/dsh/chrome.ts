// dsh-tui display-only chrome trim.
//
// dsh-tui deliberately has NO registry adapter: registering one would move the reply path off the
// one-shot sends every non-grammar pane uses (see harness/index.ts). But its own composer frame and
// the usage block under it are pure chrome on Collie: the phone types into Collie's composer (Type
// mode keeps the draft in Collie's own field too), and a 184-column frame WRAPS into a pile of
// broken border fragments on a narrow mirror.
//
// So this trims the tail, display-only: the LAST framed box on the screen, plus the status rows
// under it, come off the raw block — and only when the shape is confident:
//
//   · a horizontal border row, with only status-looking rows under it down to the tail;
//   · another border row above it, at most 15 rows up, closing the box;
//   · at least one status row carries a usage hint (k/M ratio, `ctx %`, `tps`, `cache %`).
//
// Anything unsure returns the input UNCHANGED (same reference), so a dialog that covers the
// composer, a picker, or any other screen keeps every row. The dialog itself, when it sits ABOVE
// the composer, is never touched: the cut starts at the composer's own top border.

import { lineText, type StyledLine } from "../../blocks";

/** A frame edge: corners stripped, the rest long dashes (with at most the odd space). */
function isBorder(text: string): boolean {
  const core = text.trim().replace(/[╭╮╰╯┌┐└┘┍┎┏┑┕┖┗┛├┤]/g, "");
  return core.length >= 15 && /^[─━═ ]+$/.test(core) && /[─━═]{10,}/.test(core);
}

/** One row of the box body: a vertical edge, or blank. The composer's interior is never read for
 *  content — a draft there is mirrored in Collie's own field, so it goes with the frame. */
function isBoxRow(text: string): boolean {
  const t = text.trim();
  return t === "" || /^[│┃╎]/.test(t);
}

// The usage block under the composer carries these; the middle dot alone is not enough, one hint
// must match or the tail is not claimed as dsh-tui's status.
const STATUS_HINTS: readonly RegExp[] = [
  /\d+(\.\d+)?[km]\/\d+(\.\d+)?\.\d[mk]/i,
  /\bctx \d+(\.\d+)?%/i,
  /\b\d+(\.\d+)?\s*tps\b/i,
  /\bcache \d+(\.\d+)?%/i,
];

function isStatusRow(text: string): boolean {
  const t = text.trim();
  if (t === "") return true;
  if (/^[│┃╎]/.test(t)) return false;
  if (t.length > 140) return false;
  return STATUS_HINTS.some((p) => p.test(t)) || /[·・]/.test(t);
}

/** `lines` with dsh-tui's composer frame and usage block trimmed off the tail, or the same
 *  reference when the tail does not confidently match. */
export function trimDshComposerChrome(lines: StyledLine[]): StyledLine[] {
  const texts = lines.map(lineText);

  // The tail: trailing blank rows are inside the trim anyway, so start from the last real row.
  let end = lines.length;
  while (end > 0 && texts[end - 1]!.trim() === "") end--;

  // 1. The bottom border: the last border row that has only status-looking rows under it, at
  //    least one real status row, and at least one usage hint among them.
  for (let b = end - 1; b >= 0 && end - b <= 8; b--) {
    if (!isBorder(texts[b]!)) continue;
    const below = texts.slice(b + 1, end);
    const real = below.filter((t) => t.trim() !== "");
    if (real.length === 0 || real.length > 6) continue;
    if (!below.every(isStatusRow)) continue;
    if (!real.some((t) => STATUS_HINTS.some((p) => p.test(t)))) continue;

    // 2. The top border: the nearest border row above it, closing a box of at most 15 rows whose
    //    body is vertical edges and blanks.
    for (let top = b - 1; top >= 0 && b - top <= 16; top--) {
      if (!isBorder(texts[top]!)) continue;
      const body = texts.slice(top + 1, b);
      if (!body.every(isBoxRow)) continue;

      // 3. Cut above the frame, then let a blank run directly above it go too — the gap the TUI
      //    leaves between the transcript and its composer is chrome as well.
      let cut = top;
      while (cut > 0 && texts[cut - 1]!.trim() === "") cut--;
      return lines.slice(0, cut);
    }
  }

  return lines;
}
