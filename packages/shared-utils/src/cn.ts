// Minimal classnames joiner. Deliberately avoids pulling `clsx` as a new
// dependency (harness §: prefer existing tooling). Falsy values are dropped
// so conditional classes can be expressed as `cond && 'x'` without littering
// call sites with ternaries.

export type ClassValue = string | number | null | undefined | false | readonly ClassValue[];

export function cn(...inputs: readonly ClassValue[]): string {
  const parts: string[] = [];
  for (const input of inputs) {
    if (!input && input !== 0) continue;
    if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) parts.push(nested);
      continue;
    }
    parts.push(String(input));
  }
  return parts.join(' ');
}
