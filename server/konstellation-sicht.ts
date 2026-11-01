// EIN SITZ SIEHT DIE KONSTELLATION, IN DER ER STEHT, NICHT SICH SELBST (F6, Owner 29.10.: Agenten sollen „[Zitat entfernt]“ und „[Zitat entfernt]“ handeln). GET /api/self/constellation zeigt die Sitze, denen er schreiben darf — die
// Öffnerin, die Kinder, ihre Geschwister, wie server/selbst-sitze.ts#sitzGegenseite sie als Paare zählt (sie folgen der Linie, eine Nachfolge ändert nichts) — und die Positionen
// seiner gespeicherten Konstellation (Slot.sitz), gestartet oder nicht. Je Sitz: Platz, Name, Ordner, Rolle, Titel des Zwecks, Harness, Modell, Effort, Zustand und die Adresse,
// an die der Aufrufer schreibt. Nie etwas von seinem eigenen Start: kein Darf, keine Packs, kein Hash, kein Token — der Owner nannte die Tür auf den eigenen Aufbau „[Zitat entfernt]“.
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { agentMdText } from "./agentmd";
import { istOeffnerin, type Opener } from "./opener";
import { neuesterInhaber, sitzGegenseite } from "./selbst-sitze";
import { roleStein } from "./setup-datei";
import { ordnerHinweis } from "./konstellation-aus-sitzen";
import type { StartEintrag } from "./start-historie";

/** Was die Sicht von einem lebenden Sitz braucht. */
export interface SichtSlot {
  slot: number; openedAt: number; cwd: string | null; linie?: string | null; openedBy: Opener | null; rolleStein: { id: string; name: string } | null;
  label: string | null; harness: string | null; model: string | null; effort: string | null; agentTitel: string | null;
  sitz: { konst: string; pos: string } | null;
}
export interface PositionBild { id: string; name: string; vater: string | null; role: { id: string; name: string } | null; purpose: string | null;
  harness: string | null; model: string | null; effort: string | null; hint: string | null }
export interface PositionenBild { konst: string; positionen: PositionBild[] }

export interface SichtSitz {
  slot: number | null; position: string | null; name: string; relations: string[];
  folder: { path: string | null; hint: string | null }; role: { id: string; name: string } | null; purpose: string | null;
  harness: string | null; model: string | null; effort: string | null; state: "live" | "ended" | "not-started";
  address: { kind: "session"; slot: number } | null; roleAddress?: { kind: "role"; role: string } }
export interface Sicht {
  me: { slot: number; role: { id: string; name: string } | null; reportsTo: { slot: number | null; position?: string; name: string; state: "live" | "ended" | "not-started" } | null;
    position: { konst: string; pos: string; name: string } | null };
  seats: SichtSitz[];
}

const MAX_BEENDET = 10;
// hat der Datensatz `a` den Sitz `b` als Öffnerin? Nach ihrer Linie (server/opener.ts#istOeffnerin), ein alter Datensatz nach Platz und Ordner
const echtVon = (a: Opener | null, b: { slot: number; cwd: string | null; linie?: string | null }): boolean => istOeffnerin(b, a);

/** Der Ordner: der Pfad nur, wenn er unter der Wurzel des Aufrufers liegt, sonst nur der Name des Ordners; der Hinweis ist der Pfad relativ zur Wurzel. */
export function ordnerSicht(cwd: string | null, root: string): { path: string | null; hint: string | null } {
  if (!cwd) return { path: null, hint: null };
  const rel = ordnerHinweis(cwd, root);
  return rel === null ? { path: null, hint: basename(cwd) } : { path: cwd, hint: rel };
}

/** Die Positionen einer gespeicherten Konstellation (k15-eigenes.json) in der Sicht; null, wenn es sie hier nicht gibt. */
export function liesPositionen(dir: string, konst: string): PositionenBild | null {
  let form: Record<string, unknown> | undefined;
  try {
    const roh = JSON.parse(readFileSync(join(dir, SPEICHER_DATEI), "utf8")) as { konstellationen?: unknown };
    form = (Array.isArray(roh.konstellationen) ? roh.konstellationen : []).find((k): k is Record<string, unknown> => !!k && typeof k === "object" && (k as { id?: unknown }).id === konst);
  } catch { return null; }
  if (!form || !Array.isArray(form.positionen)) return null;
  const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
  const positionen = form.positionen.map(rec).flatMap((p): PositionBild[] => {
    if (!p || typeof p.id !== "string") return [];
    const profil = rec(p.profil), abw = rec(p.abweichend), sitz = rec(p.sitz);
    const rid = typeof sitz?.rolle === "string" ? sitz.rolle : null;
    const stein = rid ? roleStein(rid, dir) : null;
    const md = profil?.datei === undefined ? null : agentMdText(profil.datei);
    const wert = (k: "agent" | "modell" | "effort"): string | null => { const v = abw?.[k] ?? profil?.[k]; return typeof v === "string" && v ? v : null; };
    return [{ id: p.id, name: typeof p.name === "string" ? p.name : p.id, vater: typeof p.meldetAn === "string" ? p.meldetAn : null,
      role: rid ? { id: rid, name: stein?.role.name ?? rid } : null,
      // der Starttext einer Rolle steht als Datei des Profils (schreibeMehrSitz): er ist der der Rolle, kein Zweck des Sitzes
      purpose: md && !(stein && md.text === stein.role.start.text) ? md.titel : null,
      harness: wert("agent"), model: wert("modell"), effort: wert("effort"), hint: typeof rec(p.ordner)?.hint === "string" ? String(rec(p.ordner)!.hint) : null }];
  });
  return { konst, positionen };
}

export function konstellationSicht(e: { ich: SichtSlot; lebende: readonly SichtSlot[]; root: string; historie: readonly StartEintrag[]; positionen: PositionenBild | null }): Sicht {
  const { ich, root } = e;
  const lebende = e.lebende.filter((x) => x.cwd !== null);
  const name = (x: SichtSlot): string => x.label ?? x.rolleStein?.name ?? `Seat ${x.slot}`;
  const live = (x: SichtSlot, relations: string[]): SichtSitz => ({ slot: x.slot, position: null, name: name(x), relations,
    folder: ordnerSicht(x.cwd, root), role: x.rolleStein ? { ...x.rolleStein } : null, purpose: x.agentTitel, harness: x.harness, model: x.model, effort: x.effort,
    state: "live", address: { kind: "session", slot: x.slot },
    ...(x.rolleStein && neuesterInhaber(lebende, x.rolleStein.id)?.slot === x.slot ? { roleAddress: { kind: "role" as const, role: x.rolleStein.id } } : {}) });
  const seats: SichtSitz[] = [];

  // 1. die Paare der Postfach-Regel: Öffnerin, Kinder, Geschwister — lebend
  const paare = lebende.filter((x) => x.slot !== ich.slot && sitzGegenseite(ich, x)).sort((a, b) => a.slot - b.slot);
  for (const x of paare)
    seats.push(live(x, [echtVon(ich.openedBy, x) ? "opener" : echtVon(x.openedBy, ich) ? "child" : "sibling"]));

  // 2. beendet: Kinder und Öffnerin, die in der Historie stehen, aber keinen lebenden Sitz in ihrer Linie mehr haben
  const beendetAus = (e2: StartEintrag, relation: string): SichtSitz => ({ slot: e2.slot, position: null, name: e2.label ?? `Seat ${e2.slot}`, relations: [relation],
    folder: ordnerSicht(e2.cwd, root), role: null, purpose: e2.profil?.titel ?? null, harness: e2.harness, model: e2.model, effort: e2.effort, state: "ended", address: null });
  const neuesteJe = new Map<string, StartEintrag>();
  for (const h of [...e.historie].sort((a, b) => a.openedAt - b.openedAt)) neuesteJe.set(`${h.slot}@${h.cwd}`, h);
  const kinder = [...neuesteJe.values()].filter((h) => echtVon(h.openedBy, ich) || e.historie.some((x) => x.slot === h.slot && x.cwd === h.cwd && echtVon(x.openedBy, ich)));
  for (const h of kinder.sort((a, b) => b.openedAt - a.openedAt).slice(0, MAX_BEENDET))
    if (!lebende.some((x) => x.slot === h.slot && x.cwd === h.cwd) && h.slot !== ich.slot) seats.push(beendetAus(h, "child"));
  if (ich.openedBy && !lebende.some((x) => echtVon(ich.openedBy, x))) {
    const h = neuesteJe.get(`${ich.openedBy.slot}@${ich.openedBy.cwd}`);
    seats.push(h ? beendetAus(h, "opener") : { slot: ich.openedBy.slot, position: null, name: `Seat ${ich.openedBy.slot}`, relations: ["opener"], folder: ordnerSicht(ich.openedBy.cwd, root),
      role: null, purpose: null, harness: null, model: null, effort: null, state: "ended", address: null });
  }

  // 3. die Positionen der gespeicherten Konstellation: der lebende Halter, falls einer da ist, sonst „nicht gestartet“
  const konst = e.positionen && ich.sitz?.konst === e.positionen.konst ? e.positionen : null;
  const meine = konst?.positionen.find((p) => p.id === ich.sitz?.pos) ?? null;
  for (const p of konst?.positionen ?? []) {
    if (p.id === ich.sitz?.pos) continue;
    const halter = lebende.find((x) => x.slot !== ich.slot && x.sitz?.konst === konst!.konst && x.sitz.pos === p.id);
    const schon = halter ? seats.find((s) => s.slot === halter.slot) : undefined;
    if (schon) { schon.position = p.id; schon.relations.push("position"); continue; }
    if (halter) { seats.push({ ...live(halter, ["position"]), position: p.id, address: null }); delete (seats.at(-1) as { roleAddress?: unknown }).roleAddress; continue; }
    seats.push({ slot: null, position: p.id, name: p.name, relations: ["position"], folder: { path: null, hint: p.hint }, role: p.role, purpose: p.purpose,
      harness: p.harness, model: p.model, effort: p.effort, state: "not-started", address: null });
  }

  // 4. wem er meldet: der Öffnerin, sonst der Position über seiner
  const oeffnerin = seats.find((s) => s.relations.includes("opener"));
  const vater = meine?.vater ? konst?.positionen.find((p) => p.id === meine.vater) ?? null : null;
  const vaterSitz = vater ? seats.find((s) => s.position === vater.id) : undefined;
  const reportsTo = oeffnerin ? { slot: oeffnerin.slot, name: oeffnerin.name, state: oeffnerin.state }
    : vater ? { slot: vaterSitz?.slot ?? null, position: vater.id, name: vater.name, state: vaterSitz?.state ?? "not-started" as const } : null;
  return { me: { slot: ich.slot, role: ich.rolleStein ? { ...ich.rolleStein } : null, reportsTo,
      position: ich.sitz && meine ? { konst: ich.sitz.konst, pos: ich.sitz.pos, name: meine.name } : null }, seats };
}
