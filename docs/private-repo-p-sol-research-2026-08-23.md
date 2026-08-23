# SOL-PI research: smallest serious iOS Product Studio (2026-08-23)

**Status:** docs-only recommendation. No Xcode, runtime, app, MCP server, desktop app, account,
permission, signing identity, Program, task, land, or deployment was created or changed by this
research. Terms below are deliberate: **OBSERVED** is directly measured on this host or read from a
named source; **INFERRED** follows from those observations; **PROPOSED** is a design; **UNKNOWN** is an
unsettled fact.

## Decision

**PROPOSED — start with full Xcode 26.6 plus one iOS Simulator runtime, driven only by
repo-local wrappers around Apple CLI tools.** Use `xcodebuild`, `xcrun simctl`, `xcresulttool`,
XCTest/XCUIAutomation, unified logging, and SourceKit-LSP. Keep one serial Simulator lease and one
writable Builder lane. A fresh read-only Critic must exercise the real UI path and inspect the actual
captures before Program-MAIN raises one `review-ready` owner gate. This is the smallest stack that can
produce a genuinely runnable Simulator review without adding another Fleet role, queue, event bus,
agent app, MCP package, or broad macOS screen-control grant.

The owner gives the product idea and then hears from MAIN only at:

1. a runnable, honestly labelled `agent-hands-on` Simulator review boundary; or
2. an authority incident involving credentials, spend, irreversible/public effect, signing/device
   trust, submission/deployment, provenance, or a blocked bounded repair.

Owner confirmation/promotion and land remain owner acts today. That is product authority, not ordinary
supervision. **PROPOSED later, not required by this stack:** bounded MAIN conflict repair and guarded
self-land may remove the land click only after their separate owner-promoted policy and server gate
exist. Nothing in the pilot depends on them.

**Current blocker:** this host cannot run the proposal. Full Xcode, `simctl`, an iOS runtime, and first
launch are absent; current free storage is not yet proven sufficient.

## 1. Contract and staging truth

### What exists and what does not

**OBSERVED in the Fleet tree and held Product-Studio lane:**

- The four levels remain Fleet Controller, Project MAIN, Worker, and Supervisor. iOS is an evidence
  overlay, not a fifth role or a separate scheduler.
- A bound MAIN may create capped own-Program pending tasks and separately release them; release does
  not dispatch. A Worker owns its brief/write set and returns only
  `complete | needs-main | failed` through `POST /api/self/fleet-report`. MAIN reaches the owner through
  `POST /api/self/attention`. A lane cannot release, watch, land, or raise owner attention.
- `GET /api/self/program-execution`, typed FleetEvents, lane outcomes, watches, attention, and
  succession already exist. `fleet-report` is advisory and pruned; it never changes task status.
- A Supervisor reads `GET /api/self/supervisor-view`, completes a Controller's one-shot transition
  watch, and nudges a bound MAIN. It has no owner route and is not a command level.
- The owner-specified held (not yet landed here) `docs/product-studio-working-circle.md` labels the
  corrected pre-owner loop a promoted workflow correction: anchor or explicit waiver → tiny real
  playable/useful slice →
  independent hands-on sensory critic through actual controls → at most two named-defect repair rounds
  → durable one-step launch → owner. Research without a named consumer and consumption edge is deferred,
  not accumulated.
- Current harness registry entries are `claude`, `pi`, `pi-zai`, `pi-ox`, `pi-unfenced`, `container`,
  and `codex`. Adapter declarations are: `claude`, `pi`, `pi-ox`, and `codex` automatable; `pi-zai`,
  `pi-unfenced`, and `container` not automatable. Foreign adapters additionally require the operator's
  fleet-wide automation flag; **OBSERVED** the live server currently starts with that flag enabled.
  Pi-family sessions have no Fleet transcript worker return channel, and the Pi/Z.ai image path is not
  proven. `pi-ox`'s catalog says image input, but its end-to-end image path is explicitly unknown.
  Current code outranks older profile prose.

**Staged architecture — do not collapse these into live behavior:**

| Stage | Status on this tree | Meaning for Private-repo-p |
|---|---|---|
| Existing rails | **OBSERVED live** | Tasks, lane isolation, reports, attention, events, outcomes, Program execution view, Supervisor view, succession, owner land gate. The existing report receiver can still refuse a Program-bound report when multiple watchers create ambiguity. |
| Structure A — state answer | **PROPOSED in the landed implementation brief; not live** | A pure derived `READY/RUNNING/REVIEWABLE/INTEGRATING/OWNER_GATE/CONTINUE/UNKNOWN` projection over task, lane, merge, open-attention, and durable outcome facts. It must not read prunable report text or become an actuator. |
| Structure B — deterministic return path | **PROPOSED in the landed implementation brief; not live** | Resolve a Program-bound Worker's report to its bound MAIN before considering lane watches, retain strict ambiguity refusal for Program-less lanes, and append a lifecycle footer requiring commit → typed report → idle. |
| Guarded MAIN repair/self-land | **Later proposal, explicitly outside Structures A/B** | MAIN reviews the diff and evidence, may request ordinary bounded repair, and only under a separately owner-written per-Program policy may call a guarded land route. No tick auto-land, Worker land, red override, conflict acceptance, or deploy. The current server still has one owner-gated `mergeJob` call site. |

The program-state implementation brief intentionally split A/B from the land door. The earlier
calibration also says no self-land or automatic promotion. **INFERRED:** self-land is a candidate staged
authority change, not promised roadmap truth. If its later review does not converge, this Studio still
works with owner promotion and owner land.

### Event-first, not pane-first

**PROPOSED:** MAIN waits on existing lane/merge/audit events and Structure A when available. Until A/B
land, it reads current typed views plus the Worker's report and names report delivery as `UNKNOWN` if the
route refuses; it does not substitute `capture-pane`. The Supervisor watches terminal transitions,
contradictions, questions, and deadlines; it sends one nudge to MAIN only on a named exception. A
successor commits `HANDOFF.md`, calls succession, reconstructs mechanical position from views/outcomes,
and reads the tracked anchor, manifest, and critic verdict for semantic position. Report text and pane
history are never the sole state store.

## 2. Host readiness

### Local observation, no mutation

| Surface | 2026-08-23 observation | Consequence |
|---|---|---|
| Host | **OBSERVED** macOS 26.3.1 (`25D771280a`), arm64 | Compatible with stable Xcode 26.6, whose Apple matrix requires macOS 26.2 or later. Xcode 27 beta 5 requires macOS 26.4 and is therefore not compatible with this host today. |
| Full Xcode | **OBSERVED absent** under `/Applications/Xcode*.app` | No iOS app build, Simulator, XCUITest, `xcresulttool`, or Apple Xcode MCP proof is possible. |
| Active developer directory | **OBSERVED** `/Library/Developer/CommandLineTools` | `/usr/bin/xcodebuild` is only a shim and refuses: full Xcode is required. Do not report the shim as a usable tool. |
| CLT | **OBSERVED** package 26.2, 2.7 GB | Swift 6.2.3, `swiftc`, Clang, LLDB, SourceKit-LSP, `xcrun`, `xcode-select`, and `devicectl` are present. This can prove SwiftPM/macOS logic, not an iOS UI loop. Updates 26.5 and 26.6 were listed but not installed. |
| Simulator | **OBSERVED** no `simctl`, no CoreSimulator directory, no runtime/device inventory | A runtime is not merely unselected; the Simulator substrate is absent. |
| Result tools/MCP | **OBSERVED** `xcresulttool` and `xcrun mcpbridge` absent | Both arrive only across the full-Xcode/first-launch boundary. |
| Optional third-party tools | **OBSERVED absent:** `xcbeautify`, Tuist, XcodeGen, Maestro, idb | None is needed for the pilot. |
| ChatGPT | **OBSERVED** no `/Applications/ChatGPT*.app` | Work with Apps and Computer Use are unavailable locally. |
| Storage | **OBSERVED** APFS capacity 245.1 GB, 217.5 GB in use, 27.6 GB unallocated; Data volume 88% used | Capacity is a real preflight gate. |
| Xcode catalog payload | **OBSERVED from Apple's App Store lookup:** Xcode 26.6, minimum macOS 26.2, `fileSizeBytes=2,351,343,377` (~2.35 GB) | This is the catalog transfer size, **not** installed Xcode + staging + runtime + DerivedData. |
| Installed/runtime size | **UNKNOWN** until the installer and Xcode Components UI report it | Apple documents that runtimes are independently managed and that Components shows recoverable storage, but publishes no fixed current total in the cited pages. Current 27.6 GB is therefore **not proven sufficient**. Do not invent a GB threshold. |
| Licence/first launch | **OBSERVED** no Xcode licence preference and no first-launch components | Owner-attended acceptance and first launch remain open. |

Apple's current system matrix lists Xcode 26.6 with iOS 26.5 SDK/Simulator support and Swift 6.3;
Xcode 26.3 would also run here, but 26.6 is the current compatible stable App Store version. Pin the
chosen Xcode path/version in the project evidence rather than silently following a future update.

### Exact prerequisite boundary

**Required before a Simulator claim:**

1. Full Apple Xcode 26.6 at a named path, signature verified.
2. Owner has reviewed/accepted Apple's Xcode licence and completed first launch.
3. `DEVELOPER_DIR=<named Xcode>/Contents/Developer xcodebuild -version` succeeds.
4. The same developer dir resolves `xcodebuild`, `simctl`, and `xcresulttool` through `xcrun`.
5. Exactly one compatible arm64 iOS Simulator runtime is installed and its actual size recorded.
6. Enough free space remains for Xcode's installer staging, that runtime, one DerivedData tree, one
   `.xcresult`, screenshots/logs, and rollback. The observed free bytes and component-reported bytes must
   be written into setup evidence; absence is `UNKNOWN`, not pass.
7. The product lives in its own git repository with a shared scheme, app target, UI-test target,
   repo-local wrappers, ignored run-artifact root, and no untracked files at land time.

A Simulator-only pilot does **not** require an Apple Developer account, development team, physical
device, App Store Connect, or App Store signing. Apple's Xcode listing says an Apple Account is required
to test/run on an Apple **device**, and Developer Program membership is required to submit to the App
Store. Those are later gates, not reasons to sign in during Simulator setup.

## 3. Native Apple surfaces

### CLI-first proof stack

| Surface | Classification | Serious minimum use |
|---|---|---|
| `xcodebuild` | **apply** after Xcode | List the shared scheme; build for a specific Simulator destination; run unit/UI tests with `-resultBundlePath`; keep DerivedData under the run root; record toolchain, SDK, destination, exits, and the literal command. It supports build, query, analyze, test, archive, `build-for-testing`, and `test-without-building`. |
| `xcrun simctl` | **apply** after first launch/runtime | Create a uniquely named device, boot and wait, install, launch/terminate, capture a PNG, collect process logs, then shut down/delete that exact UDID. It is lifecycle/capture plumbing, not a general touch driver. |
| `xcresulttool` | **apply** | Read machine summaries with `get test-results summary`, tests/details/activities, content availability, logs, and exported attachments. Do not use the deprecated legacy object API for new wrappers. |
| XCTest / XCUIAutomation | **apply** | XCTest proves logic and hosts UI tests. XCUIAutomation launches/monitors/terminates the app, queries element state and accessibility snapshots, taps/types/swipes through the real iOS input layer, captures screenshots, and can perform an accessibility audit. This is the deterministic interaction surface. |
| SourceKit-LSP | **apply for source intelligence; not a build/test oracle** | Completion, definition, index, and Swift/C language intelligence. The official project warns that cross-module/global behavior is limited until the project is built or background indexing is enabled. |
| Accessibility Inspector GUI | **not-applicable to unattended minimum** | Useful owner/critic diagnostic, but XCUITest queries/audit and tracked identifiers provide the repeatable baseline. |
| Physical-device `devicectl`/signing | **not-applicable to Pilot 1** | Keep outside the first architecture proof. |

**PROPOSED wrapper rule:** wrappers select Xcode with a process-local `DEVELOPER_DIR`; do not change the
host-wide `xcode-select` merely for Fleet. They accept an explicit runtime/device UDID, never “first
available,” and fail under their own stage name (`xcode-missing`, `licence/first-launch`,
`runtime-missing`, `boot-timeout`, `install`, `launch`, `ui-test`, `capture`, `a11y`, `log`, or
`result-parse`). Explicit destination IDs prevent a device name or “latest” runtime from becoming hidden
selection policy.

### Xcode's current coding-agent and MCP surfaces

**OBSERVED from Apple primary documentation/release notes:**

- Xcode 26.3 introduced agentic coding with Anthropic Claude Agent and OpenAI Codex, an Xcode permissions
  system, and Xcode capabilities exposed through MCP. Xcode 26.6 adds Gemini and Agent Client Protocol
  support. Xcode can also host ChatGPT/Claude chat and compatible Chat Completions providers.
- An agent selected inside Xcode automatically receives Xcode capabilities such as building and testing.
  Agent installation, account sign-in, allowed commands/tools, and plug-ins are controlled in Xcode's
  Intelligence settings.
- An **external** agent requires the GUI toggle “Allow external agents to use Xcode tools,” an open
  project in Xcode, and stdio configuration such as
  `codex mcp add xcode -- xcrun mcpbridge` or
  `claude mcp add --transport stdio xcode -- xcrun mcpbridge`. Xcode alerts when an external agent
  connects and is active.
- Xcode 26.6 release notes name a Preview Snapshot MCP tool and variant rendering (appearance,
  orientation, type size). This is a real additional Xcode-semantic/preview surface, not proof that every
  MCP client gets a stable end-to-end app test.

**What native MCP adds, quantified honestly:** one Apple-bundled stdio bridge, one Xcode GUI permission
toggle, one open-project precondition, and Xcode-owned project/tools context. Apple directly documents
project modification and actions such as build; release notes directly name Preview Snapshot. The exact
current tool count, schemas, per-tool prompt behavior, and external-agent testing coverage are
**UNKNOWN** until a post-install `tools/list`/permission canary records them. MCP does not replace
`xcodebuild` exit status, `.xcresult`, app logs, or a tracked run manifest.

**PROPOSED classification:** native Xcode MCP is an attended, reversible experiment after CLI Pilot 1,
not the default. It is useful only if the measured tool list closes a specific gap (for example, preview
variants) with less failure and permission cost. Turn off the Xcode toggle and remove the exact client
entry to roll it back. Do not place MCP client configuration in a product repo or Fleet globally without
an owner-approved security review.

### XcodeBuildMCP

**OBSERVED alternative, not Apple:** Sentry's `getsentry/XcodeBuildMCP` repository supplies a CLI and MCP
server, requires macOS 14.5+, Xcode 16+, and (for npm installation) Node 18+, runs a per-workspace daemon
for stateful operations, and reports internal runtime errors to Sentry unless configured otherwise. It
can wrap build/Simulator/test operations, but that is another package, daemon, telemetry decision, and
upgrade surface now that Apple ships `mcpbridge`.

**PROPOSED:** `unsupported` as a bundle default; `apply` only as a measured alternative if a named native
CLI/MCP deficiency survives Pilot 1. If trialled later: pin a reviewed release/checksum, never
`npx -y ...@latest`, inventory subprocess/network/telemetry behavior, opt out of telemetry where
supported, run in one disposable project, compare its manifest and failure signatures with the native
wrappers, then remove binary/config/daemon state. No adoption, price, or determinism claim is made here.

## 4. ChatGPT desktop is three different things

| Surface | Official capability | iOS testing conclusion |
|---|---|---|
| Classic “Work with Apps” | **OBSERVED:** can query Xcode/editor content via macOS Accessibility, include selected/open editor context, and propose/apply IDE diffs. It requires the app running and an account login. | **unsupported as Simulator proof.** “Can read/edit Xcode” does not mean it sees, touches, or validates the iOS Simulator. The cited Work with Apps page makes no Simulator-control claim and names Accessibility, not Screen Recording. |
| New ChatGPT desktop Codex/Work | **OBSERVED:** local projects/worktrees, files, shell actions under sandbox/approval modes, and long-running tasks after account sign-in. | **apply as a separate OpenAI coding product, unsupported as a Fleet harness today.** There is no Fleet adapter, occupant binding, typed report, event receipt, or deterministic succession contract for the app. |
| Computer Use plug-in | **OBSERVED:** in supported regions with ChatGPT Work or Codex, sees and operates allowed macOS apps; OpenAI explicitly lists testing an “iOS simulator flow” as a good fit. Requires Screen Recording to see, Accessibility to click/type/navigate, per-app approval (or owner-selected Always allow), and may ask before sensitive/disruptive actions. | **apply for attended exploratory sensory testing; unsupported as the first deterministic/unattended Fleet worker.** It cannot automate terminal apps, approve macOS security/privacy prompts, or authenticate as administrator. Files/shell still obey separate sandbox approvals. |
| Computer Use “locked use” | **OBSERVED:** optional macOS feature installs an Apple authorization plug-in participating in unlock and can temporarily unlock during an active turn. | **not-applicable and rejected for this Studio start.** It materially enlarges the host security boundary solely to keep GUI work running while locked. |
| OpenAI API computer tool | **OBSERVED:** a model returns actions for a caller-provided screenshot/action harness; OpenAI recommends an isolated browser/VM and human review for high-impact actions. | **not-applicable to the minimal stack.** Fleet would have to build and secure a new macOS/Simulator computer-use harness; the desktop app is not that API adapter. |

**INFERRED:** Computer Use can genuinely see/control Simulator when installed and granted permissions;
Work with Apps alone cannot establish that. Neither yields Apple-native test result semantics. A future
Fleet adapter would need an exact session identity, app allowlist, screenshot/action trace, interruption
and permission states, typed report/receipt, and terminal done signal before it could be called unattended.
“Always allow,” background operation, or OpenAI's separate locked-use feature does not supply those Fleet
properties.

**Recommendation:** do not install ChatGPT for Pilot 1. If the native screenshot + fresh model critic
cannot reproduce a gross visual or gesture defect, run one owner-attended Computer Use comparison with
only Simulator allowed, no browser/account settings, no locked use, and all security prompts owner-read.
Revoke the app approval and both TCC grants afterward.

## 5. Fleet-native Private-repo-p profile

### One core, thin iOS evidence overlay

```text
owner-confirmed idea / Program
  → MAIN records promoted anchor or explicit interim waiver
  → one Builder lane, one product-repo write set
  → Apple CLI run manifest at exact Builder sha
  → fresh read-only hands-on + sensory Critic on actual Simulator controls
  → ≤2 serial named-defect Builder repairs, full affected counter-check each time
  → MAIN launches the exact candidate and verifies its build stamp
  → attention(review-ready): PLAYABLE agent-hands-on <sha> <one-step-command>
  → owner taste/promotion; owner land today
```

**PROPOSED anchor grammar for a useful app idea:** named user and recurring job; one-sentence promise;
first-30-second flow; one gesture and visible consequence; one end/recovery state; one positive and one
negative territory reference; three to five `BAR / FAILS WHEN / INSTRUMENT` quality bars; privacy/offline
assumptions; explicit non-goals. If the owner's idea does not settle identity/taste, MAIN records a dated
interim waiver and a reopen trigger after first `agent-hands-on`; it does not interrupt the owner for
ordinary reversible choices or silently call the waiver promoted.

A useful first slice is rejected if it cannot name one repeated user job, one real gesture, one visible
state change, and one way a fresh user can recover/restart. This is a scope breaker, not a market score.
Market, competitor, API, or policy research gets a consuming brief and a decision edge; otherwise MAIN
defers it.

### Routing

| Act | Default route | Boundary |
|---|---|---|
| Program coherence, anchor/waiver, integration | Current strong Claude/Fable Program-MAIN | Uses existing long-context/succession path; does not perform every mechanical check itself. |
| Focused platform/product research | One bounded Sol or Opus Worker | Primary sources, `OBSERVED/INFERRED/PROPOSED/UNKNOWN`, named consumer and falsifier. |
| SwiftUI Builder + Apple wrappers | One Sol or Opus lane selected by MAIN | Exclusive ownership of app/project/scripts for the round; native CLI only; commit and typed report. Codex is automation-eligible in the current registry but has no Fleet transcript surface, so the report and git facts remain the return contract. |
| Machine interaction | XCUITest in the Builder's run | It is tooling, not another agent. It acts through accessibility/UI events, not a model replay or app-internal shortcut. |
| Fresh sensory Critic | Fresh read-only Fable lane for the first calibration | The held Studio evidence has one real Fable image-consumption path. It must actually open the before/after PNGs and cite hashes. Pi/Z.ai and Pi/Ox vision remain ineligible until their own image canary passes. |
| Operational Supervisor | Existing bound Supervisor | Event/terminal-driven view and one nudge; no pane polling, taste verdict, owner impersonation, or land. |

Do not fan out coupled app/UI changes. Parallel read-only ideas are acceptable before a direction; Builder
mutation, sensory criticism, and repair are serial.

### Deterministic state and evidence contract

Each run gets a unique `runId` and exact candidate SHA. Generated DerivedData, `.xcresult`, PNGs, and raw
logs live under a git-ignored run root; a small tracked manifest and critic verdict live in the product
repo. Before land, ignored artifacts may remain but `git status --porcelain` must contain no untracked
files.

Minimum tracked manifest fields:

- `schemaVersion`, `runId`, product repo/branch/candidate SHA and dirty count;
- `xcodePath`, `xcodebuild -version`, SDK build, host OS/arch;
- runtime identifier/build, device type, unique device name/UDID;
- shared scheme, configuration, bundle ID, test identifier;
- every ordered stage with start/end, literal argv (secrets redacted), exit, and artifact hash;
- app bundle hash/build stamp; baseline/after screenshot hashes and `seen` fact;
- `.xcresult` hash plus `xcresulttool get test-results summary` counts;
- accessibility query/audit result, exact expected state transition, and log-event cardinality;
- critic base SHA, verdict path, open defect or `none`, repair round `0..2`;
- `unknown[]` and `predicatesWithoutBreaker` (pass requires `0`).

Raw media is evidence addressed by the manifest, not source to land by default. The tracked anchor/waiver,
manifest, critic verdict with `base:`, and owner disposition are succession facts. The Worker report is a
short pointer beginning `agent-hands-on <sha>` only after it held the real controls; otherwise it says
`automaton-demo` or fails as the missing stage. Structure A may project mechanical phase but never derive
quality from this prose.

### Shared-host isolation

CoreSimulator, Xcode GUI state, caches, keychain, physical devices, and screen-control permissions are
host state, not worktree state. **PROPOSED minimum:** one host-wide atomic Simulator lease for all iOS
Studio runs; within it create a uniquely named disposable device, record only its UDID, use run-local
DerivedData/result paths, and delete only that UDID during cleanup. A process records lease ownership and
refuses a stale/ambiguous lease rather than deleting another run. Never run two iOS UI pilots merely
because they are in different lanes. Physical device and signing work are never concurrent autonomous
lanes in this profile.

## 6. Three test surfaces

| Surface | Protocol/server/client/reverse-state decision | Build → hands-on evidence | Unattended Fleet fit | Verdict |
|---|---|---|---|---|
| Apple CLI + project scripts | Protocol **not-applicable** (process/JSON/files, no MCP); Apple tools **apply**; repo wrapper/manifest **proposed apply**; reverse state comes from exit codes, `simctl` state, `.xcresult`, logs, hashes | **apply:** build/boot/install/launch via native tools; interaction/a11y via XCUITest; screenshot/log/result extraction. Arbitrary visual taste remains human/model critic, not CLI. | **apply after owner-attended Xcode/licence/runtime setup and one explicit host-write authorization.** No broad TCC screen-control grant. | **Recommended minimum.** |
| Xcode native MCP (`xcrun mcpbridge`) | MCP wire/server **apply** in full Xcode 26.3+; Claude/Codex client config **apply only after owner mutation**; Xcode GUI/open-project/alerts **apply**; exact tools and prompt reverse-state **UNKNOWN until canary** | Project modification/build and Preview Snapshot are observed; exact external test/interaction coverage **UNKNOWN**. Native CLI evidence still required. | **unsupported as default:** live GUI, toggle/config, connection/permission state, and no Fleet report adapter. Attended use is applicable. | **Second experiment only when it closes a measured gap.** |
| ChatGPT desktop / Computer Use | Work with Apps context **apply** but Simulator testing **unsupported**; Computer Use UI server/skill **apply** in supported region; Fleet adapter/report/reverse-state **unsupported** | Visual Simulator control **apply** per OpenAI; deterministic Apple result semantics **unsupported unless paired with our scripts**. Requires app and sensitive-action prompts. | **unsupported.** Account login, Screen Recording, Accessibility, app approvals; terminal automation and security prompt approval are prohibited. Locked use **not-applicable**. | **Owner-attended exploratory fallback, not bundle default.** |

## 7. Exactly one falsifiable Simulator pilot

### Pilot 1 — “Pocket Tally” one-gesture review boundary

**PROPOSED purpose:** prove the Studio rail, not market demand. Create a separate minimal SwiftUI product
repo with no third-party dependencies. The screen starts at accessible text `Count 0`; tapping one large
button `Log one` once produces `Count 1`; `Reset` returns to `Count 0`. A visible short build stamp lets
MAIN and owner distinguish candidates. The anchor bars are: first gesture obvious in 30 seconds, state
change unmistakable without color alone, controls labelled/hittable, restart obvious, no account/network.

**Single ordered run:**

1. **Build:** preflight the pinned Xcode/runtime/storage; acquire the Simulator lease; create a unique
   device; run a shared-scheme `xcodebuild build-for-testing` into run-local DerivedData and result paths.
2. **Boot:** `simctl boot <UDID>` then bounded `bootstatus <UDID> -b`.
3. **Install:** install the built `.app` by exact path; verify the bundle ID is installed.
4. **Launch:** launch with deterministic reset/build-stamp arguments; require a returned PID and exact
   `app.ready` log event.
5. **Interact:** a single named XCUITest launches through the delivered app path, asserts `Count 0`, taps
   the accessibility-identified `Log one` control once, and asserts `Count 1`; it must not call app model
   APIs or a replay endpoint.
6. **Capture:** attach pre/post screenshots, run `performAccessibilityAudit`, capture the app accessibility
   hierarchy/queried attributes, and collect bounded unified logs. `increment from=0 to=1` must occur
   exactly once.
7. **Interpret:** write `.xcresult`; use new `xcresulttool` summary/details/content-availability commands;
   write and validate the tracked manifest and all hashes.
8. **Critic:** a fresh read-only lane at the recorded base opens both PNG bytes, checks the actual flow and
   bars, records `agent-hands-on`, one perceived defect or `none`, and its own self-attack.
9. **Repair:** if a defect exists, MAIN may commission at most two serial rounds, each closing only that
   named defect and rerunning stages 1–8 plus affected counter-checks. A third round is an owner-visible
   block, not autonomous churn.
10. **Review:** MAIN runs the repo's one-step review wrapper itself against the exact final SHA, reads back
    the build stamp, and raises `review-ready` with the command, manifest, critic verdict, and three to five
    taste questions. Owner can launch and tap the genuine Simulator build; no device/signing/store step is
    implied.

**Pass is falsifiable:** exact pinned destination; one UI test passed and zero unexpected failures; observed
`0 → 1`; exactly one increment log; accessibility audit has zero unwaived issues; all required artifacts
exist and hash; Critic reports the visible `0` and `1` from the two randomly named images; no `unknown`;
`predicatesWithoutBreaker=0`; at most two repairs; clean product git state; one-step relaunch shows the same
SHA. Demonstrated breakers in the pilot branch temporarily change the accessibility identifier, suppress
the increment log, duplicate the increment, remove or undersize an accessible button so the audit must
object, and substitute the same stale PNG for both random names so capture/visual consumption must fail. A
second lease contender must fail as `simulator-lease-busy` without changing any device. Each breaker must
make its own named predicate fail before the pilot is trusted; breaker mutations are then reverted.

The app may still be aesthetically or commercially poor. Machine green and a Critic pass open the owner
gate; only the owner settles product taste and promotion.

## 8. Installation/setup checklist and rollback

### Owner-attended one-time actions

1. **Storage decision:** inspect the current App Store/developer-download transfer and installer space,
   then the exact iOS runtime size. Compare those with measured free bytes and required working/rollback
   headroom. Current 27.6 GB is `UNKNOWN`, not approval. Freeing disk is outside this brief.
2. **Acquire Xcode:** owner chooses Apple's Mac App Store or authenticated Apple Developer Downloads and
   installs the signed stable Xcode 26.6 at a named path. No beta, mirror, package manager, or similarly
   named tool. Apple account/login, if requested, is owner-only.
3. **Security check:** verify the publisher/signature with macOS Gatekeeper/code-signing tools; record
   Xcode version/path/hash or designated requirement. Review the Xcode SLA.
4. **Licence/first launch:** owner opens Xcode, accepts the licence, selects only iOS platform support, and
   permits required first-launch system components. `xcodebuild -runFirstLaunch` is allowed only while the
   owner attends any privilege/licence prompt; Apple documents that it installs required components,
   including `simctl`.
5. **Runtime approval:** owner approves exactly one arm64 iOS runtime version after seeing its size. Older
   or extra watchOS/tvOS/visionOS runtimes, Metal toolchain, device support, and coding agents are omitted.
6. **No accounts by default:** do not sign in to Xcode coding agents, ChatGPT, App Store Connect, or a
   development team for Pilot 1.
7. **No MCP/TCC by default:** leave external-agent MCP off; install no ChatGPT app; grant no Screen
   Recording, Accessibility, Files and Folders, or locked-use authorization plug-in.
8. **Pilot authorization:** separately authorize the named project wrapper to download the already chosen
   runtime if still absent and to mutate only CoreSimulator/run caches during the one pilot. This is not a
   standing permission for future runtimes.

### Downloads/actions that may be automated after those decisions

- **Safe to automate within the named authorization:** Xcode component preflight; an exact
  `xcodebuild -downloadPlatform iOS -buildVersion <approved>` (Apple supports export/import too); creation,
  boot, install, launch, test, capture, shutdown, and deletion of the pilot's exact Simulator UDID;
  run-local DerivedData/results; manifest validation and cleanup.
- **Must remain owner-attended:** Xcode acquisition/install, Apple login, licence, privileged first-launch
  prompts, GUI Components size/selection, Intelligence/MCP toggle, coding-agent/provider sign-in, MCP client
  config, ChatGPT install/login, TCC grants, Computer Use app approvals/locked use, physical-device trust or
  Developer Mode, keychain/certificate/profile access, Developer Program/App Store Connect actions.
- **Never implied by setup:** Fleet queue/Program mutation, land, deploy, archive upload, TestFlight,
  App Store submission, purchases, contracts, or public network/service creation.

### Setup proof before Pilot 1

Record, without secrets: host OS/arch/free bytes; Xcode path/version; `xcrun --find` for `simctl` and
`xcresulttool`; installed iOS runtimes/device types; selected runtime size; unsigned Simulator smoke build;
and cleanup of a disposable device. Missing output fails as `setup-unknown`.

### Rollback

- Pilot cleanup deletes only its recorded Simulator UDID, run-local DerivedData/result/media, temporary
  lease, and product worktree/repo if the owner rejects the whole experiment.
- Runtime rollback uses Xcode Components to delete the exact runtime and verifies it disappeared.
- Xcode rollback removes the named Xcode app through the owner-approved macOS path. If global
  `xcode-select` was changed despite the process-local recommendation, restore
  `/Library/Developer/CommandLineTools` and re-measure.
- Native MCP rollback disables the Xcode toggle and removes only the named `xcode` client entry.
- ChatGPT experiment rollback removes Simulator from Always Allowed, revokes Screen Recording and
  Accessibility, disables/removes Computer Use, removes any locked-use authorization plug-in through its
  supported UI, signs out, and removes the app.
- Never `rm -rf ~/Library/Developer` wholesale: it is shared host state. Measure named paths and delete
  only artifacts created by the run.

## 9. Signing, device, distribution, and external-effect gates

| Boundary | Decision |
|---|---|
| Simulator debug/test | **apply without account/signing gate** for Pilot 1; no production entitlement or device claim. |
| New bundle ID, capability, entitlement, iCloud/container, push, Sign in with Apple, external API/account | **owner gate before creation**: identity, credentials, privacy, cost, and external state. |
| Physical iPhone/iPad | **owner-attended gate:** device ownership, cable/network pairing, trust, Developer Mode, Apple Account/team, provisioning, keychain access, device data/reset. Never inferred from Simulator green. |
| Signed archive/ad hoc/internal distribution | **owner gate:** team, certificate/profile/keychain, recipients, expiry, export options, artifact destination. `archive` is not upload, but credential use still needs named authority. |
| TestFlight/App Store Connect | **owner-only external effect:** paid Developer Program where required, agreements, tax/banking, roles, API keys, privacy/export/age declarations, metadata/screenshots, pricing/territory, upload and tester/release selection. |
| Submit/release/deploy | **owner-only and separate:** build, archive, upload, submit, release, and deploy are distinct acts. No self-land policy can authorize any of them. |

## 10. `xgate`

**UNKNOWN.** No Apple developer/support/product primary source found a current iOS developer tool or
product named `xgate`; no PATH command, `/Applications` app, Homebrew formula, or global npm package by
that name is installed. Apple's App Store search returns unrelated products named XGate, and the local
filesystem has unrelated project/plugin paths with
that string. The official Xcode external-agent mechanism is named `xcrun mcpbridge`, gated by
**Xcode → Settings → Intelligence → Model Context Protocol → Allow external agents to use Xcode tools**.

**INFERRED plausible readings:** typo for Xcode, or shorthand for this Xcode external-agent gate/MCP
bridge. Neither may be silently selected. Do not install an `xgate` package.

Smallest clarification, only if the name matters beyond this recommendation: **“By `xgate`, do you mean
Xcode 26's ‘Allow external agents to use Xcode tools’ + `xcrun mcpbridge`, or a specific product URL?”**
The recommended CLI pilot does not need the answer.

## 11. Reversal observations

Any of these would reverse or materially narrow the recommendation:

1. **Storage reversal:** the signed Xcode installer + one reported iOS runtime + required staging leaves
   insufficient working/rollback space on the observed 27.6 GB. Then use a separately owner-approved
   Xcode host or free storage; do not squeeze this host or omit evidence.
2. **Determinism reversal:** three same-tree Pilot 1 runs produce inconsistent UI state, log cardinality,
   or `.xcresult` outcomes after exact device/runtime reset. Then the wrapper/device isolation is not a
   serious test surface; fix it before adding MCP or agents.
3. **Shared-state reversal:** another iOS run changes the selected runtime/device or contaminates captures
   despite the lease. Then one host-wide lease is insufficient; move to a dedicated host/device set rather
   than parallel lanes.
4. **Critic reversal:** in three consecutive slices, the owner's first usability complaint was absent from
   the fresh `agent-hands-on` verdict. Then the Critic is not a proxy; change its rubric/tooling or bring the
   owner earlier rather than add more autonomous repair.
5. **Pre-owner-loop reversal:** a slice follows anchor/waiver, real controls, bounded repair, and exact
   launch yet the owner still cannot identify the promise or finds the result “very poor.” Then ordering
   bought legibility, not product quality; repair the anchor/product thesis, not the runner.
6. **MCP reversal:** a recorded Xcode 26.6 `tools/list` + permission canary shows Preview Snapshot or other
   Xcode semantics removes significant wrapper code/failure while preserving `.xcresult` and typed Fleet
   evidence. Then promote native MCP for that named operation, not wholesale.
7. **Computer Use reversal:** an attended canary repeats the same Simulator gesture/capture three times,
   exports a reviewable action trace, never asks for broad/sensitive access, and a Fleet adapter can bind
   identity/report/terminal state. Then it may become a sensory Worker; “Always allow” alone is not this
   observation.
8. **Structure A/B reversal:** the projection or program-binding-first report repair does not land, or a
   Program-bound Worker still cannot report under two watchers. Then autonomous routing remains
   `UNKNOWN`; MAIN must not claim event-complete control or self-land readiness.
9. **Self-land reversal:** later conflict repair ever accepts conflict, bypasses red/unknown, loses actor
   provenance, lands from a tick, or needs owner-token ambient use. Then retain owner-only land regardless
   of saved clicks.
10. **Platform reversal:** a required product capability cannot be tested in Simulator or requires device
    hardware/entitlements. Then stop at the Simulator evidence boundary and ask for the explicit physical
    device/signing act; do not relabel Simulator proof.

## 12. Primary sources

All URLs were read on 2026-08-23; current tool help after installation outranks examples if it differs.

- Apple, Xcode system/SDK matrix: <https://developer.apple.com/xcode/system-requirements>
- Apple App Store Xcode record (official lookup ID 497799835):
  <https://itunes.apple.com/lookup?id=497799835&country=us>
- Apple, Xcode 26.3 release notes:
  <https://developer.apple.com/documentation/xcode-release-notes/xcode-26_3-release-notes>
- Apple, Xcode 26.6 release notes:
  <https://developer.apple.com/documentation/xcode-release-notes/xcode-26_6-release-notes>
- Apple, download/install Xcode components and runtimes:
  <https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components>
- Apple, setting up coding intelligence:
  <https://developer.apple.com/documentation/xcode/setting-up-coding-intelligence>
- Apple, external agents and `mcpbridge`:
  <https://developer.apple.com/documentation/xcode/giving-external-agents-access-to-xcode>
- Apple, agent permissions/environments:
  <https://developer.apple.com/documentation/xcode/extending-and-customizing-agents>
- Apple, command-line build/test FAQ:
  <https://developer.apple.com/library/archive/technotes/tn2339/_index.html>
- Apple, running tests and `.xcresult`:
  <https://developer.apple.com/documentation/xcode/running-tests-and-interpreting-results>
- Apple, current `xcresulttool` command families (Xcode 16.3 release notes):
  <https://developer.apple.com/documentation/xcode-release-notes/xcode-16_3-release-notes>
- Apple, XCTest: <https://developer.apple.com/documentation/xctest>
- Apple, XCUIAutomation: <https://developer.apple.com/documentation/xcuiautomation>
- Apple, `XCUIApplication`: <https://developer.apple.com/documentation/xcuiautomation/xcuiapplication>
- Apple, Xcode licence: <https://www.apple.com/legal/sla/docs/xcode.pdf>
- Swift project, SourceKit-LSP: <https://github.com/swiftlang/sourcekit-lsp>
- OpenAI, Work with Apps on macOS:
  <https://help.openai.com/en/articles/10119604-work-with-apps-on-macos>
- OpenAI, current ChatGPT desktop app/account requirement:
  <https://help.openai.com/en/articles/9275200-using-the-chatgpt-macos-app>
- OpenAI, ChatGPT desktop/Codex app: <https://learn.chatgpt.com/codex/app>
- OpenAI, Computer Use in the desktop app: <https://learn.chatgpt.com/codex/computer-use>
- OpenAI, local permission modes: <https://learn.chatgpt.com/codex/permission-modes>
- OpenAI API, computer-use harness/safety boundary:
  <https://developers.openai.com/api/docs/guides/tools-computer-use>
- Sentry, XcodeBuildMCP primary repository: <https://github.com/getsentry/XcodeBuildMCP>

## Open boundary

The architecture is ready to evaluate but the host is not ready to execute it. The next act is an owner
storage/security decision for signed Xcode 26.6 plus exactly one runtime—not an app build, MCP install,
ChatGPT install, Program mutation, or queue wave. `xgate` identity can remain **UNKNOWN** because the
recommended first stack does not consume it.
