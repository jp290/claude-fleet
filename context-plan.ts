import {
  type ContextPack,
  CONTEXT_PACKS,
  CONTEXT_PACK_HARNESSES,
  contextPartId,
  CONTEXT_POSITIONS,
  CONTEXT_POSITION_VARIANTEN,
  CONTEXT_VARIANTE_POSITION,
  type ContextPackBedingung,
  type ContextPackFassung,
  type ContextPositionVariante,
  type ContextPackVarianten,
  type ContextPackZusatz,
  type ContextPosition,
  type ContextPackCapability,
  type ContextPackHardness,
  type ContextPackGroup,
  type ContextPackMode,
  type ContextPackSource,
  type ContextPackStatus,
  type ContextPackTrigger,
} from "./context-packs";
import { USE_WHEN_MAX, validateContextPacks, type ContextPackRepoFacts } from "./context-pack-validator";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { KONZEPT_ID_RE, KONZEPT_ROOT_ENV, currentKonzeptVersion } from "./konzept-ledger";

// Ladder order is the contract: the FIRST rule a pack fails is the reason it is omitted.
// `manifest-invalid` leads because it is the only reason that disqualifies a pack before its
// declared facts may be believed at all — it can only arise for a repo-declared pack.
export const CONTEXT_PLAN_OMISSION_REASONS = [
  "manifest-invalid",
  "source-unavailable",
  "status-not-active",
  "harness-unsupported",
  "mode-unsupported",
  "trigger-not-matched",
  "capability-missing",
  // Not a rung of the ladder below: it can only arise for a Program-scoped pack, whose lifetime is its
  // Program's. It is written so the END of that lifetime is a receipt row, never a silent absence.
  "program-complete",
] as const;
export type ContextPlanOmissionReason = (typeof CONTEXT_PLAN_OMISSION_REASONS)[number];

export interface ContextPlanInput {
  readonly sourceTree: "fleet" | "foreign";
  readonly harness: string | null;
  readonly mode: ContextPackMode;
  readonly triggers: readonly ContextPackTrigger[];
  readonly capabilities: readonly ContextPackCapability[];
  /** whose founding this is: picks a pack's Variante and judges a Zusatz's position condition.
   *  Absent = no position known: the standard Kern, and a positional Zusatz stays off. */
  readonly position?: ContextPosition;
  /** the variant the card names, RAW as cardVariante read it: resolveVariante judges it against the
   *  closed vocabulary and the position. Absent or null = no variant, and the plan is the plain one. */
  readonly variante?: string | null;
}

// --- THE VARIANT A CARD CHOOSES (card 1f9834a9). An INTERIM form, by decision of the Program-MAIN
// (clarification 17398332): the card head has no VARIANTE field yet, so the variant is a line of the
// row's text — `VARIANTE: live-bau`, standing after the goal paragraph, where
// card-extract.ts#parseFormattedCard has already stopped reading headers and prose past the first
// paragraph is no goal. This is the ONE reader of that line; every seam asks it, none re-parses.
const CARD_VARIANTE_LINE = /^[ \t]*VARIANTE[ \t]*:[ \t]*(.*?)[ \t]*$/gim;

/** The raw variant the card texts name: null = no line; two different values come back joined, so
 *  resolveVariante refuses them by name instead of one silently winning. Pure. */
export function cardVariante(texts: readonly string[]): string | null {
  const values = [...new Set(texts.flatMap((text) => [...text.matchAll(CARD_VARIANTE_LINE)].map((hit) => hit[1]!)))];
  return values.length ? values.join(" · ") : null;
}

/** Judge a raw variant for a founding: CLOSED — only a CONTEXT_POSITION_VARIANTEN name of THIS
 *  position takes effect; anything else is variant none WITH the reason, never a silent fallback. */
export function resolveVariante(raw: string | null | undefined, position: ContextPosition | undefined):
  { variante?: ContextPositionVariante; verworfen?: string } {
  if (raw === null || raw === undefined) return {};
  const known = (CONTEXT_POSITION_VARIANTEN as readonly string[]).includes(raw) ? raw as ContextPositionVariante : null;
  if (!known) return { verworfen: `unbekannte Variante "${raw.slice(0, 60)}" — nur ${CONTEXT_POSITION_VARIANTEN.join(", ")} wirkt; Variante keine` };
  if (CONTEXT_VARIANTE_POSITION[known] !== position)
    return { verworfen: `Variante ${known} gehoert zur Position ${CONTEXT_VARIANTE_POSITION[known]}, diese Gruendung ist ${position ?? "ohne Position"}; Variante keine` };
  return { variante: known };
}

/** What the plan chose of a pack's anatomy (context-packs.ts): the Kern's part ids, the Variante it
 *  came from, each Zusatz with its condition and verdict, the Fassung. Carried on the selection only
 *  when the pack declares any of it, so a pack without anatomy plans and receipts byte for byte as before;
 *  the founding-plan route and the receipt copy THIS object, so both name the same bytes. */
export interface ContextPackAnatomie {
  readonly kern: readonly string[];
  readonly variante: ContextPosition | ContextPositionVariante | "standard";
  readonly zusaetze: readonly {
    readonly id: string;
    readonly bedingung: ContextPackBedingung;
    readonly an: boolean;
    /** only on a Zusatz whose condition names a zeitpunkt: on, but delivered as a borrow */
    readonly ort?: "ausleihe";
    /** the condition keys that did not hold; absent when the Zusatz is on */
    readonly verfehlt?: readonly ("triggers" | "positions" | "harnesses")[];
    readonly teile: readonly string[];
  }[];
  readonly fassung?: ContextPackFassung;
}

// `useWhen` is OPTIONAL on a selection although it is mandatory on a Fleet seed: a repo-declared
// pack may predate the field, and a plan that invented a purpose line for it would be stating a
// claim nobody made. Absent here means the renderer omits the line, never the pointer.
export type ContextPlanSelection = {
  readonly id: string;
  readonly hardness: ContextPackHardness;
  readonly group?: ContextPackGroup;
  readonly useWhen?: string;
  readonly sources: readonly ContextPackSource[];
  readonly estimatedBytes: number;
  // Only a repo-declared pack carries its observation here; a Fleet seed's hash lives on its own
  // manifest entry and is read from there at receipt time.
  readonly sourceHash?: string;
  // Present ONLY on a Program-scoped pack, so every receipt without one keeps its exact bytes.
  readonly origin?: "program";
  readonly anatomie?: ContextPackAnatomie;
} | {
  readonly id: string;
  readonly hardness: ContextPackHardness;
  readonly group?: ContextPackGroup;
  readonly useWhen?: string;
  readonly sources: { readonly privateSourceId: string };
  readonly estimatedBytes: number;
  readonly sourceHash?: string;
  readonly anatomie?: ContextPackAnatomie;
};

/** The rule facts a pack must state to be planned at all — Fleet seed and repo manifest alike. */
export interface ContextPlanRule {
  readonly status: ContextPackStatus;
  readonly harnesses: readonly string[];
  readonly modes: readonly ContextPackMode[];
  readonly triggers: readonly ContextPackTrigger[];
  readonly requiredCapabilities: readonly ContextPackCapability[];
  readonly varianten?: ContextPackVarianten;
}

export interface ContextPlanContext {
  readonly sourceAvailable: boolean;
  readonly harness: string;
  readonly mode: ContextPackMode;
  readonly triggers: ReadonlySet<ContextPackTrigger>;
  readonly capabilities: ReadonlySet<ContextPackCapability>;
  /** the founding's ACCEPTED variant (resolveVariante) */
  readonly variante?: ContextPositionVariante;
}

// null and unrecognised harness ids are the legacy/default adapter, which is Claude. Keeping that
// resolution here makes every caller share the same total rule instead of special-casing old slots
// at the delivery boundary. Resolution is against the closed vocabulary rather than the harnesses
// the seeds happen to mention, so a repo-declared pack is judged by the same rule.
export function resolveContextHarness(harness: string | null): string {
  return (CONTEXT_PACK_HARNESSES as readonly string[]).includes(harness ?? "") ? harness as string : "claude";
}

/** The single omission ladder. Returns the first failed rule, or null when the pack is selected. */
export function contextOmissionFor(pack: ContextPlanRule, ctx: ContextPlanContext): ContextPlanOmissionReason | null {
  if (!ctx.sourceAvailable) return "source-unavailable";
  if (pack.status !== "active") return "status-not-active";
  if (!pack.harnesses.includes(ctx.harness)) return "harness-unsupported";
  if (!pack.modes.includes(ctx.mode)) return "mode-unsupported";
  // a variant wants every pack that names a Kern of its own for it — that IS the pack saying so
  if (!pack.triggers.some((trigger) => ctx.triggers.has(trigger))
    && !(ctx.variante !== undefined && pack.varianten?.[ctx.variante] !== undefined)) return "trigger-not-matched";
  if (!pack.requiredCapabilities.every((capability) => ctx.capabilities.has(capability))) return "capability-missing";
  return null;
}

/** The anatomy fields a pack may declare beside its Kern — Fleet seed and repo manifest alike. */
export interface ContextPackAnatomy {
  readonly id: string;
  readonly sources: readonly ContextPackSource[];
  readonly useWhen?: string;
  readonly zusaetze?: readonly ContextPackZusatz[];
  readonly varianten?: ContextPackVarianten;
  readonly fassung?: ContextPackFassung;
}

/**
 * Resolve one SELECTED pack's anatomy for a founding: the chosen variant's Kern, else the position's
 * Variante, replaces the Kern (and its purpose line, when it names one), each Zusatz is on exactly
 * when every condition it names holds, and the delivered sources are Kern then the Zusaetze that are
 * on. A Zusatz source without an id gets `<zusatz>-<n>`, so its part id never depends on which other
 * Zusaetze are on. A variant key and a Zusatz conditioned on a variant belong to that variant ALONE:
 * unchosen they are not part of the plan at all, so a pack whose only anatomy is a variant's plans
 * byte for byte as before. A Zusatz naming a zeitpunkt that is on delivers its parts as `ausleihe`
 * marked with the moment — named now, borrowed then. Pure.
 */
export function resolvePackAnatomy(pack: ContextPackAnatomy, ctx: { readonly position?: ContextPosition;
  readonly variante?: ContextPositionVariante; readonly harness: string; readonly triggers: ReadonlySet<ContextPackTrigger> }):
  { sources: ContextPackSource[]; useWhen?: string; anatomie?: ContextPackAnatomie } {
  const ownZusaetze = (pack.zusaetze ?? []).filter((zusatz) => !zusatz.bedingung.varianten
    || (ctx.variante !== undefined && zusatz.bedingung.varianten.includes(ctx.variante)));
  const chosen = ctx.variante !== undefined ? pack.varianten?.[ctx.variante] : undefined;
  const positional = Object.keys(pack.varianten ?? {}).some((key) => (CONTEXT_POSITIONS as readonly string[]).includes(key));
  const declares = (pack.zusaetze !== undefined && (ownZusaetze.length > 0 || pack.zusaetze.length === 0))
    || positional || chosen !== undefined || pack.fassung !== undefined;
  const variante = chosen ?? (ctx.position !== undefined ? pack.varianten?.[ctx.position] : undefined);
  const kern = (variante?.sources ?? pack.sources).map((source) => ({ ...source }));
  const useWhen = variante?.useWhen ?? pack.useWhen;
  if (!declares) return { sources: kern, ...(useWhen !== undefined ? { useWhen } : {}) };
  const sources = [...kern];
  const zusaetze: ContextPackAnatomie["zusaetze"][number][] = [];
  for (const zusatz of ownZusaetze) {
    const own = zusatz.sources.map((source, index) => ({ ...source, id: source.id ?? `${zusatz.id}-${index + 1}` }));
    const verfehlt: ("triggers" | "positions" | "harnesses")[] = [];
    const b = zusatz.bedingung;
    if (b.triggers && !b.triggers.some((trigger) => ctx.triggers.has(trigger))) verfehlt.push("triggers");
    if (b.positions && (ctx.position === undefined || !b.positions.includes(ctx.position))) verfehlt.push("positions");
    if (b.harnesses && !(b.harnesses as readonly string[]).includes(ctx.harness)) verfehlt.push("harnesses");
    const bedingung: ContextPackBedingung = { ...(b.triggers ? { triggers: [...b.triggers] } : {}),
      ...(b.positions ? { positions: [...b.positions] } : {}), ...(b.harnesses ? { harnesses: [...b.harnesses] } : {}),
      ...(b.varianten ? { varianten: [...b.varianten] } : {}), ...(b.zeitpunkt ? { zeitpunkt: [...b.zeitpunkt] } : {}) };
    const zeitpunkt = b.zeitpunkt?.[0];
    zusaetze.push({ id: zusatz.id, bedingung, an: verfehlt.length === 0,
      ...(zeitpunkt && verfehlt.length === 0 ? { ort: "ausleihe" as const } : {}), ...(verfehlt.length ? { verfehlt } : {}),
      teile: own.map((source) => contextPartId(pack.id, source, 0)) });
    if (verfehlt.length === 0) sources.push(...(zeitpunkt
      ? own.map((source) => ({ ...source, positions: BORROW_ONLY, zeitpunkt }))
      : own));
  }
  return { sources, ...(useWhen !== undefined ? { useWhen } : {}),
    anatomie: { kern: kern.map((source, index) => contextPartId(pack.id, source, index)),
      variante: chosen ? ctx.variante! : variante ? ctx.position! : "standard", zusaetze, ...(pack.fassung ? { fassung: pack.fassung } : {}) } };
}
const BORROW_ONLY = { lane: "ausleihe", main: "ausleihe", orchestratorin: "ausleihe" } as const;

export interface ContextPlan {
  readonly selected: readonly ContextPlanSelection[];
  readonly omitted: readonly { readonly id: string; readonly why: ContextPlanOmissionReason }[];
  /** the variant this plan was made under; absent = none, and the plan is byte for byte the plain one */
  readonly variante?: ContextPositionVariante;
  /** a variant the card named that does not take effect, and why (resolveVariante) */
  readonly varianteVerworfen?: string;
}

/** Freshly derive context pointers from plain facts. No result is persisted here. */
export function planContext(input: ContextPlanInput): ContextPlan {
  const harness = resolveContextHarness(input.harness);
  const triggers = new Set<ContextPackTrigger>(input.triggers);
  const capabilities = new Set<ContextPackCapability>(input.capabilities);
  const { variante, verworfen } = resolveVariante(input.variante, input.position);
  const selected: ContextPlanSelection[] = [];
  const omitted: { id: string; why: ContextPlanOmissionReason }[] = [];

  for (const pack of CONTEXT_PACKS) {
    const why = contextOmissionFor(pack, {
      sourceAvailable: input.sourceTree !== "foreign",
      harness, mode: input.mode, triggers, capabilities, ...(variante ? { variante } : {}),
    });
    if (why) {
      omitted.push({ id: pack.id, why });
      continue;
    }
    // a seed carries no anatomy today; it resolves through the same function a manifest pack does
    const seed: ContextPack = pack;
    if ("sources" in seed && seed.sources) {
      const resolved = resolvePackAnatomy(seed, { position: input.position, ...(variante ? { variante } : {}), harness, triggers });
      selected.push({ id: seed.id, hardness: seed.hardness, group: seed.group, ...(resolved.useWhen !== undefined ? { useWhen: resolved.useWhen } : {}),
        sources: resolved.sources, estimatedBytes: seed.estimatedBytes, ...(resolved.anatomie ? { anatomie: resolved.anatomie } : {}) });
    } else if ("privateSourceId" in seed) selected.push({ id: seed.id, hardness: seed.hardness, group: seed.group, useWhen: seed.useWhen,
      sources: { privateSourceId: seed.privateSourceId }, estimatedBytes: seed.estimatedBytes,
      ...(seed.fassung ? { anatomie: { kern: [`${seed.id}.private`], variante: "standard" as const, zusaetze: [], fassung: seed.fassung } } : {}) });
  }

  return { selected, omitted, ...(variante ? { variante } : {}), ...(verworfen ? { varianteVerworfen: verworfen } : {}) };
}

// --- PROGRAM-SCOPED PACKS: pointers that live exactly as long as their Program.
//
// The Fleet seeds and the repo manifest carry knowledge that holds for months; task-notes carry a
// note on a FILE. Between them sat knowledge that holds for one Program's work — a measurement note
// or a decision section its lanes all need. The Program is the only persisted bracket (a wave is a
// projection, task-land-waves.ts), so it is the lifetime: no clock, no expiry, no second store. A
// pack is id + purpose line + tracked pointers; the content stays in the source file.
export const PROGRAM_CONTEXT_PACKS_MAX = 5;
export const PROGRAM_CONTEXT_PACK_SOURCES_MAX = 4;
const PROGRAM_CONTEXT_PACK_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const PROGRAM_CONTEXT_PACK_KEYS: ReadonlySet<string> = new Set(["id", "useWhen", "sources"]);
const PROGRAM_CONTEXT_CONTENT_KEY = /^(?:content|contents|prose|text|passage|quote|body)$/i;

export interface ProgramContextPack {
  readonly id: string;
  readonly useWhen: string;
  readonly sources: readonly ContextPackSource[];
}

export interface ProgramContextPackIssue {
  readonly code: string;
  readonly packId: string;
  readonly detail: string;
}

export type ProgramContextPacksValidation =
  | { readonly ok: true; readonly packs: ProgramContextPack[] }
  | { readonly ok: false; readonly issues: readonly ProgramContextPackIssue[] };

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Validate a Program's pack list at WRITE time against the repo facts of the commit the writer
 * names. Every finding refuses the whole list — an anchor Fleet could not check is exactly as
 * undeliverable as one it checked and did not find. Pure: facts in, verdict out.
 *
 * The source checks are context-pack-validator.ts's own, run over a synthesized full pack: the
 * fields a Program pack does not state are fixed here (trigger `always`, every harness and mode,
 * guidance), so the validator judges only what the writer actually supplied.
 */
export function validateProgramContextPacks(raw: unknown, repo: ContextPackRepoFacts): ProgramContextPacksValidation {
  if (!Array.isArray(raw))
    return { ok: false, issues: [{ code: "PACK_FIELD_INVALID", packId: "@packs", detail: "packs must be an array" }] };
  if (raw.length > PROGRAM_CONTEXT_PACKS_MAX)
    return { ok: false, issues: [{ code: "PROGRAM_PACKS_TOO_MANY", packId: "@packs",
      detail: `a Program carries at most ${PROGRAM_CONTEXT_PACKS_MAX} packs (got ${raw.length})` }] };
  const issues: ProgramContextPackIssue[] = [];
  const seedIds: ReadonlySet<string> = new Set(CONTEXT_PACKS.map((pack) => pack.id));
  const seen = new Set<string>();
  for (let index = 0; index < raw.length; index++) {
    const entry = raw[index];
    if (!isPlainRecord(entry)) {
      issues.push({ code: "PACK_FIELD_INVALID", packId: `#${index}`, detail: "pack must be an object" });
      continue;
    }
    const packId = typeof entry.id === "string" && entry.id ? entry.id : `#${index}`;
    for (const key of Object.keys(entry).sort()) {
      if (PROGRAM_CONTEXT_PACK_KEYS.has(key)) continue;
      issues.push(PROGRAM_CONTEXT_CONTENT_KEY.test(key)
        ? { code: "PACK_CONTENT_FORBIDDEN", packId, detail: `content field is forbidden: ${key}` }
        : { code: "PACK_UNKNOWN_KEY", packId, detail: `unknown pack key: ${key}` });
    }
    if (typeof entry.id !== "string" || !PROGRAM_CONTEXT_PACK_ID.test(entry.id))
      issues.push({ code: "PROGRAM_PACK_ID_INVALID", packId, detail: "id must match ^[a-z0-9][a-z0-9-]{0,39}$" });
    else if (seedIds.has(entry.id))
      issues.push({ code: "PROGRAM_PACK_SEED_ID", packId, detail: "id is a Fleet seed id" });
    else if (seen.has(entry.id))
      issues.push({ code: "ID_DUPLICATE", packId, detail: "id occurs more than once" });
    else seen.add(entry.id);
    if (!("useWhen" in entry))
      issues.push({ code: "PACK_REQUIRED_FIELD_MISSING", packId, detail: "required field is missing: useWhen" });
    if (Array.isArray(entry.sources) && entry.sources.length > PROGRAM_CONTEXT_PACK_SOURCES_MAX)
      issues.push({ code: "PROGRAM_PACK_SOURCES_TOO_MANY", packId,
        detail: `a pack names at most ${PROGRAM_CONTEXT_PACK_SOURCES_MAX} sources (got ${entry.sources.length})` });
    const synthesized = {
      id: "program-pack", scope: "repo-contract", audience: "agent", triggers: ["always"], hardness: "guidance",
      requiredCapabilities: ["tracked-source-read"], harnesses: [...CONTEXT_PACK_HARNESSES], modes: ["read-only", "mutating", "monitoring"],
      estimatedBytes: 0, evidence: "tree-anchor", owner: "owner", status: "active",
      ...("useWhen" in entry ? { useWhen: entry.useWhen } : {}),
      ...("sources" in entry ? { sources: entry.sources } : {}),
    };
    for (const issue of validateContextPacks({ packs: [synthesized], repo, capabilities: new Map() }).issues)
      issues.push({ code: issue.code, packId, detail: issue.path ? `${issue.detail}: ${issue.path}` : issue.detail });
  }
  if (issues.length > 0) return { ok: false, issues };
  // The typed lift is the load reader's: everything it requires, the validator above has proven.
  const packs = programContextPacksFrom(raw);
  return packs ? { ok: true, packs }
    : { ok: false, issues: [{ code: "PACK_FIELD_INVALID", packId: "@packs", detail: "packs are not in persistable shape" }] };
}

/**
 * Lift a persisted list back into packs, SHAPE ONLY: the anchors were checked when they were written,
 * and a load has no commit to check them against. Anything unreadable is `null` — the caller loads
 * the Program without packs rather than refusing the Program.
 */
export function programContextPacksFrom(raw: unknown): ProgramContextPack[] | null {
  if (!Array.isArray(raw) || raw.length > PROGRAM_CONTEXT_PACKS_MAX) return null;
  const packs: ProgramContextPack[] = [];
  const ids = new Set<string>();
  for (const entry of raw) {
    if (!isPlainRecord(entry) || Object.keys(entry).some((key) => !PROGRAM_CONTEXT_PACK_KEYS.has(key))) return null;
    const { id, useWhen, sources } = entry;
    if (typeof id !== "string" || !PROGRAM_CONTEXT_PACK_ID.test(id) || ids.has(id)) return null;
    if (typeof useWhen !== "string" || /[\r\n]/.test(useWhen) || !useWhen.trim() || useWhen.trim().length > USE_WHEN_MAX) return null;
    if (!Array.isArray(sources) || sources.length === 0 || sources.length > PROGRAM_CONTEXT_PACK_SOURCES_MAX) return null;
    const lifted: ContextPackSource[] = [];
    for (const source of sources) {
      if (!isPlainRecord(source) || typeof source.path !== "string" || typeof source.anchor !== "string"
        || !source.path || !source.anchor || /[\r\n]/.test(source.anchor) || Object.keys(source).length !== 2) return null;
      lifted.push({ path: source.path, anchor: source.anchor });
    }
    ids.add(id);
    packs.push({ id, useWhen: useWhen.trim(), sources: lifted });
  }
  return packs;
}

export interface ProgramContextPlanInput {
  /** The lane's Program, or null for a lane outside every Program. */
  readonly program: { readonly status: string; readonly contextPacks?: readonly ProgramContextPack[] } | null;
  /** Tracked paths at the commit the receipt asserts — a pointer into a vanished path is omitted. */
  readonly trackedPaths: ReadonlySet<string>;
}

/**
 * The Program's packs for ONE lane delivery. A `complete` Program delivers nothing and says so per
 * pack; a pack whose source path is not tracked at the delivered commit (removed since the write, or
 * a lane in another repository) is `source-unavailable`. No Program, no packs: the empty plan, so a
 * lane outside every Program receives exactly the plan it received before this carrier existed.
 */
export function planProgramContext(input: ProgramContextPlanInput): ContextPlan {
  const packs = input.program?.contextPacks ?? [];
  const selected: ContextPlanSelection[] = [];
  const omitted: { id: string; why: ContextPlanOmissionReason }[] = [];
  for (const pack of packs) {
    if (input.program?.status === "complete") omitted.push({ id: pack.id, why: "program-complete" });
    else if (!pack.sources.every((source) => input.trackedPaths.has(source.path))) omitted.push({ id: pack.id, why: "source-unavailable" });
    // estimatedBytes 0: a Program pack declares no size, and nothing here reads the source to guess one.
    else selected.push({ id: pack.id, hardness: "guidance", useWhen: pack.useWhen, sources: pack.sources.map((source) => ({ ...source })),
      estimatedBytes: 0, origin: "program" });
  }
  return { selected, omitted };
}

// --- PRIVATE PACKS: a readable local path and a hash verdict, never the content.
//
// A private pack names its source by `privateSourceId` only, because this repository is public. Until
// Program Konzeptgedaechtnis 31aa88ea (Schnitt 4) nothing resolved that id, so a lane received a token
// it could do nothing with. A KONZEPT id resolves through the konzept ledger (konzept-ledger.ts) under
// the one private root the server already has, FLEET_KONZEPT_ROOT: the CURRENT fassung is the highest
// version in `<root>/<id>/versionen.jsonl`, its file `<root>/<id>/v<N>.md`. The bytes are hashed here
// and compared, never copied: the brief carries the path, the verdict and the door an Anmerkung takes.
//
// THREE VERDICTS, one reason each:
//  * match   — v<N>.md hashes to the pack's declared sourceHash AND to its own versionen.jsonl row.
//  * drift   — the file is there and readable but one of the two comparisons fails: either the file
//              changed after it was published, or the current fassung is not the one the pack pins.
//  * missing — nothing readable to point at: no root on this server, no published version, no file,
//              an opaque id no resolver knows, or a konzept id no Fleet seed declares. Named, never a
//              silent omission.
// The path is the server's local fact and is never receipted; the verdict and the version are.
export const PRIVATE_PACK_VERDICTS = ["match", "drift", "missing"] as const;
export type PrivatePackVerdict = (typeof PRIVATE_PACK_VERDICTS)[number];

export interface PrivatePackResolution {
  readonly privateSourceId: string;
  readonly verdict: PrivatePackVerdict;
  /** why the verdict is not `match`; null on a match */
  readonly why: string | null;
  /** the current fassung's N, whenever the ledger names one */
  readonly version: number | null;
  /** the readable file — present exactly when the file was read and hashed */
  readonly path: string | null;
}

const sha256Hex = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

// THE ONLY IDS THIS RESOLVER READS: the private sources a Fleet seed declares. A repo manifest cannot
// declare one (context-manifest.ts: manifest-invalid), and a konzept that merely sits under the same
// root without a seed naming it belongs to another project — read it, and this would be a general
// reader of everything the owner keeps there.
const SEED_PRIVATE_SOURCE_IDS: ReadonlySet<string> = new Set(
  CONTEXT_PACKS.flatMap((pack) => "privateSourceId" in pack ? [pack.privateSourceId] : []));

/** Resolve one private pack against the private root. Reads two small files synchronously. */
export function resolvePrivatePack(root: string | null, privateSourceId: string, declaredHash: string | undefined): PrivatePackResolution {
  const missing = (why: string, version: number | null = null): PrivatePackResolution =>
    ({ privateSourceId, verdict: "missing", why, version, path: null });
  if (!KONZEPT_ID_RE.test(privateSourceId)) return missing("an opaque id — no resolver on this server knows it");
  if (!SEED_PRIVATE_SOURCE_IDS.has(privateSourceId))
    return missing("no Fleet seed declares this private source — another konzept under the root is never read");
  if (!root) return missing(`${KONZEPT_ROOT_ENV} is not set on this server`);
  let raw: string;
  try { raw = readFileSync(`${root}/${privateSourceId}/versionen.jsonl`, "utf8"); }
  catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return missing(code === "ENOENT" ? "no versionen.jsonl for it under the root" : `versionen.jsonl unreadable (${code ?? "error"})`);
  }
  const current = currentKonzeptVersion(raw, privateSourceId);
  if (!current) return missing("no published version in versionen.jsonl");
  const path = `${root}/${privateSourceId}/v${current.version}.md`;
  let fileHash: string;
  try { fileHash = sha256Hex(readFileSync(path)); }
  catch { return missing(`v${current.version}.md is absent under the root`, current.version); }
  const drift = (why: string): PrivatePackResolution =>
    ({ privateSourceId, verdict: "drift", why, version: current.version, path });
  if (current.sha256 !== null && fileHash !== current.sha256)
    return drift(`v${current.version}.md no longer hashes to its versionen.jsonl row — the file changed after it was published`);
  if (declaredHash === undefined) return drift("the pack declares no sourceHash to compare against");
  if (fileHash !== declaredHash)
    return drift(`the current fassung v${current.version} is not the one the pack declares — the pack's sourceHash is behind or ahead`);
  return { privateSourceId, verdict: "match", why: null, version: current.version, path };
}

export function readPrivatePack(root: string | null, privateSourceId: string, declaredHash: string | undefined):
  { ok: true; privateSourceId: string; version: number; content: string; sha256: string; bytes: number }
  | { ok: false; refusal: string; error: string } {
  const resolved = resolvePrivatePack(root, privateSourceId, declaredHash);
  if (resolved.verdict !== "match" || resolved.path === null || resolved.version === null)
    return { ok: false, refusal: `private-${resolved.verdict}`, error: resolved.why ?? "private source unavailable" };
  try {
    const bytes = readFileSync(resolved.path);
    const hash = sha256Hex(bytes);
    if (hash !== declaredHash)
      return { ok: false, refusal: "private-drift", error: "private source changed after resolution" };
    return { ok: true, privateSourceId, version: resolved.version, content: bytes.toString("utf8"), sha256: hash, bytes: bytes.length };
  } catch {
    return { ok: false, refusal: "private-missing", error: "resolved private source is no longer readable" };
  }
}

/**
 * The indented lines one private pack contributes to the anchor block. The id stays on the first line
 * in every verdict, so a receipt row's privateSourceId is always findable in the delivered bytes; the
 * Anmerkung door is named whenever a version exists to hang the Anmerkung on.
 */
export function renderPrivatePackLines(resolution: PrivatePackResolution): string[] {
  const { privateSourceId: id, verdict, why, version, path } = resolution;
  const where = version !== null ? `${id} v${version}` : id;
  const lines = [`  ${path ? `${path} | ` : ""}${where} · privat, lesen statt kopieren · hash ${verdict}${why ? ` (${why})` : ""}`];
  if (version !== null)
    lines.push(`  Anmerkung an v${version}: POST /api/self/konzepte/${id}/anmerkungen {"version":${version},"text":"…"} (x-fleet-self-token; Lane oder gebundene MAIN)`);
  return lines;
}
