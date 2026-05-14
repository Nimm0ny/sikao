// Char counting helpers — source of truth for "字数" across the exam UI.

const PUNCT_OR_WHITESPACE = /[\s\p{P}]/u;

// Body chars — visible characters excluding whitespace AND punctuation.
// Mirrors the prototype's stricter rule (v2-ink.jsx:1093) instead of the
// looser README §7 (\s only). The exam grades visible content, so punctuation
// shouldn't pad word counts.
export function bodyChars(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (!PUNCT_OR_WHITESPACE.test(ch)) count += 1;
  }
  return count;
}

// All chars sans line breaks — used for the "含标点 N" sub-label.
export function allChars(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (ch !== '\n') count += 1;
  }
  return count;
}

// Scratch char count — exclude all whitespace, keep punctuation.
export function scratchChars(text: string): number {
  return text.replace(/\s+/g, '').length;
}
