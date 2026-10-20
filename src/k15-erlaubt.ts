// K15 · WAS EINE KONSTELLATION ERLAUBT (Harness 2.0 Schritt 6, docs/konstellation/modell.md Änderung 10, harness-2-0-antwort.md Lücke 5):
// vor dem Start je Session, womit sie läuft und was sie darf: Agent und ob er hier startet, Modell, Permission-Mode (nur Claude Code setzt
// ihn), Agent-MD, Autonomie und abweichende Bausteine. Im Aufbau unter dem Protokoll; nach einem Import steht es offen (k15-export.ts#nimmRoh).
import { el } from "./k15-haupt";
import { render, type St } from "./k15-zustand";
import { erlaubtZeilen } from "./k15-erlaubt-modell";

// offen oder zu, je Konstellation, auch nach dem Neuladen (Partner 20.10.); ohne Browser-Speicher bis zum Schließen
const OFFEN_KEY = "fleet.k15.erlaubt";
const offen = new Set<string>((() => { try { const v: unknown = JSON.parse(localStorage.getItem(OFFEN_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; } catch { return []; } })());
const merke = (): void => { try { localStorage.setItem(OFFEN_KEY, JSON.stringify([...offen].slice(-50))); } catch { /* ohne Speicher gilt es bis zum Schließen */ } };
export const erlaubtOeffnen = (konstId: string): void => { offen.add(konstId); merke(); };

export function erlaubtTeil(s: St): HTMLElement {
  const id = s.k.id, auf = offen.has(id), zeilen = erlaubtZeilen(s.k, s.profile, s.katalog ?? null);
  const warn = zeilen.filter((z) => z.warnung).length;
  const box = el("div", `k15fass k15erl${auf ? " offen" : ""}`);
  const k = el("button", "k15fkopf") as HTMLButtonElement;
  k.type = "button";
  k.setAttribute("aria-expanded", String(auf));
  k.append(el("b", "", "Was sie erlaubt"), el("span", "", `${zeilen.length} Sessions${warn ? `, ${warn} starten hier nicht` : ""}`));
  k.title = "Je Session, womit sie läuft und was sie darf, bevor etwas startet";
  k.onclick = () => { if (auf) offen.delete(id); else offen.add(id); merke(); render(); };
  box.append(k);
  if (!auf) return box;
  for (const z of zeilen) {
    const r = el("div", "k15frow k15erlz");
    r.append(el("b", "", z.name), el("span", "", z.satz), ...(z.warnung ? [el("span", "k15erlw", z.warnung)] : []));
    box.append(r);
  }
  return box;
}
