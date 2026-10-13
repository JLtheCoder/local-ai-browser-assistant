# Memory System — V2 Design

Status: DRAFT for review — **not yet implemented**. Implementation progress will be
tracked in [Implementation.md](./Implementation.md) once Phase 0 starts.
Scope: Local AI Browser Assistant (Chrome MV3 extension, on-device Gemini Nano)
Target: V2 of the app. Phases 1+2 in scope; Phase 3 sketched for direction only.

---

## 1. Goals & Non-Goals

### Goals

1. **Episodic memory (per-thread):** stop silently dropping conversation context
   older than the 20-message `HISTORY_WINDOW`. Long threads keep a rolling summary
   that is injected back into every turn.
2. **Semantic memory (cross-thread):** extract durable user facts
   ("prefers casual tone", "translates EN→JA", "backend developer") and reuse them
   across all threads and modes.
3. **Page memory (lightweight):** remember what the user did via the selection
   toolbar — page URL/title, mode used, one-line gist of the result — searchable
   and injectable as "recent page activity".
4. **User control & privacy:** memory is visible, editable, and deletable. Every
   layer has its own toggle. This is a hard requirement — privacy is the product.
5. **Background operation:** extraction and summarization run even when the side
   panel is closed, via an offscreen document driven by the service worker.

### Non-Goals (v1 of memory / V2 of app)

- Built-in embedding retrieval _today_ — Chrome ships no embeddings API yet;
  the proposed **Semantic Embedder API** (developer trial, not approved to
  ship) is designed in as the future-preferred backend (§7.6). Until then,
  retrieval runs on a pluggable `EmbeddingBackend` seam: bundled Transformers.js
  model when available (§7.7), BM25-style lexical retrieval always (§7).
- Automatic browsing history ingestion. Page memory records only pages the user
  explicitly acted on through the extension.
- Cross-device sync. Everything stays in `chrome.storage.local`.
- Memory of live AI sessions — sessions remain ephemeral; memory is rebuilt from
  storage, consistent with the existing per-turn history rebuild.

---

## 2. Constraints

| Constraint                                             | Consequence                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On-device only (Gemini Nano)                           | No external APIs; extraction must use `LanguageModel` / `Summarizer` directly.                                                                                                                                                                                                                                                                                                                          |
| Small model context (~4–8k tokens)                     | Hard budget on injected memory: **≤ 2,000 chars total per turn**.                                                                                                                                                                                                                                                                                                                                       |
| MV3 service worker can't hold AI sessions reliably     | Background AI runs in an **offscreen document**; SW only orchestrates.                                                                                                                                                                                                                                                                                                                                  |
| One offscreen document at a time                       | SW maintains a **serialized job queue**.                                                                                                                                                                                                                                                                                                                                                                |
| Prompt API has no tool-use                             | Retrieval happens in code, not model-driven.                                                                                                                                                                                                                                                                                                                                                            |
| No shipped embeddings API                              | **Semantic Embedder API** (developer trial, `SemanticEmbedder.availability()/create()/embed()`, EmbeddingGemma-class models) is the future-preferred backend (§7.6). Interim: bundled `all-MiniLM-L6-v2`-class ONNX model (~23 MB) via Transformers.js in a Web Worker, **CPU backend only** (WebGPU silently produced wrong vectors in the reference build). Lexical retrieval is the always-on floor. |
| MV3 CSP for extension pages                            | ONNX Runtime needs `wasm-unsafe-eval` in `content_security_policy.extension_pages`; model weights + WASM binaries must ship inside `dist/` (no CDN fetches — `allowRemoteModels = false`, `allowLocalModels = true`).                                                                                                                                                                                   |
| Flag-gated APIs (Writer/Rewriter/Proofreader)          | Memory pipeline depends only on **Prompt + Summarizer** (stable in extensions, Chrome 138+).                                                                                                                                                                                                                                                                                                            |
| Storage quota (`chrome.storage.local`, ~10 MB default) | Caps: ~150 facts, ~200 page events, one summary per thread. Well under quota. Consider `unlimitedStorage` only if thread transcripts themselves grow.                                                                                                                                                                                                                                                   |

---

## 3. Architecture

```
┌────────────────────────────┐      ┌────────────────────────────┐      ┌────────────────────────────┐
│ Side panel (React UI)      │      │ Service worker             │      │ Offscreen document         │
│                            │      │ (orchestrator, NO AI)      │      │ (background AI worker)     │
│ • reads assistant_memory_v1│      │                            │      │                            │
│ • injects memory into      │      │ • storage.onChanged /      │      │ • LanguageModel: fact      │
│   prompts & sharedContext  │      │   alarms → schedule jobs   │      │   extraction               │
│ • Settings ▸ Memory screen │      │ • serialized job queue     │      │ • Summarizer: rolling      │
│   (list/edit/delete/       │      │ • createDocument on demand │      │   thread summaries, page   │
│   toggles/clear)           │      │ • close when queue drains  │      │   result gists             │
│ • writes PageMemory on     │      │                            │      │                            │
│   completed page actions   │      │                            │      │ • writes extraction results│
│                            │      │                            │      │   to assistant_memory_v1   │
└────────────┬───────────────┘      └─────────────┬──────────────┘      └─────────────┬──────────────┘
             │                                    │                                   │
             └────────────────────┬───────────────┴───────────────────────────────────┘
                                  ▼
                        chrome.storage.local
                        • assistant_threads_v1  (existing, unchanged)
                        • assistant_settings_v1 (extended with memory toggles)
                        • assistant_memory_v1   (NEW)
```

### Amendment to the architecture rule

Current AGENTS.md rule: _"AI sessions are created and held in the side panel
context. The service worker never runs AI."_

V2 rule: **AI runs in the side panel (interactive) and in the offscreen document
(background memory jobs). The service worker still never runs AI — it only
schedules jobs and manages the offscreen document lifecycle.**

### Triggers

- **Thread activity:** SW watches `chrome.storage.onChanged` for
  `assistant_threads_v1`. On change, debounce ~30 s, then enqueue:
  - summary job if the thread has ≥ 10 uncovered messages beyond `HISTORY_WINDOW`
  - fact-extraction job if the thread has new messages since `lastExtractedAt[threadId]`
- **Periodic sweep:** `chrome.alarms` (e.g. every 6 h) catches threads changed
  while the browser was closed, and runs consolidation (Phase 3).
- **Page action completed:** the side panel writes a `PageMemory` row directly
  (it knows the pending action + result). If the result is long, the SW later
  enqueues an offscreen job to compress it into a gist.

### Concurrency / single-writer discipline

Race risk: panel and offscreen doc both write `assistant_memory_v1`.

- The offscreen doc is the **only writer of extracted data** (facts, summaries, gists).
- The panel writes only **user actions**: edits, deletes, toggles, `PageMemory` rows.
- Mitigations:
  1. Offscreen jobs **re-read storage immediately before writing** and merge,
     never blind-overwrite.
  2. User-deleted facts go into a `deletedFactTexts` tombstone list; extraction
     skips any candidate matching a tombstone (match by normalized text, not
     just id, so re-extraction can't resurrect a deleted fact with a new id).
  3. Extraction of a given thread is idempotent via the `lastExtractedAt`
     watermark — replays produce no duplicates.

---

## 4. Data Model — `assistant_memory_v1`

```ts
/** Storage key. Versioned like the existing keys; normalize() drops unknown shapes. */
export const MEMORY_KEY = 'assistant_memory_v1';

export type FactKind = 'preference' | 'identity' | 'context';

export interface MemoryFact {
  id: string;
  text: string; // one sentence, self-contained, ≤ 200 chars
  kind: FactKind; // preference: style/tone/defaults; identity: who the user is;
  // context: ongoing projects/situations (decays fastest)
  sourceThread: string; // thread id where it was first observed
  createdAt: number;
  updatedAt: number; // bumped when extraction supersedes/merges it
  lastUsedAt: number; // bumped each time it is injected into a turn
  useCount: number;
  supersedes?: string[]; // ids of facts this one replaced
  embedding?: QuantizedVector; // semantic vector of `text` (see §7.5); absent → lexical-only
}

/** int8-quantized embedding vector + per-row dequant scale (JSON-safe).
 *  Dimension-agnostic: `v.length` = backend dims (384 MiniLM, 768 EmbeddingGemma).
 *  ~400–800 bytes per item. */
export interface QuantizedVector {
  v: number[]; // int8 values, -128..127
  s: number; // dequant scale: float32 ≈ v[i] * s
}

export interface ThreadSummary {
  summary: string; // ≤ 800 chars, rolling
  coveredUpToMessageId: string; // last message included in the summary
  updatedAt: number;
}

export interface PageMemory {
  id: string;
  url: string;
  pageTitle: string;
  mode: ModeId; // which selection action ran
  gist: string; // one line: what the user did / what the page was about
  resultSummary: string; // short Summarizer pass over the result (≤ 300 chars)
  threadId?: string; // thread the action created, if any
  createdAt: number;
  embedding?: QuantizedVector; // vector of `pageTitle + gist + resultSummary`
}

export interface MemoryStore {
  facts: MemoryFact[]; // capped ~150, score-evicted
  threadSummaries: Record<string, ThreadSummary>;
  pageEvents: PageMemory[]; // capped ~200, FIFO by createdAt
  deletedFactTexts: string[]; // tombstones (normalized text), capped ~500
  lastExtractedAt: Record<string, number>; // threadId → timestamp watermark
  embedModel: string | null; // model id+version that produced the vectors;
  // mismatch ⇒ stale vectors, ignored + re-embedded
}
```

Caps and eviction:

- **Facts:** hard cap 150. Score = `recency(updatedAt) + 2·log(1+useCount) +
recency(lastUsedAt)`, kind-weighted (`identity` > `preference` > `context`).
  Lowest score evicted first; `context` facts older than 90 days with
  `useCount === 0` are dropped regardless.
- **Page events:** FIFO at 200.
- **Thread summaries:** one per thread; deleted when the thread is deleted
  (panel removes the row on thread delete).

---

## 5. Offscreen Worker

### Manifest & build changes

- `public/manifest.json`: add `"offscreen"` permission.
- New `offscreen.html` (minimal page loading `src/offscreen.ts`).
- `vite.config.ts`: add `offscreen.html` as a second input (alongside
  `sidepanel.html`); background stays as-is. The content-script IIFE build is
  untouched.

### Message protocol (SW ↔ offscreen)

```ts
type MemoryJob =
  | { type: 'summarize-thread'; threadId: string }
  | { type: 'extract-facts'; threadId: string }
  | { type: 'compress-page-result'; pageEventId: string };

// SW → offscreen: { target: 'offscreen', action: 'run-job', job: MemoryJob }
// offscreen → SW: { action: 'job-done', job, ok: boolean, error?: string }
```

The offscreen doc does its own storage reads/writes (payloads stay small —
message only the ids). SW creates the document with reason `'WORKERS'`
(justification: on-device AI inference for local memory maintenance), runs the
queue, and closes the document when the queue drains. Failed jobs are retried
once, then dropped (next sweep will re-enqueue from the watermark).

### Availability guard

Before running jobs, offscreen checks `Summarizer.availability()` /
`LanguageModel.availability()`. If unavailable/downloading → abort the queue
quietly and leave `lastExtractedAt` untouched so a later sweep retries. The
CapabilityBanner in the panel already surfaces availability to the user; the
Memory settings screen shows a "background memory unavailable" hint in that case.

---

## 6. Job Details

### 6.1 Rolling thread summary (Phase 1)

- **Trigger:** thread has messages beyond `coveredUpToMessageId` such that the
  uncovered tail exceeds `HISTORY_WINDOW + 10`.
- **Input:** previous summary (if any) + the messages between
  `coveredUpToMessageId` and the last `HISTORY_WINDOW` messages (the recent tail
  is kept verbatim in the window and must NOT be summarized away).
- **Method:** `Summarizer.create({ type: 'key-points', length: 'short' })`,
  `sharedContext` = previous summary. Output trimmed to ≤ 800 chars.
- **Write:** `threadSummaries[threadId]`, advance `coveredUpToMessageId`.
- Incremental by construction: cost per run is bounded by the 10-message batch.

### 6.2 Fact extraction (Phase 2)

- **Trigger:** new messages in a thread since `lastExtractedAt[threadId]`,
  debounced; at most one run per thread per 10 minutes.
- **Method:** `LanguageModel` one-shot prompt, non-streaming, JSON output:

```
You maintain a long-term memory of durable facts about the user for a
browser assistant. From the conversation below, extract facts worth
remembering across future conversations.

Rules:
- Only durable, user-specific facts: preferences, identity, recurring
  context (projects, people, languages, tools).
- Ignore one-off task content, page text, and anything already covered by
  EXISTING FACTS.
- If a new fact updates or contradicts an existing one, output it with
  "supersedes": [<existing fact id>].
- Max 3 facts. If nothing is worth remembering, output [].
- Each fact: one self-contained sentence, <= 200 chars.

Output JSON: [{ "text": string, "kind": "preference"|"identity"|"context",
               "supersedes": string[] }]

EXISTING FACTS:
<id> | <kind> | <text>   (all current facts, id-prefixed — small enough to fit)

CONVERSATION (new turns only):
<watermark → newest, user/assistant lines, truncated to ~6k chars>
```

- **Post-processing (code, not model):** validate JSON shape; drop texts
  matching `deletedFactTexts` tombstones; apply `supersedes` (remove old ids,
  set new `supersedes` field); dedupe near-identical texts (normalized
  lowercase compare); enforce cap 150 with eviction; update
  `lastExtractedAt[threadId]`.
- Extraction never runs on error messages or empty placeholder assistant turns
  (same filter as `buildContext`).

### 6.3 Page-result compression (Phase 2)

- For `PageMemory` rows whose raw result exceeded ~500 chars: `Summarizer`
  one-shot → `resultSummary` ≤ 300 chars, `gist` ≤ 120 chars (gist also gets
  page title + mode for grounding).

---

## 7. Retrieval & Injection (side panel, per send)

New shared module `src/memory/store.ts` (at the `src/settings.ts` level, since
panel and offscreen both import it) + `src/sidepanel/hooks/useMemory.ts`
mirroring the `useThreads` persistence pattern:

```ts
export interface MemoryBlock {
  threadSummary?: string; // this thread's rolling summary
  facts: MemoryFact[]; // selected facts, ordered core-first
  pages: PageMemory[]; // relevant recent page activity
  text: string; // rendered, budget-trimmed injection string
}

export function buildMemoryContext(
  userMessage: string,
  thread: Thread | null,
  store: MemoryStore,
  mode: ModeId,
): MemoryBlock;
```

### Selection algorithm (all in code)

1. **Thread summary:** always included when present (it is this thread's own memory).
2. **Core facts:** all `identity` + `preference` facts, most recently used first, up to 8.
3. **Hybrid relevance match** over remaining facts and `pageEvents`:
   - **Semantic path (preferred):** embed the user message (one CPU pass,
     < 1 s cold, ~ms warm — §7.5), cosine-similarity against stored vectors
     (`embedModel` must match, else treat as absent); brute-force scan — at
     ≤ 350 items this is microseconds, no ANN index needed.
   - **Lexical fallback:** items without a usable vector (or when the embedder
     is unavailable) are scored by BM25-style term overlap (lowercase, split on
     non-alphanumerics, stop words dropped).
   - Combined score = `max(semantic, lexical)` normalized, with a small
     recency/useCount boost. Take top 5 facts + top 2 page events above a
     score floor (semantic ≈ 0.35 cosine, lexical > 0 — floors tuned in Phase 0b).
4. **Budget trim:** render into `text` (sections: `About the user:` /
   `Earlier in this conversation:` / `Recent page activity:`), newest/most-core
   last so trimming removes weakest items first; hard cap 2,000 chars.

Degradation ladder (mirrors the reference build): lexical search works the
instant storage loads → semantic ranking once the embedder is warm → both never
block the send path (query embedding has a ~1.5 s timeout, then the lexical
result is used as-is).

### Per-mode injection

| Mode                | Injection                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt              | Memory block prepended to `initialPrompts` as a leading context turn (before the history window).                                                                                             |
| Write               | Memory block appended to `sharedContext` (existing `historyToSharedContext` output first, memory after, both inside the 4,000-char `SHARED_CONTEXT_MAX_CHARS` with memory reserving ≤ 2,000). |
| Summarize           | Same as Write.                                                                                                                                                                                |
| Translate           | Preference facts only (target language, tone/glossary hints). No page memory, no summaries.                                                                                                   |
| Rewrite / Proofread | None by default (text-in/text-out; memory adds noise).                                                                                                                                        |

- `useCount` / `lastUsedAt` bump on injection (fire-and-forget storage write,
  debounced so streaming isn't interrupted).
- Everything gated by settings toggles (§8). `memory.enabled === false` →
  `buildMemoryContext` returns an empty block and the SW skips all jobs.

### Context budget math (Prompt mode worst case)

| Component                | Budget                       |
| ------------------------ | ---------------------------- |
| Rolling thread summary   | ≤ 800 chars                  |
| Facts + page events      | ≤ 1,200 chars                |
| History window (20 msgs) | existing behavior, unchanged |
| User turn                | remainder                    |

If the Prompt session reports context overflow, the oldest `initialPrompts`
turns are dropped by the API — memory is placed first so it survives longest
(matching the "Earlier in this conversation" semantics).

### 7.5 Embedding runtime (pluggable backends)

Chrome has no _shipped_ embeddings API today, but the **Semantic Embedder API**
is in developer trial (see §7.6). The design therefore puts a backend interface
at the seam, with a degradation ladder:

```
1. SemanticEmbedder (built-in, when available)   ← preferred, zero package cost
2. Bundled Transformers.js model (§7.7)          ← opt-in fallback, +23–120 MB
3. BM25-style lexical retrieval (§7 step 3)      ← always available, instant
```

```ts
// src/memory/embed.ts — the ONLY module that knows which backend is active.
export interface EmbeddingBackend {
  readonly id: string; // written to MemoryStore.embedModel (version pin)
  readonly dims: number; // 384 (MiniLM) | 768 (EmbeddingGemma) | …
  embed(texts: string[], task: 'query' | 'document'): Promise<QuantizedVector[]>;
  destroy(): void; // free model/session resources
}

export async function getEmbeddingBackend(): Promise<EmbeddingBackend | null>;
// feature-detects SemanticEmbedder first, then the bundled model, else null (lexical-only)
```

Callers (panel worker, offscreen jobs) never import a backend directly — same
discipline as the `AIProvider` seam in `src/ai/`.

### 7.6 Backend A: Semantic Embedder API (future-preferred)

Proposal: [`explainers-by-googlers/semantic-embedder-api`](https://github.com/explainers-by-googlers/semantic-embedder-api)
(Chrome Built-in AI team). **Status Oct 2026: early design sketch / developer
trial — NOT approved to ship; name may change; assume flag-gated** like
Writer/Proofreader.

Why it's the ideal fit when it lands:

- Same `availability() → create() → embed()` pattern as the Summarizer /
  Translator we already use in `src/ai/chrome.ts` — near-zero new concepts.
- `metadata.embeddingSpace` (e.g. `"embeddinggemma-300m"`) maps directly onto
  our `embedModel` version pin; a backend switch invalidates old vectors and
  the existing lazy re-embed job migrates them. **No new migration machinery.**
- Task hints map 1:1 onto our two paths: `"retrieval-query"` for the send-time
  query embed, `"retrieval-document"` for facts/page events/summaries in
  offscreen jobs. (The bundled backend ignores the hint.)
- Early prototypes use open-weight multilingual models (EmbeddingGemma-300m,
  Qwen3-Embedding-0.6B) — resolves the language-coverage problem (§11 #11)
  with **no extension package growth**, no CSP/`wasm-unsafe-eval`, no WASM.
- `maxInputTokens: 2048` — far beyond any memory item we embed (facts ≤ 200
  chars, gists ≤ 300). No chunking needed for our corpus.
- `destroy()` after each offscreen job batch fits the create-on-demand,
  close-on-drain offscreen lifecycle (§5).

Implementation notes for the swap (all inside `embed.ts`):

```ts
if ('SemanticEmbedder' in globalThis && (await SemanticEmbedder.availability()) === 'available') {
  const s = await SemanticEmbedder.create();
  const r = await s.embed(texts); // batch, 1:1 with input order
  // vectors: r.embeddings[i].values (Float32Array) → quantize (§7.7 format)
  // pin:     r.metadata.embeddingSpace      → MemoryStore.embedModel
  s.destroy();
}
```

Caveats to re-verify at swap time: exposure in extension pages **and offscreen
documents** (the explainer's permissions-policy section suggests top-level
frames; extensions TBD), final API name, whether `availability()` reports
`'downloadable'` / `'downloading'` like the other Built-in AI APIs, and whether
quantizing its Float32 vectors to our int8 format shifts ranking (re-run the
Phase 0b ranking assertion).

**Strategy:** ship the interface (§7.5) in Phase 2b with whichever backend
Phase 0b validates; add the `SemanticEmbedder` backend as a small,
self-contained change when the API reaches stable (or earlier behind the flag
for testing) — no data-model, storage, or UI changes required.

### 7.7 Backend B: bundled Transformers.js model (interim)

Approach per the reference build ([marcwieland.name, July 2026](https://marcwieland.name/building-a-privacy-first-local-ai-search-on-device-embeddings-chromes-built-in-llm/)).

**Model & assets**

- Model: `all-MiniLM-L6-v2` quantized ONNX (~23 MB, 384 dims, 256-token window)
  — default. **Open decision (interim only):** it is English-centric; this app
  translates across languages and users may chat in non-English. If
  multilingual matters before the Semantic Embedder API ships, use
  `paraphrase-multilingual-MiniLM-L12-v2` (~120 MB, 384 dims) instead — same
  pipeline, bigger download. **If the Semantic Embedder API (§7.6) reaches
  stable/usable-behind-flag before Phase 2b, skip Backend B entirely** — its
  EmbeddingGemma-class models are multilingual with zero package cost. Vectors
  from different models are never interchangeable (`embedModel` pin enforces
  this).
- Assets ship inside the extension: model weights + ONNX Runtime WASM under
  `dist/models/` (fetched via `chrome.runtime.getURL`, never a CDN).
- `public/manifest.json`: `content_security_policy.extension_pages` must add
  `wasm-unsafe-eval` for ONNX Runtime.

**Runtime rules (bugs the reference build hit — treat as hard requirements)**

1. **CPU backend only.** WebGPU silently produced normalized-but-meaningless
   vectors that don't live in the same space as CPU-built ones. Pin
   `device: 'cpu'` everywhere; never mix backends between document-embedding
   and query-embedding.
2. `env.allowLocalModels = true` (defaults to **false** in browser/worker
   contexts — without it the pipeline silently aborts) and
   `env.allowRemoteModels = false`; set `env.localModelPath` and
   `env.backends.onnx.wasm.wasmPaths` to the bundled asset URLs.
3. **Version comparability:** every stored vector is tagged via `embedModel`
   in the store. On model change/upgrade, stale vectors are ignored and
   re-embedded lazily by a background job (corpus ≤ ~350 items ⇒ a full
   re-embed is minutes of CPU at worst, done incrementally).

**Where it runs**

- **Side panel Web Worker** (`src/sidepanel/workers/embed.worker.ts`, module
  worker): query embedding at send time. Model loads lazily on first memory-
  enabled send; warm afterwards. Timeout 1.5 s → fall back to lexical (§7).
- **Offscreen document** (§5): document-side embeddings — new/updated facts,
  page events, thread summaries — as an extra step of the existing extraction
  jobs. Same bundled model, same CPU backend ⇒ comparable vectors.
- Both contexts go through the shared `src/memory/embed.ts` seam (§7.5), so
  backend selection and env config can never drift apart. With Backend B
  active, `task` hints are ignored; with Backend A (§7.6) they map to
  `"retrieval-query"` / `"retrieval-document"`.

**Storage**

- Vectors stored inline as `QuantizedVector` (int8 + scale, ~400–800 bytes JSON
  per item). At the caps above: ≤ 350 vectors ≈ 140–280 KB — negligible against
  the quota, and no binary format/IndexedDB needed (unlike the reference build,
  which served 855 chunks over the network).

**Cost note:** ~23 MB added to the extension package (or ~120 MB for the
multilingual model). Acceptable for an on-device AI extension; flagged in
README.

---

## 8. Settings & User Control

`src/settings.ts` extension (with `normalizeSettings` support):

```ts
export interface AppSettings {
  actions: Record<SelectionActionId, boolean>;
  options: ModeOptions;
  memory: {
    enabled: boolean; // master toggle, default: false (opt-in — privacy-first)
    pageMemoryEnabled: boolean; // default: false; requires enabled
  };
}
```

**Memory section in `Settings.tsx`:**

- Master toggle ("Remember context across conversations") + page-memory toggle.
- **Facts list:** each row shows text + kind badge + source/date; inline edit
  (same pattern as thread rename) and delete; delete writes the tombstone.
- **Page activity list:** URL/title/gist rows with delete; "Clear page memory".
- **"Clear all memory"** button with confirm (clears facts, summaries, page
  events, and tombstones).
- Status line: last background run time; hint when Built-in AI is unavailable.

Deleting a thread also deletes its `threadSummaries` row and (Phase 3 decision)
optionally its sourced facts — **v2 default: keep facts** (they're
cross-thread by design), the UI shows source thread as informational only.

---

## 9. Code Touchpoints

| File                                             | Change                                                                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/manifest.json`                           | `"offscreen"` permission; `wasm-unsafe-eval` in extension-pages CSP (Backend B only).                                                                           |
| `offscreen.html` + `src/offscreen.ts`            | NEW — background AI worker (jobs §6 + document embedding §7.5).                                                                                                 |
| `vite.config.ts`                                 | add `offscreen.html` input; module-worker build for the embed worker.                                                                                           |
| `src/background.ts`                              | job queue, triggers (onChanged/alarm), offscreen lifecycle, message routing; include tab URL/title in the pending page-action payload.                          |
| `src/memory/store.ts`                            | NEW — MemoryStore types, normalize, scoring, tombstones, caps/eviction, `buildMemoryContext` (shared by panel + offscreen, like `src/settings.ts`).             |
| `src/memory/embed.ts`                            | NEW — `EmbeddingBackend` seam (§7.5): backend selection (SemanticEmbedder → bundled → null), quantize/dequantize, cosine; imported by panel worker + offscreen. |
| `src/memory/embed.transformers.ts`               | NEW — Backend B impl (Transformers.js wrapper, CPU pin, bundled assets). Skipped if Semantic Embedder API ships first (§7.7).                                   |
| `src/memory/embed.semantic.ts`                   | FUTURE — Backend A impl (`SemanticEmbedder`), added when the API is usable (§7.6); no other file changes.                                                       |
| `src/sidepanel/workers/embed.worker.ts`          | NEW — query-embedding worker (lazy model load, 1.5 s timeout).                                                                                                  |
| `models/` assets + `scripts/fetch-model.mjs`     | NEW — download/pin the ONNX model + ORT WASM into `dist/models/` at build time (gitignored, integrity-checked). Backend B only.                                 |
| `src/sidepanel/hooks/useMemory.ts`               | NEW — load/subscribe (`storage.onChanged`) + user-edit writes.                                                                                                  |
| `src/sidepanel/lib/context.ts`                   | `buildContext` stays thread-only; memory is composed alongside it in the send flow.                                                                             |
| `src/sidepanel/lib/runMode.ts`                   | thread `MemoryBlock.text` into Prompt `history`/`initialPrompts` and Write/Summarize `sharedContext` per §7 table.                                              |
| `src/ai/types.ts`                                | optional `memory?: string` on `PromptRequest`/`WriteRequest`/`SummarizeRequest` (provider seam stays Chrome-globals-free).                                      |
| `src/ai/chrome.ts`                               | map `memory` into `initialPrompts` / `sharedContext`.                                                                                                           |
| `src/settings.ts`                                | `memory` settings + normalize.                                                                                                                                  |
| `src/sidepanel/components/settings/Settings.tsx` | Memory section UI.                                                                                                                                              |
| `src/sidepanel/App.tsx`                          | write `PageMemory` on completed page actions; bump fact usage.                                                                                                  |
| `AGENTS.md` / `README.md`                        | amend AI-placement rule, document offscreen worker + `assistant_memory_v1`.                                                                                     |

---

## 10. Phasing

### Phase 0 — Spike (blocking, ~half a day)

Verify on target Chrome build:

1. `Summarizer.availability()` / `create()` succeed inside an offscreen document.
2. `LanguageModel.create()` + one-shot JSON prompt works there too.
3. Offscreen doc created from `storage.onChanged` handler in the SW (no user
   gesture) is allowed; document lifetime behaves as expected under queue drain + close.
4. **Embedder spike (Phase 0b):**
   - First, feature-detect `SemanticEmbedder` (side panel **and** offscreen
     doc, with the relevant flag enabled if needed): `availability()`,
     `create()`, batch `embed()`, `metadata.embeddingSpace`. If usable,
     Backend A is the primary path and the bundled-model spike below becomes
     optional (§7.7).
   - Otherwise verify Transformers.js loads the bundled model in (a) a
     side-panel module worker and (b) the offscreen doc under the MV3 CSP
     (`wasm-unsafe-eval`); CPU embeddings for a paraphrase pair ("writing to my
     boss" vs fact "prefers formal tone for work emails") beat an unrelated fact.
   - **Must be asserted in a real browser, not Node** — both reference-build bugs
     were invisible to Node tests. Decide English vs multilingual model here
     (moot if Backend A is usable — EmbeddingGemma-class is multilingual).

If (1) or (2) fails: fallback is panel-only extraction (post-reply debounce +
catch-up on panel open) — the rest of the design is unaffected.
If (4) fails: retrieval degrades to lexical-only (§7 fallback) — the memory
store and injection paths are unaffected.

### Phase 1 — Episodic memory

Offscreen infrastructure (manifest/build/SW queue), `assistant_memory_v1`
store + normalize, rolling thread summaries, summary injection into Prompt and
Write/Summarize. Ships value on its own (fixes the silent context drop-off).

### Phase 2 — Semantic + page memory

Fact extraction job, tombstones/eviction, `PageMemory` writes + compression
job, retrieval (`buildMemoryContext`) **lexical-first**, per-mode injection
table, Settings Memory screen (all controls).

### Phase 2b — Embedding retrieval

`EmbeddingBackend` seam (§7.5), Backend A and/or B per Phase 0b outcome,
panel worker + offscreen document-embedding step, `QuantizedVector` storage,
`embedModel` pin + lazy re-embed job, hybrid scoring in `buildMemoryContext`,
real-browser integration test (the ranking assertion from Phase 0b, kept as a
regression test).

**Deferred swap-in:** when the Semantic Embedder API stabilizes (or a usable
flag build appears), add `embed.semantic.ts` — backend selection prefers it
automatically, the `embedModel` pin invalidates old vectors, and the existing
lazy re-embed job migrates them. If Backend B shipped, it can then be removed
(recovering the 23–120 MB package cost) or kept as the fallback tier.

### Phase 3 — Later (not in V2 scope)

Consolidation job (LLM merge of near-duplicate facts, decay re-scoring), LLM
rerank of retrieval candidates, memory search box on the home screen
("what did we discuss about X?"), per-thread memory viewer, fact export/import.

---

## 11. Risks & Open Questions

| #   | Risk / Question                                                                                                 | Mitigation / Default                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Built-in AI unavailable in offscreen context on some builds                                                     | Phase 0 spike; panel-only fallback.                                                                                                                                                                                                                                              |
| 2   | Extraction quality: junk facts, PII over-capture                                                                | Strict prompt rules, max 3/run, user review UI, default **opt-in** (`enabled: false`). Consider a first-run explanation.                                                                                                                                                         |
| 3   | Battery/CPU: Nano spins up while panel closed                                                                   | 30 s debounce + per-thread 10-min cooldown + queue serialization; jobs are small (≤ 6k chars in, ≤ 800 out).                                                                                                                                                                     |
| 4   | Storage races panel ↔ offscreen                                                                                 | Single-writer discipline + re-read-before-write + tombstones (§3).                                                                                                                                                                                                               |
| 5   | Prompt API JSON output reliability (Nano may emit malformed JSON)                                               | Tolerant parse (strip code fences, first `[`…`]` slice), schema validation, silent drop on failure — watermark untouched so next sweep retries.                                                                                                                                  |
| 6   | Context overflow with memory + 20-message window                                                                | 2,000-char hard budget; memory placed first in `initialPrompts`; monitor via session errors.                                                                                                                                                                                     |
| 7   | Should deleting a thread delete its sourced facts?                                                              | v2 default: keep (cross-thread by design). Revisit if users expect full erasure.                                                                                                                                                                                                 |
| 8   | Page memory privacy perception                                                                                  | Separate default-off toggle, visible list, FIFO cap, never records pages the user didn't act on.                                                                                                                                                                                 |
| 9   | `chrome.storage.local` quota with many threads' summaries                                                       | ~800 chars/thread × hundreds of threads ≈ well under quota; add `unlimitedStorage` only if needed.                                                                                                                                                                               |
| 10  | Embedder silent failure (`allowLocalModels` default false, CSP blocks WASM, WebGPU garbage vectors)             | Hard runtime rules in §7.7; real-browser integration test asserting a known paraphrase ranks top; lexical fallback always present so failure degrades, never breaks.                                                                                                             |
| 11  | English-only embedding model vs a translation-heavy, possibly non-English user base                             | Interim: Phase 0b decision `all-MiniLM-L6-v2` (~23 MB) vs `paraphrase-multilingual-MiniLM-L12-v2` (~120 MB). Endgame: Semantic Embedder API prototypes use multilingual EmbeddingGemma/Qwen3-Embedding — the `embedModel` pin makes the switch a lazy re-embed, not a migration. |
| 12  | Extension package growth (+23–120 MB model assets, Backend B only)                                              | Build-time fetch script (gitignored, integrity-checked); documented in README; skipped entirely if Backend A ships first; removable after Backend A swap-in.                                                                                                                     |
| 13  | Query-embedding latency on cold worker (model load)                                                             | Lazy warm-up after first send; 1.5 s timeout → lexical result used; warm queries ~ms (CPU, short text).                                                                                                                                                                          |
| 14  | Semantic Embedder API is NOT approved to ship; name/shape may change; extension + offscreen exposure unverified | Treat as future-preferred, never as a dependency: the `EmbeddingBackend` seam isolates it to one file; lexical + bundled tiers keep working regardless. Re-verify the §7.6 caveat list at swap time.                                                                             |

---

## 12. Success Criteria

- A 100-message thread answers questions about its first 20 messages correctly.
- Telling the assistant "I prefer formal tone" in thread A changes Write-mode
  output in a fresh thread B (with memory enabled).
- "What did I summarize yesterday?" retrieves the right page event.
- A message with **no term overlap** ("drafting something for my manager")
  still retrieves the right fact ("prefers formal tone for work emails") once
  Phase 2b ships — and the lexical fallback still finds exact-word matches before it.
- Deleting a fact in Settings means it never reappears (tombstone honored).
- Master toggle off ⇒ zero background jobs, zero injection, storage untouched.

---

## References

- Semantic Embedder API explainer — <https://github.com/explainers-by-googlers/semantic-embedder-api>
- Reference build for on-device embeddings (Transformers.js, CPU-only pitfalls, quantized vector format) — <https://marcwieland.name/building-a-privacy-first-local-ai-search-on-device-embeddings-chromes-built-in-llm/>
- Transformers.js — <https://huggingface.co/docs/transformers.js>
- Chrome offscreen API — <https://developer.chrome.com/docs/extensions/reference/api/offscreen>
- Chrome Built-in AI APIs — <https://developer.chrome.com/docs/ai/built-in>
