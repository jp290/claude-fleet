// DIE TÜREN EINES STARTS (K15 Runde 5, Owner 17.10.: das neue Fenster löst das alte Startfenster ab, „[Zitat entfernt]“
// ). Was das Fenster „[Zitat entfernt]“ (src/k15-entwurf.ts) beim Starten an den
// Server schickt, über genau die Routen, die das alte Fenster (src/founding.ts bis Runde 5) nahm: eine neue Lane über /api/lanes oder
// /api/slots/:id/open-worktree, eine fortgesetzte über /api/lanes mit attach, Orchestratorin und Session ohne Rolle über
// /api/slots/:id/open, eine MAIN über /api/programs/:id/bootstrap-main, eine Branch-Session über /api/branches und /api/branches/open.
// Ein Start trägt den Hash des Plans, den das Fenster zeigte; ein 409 mit staleHash bringt den Plan von jetzt zurück und startet nichts.
// Dieses Modul liegt im Haupt-Bundle (es braucht post und revealStartedSlot aus client.ts) und geht über src/k15-lader.ts ans Fenster.
import { api, post, revealStartedSlot } from "./client";
import type { BranchesView, BranchOtherView, LaneAnchor } from "./protocol";
import type { Rechte } from "../session-rechte";
import type { Aufgabe } from "./aufgabe";

export interface Dreier { harness?: string; model?: string; effort?: string }
// der Plan, wie ihn die Tür prüft (server.ts#acceptFoundingPlan): Hash, Rolle und die Schalter, mit denen das Fenster ihn las, in der
// Form seiner Adresse („id=zustand,…“)
export interface PlanKoerper { hash: string; role: string; bausteine?: string }
export type Auftrag =
  | { tuer: "lane"; repo: string; dreier: Dreier; plan: PlanKoerper; slot?: number; parent?: LaneAnchor }
  | { tuer: "lane-fort"; repo: string; worktree: string; dreier: Dreier; slot?: number }
  | { tuer: "open"; cwd: string; slot: number; dreier: Dreier; plan: PlanKoerper | null; fassung?: string; label?: string; rechte?: Rechte; profil?: string; bibliothek?: boolean;
      // „<konst>/<position>“: der Sitz startet mit dem, was mitreiste (server/sitz-reise.ts#sitzDerTuer)
      sitz?: string }
  | { tuer: "main"; program: string; cwd: string; dreier: Dreier }
  | { tuer: "branch"; repo: string; name: string; punkte: string[]; ziel: string; dreier: Dreier; bestehend?: string; gemacht?: string; rechte?: Rechte; profil?: string; aufgabe?: Aufgabe;
      // Fleets Bibliothek für diese Session (server.ts#seatLibraryOn); ohne Angabe entscheidet der Ort
      bibliothek?: boolean; sitz?: string };
// `bewegt`: die Antwort des Plans von jetzt (409 staleHash); `gemacht`: der Branch steht schon, nur seine Session startete nicht;
// `vorhanden`: den Board-Namen trägt in diesem Repo schon ein anderer Branch
export type Antwort =
  | { ok: true; slot: number; hinweis?: string }
  | { ok: false; fehler: string; bewegt?: unknown; gemacht?: string; vorhanden?: { branch: string; name: string } };

const nichtErreichbar = (e: unknown): Antwort => ({ ok: false, fehler: `Der Server ist nicht erreichbar: ${e instanceof Error ? e.message : String(e)}` });
const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;

export async function starte(a: Auftrag): Promise<Antwort> {
  try {
    if (a.tuer === "main") return await gruendeMain(a);
    if (a.tuer === "branch") return await oeffneBranch(a);
    if (a.tuer === "lane") {
      const url = a.slot !== undefined ? `/api/slots/${a.slot}/open-worktree` : "/api/lanes";
      return await tuer(url, { repo: a.repo, ...(a.parent ? { parent: a.parent } : {}), branch: "", ...a.dreier, plan: a.plan }, a.slot);
    }
    if (a.tuer === "lane-fort")
      return await tuer("/api/lanes", { repo: a.repo, attach: a.worktree, ...(a.slot !== undefined ? { slot: a.slot } : {}), ...a.dreier }, a.slot);
    return await tuer(`/api/slots/${a.slot}/open`, { cwd: a.cwd, ...(a.label ? { label: a.label } : {}), ...a.dreier, ...(a.plan ? { plan: a.plan } : {}), ...(a.fassung ? { fassung: a.fassung } : {}),
      ...(a.rechte ? { rechte: a.rechte } : {}), ...(a.profil ? { profil: a.profil } : {}), ...(a.bibliothek !== undefined ? { bibliothek: a.bibliothek } : {}),
      ...(a.sitz ? { sitz: a.sitz } : {}) }, a.slot);
  } catch (e) {
    return nichtErreichbar(e);
  }
}

// EINE TÜR: ein 409 mit dem bewegten Plan startet nichts; jede andere Ablehnung steht, wie der Server sie schrieb
async function tuer(url: string, body: Record<string, unknown>, platz?: number): Promise<Antwort> {
  const res = await post(url, body);
  const j = rec(await res.json().catch(() => null));
  if (res.status === 409 && typeof j?.staleHash === "string")
    return { ok: false, fehler: "Der Plan hat sich seit der Vorschau bewegt — nichts gestartet. Das Fenster zeigt jetzt den Plan von jetzt; Starten nimmt ihn.", bewegt: j };
  if (!res.ok) return { ok: false, fehler: typeof j?.error === "string" ? j.error : `Der Server antwortete ${res.status}.` };
  const slot = typeof j?.slot === "number" ? j.slot : platz;
  // die Session steht; dass ihre Packs nicht ankamen, bleibt sichtbar
  const hinweis = j?.packsDelivered === false ? typeof j.reason === "string" ? j.reason : "Die Session steht, aber ihre Packs kamen nicht an." : undefined;
  if (slot === undefined || !await revealStartedSlot(slot)) return { ok: false, fehler: "Die Session steht, aber ihr Slot erschien nicht binnen 5 Sekunden." };
  return { ok: true, slot, ...(hinweis ? { hinweis } : {}) };
}

// DIE TÜR DER MAIN nimmt keinen Plan. Eine Ablehnung steht mit Status und jedem weiteren Feld der Antwort (ein 503 trägt availability,
// recovery und affected neben dem Satz); existing:true heißt, das Program hat schon eine lebende MAIN, gegründet wurde nichts
async function gruendeMain(a: Extract<Auftrag, { tuer: "main" }>): Promise<Antwort> {
  const res = await post(`/api/programs/${encodeURIComponent(a.program)}/bootstrap-main`, { cwd: a.cwd, ...a.dreier });
  const j: unknown = await res.json().catch(() => null);
  const r = rec(j);
  if (!res.ok) {
    const { error, ...rest } = r ?? {};
    const mehr = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
    return { ok: false, fehler: typeof error === "string" && error ? `Abgelehnt (${res.status}): ${error}${mehr}` : `Abgelehnt (${res.status}), ohne lesbaren Grund${mehr}` };
  }
  const main = rec(rec(r?.program)?.main);
  if (r?.existing === true)
    return { ok: false, fehler: `Das Program hat schon eine lebende MAIN${typeof main?.slot === "number" ? ` auf Slot ${main.slot}` : ""}. Nichts wurde gegründet.` };
  if (typeof r?.slot !== "number") return { ok: false, fehler: `Die Antwort nennt keinen Slot: ${JSON.stringify(j)}` };
  if (!await revealStartedSlot(r.slot)) return { ok: false, fehler: `Die MAIN steht, aber Slot ${r.slot} erschien nicht binnen 5 Sekunden.` };
  return { ok: true, slot: r.slot };
}

// DIE BRANCH-SESSION: erst der Branch mit Board-Namen und Punkten (POST /api/branches), dann seine Session (POST /api/branches/open) mit
// dem Ziel als erster Nachricht. Steht der Branch schon (`gemacht`), startet nur die Session
async function oeffneBranch(a: Extract<Auftrag, { tuer: "branch" }>): Promise<Antwort> {
  let branch = a.gemacht;
  if (!branch) {
    const r = await post("/api/branches", { repo: a.repo, name: a.name, points: a.punkte, ...(a.bestehend ? { branch: a.bestehend } : {}) });
    const j = rec(await r.json().catch(() => null));
    const ex = rec(j?.existing);
    if (r.status === 409 && ex && typeof ex.branch === "string" && typeof ex.name === "string")
      return { ok: false, fehler: `Den Namen „${ex.name}“ trägt in diesem Repo schon ${ex.branch}.`, vorhanden: { branch: ex.branch, name: ex.name } };
    if (!r.ok || typeof j?.branch !== "string") return { ok: false, fehler: `Der Branch entstand nicht: ${typeof j?.error === "string" ? j.error : `Antwort ${r.status}`}` };
    branch = j.branch;
  }
  const r = await post("/api/branches/open", { repo: a.repo, branch, ...(a.aufgabe ? { aufgabe: a.aufgabe } : a.ziel ? { goal: a.ziel } : {}), ...a.dreier, ...(a.rechte ? { rechte: a.rechte } : {}), ...(a.profil ? { profil: a.profil } : {}),
    ...(a.bibliothek !== undefined ? { bibliothek: a.bibliothek } : {}), ...(a.sitz ? { sitz: a.sitz } : {}) });
  const j = rec(await r.json().catch(() => null));
  if (!r.ok || typeof j?.slot !== "number")
    return { ok: false, fehler: `„${a.name}“ steht mit seinen Punkten, die Session startete nicht: ${typeof j?.error === "string" ? j.error : `Antwort ${r.status}`}`, gemacht: branch };
  if (!await revealStartedSlot(j.slot)) return { ok: false, fehler: `Die Session steht, aber Slot ${j.slot} erschien nicht binnen 5 Sekunden.` };
  return { ok: true, slot: j.slot };
}

// DIE PROGRAMS FÜR EINE MAIN, nur die aktiven, die freien zuerst. `zustand` ist health.occupancy des Servers (derselbe Vergleich, den
// bootstrap-main vor dem Gründen macht); eine Zeile mit offener Gründung oder ohne lesbare Belegung ist „unbekannt“, nie geraten frei
export type ProgZustand = "frei" | "alt" | "lebt" | "unbekannt";
export interface ProgZeile { id: string; titel: string; zustand: ProgZustand; slot: number | null }
export const waehlbar = (p: ProgZeile): boolean => p.zustand === "frei" || p.zustand === "alt";
export function progSagt(p: ProgZeile): string {
  if (p.zustand === "lebt") return `MAIN läuft${p.slot !== null ? ` auf Slot ${p.slot}` : ""}`;
  if (p.zustand === "alt") return `alte MAIN weg${p.slot !== null ? ` (Slot ${p.slot})` : ""} — wird ersetzt`;
  if (p.zustand === "frei") return "ohne MAIN";
  return "Belegung unbekannt";
}
function progZeile(x: unknown): ProgZeile | "inaktiv" | null {
  const r = rec(x);
  if (!r || typeof r.id !== "string" || !r.id) return null;
  if (r.status !== "active") return "inaktiv";
  const titel = typeof r.title === "string" && r.title.trim() ? r.title : r.id;
  const main = rec(r.main);
  const slot = typeof main?.slot === "number" ? main.slot : null;
  const occ = rec(r.health)?.occupancy;
  const zustand: ProgZustand = r.founding !== undefined && r.founding !== null ? "unbekannt"
    : occ === "live" ? "lebt" : occ === "stale" ? "alt" : occ === "unbound" ? "frei" : "unbekannt";
  return { id: r.id, titel, zustand, slot };
}
export async function liesPrograms(): Promise<{ zeilen: ProgZeile[]; inaktiv: number } | { fehler: string }> {
  try {
    const res = await api("/api/programs");
    const j = rec(await res.json().catch(() => null));
    if (!res.ok || !Array.isArray(j?.programs)) return { fehler: `Die Programs sind nicht lesbar (Antwort ${res.status}).` };
    const zeilen: ProgZeile[] = [];
    let inaktiv = 0;
    for (const x of j.programs) {
      const p = progZeile(x);
      if (p === "inaktiv") inaktiv++;
      else if (p) zeilen.push(p);
    }
    const rang: Record<ProgZustand, number> = { frei: 0, alt: 1, lebt: 2, unbekannt: 3 };
    zeilen.sort((a, b) => rang[a.zustand] - rang[b.zustand] || a.titel.localeCompare(b.titel));
    return { zeilen, inaktiv };
  } catch {
    return { fehler: "Die Programs konnten nicht geladen werden — der Server ist nicht erreichbar." };
  }
}

// die Branches eines Repos ohne Board-Namen, für „Bestehend“ (GET /api/branches → others)
export async function liesAndere(repo: string): Promise<{ zeilen: BranchOtherView[]; gesamt: number } | { fehler: string }> {
  try {
    const r = await api("/api/branches");
    const j = (await r.json().catch(() => null)) as BranchesView | { error?: string } | null;
    const zeile = j && "repos" in j ? j.repos.find((x) => x.repo === repo) : undefined;
    if (!r.ok) return { fehler: `Die Branches kamen nicht (${(j && "error" in j && j.error) || r.status}).` };
    if (!zeile) return { fehler: "Dieses Repo führt das Board nicht." };
    return { zeilen: zeile.others, gesamt: zeile.othersTotal };
  } catch {
    return { fehler: "Der Server ist nicht erreichbar." };
  }
}
