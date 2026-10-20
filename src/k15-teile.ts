// K15 ENTWURF D · kleine Bausteine der Oberfläche, die mehrere Spalten benutzen: Kennzeichen, Schalter, Auswahlmenü, Spaltenköpfe
import { el } from "./k15-haupt";
import { icon } from "./icons";
import { DU, FLEET, type Herkunft, type Profil } from "./k15-entwurf-modell";
import { S, render } from "./k15-zustand";
import { WER_WORT, type Wer } from "./k15-wer";

export const SPALTEN = ["Konstellation", "Aufbau", "Session", "Quelle"] as const;

// KENNZEICHEN statt Sätzen (Owner 11:1x): woher etwas kommt (Fleet, eigene, von einem Autor) und ob es geändert ist. Owner 12:3x:
// „[Zitat entfernt]“
// : die Herkunft getönt, die Version daneben als eigenes, neutrales Tag
export function kennzeichen(h: Herkunft, v?: number | string): HTMLElement[] {
  const t = h.art === "fleet" ? el("span", "k15tag fleet", "Fleet") : h.art === "autor" ? el("span", "k15tag autor", `von ${h.name}`) : el("span", "k15tag eigen", "eigene");
  t.title = h.art === "fleet" ? "Fleet-Vorlage: mitgeliefert; ändern geht an einer Kopie" : h.art === "autor" ? `importiert, geschrieben von ${h.name}; hier deine bearbeitbare Kopie` : "deine eigene, bearbeitbar";
  return v === undefined ? [t] : [t, verTag(v)];
}
// KENNZEICHEN NUR, WO ES ETWAS SAGT (Runde 4, Owner Z60: „[Zitat entfernt]“): in einer Liste trägt eine Zeile ihre Herkunft nur, wenn Fleet
// sie nicht mitliefert; „[Zitat entfernt]“ steht einmal im Kopf der Liste (fleetKopf), Herkunft und Version jeder Zeile in ihrem Title
export const herkunftWenn = (h: Herkunft): HTMLElement[] => h.art === "fleet" ? [] : kennzeichen(h);
export const herkunftTitel = (h: Herkunft, v: number | string): string =>
  `${h.art === "fleet" ? "Fleet-Vorlage, mitgeliefert" : h.art === "autor" ? `importiert, von ${h.name}` : "deine eigene"} · ${typeof v === "number" ? `Version ${v}` : v}`;
export function fleetKopf(): HTMLElement {
  const t = kennzeichen({ art: "fleet" })[0];
  t.title = "Was in dieser Liste kein Kennzeichen trägt, liefert Fleet mit; eigene und importierte sind markiert. Die Version steht im Title jeder Zeile.";
  return t;
}
export function verTag(v: number | string, title?: string): HTMLElement {
  const t = el("span", "k15tag ver", typeof v === "number" ? `v${v}` : v);
  t.title = title ?? (typeof v === "number" ? `Version ${v}` : v);
  return t;
}
// die Version eines Profils oder Bausteins: dasselbe Tag wie neben der Herkunft
export const chip = (v: number | string, title?: string): HTMLElement => verTag(v, title);
// EINE EIGENE, DIE NUR IM FENSTER STEHT (Partner 20.10.: „[Zitat entfernt]“ sah nach gespeichert aus): bearbeitbar, am Server erst nach dem Speichern
export function nichtGespeichertTag(): HTMLElement {
  const t = el("span", "k15tag neu", "nicht gespeichert");
  t.title = "Bearbeitbar, aber noch nicht am Server; „Speichern“ legt sie dort ab, mit ihrer ersten Fassung.";
  return t;
}
export function geaendertTag(title: string): HTMLElement {
  const t = el("span", "k15tag neu", "geändert");
  t.title = title;
  return t;
}
// woher ein Profil kommt: Fleet, deine eigene Fassung oder ein Autor
export const profilHerkunft = (p: Profil): Herkunft => p.autor === FLEET ? { art: "fleet" } : p.autor === DU ? { art: "eigen" } : { art: "autor", name: p.autor };

export function kopfzeile(i: number, say: string): HTMLElement {
  const h = el("div", "k15lab");
  h.append(el("span", "k15labi", String(i + 1)), el("span", "k15labw", SPALTEN[i]), el("span", "k15labs", say));
  return h;
}
export function unterkopf(word: string, say?: string): HTMLElement {
  const h = el("div", "k15sub");
  h.append(el("span", "k15subw", word));
  if (say) h.append(el("span", "k15labs", say));
  return h;
}
// eine Zahl, die erst beim Darüberfahren erscheint, oder überall mit „Alles zeigen“ (Owner 16.10.: „[Zitat entfernt]“
// ); sie hält ihren Platz, damit beim Darüberfahren nichts springt
export const nachZahl = (cls: string, text: string): HTMLElement => el("span", `${cls} k15n`, text);
export { istSchalter } from "./k15-wer";
// WER BESTIMMT (src/k15-wer.ts) als Kennzeichen: das Wort sichtbar, Grund und Herleitung beim Darüberfahren. „änderbar“ bleibt leise,
// was fest ist, trägt die Farbe dessen, der es festlegt (Fleet wie das Fleet-Kennzeichen, Claude Code grau)
export function werTag(w: Wer): HTMLElement {
  const t = el("span", `k15tag wer ${w.art}`, WER_WORT[w.art]);
  t.title = w.art === "du" ? "Du stellst es hier ein." : `${w.grund}\n${w.herleitung}`;
  return t;
}
// ein Knopf, der sich abschalten lässt (el() gibt ein HTMLElement)
export function knopf(cls: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = cls;
  return b;
}
export function schalt(an: boolean, title: string, onClick: () => void): HTMLElement {
  const sw = el("button", `k15tog${an ? " on" : ""}`);
  sw.title = title;
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", String(an));
  sw.setAttribute("aria-label", title);
  sw.append(el("span", "", ""));
  sw.onclick = onClick;
  return sw;
}
// eine Option mit `aus` steht im Menü, ist aber nicht wählbar; `aus` steht daneben, `grund` im Title
export interface Option { wert: string; wort: string; aus?: string; grund?: string }
export function waehle(anker: HTMLElement, optionen: Option[], jetzt: string, nimmt: (v: string) => void): void {
  const s = S;
  const win = s?.shell.root.querySelector<HTMLElement>(".shellwin");
  if (!s || !win) return;
  win.querySelector(".k15menu")?.remove();
  const m = el("div", "k15menu");
  m.setAttribute("role", "menu");
  for (const o of optionen) {
    const b = knopf(o.wert === jetzt ? "on" : "");
    b.setAttribute("role", "menuitemradio");
    b.setAttribute("aria-checked", String(o.wert === jetzt));
    b.dataset.wert = o.wert;
    b.append(el("span", "", o.wort));
    if (o.wert === jetzt) b.append(icon("check"));
    if (o.aus) {
      b.disabled = true;
      b.title = o.grund ?? o.aus;
      b.append(el("span", "k15menuaus", o.aus));
    }
    b.onclick = () => { m.remove(); nimmt(o.wert); };
    m.append(b);
  }
  const a = anker.getBoundingClientRect(), wr = win.getBoundingClientRect();
  m.style.left = `${Math.max(8, Math.min(a.left - wr.left, wr.width - 208))}px`;
  m.style.top = `${a.bottom - wr.top + 4}px`;
  win.append(m);
  m.querySelector<HTMLElement>("button.on")?.focus();
  const zu = (e: Event) => { if (!(e.target instanceof Node && m.contains(e.target))) { m.remove(); document.removeEventListener("pointerdown", zu, true); } };
  document.addEventListener("pointerdown", zu, true);
}

// SPALTE 4: der Kopf einer Ansicht (Titel, Version, ein Satz oder ein Pfad darunter) und eine Leiste mit „alle auf-/zuklappen“
export function qTitel(t: string, v: number | string | null, unter: string, pfad = false): HTMLElement[] {
  const h = el("div", "k15qh");
  h.append(el("span", "k15qn", t));
  if (v !== null) h.append(chip(v));
  return [h, el("div", pfad ? "k15qp" : "k15qd", unter)];
}
export function qLeiste(say: string, keys: string[], zahl = false): HTMLElement {
  const r = el("div", "k15qs");
  r.append(el("span", zahl ? "k15n" : "", say));
  const s = S;
  if (s && keys.length) {
    const zu = keys.every((x) => s.offen.has(x));
    const b = el("button", "k15link", zu ? "alle zuklappen" : "alle aufklappen");
    b.onclick = () => { for (const x of keys) { if (zu) s.offen.delete(x); else s.offen.add(x); } render(); };
    r.append(b);
  }
  return r;
}
