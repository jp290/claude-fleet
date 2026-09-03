// A TARGET repository declares its own context packs; Fleet only carries the pointers.
//
// The carrier is deliberately thin. Fleet stores no pack content, authors no pack, and owns no
// registry: a repo may track `.fleet/context-packs.json`, and the delivery seam reads it AT THE
// COMMIT THE RECEIPT ASSERTS, validates it with the same pure validator the Fleet seeds pass, and
// plans it through the same omission ladder. Everything in this file is pure — it is handed the
// manifest bytes and the repo facts, and performs no filesystem, git, env, or network read.
import { createHash } from "node:crypto";
import { validateContextPacks, validUseWhen, type ContextPackRepoFacts } from "./context-pack-validator";
import { CONTEXT_PACKS, type ContextPackCapability, type ContextPackMode, type ContextPackSource,
  type ContextPackTrigger } from "./context-packs";
import { contextOmissionFor, resolveContextHarness, type ContextPlan, type ContextPlanInput,
  type ContextPlanOmissionReason, type ContextPlanRule, type ContextPlanSelection } from "./context-plan";

export const CONTEXT_MANIFEST_PATH = ".fleet/context-packs.json";
// A whole-file defect has no pack id to name. The validator already uses this shape for a finding
// that belongs to no single pack, so an omission row reads as one fact, never as a real pack id.
export const CONTEXT_MANIFEST_OMISSION_ID = "@manifest";
export const CONTEXT_MANIFEST_MAX_BYTES = 65_536;
export const CONTEXT_MANIFEST_MAX_PACKS = 64;
export const CONTEXT_MANIFEST_MAX_SOURCE_PATHS = 64;

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
    if (!isRecord(pack) || !Array.isArray(pack.sources)) continue;
    for (const source of pack.sources) {
      if (!isRecord(source)) continue;
      if (typeof source.path === "string" && source.path) referenced.add(source.path);
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
  const validation = validateContextPacks({ packs: input.manifest.packs, repo: input.repo, capabilities: new Map() });
  const defective = new Set(validation.issues
    .filter((issue) => issue.code !== "CAPABILITY_AVAILABILITY_UNKNOWN")
    .map((issue) => issue.packId));

  const harness = resolveContextHarness(input.facts.harness);
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
      readonly sources: readonly ContextPackSource[];
      readonly estimatedBytes: number;
      readonly sourceHash?: string;
      readonly useWhen?: unknown;
    };
    // Sources are present at the planned commit: validation proved every path tracked there and
    // every anchor present in those exact bytes.
    const why = contextOmissionFor(pack, {
      sourceAvailable: true, harness, mode: input.facts.mode as ContextPackMode, triggers, capabilities,
    });
    if (why) {
      omitted.push({ id, why });
      continue;
    }
    selected.push({
      id,
      sources: pack.sources.map((source) => ({ path: source.path, anchor: source.anchor })),
      estimatedBytes: pack.estimatedBytes,
      // The validator already condemned any pack whose useWhen is unusable, so this re-check can
      // only ever see a valid line or none. It is still stated here rather than assumed: the field
      // is carried into a delivered brief, and a carrier must never widen what it was handed.
      ...(validUseWhen(pack.useWhen) ? { useWhen: pack.useWhen } : {}),
      ...(typeof pack.sourceHash === "string" ? { sourceHash: pack.sourceHash } : {}),
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
