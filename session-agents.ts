// session-agents.ts — pure session AGENTS rendering with measured part receipts.
import { createHash } from "node:crypto";
import { CONTEXT_PACKS, contextPartId, type ContextPackGroup, type ContextPackZeitpunkt, type ContextPartOrt,
  type ContextPartSorte, type ContextPosition } from "./context-packs";
import { resolveContextHarness, type ContextPlan } from "./context-plan";
import { sourceSection } from "./context-sections";

export const SESSION_AGENTS_LIMIT = 32 * 1024;

export interface SessionAgentsPart {
  readonly id: string;
  readonly packId: string | null;
  readonly path: string | null;
  readonly anchor: string | null;
  readonly privateSourceId?: string;
  readonly sorte: ContextPartSorte;
  readonly ort: ContextPartOrt;
  readonly sha256: string | null;
  readonly bytes: number | null;
  readonly content: string | null;
  readonly refusal: "source-unavailable" | "source-anchor-missing" | "source-anchor-ambiguous" | null;
  /** a part the plan names for a later moment (context-plan.ts#resolvePackAnatomy): borrowed then */
  readonly zeitpunkt?: ContextPackZeitpunkt;
}

// How a pointer says WHEN its part is to be borrowed — the words a lane reads next to the anchor.
const ZEITPUNKT_WORT: Readonly<Record<ContextPackZeitpunkt, string>> = { "vor-dem-land": "vor dem Land ausleihen" };

export interface SessionAgentsInput {
  readonly role: { readonly text: string; readonly path: string; readonly anchor: string };
  readonly position: ContextPosition;
  readonly harness: string | null;
  readonly plan: ContextPlan;
  readonly sourceBytes: ReadonlyMap<string, string>;
  readonly selection?: Readonly<Record<string, ContextPartOrt>>;
  readonly pointerLines?: ReadonlyMap<string, readonly string[]>;
  readonly privateSources?: ReadonlyMap<string, { readonly path: string; readonly content: string }>;
  readonly footer: string;
}

export interface SessionAgents {
  readonly text: string;
  readonly bytes: number;
  readonly parts: readonly SessionAgentsPart[];
  readonly projectDocMaxBytes?: number;
}

export { contextPartId } from "./context-packs";

export function contextPackGroup(packId: string): ContextPackGroup {
  return CONTEXT_PACKS.find((pack) => pack.id === packId)?.group
    ?? (packId === "orchestrator-eigenarten" ? "sessions-fuehren" : "vor-arbeiten");
}

function textPart(id: string, text: string, path: string, anchor: string): SessionAgentsPart {
  return { id, packId: null, path, anchor, sorte: "anleitung", ort: "box", content: text,
    sha256: createHash("sha256").update(text).digest("hex"), bytes: Buffer.byteLength(text), refusal: null };
}

function sentences(text: string): string[] {
  return text.replace(/^--- [^\n]+? --- /gm, "").replace(/^\s*(?:\d+\. |[-*] |#{1,6} )/gm, "")
    .replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/);
}

export function sessionExitFooter(footer: string, carried: string): string {
  const known = new Set(sentences(carried));
  return footer.split(/(\n\s*\n)/).map((paragraph) => {
    if (!paragraph.trim()) return paragraph;
    const kept = sentences(paragraph).filter((sentence) => !known.has(sentence));
    return kept.length === sentences(paragraph).length ? paragraph : kept.join(" ");
  }).join("").replace(/\n{3,}/g, "\n\n").trim();
}

// ACT 3 OF THE LANE END for a LIVE-BAU lane (card 1f9834a9), here because it is pure text. The
// default act 3 stays a literal in server.ts#laneExitFooter — e2e/lane-suite.ts (LS.9c) reads it
// out of that function's own source. A live-bau lane runs no verify while the owner clicks: its act 3
// names the verify and land rules as the borrow they become on the owner's word to land (verify-e2e's
// Zusatz "vor-dem-land", context-packs.ts). Acts 1 and 2 stay whole in both — no invariant of the
// role card moves. `base` is the server's own origin, e.g. http://<host>:<port>.
export function laneExitLiveBauAct(base: string): string {
  return `3. THEN GO IDLE. Do not poll for a reply and do not schedule a check-in to wait for one: the server
   delivers the report to your coordinator, and any answer arrives in this pane on its own.

--- VOR DEM LAND (Live-Bau): bis dahin baust du in der Testinstanz — nach jedem Schritt
./testinstanz.sh refresh, keine Suite, keine Vorschau (docs/testinstanz.md, Abschnitt Live-Bau).
Erst auf das Owner-Wort zum Land, das dir deine MAIN schickt, leihst du die Pruef- und Land-Regeln aus:

   curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" ${base}/api/self/context/verify-e2e

dann die Beweismenge aus GET /api/self/gate, drift pruefen, dann die drei Akte oben.`;
}

export function renderSessionAgents(input: SessionAgentsInput): SessionAgents {
  const parts: SessionAgentsPart[] = [textPart("role", input.role.text, input.role.path, input.role.anchor)];
  const pointers: string[] = [];
  const carriedIds = new Set<string>();
  const harness = resolveContextHarness(input.harness);
  const nativeContract = harness === "codex" || harness.startsWith("pi");
  const selections = [...input.plan.selected];
  if (nativeContract && !selections.some((pack) => pack.id === "portable-core")) {
    const seed = CONTEXT_PACKS.find((pack) => pack.id === "portable-core")!;
    selections.unshift({ id: seed.id, hardness: seed.hardness, useWhen: seed.useWhen, sources: seed.sources, estimatedBytes: seed.estimatedBytes });
  }
  for (const pack of selections) {
    const sources = "privateSourceId" in pack.sources ? [] : pack.sources;
    const packParts = sources.map((source, index): SessionAgentsPart => {
      const id = contextPartId(pack.id, source, index);
      const requested = input.selection?.[id] ?? source.positions?.[input.position] ?? "ausleihe";
      const ort = pack.id === "portable-core" && nativeContract ? "box" : requested;
      const bytes = input.sourceBytes.get(source.path);
      let section: ReturnType<typeof sourceSection> = null;
      let refusal: SessionAgentsPart["refusal"] = bytes === undefined ? "source-unavailable" : "source-anchor-missing";
      if (bytes !== undefined) {
        try {
          section = sourceSection(bytes, source.path, source.anchor);
          if (section) refusal = null;
        } catch (error) {
          if (!(error instanceof Error) || error.name !== "source-anchor-ambiguous") throw error;
          refusal = "source-anchor-ambiguous";
        }
      }
      return { id, packId: pack.id, path: source.path, anchor: source.anchor,
        sorte: source.sorte ?? "wissen", ort: section ? ort : "ausleihe",
        sha256: section?.sha256 ?? null, bytes: section?.bytes ?? null, content: section && ort === "box" ? section.content : null,
        refusal, ...(source.zeitpunkt ? { zeitpunkt: source.zeitpunkt } : {}) };
    });
    if ("privateSourceId" in pack.sources) {
      const id = `${pack.id}.private`;
      const source = input.privateSources?.get(pack.sources.privateSourceId);
      const ort = source ? input.selection?.[id] ?? "ausleihe" : "ausleihe";
      packParts.push({ id, packId: pack.id, path: source?.path ?? null, anchor: pack.sources.privateSourceId,
        privateSourceId: pack.sources.privateSourceId, sorte: "wissen", ort,
        sha256: source ? createHash("sha256").update(source.content).digest("hex") : null,
        bytes: source ? Buffer.byteLength(source.content) : null,
        content: source && ort === "box" ? source.content : null, refusal: source ? null : "source-unavailable" });
    }
    for (const part of packParts) {
      if (!carriedIds.has(part.id)) { parts.push(part); carriedIds.add(part.id); }
    }
    const remaining = packParts.filter((part) => part.ort === "ausleihe");
    if (packParts.length && !remaining.length) continue;
    const supplied = input.pointerLines?.get(pack.id);
    const refs = supplied ?? ("privateSourceId" in pack.sources
      ? [`  private source ${pack.sources.privateSourceId} (metadata only)`]
      : remaining.map((part) => `  ${part.path} | ${part.anchor}${part.refusal ? ` (${part.refusal})` : ""}${part.zeitpunkt ? ` — ${ZEITPUNKT_WORT[part.zeitpunkt]}` : ""}`));
    const label = `- ${pack.id} [${pack.hardness}]`;
    pointers.push([pack.useWhen ? `${label} — ${pack.useWhen}` : label, ...refs].join("\n"));
  }
  const box = (sorte: ContextPartSorte) => parts.filter((part) => part.id !== "role" && part.sorte === sorte
    && part.ort === "box" && part.content !== null).map((part) => part.content).join("\n");
  const sections = [`## Rolle\n\n${input.role.text}`, `## Anleitung\n\n${box("anleitung")}`,
    `## Wissen\n\n${box("wissen")}`, `## Packs auf Abruf\n\n${pointers.join("\n")}`];
  const footer = sessionExitFooter(input.footer, sections.join("\n\n"));
  if (footer) {
    parts.push(textPart("footer", footer, "server.ts", input.position === "lane" ? "laneExitFooter" : "PROGRAM_MAIN_RAIL_BLOCK"));
    sections.push(`## ${input.position === "lane" ? "Lane-Ende" : "Program-Schiene"}\n\n${footer}`);
  }
  const text = `${sections.join("\n\n").trimEnd()}\n`;
  const bytes = Buffer.byteLength(text);
  return { text, bytes, parts, ...(bytes > SESSION_AGENTS_LIMIT ? { projectDocMaxBytes: bytes } : {}) };
}

// A rulebook line that sends a lane to a rule its session file already carries says so in ONE
// shape — "(Session-Datei, inline: `AGENTS.md` ### Lane, Regeln 7, 8)" — and only for a section
// this renderer puts in the box: a pointer the lane would have to FOLLOW is the "lies einmal" that
// 0 of 38 lanes followed (docs/messungen/2026-10-10-kontext-bestandteile.md F7). e2e/pins.ts holds
// every such line of the lane fragments against a real lane render.
export const SESSION_FILE_REF = /\(Session-Datei, inline:\s+`([^`]+)`\s+(#{2,4} [^,\n]+?),\s+Regeln?\s+(\d+(?:,\s*\d+)*)\)/g;

/** Every Session-Datei reference in `text` that does not name a numbered rule `agents` carries inline. */
export function sessionFileRefMisses(text: string, agents: SessionAgents): string[] {
  const refs = [...text.matchAll(SESSION_FILE_REF)];
  const mentions = (text.match(/Session-Datei/g) ?? []).length;
  const misses = mentions === refs.length ? [] : [`${mentions - refs.length} Session-Datei mention(s) not in the reference shape`];
  for (const [, path, anchor, rules] of refs) {
    const part = agents.parts.find((p) => p.path === path && p.anchor === anchor && p.ort === "box" && p.content !== null);
    if (!part || !agents.text.includes(part.content!)) { misses.push(`${path} ${anchor}: not inline`); continue; }
    for (const n of rules!.split(/,\s*/)) if (!new RegExp(`^${n}\\. `, "m").test(part.content!)) misses.push(`${path} ${anchor}: no rule ${n}`);
  }
  return misses;
}
