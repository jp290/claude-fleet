// K15 · WAS VON AUSSEN KOMMT, GEPRÜFT (Prüfung der Bauleitung 16.10., k15-pruefung-16-10.md Punkte 1, 6, 8, 9): eine gezogene oder
// eingefügte Datei, ein Export und der eigene Speicher (auf dem Server, vorher im Browser). Jede Form wird ganz geprüft, bevor sie den Zustand berührt; was nicht
// passt, wird mit einem Satz abgelehnt, und das Fenster bleibt, wie es war. Dieses Modul hat kein DOM.
import {
  PROFILE0, pos, type Abschnitt, type AutoArt, type Glyph, type Konst, type PlanRolle, type Position, type Profil, type Protokoll, type Punkt, type Quelle,
  type Schalter, type Schiene, type Wert, type Werte,
} from "./k15-entwurf-modell";
import { MAX_PROFILE } from "./k15-speicher";
import { aufgabeAus } from "./aufgabe";
import { laufBerichteAus, type LaufBericht } from "./lauf-bericht";
import { sitzAus, sitzZumTeilen, type Sitz } from "./sitz";
import { rechteAus } from "../session-rechte";
export { MAX_FASSUNGEN, MAX_PACKS, MAX_PROFILE } from "./k15-speicher";

// DIE GRENZEN: was größer ist, liest das Fenster nicht erst ein (eine gezogene Videodatei fror den Tab ein)
export const MAX_DATEI_BYTES = 1_000_000;
export const MAX_POSITIONEN = 24;
// welche Dateien das Fenster annimmt, und warum eine andere nicht
export function dateiPasst(name: string, bytes: number): string | null {
  if (!/\.(md|json)$/i.test(name)) return `${name}: only an .md (agent MD) or an exported .json can be dropped in.`;
  if (bytes > MAX_DATEI_BYTES) return `${name}: ${Math.round(bytes / 1000).toLocaleString("en-US")} KB is too large; nothing over 1 MB is read.`;
  return null;
}

// EIN MARKDOWN-TEXT IN ABSCHNITTE je Überschrift; der Anfang davor ist ein eigener Abschnitt. Eine Zeile in einem Code-Block
// (``` oder ~~~) ist nie eine Überschrift: „# install deps“ in einem Shell-Block zerriss sonst den Block.
export function abschnitte(text: string, anfang: string): Abschnitt[] {
  const out: Abschnitt[] = [];
  let zaun: string | null = null;
  for (const zeile of text.replace(/\r\n?/g, "\n").split("\n")) {
    const z = /^ {0,3}(`{3,}|~{3,})/.exec(zeile)?.[1];
    if (z && (zaun === null || (z[0] === zaun[0] && z.length >= zaun.length && /^ {0,3}[`~]+\s*$/.test(zeile)))) zaun = zaun === null ? z : null;
    const kopfzeile = zaun === null && !z && /^#{1,6} /.test(zeile);
    if (kopfzeile || out.length === 0) out.push({ titel: kopfzeile ? zeile.trim() : anfang, text: kopfzeile ? "" : zeile });
    else out[out.length - 1].text += `\n${zeile}`;
  }
  return out.map((a) => ({ ...a, text: a.text.trim(), bytes: new TextEncoder().encode(`${a.titel}\n${a.text}`).length })).filter((a) => a.titel !== anfang || a.text);
}

const obj = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === "object" && !Array.isArray(v) ? { ...v } : null;
const str = (v: unknown, max: number): string | null => typeof v === "string" ? v.slice(0, max) : null;
const zahl = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) ? v : null;
const ROLLEN: readonly PlanRolle[] = ["lane", "main", "orchestratorin", "nur-ordner"];
const SCHIENEN: readonly Schiene[] = ["orchestrator", "program-main", "bau", "lane", "session"];
const GLYPHEN = new Set<Glyph>([...PROFILE0.map((p) => p.glyph), "file"]);
const ARTEN: readonly (AutoArt | "weg")[] = ["selbst", "fragt", "nie", "weg"];

// eine eigene Datei (Agent-MD) mit ihren Abschnitten
export function quelleAus(v: unknown): Quelle | null {
  const o = obj(v);
  const titel = str(o?.titel, 200), abs = o?.abschnitte;
  if (!o || !titel || !Array.isArray(abs) || abs.length > 400) return null;
  const abschnitte: Abschnitt[] = [];
  for (const x of abs) {
    const a = obj(x);
    const t = str(a?.titel, 400), text = str(a?.text, 400_000);
    if (t === null || text === null) return null;
    // bytes (die Größe, die abschnitte oben vor dem Kürzen zählt) bleibt, wie es stand: ohne es änderte jede eigene Datei ihre Fassung
    // beim Import und beim Laden aus dem Speicher (konst-fassungen.ts#fassungsHash zählt es mit); nachzählen ginge nicht, der Text ist gekürzt
    const bytes = a?.bytes;
    abschnitte.push({ titel: t, text, ...(Number.isSafeInteger(bytes) && Number(bytes) >= 0 ? { bytes: Number(bytes) } : {}) });
  }
  const id = str(o.id, 80);
  return { ...(id ? { id } : {}), titel, v: Math.max(1, Math.floor(zahl(o.v) ?? 1)), pfad: str(o.pfad, 200) ?? "own file", abschnitte };
}
const schalterAus = (v: unknown): Schalter | null => {
  const o = obj(v);
  if (!o) return null;
  const e = Object.entries(o);
  return e.every(([, x]) => x === "an" || x === "aus") ? Object.fromEntries(e) as Schalter : null;
};
const wertAus = (v: unknown): Wert | null => typeof v === "string" ? v.slice(0, 400) : zahl(v) ?? (Array.isArray(v) && v.every((x) => typeof x === "string") ? v.map((x: string) => x.slice(0, 400)) : null);
const werteAus = (v: unknown): Record<string, Wert> | null => {
  const o = obj(v);
  if (!o) return null;
  const out: Record<string, Wert> = {};
  for (const [k, x] of Object.entries(o)) { const w = wertAus(x); if (w === null) return null; out[k] = w; }
  return out;
};
const abwAus = (v: unknown): Partial<Werte> | null => {
  const o = obj(v);
  if (!o || Object.keys(o).some((k) => !["agent", "modell", "effort", "schwelle"].includes(k))) return null;
  const ok = (k: string, t: "string" | "number") => o[k] === undefined || o[k] === null || typeof o[k] === t;
  return ok("agent", "string") && ok("modell", "string") && ok("effort", "string") && ok("schwelle", "number") ? o as Partial<Werte> : null;
};

// EIN PROFIL aus dem eigenen Speicher oder einem vollständigen Export (exportJson#voll); null = passt nicht
export function profilAus(v: unknown): Profil | null {
  const o = obj(v);
  const id = str(o?.id, 80), rolle = o?.rolle, schiene = o?.schiene;
  if (!o || !id || !ROLLEN.includes(rolle as PlanRolle) || !SCHIENEN.includes(schiene as Schiene)) return null;
  const agent = o.agent ?? null, modell = o.modell ?? null, effort = o.effort ?? null, schwelle = o.uebergabeAb ?? o.schwelle ?? null;
  if ((agent !== null && typeof agent !== "string") || (modell !== null && typeof modell !== "string") || (effort !== null && typeof effort !== "string") || (schwelle !== null && zahl(schwelle) === null)) return null;
  const schalter = o.schalter === undefined ? {} : schalterAus(o.schalter);
  const werte = o.werte === undefined ? {} : werteAus(o.werte);
  const datei = o.datei === undefined ? null : quelleAus(o.datei);
  if (!schalter || !werte || (o.datei !== undefined && !datei)) return null;
  let autonomie: Punkt[] | null = null;
  const au = obj(o.autonomie);
  if (Array.isArray(o.autonomie)) {
    autonomie = [];
    for (const x of o.autonomie) {
      const p = obj(x);
      if (!p || typeof p.text !== "string" || !ARTEN.includes(p.art as AutoArt)) return null;
      autonomie.push({ id: str(p.id, 80) ?? `i${autonomie.length}`, text: p.text.slice(0, 2000), art: p.art as AutoArt | "weg",
        vorlage: ARTEN.includes(p.vorlage as AutoArt) && p.vorlage !== "weg" ? p.vorlage as AutoArt : null });
    }
  } else if (au) {
    // die Form des Exports: je Art die Texte
    autonomie = [];
    for (const art of ARTEN) {
      const liste = au[art];
      if (liste === undefined) continue;
      if (!Array.isArray(liste) || !liste.every((t) => typeof t === "string")) return null;
      for (const t of liste as string[]) autonomie.push({ id: `i${autonomie.length}`, text: t.slice(0, 2000), art, vorlage: null });
    }
  } else if (o.autonomie !== undefined && o.autonomie !== null) return null;
  const kv = str(o.kopieVon, 120);
  const kopie = obj(o.kopieVon);
  const glyph = GLYPHEN.has(o.glyph as Glyph) ? o.glyph as Glyph : "file";
  return { id, name: str(o.name, 80) ?? id, glyph, v: Math.max(1, Math.floor(zahl(o.version) ?? zahl(o.v) ?? 1)), kurz: str(o.kurz, 120) ?? "",
    satz: str(o.satz, 300) ?? "", autor: str(o.autor, 40) ?? "?", rolle: rolle as PlanRolle, schiene: schiene as Schiene,
    agent: agent as string | null, modell: modell as string | null, effort: effort as string | null, schwelle: schwelle as number | null, schalter, nativ: null,
    einV: Math.max(1, Math.floor(zahl(o.einV) ?? 1)), rechteV: Math.max(1, Math.floor(zahl(o.rechteV) ?? 1)), werte, autonomie,
    ...(datei ? { datei } : {}),
    ...(kv ? { kopieVon: { name: kv.split("@")[0], v: Number(kv.split("@")[1]) || 1 } } : kopie && typeof kopie.name === "string" ? { kopieVon: { name: kopie.name, v: zahl(kopie.v) ?? 1 } } : {}) };
}

// DAS PROTOKOLL (k15-entwurf-modell.ts#Protokoll): je Teil Text, eine ganze Zahl ab 1 oder null; sonst null für „passt nicht“. Ein Text über
// MAX_PROTOKOLL_TEXT passt nicht, statt still gekürzt zu werden (eine Prüfregel mit einem Satz über Modellwechsel hatte mehr als 300 Zeichen)
export const MAX_PROTOKOLL_TEXT = 1000;
function protokollAus(v: unknown): Protokoll | null {
  const o = obj(v);
  if (!o) return null;
  const text = (x: unknown): string | null | false => x === null || x === undefined ? null
    : typeof x === "string" && x.trim() && x.trim().length <= MAX_PROTOKOLL_TEXT ? x.trim() : false;
  const ende = text(o.ende), regel = text(o.regel);
  const runden = o.runden === null || o.runden === undefined ? null : Number.isInteger(o.runden) && Number(o.runden) >= 1 && Number(o.runden) <= 99 ? Number(o.runden) : false;
  return ende === false || regel === false || runden === false ? null : { ende, runden, regel };
}

// was ein Profil ausmacht, ohne Herkunft und Version: so erkennt der Import, ob ein eingebettetes Profil das hiesige ist
const kern = (p: Profil): string => JSON.stringify([p.rolle, p.schiene, p.agent, p.modell, p.effort, p.schwelle, p.schalter, p.werte, p.autonomie?.map((x) => [x.art, x.text]) ?? null,
  p.datei ? p.datei.abschnitte.map((a) => [a.titel, a.text]) : null]);

// IMPORT EINER KONSTELLATION: jede Position geprüft (Typen, Eltern, kein Kreis), ihre Profile aufgelöst. Ein eingebettetes Profil, das
// es hier nicht gibt oder das hier anders ist, kommt als eigenes dazu; ersetzt wird nie still (Punkt 6). `hinweise` sagt, was dazukam.
// `behalte` ist die Kennung einer auf dem Server gespeicherten Konstellation (k15-zustand.ts#lade): Sie behält dann ihre Kennung, so bleibt
// jedes Laden derselbe Aufbau; ohne sie bekommt die Konstellation eine neue. Ihre Sessions behalten immer ihre Kennungen (sie gelten nur in
// ihrer Konstellation): so hat ein Import dieselbe Fassung wie sein Export (konst-fassungen.ts#fassungsHash, server/fassung-reise.test.ts).
// laeufe: die mitgereisten Läufe als Bericht (src/lauf-bericht.ts), nur zum Lesen
export interface KonstImport { k: Konst; neueProfile: Profil[]; hinweise: string[]; laeufe: LaufBericht[] }
export function importKonst(text: string, profile: readonly Profil[], jetzt: number, behalte?: string): KonstImport | string {
  let roh: unknown;
  try { roh = JSON.parse(text); } catch { return "not valid JSON"; }
  const o = obj(roh);
  if (!o) return "this is not a Fleet export";
  if (o.fleet !== "konstellation") return `level "${typeof o.fleet === "string" ? o.fleet.slice(0, 40) : "unknown"}" found; only a constellation can be imported here`;
  const ps = o.positionen;
  if (!Array.isArray(ps) || !ps.length) return "the constellation has no sessions";
  if (ps.length > MAX_POSITIONEN) return `${ps.length} sessions are more than a setup can hold here (at most ${MAX_POSITIONEN})`;
  const roheP = ps.map(obj);
  const i = roheP.findIndex((x) => !x || !str(x.id, 60));
  if (i >= 0) return `session ${i + 1} has no valid id`;
  const ids = roheP.map((x) => String(x?.id).slice(0, 60));
  if (new Set(ids).size !== ids.length) return "two sessions share one id";
  const neueProfile: Profil[] = [];
  const hinweise: string[] = [];
  const bekannt = (id: string) => [...profile, ...neueProfile].find((p) => p.id === id);
  // EIN IMPORT STARTET NIE ALS ORCHESTRATORIN (docs/start/system-concept.md: „never in bypass, until its owner has looked at it“; Sicherheitsprüfung
  // Lauf 2, F3): ihre Rolle läuft in bypassPermissions. Eine Session, deren Profil sie trägt, kommt ohne Rolle an, bis der Owner sie ihr gibt.
  // Nur das eigene Laden (behalte) behält sie
  const gestutzt = new Map<string, string>();
  const ohneBypass = (p: Profil, wer: string): Profil => {
    if (behalte || p.rolle !== "orchestratorin") return p;
    hinweise.push(`${wer} arrived as ${p.name}: an import never starts in bypassPermissions, so the session starts without a role until you give it one`);
    return { ...p, rolle: "nur-ordner", schiene: "session" };
  };
  const profilFuer = (v: unknown, wer: string): string | { id: string } => {
    if (typeof v === "string") {
      const [id, ver] = v.split("@");
      const da = bekannt(id);
      if (!da) return `${wer}: the profile "${id.slice(0, 60)}" does not exist here; export in full and it travels along`;
      if (ver && Number(ver) !== da.v) hinweise.push(`${wer} takes ${da.name} v${da.v}; the export had v${ver}`);
      const ohne = ohneBypass(da, wer);
      if (ohne === da) return { id: da.id };
      const schon = gestutzt.get(da.id);
      if (schon) return { id: schon };
      if (neueProfile.length + profile.length >= MAX_PROFILE + PROFILE0.length) return `${wer}: too many profiles`;
      const neu: Profil = { ...ohne, id: `${da.id}-i${jetzt}-${neueProfile.length}`, name: `${da.name} (imported)`, nativ: null };
      neueProfile.push(neu);
      gestutzt.set(da.id, neu.id);
      return { id: neu.id };
    }
    const roh = profilAus(v);
    if (!roh) return `${wer}: the profile that came along is incomplete`;
    const p = ohneBypass(roh, wer);
    const da = bekannt(p.id);
    if (da && kern(da) === kern(p)) return { id: da.id };
    if (neueProfile.length + profile.length >= MAX_PROFILE + PROFILE0.length) return `${wer}: too many profiles`;
    const neu: Profil = { ...p, id: da ? `${p.id}-i${jetzt}-${neueProfile.length}` : p.id, name: da ? `${p.name} (imported)` : p.name,
      nativ: da?.nativ ?? null };
    neueProfile.push(neu);
    hinweise.push(da ? `${p.name} differs here and is added as "${neu.name}"` : `the profile ${p.name} is added`);
    return { id: neu.id };
  };
  const neu: Position[] = [];
  for (const [n, x] of roheP.entries()) {
    if (!x) return `session ${n + 1} is empty`;
    const name = x.name === undefined ? ids[n] : str(x.name, 80);
    if (!name) return `session ${ids[n]} has no valid name`;
    const pr = profilFuer(x.profil, name);
    if (typeof pr === "string") return pr;
    const abw = x.abweichend === undefined ? undefined : abwAus(x.abweichend);
    const werteAbw = x.werteAbw === undefined ? undefined : werteAus(x.werteAbw);
    const schalter = x.schalter === undefined ? undefined : schalterAus(x.schalter);
    const ohne = x.ohneTeile;
    if (abw === null || werteAbw === null || schalter === null || (ohne !== undefined && !(Array.isArray(ohne) && ohne.every((t) => typeof t === "string"))))
      return `session ${name}: its settings do not fit`;
    if (x.wann !== undefined && typeof x.wann !== "string") return `session ${name}: "wann" is not text`;
    // was mit dem Sitz reiste (src/sitz.ts); ein schiefer Block lehnt die ganze Datei ab, wie eine schiefe Einstellung
    const sitzRoh: Sitz | string | undefined = x.sitz === undefined || x.sitz === null ? undefined : sitzAus(x.sitz);
    if (typeof sitzRoh === "string") return `session ${name}: ${sitzRoh}`;
    // aus einer Datei kommt keine Freigabe der Rechte und kein Recht am Sitz vorbei an sitz.darf, das die Tür deckelt (src/sitz.ts#sitzRechte);
    // beides steht nur im eigenen Speicher (behalte)
    const sitz = sitzRoh && !behalte ? { ...sitzRoh, persoenlich: sitzRoh.persoenlich, darf: sitzZumTeilen(sitzRoh).darf } : sitzRoh;
    const rechte = behalte && x.rechte !== undefined ? rechteAus(x.rechte) : null;
    let datei: Quelle | undefined;
    if (typeof x.eigeneDatei === "string") hinweise.push(`${name}: the own file ${x.eigeneDatei.slice(0, 80)} was only named, not included`);
    else if (x.eigeneDatei !== undefined) {
      const d = quelleAus(x.eigeneDatei);
      if (!d) return `session ${name}: its own file is incomplete`;
      datei = d;
    }
    neu.push(pos(ids[n], name, pr.id, { ...(abw ? { abw } : {}), ...(werteAbw ? { werteAbw } : {}), ...(schalter ? { schalter } : {}),
      ...(ohne ? { ohne: (ohne as string[]).slice(0, 200) } : {}), ...(typeof x.wann === "string" ? { wann: x.wann.slice(0, 200) } : {}), ...(datei ? { datei } : {}),
      ...(sitz ? { sitz } : {}), ...(rechte ? { rechte } : {}) }));
  }
  // die Eltern: jede `meldetAn` muss es geben, keine Session meldet an sich selbst, und kein Kreis
  const vater = new Map<string, string>();
  for (const [n, x] of roheP.entries()) {
    const m = x?.meldetAn;
    if (m === undefined || m === null) continue;
    if (typeof m !== "string" || !ids.includes(m)) return `${neu[n].name} reports to a session that is not in the export`;
    if (m === ids[n]) return `${neu[n].name} reports to itself`;
    vater.set(ids[n], m);
  }
  for (const id of ids) {
    const weg = new Set<string>();
    for (let x: string | undefined = id; x !== undefined; x = vater.get(x)) {
      if (weg.has(x)) return "the reporting lines form a cycle";
      weg.add(x);
    }
  }
  const wurzeln: Position[] = [];
  neu.forEach((p, n) => {
    const v = vater.get(ids[n]);
    const vp = v === undefined ? undefined : neu[ids.indexOf(v)];
    if (vp) vp.kids = [...(vp.kids ?? []), p];
    else wurzeln.push(p);
  });
  const autor = str(o.autor, 40)?.trim();
  const protokoll = o.protokoll === undefined ? undefined : protokollAus(o.protokoll);
  if (protokoll === null) return "the protocol does not fit";
  const aufgabe = o.aufgabe === undefined ? undefined : aufgabeAus(o.aufgabe);
  if (typeof aufgabe === "string") return `the task does not fit: ${aufgabe}`;
  const laeufe = o.laeufe === undefined ? [] : laufBerichteAus(o.laeufe, ids);
  if (typeof laeufe === "string") return laeufe;
  if (laeufe.length) hinweise.push(`${laeufe.length === 1 ? "one run travels" : `${laeufe.length} runs travel`} along as a report, read only`);
  // woraus sie exportiert wurde: der sha256 der Fassung dort (server/konst-fassungen.ts#fassungsHash)
  if (o.abgeleitetVon !== undefined && !(typeof o.abgeleitetVon === "string" && /^[0-9a-f]{64}$/.test(o.abgeleitetVon)))
    return "abgeleitetVon is the sha256 of the version it was exported from";
  const abgeleitetVon = typeof o.abgeleitetVon === "string" ? o.abgeleitetVon : undefined;
  return { k: { id: behalte ?? `i${jetzt}`, name: str(o.name, 80) ?? "Imported", v: Math.max(1, Math.floor(zahl(o.version) ?? 1)), satz: str(o.satz, 300) ?? "imported", eigen: true,
    ...(autor ? { autor } : {}), ...(typeof o.quer === "string" ? { quer: o.quer.slice(0, 300) } : {}),
    ...(abgeleitetVon ? { abgeleitetVon } : {}), ...(protokoll ? { protokoll } : {}), ...(aufgabe ? { aufgabe } : {}), ...(laeufe.length ? { laeufe } : {}),
    wurzeln }, neueProfile, hinweise, laeufe };
}
