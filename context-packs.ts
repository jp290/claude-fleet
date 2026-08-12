// Context packs are metadata pointers into existing sources, never a second knowledge store.
// The vocabularies are closed here so manifests and pure consumers share the same finite sets.

export const CONTEXT_PACK_SCOPES = [
  "portable-core", "verify-e2e", "land-mechanics", "task-queue", "harness-adapter", "private-deploy",
] as const;
export type ContextPackScope = (typeof CONTEXT_PACK_SCOPES)[number];

export const CONTEXT_PACK_AUDIENCES = ["agent", "user", "maintainer", "private-ops"] as const;
export type ContextPackAudience = (typeof CONTEXT_PACK_AUDIENCES)[number];

export const CONTEXT_PACK_TRIGGERS = [
  "always", "verification", "landing", "task-queue", "harness-selection", "deployment",
] as const;
export type ContextPackTrigger = (typeof CONTEXT_PACK_TRIGGERS)[number];

export const CONTEXT_PACK_HARDNESS = ["hard", "guidance"] as const;
export type ContextPackHardness = (typeof CONTEXT_PACK_HARDNESS)[number];

export const CONTEXT_PACK_HARNESSES = ["claude", "pi", "pi-unfenced", "container", "codex"] as const;
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

export interface ContextPackSource {
  readonly path: string;
  // An identifier, heading, or symbol only. Source prose remains in the source file.
  readonly anchor: string;
}

interface ContextPackBase {
  readonly id: string;
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

// Six deliberately small seeds. Public sources carry only tracked path + exact anchor metadata;
// the private overlay carries only an opaque reference, content hash, and observation time.
export const CONTEXT_PACKS = [
  {
    id: "portable-core",
    scope: "portable-core",
    audience: "agent",
    triggers: ["always"],
    hardness: "hard",
    sources: [{ path: "AGENTS.md", anchor: "## Portable operating contract" }],
    requiredCapabilities: ["tracked-source-read"],
    harnesses: ALL_HARNESSES,
    modes: ALL_MODES,
    estimatedBytes: 3800,
    evidence: "tree-anchor",
    owner: "owner",
    status: "active",
  },
  {
    id: "verify-e2e",
    scope: "verify-e2e",
    audience: "agent",
    triggers: ["verification"],
    hardness: "hard",
    sources: [
      { path: "AGENTS.md", anchor: "## Verify" },
      { path: "docs/verify-tiering.md", anchor: "## 6. Pre-land gate vs post-land audit — what each buys that the other cannot" },
    ],
    requiredCapabilities: ["tracked-source-read", "pure-validator-run"],
    harnesses: ALL_HARNESSES,
    modes: ["read-only", "mutating"],
    estimatedBytes: 5200,
    evidence: "tree-anchor",
    owner: "owner",
    status: "active",
  },
  {
    id: "land-mechanics",
    scope: "land-mechanics",
    audience: "maintainer",
    triggers: ["landing"],
    hardness: "hard",
    sources: [
      { path: "AGENTS.md", anchor: "## Landing" },
      { path: "docs/land-mechanics.md", anchor: "# Landing a lane — what actually moves, and how to know before you press it" },
    ],
    requiredCapabilities: ["tracked-source-read", "git-inspect"],
    harnesses: ["claude", "pi-unfenced"],
    modes: ["read-only", "mutating"],
    estimatedBytes: 4300,
    evidence: "tree-anchor",
    owner: "owner",
    status: "active",
  },
  {
    id: "task-queue",
    scope: "task-queue",
    audience: "maintainer",
    triggers: ["task-queue"],
    hardness: "hard",
    sources: [{
      path: "docs/plan-queue-refinement-2026-08-11.md",
      anchor: "# Plan: Queue-Refinement-System + Task-Dashboard (2026-08-11)",
    }],
    requiredCapabilities: ["tracked-source-read", "task-queue-read"],
    harnesses: ALL_HARNESSES,
    modes: ["read-only", "mutating", "monitoring"],
    estimatedBytes: 3500,
    evidence: "tree-anchor",
    owner: "owner",
    status: "active",
  },
  {
    id: "harness-adapter",
    scope: "harness-adapter",
    audience: "maintainer",
    triggers: ["harness-selection"],
    hardness: "hard",
    sources: [
      { path: "server.ts", anchor: "const HARNESSES: readonly Harness[] =" },
      { path: "docs/container.md", anchor: "## The `container` harness — a different cut, not that one" },
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
    id: "private-deploy-overlay",
    scope: "private-deploy",
    audience: "private-ops",
    triggers: ["deployment"],
    hardness: "hard",
    privateSourceId: "opaque-3f4c19d8a6e2b701",
    sourceHash: "0e0ca068c46bd02cf825d853ba76d8e8121826b591a1ad6bc86b778781e0cc57",
    observedAt: "2026-08-12T08:52:35Z",
    requiredCapabilities: ["private-overlay-read", "deploy-observe"],
    harnesses: ["claude", "pi-unfenced"],
    modes: ["read-only", "mutating", "monitoring"],
    estimatedBytes: 99108,
    evidence: "private-content-hash",
    owner: "owner",
    status: "active",
  },
] as const satisfies readonly ContextPack[];
