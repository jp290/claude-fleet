// K15 ENTWURF D · SPALTE 1, das heutige Startfenster, schmal: oben die Konstellation, darunter die Rollen (Profile) und der Branch.
// Das Repo steht seit dem Owner-Urteil vom 16.10. im Kopf des Fensters („[Zitat entfernt]“, src/k15-repo.ts).
import { el } from "./k15-haupt";
import { icon } from "./icons";
import { alle, herkunftVon, pos, type Konst, type Position } from "./k15-entwurf-modell";
import { S, gehe, gewaehlt, toast } from "./k15-zustand";
import { geaendertTag, kennzeichen, kopfzeile, profilHerkunft, unterkopf } from "./k15-teile";
import { oeffneAblauf } from "./k15-agentmd";

export const ROLLE_MIME = "text/x-k15-rolle";

// eine kleine Zeichnung der Konstellation: Punkte je Session, Linien je Meldeweg
function mini(k: Konst): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 28 28");
  svg.setAttribute("class", "k15mini");
  svg.setAttribute("aria-hidden", "true");
  const ebenen: Position[][] = [];
  const lauf = (ps: Position[], t: number) => { for (const p of ps) { (ebenen[t] ??= []).push(p); lauf(p.kids ?? [], t + 1); } };
  lauf(k.wurzeln, 0);
  const pt = new Map<string, [number, number]>();
  ebenen.forEach((lv, t) => lv.forEach((p, i) => pt.set(p.id, [(i + 1) * 28 / (lv.length + 1), ebenen.length === 1 ? 14 : 5 + t * 18 / (ebenen.length - 1)])));
  const linie = (a?: [number, number], b?: [number, number]) => {
    if (!a || !b) return;
    const l = document.createElementNS(NS, "line");
    l.setAttribute("x1", String(a[0])); l.setAttribute("y1", String(a[1])); l.setAttribute("x2", String(b[0])); l.setAttribute("y2", String(b[1]));
    svg.append(l);
  };
  for (const p of alle(k.wurzeln)) for (const c of p.kids ?? []) linie(pt.get(p.id), pt.get(c.id));
  if (k.quer) for (let i = 1; i < k.wurzeln.length; i++) linie(pt.get(k.wurzeln[i - 1].id), pt.get(k.wurzeln[i].id));
  for (const [x, y] of pt.values()) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", String(x)); c.setAttribute("cy", String(y)); c.setAttribute("r", "2.6");
    svg.append(c);
  }
  return svg;
}

export function spalteLinks(): HTMLElement {
  const s = S;
  const col = el("section", "k15col k15c1");
  if (!s) return col;
  col.append(kopfzeile(0, "welche Sessions zusammenarbeiten"));
  for (const k of s.konst) {
    const b = el("button", `k15konst${k === s.k ? " on" : ""}`);
    const g = el("span", "k15minibox");
    g.append(mini(k));
    const t = el("span", "k15kt");
    const ks = el("span", "k15ks");
    ks.append(...kennzeichen(herkunftVon(k), k.v), ...(s.konstNeu.has(k.id) ? [geaendertTag("ungespeicherte Änderung am Aufbau")] : []), k.satz);
    t.append(el("span", "k15kn", k.name), ks);
    b.append(g, t);
    b.onclick = () => {
      s.k = k;
      const ps = alle(k.wurzeln);
      const erste = ps.find((p) => p.datei) ?? ps[ps.length - 1];
      s.sel = { art: "pos", id: erste.id };
      s.quelle = "landet";
      gehe(1, 1);
    };
    col.append(b);
  }
  const neu = el("div", "k15row2");
  const n1 = el("button", "k15ghost");
  n1.append(icon("plus"), el("span", "", "Neue Konstellation"));
  n1.onclick = () => {
    const id = `n${Date.now()}`;
    const k: Konst = { id, name: "Neue Konstellation", v: 1, satz: "beginnt mit einer Session", eigen: true, wurzeln: [pos(`${id}-1`, "Branch-Session", "bau")] };
    s.konst.push(k);
    s.k = k;
    s.sel = { art: "pos", id: k.wurzeln[0].id };
    s.quelle = "landet";
    toast("Neue Konstellation angelegt. Zieh Rollen aus der linken Spalte auf eine Session, um sie darunter einzuhängen.");
    gehe(1, 1);
  };
  const n2 = el("button", "k15ghost");
  n2.append(icon("copy"), el("span", "", "JSON einfügen"));
  n2.onclick = () => toast("Füg eine exportierte Konstellation mit ⌘V ein oder zieh die Datei ins Fenster.");
  neu.append(n1, n2);
  col.append(neu);

  col.append(unterkopf("Rollen", "Profile · auf eine Session ziehen"));
  const { q } = gewaehlt(s);
  for (const p of s.profile) {
    const on = s.sel.art === "profil" && s.sel.id === p.id;
    const b = el("button", `k15role${on ? " on" : ""}${q?.profil === p.id ? " nutzt" : ""}`);
    b.title = p.satz;
    b.draggable = true;
    b.ondragstart = (e) => { e.dataTransfer?.setData(ROLLE_MIME, p.id); if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy"; };
    const g = el("span", "fdglyph");
    g.append(icon(p.glyph));
    const t = el("span", "k15kt");
    const ks = el("span", "k15ks");
    ks.append(...kennzeichen(profilHerkunft(p), p.v),
      ...(s.profilNeu.has(p.id) ? [geaendertTag("ungespeicherte Änderung am Profil")] : []), el("span", "", p.kurz));
    t.append(el("span", "k15kn", p.name), ks);
    b.append(g, t);
    b.onclick = () => { s.sel = { art: "profil", id: p.id }; gehe(2, 1); };
    col.append(b);
  }
  // DEINE AGENT-MD (Owner 16.10.): in vier Schritten zum eigenen Profil
  const md = el("button", "k15ghost k15mdneu");
  md.append(icon("file"), el("span", "", "Eigene Agent-MD einrichten"));
  md.title = "Datei wählen, Abschnitte lesen und ändern, sehen, was Fleet dazugibt, als Profil speichern";
  md.onclick = () => oeffneAblauf(s);
  const drop = el("div", "k15drop");
  drop.append(icon("file"), el("span", "", "Ordner oder .md hierher ziehen"));
  col.append(md, drop);

  const wt = el("button", "k15opt on");
  const w = el("span", "k15optw");
  w.append("Neu aus ", el("code", "", "main"));
  wt.append(w, icon("check"));
  col.append(unterkopf("Branch", "worauf die Session arbeitet"), wt);
  return col;
}
