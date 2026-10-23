// K15 · WAS MIT EINER KONSTELLATION REISTE (src/sitz.ts; docs/start/system-concept.md, „Sharing“: „Whoever imports a setup fills that place
// with their own“). Im Aufbau, sobald ein Sitz einen Sitz-Block trägt: woraus sie abgeleitet ist, je Sitz was er liest, darf und im
// Notizbuch hat, und je persönlichem Platz ein Feld für das Eigene. Bleibt das Feld leer, füllt den Platz beim Start die eigene Bibliothek,
// wenn sie einen Pack dieses Namens hat (server/sitz-reise.ts#sitzWissen); sonst startet der Sitz ohne ihn.
import { el } from "./k15-haupt";
import { alle, type Position } from "./k15-entwurf-modell";
import { RECHTE_BEFEHLE, RECHTE_STUFEN, rechteAlsSatz } from "../session-rechte";
import { render, speichereKonst, toast, type St } from "./k15-zustand";
import { rechteGedeckelt, type PersoenlichPlatz, type SitzDarf } from "./sitz";

// WAS DIESE SESSION DARF (session-rechte.ts), am Sitz gesetzt: die Tür bekommt es beim Start, ein Export trägt es in sitz.darf. „Nicht gesetzt“
// heißt: es gelten die Regeln des Agenten. Eine Änderung ist eine Änderung am Aufbau und wird mit ihm gespeichert
export function darfWahl(s: St, q: Position): HTMLElement {
  const box = el("div", "k15frow k15darf");
  box.append(el("b", "", "Darf"));
  const seg = el("div", "k15seg");
  const wahl: [string | null, string][] = [[null, "nicht gesetzt"], ...RECHTE_STUFEN.map((x): [string, string] => [x.id, x.wort])];
  for (const [id, wort] of wahl) {
    const b = el("button", (q.rechte?.stufe ?? null) === id ? "on" : "", wort);
    b.onclick = () => {
      const st = RECHTE_STUFEN.find((x) => x.id === id);
      if (st) q.rechte = { stufe: st.id, an: [], aus: [] }; else delete q.rechte;
      s.konstNeu.add(s.k.id);
      render();
    };
    seg.append(b);
  }
  box.append(seg, el("span", "k15ks", q.rechte ? rechteAlsSatz(q.rechte) : q.sitz ? "Nicht gesetzt: es gilt, was mit dem Sitz reiste (unten unter „Mitgereist“)."
    : "Nicht gesetzt: es gelten die Regeln des Agenten."));
  return box;
}

// DIE RECHTE AUS DER DATEI: was sie erlaubt, was der Deckel davon sperrt, und die Freigabe des Owners hier (src/sitz.ts#rechteGedeckelt)
function darfZeile(s: St, wer: string, d: SitzDarf): HTMLElement {
  const z = el("div", "k15mitz");
  z.append(el("span", "k15mitk", "Darf"));
  if (!d.rechte) { z.append("keine Rechte aus der Datei; es gelten die des Agenten"); return z; }
  const { rechte, gedeckelt } = rechteGedeckelt(d.rechte);
  if (!gedeckelt.length) { z.append(rechteAlsSatz(d.rechte)); return z; }
  const wort = gedeckelt.map((id) => RECHTE_BEFEHLE.find((b) => b.id === id)?.befehl ?? id).join(", ");
  z.append(d.bestaetigt ? `von dir freigegeben: ${rechteAlsSatz(d.rechte)}`
    : `Die Datei erlaubt auch ${wort}. Das gibt eine fremde Datei nicht weiter: ${wer} startet mit „${RECHTE_STUFEN.find((x) => x.id === rechte.stufe)?.wort ?? rechte.stufe}“, bis du es freigibst.`);
  const b = el("button", "k15ghost", d.bestaetigt ? "Freigabe zurücknehmen" : `${wort} freigeben`) as HTMLButtonElement;
  b.onclick = () => {
    if (d.bestaetigt) delete d.bestaetigt; else d.bestaetigt = true;
    void speichereKonst(s, s.k.id, s.k).then((ok) => { if (ok) toast(d.bestaetigt ? `${wer} darf jetzt auch ${wort}.` : `${wer} ist wieder gedeckelt.`); render(); });
  };
  z.append(" ", b);
  return z;
}

const zahl = (n: number, eins: string, viele: string): string => `${n} ${n === 1 ? eins : viele}`;

function platz(s: St, wer: string, pl: PersoenlichPlatz): HTMLElement {
  const box = el("div", "k15frow k15platz");
  box.dataset.platz = pl.id;
  const satz = pl.text ? `gefüllt mit deinem Eigenen (${pl.text.length.toLocaleString("de-DE")} Zeichen)`
    : `leer: Beim Start füllt ihn deine Bibliothek, wenn sie „${pl.id}“ hat; sonst startet ${wer} ohne ihn.`;
  box.append(el("b", "", `Platz für dein Eigenes: ${pl.id}`), el("span", "k15labs", pl.wofuer ?? ""), el("span", "k15ks", satz));
  const t = document.createElement("textarea");
  t.className = "k15packin";
  t.rows = 3;
  t.value = pl.text ?? "";
  t.placeholder = "Dein eigener Text für diesen Platz. Er bleibt bei dir: Ein Export lässt den Platz leer.";
  t.dataset.feld = `platz-${pl.id}`;
  const los = el("button", "k15ghost", "Übernehmen") as HTMLButtonElement;
  los.onclick = () => {
    pl.text = t.value.trim() || null;
    void speichereKonst(s, s.k.id, s.k).then((ok) => { if (ok) toast(pl.text ? `${pl.id}: dein Eigenes ist gespeichert.` : `${pl.id}: der Platz ist wieder leer.`); render(); });
  };
  box.append(t, los);
  return box;
}

export function mitgereistTeil(s: St): HTMLElement | null {
  const mit = alle(s.k.wurzeln).filter((q) => q.sitz);
  if (!mit.length && !s.k.abgeleitetVon && !s.k.laeufe?.length) return null;
  const box = el("div", "k15fass k15mit offen");
  const kopf = el("div", "k15fkopf");
  kopf.append(el("b", "", "Mitgereist"), el("span", "", s.k.abgeleitetVon ? `abgeleitet von ${s.k.abgeleitetVon.slice(0, 12)}` : "aus einer Datei"));
  kopf.title = s.k.abgeleitetVon ? `Der sha256 der Fassung, aus der diese Datei exportiert wurde: ${s.k.abgeleitetVon}` : "";
  box.append(kopf);
  for (const q of mit) {
    const z = q.sitz;
    if (!z) continue;
    const zeile = (k: string, text: string): HTMLElement => { const r = el("div", "k15mitz"); r.append(el("span", "k15mitk", k), text); return r; };
    const sitz = el("div", "k15mitsitz");
    sitz.append(el("b", "", q.name),
      zeile("Liest", z.liest.length ? z.liest.map((p) => `${p.id} (${p.weg === "start" ? "im Start" : "als Skill"})`).join(", ") : "keine Packs aus der Datei"),
      darfZeile(s, q.name, z.darf),
      zeile("Notizbuch", z.notizbuch ? `${zahl(z.notizbuch.notizen.length, "Notiz", "Notizen")}${z.notizbuch.daheim ? `; ${z.notizbuch.daheim} über den Absender blieben dort` : ""}` : "keins"));
    for (const pl of z.persoenlich) sitz.append(platz(s, q.name, pl));
    box.append(sitz);
  }
  if (s.k.laeufe?.length) {
    const l = el("div", "k15mitsitz");
    l.append(el("b", "", zahl(s.k.laeufe.length, "Lauf", "Läufe")), el("div", "k15mitz", `als Bericht, nur zum Lesen: ${s.k.laeufe.map((x) => `${x.start.slice(0, 10)}, ${x.sitze.length === 1 ? "ein Sitz" : `${x.sitze.length} Sitze`}`).join(" · ")}`));
    box.append(l);
  }
  return box;
}
