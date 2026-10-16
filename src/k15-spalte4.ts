// K15 ENTWURF D · SPALTE 4, die Quelle: wo der Start landet, der Wortlaut (src/k15-wortlaut-ui.ts), jeder Baustein genau, die Context
// Packs (src/k15-packs-ui.ts), die Rollenkarte (src/k15-autonomie.ts), Rechte, Verbindungen und Einstellungen. Größen stehen erst beim
// Darüberfahren oder mit „Alles zeigen“ da; Datei und Funktion einer Aussage stehen im Title.
import { el, bausteinName } from "./k15-haupt";
import type { Answer, Baustein } from "./founding";
import { EINSTELLUNGEN_ID, GRUPPEN, aspekt, fmt, gruppeVon, landungVon, pct, tokVon, unter, verbindungen, type Knoten } from "./k15-entwurf-modell";
import { S, bausteineVon, fehltWeil, gehe, gewaehlt, grundWort, kommtAn, lage, plural, render, schwelleWahl, wahlVon, werPlan, zahl, antwort, type QuelleId } from "./k15-zustand";
import { istSchalter, kopfzeile, nachZahl, qLeiste, qTitel, unterkopf, werTag } from "./k15-teile";
import { DU, werBeiClaudeCode, werBestimmt, type Wer } from "./k15-wer";
import { springe, oeffnePack } from "./k15-spalte3";
import { wortlautAnsicht } from "./k15-wortlaut-ui";
import { landungSatz, packsAnsicht } from "./k15-packs-ui";
import { rollenkarteAnsicht } from "./k15-autonomie";
import { LESEHINWEISE, istPackRolle, packBytes, packLandung } from "./k15-kontextpack";
import { anatomieBytes, anatomieGruppen, anatomieVon, quelleSatz, quelleTitel, tokCc } from "./k15-anatomie-ui";
import { startZahl } from "./k15-startzahl";

// die vier Ansichten, die man direkt wählt; die übrigen öffnet ein Abschnitt in Spalte 3
export const ANSICHTEN: readonly { id: QuelleId; wort: string }[] = [{ id: "landet", wort: "Wo es landet" }, { id: "brief", wort: "Wortlaut" },
  { id: "bst", wort: "Je Baustein" }, { id: "packs", wort: "Packs" }];
const KOMMT_AN: Record<string, string> = { "Session-Datei": "in der Session-Datei, die Fleet schreibt", "native Datei": "über eine Datei, die Claude Code selbst lädt",
  plan: "mit dem Start selbst (Startzeile und Umgebung)", Zustellung: "vor jeder Nachricht, die Fleet in die Pane tippt", Prompt: "in der ersten Nachricht nach dem Start" };

// den Permission-Mode setzt Fleet in der Startzeile für jede Claude-Session gleich (k15-entwurf-modell.ts#ASPEKTE permission-mode)
const PM_WER = (heute: string): Wer => ({ art: "fleet", grund: "Fleet startet jede Claude-Session mit demselben Modus.", herleitung: heute });

export function spalteQuelle(): HTMLElement {
  const s = S;
  const col = el("section", "k15col k15c4");
  if (!s) return col;
  const { q, p } = gewaehlt(s);
  const l = lage(s, p, q);
  const a = l ? antwort(l.plan) : null;
  // wer bestimmt (src/k15-wer.ts): das Kennzeichen an jedem Baustein, jeder Zeile von Claude Code und jeder Einstellung
  const wp = a ? werPlan(s, a) : null;
  const werVon = (b: Baustein): Wer | null => wp ? werBestimmt(b, wp) : null;
  // der Grund eines „fest“ als eigene Zeile: in „Wo es landet“ erst mit „Alles zeigen“ (sonst beim Darüberfahren am Kennzeichen), damit die
  // Karte der Orte kurz bleibt; die Herleitung im Title
  const werGrund = (w: Wer, cls: string): HTMLElement[] => {
    if (w.art === "du") return [];
    const g = el("div", cls, w.grund);
    g.title = w.herleitung;
    return [g];
  };
  col.append(kopfzeile(3, "wo es landet und der Text dazu"));
  const ansicht = el("div", "k15seg k15vseg");
  ansicht.setAttribute("role", "tablist");
  for (const x of ANSICHTEN) {
    const b = el("button", s.quelle === x.id ? "on" : "", x.wort);
    if (x.id === "packs" && s.packs.length) b.append(el("span", "k15tabz", String(s.packs.length)));
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(s.quelle === x.id));
    b.onclick = () => { s.quelle = x.id; gehe(3, 3); };
    ansicht.append(b);
  }
  col.append(ansicht);
  const ohnePlan = () => el("div", "k15leer", !l ? "Kein Repo gewählt: ohne Repo gibt es keinen Plan." : l.plan === "laedt" ? "Der Gründungsplan wird gelesen …"
    : `Der Plan lehnt ab: ${typeof l.plan === "object" && "fehler" in l.plan ? l.plan.fehler : "unbekannt"}`);
  // eine Rechnung mit der Summe unten (src/k15-startzahl.ts): Claude Code aus der Aufschlüsselung, die feste Messung nur ohne Quelle
  const startSatz = (x: Answer): string => {
    const z = startZahl(x);
    return !z ? "" : `Start ${fmt(z.tokens)}: Claude Code ${z.claudeCode ? `${fmt(z.claudeCode.tokens)} ${z.claudeCode.wie}` : "nicht gemessen"}, Fleet ${fmt(z.fleet)} geschätzt${z.repo === null ? ", die Dateien des Repos nicht gemessen" : z.repo ? `, die Dateien des Repos ${fmt(z.repo)}` : ""}`;
  };
  const wer = q ? q.name : `eine Session mit Profil ${p.name}`;

  if (s.quelle === "landet") {
    // WO ES LANDET (Owner 12:3x): je Ort, was dort ankommt, und darunter, was in einem Baustein steckt (enthaltenIn); ein Pack sagt,
    // welche Teile als Text mitgehen und welche nur als Hinweis auf Abruf. Ein Klick führt in „[Zitat entfernt]“.
    col.append(...qTitel(q ? `Wo der Start von ${q.name} landet` : `Wo der Start einer Session mit Profil ${p.name} landet`, null, a ? a.plan.planSatz : "Plan der Rolle im gewählten Repo"));
    if (!a) { col.append(ohnePlan()); return col; }
    // die Größe des Starts wie jede andere Zahl: erst beim Darüberfahren oder mit „Alles zeigen“ (Prüfung Punkt 13); die Summe steht im Fuß
    if (a.startSumme) col.append(qLeiste(startSatz(a), [], true));
    const ld = landungVon(a);
    // „Systemprompt und Werkzeuge“ aufgeschlüsselt (src/k15-anatomie-ui.ts), wo der Server es liefert; sonst die Zeilen von Claude Code
    const cca = anatomieVon(a.claudeCode);
    const gruppenWort = (b: Baustein): string => b.id === EINSTELLUNGEN_ID ? "Einstellungen" : GRUPPEN.find((g) => g.id === gruppeVon(b))?.wort ?? "";
    // deine Pack-Entwürfe hängen unter den Lesehinweisen, blass und mit Kennzeichen: Fleet gibt sie heute nicht mit
    const entwuerfe = s.packs.map((pk) => ({ pk, la: packLandung(pk, p.rolle, a) }));
    const entwurfZeile = (x: (typeof entwuerfe)[number], bringt = false): HTMLElement => {
      const box = el("div", "k15lk k15entw");
      box.dataset.pack = x.pk.id;
      const r = el("button", "k15lkz");
      r.append(el("span", "k15lkn", x.pk.name), el("span", "k15tag entw", "Entwurf"),
        ...(x.la.art === "mit" ? [nachZahl("k15lkt", tokVon(packBytes(x.pk, x.la.ort)))] : []));
      r.onclick = () => oeffnePack(s, x.pk);
      box.append(r, el("div", "k15lkp", [x.la.art === "mit" ? (x.la.ort === "text" ? "als Text" : "auf Abruf") : "", bringt ? "bringt die Lesehinweise mit" : "",
        "heute gibt Fleet ihn nicht mit"].filter(Boolean).join(" · ")));
      return box;
    };
    // sind die Lesehinweise leer, weil kein Pack an ist, stehen sie in keinem Ort; ein Entwurf hängt dann direkt an dem Ort, an den sie mit
    // ihm gingen (src/k15-kontextpack.ts#packLandung)
    const lhDa = ld.orte.some((o) => o.knoten.flatMap(unter).some((k) => k.b.id === LESEHINWEISE));
    const lose = lhDa ? [] : entwuerfe.filter((x) => x.la.art === "mit");
    const knotenZeile = (k: Knoten, start: boolean): HTMLElement => {
      const box = el("div", "k15lk");
      box.dataset.id = k.b.id;
      const r = el("button", `k15lkz${s.bst === k.b.id ? " on" : ""}`);
      const wer = werVon(k.b);
      r.append(el("span", "k15lkn", bausteinName(k.b)), el("span", "k15lkg", gruppenWort(k.b)), ...(wer ? [werTag(wer)] : []),
        start ? el("span", "k15lkt", "") : nachZahl("k15lkt", typeof k.b.bytes === "number" ? tokVon(k.b.bytes) : "Größe unbekannt"));
      r.title = `${bausteinName(k.b)}: ${k.b.satz}`;
      r.onclick = () => springe(k.b.id);
      box.append(r);
      if (start) box.append(el("div", "k15lkp", k.b.satz));
      if (wer) box.append(...werGrund(wer, "k15lkp k15lkw"));
      if (k.b.id.startsWith("pack:")) {
        const teile = a.selected.find((x) => x.id === k.b.id.slice(5))?.parts ?? [];
        const imText = teile.filter((x) => x.ort === "box").length, abruf = teile.length - imText;
        const satz = [imText ? `${plural(imText, "Teil", "Teile")} als Text` : "", abruf ? `${abruf} auf Abruf: dort steht nur ein Hinweis, die Session liest die Quelle bei Bedarf` : ""].filter(Boolean).join(" · ");
        if (satz) box.append(el("div", "k15lkp", satz));
      }
      const mit = k.b.id === "context-anchors" ? entwuerfe.filter((x) => x.la.art === "mit") : [];
      if (k.kinder.length || mit.length) {
        const kids = el("div", "k15lkk");
        for (const c of k.kinder) kids.append(knotenZeile(c, start));
        for (const x of mit) kids.append(entwurfZeile(x));
        box.append(kids);
      }
      return box;
    };
    ld.orte.forEach((o, i) => {
      const box = el("section", `k15ort ort-${o.id}`);
      const kopfz = el("div", "k15ortk");
      const bytes = o.knoten.reduce((n, k) => n + (zahl(k.b) ?? 0), 0) + o.cc.reduce((n, z) => n + (typeof z.bytes === "number" ? z.bytes : 0), 0);
      const mess = a.claudeCode?.messung;
      const groesse = o.id === "system" ? (cca ? tokCc(anatomieBytes(cca), cca) : mess?.gilt ? `${fmt(mess.tokens)} gemessen` : "nicht gemessen")
        : o.id === "start" ? "nicht im Kontext" : tokVon(bytes);
      kopfz.append(el("span", "k15orti", String(i + 1)), el("span", "k15ortn", o.wort), nachZahl("k15ortt", groesse));
      const satz = el("div", "k15orts", o.id === "system" && cca ? `${o.satz}. ${quelleSatz(cca)}`
        : o.id === "system" && mess?.gilt ? `${o.satz}. Gemessen in einem leeren Ordner, mit deinen globalen Regeln.` : o.satz);
      if (o.id === "system" && cca) satz.title = kopfz.title = quelleTitel(cca);
      box.append(kopfz, satz);
      const baum = el("div", "k15ortb");
      for (const k of o.knoten) baum.append(knotenZeile(k, o.id === "start"));
      for (const x of lose) if (x.la.art === "mit" && x.la.weg === o.weg) baum.append(entwurfZeile(x, true));
      if (o.id === "system" && cca) baum.append(...anatomieGruppen(cca));
      for (const z of o.id === "system" && cca ? [] : o.cc) {
        const r = el("div", "k15lk k15lkcc");
        const zz = el("div", "k15lkz");
        const wer = werBeiClaudeCode(z);
        zz.append(el("span", "k15lkn", z.wort), el("span", "k15lkg", "Claude Code"), werTag(wer), nachZahl("k15lkt", typeof z.bytes === "number" ? tokVon(z.bytes) : ""));
        // der Weg in Worten, außer er ist ein Schalter (dann im Title) oder wiederholt das Kennzeichen „Claude Code“ daneben
        const wie = el("div", "k15lkp", `${istSchalter(z.weg) || z.weg === "Claude Code" ? "" : `${z.weg} · `}${z.wert}${o.id === "datei" && mess?.gilt && !cca ? " · steckt in der Messung oben" : ""}`);
        if (istSchalter(z.weg)) wie.title = `Claude Code: ${z.weg}`;
        r.append(zz, wie, ...werGrund(wer, "k15lkp k15lkw"));
        baum.append(r);
      }
      box.append(baum);
      col.append(box);
    });
    const fehlen = [...ld.nichtDurchTuer.map((x) => ({ name: bausteinName(x.b), gruppe: gruppenWort(x.b), grund: grundWort(x.grund), id: x.b.id, pk: null, wer: werVon(x.b) })),
      ...entwuerfe.filter((x) => { const r = p.rolle; return (x.la.art === "nicht" || (lose.includes(x) && !ld.orte.some((o) => x.la.art === "mit" && o.weg === x.la.weg)))
        && istPackRolle(r) && x.pk.orte[r] !== "nicht"; })
        .map((x) => ({ name: x.pk.name, gruppe: "Entwurf", grund: landungSatz(x.la), id: "", pk: x.pk, wer: null }))];
    if (fehlen.length) {
      const box = el("section", "k15ort ort-nicht");
      const kopfz = el("div", "k15ortk");
      kopfz.append(el("span", "k15orti", "–"), el("span", "k15ortn", "Fehlt bei diesem Start"));
      box.append(kopfz, el("div", "k15orts", "Der Plan schaltet es an, aber dieser Start liefert es nicht."));
      const baum = el("div", "k15ortb");
      for (const x of fehlen) {
        const r = el("div", "k15lk");
        if (x.pk) r.dataset.pack = x.pk.id; else r.dataset.id = x.id;
        const zz = el("button", "k15lkz");
        // der Grund steht hier ohnehin als Zeile darunter: das Kennzeichen trägt ihn nur im Title
        zz.append(el("span", "k15lkn", x.name), el("span", "k15lkg", x.gruppe), ...(x.wer ? [werTag(x.wer)] : []));
        const pk = x.pk;
        zz.onclick = () => { if (pk) oeffnePack(s, pk); else springe(x.id); };
        r.append(zz, el("div", "k15lkp", x.grund));
        baum.append(r);
      }
      box.append(baum);
      col.append(box);
    }
  } else if (s.quelle === "brief") {
    if (!a) { col.append(...qTitel(q ? `Start von ${q.name}` : `Start einer Session mit Profil ${p.name}`, null, "Plan der Rolle im gewählten Repo"), ohnePlan()); return col; }
    col.append(...wortlautAnsicht(s, a, () => oeffnePack(s, null)));
  } else if (s.quelle === "bst") {
    // JEDER BAUSTEIN GENAU: was er tut, was ohne ihn fehlt, ob er Pflicht ist, wie er beim Start ankommt (lieferung des Plans)
    col.append(...qTitel(`Bausteine von ${q ? q.name : `Profil ${p.name}`}`, null, "was jeder Baustein tut, was ohne ihn fehlt und wie er beim Start ankommt"));
    if (!a || !l) { col.append(ohnePlan()); return col; }
    const weg = new Map((a.lieferung?.geliefert ?? []).map((x) => [x.id, x.weg]));
    const name = (id: string) => { const b = a.plan.bausteine.find((x) => x.id === id); return b ? bausteinName(b) : id; };
    for (const b of bausteineVon(a, l)) {
      const an = kommtAn(a, b), fehlt = fehltWeil(a, b);
      const box = el("div", `k15bst${an ? "" : " aus"}${s.bst === b.id ? " ziel" : ""}`);
      box.dataset.id = b.id;
      const kopfz = el("div", "k15bstk");
      const wer = werVon(b);
      const tags = el("span", "k15bsttags");
      tags.append(el("span", `k15tag ${an ? "an" : "aus"}`, fehlt !== null ? "fehlt bei diesem Start" : b.grenze.art === "noetig" && an ? (b.grenze.gesperrt ? "gesperrt" : "Pflicht") : an ? "an" : "aus"),
        ...(wer ? [werTag(wer)] : []));
      kopfz.append(el("span", "k15bstn", bausteinName(b)), tags);
      const w = weg.get(b.id);
      // „Nicht einstellbar, weil“ trägt den Grund dessen, der den Standard setzt (für eine Pflicht ihr Grund aus dem Plan), die Herleitung im Title
      const zeilen: [string, string, string?][] = [
        ["Tut", b.satz],
        ...(b.breaksWithout ? [["Ohne", b.breaksWithout] as [string, string]] : []),
        // fehlt es bei diesem Start, sagt „Kommt nicht an“ den Grund schon
        ...(wer && wer.art !== "du" && fehlt === null ? [["Nicht einstellbar, weil", wer.grund, wer.herleitung] as [string, string, string]] : []),
        ...(w ? [["Kommt an", KOMMT_AN[w] ?? w] as [string, string]] : fehlt !== null ? [["Kommt nicht an", fehlt] as [string, string]] : []),
        ...(b.enthaltenIn ? [["Steckt in", name(b.enthaltenIn)] as [string, string]] : []),
        ...(!b.harness.gueltig && b.harness.grund && wer?.art !== "fleet" ? [["Gilt nicht", b.harness.grund] as [string, string]] : []),
        ...(b.bedingung ? [["Nur wenn", `${b.bedingung.grund} (${b.bedingung.erfuellt === "unknown" ? "erst beim Start bekannt" : b.bedingung.erfuellt ? "trifft zu" : "trifft nicht zu"})`] as [string, string]] : []),
      ];
      const dl = el("div", "k15bstz");
      for (const [k, v, t] of zeilen) {
        const vv = el("span", "k15bstzv", v);
        if (t) vv.title = t;
        dl.append(el("span", "k15bstzk", k), vv);
      }
      // die Größe beim Start: erst beim Darüberfahren
      if (an && typeof b.bytes === "number" && b.bytes > 0) dl.append(nachZahl("k15bstzk", "Beim Start"), nachZahl("k15bstzv", tokVon(b.bytes)));
      box.append(kopfz, dl);
      if (w === "Session-Datei" || w === "Prompt") {
        const hin = el("button", "k15link", "im Wortlaut ansehen");
        hin.onclick = () => { s.quelle = "brief"; s.bst = null; render(); };
        box.append(hin);
      }
      box.onclick = (e) => { if (!(e.target instanceof Element && e.target.closest("button")) && s.bst !== b.id) { s.bst = b.id; render(); } };
      col.append(box);
    }
  } else if (s.quelle === "packs") {
    col.append(...packsAnsicht(s, a, ohnePlan));
  } else if (s.quelle === "rechte") {
    col.append(...qTitel("Rechte", p.rechteV, `was Claude Code für ${wer} bekommt`));
    if (!a) { col.append(ohnePlan()); return col; }
    const cca = anatomieVon(a.claudeCode);
    if (cca) {
      const baum = el("div", "k15ortb k15ccrechte");
      baum.append(...anatomieGruppen(cca));
      const satz = el("div", "k15qd", quelleSatz(cca));
      satz.title = quelleTitel(cca);
      col.append(satz, baum);
    }
    for (const z of cca ? [] : a.claudeCode?.zeilen ?? []) {
      const kopf = unterkopf(z.wort, istSchalter(z.weg) ? undefined : z.weg);
      if (istSchalter(z.weg)) kopf.title = `Claude Code: ${z.weg}`;
      kopf.querySelector(".k15subw")?.append(werTag(werBeiClaudeCode(z)));
      col.append(kopf, el("div", "k15zt k15pad", z.wert));
      const det = "details" in z && z.details && typeof z.details === "object" && "namen" in z.details ? z.details.namen : null;
      const namen = Array.isArray(det) ? det.map(String) : [];
      if (namen.length) {
        const tu = el("div", "k15tueren");
        for (const x of namen) tu.append(el("span", "k15tuer", x));
        col.append(tu);
      }
      const satz = el("div", "k15qd", z.satz);
      satz.title = z.quelle;
      col.append(satz);
    }
    const pm = aspekt("permission-mode");
    const pms = el("div", "k15qd", "Fleet startet jede Claude-Session im Auto-Mode: ein Klassifizierer prüft jede Aktion, statt nachzufragen; was er sperrt, meldet die Session ihrer Leitung.");
    pms.title = pm?.heute ?? "";
    const pmk = unterkopf("Permission-Mode", "für alle Sessions gleich");
    pmk.querySelector(".k15subw")?.append(werTag(PM_WER(pm?.heute ?? "")));
    col.append(pmk, el("div", "k15zt k15pad", String(pm?.standard ?? "")), pms);
    col.append(el("div", "k15hinweis", "MCP-Server einzeln und den Permission-Mode je Rolle zu schalten, braucht eine eigene Startzeile je Session; dafür fehlt noch ein Schritt am Server."));
  } else if (s.quelle === "auto") {
    col.append(...rollenkarteAnsicht(p, a, ohnePlan));
  } else if (s.quelle === "wege") {
    col.append(...qTitel("Verbindungen im Lauf", null, `was ${wer} nach dem Start mit Fleet verbindet; jede Zeile am Code geprüft`));
    for (const v of verbindungen(p.id)) {
      const heute = el("div", "k15zt k15pad", v.heute);
      heute.title = v.quelle;
      col.append(unterkopf(v.name, v.fehlt ? "heute nicht" : v.kurz), heute);
      if (v.fehlt) col.append(el("div", "k15hinweis", v.fehlt));
    }
  } else {
    // EINSTELLUNGEN: je Wert, woher er kommt; Variable, Datei und Funktion im Title
    const m = wahlVon(s, p, q, "modell"), e = wahlVon(s, p, q, "effort"), sw = schwelleWahl(s, p, q);
    col.append(...qTitel("Einstellungen", p.einV, `von ${p.name} v${p.v}${q ? ` · für ${q.name}` : ""}`));
    // Modell, Effort und Übergabe stellst du in Spalte 3 ein; den Permission-Mode setzt Fleet für alle gleich
    const zeile = (name: string, wert: string, herkunft: string, innen: string, wer: Wer) => {
      const h = el("div", "k15qd", herkunft);
      h.title = innen;
      const kopf = unterkopf(name);
      kopf.querySelector(".k15subw")?.append(werTag(wer));
      col.append(kopf, el("div", "k15zt k15pad", wert), h);
    };
    zeile("Modell", m.wort, m.herkunft, m.quelle, DU);
    zeile("Effort", e.wort, e.herkunft, e.quelle, DU);
    zeile("Übergabe ab", pct(sw.pct), `${sw.herkunft}. Ab dieser Füllung des Kontexts übergibt Fleet an eine Nachfolgerin; bis 5 Punkte darüber wartet es, solange der Cache warm ist.`, sw.quelle, DU);
    zeile("Permission-Mode", String(aspekt("permission-mode")?.standard ?? ""), "für alle Sessions gleich; je Rolle erst, wenn jede Session ihre eigene Startzeile bekommt", aspekt("permission-mode")?.heute ?? "",
      PM_WER(aspekt("permission-mode")?.heute ?? ""));
    const abw = q?.abw ? Object.keys(q.abw).length : 0;
    if (abw) col.append(el("div", "k15hinweis", `${plural(abw, "Wert weicht", "Werte weichen")} für ${q?.name} vom Profil ab.`));
  }
  return col;
}
