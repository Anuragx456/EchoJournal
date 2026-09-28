const MAX_TOKENS = 10;

/** Lowercase search tokens for highlighting (mirrors entriesRepo sanitizing). */
export function tokenizeForHighlight(query: string): string[] {
  return query
    .replace(/["*^:()]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
    .slice(0, MAX_TOKENS);
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extract a ~maxLen window around the first token hit for result previews.
 * Returns the snippet plus flags for leading/trailing ellipsis.
 */
export function snippetForTokens(
  text: string,
  tokens: string[],
  maxLen = 140
): { snippet: string; leading: boolean; trailing: boolean } {
  const clean = collapseWhitespace(text);
  if (clean.length === 0 || tokens.length === 0) {
    return { snippet: '', leading: false, trailing: false };
  }
  const lower = clean.toLowerCase();
  let hit = -1;
  for (const token of tokens) {
    const at = lower.indexOf(token);
    if (at !== -1 && (hit === -1 || at < hit)) {
      hit = at;
    }
  }
  if (hit === -1) {
    const head = clean.slice(0, maxLen);
    return { snippet: head, leading: false, trailing: clean.length > maxLen };
  }
  const half = Math.floor(maxLen / 2);
  const start = Math.max(0, hit - half);
  const end = Math.min(clean.length, start + maxLen);
  const adjustedStart = Math.max(0, end - maxLen);
  return {
    snippet: clean.slice(adjustedStart, end),
    leading: adjustedStart > 0,
    trailing: end < clean.length,
  };
}
