// K15 ENTWURF D · SPALTE 2, der Aufbau der gewählten Konstellation als Baum kompakter Session-Karten; oben, wer anleitet. Eine Karte
// zeigt Rolle, Name, Kennzeichen und darunter Agent und Modell (Runde 4, Owner Z62); Effort, Succession und was sie vom Profil abweicht erst
// beim Darüberfahren oder mit „Alles zeigen“ (Owner 16.10.: „[Zitat entfernt]“).
import { mitgereistTeil } from "./k15-mitgereist";
import { el, bausteinName } from "./k15-haupt";
import { harnessMark, icon } from "./icons";
import { modelLabel } from "./modelname";
import {
  GRUPPEN, KONST0, abweichungen, ahnen, alle, eltern, herkunftVon, istName, orchHinweis, orchZahl, pos, umfangVon, type Konst, type Position, type Profil,
} from "./k15-entwurf-modell";
import { S, antwort, gehe, lage, nurImFenster, plural, profilVon, schwelleWahl, speichereKonst, toast, wahlVon, type St } from "./k15-zustand";
import { geaendertTag, herkunftTitel, herkunftWenn, kennzeichen, kopfzeile, nichtGespeichertTag, profilHerkunft } from "./k15-teile";
import { NEU_SATZ, ROLLE_MIME, satzVon } from "./k15-spalte1";
import { fassungenNeu, fassungenTeil } from "./k15-konst-fassungen";
import { protokollTeil } from "./k15-protokoll";
import { erlaubtTeil } from "./k15-erlaubt";

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
  const neu: Konst = { ...structuredClone(k), id: `c${Date.now()}`, name: `${k.name} (Kopie)`, v: 1, eigen: true, satz: NEU_SATZ };
  s.konst.push(neu);
  s.k = neu;
  s.konstNeu.add(neu.id);
  const ps = alle(neu.wurzeln);
  if (s.sel.art === "pos" && !ps.some((x) => x.id === s.sel.id)) s.sel = { art: "pos", id: ps[ps.length - 1]?.id ?? "" };
  toast(`${neu.name} v1 ist jetzt deine eigene Konstellation. Die Vorlage bleibt unverändert.`);
  gehe(1, 0);
}
// SPEICHERN (Konstellation Stück 1, Owner 19.10.): eine eigene Konstellation geht auf den Server (k15-zustand.ts#speichereKonst) und ist
// nach dem Schließen noch da, eine schon gespeicherte als nächste Fassung. Eine geänderte Fleet-Vorlage wird dabei eine eigene, und die
// Vorlage steht wieder, wie Fleet sie liefert. `name` ist, was im Feld davor steht.
// was im Namensfeld getippt ist, je Konstellation: so übersteht es ein Neuzeichnen
const nameEntwurf = new Map<string, string>();
function speichere(s: St, name: string): void {
  const k = s.k;
  const orig = KONST0.find((x) => x.id === k.id && !x.eigen);
  const neu: Konst = k.eigen ? { ...k, name: name || k.name, satz: satzVon(k), v: s.konstGespeichert.has(k.id) ? k.v + 1 : k.v }
    : { ...k, id: `c${Date.now()}`, name: name || `${k.name} (eigene)`, v: 1, eigen: true, satz: satzVon({ ...k, eigen: true, satz: NEU_SATZ }) };
  void speichereKonst(s, neu.id, neu).then((ok) => {
    if (!ok || S !== s) return;
    s.konst = k.eigen ? s.konst.map((x) => x === k ? neu : x) : [...s.konst.map((x) => x === k && orig ? structuredClone(orig) : x), neu];
    if (s.k === k) s.k = neu;
    s.konstNeu.delete(k.id);
    s.konstNeu.delete(neu.id);
    nameEntwurf.delete(k.id);
    fassungenNeu(neu.id);
    toast(`${neu.name} v${neu.v} ist auf dem Server gespeichert und nach dem Schließen noch da.`);
    gehe(1, 1);
  });
}
// LÖSCHEN nimmt sie vom Server; „Rückgängig“ im Satz legt sie wieder hin. Eine gespeicherte Fassung einer eigenen Fleet-Vorlage
// („MAIN ↔ MAIN“) macht der Vorlage wieder Platz.
function loesche(s: St, k: Konst): void {
  const vorlage = KONST0.find((x) => x.id === k.id);
  const zeige = (x: Konst) => { s.k = x; s.sel = { art: "pos", id: alle(x.wurzeln)[0]?.id ?? "" }; };
  void speichereKonst(s, k.id, null).then((ok) => {
    if (!ok || S !== s) return;
    s.konst = vorlage ? s.konst.map((x) => x === k ? structuredClone(vorlage) : x) : s.konst.filter((x) => x !== k);
    s.konstNeu.delete(k.id);
    if (s.k === k) zeige(s.konst.find((x) => x.id === "orch") ?? s.konst[0]);
    toast(`${k.name} ist gelöscht.`, { wort: "Rückgängig", tu: () => void speichereKonst(s, k.id, k).then((wieder) => {
      if (!wieder || S !== s) return;
      s.konst = vorlage ? s.konst.map((x) => x.id === k.id ? k : x) : [...s.konst, k];
      zeige(k);
      toast(`${k.name} v${k.v} ist wieder da.`);
      gehe(1, 1);
    }) });
    gehe(0, 0);
  });
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
  else if (nurImFenster(s, s.k)) meta.append(nichtGespeichertTag());
  if (!s.k.eigen) {
    const kopie = el("button", "k15link", "Kopieren");
    kopie.title = "Eine Fleet-Vorlage bleibt, wie sie ist; die Kopie wird deine eigene.";
    kopie.onclick = () => kopiere(s, s.k);
    meta.append(kopie);
  }
  if (s.konstGespeichert.has(s.k.id)) {
    const weg = el("button", "k15link", "Löschen");
    weg.title = "Nimmt diese Konstellation vom Server; der Satz danach holt sie mit „Rückgängig“ zurück.";
    weg.onclick = () => loesche(s, s.k);
    meta.append(weg);
  }
  if (meta.childElementCount) col.append(meta);
  const fass = fassungenTeil(s);
  if (fass) col.append(fass);
  col.append(protokollTeil(s), erlaubtTeil(s));
  const mit = mitgereistTeil(s);
  if (mit) col.append(mit);
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
    // ein Kennzeichen am Ende (Owner 11:1x), aber nur, wo es etwas sagt (Runde 4, Z60): geändert gegenüber dem Profil, oder nicht von
    // Fleet; „[Zitat entfernt]“ steht einmal über dem Baum, Profil und Version im Title der Karte
    const geaendert = abweichungen(p, q, (id) => nameVon(s, p, id));
    const herkunft = p.id === "eigen" ? { art: "eigen" as const } : profilHerkunft(p);
    const kz = el("span", "k15tags");
    kz.append(...herkunftWenn(herkunft));
    b.title = `${istName(q, p) ? "" : `${q.name} · `}Profil ${p.name}: ${herkunftTitel(herkunft, p.v)}`;
    if (geaendert.length) kz.append(geaendertTag(`${plural(geaendert.length, "Änderung", "Änderungen")} gegenüber ${p.name} v${p.v}`));
    top.append(g, el("span", "k15cn", q.name), kz);
    // AGENT UND MODELL OHNE HOVER (Owner Z62: „[Zitat entfernt]“
    // ): das Zeichen, das das Board für den Agenten malt
    // (src/icons.ts#harnessMark), und das Modell ohne Fenstergröße; wählt der Agent sein Modell selbst, steht nur er da
    const ag = wahlVon(s, p, q, "agent"), mo = wahlVon(s, p, q, "modell");
    const agz = el("span", "k15ag");
    agz.dataset.agent = ag.wert;
    const zeichen = harnessMark(ag.wert);
    if (zeichen) agz.append(zeichen);
    agz.append(el("span", "k15agw", [ag.wort, mo.wert ? modelLabel(mo.wert).replace(/ · .*$/, "") : ""].filter(Boolean).join(" · ")));
    agz.title = `Agent: ${ag.wort}, ${ag.herkunft}\nModell: ${mo.wort}, ${mo.herkunft}`;
    const sw = schwelleWahl(s, p, q);
    const umfang = p.rolle === "nur-ordner" ? "" : GRUPPEN.filter((x) => umfangVon(p, q, x.id) !== "standard")
      .map((x) => ` · ${x.wort}: ${umfangVon(p, q, x.id) === "pflicht" ? "nur Pflicht" : "alles"}`).join("");
    const x = el("span", "k15x k15cx");
    x.append(el("span", "k15cs", `${wahlVon(s, p, q, "effort").wort} · ${sw.pct === null ? "Succession ?" : sw.pct <= 0 ? "Succession aus" : `Succession ab ${sw.pct} %`}${umfang}`));
    if (geaendert.length) x.append(el("span", "k15xk", `gegenüber ${p.name} v${p.v}`), ...geaendert.map((z) => el("span", "", z)));
    b.append(top, agz, x);
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
    const gespeichert = s.konstGespeichert.has(s.k.id);
    box.append(el("span", "k15labs", !s.k.eigen ? "Die Vorlage ist geändert. Speichern legt eine eigene Konstellation an; die Vorlage bleibt."
      : gespeichert ? "Der Aufbau ist geändert und noch nicht gespeichert." : "Diese Konstellation ist noch nicht gespeichert; ohne Speichern ist sie beim Schließen weg."));
    const name = document.createElement("input");
    name.className = "k15packin";
    name.maxLength = 80;
    name.value = nameEntwurf.get(s.k.id) ?? (s.k.eigen ? s.k.name : `${s.k.name} (eigene)`);
    name.oninput = () => nameEntwurf.set(s.k.id, name.value);
    name.setAttribute("aria-label", "Name der Konstellation");
    name.dataset.feld = "konst-name";
    const a = el("button", "k15ghost", !s.k.eigen ? "Als eigene speichern" : gespeichert ? `Als v${s.k.v + 1} speichern` : "Speichern");
    a.onclick = () => speichere(s, name.value.trim());
    name.onkeydown = (e) => { if (e.key === "Enter") a.click(); };
    box.append(name, a);
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
