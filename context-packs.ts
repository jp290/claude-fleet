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
  "always", "verification", "landing", "harness-selection", "jev-use", "rulebook-edit", "measurement",
  // Passed by server.ts#BOOTSTRAP_CONTEXT_TRIGGERS only: founding sessions carry orchestration
  // guidance without any queue seed riding along (the task-queue trigger and pack are removed).
  "orchestration",
] as const;
export type ContextPackTrigger = (typeof CONTEXT_PACK_TRIGGERS)[number];

export const CONTEXT_PACK_HARDNESS = ["hard", "guidance"] as const;
export type ContextPackHardness = (typeof CONTEXT_PACK_HARDNESS)[number];

export const CONTEXT_PACK_HARNESSES = ["claude", "pi", "pi-zai", "pi-ox", "pi-unfenced", "container", "codex"] as const;
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

export interface ContextPackSource {
  readonly path: string;
  // An identifier, heading, or symbol only. Source prose remains in the source file.
  readonly anchor: string;
  readonly id?: string;
  readonly sorte?: ContextPartSorte;
  readonly positions?: ContextPartPositions;
}

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
}

export interface PublicContextPack extends ContextPackBase {
  readonly audience: Exclude<ContextPackAudience, "private-ops">;
  readonly sources: readonly ContextPackSource[];
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
const VERIFY_BOX = { lane: "box", main: "box", orchestratorin: "ausleihe" } as const;

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
    useWhen: "Immer zuerst: das Vokabular und die harten Invarianten, die jede Session in diesem Baum binden.",
    scope: "portable-core",
    audience: "agent",
    triggers: ["always"],
    hardness: "hard",
    sources: [{ id: "portable-core.contract", path: "AGENTS.md", anchor: "## Portable operating contract", sorte: "anleitung", positions: AUSLEIHE }],
    requiredCapabilities: ["tracked-source-read"],
    harnesses: ALL_HARNESSES,
    modes: ALL_MODES,
    estimatedBytes: 7900,
    evidence: "tree-anchor",
    owner: "owner",
    status: "active",
  },
  {
    id: "verify-e2e",
    group: "pruefen-landen",
    useWhen: "Wenn du beweisen willst, dass deine Aenderung traegt: welcher Beweis wann genuegt und was das Gate wirklich faehrt.",
    scope: "verify-e2e",
    audience: "agent",
    triggers: ["verification"],
    hardness: "hard",
    sources: [
      { id: "verify-e2e.kern", path: "AGENTS.md", anchor: "### Kern", sorte: "anleitung", positions: VERIFY_BOX },
      { id: "verify-e2e.lane", path: "AGENTS.md", anchor: "### Lane", sorte: "anleitung", positions: { ...AUSLEIHE, lane: "box" } },
      { id: "verify-e2e.main", path: "AGENTS.md", anchor: "### MAIN", sorte: "anleitung", positions: { ...AUSLEIHE, main: "box" } },
      { id: "verify-e2e.more", path: "AGENTS.md", anchor: "### More", sorte: "anleitung", positions: AUSLEIHE },
      { id: "verify-e2e.gate-vs-audit", path: "docs/verify-tiering.md", anchor: "### 6.0 gate-vs-audit — What each buys", sorte: "wissen", positions: { ...AUSLEIHE, main: "box" } },
      { id: "verify-e2e.proportion", path: "docs/verify-tiering.md", anchor: "### 6.0b proportion — Docs-only gate and audit", sorte: "wissen", positions: AUSLEIHE },
    ],
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
    useWhen: "Wenn die Aufgabe Jev betrifft: die Verwendungsform und ihre Stelle in der Attribut-Topologie lesen.",
    scope: "product-quality",
    audience: "agent",
    triggers: ["jev-use"],
    hardness: "guidance",
    sources: [{ id: "jev-use.verwendungsform", path: "docs/jev.md", anchor: "## Verwendungsform", sorte: "wissen", positions: AUSLEIHE }],
    requiredCapabilities: ["tracked-source-read"],
    harnesses: ALL_HARNESSES,
    modes: ["read-only", "mutating"],
    estimatedBytes: 3500,
    evidence: "tree-anchor",
    owner: "owner",
    status: "active",
  },
  {
    id: "land-mechanics",
    group: "pruefen-landen",
    useWhen: "Bevor du eine Lane landest oder den Land-Pfad anfasst: was sich beim Land wirklich bewegt.",
    scope: "land-mechanics",
    audience: "maintainer",
    triggers: ["landing"],
    hardness: "hard",
    sources: [
      { id: "land-mechanics.landing", path: "AGENTS.md", anchor: "## Landing", sorte: "anleitung", positions: AUSLEIHE },
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
    useWhen: "Wenn du einen Harness auswaehlst oder den Adapter-Kontrakt anfasst: Probe-Mengen und Automations-Grenzen.",
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
    estimatedBytes: 4600,
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
    useWhen: "Wenn eine Aufgabe verstehen muss, was Claude Fleet ist und nach welchen Prinzipien es arbeitet.",
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
