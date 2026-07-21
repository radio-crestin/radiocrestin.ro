// Typo-tolerant, diacritic-insensitive matching for the station search box.
// "flacara" finds „Radio Flacăra Rusaliilor", "fildelfia" finds „Radio
// Filadelfia" — missing diacritics and small typos still land on the station.

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function splitWords(normText: string): string[] {
  return normText.split(/[^a-z0-9]+/).filter(Boolean);
}

// Typos allowed per query word, scaled to its length (short words are too
// ambiguous to forgive: "cer" must not match "cei").
function maxEditsFor(len: number): number {
  if (len <= 3) return 0;
  if (len <= 7) return 1;
  return 2;
}

// Edit distance (with adjacent-transposition counting as one edit) from
// `token` to the closest *prefix* of `word` — suited to search-as-you-type,
// where "sperant" is an unfinished "sperantei". Returns early with a value
// above `maxDist` once no prefix can match within the budget.
function prefixEditDistance(token: string, word: string, maxDist: number): number {
  if (word.startsWith(token)) return 0;
  const tLen = token.length;
  const wLen = word.length;

  // Rolling rows of the distance table: d[i][j] = edits between token[0..i)
  // and word[0..j); the answer is the minimum of the final row.
  let twoAgo: number[] = [];
  let prev: number[] = [];
  let cur: number[] = [];
  for (let j = 0; j <= wLen; j++) prev.push(j);

  for (let i = 1; i <= tLen; i++) {
    cur = [i];
    let rowMin = i;
    for (let j = 1; j <= wLen; j++) {
      const cost = token[i - 1] === word[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        token[i - 1] === word[j - 2] &&
        token[i - 2] === word[j - 1]
      ) {
        v = Math.min(v, twoAgo[j - 2] + 1);
      }
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDist) return rowMin;
    twoAgo = prev;
    prev = cur;
  }

  return Math.min(...prev);
}

// Builds a predicate for one query, reusable across every station field.
// Matches when the whole query is a substring of the target, or when every
// query word fuzzy-matches (prefix + allowed typos) some word of the target.
export function createSearchMatcher(query: string): (target: string | null | undefined) => boolean {
  const normQuery = normalizeSearchText(query).trim();
  const queryTokens = splitWords(normQuery);

  return (target) => {
    if (!normQuery) return true;
    if (!target) return false;
    const normTarget = normalizeSearchText(target);
    if (normTarget.includes(normQuery)) return true;
    if (queryTokens.length === 0) return false;
    const words = splitWords(normTarget);
    return queryTokens.every((qt) => {
      const allowed = maxEditsFor(qt.length);
      if (allowed === 0) return words.some((w) => w.startsWith(qt));
      return words.some((w) => prefixEditDistance(qt, w, allowed) <= allowed);
    });
  };
}
