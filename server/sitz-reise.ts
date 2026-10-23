// EINE KONSTELLATION REIST GANZ (docs/start/direction.md Schritt 3; src/sitz.ts für die Form). Drei Wege, alle hier:
// - DIE DATEI (GET /api/k15/konst/:id/datei): die gespeicherte Konstellation mit je Sitz, was er liest, darf und in seinem Notizbuch hat, mit
//   ihren Läufen und „abgeleitetVon“ = dem Hash ihrer Fassung hier. Persönliches geht nie hinaus: jeder persönliche Platz leer, und eine
//   Probe sucht vor der Antwort jeden persönlichen Text in der Datei; findet sie einen, gibt es keine Datei.
// - DIE TÜR (`sitz: "<konst>/<position>"` an /api/slots/:id/open und /api/branches/open): ein Sitz einer importierten Konstellation startet
//   mit dem, was mitreiste, statt mit dieser Fleet Bibliothek; seine Rechte kommen mit, und sein Notizbuch wird gesät, wenn es noch leer ist.
// - DER START (seatStartFor in server.ts): die Packs des Sitzes, die persönlichen Plätze gefüllt mit dem Eigenen dessen, der importiert hat.
// server.ts reicht, was nur es kennt (Bibliothek, Notizbuch-Ordner, Läufe), als Funktionen herein.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { laufBerichteAus, MAX_LAEUFE, type LaufBericht } from "../src/lauf-bericht";
import {
  istPersoenlich, notizbuchZumTeilen, persoenlichIn, sitzAus, sitzRechte, sitzZumTeilen, type PersoenlichPlatz, type Sitz, type SitzNotizbuch, type SitzPack,
} from "../src/sitz";
import { rechteAus, type Rechte } from "../session-rechte";
import { fassungsHash } from "./konst-fassungen";
import { kindNieWeiter, type Oeffnerin } from "./kind-weite";
import type { Lauf } from "./laeufe";
import { seatPacks, type SeatKnowledge, type SeatPack } from "./sitz-wissen";

const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;

// WAS DER SLOT TRÄGT (Slot.sitz, persistiert wie Slot.agentMd): woher, und was er liest; Rechte und Notizbuch hat die Tür schon gesetzt
export interface SitzStart { konst: string; pos: string; herkunft: string | null; liest: SitzPack[]; persoenlich: PersoenlichPlatz[] }

export function sitzStartGeladen(raw: unknown, harness: string): SitzStart | null {
  const r = rec(raw);
  if (harness !== "claude" || !r || typeof r.konst !== "string" || typeof r.pos !== "string") return null;
  const s = sitzAus({ liest: r.liest, persoenlich: r.persoenlich, darf: {}, notizbuch: null });
  if (typeof s === "string") return null;
  return { konst: r.konst, pos: r.pos, herkunft: typeof r.herkunft === "string" ? r.herkunft : null, liest: s.liest, persoenlich: s.persoenlich };
}

const alsSeatPack = (p: SitzPack): SeatPack => ({ id: p.id, useWhen: p.wofuer, sources: p.quellen.map((q) => ({ path: q.pfad, anchor: q.anker })),
  text: p.text, weg: p.weg });
// DAS WISSEN EINES MITGEREISTEN SITZES: seine Packs aus der Datei; ein persönlicher Platz mit dem, was der Importierende hineinschrieb, sonst mit
// dem Pack gleichen Namens aus seiner eigenen Bibliothek (`eigene`, null wenn sie nicht lesbar ist), sonst bleibt er leer
export function sitzWissen(s: SitzStart, eigene: SeatKnowledge | null): SeatKnowledge {
  const gefuellt = s.persoenlich.flatMap((p): SeatPack[] => {
    if (p.text) return [alsSeatPack({ ...p, text: p.text })];
    const da = eigene?.packs.find((x) => x.id === p.id && x.text !== null);
    return da ? [{ ...da, weg: p.weg }] : [];
  });
  return { tree: eigene?.tree ?? "foreign", repoRoot: "mitgereist", head: s.herkunft ?? "", packs: [...s.liest.map(alsSeatPack), ...gefuellt] };
}
// welche persönlichen Plätze leer starten: kein eigener Text und kein Pack dieses Namens in der eigenen Bibliothek
export const leerePlaetze = (s: SitzStart, eigene: SeatKnowledge | null): string[] =>
  s.persoenlich.filter((p) => !p.text && !eigene?.packs.some((x) => x.id === p.id && x.text !== null)).map((p) => p.id);

// DIE TÜR: `sitz` fehlt → nichts; sonst "<konst>/<position>" einer gespeicherten Konstellation, deren Position einen Sitz-Block trägt
export async function sitzDerTuer(body: Record<string, unknown> | null, harness: string, dir: string, label: string | null, orchLabel: (l: string) => boolean):
  Promise<{ ok: true; sitz: SitzStart | null; rechte: Rechte | null; notizbuch: SitzNotizbuch | null } | { ok: false; error: string }> {
  const v = body?.sitz;
  if (v === undefined || v === null) return { ok: true, sitz: null, rechte: null, notizbuch: null };
  const m = typeof v === "string" ? /^([^/]{1,80})\/([^/]{1,60})$/.exec(v) : null;
  if (!m) return { ok: false, error: "sitz must be \"<constellation id>/<position id>\" of a saved constellation" };
  if (harness !== "claude") return { ok: false, error: `harness ${harness} takes no sitz — what it reads goes into Claude Code's start` };
  // ein importierter Aufbau startet nie in bypass (system-concept.md: „never in bypass, until its owner has looked at it“); die Orchestratorin tut es
  if (label && orchLabel(label)) return { ok: false, error: "an imported seat never starts as the orchestrator — she runs in bypassPermissions" };
  let gespeichert: unknown;
  try { gespeichert = await Bun.file(join(dir, SPEICHER_DATEI)).json(); } catch { return { ok: false, error: "no saved constellations to read" }; }
  const liste = rec(gespeichert)?.konstellationen;
  const form = Array.isArray(liste) ? liste.map(rec).find((k) => k?.id === m[1]) : undefined;
  if (!form) return { ok: false, error: `no saved constellation „${m[1]}“` };
  const pos = Array.isArray(form.positionen) ? form.positionen.map(rec).find((p) => p?.id === m[2]) : undefined;
  if (!pos?.sitz) return { ok: false, error: `position „${m[2]}“ of „${m[1]}“ carries no sitz` };
  const s = sitzAus(pos.sitz);
  if (typeof s === "string") return { ok: false, error: `sitz of „${m[2]}“: ${s}` };
  const herkunft = typeof form.abgeleitetVon === "string" ? form.abgeleitetVon : null;
  // die Rechte aus der Datei gedeckelt, außer der Owner hier hat sie bestätigt (src/sitz.ts#sitzRechte)
  return { ok: true, sitz: { konst: m[1]!, pos: m[2]!, herkunft, liest: s.liest, persoenlich: s.persoenlich }, rechte: sitzRechte(s.darf), notizbuch: s.notizbuch };
}

// WAS DER SITZ AN DER TÜR DARF: die Rechte des Bodys, sonst die aus seinem Sitz-Block (schon gedeckelt, sitzDerTuer). An der Self-Tür
// (`oeffnerin` gesetzt) geht auch das Darf aus der Datei durch dieselbe Regel wie der Body (server/kind-weite.ts#kindNieWeiter): Hat die
// Öffnerin keine Rechte, setzt die Self-Tür die des Kindes auf null, und das Darf aus der Datei füllte sonst ungeprüft die Lücke
export function rechteAnDerTuer(body: Rechte | null, sitz: Rechte | null, harness: string, oeffnerin: Oeffnerin | null):
  { ok: true; rechte: Rechte | null } | { ok: false; error: string } {
  if (body || !sitz) return { ok: true, rechte: body };
  if (oeffnerin) {
    const k = kindNieWeiter(oeffnerin, { harness, rechte: sitz });
    if (!k.ok) return { ok: false, error: `sitz: ${k.error}` };
  }
  return { ok: true, rechte: sitz };
}

// DAS NOTIZBUCH SÄEN: nur in einen Ordner ohne MEMORY.md (ein Notizbuch, das schon etwas weiß, überschreibt keine Datei); zurück, ob gesät wurde
export function saeNotizbuch(pfad: string, nb: SitzNotizbuch): boolean {
  if (existsSync(join(pfad, "MEMORY.md")) || (!nb.notizen.length && !nb.index.trim())) return false;
  mkdirSync(pfad, { recursive: true, mode: 0o700 });
  for (const n of nb.notizen) if (!existsSync(join(pfad, n.datei))) writeFileSync(join(pfad, n.datei), n.text);
  writeFileSync(join(pfad, "MEMORY.md"), nb.index);
  return true;
}
// was ein Notizbuch-Ordner hat: MEMORY.md und die Notizen daneben; null = kein Ordner
export function liesNotizbuch(pfad: string): { index: string; dateien: { datei: string; text: string }[] } | null {
  if (!existsSync(pfad)) return null;
  const index = existsSync(join(pfad, "MEMORY.md")) ? readFileSync(join(pfad, "MEMORY.md"), "utf8") : "";
  const dateien = readdirSync(pfad).filter((f) => f.endsWith(".md") && f !== "MEMORY.md").sort()
    .map((datei) => ({ datei, text: readFileSync(join(pfad, datei), "utf8") }));
  return { index, dateien };
}

// EIN LAUF AUS DEM LAUFBUCH DIESER FLEET als Bericht (src/lauf-bericht.ts): nur ein beendeter, nur Positionen dieser Konstellation; Slots,
// Ordner und Branches bleiben daheim, denn sie sind die dieser Fleet
export function laufAlsBericht(l: Lauf, positionen: readonly string[]): LaufBericht | null {
  if (!l.ende) return null;
  const je = new Map<string, number>();
  for (const p of l.positionen) if (positionen.includes(p.pos)) je.set(p.pos, (je.get(p.pos) ?? 0) + 1);
  if (!je.size) return null;
  return { fassung: l.hash, quelle: `Laufbuch einer Fleet, Lauf ${l.id}`, start: new Date(l.at).toISOString(), ende: new Date(l.ende.at).toISOString(),
    sitze: [...je].map(([pos, n]) => ({ pos, wie: n === 1 ? "eine Session" : `${n} Sessions nacheinander (Nachfolge)`, ablehnungen: null, zahlen: { sessions: n } })),
    nachrichten: [], befunde: [], ohneBefund: [], kosten: "nicht gemessen",
    grenzen: [`endete ${l.ende.wie === "hand" ? "von Hand" : "mit der letzten Session"}; Nachrichten, Befunde und Kosten trägt nur ein Bericht, den jemand schreibt`] };
}

// WAS server.ts HEREINREICHT: die Bibliothek eines Sitzes (wirft, wenn sie nicht lesbar ist), das Notizbuch eines Profils, die eigenen Läufe
export interface DateiQuellen {
  bibliothek: () => Promise<SeatKnowledge>;
  notizbuch: (profil: string) => Promise<{ index: string; dateien: { datei: string; text: string }[] } | null>;
  laeufe: readonly Lauf[];
  modus: string;
}
export interface Datei { datei: Record<string, unknown>; hinweise: string[] }

const istClaude = (agent: unknown): boolean => agent === null || agent === undefined || (typeof agent === "string" && /^claude/.test(agent));
// DIE DATEI einer gespeicherten Konstellation; ein Satz, wenn es keine gibt
export async function dateiFuer(form: Record<string, unknown>, q: DateiQuellen): Promise<Datei | string> {
  const { id: _id, ...ohneId } = form;
  const positionen = Array.isArray(form.positionen) ? form.positionen.map(rec) : [];
  if (!positionen.length || positionen.some((p) => !p || typeof p.id !== "string")) return "die gespeicherte Konstellation hat keine lesbaren Positionen";
  const hinweise: string[] = [];
  let bibliothek: SeatKnowledge | string | null = null;
  const liesBibliothek = async (): Promise<SeatKnowledge | string> => {
    if (bibliothek === null) bibliothek = await q.bibliothek().catch((e: unknown) => e instanceof Error ? e.message : String(e));
    return bibliothek;
  };
  const mitSitz: Record<string, unknown>[] = [];
  for (const p of positionen as Record<string, unknown>[]) {
    const profil = rec(p.profil);
    const name = typeof p.name === "string" ? p.name : String(p.id);
    if (!profil || profil.rolle !== "nur-ordner" || !istClaude(profil.agent)) {
      const { sitz: _s, rechte: _r, ...ohne } = p;
      mitSitz.push(ohne);
      hinweise.push(`${name}: ${!profil ? "nur als Verweis exportiert" : profil.rolle !== "nur-ordner" ? `was eine ${String(profil.rolle)} liest, gibt ihre Rolle in der Fleet, die sie startet` : "liest Fleets Packs nicht im Start (kein Claude Code)"}; kein Sitz-Block`);
      continue;
    }
    const da = p.sitz === undefined ? null : sitzAus(p.sitz);
    if (typeof da === "string") return `${name}: ${da}`;
    let liest: SitzPack[] = [], persoenlich: PersoenlichPlatz[] = [];
    if (da) ({ liest, persoenlich } = da);
    else {
      const k = await liesBibliothek();
      if (typeof k === "string") hinweise.push(`${name}: Fleets Bibliothek ist hier nicht lesbar (${k}); er reist ohne Packs`);
      else {
        const wege = seatPacks(k);
        for (const pk of k.packs) {
          const weg = wege.box.includes(pk.id) ? "start" as const : wege.skills.includes(pk.id) ? "skill" as const : null;
          if (!weg || pk.text === null) continue;
          const quellen = pk.sources.map((s) => ({ pfad: s.path, anker: s.anchor }));
          if (istPersoenlich(pk.id)) persoenlich.push({ id: pk.id, weg, quellen, wofuer: pk.useWhen, text: null });
          else liest.push({ id: pk.id, weg, quellen, wofuer: pk.useWhen, text: pk.text });
        }
      }
    }
    // das Notizbuch: ein Sitz mit Agent-MD hat sein eigenes (server/notizbuch.ts, profil-<id>); was es hier weiß, geht vor dem, was mitreiste
    let notizbuch: SitzNotizbuch | null = da?.notizbuch ?? null;
    if (profil.datei && typeof profil.id === "string") {
      const nb = await q.notizbuch(profil.id).catch(() => null);
      if (nb && (nb.index.trim() || nb.dateien.length)) notizbuch = notizbuchZumTeilen(nb.index, nb.dateien);
    }
    if (notizbuch?.daheim) hinweise.push(`${name}: ${notizbuch.daheim} Notiz${notizbuch.daheim === 1 ? "" : "en"} über den Owner ${notizbuch.daheim === 1 ? "bleibt" : "bleiben"} daheim`);
    // was er darf: was hier an ihm gesetzt ist (Position.rechte, so startet ihn das Fenster), sonst was mit ihm hierher reiste
    const rechte = (p.rechte === undefined ? null : rechteAus(p.rechte)) ?? da?.darf.rechte ?? null;
    const sitz: Sitz = sitzZumTeilen({ liest, persoenlich, darf: { rechte, modus: q.modus }, notizbuch });
    const { rechte: _r, ...ohneRechte } = p;
    mitSitz.push({ ...ohneRechte, sitz });
  }
  const ids = positionen.map((p) => String(p?.id));
  const mitgereist = Array.isArray(form.laeufe) ? laufBerichteAus(form.laeufe, ids) : [];
  if (typeof mitgereist === "string") return `die mitgereisten Läufe: ${mitgereist}`;
  const eigene = q.laeufe.flatMap((l) => { const b = laufAlsBericht(l, ids); return b ? [b] : []; });
  const laeufe = [...eigene, ...mitgereist].slice(0, MAX_LAEUFE);
  const datei: Record<string, unknown> = { ...ohneId, abgeleitetVon: fassungsHash(form), positionen: mitSitz, ...(laeufe.length ? { laeufe } : {}) };
  if (!laeufe.length) delete datei.laeufe;
  // DIE PROBE: kein persönlicher Text, weder der eigenen Bibliothek noch einer, den ein Importierender hier in einen Platz schrieb
  const text = JSON.stringify(datei);
  const k = await liesBibliothek();
  const persoenlicheTexte = [
    ...(typeof k === "string" ? [] : k.packs.filter((pk) => istPersoenlich(pk.id) && pk.text !== null).map((pk) => pk.text as string)),
    ...positionen.flatMap((p) => { const s = p?.sitz === undefined ? null : sitzAus(p.sitz); return s && typeof s !== "string" ? s.persoenlich.flatMap((x) => x.text ? [x.text] : []) : []; }),
  ];
  const fund = persoenlichIn(text, persoenlicheTexte);
  if (fund) return `die Datei enthielte persönlichen Text („${fund}…“) und geht so nicht hinaus`;
  // was sonst nicht in eine geteilte Datei gehört, sagt die Antwort, entscheiden tut der Owner (das Repo ist öffentlich)
  const name = hostname().split(".")[0]?.toLowerCase();
  const muster: [string, RegExp][] = [["ein Pfad auf einem Rechner", /\/Users\/|\/home\/|\/private\//], ["eine IP-Adresse", /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
    ["ein Token", /Bearer\s+\S|x-fleet-self-token:\s*[0-9a-f]|FLEET_[A-Z_]*TOKEN=/i], ...(name && name.length >= 4 ? [["der Name dieses Rechners", new RegExp(`\\b${name.replace(/[^a-z0-9-]/g, "")}\\b`, "i")] as [string, RegExp]] : [])];
  for (const [was, re] of muster) { const m = re.exec(text); if (m) hinweise.push(`Vor dem Teilen ansehen: ${was} steht darin („${m[0].slice(0, 40)}“)`); }
  return { datei, hinweise };
}
