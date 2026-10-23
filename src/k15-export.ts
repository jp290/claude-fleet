// K15 ENTWURF D · EXPORT UND IMPORT: eine Ebene wählen (System, Konstellation, Session, Baustein) und die Form (Verweise oder
// vollständig); zurück kommt es per Hineinziehen oder ⌘V. Der vollständige Export trägt die eigenen Fassungen und die Kontextpacks als
// Entwurf mit ihrem Text.
import { el, copyText, api } from "./k15-haupt";
import { erlaubtOeffnen } from "./k15-erlaubt";
import { fassungenNeu } from "./k15-konst-fassungen";
import { icon } from "./icons";
import { abwZahl, alle, exportJson, type Ebene, type Konst, type Profil } from "./k15-entwurf-modell";
import { MAX_FASSUNGEN, MAX_PACKS, abschnitte, dateiPasst, importKonst } from "./k15-import";
import { fassungenExport, fassungenImport } from "./k15-wortlaut";
import { istPackRolle, packsExport, packsImport, type PackEntwurf } from "./k15-kontextpack";
import { S, gehe, gewaehlt, plural, profilVon, render, speichereEigenes, speichereKonst, toast, type St } from "./k15-zustand";
import { unterkopf } from "./k15-teile";
import { KONST_ROUTE } from "./k15-speicher";

// DIE GANZE DATEI EINER GESPEICHERTEN KONSTELLATION (server/sitz-reise.ts#dateiFuer): erst der Server weiß, was ihre Sitze lesen, was in
// ihren Notizbüchern steht und welche Läufe sie hatte. Je Konstellation und Repo einmal gelesen, solange das Fenster offen ist
type ServerDatei = { text: string; hinweise: string[] } | { fehler: string } | "laedt";
const dateien = new Map<string, ServerDatei>();
function serverDatei(s: St): ServerDatei | null {
  if (s.ebene !== "konst" || !s.voll || !s.konstGespeichert.has(s.k.id) || s.konstNeu.has(s.k.id)) return null;
  const key = `${s.k.id}\n${s.repo ?? ""}\n${JSON.stringify(s.konstGespeichert.get(s.k.id)).length}`;
  const da = dateien.get(key);
  if (da) return da;
  dateien.set(key, "laedt");
  void api(`${KONST_ROUTE}/${encodeURIComponent(s.k.id)}/datei${s.repo ? `?repo=${encodeURIComponent(s.repo)}` : ""}`).then(async (r) => {
    const j: unknown = await r.json().catch(() => null);
    const o = j && typeof j === "object" ? j as Record<string, unknown> : {};
    dateien.set(key, r.ok && o.datei ? { text: JSON.stringify(o.datei, null, 2), hinweise: Array.isArray(o.hinweise) ? o.hinweise.map(String) : [] }
      : { fehler: typeof o.error === "string" ? o.error : `Antwort ${r.status}` });
  }).catch((e: unknown) => { dateien.set(key, { fehler: e instanceof Error ? e.message : "Server nicht erreichbar" }); })
    .finally(() => { if (S === s && s.exp) render(); });
  return "laedt";
}

// welche Pack-Entwürfe auf einer Ebene mitreisen: im System alle, in einer Konstellation die, die eine ihrer Rollen bekommt, in einer
// Session die ihrer Rolle; ein einzelner Baustein trägt keine
function packsFuer(s: St, ebene: Ebene, p: Profil): PackEntwurf[] {
  if (ebene === "system") return s.packs;
  if (ebene === "baustein") return [];
  const rollen = ebene === "konst" ? alle(s.k.wurzeln).map((x) => profilVon(s, x.profil).rolle) : [p.rolle];
  return s.packs.filter((pk) => rollen.some((r) => istPackRolle(r) && pk.orte[r] !== "nicht"));
}
const mitPacks = (n: number, voll: boolean): string => n && voll ? ` · mit ${plural(n, "Kontextpack", "Kontextpacks")} (Entwurf)` : "";

export function exportPanel(): HTMLElement {
  const s = S;
  const box = el("div", "k15pop");
  if (!s) return box;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Exportieren");
  const { q, p } = gewaehlt(s);
  const kopfz = el("div", "k15popt");
  const zu = el("button", "k15popx");
  zu.title = "schließen";
  zu.append(icon("x"));
  zu.onclick = () => { s.exp = false; render(); };
  kopfz.append(el("span", "", "Exportieren"), zu);
  box.append(kopfz, unterkopf("Was"));
  const ebenen: [Ebene, string, string][] = [
    ["system", "Das ganze System", `${s.konst.length} Konstellationen, ${s.profile.length} Profile${mitPacks(s.packs.length, s.voll)}`],
    ["konst", "Diese Konstellation", `${s.k.name} v${s.k.v}${mitPacks(packsFuer(s, "konst", p).length, s.voll)}`],
    ["session", q ? "Diese Session" : "Dieses Profil", `${q ? `${q.name} · ${p.name} v${p.v}${abwZahl(q) ? " mit Abweichungen" : ""}` : `${p.name} v${p.v}`}${mitPacks(packsFuer(s, "session", p).length, s.voll)}`],
    ["baustein", "Einen Baustein", `Einstellungen v${p.einV}`],
  ];
  for (const [id, word, say] of ebenen) {
    const b = el("button", `k15eb${s.ebene === id ? " on" : ""}`);
    const t = el("span", "k15kt");
    t.append(el("span", "k15kn", word), el("span", "k15ks", say));
    b.append(t);
    if (s.ebene === id) b.append(icon("check"));
    b.onclick = () => { s.ebene = id; render(); };
    box.append(b);
  }
  const form = el("div", "k15seg");
  for (const [v, word] of [[false, "Mit Verweisen"], [true, "Vollständig"]] as const) {
    const b = el("button", s.voll === v ? "on" : "", word);
    b.onclick = () => { s.voll = v; render(); };
    form.append(b);
  }
  box.append(unterkopf("Wie"), form,
    el("div", "k15ks k15popsay", s.voll ? "Alle Werte stehen mit drin, dazu deine eigenen Fassungen und Pack-Entwürfe. Läuft auch dort, wo diese Profile fehlen." : "Klein. Wer es einfügt, braucht dieselben Profile in diesen Versionen."));
  const packs = packsFuer(s, s.ebene, p);
  const fassungen = s.ebene === "baustein" ? [] : [...s.fassungen.values()];
  const sd = serverDatei(s);
  if (sd === "laedt") { box.append(el("div", "k15ks k15popsay", "Der Server stellt die Datei zusammen: was jeder Sitz liest, darf und weiß …")); return box; }
  const zusatz = s.voll ? { ...(fassungen.length ? { fassungen: fassungenExport(fassungen) } : {}), ...(packs.length ? { kontextpacks: packsExport(packs) } : {}) } : {};
  const text = sd && "text" in sd ? JSON.stringify({ ...JSON.parse(sd.text), ...zusatz }, null, 2)
    : exportJson({ ebene: s.ebene, voll: s.voll, konst: s.konst, k: s.k, profile: s.profile, q, p, zusatz, teilen: true });
  if (sd && "fehler" in sd) box.append(el("div", "k15hinweis", `Die ganze Datei gibt der Server nicht: ${sd.fehler}. Darunter steht der Aufbau ohne das, was die Sitze lesen.`));
  if (sd && "text" in sd) box.append(el("div", "k15ks k15popsay", "Mit allem, was jeder Sitz liest, darf und in seinem Notizbuch hat, mit den Läufen und „abgeleitetVon“. Persönliches bleibt daheim: Sein Platz ist leer, wer importiert, füllt ihn."),
    ...sd.hinweise.map((h) => el("div", "k15ks k15popsay", h)));
  const zeilen = text.split("\n");
  box.append(el("pre", "k15pre k15code k15json", zeilen.length > 30 ? [...zeilen.slice(0, 30), `  … ${zeilen.length - 30} Zeilen mehr`].join("\n") : text));
  const btns = el("div", "k15row2");
  const c = el("button", "k15ghost");
  c.append(icon("copy"), el("span", "", "Kopieren"));
  c.onclick = () => { copyText(text); c.replaceChildren(icon("check"), el("span", "", "Kopiert")); };
  const f = el("button", "k15ghost");
  f.append(icon("export"), el("span", "", "Als Datei sichern"));
  f.onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = `${(s.ebene === "konst" ? s.k.name : s.ebene).replace(/[^\wäöüÄÖÜß-]+/g, "-").toLowerCase()}.fleet.json`;
    a.click();
    // erst freigeben, wenn der Browser die Datei genommen hat (iOS Safari las sie sonst nie, Prüfung Punkt 11)
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  };
  btns.append(c, f);
  box.append(btns, el("div", "k15ks k15popsay", "Zurück kommt es per Hineinziehen oder ⌘V. Das JSON landet auf seiner Ebene."));
  return box;
}

// IMPORT OHNE ZIEHEN UND ⌘V (Partner 20.10.: am Handy kam man nicht hinein): eine Datei wählen, oder JSON in ein Feld einfügen; beides geht
// den Weg von Hineinziehen und ⌘V
export function dateiWaehlen(): void {
  const i = document.createElement("input");
  i.type = "file";
  i.accept = ".json,.md,application/json,text/markdown";
  i.onchange = () => {
    const f = i.files?.[0];
    if (!f) return;
    const passt = dateiPasst(f.name, f.size);
    if (passt) { toast(passt); return; }
    f.text().then((t) => nimm(f.name, t)).catch(() => toast(`${f.name}: Der Browser konnte die Datei nicht lesen.`));
  };
  i.click();
}
export function einfuegenFeld(fertig: () => void): HTMLElement {
  const box = el("div", "k15einf");
  const t = document.createElement("textarea");
  t.className = "k15packin";
  t.rows = 4;
  t.placeholder = "Exportierte Konstellation hier einfügen (JSON)";
  const los = el("button", "k15ghost", "Einsetzen") as HTMLButtonElement;
  los.onclick = () => {
    const text = t.value.trim();
    if (!text) { toast("Das Feld ist leer."); return; }
    const passt = dateiPasst("eingefügt.json", new TextEncoder().encode(text).length);
    if (passt) { toast(passt); return; }
    fertig();
    nimm("eingefügt.json", text);
  };
  box.append(t, los);
  return box;
}

// HINEINZIEHEN UND EINFÜGEN: eine .md wird die eigene Datei der gewählten Session, ein JSON landet auf seiner Ebene; eigene Fassungen und
// Pack-Entwürfe eines Exports kommen mit, auf jeder Ebene. Was es hier schon gibt (derselbe Abschnitt, derselbe Pack), bleibt das hiesige.
export function nimm(name: string, text: string): void {
  const s = S;
  if (!s) return;
  // geht beim Übernehmen oder Zeichnen etwas schief, kommt der Stand von vorher zurück, und ein Satz sagt es (Prüfung Punkt 1)
  const vorher = { konst: s.konst, k: s.k, sel: s.sel, profile: s.profile, fassungen: s.fassungen, packs: s.packs, quelle: s.quelle };
  try { nimmRoh(s, name, text); } catch {
    Object.assign(s, vorher);
    render();
    toast(`${name}: Das ließ sich nicht einsetzen; alles ist wie vorher.`);
  }
}
// die persönlichen Plätze, die mitkamen (src/sitz.ts): leer, und wer importiert, füllt sie mit seinem Eigenen
const platzSatz = (k: Konst): string => {
  const ids = [...new Set(alle(k.wurzeln).flatMap((q) => q.sitz?.persoenlich.map((p) => p.id) ?? []))];
  return ids.length ? ` Leer mitgekommen: ${ids.join(", ")}. Füll ${ids.length === 1 ? "ihn" : "sie"} im Aufbau unter „Mitgereist“ mit deinem Eigenen.` : "";
};
function nimmRoh(s: St, name: string, text: string): void {
  if (/\.json$/i.test(name)) {
    const r0 = importKonst(text, s.profile, Date.now());
    let obj: unknown = null;
    try { obj = JSON.parse(text); } catch { /* kein JSON: importKonst hat es schon gesagt */ }
    const r: Record<string, unknown> = obj && typeof obj === "object" ? { ...obj } : {};
    const neuF = fassungenImport(r.fassungen, Date.now()).fassungen.filter((f) => !s.fassungen.has(f.abschnitt)).slice(0, Math.max(0, MAX_FASSUNGEN - s.fassungen.size));
    const neuP = packsImport(r.kontextpacks, Date.now()).packs.filter((pk) => !s.packs.some((x) => x.id === pk.id)).slice(0, Math.max(0, MAX_PACKS - s.packs.length));
    // „übernommen“ erst, wenn der Server bestätigt hat; schlägt es fehl, bleibt sein Satz stehen
    if (neuF.length || neuP.length) {
      s.fassungen = new Map([...s.fassungen, ...neuF.map((f) => [f.abschnitt, f] as const)]);
      s.packs = [...s.packs, ...neuP];
    }
    const dazu = [neuF.length ? plural(neuF.length, "eigene Fassung", "eigene Fassungen") : "", neuP.length ? plural(neuP.length, "Pack-Entwurf", "Pack-Entwürfe") : ""].filter(Boolean).join(" und ");
    if (typeof r0 === "string") {
      if (!dazu) { toast(`${name}: ${r0}.`); return; }
      void speichereEigenes(s).then((ok) => { if (ok) toast(`${name}: ${dazu} übernommen.`); });
      s.quelle = neuP.length ? "packs" : "brief";
      gehe(3, 3);
      return;
    }
    const k = r0.k;
    s.profile = [...s.profile, ...r0.neueProfile];
    s.konst = [...s.konst, k];
    s.k = k;
    s.sel = { art: "pos", id: alle(k.wurzeln)[0]?.id ?? "" };
    erlaubtOeffnen(k.id);
    const satz = `${k.name} v${k.v} importiert: ${plural(alle(k.wurzeln).length, "Session", "Sessions")}${dazu ? `, dazu ${dazu}` : ""}. Sie ist jetzt deine eigene und auf dem Server gespeichert; was sie erlaubt, steht im Aufbau.${platzSatz(k)}${r0.hinweise.length ? ` ${r0.hinweise.slice(0, 3).join("; ")}${r0.hinweise.length > 3 ? " …" : ""}.` : ""}`;
    // eine importierte Konstellation ist gleich gespeichert (Konstellation Stück 1): Hineinziehen ist schon die Entscheidung, sie zu behalten
    // gespeichert, liest die Ansicht ihre Fassungen neu (wie nach jedem Speichern, k15-spalte2.ts): vorher fragte sie zu früh und sah keine
    // ...und ihre Pläne: einer mit `sitz` fragte vor dem Speichern und hörte „no saved constellations to read“ (server/sitz-reise.ts)
    void speichereKonst(s, k.id, k).then((ok) => {
      if (ok) fassungenNeu(k.id);
      if (ok) for (const url of [...s.plaene.keys()]) if (new URLSearchParams(url.split("?")[1] ?? "").get("sitz")?.startsWith(`${k.id}/`)) s.plaene.delete(url);
      if (ok && S === s) { toast(satz); render(); } else if (S === s) { s.konstNeu.add(k.id); render(); }
    });
    gehe(1, 1);
    return;
  }
  const { q } = gewaehlt(s);
  if (!q) { toast("Wähl zuerst eine Session im Aufbau; die Datei wird ihre eigene Datei."); return; }
  q.datei = { id: `md${Date.now().toString(36)}`, titel: name, v: 1, pfad: "eigene Datei · hineingezogen", abschnitte: abschnitte(text, "Anfang") };
  s.konstNeu.add(s.k.id);
  s.quelle = "brief";
  s.offen.add(`datei:${q.datei.abschnitte[0]?.titel ?? ""}`);
  toast(`${name} ist jetzt die eigene Datei von ${q.name}; sie käme vor das, was Fleet schreibt.`);
  gehe(3, 2);
}
