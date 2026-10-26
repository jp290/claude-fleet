// Context packs are metadata pointers into existing sources, never a second knowledge store.
// The vocabularies are closed here so manifests and pure consumers share the same finite sets.

// The last two scopes exist for packs a TARGET repository declares about itself in its tracked
// manifest. Fleet never authors or stores their content; it only carries the pointer.
export const CONTEXT_PACK_SCOPES = [
  "portable-core", "verify-e2e", "land-mechanics", "task-queue", "harness-adapter", "private-deploy",
  "repo-contract", "product-quality", "konzept",
] as const;
export type ContextPackScope = (typeof CONTEXT_PACK_SCOPES)[number];

export const CONTEXT_PACK_AUDIENCES = ["agent", "user", "maintainer", "private-ops"] as const;
export type ContextPackAudience = (typeof CONTEXT_PACK_AUDIENCES)[number];

export const CONTEXT_PACK_TRIGGERS = [
  "always", "verification", "landing", "harness-selection", "jev-use", "measurement",
  // Read off a card's FLAECHE by context-manifest.ts#taskContextTriggers: the work paints
  // something a person sees (`src/` or `public/`), so it is accepted in a running test instance.
  "visible-surface",
  // Passed by server.ts#BOOTSTRAP_CONTEXT_TRIGGERS only: founding sessions carry orchestration
  // guidance without any queue seed riding along (the task-queue trigger and pack are removed).
  "orchestration",
  // DER START DER ORCHESTRATORIN (TASK.md, Runde 1): reserviert für die fünf Packs in docs/packs/.
  // Keine andere Gründung trägt diesen Auslöser, damit MAIN, Lane und freie Session byte-gleich bleiben.
  "orchestrator-start",
  // DER START EINES SITZES OHNE STEHENDE ROLLE (server/sitz-wissen.ts): Branch-Session, freie Session, Sitz in
  // einem anderen Repo. `seat-start` nur im Fleet-Repo, `seat-start-any-repo` überall. Nur dieser Start trägt sie.
  "seat-start", "seat-start-any-repo",
  // EIN PACK ZUR WAHL (server/sitz-wissen.ts#bibliothekGewaehlt): er steht im Katalog eines Sitzes, kommt aber nur, wenn ihn jemand
  // im Startfenster oder an der Tür wählt; mit `statt` nimmt er beim Wählen einen anderen Pack aus der Liste.
  "seat-choice",
] as const;
export type ContextPackTrigger = (typeof CONTEXT_PACK_TRIGGERS)[number];

export const CONTEXT_PACK_HARDNESS = ["hard", "guidance"] as const;
export type ContextPackHardness = (typeof CONTEXT_PACK_HARDNESS)[number];

export const CONTEXT_PACK_HARNESSES = ["claude", "pi", "pi-zai", "pi-deepseek", "pi-zai-unfenced", "pi-unfenced", "container", "codex"] as const;
export type ContextPackHarness = (typeof CONTEXT_PACK_HARNESSES)[number];

export const CONTEXT_PACK_MODES = ["read-only", "mutating", "monitoring"] as const;
export type ContextPackMode = (typeof CONTEXT_PACK_MODES)[number];

export const CONTEXT_PACK_CAPABILITIES = [
  "tracked-source-read", "pure-validator-run", "e2e-run", "git-inspect", "task-queue-read",
  "harness-adapter-read", "private-overlay-read", "deploy-observe",
] as const;
export type ContextPackCapability = (typeof CONTEXT_PACK_CAPABILITIES)[number];

export const CONTEXT_PACK_EVIDENCE = ["tree-anchor", "private-content-hash"] as const;
export type ContextPackEvidence = (typeof CONTEXT_PACK_EVIDENCE)[number];

export const CONTEXT_PACK_STATUSES = ["active", "superseded", "retired"] as const;
export type ContextPackStatus = (typeof CONTEXT_PACK_STATUSES)[number];

export const CONTEXT_PACK_GROUPS = ["grundlagen", "pruefen-landen", "sessions-fuehren", "vor-arbeiten"] as const;
export type ContextPackGroup = (typeof CONTEXT_PACK_GROUPS)[number];
export const CONTEXT_PART_SORTEN = ["anleitung", "wissen"] as const;
export type ContextPartSorte = (typeof CONTEXT_PART_SORTEN)[number];
export const CONTEXT_POSITIONS = ["lane", "main", "orchestratorin"] as const;
export type ContextPosition = (typeof CONTEXT_POSITIONS)[number];
export type ContextPartOrt = "box" | "ausleihe";
export type ContextPartPositions = Readonly<Record<ContextPosition, ContextPartOrt>>;

// THE VARIANTS OF A POSITION (card 1f9834a9, docs/design/live-bau-profil-2026-10.md §2): a founding
// of a position may run in ONE named variant, chosen by its card (context-plan.ts#cardVariante). A
// variant is no fourth position and no profile list: it is a key of a pack's own `varianten` beside
// the position keys, so each pack says for itself what its Kern is under that variant, and a pack
// that names no variant plans exactly as under the plain position. Each variant belongs to exactly
// one position; under another it is refused by name in the plan, never applied.
export const CONTEXT_POSITION_VARIANTEN = ["live-bau"] as const;
export type ContextPositionVariante = (typeof CONTEXT_POSITION_VARIANTEN)[number];
export const CONTEXT_VARIANTE_POSITION: Readonly<Record<ContextPositionVariante, ContextPosition>> = { "live-bau": "lane" };
// A Zusatz whose condition names a ZEITPUNKT is not delivered at the founding but named in it: its
// parts arrive as `ausleihe` carrying the moment, and the session borrows them through
// `GET /api/self/context/<pack>` when that moment comes. The plan sets the marker on the source; an
// author never writes it (context-pack-validator.ts#SOURCE_KEYS does not take it).
export const CONTEXT_PACK_ZEITPUNKTE = ["vor-dem-land"] as const;
export type ContextPackZeitpunkt = (typeof CONTEXT_PACK_ZEITPUNKTE)[number];

export interface ContextPackSource {
  readonly path: string;
  // An identifier, heading, or symbol only. Source prose remains in the source file.
  readonly anchor: string;
  readonly id?: string;
  readonly sorte?: ContextPartSorte;
  readonly positions?: ContextPartPositions;
  /** set by the plan on a Zusatz source whose condition names a moment, never authored */
  readonly zeitpunkt?: ContextPackZeitpunkt;
}

// THE ANATOMY OF A PACK (dd549bce; owner 02.10. c99d1de0): `sources` is its KERN — always delivered
// when the ladder selects the pack. Beside it a pack MAY carry optional ZUSAETZE, each with its own
// condition; a FASSUNG, the state of the pack's text; and VARIANTEN, a Kern of its own per position.
// The plan resolves them per position (context-plan.ts#resolvePackAnatomy) and says what it chose; a
// pack that declares none of the three plans and receipts byte for byte as before. The fassung is
// carried and receipted, it does not move the ladder — `status` decides whether a pack is planned.
export const CONTEXT_PACK_FASSUNGEN = ["vorgeschlagen", "gilt", "veraltet"] as const;
export type ContextPackFassung = (typeof CONTEXT_PACK_FASSUNGEN)[number];
export const CONTEXT_PACK_ZUSAETZE_MAX = 8;
/** every named condition must hold: a trigger of the founding, the position, the harness, the
 *  founding's variant. A `zeitpunkt` is no test: it makes the Zusatz a borrow at that moment. */
export interface ContextPackBedingung {
  readonly triggers?: readonly ContextPackTrigger[];
  readonly positions?: readonly ContextPosition[];
  readonly harnesses?: readonly ContextPackHarness[];
  readonly varianten?: readonly ContextPositionVariante[];
  readonly zeitpunkt?: readonly ContextPackZeitpunkt[];
}
export interface ContextPackZusatz {
  readonly id: string;
  readonly bedingung: ContextPackBedingung;
  readonly sources: readonly ContextPackSource[];
  /** an MCP server this Zusatz brings when it is on (CONTEXT_PACK_MCP_ANSCHLUSS) */
  readonly mcp?: ContextPackMcpServer;
}

// A ZUSATZ THAT BRINGS AN MCP SERVER (tranche 3 of the anatomy; owner 08.10.: „[Zitat entfernt]“
// ). The Zusatz names ONE stdio server — a name, a command, its arguments — and nothing
// else: no env, no URL, no token, because a pack selection installs nothing and sets up no rights,
// accounts or consent. Whether the server ARRIVES is the harness's question, answered below from
// evidence per harness and never from a model name; the plan states the answer for the founding's
// harness (context-plan.ts#packMcpAnschluss). Slot.browser stays its own switch: this adds a
// server, it never turns the ambient ones on or off.
export const CONTEXT_PACK_MCP_ZUSTAENDE = ["apply", "unsupported", "not-applicable"] as const;
export type ContextPackMcpZustand = (typeof CONTEXT_PACK_MCP_ZUSTAENDE)[number];
export const CONTEXT_PACK_MCP_NAME = /^[a-z][a-z0-9-]{0,39}$/;
export interface ContextPackMcpServer {
  readonly name: string;
  readonly command: string;
  readonly args?: readonly string[];
}
const MCP_COMMAND_MAX = 256, MCP_ARGS_MAX = 32, MCP_ARG_MAX = 512;
// no control byte: the server lands single-quoted on a tmux pane line (claudeMcpConfigFlag)
const MCP_PLAIN = /^[^\u0000-\u001f\u007f]*$/;
/** The ONE shape judge of a pack's MCP server, for every door that reads one it did not build: a repo
 *  manifest's Zusatz (context-manifest.ts#packAnatomyIssues) and a slot's persisted selection
 *  (fleet.json, Slot.packMcp). A copy with exactly the three keys, or the reason it is refused. */
export function contextPackMcpServerOf(value: unknown): { ok: true; server: ContextPackMcpServer } | { ok: false; error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, error: "mcp must be { name, command, args? }" };
  const v = value as Record<string, unknown>;
  const unknown = Object.keys(v).filter((key) => key !== "name" && key !== "command" && key !== "args");
  if (unknown.length) return { ok: false, error: `mcp: unknown key ${unknown[0]} (no env, URL or token — a pack installs nothing)` };
  if (typeof v.name !== "string" || !CONTEXT_PACK_MCP_NAME.test(v.name)) return { ok: false, error: "mcp.name must match ^[a-z][a-z0-9-]{0,39}$" };
  if (typeof v.command !== "string" || !v.command || v.command.length > MCP_COMMAND_MAX || !MCP_PLAIN.test(v.command))
    return { ok: false, error: `mcp.command must be 1..${MCP_COMMAND_MAX} characters without control bytes` };
  if (v.args !== undefined && (!Array.isArray(v.args) || v.args.length > MCP_ARGS_MAX
    || v.args.some((arg) => typeof arg !== "string" || arg.length > MCP_ARG_MAX || !MCP_PLAIN.test(arg))))
    return { ok: false, error: `mcp.args must be at most ${MCP_ARGS_MAX} strings of at most ${MCP_ARG_MAX} characters without control bytes` };
  return { ok: true, server: { name: v.name, command: v.command, ...(v.args !== undefined ? { args: [...(v.args as string[])] } : {}) } };
}
// EVIDENCE PER HARNESS, read 2026-10-09 off the installed binaries' own help. A harness this table
// does not name is `unsupported` with "nicht belegt" — silence is never an `apply`.
export const CONTEXT_PACK_MCP_ANSCHLUSS: Readonly<Partial<Record<ContextPackHarness, { readonly zustand: ContextPackMcpZustand; readonly beleg: string }>>> = {
  claude: { zustand: "apply", beleg: "claude --help (2.1.295): --mcp-config laedt MCP-Server aus JSON-Strings, --strict-mcp-config nur diese; "
    + "der Server wird mitgegeben: der Slot haelt die Auswahl (Slot.packMcp), jeder Spawn (open, heal, restart, wake) traegt sie "
    + "als --mcp-config (agentCmd), eine Textlane hinter --strict-mcp-config; nichts in ~/.claude geschrieben" },
  codex: { zustand: "unsupported", beleg: "codex --help (codex-cli 0.160.0): -c koennte mcp_servers.<name> je Start setzen, "
    + "aber der Fleet-Adapter traegt keinen Pack-Server auf seiner Zeile" },
  pi: { zustand: "unsupported", beleg: "pi mcp --help (pi 1.0.2): MCP-Server nur aus ~/.pi/agent/mcp.json oder .pi/mcp.json, kein Startflag; "
    + "ein Pack installiert nichts" },
  "pi-zai": { zustand: "unsupported", beleg: "pi mcp --help (pi 1.0.2): nur mcp.json, kein Startflag; pi-zai startet mit --no-approve "
    + "und liest kein .pi/mcp.json des Projekts, sein Agent-Verzeichnis beschreibt ein Pack nicht" },
  // Owner 2026-10-26: the open GLM seat is the same Pi/provider wiring as pi-zai without the fence,
  // so Pi's MCP facts do not change with the fence either. Named on purpose: silence would only say
  // "nicht belegt" and hide that this adapter was judged at all.
  "pi-zai-unfenced": { zustand: "unsupported", beleg: "pi mcp --help (pi 1.0.2): nur mcp.json, kein Startflag; pi-zai-unfenced startet mit --no-approve "
    + "und liest kein .pi/mcp.json des Projekts, sein Agent-Verzeichnis beschreibt ein Pack nicht" },
  // Owner 2026-10-26, stage 2: pi-deepseek is pi on another provider BEHIND pi-zai's fence. Pi's MCP
  // facts are a fact about pi (mcp.json, no start flag, --no-approve), not about the provider or the
  // fence, so the answer is pi-zai's. Named rather than left silent: silence would only say "nicht
  // belegt" and hide that this adapter was judged at all.
  "pi-deepseek": { zustand: "unsupported", beleg: "pi mcp --help (pi 1.0.2): nur mcp.json, kein Startflag; pi-deepseek startet mit --no-approve "
    + "und liest kein .pi/mcp.json des Projekts, sein Agent-Verzeichnis beschreibt ein Pack nicht" },
};
export interface ContextPackVariante {
  readonly sources: readonly ContextPackSource[];
  readonly useWhen?: string;
}
export type ContextPackVarianten = Readonly<Partial<Record<ContextPosition | ContextPositionVariante, ContextPackVariante>>>;

export function contextPartId(packId: string, source: Pick<ContextPackSource, "id">, index: number): string {
  const id = source.id ?? `source-${index + 1}`;
  return id.startsWith(`${packId}.`) ? id : `${packId}.${id}`;
}

interface ContextPackBase {
  readonly id: string;
  // One human line of PURPOSE — when a reader needs this pack, never what it says. The anchor block
  // renders it beside the pointer so a lane can decide whether to follow it; source prose stays in
  // the source file, which is why the content firewall applies to this field like any other.
  readonly useWhen: string;
  readonly group?: ContextPackGroup;
  readonly scope: ContextPackScope;
  readonly audience: ContextPackAudience;
  readonly triggers: readonly ContextPackTrigger[];
  readonly hardness: ContextPackHardness;
  readonly requiredCapabilities: readonly ContextPackCapability[];
  readonly harnesses: readonly ContextPackHarness[];
  readonly modes: readonly ContextPackMode[];
  readonly estimatedBytes: number;
  readonly evidence: ContextPackEvidence;
  readonly owner: "owner";
  readonly status: ContextPackStatus;
  readonly supersedes?: string;
  /** nur mit dem Auslöser seat-choice: wer diesen Pack wählt, bekommt den hier genannten nicht (eine Variante, kein Nachfolger) */
  readonly statt?: string;
  readonly fassung?: ContextPackFassung;
}

export interface PublicContextPack extends ContextPackBase {
  readonly audience: Exclude<ContextPackAudience, "private-ops">;
  readonly sources: readonly ContextPackSource[];
  readonly zusaetze?: readonly ContextPackZusatz[];
  readonly varianten?: ContextPackVarianten;
  readonly sourceHash?: string;
  readonly observedAt?: string;
}

export interface PrivateContextPack extends ContextPackBase {
  readonly audience: "private-ops";
  readonly privateSourceId: string;
  readonly sourceHash: string;
  readonly observedAt: string;
  readonly sources?: never;
}

export type ContextPack = PublicContextPack | PrivateContextPack;

const ALL_HARNESSES = CONTEXT_PACK_HARNESSES;
const ALL_MODES = CONTEXT_PACK_MODES;
const AUSLEIHE = { lane: "ausleihe", main: "ausleihe", orchestratorin: "ausleihe" } as const;
// THE CONTRACT TRAVELS WHOLE (Befund F3, docs/messungen/2026-10-10-kontext-bestandteile.md): since
// f91136eb no Claude role loads the repo AGENTS.md natively, and a pointer to the section was read in
// 0 of 38 lane transcripts — so every position carries it inline, as Codex and Pi already do.
// THE LANE CONTRACT LIVES IN FLEET'S OWN FOLDER (Umstieg B1): the sections the server reads moved out of
// the repo AGENTS.md verbatim, headings unchanged, so every anchor below names the same section.
const LANE_CONTRACT = ".fleet/vertraege/lane.md";
const CONTRACT_BOX = { lane: "box", main: "box", orchestratorin: "box" } as const;
const VERIFY_BOX = { lane: "box", main: "box", orchestratorin: "ausleihe" } as const;
const VERIFY_KERN = { id: "verify-e2e.kern", path: LANE_CONTRACT, anchor: "### Kern", sorte: "anleitung", positions: VERIFY_BOX } as const;
const VERIFY_LANE = { id: "verify-e2e.lane", path: LANE_CONTRACT, anchor: "### Lane", sorte: "anleitung", positions: { ...AUSLEIHE, lane: "box" } } as const;
const VERIFY_MAIN = { id: "verify-e2e.main", path: LANE_CONTRACT, anchor: "### MAIN", sorte: "anleitung", positions: { ...AUSLEIHE, main: "box" } } as const;
const VERIFY_MORE = { id: "verify-e2e.more", path: LANE_CONTRACT, anchor: "### More", sorte: "anleitung", positions: AUSLEIHE } as const;
const VERIFY_GATE_VS_AUDIT = { id: "verify-e2e.gate-vs-audit", path: "docs/verify-tiering.md", anchor: "### 6.0 gate-vs-audit — What each buys", sorte: "wissen", positions: { ...AUSLEIHE, main: "box" } } as const;
const VERIFY_PROPORTION = { id: "verify-e2e.proportion", path: "docs/verify-tiering.md", anchor: "### 6.0b proportion — Docs-only gate and audit", sorte: "wissen", positions: AUSLEIHE } as const;

// Fleet seeds stay small. Public sources carry only tracked path + exact anchor metadata;
// the private overlay carries only an opaque reference, content hash, and observation time.
// `estimatedBytes` is what a reader pulls by FOLLOWING the pointers (each anchor's section to the
// next heading of its level), not what is delivered — the founding window shows it as the
// "Lesestoff hinter den Zeigern". Re-measured 2026-10-01 against main@0697f792; nothing checks it
// against the sources, so a moved section makes it drift again.
export const CONTEXT_PACKS = [
  {
    id: "portable-core",
    group: "grundlagen",
    useWhen: "Read first, always: the vocabulary and the hard invariants that bind every session in this tree.",
    scope: "portable-core",
    audience: "agent",
    triggers: ["always"],
    hardness: "hard",
    sources: [{ id: "portable-core.contract", path: LANE_CONTRACT, anchor: "## Portable operating contract", sorte: "anleitung", positions: CONTRACT_BOX }],
    // THE REPORT RULES TRAVEL WITH A CLAUDE LANE (Charge 4): a lane writes the report, so its file
    // carries the lane contract's ## Reporting inline, read at the lane's head like the contract. Only a Claude
    // lane: a MAIN and the Orchestratorin plan as before, and a Codex or Pi file is left as it was.
    zusaetze: [{ id: "reporting", bedingung: { positions: ["lane"], harnesses: ["claude"] },
      sources: [{ id: "portable-core.reporting", path: LANE_CONTRACT, anchor: "## Reporting", sorte: "anleitung", positions: { ...AUSLEIHE, lane: "box" } }] }],
    requiredCapabilities: ["tracked-source-read"],
    harnesses: ALL_HARNESSES,
    modes: ALL_MODES,
    estimatedBytes: 10335,
    evidence: "tree-anchor",
    owner: "owner",
    status: "active",
  },
  {
    id: "verify-e2e",
    group: "pruefen-landen",
    useWhen: "When you need to prove your change holds: which proof is enough when, and what the gate really runs.",
    scope: "verify-e2e",
    audience: "agent",
    triggers: ["verification"],
    hardness: "hard",
    sources: [VERIFY_KERN, VERIFY_LANE, VERIFY_MAIN, VERIFY_MORE, VERIFY_GATE_VS_AUDIT, VERIFY_PROPORTION],
    // LIVE-BAU (card 1f9834a9): a lane building while the owner clicks through its test instance
    // carries no verify ceremony in its text. Its Kern is the four parts a lane borrows anyway; Kern
    // and Lane come as the Zusatz "vor dem Land" — named in the founding, borrowed on the owner's
    // word to land. Without the variant none of this is in the plan (context-plan.ts#resolvePackAnatomy).
    varianten: { "live-bau": { sources: [VERIFY_MAIN, VERIFY_MORE, VERIFY_GATE_VS_AUDIT, VERIFY_PROPORTION],
      useWhen: "Before landing, on the owner's word: which proof is enough and what the gate really runs." } },
    zusaetze: [{ id: "vor-dem-land", bedingung: { varianten: ["live-bau"], zeitpunkt: ["vor-dem-land"] }, sources: [VERIFY_KERN, VERIFY_LANE] }],
    requiredCapabilities: ["tracked-source-read", "pure-validator-run"],
    harnesses: ALL_HARNESSES,
    modes: ["read-only", "mutating"],
    estimatedBytes: 11591,
    evidence: "tree-anchor",
    owner: "owner",
    status: "active",
  },
  {
    id: "jev-use",
    group: "vor-arbeiten",
    useWhen: "When the task involves Jev: read how it is used and where it sits in the attribute topology.",
    scope: "product-quality",
    audience: "agent",
    triggers: ["jev-use"],
    hardness: "guidance",
    sources: [{ id: "jev-use.verwendungsform", path: "docs/jev.md", anchor: "## How Jev is used", sorte: "wissen", positions: AUSLEIHE }],
    requiredCapabilities: ["tracked-source-read"],
    harnesses: ALL_HARNESSES,
    modes: ["read-only", "mutating"],
    estimatedBytes: 3344,
    evidence: "tree-anchor",
    owner: "owner",
    status: "active",
  },
  {
    id: "land-mechanics",
    group: "pruefen-landen",
    useWhen: "Before you land a lane or touch the landing path: what really moves at a land.",
    scope: "land-mechanics",
    audience: "maintainer",
    triggers: ["landing"],
    hardness: "hard",
    sources: [
      { id: "land-mechanics.landing", path: LANE_CONTRACT, anchor: "## Landing", sorte: "anleitung", positions: AUSLEIHE },
      { id: "land-mechanics.doc", path: "docs/land-mechanics.md", anchor: "# Landing a lane — what actually moves, and how to know before you press it", sorte: "anleitung", positions: AUSLEIHE },
    ],
    requiredCapabilities: ["tracked-source-read", "git-inspect"],
    harnesses: ["claude", "pi-unfenced"],
    modes: ["read-only", "mutating"],
    estimatedBytes: 9900,
    evidence: "tree-anchor",
    owner: "owner",
    status: "active",
  },
  {
    id: "harness-adapter",
    group: "sessions-fuehren",
    useWhen: "When you choose a harness or touch the adapter contract: probe sets and automation limits.",
    scope: "harness-adapter",
    audience: "maintainer",
    triggers: ["harness-selection"],
    hardness: "hard",
    sources: [
      { id: "harness-adapter.harnesses", path: "server.ts", anchor: "const HARNESSES: readonly Harness[] =", sorte: "anleitung", positions: AUSLEIHE },
      { id: "harness-adapter.container", path: "docs/container.md", anchor: "## The `container` harness — a different cut, not that one", sorte: "anleitung", positions: AUSLEIHE },
    ],
    requiredCapabilities: ["tracked-source-read", "harness-adapter-read"],
    harnesses: ALL_HARNESSES,
    modes: ["read-only", "mutating"],
    estimatedBytes: 13696,
    evidence: "tree-anchor",
    owner: "owner",
    status: "active",
  },
  {
    // THE KONZEPT OF CLAUDE FLEET (Program Konzeptgedaechtnis 31aa88ea, Schnitt 4): the owner-accepted
    // konzeptsicht, delivered to every lane and MAIN of this tree as a PRIVATE pointer. The id is the
    // konzept id of the ledger under FLEET_KONZEPT_ROOT, which is what lets the brief resolve it to the
    // current fassung's local path (context-plan.ts#resolvePrivatePack); the hash pins the Sicht v2
    // named in docs/messungen/2026-09-26-s4-pilot-konzeptsicht-claude-fleet.md. ONLY claude and codex
    // (owner disposition 804bc34a, answer fde70070): the konzept release and the root it is read from
    // hold for those two harnesses, NOT for GLM or any other Pi harness, so every pi-* founding omits
    // it as harness-unsupported before a path or a verdict is rendered. `container` stays out too: a
    // boxed session does not see the host's private root, and a path it cannot open is no pointer.
    id: "konzept-claude-fleet",
    group: "grundlagen",
    useWhen: "When a task has to understand what Claude Fleet is and the principles it works by.",
    scope: "konzept",
    audience: "private-ops",
    triggers: ["always"],
    hardness: "guidance",
    privateSourceId: "k-claude-fleet",
    sourceHash: "a085430ef83f317157cfc613561c99a72317cf6e129d8276843d11a956ea00dc",
    observedAt: "2026-09-29T07:30:00Z",
    requiredCapabilities: ["private-overlay-read"],
    harnesses: ["claude", "codex"],
    modes: ALL_MODES,
    estimatedBytes: 86788,
    evidence: "private-content-hash",
    owner: "owner",
    status: "active",
  },
] as const satisfies readonly ContextPack[];
