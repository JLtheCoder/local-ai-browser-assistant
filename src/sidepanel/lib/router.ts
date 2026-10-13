import { getDefaultProvider } from '../../ai/provider';

const SEARCH_SIGNALS = [
  /\b(latest|today|current|now|recent|this week|this month|this year)\b/i,
  /\b(news|headline|breaking|announced|released|launched)\b/i,
  /\b(price|cost|stock|market|weather|score|result)\b/i,
  /\b(version|release|update|patch)\s+\d+/i,
  /\b(who is|what is the|when did|where is)\b/i,
];

/** Quick heuristic: if any signal matches, a search is *likely* needed.
 *  This only gates whether we invoke the model router (to save the extra call);
 *  the model is the final authority. */
export function heuristicSuggestsSearch(prompt: string): boolean {
  return SEARCH_SIGNALS.some((re) => re.test(prompt));
}

/** Ask the on-device model whether this prompt needs a web search.
 *  Contract: the model must reply with exactly one line:
 *    "NO"  — answerable from page or general knowledge
 *    "SEARCH: <query>" — needs web search
 *  Returns the query string or null. */
export async function routeSearch(
  prompt: string,
  pageText: string | null,
  signal: AbortSignal,
): Promise<string | null> {
  const provider = getDefaultProvider();
  const fullPrompt = [
    'Reply with exactly one line.',
    "If the user's question can be answered from the page context or general knowledge, say: NO",
    'Otherwise say: SEARCH: <concise web query>',
    '',
    pageText ? `Page context (truncated):\n${pageText.slice(0, 3000)}\n` : '',
    `User prompt: ${prompt}`,
  ].join('\n');

  try {
    const response = await provider.prompt({
      prompt: fullPrompt,
      signal,
    });
    // Lenient parse: the model may wrap the line in markdown emphasis or
    // backticks despite the "exactly one line" instruction.
    const line =
      response
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0) ?? '';
    const m = line.replace(/^[`*_]+|[`*_]+$/g, '').match(/^SEARCH:\s*(.+)$/i);
    if (!m) return null;
    return m[1]
      .trim()
      .replace(/^["'`«»]+|["'`«»]+$/g, '')
      .slice(0, 200);
  } catch {
    // On any error (including abort), fall back to NO.
    return null;
  }
}
