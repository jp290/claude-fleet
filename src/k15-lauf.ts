// K15 · DER LAUF BEIM START (Harness 2.0 Schritt 4a, server/laeufe.ts): startet das Fenster eine Position einer gespeicherten Konstellation,
// bindet es den Slot danach an einen Lauf: an den laufenden, wenn schon eine Session dieser Konstellation in einem sitzt, sonst an einen neuen
// auf der gespeicherten Fassung. Ohne gespeicherten Stand, oder mit einer Änderung, die noch nicht gespeichert ist, startet sie ohne Lauf,
// denn der Lauf soll sagen, womit gelaufen wurde. Der Satz unter dem Start sagt, welcher Fall gilt.
import { api, flotte } from "./k15-haupt";
import { LAEUFE_ROUTE } from "./k15-speicher";
import { render, S, type St } from "./k15-zustand";
import type { Aufgabe } from "./aufgabe";

interface LaufKopf { id: string; konst: string; hash: string; version: number | null; positionen: { pos: string; slot: number; openedAt: number }[]; zuEnde: boolean }
let liste: LaufKopf[] | "laedt" | null = null;
const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
function kopf(v: unknown): LaufKopf | null {
  const r = rec(v);
  if (!r || typeof r.id !== "string" || typeof r.konst !== "string" || typeof r.hash !== "string" || !Array.isArray(r.positionen)) return null;
  const positionen = r.positionen.flatMap((x: unknown) => {
    const p = rec(x);
    return p && typeof p.pos === "string" && typeof p.slot === "number" && typeof p.openedAt === "number" ? [{ pos: p.pos, slot: p.slot, openedAt: p.openedAt }] : [];
  });
  return { id: r.id, konst: r.konst, hash: r.hash, version: typeof r.version === "number" ? r.version : null, positionen, zuEnde: !!r.ende };
}
function lies(): void {
  liste = "laedt";
  void api(LAEUFE_ROUTE).then((r) => r.json()).then((j: unknown) => {
    const l = rec(j)?.laeufe;
    liste = Array.isArray(l) ? l.flatMap((x: unknown) => { const k = kopf(x); return k ? [k] : []; }) : [];
    if (S) render();
  }, () => { liste = []; });
}

// nach einem Ende von Hand (src/lauf-ansicht.ts) liest der nächste Satz die Liste neu
export function vergissLaeufe(): void { liste = null; }
const sitzt = (p: { slot: number; openedAt: number }): boolean => flotte().some((x) => x.id === p.slot && !!x.cwd && x.openedAt === p.openedAt);
// der Lauf dieser Konstellation, in dem gerade eine Session sitzt (dieselbe Belegung wie beim Binden) und der nicht von Hand beendet ist; der neueste zuerst
function laufend(s: St): LaufKopf | null {
  if (liste === null) lies();
  if (!Array.isArray(liste)) return null;
  return liste.find((l) => l.konst === s.k.id && !l.zuEnde && l.positionen.some(sitzt)) ?? null;
}
const ohneLauf = (s: St): string | null => !s.konstGespeichert.has(s.k.id) ? "Ohne Lauf: erst eine gespeicherte Konstellation startet einen."
  : s.konstNeu.has(s.k.id) ? "Ohne Lauf: der Aufbau hat eine ungespeicherte Änderung; der Lauf soll sagen, womit gelaufen wurde." : null;

const zahlLaufend = (n: number): string => `${n} ${n === 1 ? "läuft" : "laufen"} darin`;
export function laufSatz(s: St): string {
  const ohne = ohneLauf(s);
  if (ohne) return ohne;
  const l = laufend(s);
  return l ? `Kommt in den laufenden Lauf (Fassung ${l.version !== null ? `v${l.version} · ` : ""}${l.hash.slice(0, 8)}, ${zahlLaufend(l.positionen.filter(sitzt).length)}).`
    : "Startet einen neuen Lauf auf der gespeicherten Fassung.";
}

// NACH DEM START: der Slot kommt in den Lauf; der Satz sagt, ob und wo, oder warum nicht
export async function bindeLauf(s: St, pos: string, slot: number, aufgabe: Aufgabe | null): Promise<string | null> {
  if (ohneLauf(s)) return null;
  const l = laufend(s);
  try {
    const r = await api(LAEUFE_ROUTE, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ konst: s.k.id, pos, slot, ...(l ? { lauf: l.id } : aufgabe ? { aufgabe } : {}) }) });
    const j = rec(await r.json().catch(() => null));
    liste = null;
    if (!r.ok) return `Ohne Lauf: ${typeof j?.error === "string" ? j.error : `Antwort ${r.status}`}`;
    const k = kopf(j?.lauf);
    return k ? `${l ? "im laufenden Lauf" : "in einem neuen Lauf"} ${k.id} (Fassung ${k.version !== null ? `v${k.version} · ` : ""}${k.hash.slice(0, 8)})` : null;
  } catch (e) {
    return `Ohne Lauf: ${e instanceof Error ? e.message : "nicht erreichbar"}`;
  }
}
