/** Very simple fuzzy match: returns a score > 0 if all chars of query appear in order in target. */
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 1;
  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += qi > 0 && t[ti - 1] === q[qi - 1] ? 2 : 1;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

/** Best fuzzy score across multiple searchable fields. */
export function fuzzyScoreFields(
  query: string,
  fields: (string | undefined)[]
): number {
  return Math.max(0, ...fields.map((f) => fuzzyScore(query, f ?? "")));
}
