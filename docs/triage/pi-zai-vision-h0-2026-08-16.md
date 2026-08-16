# PI/ZAI Vision H0 — blind, documentation-only probe (2026-08-16)

Program `2a5fb60453f5fe7374a8145b` (owner-confirmed). Lane `fleet/260816094035-f07e`, slot 8.
Scope: this file is the only write. No Fleet code, Private-repo-h code, configuration, credentials, adapters,
state, HANDOFF, or other repo touched. No agents dispatched. No e2e-isolated run.

**Problem and importance:** Private-repo-h visual critique currently depends on a lane whose harness may or may
not be able to see images at all. Before any visual verdict from a pi/zai lane can be trusted, H0 asks
the gate question: does Pi's image path actually place pixels into this model's context? Everything
downstream (classes, dimension verdicts) is meaningless if the answer is no.

**Result in one line:** `imageIngress: unsupported` — the tool loaded both images and recorded them in
the session ledger, but the harness stripped them from the provider request because the resolved model
declares text-only input; all visual verdicts are therefore recorded as `unknown`, none fabricated.

---

## Phase 1 — image-ingress control (stated before any shell/file inspection)

Pi's `read` tool was invoked on both images (paths below). The tool ran, identified both as PNG, and
then the harness refused to place the pixels into model context. Exact error strings, verbatim:

```
[Current model does not support images. The image will be omitted from this request.]
(tool image omitted: model does not support images)
```

**`imageIngress: unsupported`.** No image content reached the model context. Per the brief, visuals
were not inferred from bytes or metadata, and the experiment continued only far enough to commit this
report.

**Closed visual comparison** (required field, honestly empty): `sameCoreScene`: **unknown**. Visible
differences: **none observable** — zero pixels entered context, so there are no visual observations of
either image and none may be invented. Which image carries each difference: not applicable.

**Boundary disclosure:** the read tool's bracketed status text unsolicitedly printed dimension strings
(`original 2400x1306` for A, `original 2416x1322` for B) alongside the refusal. These arrived unbidden
during the Phase 1 ingress attempt, were not sought, cannot constitute visual evidence, and were used
for no verdict (no verdict exists). Recorded here so the comparison surface stays honest.

**Blindness boundary held:** `docs/product-studio-working-circle.md`, Private-repo-h Visual Loop notes, Fable
output, and any prior Private-repo-h diagnosis were not searched for or read — including after the verdicts
(Phase 3). The two filenames are random strings and were not used as evidence. The phrase "AAA quality"
appears nowhere as evidence.

## Phase 2 — blind Private-repo-h critique (stated before any shell/file inspection; evidence-free)

With zero visual evidence every verdict-bearing field is `unknown` — observations precede labels, and
missing evidence is never a default:

- `primaryClass`: **unknown** (no basis to choose among tuning | ui | visual-direction | dimensionality | core-concept)
- `secondaryClass`: **unknown**
- three ranked visible findings: **none exist** — there were zero visual observations of image A
- `dimensionVerdict`: **unknown** (not silently defaulted to `keep-2d`; no evidence in either direction)
- smallest falsifiable next experiment (as stated at blind time): **rerun this exact two-image `read`
  under a harness/model combination whose registry declares image support and check whether the
  omission messages disappear** — that outcome would directly falsify "this model cannot receive these
  images through this harness"
- `confidence`: **0** for every visual field above. (Confidence that ingress is unsupported: ~0.98 —
  that is a direct tool result, not a visual claim.)
- what evidence could change the verdict: **a completed Phase 1 ingress** — if pixels actually reach
  context on a rerun, the three unknown fields become answerable and this report is superseded.

## Phase 3 — evidence after the verdicts

### Provider / model / thinking facts (own process)

| Fact | Value | Source |
|---|---|---|
| provider | `zai` | `PI_PROVIDER`, session ledger `message.provider` |
| model | `glm-5.3` ("GLM-5.3") | `PI_MODEL`, session ledger `message.model` |
| wire API | `openai-completions` | session ledger `message.api` |
| thinking | reasoning on; `PI_REASONING_LEVEL=high`; thinkingLevelMap `high → "high"`; reasoning tokens present on every assistant turn | env, `models.json`, ledger `usage.reasoning` |
| context window / maxTokens | 1,000,000 / 131,072 | `models.json`, `models-store.json` (zai) |
| harness | pi (`PI_CODING_AGENT=true`), config dir `~/.config/claude-fleet/pi-zai-agent` | env |
| session | id `52a3c567-2b8e-42f2-abd2-761356e85707`, jsonl under the config dir's sessions path | `PI_SESSION_ID`, `PI_SESSION_FILE` |

### Tool path and result

Both images read via the `read` tool in one parallel block:

- A: `/private/tmp/fleet-glm-vision-h0.rmP2xj/c1a9be37bc7f6de2.png`
- B: `/private/tmp/fleet-glm-vision-h0.rmP2xj/99b9f2dbcf7aad73.png`

Session ledger records both toolResults with content kinds `['text','image']` — the base64 PNG blocks
exist in the transcript. What reached the model was the text note and, at request-build time, a
placeholder — see mechanism below.

### Why the pixels never arrived — mechanism, quoted from the harness's own code

1. **Model declaration:** `models-store.json` (provider `zai`) lists `glm-5.3` with
   `"input": ["text"]` — as do all five listed zai models (`glm-4.7`, `glm-5-turbo`, `glm-5.2`,
   `glm-5.2-highspeed`, `glm-5.3`). The user-level `models.json` entry for `glm-5.3` declares **no
   `input` field at all**; the resolved model in this session behaved as text-only either way.
2. **Tool layer** (pi `dist/core/tools/read.js`):
   ```js
   function getNonVisionImageNote(model) {
       if (!model || model.input.includes("image")) { return undefined; }
       return "[Current model does not support images. The image will be omitted from this request.]";
   }
   ```
   The note is appended, but the image block is still produced into the tool result — hence the ledger.
3. **Request layer** (pi-ai `dist/api/transform-messages.js`):
   ```js
   const NON_VISION_TOOL_IMAGE_PLACEHOLDER = "(tool image omitted: model does not support images)";
   ```
   At request-build time every image block is replaced by that placeholder text. The pixels never reach
   the wire on this configuration.

### Sent / receipted / loaded / used — the four-way distinction

| Stage | Verdict | Evidence |
|---|---|---|
| **loaded** (tool read the file into a content block) | **yes** | ledger toolResults carry `image` blocks with base64 PNG data for A and B |
| **sent** (image bytes on the provider request) | **no** | transform layer swaps image blocks for the placeholder; corroborated by usage: the first turn after the images entered the transcript shows `input=2234, cacheRead=38848, total=43233`, and cacheRead grew only **+1024** versus the prior turn — two ~142 KB PNGs as base64 would have added roughly ~90–100k+ tokens. The payload is absent from the request by construction and by measurement |
| **receipted** (provider answered the turn) | **yes — to imageless requests** | every assistant turn carries a provider `responseId` (e.g. `20260816174127c8610316e0f94128`) and `stopReason:toolUse` |
| **used** (pixels present in model context) | **no** | direct non-perception: only the note and the placeholder text were visible to the model |

A prompt string proves none of the latter two — nothing here relies on one; the chain rests on the
harness's own code, the session ledger, and the usage numbers.

### File evidence (computed after verdicts)

| File | SHA-256 | Size (B) | Dimensions |
|---|---|---|---|
| A `c1a9be37bc7f6de2.png` | `abad1b6af5b004762fa82e80475a7b79a4900eb5e30f362906b1741606923401` | 141,747 | 2400 × 1306 |
| B `99b9f2dbcf7aad73.png` | `9c1a8dc8bf205670b701cae59742e7d3133a1ffb80f6db399199aeea879d1de9` | 142,599 | 2416 × 1322 |

Both PNG, 8-bit/color RGB, non-interlaced (`file(1)`; independently confirmed by parsing the PNG IHDR
in python). Both files mtime 2026-08-16 11:39. Quirk noted honestly: `sips` refused A with
"not a valid file - skipping" while accepting B — two other independent readers agree on A's
dimensions, so this is a `sips` quirk, not a property of the file.

### Observable usage (session ledger, per assistant turn)

```
line 11 (pre-image)   input=1068  cacheRead=37824 output=2045 reasoning=1837 total=40937
line 14 (post-image)  input=2234  cacheRead=38848 output=2151 reasoning=1387 total=43233
line 16               input=2740  cacheRead=41024 output= 852 reasoning= 408 total=44616
line 19               input=1540  cacheRead=43712 output= 541 reasoning= 125 total=45793
line 22               input=1766  cacheRead=45248 output=1048 reasoning= 521 total=48062
```

All `cost` fields read `0` (billing path not verifiable from here — see unknowns).

### Explicit unknowns

1. **Whether the zai endpoint would accept image parts at all.** The gate is client-side; no request
   containing an image ever reached the wire. Untested — and untestable without changing a
   configuration this brief forbids touching.
2. **Whether upstream GLM-5.3 is multimodal.** `"input": ["text"]` is a local declaration in the
   models store, not a capability measurement of the endpoint.
3. **Which config source won resolution** for glm-5.3 (`models.json` lacks `input`; the store says
   `["text"]`; the default-when-absent path in the resolver was not traced). Behaviorally irrelevant
   here — the note fired — but the precise provenance is unverified.
4. **Auth/endpoint URL:** `auth.json` exists in the agent config dir and was deliberately not read
   (credentials are out of scope for this brief).
5. **Cost/billing:** zeros in every `usage.cost` field; the billing arrangement is invisible to this
   process.
6. **Cache semantics of the placeholder swap** (whether placeholder text is what got cache-read) —
   interpretation only, from the +1024 cacheRead delta; not independently verified.

### Falsifiable next experiment (Phase-3-refined; owner act, one line, not performed here)

Add `"input": ["text","image"]` to the glm-5.3 model entry in the agent's model config and rerun the
identical two-image `read`. Three outcomes, each falsifying a different half of the current belief:

- placeholder disappears from tool output but the provider request fails (4xx) → the harness gate was
  the only ingress blocker; the endpoint refuses images;
- request accepted and the two images can be visually described by a blind rerun → full chain works,
  and Phase 2 of this experiment becomes performable as designed;
- request accepted but no usable description → sent + receipted but not used — the deepest failure,
  and the most important to rule out before any Private-repo-h visual critique rides on this lane.

## Verify

`GET /api/self/gate` was asked first (loader contract): `localProof.steps` recommended the full chain
with `classifiedAs: {}` (queried before the report file existed); a suite mutex was held by another
run (pid 25280, alive) and was left alone. The owner-confirmed brief scopes this documentation-only
experiment's local proof to exactly two commands; the server-side land gate remains authoritative and
unchanged by anything here.

Results are quoted verbatim in the done report of this lane (tails below):

```
$ git diff --check HEAD^
$ bun e2e/pins.ts
```

(green tails recorded in the lane report; see commit body)

## Open boundary

Unresolved, one line: whether GLM-5.3's own endpoint accepts images is unknown and remains untested —
the client-side text-only declaration is the only thing this experiment measured.
