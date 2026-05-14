// Small clip-id factory — counter + Date.now() delivers stable monotonic ids
// without pulling in `uuid` (CLAUDE.md §11: no new deps). Format keeps clips
// human-debuggable when dumped to localStorage / dev tools.
//
// Why not crypto.randomUUID(): jsdom 26 supports it but the compact
// `cli-{epoch}-{seq}` format is readable in store logs and stable across
// hot reloads (counter resets to 0, but epoch ms changes). For drag dedupe
// we just need uniqueness within one session.

let counter = 0;

export function nextClipId(): string {
  counter += 1;
  return `cli-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function nextNoteId(): string {
  counter += 1;
  return `note-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function nextCiteId(): string {
  counter += 1;
  return `cite-${Date.now().toString(36)}-${counter.toString(36)}`;
}

// Test-only — reset counter so unit tests can assert deterministic ids.
export function __resetClipIdCounter(): void {
  counter = 0;
}
