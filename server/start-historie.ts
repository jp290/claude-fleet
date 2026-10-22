// DIE HISTORIE GESTARTETER SESSIONS (Harness 2.0 Schritt 2, docs/konstellation/modell.md §4 Teil 1: „eine Historie gestarteter Sessions, aus
// der man neu startet oder ein Profil macht“). Start-Quittungen (context-receipts.jsonl) schreibt nur ein Start mit Plan; diese Historie hat
// jeden: openSlot schreibt beim Öffnen eine Zeile mit dem, was die Session bekam (Ort, Agent, Modell, Effort, Rechte, Profil mit dem Hash
// seiner Agent-MD), die Tür, die einen Öffner kennt, eine zweite. Gelesen wird zusammengeführt, neueste zuerst. Ein Eintrag ist ein offenes
// Objekt: Aufgabe, Konstellation und Ergebnis eines Laufs (Schritt 3–4) kommen als weitere Felder dazu.
import { join } from "node:path";
import { aufgabeAus, type Aufgabe } from "../src/aufgabe";
import type { AgentMd } from "./agentmd";
import type { Opener } from "./opener";
import { json } from "./json";
import { appendEvent, binnenGrenze, readEventLog } from "./persist";
import type { Rechte } from "../session-rechte";

export const HISTORIE_DATEI = "start-historie.jsonl";
export const HISTORIE_MAX = 200;

interface Belegung {
  id: number; openedAt: number; cwd: string | null; label: string | null; harness: string | null; model: string | null; effort: string | null;
  rechte: Rechte | null; agentMd: AgentMd | null; worktree: { branch: string } | null;
}
export interface StartEintrag {
  slot: number; openedAt: number; at: number; cwd: string; label: string | null; harness: string | null; model: string | null; effort: string | null;
  branch: string | null; repo: string | null; goal: string | null; aufgabe: Aufgabe | null;
  lauf: LaufNachtrag | null; rechte: Rechte | null; profil: { id: string; titel: string; sha256: string; name: string | null } | null; openedBy: Opener | null;
}

export function merkeStart(s: Belegung, dir: string, jetzt = Date.now()): Promise<void> {
  if (!s.cwd) return Promise.resolve();
  return binnenGrenze(appendEvent(join(dir, HISTORIE_DATEI), { art: "start", slot: s.id, openedAt: s.openedAt, at: jetzt, cwd: s.cwd, label: s.label,
    harness: s.harness, model: s.model, effort: s.effort, branch: s.worktree?.branch ?? null, rechte: s.rechte,
    profil: s.agentMd ? { id: s.agentMd.profil, titel: s.agentMd.titel, sha256: s.agentMd.sha256, name: s.agentMd.name ?? null } : null }));
}
// was eine Tür erst nach dem Öffnen weiß: wer sie geöffnet hat, der Branch einer Branch-Session mit ihrem Ziel und ihrer Aufgabe
export type Nachtrag = { openedBy: Opener } | { branch: string; repo: string; goal?: string; aufgabe?: Aufgabe }
  | { lauf: LaufNachtrag };
export interface LaufNachtrag { id: string; pos: string; posName: string; konst: string; name: string; version: number | null; hash: string }
export function merkeNachtrag(slot: number, openedAt: number, n: Nachtrag, dir: string): Promise<void> {
  return binnenGrenze(appendEvent(join(dir, HISTORIE_DATEI), { art: "nachtrag", slot, openedAt, ...n }));
}

const laufVon = (v: unknown): LaufNachtrag | null => {
  const o = v && typeof v === "object" ? v as Record<string, unknown> : null;
  return o && [o.id, o.pos, o.konst, o.name, o.hash].every((x) => typeof x === "string")
    ? { id: String(o.id), pos: String(o.pos), posName: typeof o.posName === "string" ? o.posName : String(o.pos), konst: String(o.konst), name: String(o.name),
      version: typeof o.version === "number" ? o.version : null, hash: String(o.hash) } : null;
};
const zahl = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) ? v : null;
const text = (v: unknown): string | null => typeof v === "string" ? v : null;
export async function liesHistorie(dir: string, max = HISTORIE_MAX): Promise<StartEintrag[]> {
  const { rows } = await readEventLog(join(dir, HISTORIE_DATEI));
  const key = (r: Record<string, unknown>) => `${String(r.slot)}@${String(r.openedAt)}`;
  const nachtrag = new Map<string, Record<string, unknown>>();
  for (const r of rows) if (r.art === "nachtrag") nachtrag.set(key(r), { ...nachtrag.get(key(r)), ...r });
  const out: StartEintrag[] = [];
  for (const r of rows) {
    const slot = zahl(r.slot), openedAt = zahl(r.openedAt), at = zahl(r.at), cwd = text(r.cwd);
    if (r.art !== "start" || slot === null || openedAt === null || at === null || cwd === null) continue;
    const n = nachtrag.get(key(r)) ?? {}, by = n.openedBy, au = n.aufgabe === undefined ? null : aufgabeAus(n.aufgabe);
    out.push({ slot, openedAt, at, cwd, label: text(r.label), harness: text(r.harness), model: text(r.model), effort: text(r.effort),
      branch: text(n.branch) ?? text(r.branch), repo: text(n.repo), goal: text(n.goal), aufgabe: typeof au === "string" ? null : au, lauf: laufVon(n.lauf),
      rechte: r.rechte && typeof r.rechte === "object" ? r.rechte as Rechte : null,
      profil: r.profil && typeof r.profil === "object" ? r.profil as StartEintrag["profil"] : null,
      openedBy: by && typeof by === "object" ? by as Opener : null });
  }
  return out.reverse().slice(0, max);
}

// GET HISTORIE_ROUTE?max=N: die letzten Starts, neueste zuerst; server.ts hängt sie hinter das Owner-Tor
export async function startHistorie(req: Request, url: URL, dir: string): Promise<Response> {
  if (req.method !== "GET") return json({ error: "nur GET" }, 405);
  const m = Number(url.searchParams.get("max") ?? 50);
  if (!Number.isInteger(m) || m < 1 || m > HISTORIE_MAX) return json({ error: `max ist eine ganze Zahl von 1 bis ${HISTORIE_MAX}` }, 400);
  return json({ starts: await liesHistorie(dir, m) });
}
