// Shared text matching for spending alerts and category rules.

// Case- and accent-insensitive, so "cafe" matches "Café"
export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Comma-separated terms; a leading "-" excludes. "uber, -rappi" matches
 * text containing "uber" and not "rappi". Only exclusions → everything else.
 */
export function parsePattern(pattern: string | null) {
  const terms = (pattern ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const clean = (t: string) => normalize(t.replace(/^-/, ""));
  return {
    include: terms.filter((t) => !t.startsWith("-")).map(clean).filter(Boolean),
    exclude: terms.filter((t) => t.startsWith("-")).map(clean).filter(Boolean),
  };
}

/** Matches against description and merchant together. */
export function textMatches(
  pattern: string | null,
  description: string,
  merchant: string | null
) {
  const { include, exclude } = parsePattern(pattern);
  const text = `${normalize(description)} ${normalize(merchant ?? "")}`;
  if (exclude.some((t) => text.includes(t))) return false;
  return include.length === 0 || include.some((t) => text.includes(t));
}

export function describePattern(pattern: string | null) {
  const { include, exclude } = parsePattern(pattern);
  return [
    include.length ? `con "${include.join('" o "')}"` : "",
    exclude.length ? `sin "${exclude.join('" ni "')}"` : "",
  ]
    .filter(Boolean)
    .join(" y ");
}
