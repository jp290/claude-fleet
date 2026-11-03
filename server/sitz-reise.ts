// EINE KONSTELLATION REIST GANZ (docs/start/direction.md Schritt 3; src/sitz.ts für die Form). Drei Wege, alle hier:
// - DIE DATEI (GET /api/k15/konst/:id/datei): die gespeicherte Konstellation mit je Sitz, was er liest, darf und in seinem Notizbuch hat, mit
//   ihren Läufen und „abgeleitetVon“ = dem Hash ihrer Fassung hier. Persönliches geht nie hinaus: jeder persönliche Platz leer, und eine
//   Probe sucht vor der Antwort jeden persönlichen Text in der Datei; findet sie einen, gibt es keine Datei.
// - DIE TÜR (`sitz: "<konst>/<position>"` an /api/slots/:id/open und /api/branches/open): ein Sitz einer importierten Konstellation startet
//   mit dem, was mitreiste, statt mit dieser Fleet Bibliothek; seine Rechte kommen mit, und sein Notizbuch wird gesät, wenn es noch leer ist.
//   Die Position braucht keinen Sitz-Block (eine Datei von vor Schritt 3 hat keinen; dann liest sie diese Fleet Bibliothek): ihre eigene
//   Datei ist ihr Auftrag, die Agent-MD ihres Profils kommt aus der Datei, nicht aus einem hier gespeicherten Profil, und Agent, Modell und
//   Effort aus der Datei gelten, wo die Tür keine bekommt (Schritt 5, Lauf 2: der Finder kam ohne seine Agent-MD, der Prover ohne seinen
//   Brief). An der Self-Tür reicht die Kennung der Position: sie gilt in der Konstellation der Öffnerin.
// - DER START (seatStartFor in server.ts): die Packs des Sitzes, die persönlichen Plätze gefüllt mit dem Eigenen dessen, der importiert hat.
// server.ts reicht, was nur es kennt (Bibliothek, Notizbuch-Ordner, Läufe), als Funktionen herein.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { aspekt } from "../src/k15-entwurf-modell";
import { laufBerichteAus, MAX_LAEUFE, type LaufBericht } from "../src/lauf-bericht";
import type { ModellAbschnitt } from "../src/modell-verlauf";
import {
  istPersoenlich, notizbuchZumTeilen, notizIstPersoenlich, persoenlichIn, sitzAus, sitzRechte, sitzZumTeilen, type PersoenlichPlatz, type Sitz, type SitzKonzept, type SitzNotizbuch, type SitzPack, type SitzRichtung,
} from "../src/sitz";
import { rechteAus, istRechtId, type RechtId, type Rechte } from "../session-rechte";
import { agentMdText, MAX_AGENTMD_BYTES, type AgentMd } from "./agentmd";
import { permissionModeDerTuer, type PermissionModeWahl } from "./eigenes-setup";
import { fassungsHash } from "./konst-fassungen";
import { kindNieWeiter, type Oeffnerin } from "./kind-weite";
import type { Lauf } from "./laeufe";
import { seatPacks, type SeatKnowledge, type SeatPack } from "./sitz-wissen";
import { liesShelf, RICHTUNG_PLATZ } from "./setup-datei";

const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;

// WAS DER SLOT TRÄGT (Slot.sitz, persistiert wie Slot.agentMd): woher, und was er liest; Rechte und Notizbuch hat die Tür schon gesetzt.
// `block`: die Position trug einen Sitz-Block; ohne ihn liest der Sitz diese Fleet Bibliothek. `auftrag`: ihre eigene Datei, die Aufgabe
// seiner Fassung und seine erste Nachricht
export interface SitzAuftrag { titel: string; text: string }
export interface SitzStart { konst: string; pos: string; herkunft: string | null; liest: SitzPack[]; persoenlich: PersoenlichPlatz[]; block: boolean; auftrag: SitzAuftrag | null;
  richtung?: SitzRichtung | null; konzepte?: SitzKonzept[]; rolle?: string;
  /** der Setup-Hash der importierten Datei, aus der dieser Sitz kam (Richtung Schritt 4: der Start nennt ihn) */
  setupHash?: string;
  /** F1 Runde 2: was die Datei der Position mitgibt — der Name der Konstellation, das Ziel (erste Nachricht), der leere Ordnerplatz mit dem Hinweis des Absenders;
   *  `zielErsetzt`: die Tür nannte ein eigenes Ziel, das Ziel der Datei galt nicht */
  konstName?: string; ziel?: string; zielErsetzt?: true; ordner?: { hint: string | null } }

const auftragAus = (v: unknown): SitzAuftrag | null => {
  const r = rec(v);
  return r && typeof r.titel === "string" && typeof r.text === "string" && r.text ? { titel: r.titel, text: r.text } : null;
};
export function sitzStartGeladen(raw: unknown, harness: string): SitzStart | null {
  const r = rec(raw);
  if (harness !== "claude" || !r || typeof r.konst !== "string" || typeof r.pos !== "string") return null;
  const s = sitzAus({ liest: r.liest, persoenlich: r.persoenlich, darf: {}, notizbuch: null,
    ...(r.richtung !== undefined ? { richtung: r.richtung } : {}), ...(r.konzepte !== undefined ? { konzepte: r.konzepte } : {}),
    ...(r.rolle !== undefined ? { rolle: r.rolle } : {}) });
  if (typeof s === "string") return null;
  // ein Slot von vor dem Auftrag hatte immer einen Block (die Tür verlangte ihn)
  return { konst: r.konst, pos: r.pos, herkunft: typeof r.herkunft === "string" ? r.herkunft : null, liest: s.liest, persoenlich: s.persoenlich,
    block: r.block !== false, auftrag: auftragAus(r.auftrag), richtung: s.richtung ?? null, konzepte: s.konzepte ?? [],
    ...(s.rolle ? { rolle: s.rolle } : {}),
    ...(typeof r.setupHash === "string" && /^[0-9a-f]{64}$/.test(r.setupHash) ? { setupHash: r.setupHash } : {}),
    ...(typeof r.konstName === "string" ? { konstName: r.konstName } : {}), ...(typeof r.ziel === "string" && r.ziel ? { ziel: r.ziel } : {}),
    ...(r.zielErsetzt === true ? { zielErsetzt: true as const } : {}),
    ...(rec(r.ordner) && (rec(r.ordner)!.hint === null || typeof rec(r.ordner)!.hint === "string") ? { ordner: { hint: rec(r.ordner)!.hint as string | null } } : {}) };
}

const alsSeatPack = (p: SitzPack): SeatPack => ({ id: p.id, useWhen: p.wofuer, sources: p.quellen.map((q) => ({ path: q.pfad, anchor: q.anker })),
  text: p.text, weg: p.weg, ...(p.author ? { autor: p.author } : {}), ...(p.personal ? { personal: true as const } : {}) });
// DAS WISSEN EINES MITGEREISTEN SITZES: seine Packs aus der Datei; ein persönlicher Platz mit dem, was der Importierende hineinschrieb, sonst mit
// dem Pack gleichen Namens aus seiner eigenen Bibliothek (`eigene`, null wenn sie nicht lesbar ist), sonst bleibt er leer
export function sitzWissen(s: SitzStart, eigene: SeatKnowledge | null): SeatKnowledge {
  const gefuellt = s.persoenlich.flatMap((p): SeatPack[] => {
    // ein persönlicher Platz ist persönlich, ob die Marke an ihm steht oder nur die Liste (server/datengrenze.ts nimmt ihn einem Sitz, der nicht Anthropic ist)
    if (p.text) return [{ ...alsSeatPack({ ...p, text: p.text }), personal: true as const }];
    const da = eigene?.packs.find((x) => x.id === p.id && x.text !== null);
    return da ? [{ ...da, weg: p.weg, personal: true as const }] : [];
  });
  return { tree: eigene?.tree ?? "foreign", repoRoot: "mitgereist", head: s.herkunft ?? "", packs: [...s.liest.map(alsSeatPack), ...gefuellt] };
}
// welche persönlichen Plätze leer starten: kein eigener Text und kein Pack dieses Namens in der eigenen Bibliothek;
// ein persönliches Konzept ist leer, solange es keinen Text trägt
export interface LeererPlatz { kind: "pack" | "concept"; id: string }
export const leerePlaetze = (s: SitzStart, eigene: SeatKnowledge | null): LeererPlatz[] => [
  ...s.persoenlich.filter((p) => !p.text && !eigene?.packs.some((x) => x.id === p.id && x.text !== null))
    .map((p): LeererPlatz => ({ kind: "pack", id: p.id })),
  ...(s.konzepte ?? []).filter((c) => c.personal === true && c.text === null && c.hash === null)
    .map((c): LeererPlatz => ({ kind: "concept", id: c.id })),
];
// EINE ZEILE JE LEEREM PLATZ: die Kennung, dass der Platz der Person gehört und hier leer ist, und was ihn füllt. Eine
// mitgereiste Rolle bekommt dazu den Richtungsplatz, denn die Richtung ist immer der Person eigen.
export const leererPlatzZeilen = (s: SitzStart, eigene: SeatKnowledge | null): string[] => [
  ...leerePlaetze(s, eigene).map((p) => p.kind === "pack"
    ? `EMPTY PLACE ${p.id} — the person's own pack, empty here; the importer fills it with their own text or the pack of that name in their library.`
    : `EMPTY PLACE ${p.id} — the person's own concept, empty here; the importer fills it with their own concept of that name.`),
  ...(s.rolle || s.richtung ? [RICHTUNG_PLATZ] : []),
];

// DIE ROLLE EINES IMPORTIERTEN SITZES, wie seine Fassung sie nennt: die Kennung aus dem Sitz-Block der gespeicherten Position,
// der Name des Rollensteins aus dem importierten Regal und das Rechtebundel, das die Datei erbittet — erbeten, bis der Owner
// hier es freigibt (`darf.bestaetigt` steht nur im Speicher, nie in einer Datei). Null: die gespeicherte Position ist nicht
// mehr zu lesen; dann nennt die Fassung nur die Kennung, die der Slot trägt.
export interface SitzRolleRef { readonly id: string; readonly autor: string | null; readonly bundel: readonly RechtId[] | null; readonly bestaetigt: boolean }
export async function sitzRolleDerDatei(dir: string, konst: string, pos: string): Promise<SitzRolleRef | null> {
  const gespeichert: unknown = await Bun.file(join(dir, SPEICHER_DATEI)).json().catch(() => null);
  const alle = rec(gespeichert)?.konstellationen;
  const form = Array.isArray(alle) ? alle.map(rec).find((k) => k?.id === konst) ?? null : null;
  const positionen = form?.positionen;
  const position = Array.isArray(positionen) ? positionen.map(rec).find((p) => p?.id === pos) ?? null : null;
  const sitz = rec(position?.sitz);
  const id = typeof sitz?.rolle === "string" && sitz.rolle ? sitz.rolle : null;
  if (!sitz || !id) return null;
  const darf = rec(sitz.darf);
  const bundel = Array.isArray(darf?.rolle) && darf.rolle.every(istRechtId) ? [...new Set(darf.rolle as RechtId[])] : null;
  return { id, autor: liesShelf(dir).roles?.find((r) => r.id === id)?.name ?? null,
    bundel: bundel?.length ? bundel : null, bestaetigt: darf?.bestaetigt === true };
}

// DIE POSITION HINTER `sitz`: "<konst>/<position>" einer gespeicherten Konstellation, oder an der Self-Tür nur "<position>" in der Konstellation
// der Öffnerin (`eigene`, ihr Slot.sitz.konst)
type Gefunden = { konst: string; form: Record<string, unknown>; pos: Record<string, unknown> };
// `selbst`: die Self-Tür; dort öffnet eine Session nur Sitze ihrer eigenen Konstellation (die Owner-Tür jede gespeicherte)
async function sitzPosition(v: unknown, dir: string, eigene: string | null, selbst = false): Promise<Gefunden | { error: string }> {
  const m = typeof v === "string" ? /^(?:([^/]{1,80})\/)?([^/]{1,60})$/.exec(v) : null;
  if (!m) return { error: "sitz must be \"<constellation id>/<position id>\" of a saved constellation" };
  if (selbst && (!eigene || (m[1] !== undefined && m[1] !== eigene)))
    return { error: "at the self door a session opens only seats of its own imported constellation — the owner door opens any" };
  const konst = m[1] ?? eigene;
  if (!konst) return { error: "sitz without a constellation (\"<position id>\" alone) works only for a seat of an imported constellation, at its self door" };
  let gespeichert: unknown;
  try { gespeichert = await Bun.file(join(dir, SPEICHER_DATEI)).json(); } catch { return { error: "no saved constellations to read" }; }
  const liste = rec(gespeichert)?.konstellationen;
  const form = Array.isArray(liste) ? liste.map(rec).find((k) => k?.id === konst) : undefined;
  if (!form) return { error: `no saved constellation „${konst}“` };
  const pos = Array.isArray(form.positionen) ? form.positionen.map(rec).find((p) => p?.id === m[2]) : undefined;
  if (!pos) return { error: `„${konst}“ has no position „${m[2]}“` };
  return { konst, form, pos };
}
const profilVon = (pos: Record<string, unknown>): Record<string, unknown> | null => rec(pos.profil);
// WAS DIE DATEI ERBITTET UND IM BRIEF STEHT (src/k15-entwurf-modell.ts#ASPEKTE, wirkung „brief“, etwa „Subagents: read only.“): Werte der Position
// vor denen ihres Profils, als die Sätze, die das Modell für sie nennt
export function erbeteneZeilen(pos: Record<string, unknown>): string[] {
  const werte = { ...rec(profilVon(pos)?.werte), ...rec(pos.werteAbw) };
  return Object.entries(werte).flatMap(([k, v]) => {
    const w = aspekt(k)?.wirkung;
    return w?.wo === "brief" && (typeof v === "string" || typeof v === "number") ? [w.satz.replace(`{{${k.split(".")[0]}}}`, String(v))] : [];
  });
}

/** DER LEERE ORDNERPLATZ einer Position (F1 Runde 2): null, wenn `sitz` fehlt oder die Position keinen hat; sonst ihre Kennung und der Hinweis des Absenders. */
export async function ordnerDerPosition(v: unknown, dir: string, eigene: string | null, selbst: boolean):
  Promise<{ pos: string; hint: string | null } | { error: string } | null> {
  if (v === undefined || v === null) return null;
  const g = await sitzPosition(v, dir, eigene, selbst);
  if ("error" in g) return g;
  const o = rec(g.pos.ordner);
  return o ? { pos: String(g.pos.id), hint: typeof o.hint === "string" ? o.hint : null } : null;
}

// WAS DIE DATEI FÜR AGENT, MODELL UND EFFORT SAGT, in die Felder des Bodys, wo der Body keine hat; `sitz` steht danach voll da
// ("<konst>/<position>"), damit jede weitere Lesung dieselbe Position trifft. Ohne `sitz` bleibt der Body, wie er ist
// AN DER SELBST-TÜR (`oeffnerin` = die Rechte der Öffnerin, auch null) auch die Rechte (Prüfung W3a Runde 1, Befund 3): ohne `rechte` im Body trägt ein Sitz aus
// einer Position deren Rechte (src/sitz.ts#sitzRechte: gedeckelt, außer der Owner bestätigte sie für diese Position), sonst die der Öffnerin ohne ihre Zusagen
// (`recht`): was der Owner einer Leitung bestätigte, gilt nur ihr, nicht jedem Sitz, den sie öffnet. Ein Kind ohne Position erbt weiter alles
// (server/kind-weite.ts#kindNieWeiter), und dieselbe Regel deckelt danach auch diese Rechte.
export async function mitSitzWerten(body: Record<string, unknown>, dir: string, eigene: string | null, selbst = false, oeffnerin?: Rechte | null):
  Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: string }> {
  if (body.sitz === undefined || body.sitz === null) return { ok: true, body };
  const g = await sitzPosition(body.sitz, dir, eigene, selbst);
  if ("error" in g) return { ok: false, error: g.error };
  const p = profilVon(g.pos), abw = rec(g.pos.abweichend);
  const wert = (feld: "agent" | "modell" | "effort"): string | undefined => {
    const v = abw?.[feld] ?? p?.[feld];
    return typeof v === "string" && v ? v : undefined;
  };
  const harness = wert("agent"), model = wert("modell"), effort = wert("effort");
  let rechte: Rechte | null = null;
  if (oeffnerin !== undefined && body.rechte === undefined) {
    const s = g.pos.sitz === undefined || g.pos.sitz === null ? null : sitzAus(g.pos.sitz);
    const eigen = s && typeof s !== "string" ? sitzRechte(s.darf) : null;
    if (eigen) rechte = eigen;
    else if (oeffnerin) { const { recht: _zusagen, ...ohne } = oeffnerin; rechte = ohne; }
  }
  return { ok: true, body: { ...(harness ? { harness } : {}), ...(model ? { model } : {}), ...(effort ? { effort } : {}), ...(rechte ? { rechte } : {}), ...body,
    sitz: `${g.konst}/${String(g.pos.id)}` } };
}

// DIE TÜR: `sitz` fehlt → nichts; sonst eine Position einer gespeicherten Konstellation (sitzPosition). Was sie trägt: ihren Sitz-Block (Lesestoff,
// gedeckeltes Darf, Notizbuch), ihre eigene Datei als Auftrag und die Agent-MD ihres Profils
export async function sitzDerTuer(body: Record<string, unknown> | null, harness: string, dir: string, label: string | null, orchLabel: (l: string) => boolean,
  eigene: string | null = null, selbst = false):
  Promise<{ ok: true; sitz: SitzStart | null; rechte: Rechte | null; modus: PermissionModeWahl | null; notizbuch: SitzNotizbuch | null; agentMd: AgentMd | null } | { ok: false; error: string }> {
  const v = body?.sitz;
  if (v === undefined || v === null) return { ok: true, sitz: null, rechte: null, modus: null, notizbuch: null, agentMd: null };
  if (harness !== "claude") return { ok: false, error: `harness ${harness} takes no sitz — what it reads goes into Claude Code's start` };
  const g = await sitzPosition(v, dir, eigene, selbst);
  if ("error" in g) return { ok: false, error: g.error };
  const posId = String(g.pos.id);
  const s = g.pos.sitz === undefined || g.pos.sitz === null ? null : sitzAus(g.pos.sitz);
  if (typeof s === "string") return { ok: false, error: `sitz of „${posId}“: ${s}` };
  // DIE EINE REGEL (Runde 3): ein importierter Sitz startet nie in bypass. Eine Rolle ist kein Bypass; nur der Modus, den
  // die Datei selbst verlangt, wird abgelehnt. (Ein Orchestrator-Label setzt Fleet sonst auf bypass, darum bleibt es unten verboten.)
  if (s?.darf.modus === "bypassPermissions") return { ok: false, error: "an imported seat never starts in bypass — the file asks for bypassPermissions" };
  if (label && orchLabel(label)) return { ok: false, error: "an imported seat never starts as the orchestrator — she runs in bypassPermissions" };
  const herkunft = typeof g.form.abgeleitetVon === "string" ? g.form.abgeleitetVon : null;
  // der Setup-Hash der importierten Datei (schreibeMehrSitz legt ihn an der Konstellation ab): der Start dieses Sitzes nennt ihn
  const setupHash = typeof g.form.setupHash === "string" && /^[0-9a-f]{64}$/.test(g.form.setupHash) ? g.form.setupHash : undefined;
  const p = profilVon(g.pos);
  const md = p?.datei === undefined ? null : agentMdText(p.datei);
  // ist die eigene Datei die des Profils (das Fenster speichert beide, k15-agentmd.ts), kommt sie einmal: als Agent-MD
  const roh = g.pos.eigeneDatei === undefined ? null : agentMdText(g.pos.eigeneDatei);
  if (g.pos.eigeneDatei !== undefined && !roh) return { ok: false, error: `the own file of „${posId}“ was only named in the file, not given` };
  const brief = roh && roh.text !== md?.text ? roh : null;
  const bitten = erbeteneZeilen(g.pos);
  const datei = brief && bitten.length ? { titel: brief.titel, text: `${brief.text}\n\n${bitten.join("\n")}` } : brief;
  if (datei && new TextEncoder().encode(datei.text).length > MAX_AGENTMD_BYTES) return { ok: false, error: `the own file of „${posId}“ is larger than ${MAX_AGENTMD_BYTES / 1000} KB` };
  if (md && new TextEncoder().encode(md.text).length > MAX_AGENTMD_BYTES) return { ok: false, error: `the Agent-MD of „${posId}“ is larger than ${MAX_AGENTMD_BYTES / 1000} KB` };
  const profilId = typeof p?.id === "string" ? p.id : posId;
  const agentMd: AgentMd | null = md ? { profil: profilId, titel: md.titel, text: md.text, sha256: new Bun.CryptoHasher("sha256").update(md.text).digest("hex"),
    ...(typeof p?.name === "string" ? { name: p.name } : {}) } : null;
  // die Rechte aus der Datei gedeckelt, außer der Owner hier hat sie bestätigt (src/sitz.ts#sitzRechte)
  return { ok: true, sitz: { konst: g.konst, pos: posId, herkunft, liest: s?.liest ?? [], persoenlich: s?.persoenlich ?? [], block: s !== null, auftrag: datei,
      richtung: s?.richtung ?? null, konzepte: s?.konzepte ?? [], ...(s?.rolle ? { rolle: s.rolle } : {}),
      ...(setupHash ? { setupHash } : {}), ...(typeof g.form.name === "string" ? { konstName: g.form.name } : {}),
      ...(typeof g.pos.ziel === "string" && g.pos.ziel.trim() ? { ziel: g.pos.ziel } : {}),
      // ein goal oder eine aufgabe an der Tür gilt vor dem Ziel der Datei (server/position-start.ts#zielAusPosition); hier festgehalten, damit Vorschau und Start dasselbe rechnen
      ...(typeof g.pos.ziel === "string" && g.pos.ziel.trim() && (body?.aufgabe !== undefined || (typeof body?.goal === "string" && body.goal.trim() !== "")) ? { zielErsetzt: true as const } : {}),
      ...(rec(g.pos.ordner) ? { ordner: { hint: typeof rec(g.pos.ordner)!.hint === "string" ? String(rec(g.pos.ordner)!.hint) : null } } : {}) },
    rechte: s ? sitzRechte(s.darf) : null,
    // der Modus der Position (darf.modus): die Tür nimmt ihn, wenn ihr Body keinen nennt (modusAnDerTuer); einer, den Claude Code nicht kennt, zählt nicht
    modus: s?.darf.modus ? (() => { const m = permissionModeDerTuer(s.darf.modus); return m.ok ? m.wahl : null; })() : null,
    notizbuch: s?.notizbuch ?? null, agentMd };
}

// DER MODUS EINES SITZES AN DER TÜR (Prüfung W3a Runde 1, Befund 5; Runde 2, R2-1): der Body gilt zuerst (an der Selbst-Tür geprüft wie bisher); ohne ihn der
// Modus der Position, sonst nähme Claude Code den Standard des Nutzers (bis bypass). An der Selbst-Tür (`oeffnerin` = ihr Modus) das Engere aus Position und
// Öffnerin nach MODUS_RANG: eine Öffnerin in bypass gibt einem Sitz aus einer Position nie bypass, und eine engere Position bleibt eng. Eine Öffnerin ohne
// Claude-Modus (null: ein anderer Harness) ist nicht vergleichbar; dann gilt die Position. Die Position selbst ist nie bypass (sitzDerTuer lehnt das ab).
export const MODUS_RANG: readonly PermissionModeWahl[] = ["plan", "manual", "dontAsk", "acceptEdits", "auto", "bypassPermissions"];
export function modusAnDerTuer(tuer: PermissionModeWahl | null, position: PermissionModeWahl | null, oeffnerin?: string | null): PermissionModeWahl | null {
  if (tuer || !position) return tuer;
  const o = oeffnerin === undefined || oeffnerin === null ? null : MODUS_RANG.find((m) => m === oeffnerin) ?? null;
  return o === null || MODUS_RANG.indexOf(position) <= MODUS_RANG.indexOf(o) ? position : o;
}

// EIN KIND OHNE MODUS IST NIE WEITER ALS SEINE ÖFFNERIN (Orchestratorin, Auftrag 8, B5), was immer unter ihm steht: `start` ist der Modus, in dem es ohne Modus auf der Zeile
// startete. Nach MODUS_RANG weiter (oder ein Modus, den der Rang nicht kennt): es startet in ihrem, und wo sie auto hat, in `ohneBypass` (auto, oder Manual, wo das Modell oder die
// Einstellungen kein auto kennen). Nicht weiter: null, die Zeile bleibt leer, und eine engere Einstellung im Ordner bleibt eng. Eine Öffnerin ohne vergleichbaren Modus (null: ein
// anderer Harness) gibt nie bypass. `undefined` ist die Tür des Owners, dort gibt es keine Öffnerin. Ein Sitz aus einer Position mit einem Modus hat seine eigene Regel (modusAnDerTuer) und kommt gar nicht bis hier.
export function modusUnterOeffnerin(oeffnerin: string | null | undefined, start: string, ohneBypass: "auto" | "manual"): PermissionModeWahl | null {
  if (oeffnerin === undefined) return null;
  const o = MODUS_RANG.find((m) => m === oeffnerin);
  if (!o) return start === "bypassPermissions" ? ohneBypass : null;
  const r = MODUS_RANG.findIndex((m) => m === start);
  if (r >= 0 && r <= MODUS_RANG.indexOf(o)) return null;
  return o === "auto" ? ohneBypass : o;
}

// WAS DIE TÜR GELESEN HAT, FÜR JEDEN SPÄTEREN START DIESES PLATZES (Orchestratorin, Auftrag 9; server.ts#ensureSlot): der Modus der Öffnerin (`undefined`: die Tür des Owners, dort gibt es keine; null: sie hat keinen
// vergleichbaren) und die Marke „nicht vom Owner“. Ein Text, kein Verweis auf ihren Slot: sie darf längst beendet sein. Ohne beides gibt es nichts zu merken: null.
export interface ModusGrenze { oeffnerin?: string | null; fremd: boolean }
export function modusGrenzeVon(oeffnerin: string | null | undefined, fremd: boolean): ModusGrenze | null {
  return oeffnerin === undefined && !fremd ? null : { ...(oeffnerin === undefined ? {} : { oeffnerin }), fremd };
}
export function modusGrenzeGeladen(raw: unknown): ModusGrenze | null {
  const r = rec(raw);
  if (!r || typeof r.fremd !== "boolean") return null;
  const o = r.oeffnerin;
  return o === undefined || o === null || typeof o === "string" ? modusGrenzeVon(o as string | null | undefined, r.fremd) : null;
}

// IST EIN MODUS AN DER SELBST-TÜR NICHT WEITER ALS DER DER ÖFFNERIN (Orchestratorin, Auftrag 20, Queue 96220964): nach MODUS_RANG, derselben Ordnung wie
// modusAnDerTuer. Eine Leitung in bypass, die einen Sitz für fremde Eingaben öffnet, gibt ihm auto, acceptEdits oder dontAsk, statt ihm bypass geben zu
// müssen. manual und plan fragen mehr und gehen wie bisher an jeder Öffnerin, ihr eigener Modus auch; sonst nur ein Modus unter ihrem. Eine Öffnerin ohne
// vergleichbaren Modus (null: ein anderer Harness) gibt nur ihren eigenen, manual oder plan.
export function modusNichtWeiter(kind: PermissionModeWahl, oeffnerin: string | null | undefined): boolean {
  if (kind === "manual" || kind === "plan" || kind === oeffnerin) return true;
  const o = MODUS_RANG.findIndex((m) => m === oeffnerin);
  return o >= 0 && MODUS_RANG.indexOf(kind) < o;
}

// DIE ANDEREN SITZE DERSELBEN KONSTELLATION mit ihrem Auftrag: so nennt Fleet einem Sitz, wen er öffnen kann, und erkennt ein Ziel, das der
// Brief eines anderen ist
export async function geschwister(dir: string, konst: string, ohne: string): Promise<{ id: string; name: string; auftrag: string | null; ordner: string | null }[]> {
  const gespeichert: unknown = await Bun.file(join(dir, SPEICHER_DATEI)).json().catch(() => null);
  const liste = rec(gespeichert)?.konstellationen;
  const form = Array.isArray(liste) ? liste.map(rec).find((k) => k?.id === konst) : undefined;
  const ps = form && Array.isArray(form.positionen) ? form.positionen.map(rec) : [];
  return ps.flatMap((p) => p && typeof p.id === "string" && p.id !== ohne
    ? [{ id: p.id, name: typeof p.name === "string" ? p.name : p.id, auftrag: p.eigeneDatei === undefined ? null : agentMdText(p.eigeneDatei)?.text ?? null,
      ordner: typeof rec(p.ordner)?.hint === "string" ? String(rec(p.ordner)!.hint) : null }] : []);
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
  // welches Modell wirklich antwortete, Belegung für Belegung (eine Nachfolge ist eine weitere); fehlt es einer, ist es nicht nachgesehen
  const modelle = (pos: string): ModellAbschnitt[] | null => {
    const bel = l.positionen.filter((p) => p.pos === pos).sort((a, b) => a.at - b.at);
    return bel.every((p) => Array.isArray(p.modelle)) ? bel.flatMap((p) => p.modelle ?? []) : null;
  };
  return { fassung: l.hash, quelle: `Laufbuch einer Fleet, Lauf ${l.id}`, start: new Date(l.at).toISOString(), ende: new Date(l.ende.at).toISOString(),
    sitze: [...je].map(([pos, n]) => ({ pos, wie: n === 1 ? "eine Session" : `${n} Sessions nacheinander (Nachfolge)`, ablehnungen: null, zahlen: { sessions: n },
      modelle: modelle(pos) })),
    nachrichten: [], befunde: [], ohneBefund: [], kosten: "nicht gemessen",
    grenzen: [`endete ${l.ende.wie === "hand" ? "von Hand" : "mit der letzten Session"}; Nachrichten, Befunde und Kosten trägt nur ein Bericht, den jemand schreibt`] };
}

// WAS server.ts HEREINREICHT: die Bibliothek eines Sitzes (wirft, wenn sie nicht lesbar ist), das Notizbuch eines Profils, die eigenen Läufe
export interface DateiQuellen {
  bibliothek: () => Promise<SeatKnowledge>;
  notizbuch: (profil: string) => Promise<{ index: string; dateien: { datei: string; text: string }[] } | null>;
  laeufe: readonly Lauf[];
  modus: string;
  // IM EIGENEN SETUP (server/eigenes-setup.ts#eigenesSetup: ein Claude-Sitz ohne Rolle außerhalb von Fleets Repo) gibt Fleet keine Packs
  // mit, und `modus` ist der, mit dem Claude Code dort startet; die Datei sagt, was der Sitz wirklich hatte (Brief fremdes-repo-rund, 5)
  eigenesSetup?: boolean;
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
    // A ROLE SEAT NOW TRAVELS LIKE ANY OTHER (Runde 3): its role block carries start text, rights and packs; dateiFuer no
    // longer strips it to "nur-ordner". Only a non-Claude seat or a bare reference still has no Sitz-Block.
    if (!profil || !istClaude(profil.agent)) {
      const { sitz: _s, rechte: _r, ...ohne } = p;
      mitSitz.push(ohne);
      hinweise.push(`${name}: ${!profil ? "nur als Verweis exportiert" : "liest Fleets Packs nicht im Start (kein Claude Code)"}; kein Sitz-Block`);
      continue;
    }
    const da = p.sitz === undefined ? null : sitzAus(p.sitz);
    if (typeof da === "string") return `${name}: ${da}`;
    let liest: SitzPack[] = [], persoenlich: PersoenlichPlatz[] = [];
    if (da) ({ liest, persoenlich } = da);
    else if (q.eigenesSetup) hinweise.push(`${name}: lief im eigenen Setup — Fleet gab ihm keine Packs mit; er liest, was Claude Code im Ordner selbst lädt`);
    else {
      const k = await liesBibliothek();
      if (typeof k === "string") hinweise.push(`${name}: Fleets Bibliothek ist hier nicht lesbar (${k}); er reist ohne Packs`);
      else {
        const wege = seatPacks(k);
        for (const pk of k.packs) {
          const weg = wege.box.includes(pk.id) ? "start" as const : wege.skills.includes(pk.id) ? "skill" as const : null;
          if (!weg || pk.text === null) continue;
          // ein eigener Pack dieser Maschine reist nicht mit: geteilt wird, was im Register steht (Slot 1, 26.10.)
          if (pk.privat) { hinweise.push(`${name}: ${pk.id} ist ein eigener Pack dieser Maschine und bleibt daheim`); continue; }
          const quellen = pk.sources.map((s) => ({ pfad: s.path, anker: s.anchor }));
          if (istPersoenlich(pk.id, pk.personal === true)) persoenlich.push({ id: pk.id, weg, quellen, wofuer: pk.useWhen, text: null });
          else liest.push({ id: pk.id, weg, quellen, wofuer: pk.useWhen, text: pk.text });
        }
      }
    }
    // das Notizbuch: ein Sitz mit Agent-MD hat sein eigenes (server/notizbuch.ts, profil-<id>); was es hier weiß, geht vor dem, was mitreiste
    let notizbuch: SitzNotizbuch | null = da?.notizbuch ?? null;
    let persoenlicheNotizen: string[] | undefined = da?.persoenlicheNotizen;
    if (profil.datei && typeof profil.id === "string") {
      const nb = await q.notizbuch(profil.id).catch(() => null);
      if (nb && (nb.index.trim() || nb.dateien.length)) {
        notizbuch = notizbuchZumTeilen(nb.index, nb.dateien);
        const daheim = nb.dateien.filter((d) => notizIstPersoenlich(d.text)).map((d) => d.datei);
        if (daheim.length) persoenlicheNotizen = daheim;
      }
    }
    if (notizbuch?.daheim) hinweise.push(`${name}: ${notizbuch.daheim} Notiz${notizbuch.daheim === 1 ? "" : "en"} über den Owner ${notizbuch.daheim === 1 ? "bleibt" : "bleiben"} daheim`);
    // was er darf: was hier an ihm gesetzt ist (Position.rechte, so startet ihn das Fenster), sonst was mit ihm hierher reiste
    const rechte = (p.rechte === undefined ? null : rechteAus(p.rechte)) ?? da?.darf.rechte ?? null;
    // DER PLATZ FÜR DAS EIGENE DES OWNERS IN CLAUDE CODE: was die Fassung mit `eigentum: „[Zitat entfernt]“` zeigt (seine Hooks, Plugins, Einstellungen,
    // ~/.claude/CLAUDE.md; server/fassung-umfeld.ts), reist heute nicht mit; wer importiert, startet mit seinem eigenen. Ob es mitreist,
    // entscheidet der Owner, und dann gehört es hierher, als Platz unter `persoenlich` ohne Text.
    const sitz: Sitz = sitzZumTeilen({ liest, persoenlich, darf: { rechte, modus: q.modus }, notizbuch,
      ...(da?.rolle ? { rolle: da.rolle } : {}),
      ...(da?.konzepte?.length ? { konzepte: da.konzepte } : {}), ...(persoenlicheNotizen?.length ? { persoenlicheNotizen } : {}) });
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
    ...(typeof k === "string" ? [] : k.packs.filter((pk) => (istPersoenlich(pk.id, pk.personal === true) || pk.privat) && pk.text !== null).map((pk) => pk.text as string)),
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
