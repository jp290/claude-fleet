// EINE SESSION RICHTET IHRE NACHFOLGERIN EIN (Harness 2.0, Kern „einrichten“; Owner 24.10. über Slot 6: „[Zitat entfernt]“
// , ohne seinen Klick, solange es danach
// sichtbar ist). Bis hierher konnte eine Session ihrer Nachfolgerin nur weniger geben (POST /api/self/weglassen). Jetzt gibt sie ihr Text
// dazu, und nur Text: Packs (aus Fleets Register oder eigene, server/eigene-packs.ts) und einen Zweck. Rechte, Modell, Hooks und MCP gibt
// sich eine Session nie selbst; die Tür hat für sie kein Feld.
//
// Gesetzt wird am eigenen Slot und für die Nachfolge (`naechster`): ein Neustart derselben Belegung behält ihren Start. Die Nachfolge macht
// `naechster` zu `jetzt` und hält fest, was neu ist (`neu`); daraus macht das Board sein Zeichen („gave itself N stones“). Rein.
import { MAX_AGENTMD_BYTES } from "./agentmd";
import { packAuswahlVon } from "./sitz-wissen";

export interface SelbstStart {
  /** Packs zusätzlich zu dem, was die Bibliothek diesem Sitz gibt, in der Reihenfolge der Tür */
  readonly packs: readonly string[];
  /** der Zweck, den die Vorgängerin geschrieben hat */
  readonly zweck: string | null;
}
export interface SlotSelbst {
  /** womit diese Belegung gestartet ist */
  readonly jetzt: SelbstStart;
  /** was die Nachfolgerin bekommt; null = dasselbe wie jetzt */
  readonly naechster: SelbstStart | null;
  /** was diese Belegung gegenüber ihrer Vorgängerin neu bekam, je Stein ein Wort: die Pack-Ids, dann „purpose“ */
  readonly neu: readonly string[];
}

export const ZWECK_MAX_BYTES = MAX_AGENTMD_BYTES;
const LEER: SelbstStart = { packs: [], zweck: null };
const leer = (x: SelbstStart): boolean => !x.packs.length && x.zweck === null;

/** Der Block im Systemzusatz. Er sagt, wer ihn schrieb: nicht der Owner, sondern die Vorgängerin. */
export const zweckBlock = (zweck: string): string => `PURPOSE (written for you by your predecessor in this slot):\n${zweck}`;

/** DIE TÜR: `purpose` (Text oder null) und `packs` (Ids), beide optional; ein fehlendes Feld bleibt, wie es für die Nachfolgerin steht.
 *  Ob jede Id ein Pack ist, den dieser Sitz bekommen kann, prüft der Server (packAuswahlFehlt). */
export function einrichtenDerTuer(body: unknown, s: SlotSelbst | null):
  { ok: true; naechster: SelbstStart } | { ok: false; error: string } {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  const fremd = b ? Object.keys(b).filter((k) => k !== "purpose" && k !== "packs") : [];
  if (fremd.length) return { ok: false, error: `this door only adds text — it reads purpose and packs, never ${fremd.join(", ")} (rights, model, hooks and MCP are the owner's)` };
  if (!b || !("purpose" in b || "packs" in b)) return { ok: false, error: 'expected { "purpose": text | null, "packs": [pack ids] } — one of them at least' };
  const bisher = s ? s.naechster ?? s.jetzt : LEER;
  let zweck = bisher.zweck;
  if ("purpose" in b) {
    if (b.purpose === null) zweck = null;
    else if (typeof b.purpose !== "string" || !b.purpose.trim()) return { ok: false, error: "purpose must be a non-empty text, or null to take it back" };
    else if (Buffer.byteLength(b.purpose.trim()) > ZWECK_MAX_BYTES) return { ok: false, error: `purpose is larger than ${ZWECK_MAX_BYTES / 1000} KB` };
    else zweck = b.purpose.trim();
  }
  let packs = bisher.packs;
  if ("packs" in b) {
    const liste = Array.isArray(b.packs) ? packAuswahlVon(b.packs) : null;
    if (liste === null) return { ok: false, error: "packs must be a list of distinct pack ids" };
    packs = liste === false ? [] : liste;
  }
  return { ok: true, naechster: { packs: [...packs], zweck } };
}

/** Der Slot nach der Tür: `naechster` steht, solange er sich von `jetzt` unterscheidet; null, wenn nichts mehr gesetzt ist. */
export function mitNaechstem(s: SlotSelbst | null, naechster: SelbstStart): SlotSelbst | null {
  const jetzt = s?.jetzt ?? LEER;
  const gleich = gleicherStart(jetzt, naechster);
  if (leer(jetzt) && gleich) return null;
  return { jetzt, naechster: gleich ? null : naechster, neu: s?.neu ?? [] };
}
const gleicherStart = (a: SelbstStart, b: SelbstStart): boolean => a.zweck === b.zweck && a.packs.join("\n") === b.packs.join("\n");

/** WAS DIE NACHFOLGERIN TRÄGT: der nächste Start wird ihr jetziger, und `neu` nennt, was sie gegenüber der Vorgängerin mehr hat. */
export function selbstDerNachfolge(s: SlotSelbst | null): SlotSelbst | null {
  if (!s) return null;
  const jetzt = s.naechster ?? s.jetzt;
  if (leer(jetzt)) return null;
  return { jetzt, naechster: null, neu: neuGegenueber(jetzt, s.jetzt) };
}
export function neuGegenueber(jetzt: SelbstStart, vorher: SelbstStart): string[] {
  const war = new Set(vorher.packs);
  return [...jetzt.packs.filter((id) => !war.has(id)), ...(jetzt.zweck !== null && jetzt.zweck !== vorher.zweck ? ["purpose"] : [])];
}

/** Die Zeilen der Antwort: was die Nachfolgerin gegenüber diesem Start mehr (+), weniger (−) oder anders (~) bekommt. */
export function einrichtenZeilen(jetzt: SelbstStart, naechster: SelbstStart): string[] {
  const war = new Set(jetzt.packs), wird = new Set(naechster.packs);
  const erste = (t: string): string => { const z = t.split("\n")[0]!; return z.length > 80 ? `${z.slice(0, 79)}…` : z; };
  return [...naechster.packs.filter((id) => !war.has(id)).map((id) => `+ Pack ${id}`),
    ...jetzt.packs.filter((id) => !wird.has(id)).map((id) => `− Pack ${id}`),
    ...(naechster.zweck !== null && jetzt.zweck === null ? [`+ Zweck: ${erste(naechster.zweck)}`]
      : naechster.zweck === null && jetzt.zweck !== null ? ["− Zweck"]
      : naechster.zweck !== jetzt.zweck ? [`~ Zweck: ${erste(naechster.zweck!)}`] : [])];
}

/** Die Zeile im Brief der Nachfolgerin; null, wenn sie nichts Neues hat. */
export function nachfolgeZeile(s: SlotSelbst | null): string | null {
  if (!s?.neu.length) return null;
  return `New compared with your predecessor's start (that session gave you these; they are in your system prompt addition): ${s.neu
    .map((w) => w === "purpose" ? "+ purpose" : `+ pack ${w}`).join(", ")}.`;
}

/** Was fleet.json hält: nur eine lesbare Form. */
export function slotSelbstGeladen(raw: unknown): SlotSelbst | null {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  const start = (v: unknown): SelbstStart | null => {
    const o = v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
    const packs = o && Array.isArray(o.packs) ? packAuswahlVon(o.packs) : null;
    return o && packs !== null && (o.zweck === null || typeof o.zweck === "string") ? { packs: packs || [], zweck: o.zweck as string | null } : null;
  };
  const jetzt = r ? start(r.jetzt) : null;
  if (!r || !jetzt) return null;
  const naechster = r.naechster === null || r.naechster === undefined ? null : start(r.naechster);
  const neu = Array.isArray(r.neu) && r.neu.every((w) => typeof w === "string") ? r.neu as string[] : [];
  return { jetzt, naechster, neu };
}
