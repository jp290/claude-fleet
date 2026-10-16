// K15 ENTWURF D · SPALTE 2, der Aufbau der gewählten Konstellation als Baum kompakter Session-Karten; oben, wer anleitet. Eine Karte
// zeigt Rolle, Name und Kennzeichen; Modell, Effort, Übergabe und was sie vom Profil abweicht erst beim Darüberfahren oder mit „Alles
// zeigen“ (Owner 16.10.: „[Zitat entfernt]“).
import { el, bausteinName } from "./k15-haupt";
import { icon } from "./icons";
import {
  GRUPPEN, KONST0, abweichungen, ahnen, alle, eltern, herkunftVon, istName, orchHinweis, orchZahl, pos, umfangVon, type Konst, type Position, type Profil,
} from "./k15-entwurf-modell";
import { S, antwort, gehe, lage, plural, profilVon, schwelleWahl, toast, wahlVon, type St } from "./k15-zustand";
import { geaendertTag, kennzeichen, kopfzeile, profilHerkunft, verTag } from "./k15-teile";
import { ROLLE_MIME } from "./k15-spalte1";

// der Name eines Bausteins, wie das Startfenster ihn nennt; die ID nur, wenn der Plan ihn nicht kennt
export const nameVon = (s: St, p: Profil, id: string): string => {
  const b = antwort(lage(s, p, null)?.voll ?? "laedt")?.plan.bausteine.find((x) => x.id === id);
  return b ? bausteinName(b) : id;
};

function fuegeAn(s: St, vater: Position | null, profilId: string): void {
  const p = profilVon(s, profilId);
  const gleiche = alle(s.k.wurzeln).filter((x) => x.profil === p.id).length;
  // ein Profil mit eigener Agent-MD gibt sie der neuen Session mit
  const neu = pos(`p${Date.now()}`, gleiche ? `${p.name} ${gleiche + 1}` : p.name, p.id, p.datei ? { datei: structuredClone(p.datei) } : {});
  if (vater) vater.kids = [...(vater.kids ?? []), neu];
  else s.k.wurzeln = [...s.k.wurzeln, neu];
  s.konstNeu.add(s.k.id);
  s.sel = { art: "pos", id: neu.id };
  s.quelle = "landet";
  toast(vater ? `${neu.name} meldet jetzt an ${vater.name}.` : `${neu.name} steht jetzt für sich im Aufbau.`);
  gehe(2, 1);
}
// eine Fleet-Vorlage bleibt, wie sie ist; geändert wird eine eigene Kopie
function kopiere(s: St, k: Konst): void {
  const neu: Konst = { ...structuredClone(k), id: `c${Date.now()}`, name: `${k.name} (Kopie)`, v: 1, eigen: true };
  s.konst.push(neu);
  s.k = neu;
  const ps = alle(neu.wurzeln);
  if (s.sel.art === "pos" && !ps.some((x) => x.id === s.sel.id)) s.sel = { art: "pos", id: ps[ps.length - 1]?.id ?? "" };
  toast(`${neu.name} v1 ist jetzt deine eigene Konstellation. Die Vorlage bleibt unverändert.`);
  gehe(1, 0);
}
export function entferne(s: St, q: Position): void {
  const vater = eltern(s.k, q.id);
  if (vater) vater.kids = (vater.kids ?? []).filter((c) => c !== q);
  else s.k.wurzeln = s.k.wurzeln.filter((c) => c !== q);
  s.konstNeu.add(s.k.id);
  const rest = alle(s.k.wurzeln);
  s.sel = { art: "pos", id: (vater ?? rest[0])?.id ?? "" };
  toast(`${q.name}${q.kids?.length ? ` und ${plural(alle(q.kids).length, "Session", "Sessions")} darunter` : ""} aus dem Aufbau genommen.`);
  gehe(1, 1);
}

export function spalteAufbau(ansichten: readonly string[]): HTMLElement {
  const s = S;
  const col = el("section", "k15col k15c2");
  if (!s) return col;
  col.append(kopfzeile(1, "wer wem meldet, von oben nach unten"));
  const name = el("div", "k15kname");
  const tags = el("span", "k15tags");
  tags.append(...kennzeichen(herkunftVon(s.k), s.k.v));
  name.append(el("span", "", s.k.name), tags);
  col.append(name);
  const meta = el("div", "k15kmeta");
  if (s.konstNeu.has(s.k.id)) meta.append(geaendertTag("ungespeicherte Änderung am Aufbau"));
  if (!s.k.eigen) {
    const kopie = el("button", "k15link", "Kopieren");
    kopie.title = "Eine Fleet-Vorlage bleibt, wie sie ist; die Kopie wird deine eigene.";
    kopie.onclick = () => kopiere(s, s.k);
    meta.append(kopie);
  }
  if (meta.childElementCount) col.append(meta);
  if (s.k.heuteNicht) col.append(el("div", "k15hinweis", s.k.heuteNicht));
  const orch = orchHinweis(orchZahl(s.k, s.profile));
  if (orch) col.append(el("div", "k15hinweis", orch));
  const weg = s.sel.art === "pos" ? ahnen(s.k, s.sel.id) : new Set<string>();
  const nutzt = s.sel.art === "profil" ? s.sel.id : null;
  const karte = (q: Position): HTMLElement => {
    const p = profilVon(s, q.profil);
    const on = s.sel.art === "pos" && s.sel.id === q.id;
    const b = el("button", `k15card${on ? " on" : ""}${weg.has(q.id) ? " weg" : ""}${nutzt === q.profil ? " nutzt" : ""}`);
    b.dataset.id = q.id;
    const top = el("span", "k15ct");
    const g = el("span", "fdglyph");
    g.append(icon(p.glyph));
    // ein Kennzeichen am Ende (Owner 11:1x): unverändert aus Fleet, geändert gegenüber dem Profil, oder deine eigene
    const geaendert = abweichungen(p, q, (id) => nameVon(s, p, id));
    const fassung = istName(q, p) ? `v${p.v}` : `${p.name} v${p.v}`;
    const kz = el("span", "k15tags");
    kz.append(...kennzeichen(p.id === "eigen" ? { art: "eigen" } : profilHerkunft(p)));
    kz.append(verTag(fassung, `Profil ${p.name} in Version ${p.v}`));
    if (geaendert.length) kz.append(geaendertTag(`${plural(geaendert.length, "Änderung", "Änderungen")} gegenüber ${p.name} v${p.v}`));
    top.append(g, el("span", "k15cn", q.name), kz);
    const sw = schwelleWahl(s, p, q);
    const umfang = p.rolle === "nur-ordner" ? "" : GRUPPEN.filter((x) => umfangVon(p, q, x.id) !== "standard")
      .map((x) => ` · ${x.wort}: ${umfangVon(p, q, x.id) === "pflicht" ? "nur Pflicht" : "alles"}`).join("");
    const x = el("span", "k15x k15cx");
    x.append(el("span", "k15cs", `${wahlVon(s, p, q, "modell").wort} · ${wahlVon(s, p, q, "effort").wort} · ${sw.pct === null ? "Übergabe ?" : sw.pct <= 0 ? "Übergabe aus" : `Übergabe ab ${sw.pct} %`}${umfang}`));
    if (geaendert.length) x.append(el("span", "k15xk", `gegenüber ${p.name} v${p.v}`), ...geaendert.map((z) => el("span", "", z)));
    b.append(top, x);
    b.onclick = () => { s.sel = { art: "pos", id: q.id }; if (!ansichten.includes(s.quelle)) s.quelle = "landet"; gehe(2, 2); };
    b.addEventListener("dragover", (e) => { if (e.dataTransfer?.types.includes(ROLLE_MIME)) { e.preventDefault(); b.classList.add("ziel"); } });
    b.addEventListener("dragleave", () => b.classList.remove("ziel"));
    b.addEventListener("drop", (e) => {
      const id = e.dataTransfer?.getData(ROLLE_MIME);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      fuegeAn(s, q, id);
    });
    return b;
  };
  const plus = (vater: Position | null): HTMLElement => {
    const b = el("button", "k15plus");
    b.append(icon("plus"), el("span", "", vater ? `Session unter ${vater.name}` : "Session daneben"));
    b.onclick = () => fuegeAn(s, vater, vater?.kids?.[0]?.profil ?? (vater ? "lane" : s.k.wurzeln[0]?.profil ?? "bau"));
    return b;
  };
  const ast = (q: Position): HTMLElement => {
    const box = el("div", `k15ast${weg.has(q.id) ? " weg" : ""}`);
    box.append(karte(q));
    if (q.kids?.length) {
      const kids = el("div", "k15kids");
      for (const c of q.kids) kids.append(ast(c));
      box.append(kids);
      if (q.kids.every((c) => !c.kids?.length)) box.append(plus(q));
    }
    return box;
  };
  const baum = el("div", "k15baum");
  s.k.wurzeln.forEach((q, i) => {
    if (i > 0 && s.k.quer) baum.append(el("div", "k15quer", s.k.quer));
    baum.append(ast(q));
  });
  if (!s.k.wurzeln.some((q) => q.kids?.length)) baum.append(plus(null));
  col.append(baum);
  if (s.konstNeu.has(s.k.id)) {
    const box = el("div", "k15sfuss");
    box.append(el("span", "k15labs", s.k.eigen ? "Der Aufbau ist geändert und noch nicht gespeichert." : "Die Vorlage ist geändert. Speichern legt eine eigene Konstellation an; die Vorlage bleibt."));
    const a = el("button", "k15ghost", s.k.eigen ? `Als v${s.k.v + 1} speichern` : "Als eigene speichern");
    a.onclick = () => toast("Entwurf: Speichern baut erst der Server-Teil. Bis zum Neuladen bleibt die Änderung hier.");
    box.append(a);
    const orig = KONST0.find((x) => x.id === s.k.id);
    if (orig) {
      const z = el("button", "k15ghost", "Zurücksetzen");
      z.onclick = () => {
        const frisch = structuredClone(orig);
        s.konst = s.konst.map((x) => x === s.k ? frisch : x);
        s.k = frisch;
        s.konstNeu.delete(frisch.id);
        const ps = alle(frisch.wurzeln);
        s.sel = { art: "pos", id: ps[ps.length - 1].id };
        gehe(1, 1);
      };
      box.append(z);
    }
    col.append(box);
  }
  return col;
}
