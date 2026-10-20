// K15 · DAS PROTOKOLL DER GEWÄHLTEN KONSTELLATION (Harness 2.0 Schritt 3, k15-entwurf-modell.ts#Protokoll): unter den Fassungen im Aufbau eine
// Zeile, aufgeklappt drei Felder: die Endbedingung (meist die CI, abschaltbar), höchstens wie viele Runden, nach welcher Regel geprüft wird.
// Es gehört zur Konstellation: Speichern legt es mit in die Fassung, der Vergleich zweier Fassungen zeigt es Feld für Feld.
import { el } from "./k15-haupt";
import { render, type St } from "./k15-zustand";
import { ENDE_CI, protokollLeer, type Protokoll } from "./k15-entwurf-modell";
import { nachDemKlick } from "./nach-dem-klick";

const LEER: Protokoll = { ende: null, runden: null, regel: null };
const offen = new Set<string>();

// ändert ein Teil des Protokolls der gewählten Konstellation, auf dem Stand von jetzt; der Aufbau gilt dann als ungespeichert
function setze(s: St, teil: Partial<Protokoll>): void {
  const neu = { ...s.k, protokoll: { ...(s.k.protokoll ?? LEER), ...teil } };
  s.konst = s.konst.map((x) => x === s.k ? neu : x);
  s.k = neu;
  s.konstNeu.add(neu.id);
}
export const protokollSatz = (p: Protokoll | undefined): string => protokollLeer(p) || !p ? "keins; der Lauf endet, wenn ihr ihn beendet"
  : [p.ende ? `endet: ${p.ende}` : "ohne Endbedingung", ...(p.runden ? [`höchstens ${p.runden} Runden`] : []), ...(p.regel ? ["mit Prüfregel"] : [])].join(" · ");

export function protokollTeil(s: St): HTMLElement {
  const id = s.k.id, p = s.k.protokoll ?? LEER, auf = offen.has(id);
  const box = el("div", `k15fass k15prot${auf ? " offen" : ""}`);
  const k = el("button", "k15fkopf") as HTMLButtonElement;
  k.type = "button";
  k.setAttribute("aria-expanded", String(auf));
  k.append(el("b", "", "Protokoll"), el("span", "", protokollSatz(s.k.protokoll)));
  k.title = "Wann ein Lauf dieser Konstellation endet, wie viele Runden er höchstens hat und nach welcher Regel geprüft wird. Alles ist frei.";
  k.onclick = () => { if (auf) offen.delete(id); else offen.add(id); render(); };
  box.append(k);
  if (!auf) return box;

  const ende = el("label", "k15frow k15protz");
  const an = document.createElement("input");
  an.type = "checkbox";
  an.checked = p.ende !== null;
  an.onchange = () => { setze(s, { ende: an.checked ? ENDE_CI : null }); render(); };
  const t = document.createElement("input");
  t.className = "k15packin";
  t.value = p.ende ?? "";
  t.placeholder = ENDE_CI;
  t.disabled = p.ende === null;
  t.dataset.feld = "prot-ende";
  t.oninput = () => { setze(s, { ende: t.value.trim() || ENDE_CI }); };
  t.onchange = () => { nachDemKlick(render); };
  ende.append(an, el("span", "", "Endbedingung"), t);

  const runden = el("label", "k15frow k15protz");
  const r = document.createElement("input");
  r.className = "k15packin k15protzahl";
  r.inputMode = "numeric";
  r.value = p.runden === null ? "" : String(p.runden);
  r.placeholder = "ohne";
  r.dataset.feld = "prot-runden";
  r.oninput = () => {
    const n = Number(r.value.trim());
    if (!r.value.trim()) setze(s, { runden: null });
    else if (Number.isInteger(n) && n >= 1 && n <= 99) setze(s, { runden: n });
  };
  r.onchange = () => { nachDemKlick(render); };
  runden.append(el("span", "", "Höchstens"), r, el("span", "", "Runden"));

  const regel = el("label", "k15frow k15protz");
  const g = document.createElement("input");
  g.className = "k15packin";
  g.value = p.regel ?? "";
  g.placeholder = "z. B. fertig, wenn der Gegenspieler den Schnitt nicht mehr bricht";
  g.dataset.feld = "prot-regel";
  g.oninput = () => { setze(s, { regel: g.value.trim() || null }); };
  g.onchange = () => { nachDemKlick(render); };
  regel.append(el("span", "", "Prüfregel"), g);

  box.append(ende, runden, regel);
  return box;
}
