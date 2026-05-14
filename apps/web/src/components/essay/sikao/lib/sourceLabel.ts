// sourceLabel — derive "M2·段三" style label from a material's body and the
// [start, end) byte range of the clipped phrase.
//
// Approach: split body on \n into paragraphs (single \n separators per the
// existing mock paper format), then find the paragraph containing `start`.
// Fail-fast: out-of-range start triggers an error (callers should never pass
// a stale slice).

// CN_NUMS[i] = Chinese numeral for (i+1). i=0 → 一, i=9 → 十.
const CN_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function paragraphLabel(idx: number): string {
  // idx is 0-based paragraph index. 段一/段二/段三 ... up to 段十;
  // 段十一+ falls back to "段{N+1}" arabic.
  if (idx < 0) return '段一';
  if (idx < CN_NUMS.length) return `段${CN_NUMS[idx]}`;
  return `段${idx + 1}`;
}

export function buildSourceLabel(
  matIndex: number,
  body: string,
  start: number,
): string {
  if (start < 0 || start > body.length) {
    throw new Error(
      `buildSourceLabel: start ${start} out of range [0, ${body.length}]`,
    );
  }
  // Count \n before `start` to derive paragraph index. The empty/blank
  // separator paragraphs in the mock fixtures are still counted (matches
  // human reading: "第一段空" still bumps to 段二).
  let paraIdx = 0;
  for (let i = 0; i < start; i += 1) {
    if (body[i] === '\n') paraIdx += 1;
  }
  return `M${matIndex + 1}·${paragraphLabel(paraIdx)}`;
}
