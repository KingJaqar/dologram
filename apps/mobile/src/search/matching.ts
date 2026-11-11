export function normalizeSearch(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

export type HighlightRange = { start: number; end: number };

/** UTF-16 display ranges, including composition, compatibility and lowercase expansions. */
export function highlightRanges(text: string, query: string): HighlightRange[] {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  if (/^[\x00-\x7F]*$/.test(text)) {
    const lower = text.toLowerCase();
    const ranges: HighlightRange[] = [];
    for (let from = 0; from < lower.length;) {
      const found = lower.indexOf(needle, from);
      if (found < 0) break;
      const previous = ranges[ranges.length - 1];
      if (previous && found <= previous.end) previous.end = Math.max(previous.end, found + needle.length);
      else ranges.push({ start: found, end: found + needle.length });
      from = found + 1;
    }
    return ranges;
  }
  // Normalize prefixes to retain provenance when a later combining character composes or
  // reorders earlier code points. Lowercase the complete string for contextual Greek sigma.
  let prefix = '';
  let normalized = '';
  let offsets: HighlightRange[] = [];
  let sourceOffset = 0;
  for (const point of text) {
    prefix += point;
    const next = prefix.normalize('NFKC');
    let common = 0;
    while (common < normalized.length && common < next.length && normalized[common] === next[common]) common++;
    const start = offsets[common]?.start ?? sourceOffset;
    offsets = offsets.slice(0, common);
    for (let index = common; index < next.length; index++) offsets.push({ start, end: sourceOffset + point.length });
    sourceOffset += point.length;
    normalized = next;
  }
  const lower = normalized.toLowerCase();
  const lowerOffsets: HighlightRange[] = [];
  let index = 0;
  for (const point of normalized) {
    const span = { start: offsets[index].start, end: offsets[index + point.length - 1].end };
    for (let count = 0; count < point.toLowerCase().length; count++) lowerOffsets.push(span);
    index += point.length;
  }
  const ranges: HighlightRange[] = [];
  let from = 0;
  for (;;) {
    const found = lower.indexOf(needle, from);
    if (found < 0) break;
    const span = { start: lowerOffsets[found].start, end: lowerOffsets[found + needle.length - 1].end };
    const previous = ranges[ranges.length - 1];
    if (previous && span.start <= previous.end) previous.end = Math.max(previous.end, span.end);
    else ranges.push(span);
    from = found + 1;
  }
  return ranges;
}

export function searchPreview(content: string, query: string): string {
  const match = highlightRanges(content, query)[0];
  let start = Math.max(0, (match?.start ?? 0) - 36);
  let end = Math.min(content.length, Math.max(start + 160, match?.end ?? 0));
  // Never cut a surrogate pair or detach a combining mark from its base.
  while (start > 0 && /[\p{M}\uDC00-\uDFFF]/u.test(content[start])) start--;
  while (end < content.length && /[\p{M}\uDC00-\uDFFF]/u.test(content[end])) end++;
  return `${start > 0 ? '…' : ''}${content.slice(start, end)}${end < content.length ? '…' : ''}`;
}
