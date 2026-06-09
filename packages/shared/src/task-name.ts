const PREFIX_PATTERNS = [
  /^(?:i\s+(?:want\s+(?:you\s+)?to|need\s+(?:you\s+)?to|would\s+like\s+(?:you\s+)?to)\s+)/i,
  /^(?:i['’]d\s+like\s+(?:you\s+)?to\s+)/i,
  /^(?:can\s+(?:you|i)\s+|could\s+(?:you|i)\s+|would\s+you\s+(?:please\s+)?)/i,
  /^(?:please\s+)/i,
  /^(?:let['’]s\s+)/i,
];

const ACTION_PREFIX_RE = /^(create|build|make|write|implement|add|fix|update|set up|refactor|remove|delete)\s+/i;

const BRACKET_PREFIX = /^\[.*?\]\s*/;

function clean(input: string): string {
  let s = input.trim();

  // Remove bracketed tags like [FEATURE], [BUG], etc.
  s = s.replace(BRACKET_PREFIX, "");

  // Remove conversational prefixes
  for (const p of PREFIX_PATTERNS) {
    const m = s.match(p);
    if (m) {
      s = s.slice(m[0].length);
      break;
    }
  }

  return s;
}

function extractPhrase(s: string): string {
  // Take up to first sentence-ending punctuation, or first newline
  const end = s.search(/[.;!?\n]|(?:\s+(?:so\s+that|such\s+that|with\s+the\s+goal|in\s+order\s+to))/i);
  if (end >= 0) {
    s = s.slice(0, end);
  }

  // Trim trailing whitespace/punctuation
  s = s.replace(/[.,;!?\s]+$/, "");

  return s;
}

function normalizeVerb(s: string): string {
  const m = s.match(ACTION_PREFIX_RE);
  if (m) {
    const verb = m[1];
    // Only strip indefinite articles "a"/"an" for conciseness;
    // keep "the" and "new"
    const rest = s.slice(m[0].length).replace(/^(?:a|an)\s+/i, "");
    s = verb + " " + rest;
  }
  return s;
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  // Try to break at a word boundary
  const truncated = s.slice(0, maxLen - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.7) {
    return truncated.slice(0, lastSpace) + "…";
  }
  return truncated + "…";
}

export function generateTaskName(goal: string): string {
  if (!goal) return "Untitled task";

  let s = clean(goal);
  s = extractPhrase(s);
  s = normalizeVerb(s);

  if (!s) return "Untitled task";

  // Capitalize first letter
  s = s.charAt(0).toUpperCase() + s.slice(1);

  s = truncate(s, 55);

  return s;
}
