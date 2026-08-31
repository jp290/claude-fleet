# Product Studio calibration — 2026-08-22

Status: **observed, non-normative review record**. This file does not promote a new workflow,
role, harness, engine, or game direction. Current code, ledgers, bindings, and live sensors outrank
this snapshot. The owner remains the only promotion and taste authority.

## Why this record exists

The Product Studio has moved beyond the older artillery prototype and is now exercising a fresh
Private-repo-k program. The durable Product Studio spine is sound, but the live run exposed
three proof gaps: a predicate without a real breaker, visual references reported without evidence
that their pixels were inspected, and delivery text that could be mistaken for a landed fact. This
record reconciles those observations with independent Fable, GLM, and Ox Alpha reviews without
turning their suggestions into policy by prose.

The canonical inputs remain:

- `AGENTS.md` for the portable authority and lifecycle contract;
- `docs/product-studio-working-circle.md` for the Product Studio profile;
- `docs/harness-doktrin-2026-08-17.md` and
  `docs/harness-implementations-research-2026-08-18.md` for harness boundaries;
- the target program's `AGENTS.md`, decision record, owner taste gates, briefs, and context-pack map
  for domain reality;
- live Fleet sensors and repository history for current state.

## Observed state at calibration time

- Fleet `main` was observed at `135ea83`; its post-land audit reported 2,847 checks and zero
  failures.
- ACP26 was observed as a clean, one-commit-ahead lane at `3c3474c`, with a green gate chain after
  an unrelated isolated-suite timing failure passed on a same-tree rerun. It was not landed by this
  review.
- The Private-repo-k target repository was observed at `bbb69a8` on `main`.
- Research A1 was observed at `2f32380`; its review correctly requested a repair because predicate
  14 had no demonstrated breaker. Research B1 was observed at `80b94b9`; its textual provenance
  work passed, but its visual conclusions remain `unknown` because the worker did not establish
  that it viewed the referenced images.
- A pane sentence claiming lanes 4 and 8 were landed conflicted with Git state. It was treated as
  text, not a lifecycle fact.
- No production engine, visual territory, camera, performance budget, or first vertical slice had
  been promoted by these reviews.

These observations are a dated snapshot, not a replacement for the live ledgers.

## Calibrated workflow

The shared studio core should stay small:

1. The owner confirms the program and retains promotion, external-effect, cost, deploy, and taste
   decisions.
2. Project MAIN decomposes the confirmed scope, selects bounded workers and models, interprets
   evidence, and requests owner attention only at a real gate.
3. A builder owns one explicit write set and produces exact, recoverable proof.
4. A fresh critic tests the result and its claimed falsifiers without inheriting the builder's
   conclusion.
5. Project MAIN performs ordinary repairs and integration, then presents a small owner-taste
   surface when prerequisites are satisfied.
6. Accepted reusable knowledge may be proposed as a Context Pack; reuse is not automatic
   promotion.

A brief should contain only the information needed to make the bounded decision:

- observed problem and why it matters;
- owned output and write set;
- authoritative context paths;
- constraints and explicit unknowns;
- proof command or capture contract;
- at least one falsifier that can actually flip;
- stop line and reporting route.

The destination supplies the overlay, not a second control plane:

| Surface | Shared core | GameDev overlay | iOS overlay |
|---|---|---|---|
| Roles and authority | Owner, MAIN, bounded worker, fresh critic | no extra hierarchy | no extra hierarchy |
| Proof | exact logs, paths, machine-readable predicates, critic result | committed replay, structured state, fixed-tick frames, performance counters, owner feel/readability gate | `xcodebuild`/XCTest logs, `.xcresult`, simulator captures, accessibility state, owner UX gate |
| Domain falsifier | claimed property must be breakable | strategy dominance, replay divergence, unreadable motion, missing countable nouns | build/test regression, snapshot/a11y/interaction failure, unsupported destination |
| External boundary | owner-authorized only | engine/tool cost and licensed assets | Xcode host, signing, devices, credentials, notarization and store submission |

The local host currently exposes Command Line Tools and Swift, but not a working full-Xcode
`xcodebuild`/`simctl` surface. A complete iOS UI pilot is therefore blocked on an owner-authorized
Xcode installation or a named Xcode host. Swift Package logic work may still test the portable
brief shape, but it is not evidence for the simulator/UI loop.

## Independent review record

Three read-only reviews were run against the same workflow material:

| Reviewer | Harness/model | Receipt or artifact | Useful independent signal |
|---|---|---|---|
| Fable | Claude Fleet, `claude-fable-5`, high | session `1d221ecf-d210-4e9b-86bf-d921c7626630`, receipt `5f7fdde0f532cea31785d527` | Require executable falsifiers and proof that visual workers actually viewed pixels. |
| GLM | Pi Z.AI, GLM-5.3, high | session `dc3f461f-f0b9-4ddd-9069-ccbf8c303bce`, receipt `6c26a71aca5fc3128cb84f09` | Share one brief grammar; keep GameDev/iOS as evidence overlays; full iOS loop is host-blocked. |
| Ox Alpha | native OpenCode, `opencode/x-preview-f-free`, max | local read-only run completed with exit 0 | Keep the spine; strengthen structural done-refusal, delivery evidence, and batched owner contact without adding roles. |

After the review, a minimal transport canary registered the same model in Pi's existing native
`opencode` provider through a temporary process-local `models.json`. With no tools, context files,
saved session, credentials, or global configuration, Pi listed the model as 1M context / 131K
output and returned the exact requested line `PI_OX_CANARY_OK` in 3.5 seconds with exit 0.

A second Pi canary then loaded the real portable contract, made parallel read-tool calls against
the two named repository files, recorded provider usage and cache counters at zero cost, and saved
the session under a temporary session root. A follow-up process attached to the same exact session
id and returned a nonce from the preceding turn without another file read. Tool calls and Pi-native
session persistence are therefore observed working too; a new provider implementation is not
required.

Reviewer claims were checked against current sources. Stale prose suggesting that MAIN-to-owner
attention does not exist was rejected: the current contract exposes that route. A second apparent
gap was dated by code during the later Grok adjudication below: ACP23 commit `2d188da` added
`POST /api/self/tasks`, through which a bound Program MAIN creates an own-program, own-repository
pending row and may explicitly select the spawn triple. Creation and release remain two acts. The
portable role-table sentence claiming that no creation route exists predates ACP23 and needs a
separate documentation correction; it is not a live capability fact.

## Adjudication

### Adopt as immediate working guidance

- **Executable falsifiers.** A proof report must identify any predicate with no breaker and fail
  itself, for example `predicates_without_breaker: N` with success requiring `N = 0`.
- **Actual visual inspection.** A visual worker must open the pixels, not merely retrieve a page.
  Its evidence should include a bounded capture, `seen: yes`, and a content hash or stable artifact
  path. Text-only provenance cannot prove a visual claim.
- **Structured done-refusal.** A worker should refuse to report done when a required proof artifact
  is missing. Script green is necessary where selected, but never substitutes for product evidence
  or owner taste.
- **Batched owner contact.** MAIN should aggregate reversible repairs and present the smallest real
  decision surface at a gate instead of seeking permission for ordinary in-scope steps.
- **One shared prompt grammar.** GameDev and iOS prompts specialize proof and boundaries; they do
  not duplicate Fleet roles, queues, or lifecycle.
- **Context Packs for transfer, not only compression.** A candidate pack must name the class of
  future decisions it improves, its applicability predicate, evidence provenance, known
  non-applications, and a retirement trigger.

### Already covered; do not duplicate

- Delivery receipts and settled-state correctness are already in the ACP25/ACP26 line of work.
- Fleet already owns sessions, routing, isolated lanes, verification, landing, and audit.
- Tower's current map already has proposed Context Pack identifiers; new reviews should improve or
  challenge those candidates rather than create parallel inventories.

### Reject or defer

- No self-land or automatic promotion. Shadow classification may be measured, but it cannot weaken
  owner promotion or the server land gate.
- No in-session subagent hierarchy, task queue, universal GameDev harness, or universal iOS
  harness.
- No production game-code spike before the Tower program's existing T0 prerequisite is satisfied.
- No engine choice by research score alone. Godot, Unity, Unreal, and a web/Three.js path may be
  compared with the same small scenario and artifact contract after the owner authorizes that
  experiment.
- No arbitrary clarification timer. Retry and escalation should depend on a named blocked state,
  not elapsed ceremony.

## Prompt calibration from Sharpen lessons

Prompts should be tailored to the expected failure of the role and model:

- A strong builder receives goals, invariants, write set, proof, falsifier, and stop line—not a
  narrated micro-workflow.
- A critic receives artifacts and acceptance/falsification criteria, but not the builder's desired
  verdict.
- A research worker must classify each claim as observed, inferred, proposed, or unknown and cite
  primary evidence when facts may have changed.
- MAIN receives the owner decision, live ledger, worker reports, and authority boundary—not every
  raw research transcript.
- Every prompt ends with a forward test: what exact observation would overturn the conclusion?

This is progressive disclosure by decision relevance. It should reduce accidental anchoring while
preserving enough freedom for strong models to solve the problem well.

## Three smallest reversible experiments

1. **A1b falsifier canary.** Repair the Tower predicate proof so every predicate has a demonstrated
   breaker and the verifier prints a machine-readable zero count. Compare critic recovery time and
   false-green rate with A1.
2. **Three-frame visual canary.** Give a visual worker exactly three named frames plus a rubric.
   Require proof of pixel inspection, hashes, and one deliberately mismatched frame. Measure
   detection accuracy and tool-result volume.
3. **Ox Alpha Fleet-profile canary.** Transport, anonymous authentication, read-tool calls, usage
   recording, and exact Pi session persistence have passed outside Fleet. Add the smallest
   process-local Fleet profile that pins `opencode/x-preview-f-free`, then exercise dispatch,
   readiness, context-fill, restart, report, and failure behavior in one read-only lane. Do not
   modify global configuration or credentials. If that lifecycle canary passes, Pi becomes the
   normal Ox harness and native OpenCode remains only a diagnostic fallback.

The third experiment is the remaining boundary for “Ox inside Pi.” Pi already ships an `opencode`
provider with the required Zen compatibility; its bundled catalog merely predates this newly
released model. The temporary catalog override, anonymous transport, repository reads, usage
records, and Pi session continuity are proven. Only Fleet packaging and lifecycle telemetry remain
to be observed rather than assumed.

## Open boundaries

- Tower's A1b, scorecard, C1, and T0 outcome remain Project MAIN work under the existing program
  ledger.
- The portable role table still describes the pre-ACP23 queue-creation boundary and should be
  corrected in a narrow verified documentation slice. Current server code and ACP23 tests already
  implement MAIN-owned pending-row creation.
- Full iOS observe-build-run-capture proof remains unavailable on this host until the Xcode
  boundary is resolved by the owner.
- The actual motion/impact and game-feel bar remains unknown until replayable frames and owner taste
  evidence exist.
- Context Pack candidates remain proposals until a demonstrated transfer case shows that they
  improve a later decision without importing stale assumptions.
- Grok can challenge this calibration using the companion
  `briefs/grok-fleet-product-studio-ideas-2026-08-22.md`; its answer is research input, never automatic policy.

## Grok proposal adjudication — 2026-08-22

Grok's response was useful research input, but its proposals were checked against current code and
the Tower program before adoption.

| Proposal | Verdict | Reason |
|---|---|---|
| Mandatory Fleet Evidence Envelope | **adapt / project-local** | Tower already proposes the substantive contract—replay identity, structured state, metrics, logs, frames, hashes, and manifest—and Fleet already transports a typed status plus bounded report text. Require a run manifest only on Acts that produce those artifacts; do not add a universal post-report hook or force research-only Acts to manufacture one. |
| MAIN may create one pending task | **already built** | ACP23 implements the narrower and stronger form: a bound MAIN can create multiple capped own-program pending rows, with repo derived from its checkout, closed body fields, validated harness/model/effort, and a separate release act. |
| Freshness tag and exclusion list | **reuse first** | Fresh critic lanes and explicit source exclusions already exist in the Tower critic brief. Fleet packs already carry source hash, observation time, status, harness, mode, and applicability. Keep exclusions in the Act brief until a repeated cross-program failure demonstrates a manifest-level field is needed. |
| Structured RPC instead of TUI delivery | **valid harness direction, not Studio policy** | ACP25/ACP26 already address observed composer delivery and settlement. A structured Pi/Fleet transport should be compared at the adapter seam with delivery, restart, and failure probes; it should not be smuggled in through an evidence feature. |
| Playable slice before parallel research | **defer / reorder** | A first-playable WIP limit is valuable after T0. Applying it before the current systems and visual evidence are integrated would violate the Tower founding order and create game code before architecture/slice promotion. |

### Evidence-envelope boundary

The useful concept is a **project-local run manifest**, not a second Fleet evidence database. The
first honest pilot belongs to the owner-authorized engine spike after T0:

- the Act brief names the artifact schema and run-scoped directory;
- the project adapter writes exact files and one compact manifest;
- the worker's existing Fleet report contains the verdict, commit, manifest path, and unresolved
  boundary—not copied logs or media;
- MAIN first reviews only that report and manifest, then opens selected exact artifacts;
- measurement compares model-visible input, missing-evidence recovery turns, and owner rejection
  reasons against the prior project-local proof path;
- ≤5% context reduction, a missing causal artifact, or unchanged recovery work falsifies the extra
  manifest value.

This pilot does not need a Fleet schema, mandatory hook, one-hour timeout, perceptual hashes for
non-visual work, or an owner decision before the existing T0 gate.

### Prompt and pack corrections

- “Last three envelopes” is an arbitrary context rule; MAIN should load the latest relevant
  accepted evidence selected by decision and provenance.
- “Repair once” is an arbitrary retry policy; the worker stops on its brief's falsifier or the
  portable structural-failure rule.
- Freshness cannot be created by telling an inherited session not to remember. Fleet must provide
  the fresh lane and the brief must name its allowed sources.
- Arguing against the conclusion is high-value for research, architecture, and critics, but process
  tax for every mechanical builder report.
- Grok's deterministic runner and VFX-budget packs substantially overlap Tower candidates X1 and
  X9. Input-latency/feel instrumentation remains a proposal until at least two measured transfer
  cases establish a reusable boundary. No new pack is promoted from this answer.

The smallest supported next move is unchanged: Studio MAIN completes the evidence repairs,
integration, and fresh C1 review, then presents T0. If the owner promotes an engine spike at T0,
that spike carries the project-local run-manifest pilot.
