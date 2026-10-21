// A TARGET repository declares its own context packs; Fleet only carries the pointers.
//
// The carrier is deliberately thin. Fleet stores no pack content, authors no pack, and owns no
// registry: a repo may track `.fleet/context-packs.json`, and the delivery seam reads it AT THE
// COMMIT THE RECEIPT ASSERTS, validates it with the same pure validator the Fleet seeds pass, and
// plans it through the same omission ladder. Everything in this file is pure — it is handed the
// manifest bytes and the repo facts, and performs no filesystem, git, env, or network read.
import { createHash } from "node:crypto";
import { validateContextPacks, validUseWhen, type ContextPackRepoFacts } from "./context-pack-validator";
import { CONTEXT_PACKS, CONTEXT_PACK_FASSUNGEN, contextPackMcpServerOf, CONTEXT_PACK_HARNESSES, CONTEXT_PACK_TRIGGERS, CONTEXT_PACK_ZEITPUNKTE, CONTEXT_PACK_ZUSAETZE_MAX,
  CONTEXT_POSITIONS, CONTEXT_POSITION_VARIANTEN,
  contextPartId, type ContextPackCapability, type ContextPackHardness, type ContextPackGroup, type ContextPackMode, type ContextPackSource,
  type ContextPackTrigger } from "./context-packs";
import { contextOmissionFor, resolveContextHarness, resolvePackAnatomy, resolveVariante, type ContextPackAnatomy, type ContextPlan, type ContextPlanInput,
  type ContextPlanOmissionReason, type ContextPlanRule, type ContextPlanSelection } from "./context-plan";

export const CONTEXT_MANIFEST_PATH = ".fleet/context-packs.json";
// A whole-file defect has no pack id to name. The validator already uses this shape for a finding
// that belongs to no single pack, so an omission row reads as one fact, never as a real pack id.
export const CONTEXT_MANIFEST_OMISSION_ID = "@manifest";
export const CONTEXT_MANIFEST_MAX_BYTES = 65_536;
export const CONTEXT_MANIFEST_MAX_PACKS = 64;
export const CONTEXT_MANIFEST_MAX_SOURCE_PATHS = 64;

export function taskContextTriggers(texts: readonly string[], possible: readonly ContextPackTrigger[]): ContextPackTrigger[] {
  const rulebook = String.raw`\b(?:regelbuch|rulebook|CLAUDE\.md)\b`;
  const edit = String.raw`(?<![\p{L}\p{N}_])(?:aender\w*|änder\w*|bearbeit\w*|edit\w*|update\w*|change\w*|fix\w*|repair\w*|reparier\w*|render\w*)\b`;
  const rulebookEdit = new RegExp([
    `${edit}[^\\n,;.!?]{0,100}${rulebook}`,
    `${rulebook}(?:\\s+|\\([^\\n)]*\\)|[-:]){1,30}${edit}`,
    String.raw`\b(?:FLAECHE|Fläche|surface)\s*:[^\n]*\b(?:rulebook(?:\.ts|\/)|CLAUDE\.md)\b`,
    String.raw`^(?:rulebook\.ts|rulebook\/[^\n]+|CLAUDE\.md)$`,
  ].join("|"), "iu");
  // Only the SURFACE line counts, and only a path rooted at `src/` or `public/` (the client bundle
  // and what it serves): a ZIEL that mentions the client, or `drills/src/`, is no visible work.
  const visibleSurface = /\b(?:FLAECHE|FLÄCHE|surface)\s*:[^\n]*(?<![\p{L}\p{N}_./-])(?:src|public)\//iu;
  const taskTriggers: readonly [ContextPackTrigger, RegExp][] = [
    ["jev-use", /\bjev\b/i],
    ["harness-selection", /\bharness(?:es|[- ](?:adapter|selection|auswahl))?\b(?!\.ts)|\b(?:HARNESSES|CONTAINER_HARNESS)\b/i],
    ["measurement", /\b(?:mess(?:en|e|t|auftrag|ung(?:en)?|notiz(?:en)?)|misst|vermess\w*|measur(?:e(?:ment(?:s)?|s|d)?|ing))\b|docs\/messungen\//i],
    ["rulebook-edit", rulebookEdit],
    ["visible-surface", visibleSurface],
  ];
  // `orchestrator-start` is passed by the orchestrator's own founding only. It is never a baseline
  // trigger of a task and no card text can turn it on.
  const callerOnly = new Set<ContextPackTrigger>(["orchestrator-start"]);
  const selected = new Set(possible.filter((trigger) => !callerOnly.has(trigger)
    && !taskTriggers.some(([taskTrigger]) => taskTrigger === trigger)));
  for (const [trigger, pattern] of taskTriggers) {
    if (texts.some((value) => pattern.test(value))) selected.add(trigger);
  }
  return [...selected];
}

export type ContextManifestRead =
  | { readonly kind: "absent" }
  | { readonly kind: "invalid"; readonly detail: string }
  | { readonly kind: "packs"; readonly packs: readonly unknown[]; readonly referencedPaths: readonly string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Parse the manifest bytes read at a commit. `null` means the repo tracks no manifest, which is the
 * ordinary case and must stay indistinguishable from the pre-carrier world. The referenced paths
 * are extracted shallowly and before validation on purpose: the caller needs them to fetch the
 * source bytes the validator then checks the anchors against.
 */
export function readContextManifest(source: string | null): ContextManifestRead {
  if (source === null) return { kind: "absent" };
  if (new TextEncoder().encode(source).byteLength > CONTEXT_MANIFEST_MAX_BYTES)
    return { kind: "invalid", detail: `manifest exceeds ${CONTEXT_MANIFEST_MAX_BYTES} bytes` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return { kind: "invalid", detail: "manifest is not valid JSON" };
  }
  if (!Array.isArray(parsed)) return { kind: "invalid", detail: "manifest must be an array of packs" };
  if (parsed.length > CONTEXT_MANIFEST_MAX_PACKS)
    return { kind: "invalid", detail: `manifest declares more than ${CONTEXT_MANIFEST_MAX_PACKS} packs` };

  const referenced = new Set<string>();
  for (const pack of parsed) {
    if (!isRecord(pack)) continue;
    // the Kern and every anatomy source list (a Zusatz's, a Variante's) point into the same tree
    for (const list of [pack.sources, ...(Array.isArray(pack.zusaetze) ? pack.zusaetze.map((z) => isRecord(z) ? z.sources : null) : []),
      ...(isRecord(pack.varianten) ? Object.values(pack.varianten).map((v) => isRecord(v) ? v.sources : null) : [])]) {
      if (!Array.isArray(list)) continue;
      for (const source of list) {
        if (!isRecord(source)) continue;
        if (typeof source.path === "string" && source.path) referenced.add(source.path);
      }
    }
  }
  if (referenced.size > CONTEXT_MANIFEST_MAX_SOURCE_PATHS)
    return { kind: "invalid", detail: `manifest references more than ${CONTEXT_MANIFEST_MAX_SOURCE_PATHS} paths` };
  return { kind: "packs", packs: parsed, referencedPaths: [...referenced].sort() };
}

export interface RepoContextPlanInput {
  readonly manifest: ContextManifestRead;
  readonly repo: ContextPackRepoFacts;
  readonly facts: Omit<ContextPlanInput, "sourceTree">;
}

const FLEET_SEED_IDS: ReadonlySet<string> = new Set(CONTEXT_PACKS.map((pack) => pack.id));

// --- THE ANATOMY KEYS (dd549bce): a pack's Zusaetze, Varianten and Fassung are judged HERE, beside
// the shared validator, which keeps judging the pack itself. Every source list they name is run
// through that same validator as a synthesized copy of the pack with only those sources — the
// precedent of context-plan.ts#validateProgramContextPacks — so an anatomy anchor is checked against
// the tree exactly like a Kern anchor. Any finding makes the whole pack manifest-invalid.
export const CONTEXT_PACK_ANATOMY_KEYS = ["zusaetze", "varianten", "fassung"] as const;
const ZUSATZ_ID = /^[a-z][a-z0-9-]{0,39}$/;
// `mcp` (tranche 3, card a8bc6c54): a Zusatz may bring ONE MCP server, judged by the same shape check
// a slot's persisted selection passes (context-packs.ts#contextPackMcpServerOf). A Zusatz that only
// brings a server may name no source of its own (`sources: []`).
const ZUSATZ_KEYS: ReadonlySet<string> = new Set(["id", "bedingung", "sources", "mcp"]);
const BEDINGUNG_VOCABULARY: Readonly<Record<string, readonly string[]>> = {
  triggers: CONTEXT_PACK_TRIGGERS, positions: CONTEXT_POSITIONS, harnesses: CONTEXT_PACK_HARNESSES,
  varianten: CONTEXT_POSITION_VARIANTEN, zeitpunkt: CONTEXT_PACK_ZEITPUNKTE };
// a Kern of its own per position, or per variant of a position (context-packs.ts#CONTEXT_POSITION_VARIANTEN)
const VARIANTE_KEYS_OF: readonly string[] = [...CONTEXT_POSITIONS, ...CONTEXT_POSITION_VARIANTEN];
const VARIANTE_KEYS: ReadonlySet<string> = new Set(["sources", "useWhen"]);

/** Split a manifest record into the pack the shared validator judges and its anatomy fields. */
export function splitPackAnatomy(record: Record<string, unknown>): { core: Record<string, unknown>; anatomy: Record<string, unknown> } {
  const core: Record<string, unknown> = {};
  const anatomy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record))
    ((CONTEXT_PACK_ANATOMY_KEYS as readonly string[]).includes(key) ? anatomy : core)[key] = value;
  return { core, anatomy };
}

/** The anatomy findings of one manifest pack, as `detail` strings; empty = the anatomy is sound. */
export function packAnatomyIssues(core: Record<string, unknown>, anatomy: Record<string, unknown>, repo: ContextPackRepoFacts): string[] {
  const issues: string[] = [];
  const packId = typeof core.id === "string" ? core.id : "";
  const sourcesIssues = (sources: unknown, where: string): void => {
    if (!Array.isArray(sources) || sources.length === 0) { issues.push(`${where}: sources must be a non-empty array`); return; }
    for (const issue of validateContextPacks({ packs: [{ ...core, sources }], repo, capabilities: new Map() }).issues)
      if (issue.code !== "CAPABILITY_AVAILABILITY_UNKNOWN") issues.push(`${where}: ${issue.code} ${issue.detail}`);
  };
  if ("fassung" in anatomy && !(CONTEXT_PACK_FASSUNGEN as readonly unknown[]).includes(anatomy.fassung))
    issues.push(`fassung must be one of ${CONTEXT_PACK_FASSUNGEN.join(", ")}`);
  if (anatomy.audience === "private-ops" || core.audience === "private-ops" || "privateSourceId" in core)
    if ("zusaetze" in anatomy || "varianten" in anatomy) issues.push("a private pack carries no Zusaetze or Varianten");
  // the part ids a Kern or Variante delivers next to the Zusaetze: none may name the same part twice
  const kernIds = (sources: unknown): string[] => Array.isArray(sources)
    ? sources.map((source, index) => contextPartId(packId, { id: isRecord(source) && typeof source.id === "string" ? source.id : undefined }, index)) : [];
  // each Zusatz's part ids with the variants it is limited to (null = every founding)
  const zusatzIds: { ids: string[]; varianten: readonly string[] | null }[] = [];
  if ("zusaetze" in anatomy) {
    const zusaetze = anatomy.zusaetze;
    if (!Array.isArray(zusaetze) || zusaetze.length === 0 || zusaetze.length > CONTEXT_PACK_ZUSAETZE_MAX)
      issues.push(`zusaetze must be an array of 1..${CONTEXT_PACK_ZUSAETZE_MAX}`);
    else {
      const seen = new Set<string>();
      for (const [index, zusatz] of zusaetze.entries()) {
        const where = `zusaetze[${index}]`;
        if (!isRecord(zusatz)) { issues.push(`${where} must be an object`); continue; }
        for (const key of Object.keys(zusatz)) if (!ZUSATZ_KEYS.has(key)) issues.push(`${where}: unknown key ${key}`);
        if (typeof zusatz.id !== "string" || !ZUSATZ_ID.test(zusatz.id) || seen.has(zusatz.id)) issues.push(`${where}: id must be a unique ^[a-z][a-z0-9-]{0,39}$`);
        else seen.add(zusatz.id);
        const b = zusatz.bedingung;
        if (!isRecord(b) || Object.keys(b).length === 0) issues.push(`${where}: bedingung must name triggers, positions or harnesses`);
        else for (const [key, value] of Object.entries(b)) {
          const vocabulary = BEDINGUNG_VOCABULARY[key];
          if (!vocabulary) issues.push(`${where}: unknown bedingung key ${key}`);
          else if (!Array.isArray(value) || value.length === 0 || value.some((v) => !vocabulary.includes(v as string)))
            issues.push(`${where}: bedingung.${key} must be a non-empty list of ${vocabulary.join(", ")}`);
        }
        if ("mcp" in zusatz) {
          const mcp = contextPackMcpServerOf(zusatz.mcp);
          if (!mcp.ok) issues.push(`${where}: ${mcp.error}`);
        }
        if (!("mcp" in zusatz && Array.isArray(zusatz.sources) && zusatz.sources.length === 0)) sourcesIssues(zusatz.sources, where);
        if (typeof zusatz.id === "string" && Array.isArray(zusatz.sources))
          zusatzIds.push({ ids: zusatz.sources.map((source, i) =>
            contextPartId(packId, { id: isRecord(source) && typeof source.id === "string" ? source.id : `${zusatz.id}-${i + 1}` }, 0)),
            varianten: isRecord(b) && Array.isArray(b.varianten) ? b.varianten as string[] : null });
      }
    }
  }
  const kerne: { key: string | null; ids: string[] }[] = [{ key: null, ids: kernIds(core.sources) }];
  if ("varianten" in anatomy) {
    const varianten = anatomy.varianten;
    if (!isRecord(varianten) || Object.keys(varianten).length === 0) issues.push("varianten must name at least one position");
    else for (const [position, variante] of Object.entries(varianten)) {
      const where = `varianten.${position}`;
      if (!VARIANTE_KEYS_OF.includes(position)) { issues.push(`${where}: key must be a position or a position variant (${VARIANTE_KEYS_OF.join(", ")})`); continue; }
      if (!isRecord(variante)) { issues.push(`${where} must be an object`); continue; }
      for (const key of Object.keys(variante)) if (!VARIANTE_KEYS.has(key)) issues.push(`${where}: unknown key ${key}`);
      if ("useWhen" in variante && !validUseWhen(variante.useWhen)) issues.push(`${where}: useWhen must be one line of purpose`);
      sourcesIssues(variante.sources, where);
      kerne.push({ key: position, ids: kernIds(variante.sources) });
    }
  }
  // which Zusaetze can stand beside which Kern: a variant-limited Zusatz only beside that variant's
  // Kern, or beside a plain Kern when the pack names no Kern for any of its variants
  const ownKern = new Set(kerne.map((kern) => kern.key));
  for (const kern of kerne) {
    const beside = zusatzIds.filter((z) => z.varianten === null || (kern.key !== null && z.varianten.includes(kern.key))
      || (!(CONTEXT_POSITION_VARIANTEN as readonly string[]).includes(kern.key ?? "") && !z.varianten.some((v) => ownKern.has(v))));
    const all = [...kern.ids, ...beside.flatMap((z) => z.ids)];
    if (new Set(all).size !== all.length) issues.push("a Kern and its Zusaetze name the same part id twice");
  }
  return issues;
}

/**
 * Plan the repo-declared packs. The result is ADDITIONAL rows in the same plan shape: the Fleet
 * seeds keep their own verdict (in a foreign tree, every one of them stays `source-unavailable`),
 * and a manifest problem is never a silent skip — it is an omission row the receipt carries.
 */
export function planRepoContext(input: RepoContextPlanInput): ContextPlan {
  if (input.manifest.kind === "absent") return { selected: [], omitted: [] };
  if (input.manifest.kind === "invalid")
    return { selected: [], omitted: [{ id: CONTEXT_MANIFEST_OMISSION_ID, why: "manifest-invalid" }] };

  // The capability snapshot is deliberately EMPTY: Fleet observed no harness capability inside a
  // foreign tree, and inventing one would be a fabricated observation. The validator then reports
  // hard packs as CAPABILITY_AVAILABILITY_UNKNOWN, which is a statement about the observation and
  // not a defect in the manifest — capability fit for THIS delivery is the ladder's job below.
  // Every other issue, of either severity, is a manifest defect: an anchor Fleet could not check
  // is exactly as undeliverable as one it checked and did not find.
  // The shared validator judges each pack WITHOUT its anatomy keys; the anatomy is judged beside it.
  const split = input.manifest.packs.map((raw) => isRecord(raw) ? splitPackAnatomy(raw) : null);
  const validation = validateContextPacks({ packs: input.manifest.packs.map((raw, index) => split[index]?.core ?? raw),
    repo: input.repo, capabilities: new Map() });
  const defective = new Set(validation.issues
    .filter((issue) => issue.code !== "CAPABILITY_AVAILABILITY_UNKNOWN")
    .map((issue) => issue.packId));
  for (const [index, part] of split.entries()) {
    if (!part || Object.keys(part.anatomy).length === 0) continue;
    if (packAnatomyIssues(part.core, part.anatomy, input.repo).length)
      defective.add(typeof part.core.id === "string" ? part.core.id : `#${index}`);
  }

  const harness = resolveContextHarness(input.facts.harness);
  // the variant is judged once, by the same rule the seeds' plan uses; its refusal is stated there
  const { variante } = resolveVariante(input.facts.variante, input.facts.position);
  const triggers = new Set<ContextPackTrigger>(input.facts.triggers);
  const capabilities = new Set<ContextPackCapability>(input.facts.capabilities);
  const selected: ContextPlanSelection[] = [];
  const omitted: { id: string; why: ContextPlanOmissionReason }[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < input.manifest.packs.length; index++) {
    const raw = input.manifest.packs[index];
    const record = isRecord(raw) ? raw : null;
    // The id used to LOOK UP findings must be spelled exactly as the validator spells it, or a
    // pack whose id is present but unusable (the empty string) would carry no findings and be
    // selected on a shape nobody accepted. The row's own name falls back to the entry's position,
    // which is the only honest name an unnamed entry has.
    const validatorId = record && typeof record.id === "string" ? record.id : `#${index}`;
    const id = validatorId || `#${index}`;
    if (seen.has(id)) continue; // one row per id: a duplicate is already reported as defective
    seen.add(id);

    // Two defects the shared validator cannot express, both about what Fleet may carry rather than
    // about the pack's own shape: a private overlay is unobservable in a foreign tree, and an id
    // that collides with a Fleet seed would make the receipt's rows ambiguous.
    const unverifiablePrivate = !record || record.audience === "private-ops" || "privateSourceId" in record;
    if (defective.has(validatorId) || unverifiablePrivate || FLEET_SEED_IDS.has(id)) {
      omitted.push({ id, why: "manifest-invalid" });
      continue;
    }

    const pack = record as unknown as ContextPlanRule & {
      readonly hardness: ContextPackHardness;
      readonly sources: readonly ContextPackSource[];
      readonly estimatedBytes: number;
      readonly sourceHash?: string;
      readonly useWhen?: unknown;
      readonly group?: ContextPackGroup;
    };
    // Sources are present at the planned commit: validation proved every path tracked there and
    // every anchor present in those exact bytes.
    const why = contextOmissionFor(pack, {
      sourceAvailable: true, harness, mode: input.facts.mode as ContextPackMode, triggers, capabilities,
      ...(variante ? { variante } : {}),
    });
    if (why) {
      omitted.push({ id, why });
      continue;
    }
    // the anatomy was proven above; the plan picks this founding's Kern, Zusaetze and Variante
    const resolved = resolvePackAnatomy({ ...(pack as unknown as ContextPackAnatomy), id,
      useWhen: validUseWhen(pack.useWhen) ? pack.useWhen : undefined }, { position: input.facts.position, ...(variante ? { variante } : {}), harness, triggers });
    selected.push({
      id,
      hardness: pack.hardness,
      sources: resolved.sources,
      ...(pack.group !== undefined ? { group: pack.group } : {}),
      estimatedBytes: pack.estimatedBytes,
      // The validator already condemned any pack whose useWhen is unusable, so this re-check can
      // only ever see a valid line or none. It is still stated here rather than assumed: the field
      // is carried into a delivered brief, and a carrier must never widen what it was handed.
      ...(validUseWhen(resolved.useWhen) ? { useWhen: resolved.useWhen } : {}),
      ...(typeof pack.sourceHash === "string" ? { sourceHash: pack.sourceHash } : {}),
      ...(resolved.anatomie ? { anatomie: resolved.anatomie } : {}),
    });
  }
  return { selected, omitted };
}

/**
 * The OBSERVED source version of a pack: sha256 over `path\0<git blob sha>\0` per source, in
 * source order. `undefined` when any source has no blob at the planned commit — an unobservable
 * pack carries no version, never a partial one.
 *
 * WHY BLOB SHAS AND NOT THE BYTES. Git already content-addresses every tracked file, and the
 * delivery seam already lists the tree once. Hashing the bytes instead meant reading them: the
 * six seed sources of this Fleet are 1 794 908 bytes at HEAD (1 574 279 of them `server.ts`
 * alone) and cost ~108 ms of `git show` per delivery, measured 2026-09-03 — against ~24 ms for
 * the one `ls-tree` that carries every path's blob sha. It is also EXACTER: `gitRead` trims its
 * output, so a byte hash silently described a file without its trailing newline.
 *
 * The hash is over whole blobs on purpose: it is the version of what the anchor points INTO, not
 * of the anchor line. A pack with one source still gets a hash rather than the bare blob sha, so
 * one-source and many-source packs live in one space.
 */
export function observedSourceHash(
  sources: readonly ContextPackSource[], blobShas: ReadonlyMap<string, string>,
): string | undefined {
  if (sources.length === 0) return undefined;
  const hash = createHash("sha256");
  for (const source of sources) {
    const blob = blobShas.get(source.path);
    if (blob === undefined) return undefined;
    hash.update(source.path).update("\0").update(blob).update("\0");
  }
  return hash.digest("hex");
}

/**
 * Stamp the observed source version onto every selection of a planned delivery — Fleet seeds and
 * repo-declared packs alike, so the receipt's `sourceHash` means ONE thing.
 *
 * OBSERVED BEATS DECLARED: a manifest's literal is a claim about a version, the blob sha at the
 * planned commit is that version. The literal survives only where nothing is observable (an
 * untracked source, a foreign tree), and a private overlay is never observable here at all.
 * Pure; the caller hands over the tree listing it already made.
 */
export function stampObservedSourceHashes(
  selected: readonly ContextPlanSelection[], blobShas: ReadonlyMap<string, string>,
): ContextPlanSelection[] {
  return selected.map((selection) => {
    if ("privateSourceId" in selection.sources) return selection;
    const observed = observedSourceHash(selection.sources, blobShas);
    return observed === undefined ? selection : { ...selection, sourceHash: observed };
  });
}
