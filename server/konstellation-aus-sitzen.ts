// DIE KONSTELLATION, DIE EIN SITZ GEBAUT HAT, WIRD EINE DATEI (F1, docs/konstellation/aus-sitzen-entwurf.md; Owner 15.–26.10.: „[Zitat entfernt]“). Aus der Öffnerin und den lebenden Sitzen, die sie geöffnet hat
// (server/selbst-sitze.ts#geoeffneteKinder), wird ein Setup im Format, das es gibt (fleet-setup/1): ein Sitz je Platz, eine Kante `reports-to` je Kind, die
// gebildete Rolle als Block samt Text, das Ziel je Sitz (`start.goal`), der Ordner als leerer persönlicher Platz mit dem Pfad relativ zur Wurzel als Hinweis.
// Gespeichert wird es durch denselben Schreibweg wie ein Import (setup-datei.ts#schreibeMehrSitz), also in der Form, die das K15-Fenster schreibt und
// setupAusKonstellation liest; der Export `GET /api/self/setups/<id>/datei` kennt sie danach wie jede andere.
//
// DIE MARKE DES SITZES gilt wie bei einem gespeicherten Agenten (server/agenten.ts#vonSitz): die Rechte stehen gedeckelt in der Datei (rechteGedeckelt,
// dieselbe Funktion wie beim Speichern und beim Import), bypass wird nicht übernommen, und eine Rolle reist nur als Block der gebildeten Rolle, nie als
// Fleets Rollenname. Durchgesetzt wird sie dreimal: hier beim Bauen, in pruefeSeat (die Datei nimmt kein bypass) und beim Start, wo sitzRechte die Rechte
// des Sitz-Blocks erneut deckelt, solange der Owner sie nicht über POST /api/k15/freigabe bestätigt hat.
import { realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { rechteGedeckelt } from "../src/sitz";
import type { Rechte } from "../session-rechte";
import { alsPack, mitSetupHash, persoenlicherTextInDatei, privateTexteAusWissen, pruefeSetupDatei, roleStein, schreibeMehrSitz, type SetupDatei, type SetupEdge,
  type SetupKnowledgeRef, type SetupPack, type SetupRole, type SetupSeat } from "./setup-datei";
import type { Opener } from "./opener";
import { rolleAusName } from "./selbst-sitze";
import type { SeatKnowledge } from "./sitz-wissen";
import type { StartEintrag } from "./start-historie";

/** Was vom Sitz für die Datei zählt: seine Wahlen, sein Zweck, seine Packs, die gebildete Rolle, sein Ordner und wer ihn öffnete. */
export interface SitzBild {
  slot: number; openedAt: number; cwd: string; label: string | null;
  harness: string | null; model: string | null; effort: string | null; permissionMode: string | null; rechte: Rechte | null;
  agentMd: { titel: string; text: string } | null; bibliothek: boolean | readonly string[] | null;
  rolleStein: { id: string; name: string; hash: string } | null; openedBy: Opener | null;
}
export interface SitzEingang {
  name: string; oeffnerin: SitzBild; kinder: readonly SitzBild[];
  /** die Wurzel, unter der Sitze öffnen (server/selbst-sitze.ts#seatRoot): der Ordner reist als Pfad relativ zu ihr */
  root: string;
  /** das Zustandsverzeichnis mit dem Regal der gebildeten Rollen */
  dir: string;
  /** die Zusagen (recht), die die Speichernde selbst wirksam hat (server/tuer-rechte.ts#wirksameRechte): nur sie bleiben in der Datei, wie bei einem gespeicherten Agenten (server/agenten.ts) */
  behalten?: ReadonlySet<string>;
  wissen: SeatKnowledge | null;
  historie: readonly StartEintrag[];
}

const echt = (p: string): string => { const a = resolve(p); try { return realpathSync(a); } catch { return a; } };

/** DAS ZIEL, MIT DEM EIN SITZ GEÖFFNET WURDE, aus der Historie der Starts (openSeatInFolder schreibt es als Nachtrag zu Platz und Belegung). Nach einer Nachfolge
 *  hat die neue Belegung ein neues `openedAt` und trägt nur den Start; dann gilt das jüngste Ziel desselben Platzes im selben Ordner von derselben Öffnerin. */
export function zielVon(historie: readonly StartEintrag[], sitz: SitzBild): string | null {
  const eigene = historie.filter((e) => e.slot === sitz.slot && e.cwd === sitz.cwd && e.goal !== null && e.goal.trim() !== "" && e.openedAt <= sitz.openedAt);
  const genau = eigene.find((e) => e.openedAt === sitz.openedAt);
  if (genau) return genau.goal;
  const von = sitz.openedBy;
  const linie = von ? eigene.filter((e) => e.openedBy?.slot === von.slot && e.openedBy.cwd === von.cwd).sort((a, b) => b.openedAt - a.openedAt)[0] : undefined;
  return linie?.goal ?? null;
}

/** Der Ordner als Hinweis: Pfad relativ zur Wurzel (Symlinks aufgelöst), "." für die Wurzel selbst; null, wenn er außerhalb liegt. */
export function ordnerHinweis(cwd: string, root: string): string | null {
  const r = echt(root), c = echt(cwd);
  if (c === r) return ".";
  return c.startsWith(r.endsWith(sep) ? r : `${r}${sep}`) ? relative(r, c) : null;
}

const MAX_ZIEL = 8000;

/** Die Packs, die ein Sitz liest: die gewählten, oder ohne Wahl Fleets Bibliothek ohne die eigenen und die zur Wahl — wie setupAusAgent sie wählt. */
function gelesenePacks(k: SeatKnowledge | null, wahl: boolean | readonly string[] | null): { packs: SetupPack[]; fehlt: string[] } {
  if (!k) return { packs: [], fehlt: Array.isArray(wahl) ? [...wahl] : [] };
  const gewaehlt = Array.isArray(wahl) ? new Set<string>(wahl) : null;
  const packs = k.packs.filter((p) => p.text !== null && (gewaehlt ? gewaehlt.has(p.id) : !(wahl === false || p.privat || p.zurWahl))).map(alsPack);
  return { packs, fehlt: gewaehlt ? [...gewaehlt].filter((id) => !k.packs.some((p) => p.id === id)) : [] };
}

/** AUS DER ÖFFNERIN UND IHREN KINDERN EIN SETUP. Ein Satz, warum nicht, wenn es nichts zu speichern gibt oder die Datei sich nicht selbst liest. */
export function setupAusSitzen(e: SitzEingang): { datei: SetupDatei; hinweise: string[] } | string {
  if (!e.kinder.length) return "you opened no seat that lives — open a seat (POST /api/self/seats/open) before you save the constellation you lead";
  const hinweise: string[] = [];
  const packs: SetupPack[] = [], roles: SetupRole[] = [];
  const addPack = (p: SetupPack): SetupKnowledgeRef => {
    let id = p.id;
    if (packs.some((x) => x.id === id && x.hash !== p.hash)) id = `${p.id}@${(p.hash ?? "personal").slice(0, 8)}`;
    const da = packs.find((x) => x.id === id);
    if (da) return { kind: "pack", id, hash: da.hash };
    packs.push({ ...p, id });
    return { kind: "pack", id, hash: p.hash };
  };
  const vergeben = new Set<string>();
  const idVon = (s: SitzBild, name: string): string => {
    const basis = rolleAusName(name) ?? `seat-${s.slot}`;
    let id = basis, n = 2;
    while (vergeben.has(id)) id = `${basis}-${n++}`;
    vergeben.add(id);
    return id;
  };
  const alle = [e.oeffnerin, ...e.kinder];
  const namen = alle.map((s, i) => (s.label ?? s.rolleStein?.name ?? (i === 0 ? "Lead" : `Seat ${s.slot}`)).trim().slice(0, 120) || `Seat ${s.slot}`);
  const ids = alle.map((s, i) => idVon(s, namen[i]!));
  const seats: SetupSeat[] = alle.map((s, i) => {
    const refs: SetupKnowledgeRef[] = [];
    const gelesen = gelesenePacks(e.wissen, s.bibliothek);
    for (const p of gelesen.packs) refs.push(addPack(p));
    for (const id of gelesen.fehlt) hinweise.push(`${namen[i]}: der Pack ${id} steht nicht in Fleets Bibliothek und reist nicht mit`);
    let roleId: string | null = null;
    if (s.rolleStein) {
      const stein = roleStein(s.rolleStein.id, e.dir);
      if (!stein) hinweise.push(`${namen[i]}: die Rolle „${s.rolleStein.id}“ steht nicht mehr auf dem Regal und reist nicht mit`);
      else {
        if (stein.role.hash !== s.rolleStein.hash) hinweise.push(`${namen[i]}: die Rolle „${stein.role.id}“ wurde seit seinem Start neu gebildet; die Datei trägt die jetzige`);
        const roleRefs = stein.packs.map((p) => addPack(p));
        if (!roles.some((r) => r.id === stein.role.id)) roles.push({ ...stein.role, packs: roleRefs });
        for (const ref of roleRefs) if (!refs.some((x) => x.kind === ref.kind && x.id === ref.id && x.hash === ref.hash)) refs.push(ref);
        roleId = stein.role.id;
      }
    }
    const ziel = i === 0 ? null : zielVon(e.historie, s);
    if (ziel && ziel.length > MAX_ZIEL) hinweise.push(`${namen[i]}: sein Ziel ist länger als ${MAX_ZIEL} Zeichen und reist gekürzt`);
    const hint = ordnerHinweis(s.cwd, e.root);
    if (hint === null) hinweise.push(`${namen[i]}: sein Ordner liegt außerhalb der Wurzel; die Datei trägt den leeren Platz ohne Hinweis`);
    return { id: ids[i]!, name: namen[i]!,
      who: { harness: s.harness, model: s.model, effort: s.effort },
      start: { ...(s.agentMd ? { purpose: { titel: s.agentMd.titel, text: s.agentMd.text } } : {}),
        ...(roleId ? { role: roleId, direction: { text: null, personal: true as const } } : {}),
        ...(ziel ? { goal: ziel.slice(0, MAX_ZIEL) } : {}), folder: { text: null, personal: true as const, hint } },
      reads: refs,
      // DIE MARKE: gedeckelt wie ein Agent aus der Hand einer Session, bypass fällt weg
      may: { rechte: s.rechte ? rechteGedeckelt(s.rechte, e.behalten).rechte : null, permissionMode: s.permissionMode === "bypassPermissions" ? null : s.permissionMode },
      worksWith: i === 0 ? {} : { reportsTo: ids[0]! }, notebook: null };
  });
  const edges: SetupEdge[] = seats.slice(1).map((s) => ({ from: s.id, to: ids[0]!, kind: "reports-to" }));
  const datei = mitSetupHash({ format: "fleet-setup/1", name: e.name, setupHash: "", derivedFrom: null, derivedFromLine: [], seats, edges, packs, concepts: [], roles });
  const fund = e.wissen ? persoenlicherTextInDatei(datei, privateTexteAusWissen(e.wissen)) : null;
  if (fund) return `die Datei enthielte persönlichen Text („${fund}…“) und geht so nicht hinaus`;
  const gelesen = pruefeSetupDatei(JSON.parse(JSON.stringify(datei)));
  if (typeof gelesen === "string") return `die Datei läse sich nicht selbst: ${gelesen}`;
  return { datei, hinweise };
}

/** DAS SPEICHERN: derselbe Schreibweg wie ein Import, mit der Marke des Sitzes im Autor („the session in slot N“). */
export async function speichereKonstellation(datei: SetupDatei, dir: string, jetzt: number, vonSlot: number): Promise<{ id: string; name: string; seats: number }> {
  const r = await schreibeMehrSitz(datei, {}, dir, jetzt, { autor: `the session in slot ${vonSlot}`, satz: "saved from the seats of a session" });
  return r.konstellation as { id: string; name: string; seats: number };
}

/** DIE TÜR (POST /api/self/konstellationen, Recht setup.save): der Body nennt höchstens den Namen; gespeichert wird, was die Öffnerin führt — ihr eigener Sitz
 *  und ihre lebenden Kinder. Die Antwort nennt die Kennung und den Weg zur Datei. */
export interface TuerQuellen {
  oeffnerin: SitzBild; kinder: readonly SitzBild[]; root: string; dir: string; behalten?: ReadonlySet<string>;
  wissen: () => Promise<SeatKnowledge | null>; historie: () => Promise<readonly StartEintrag[]>; jetzt?: () => number;
}
export async function konstellationDerTuer(body: Record<string, unknown> | null, q: TuerQuellen): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!body) return { status: 400, body: { error: "expected { name? }" } };
  const fremd = Object.keys(body).find((k) => k !== "name");
  if (fremd !== undefined) return { status: 400, body: { error: `the door reads only name — „${fremd.slice(0, 40)}“ is not read (the seats come from the ones you opened)` } };
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 80))
    return { status: 400, body: { error: "name is one line of at most 80 characters" } };
  const name = typeof body.name === "string" ? body.name.trim() : `Constellation of slot ${q.oeffnerin.slot}`;
  const jetzt = q.jetzt?.() ?? Date.now();
  const d = setupAusSitzen({ name, oeffnerin: q.oeffnerin, kinder: q.kinder, root: q.root, dir: q.dir, behalten: q.behalten, wissen: await q.wissen(), historie: await q.historie() });
  if (typeof d === "string") return { status: 409, body: { error: d } };
  const k = await speichereKonstellation(d.datei, q.dir, jetzt, q.oeffnerin.slot);
  return { status: 201, body: { ok: true, konstellation: k, hinweise: d.hinweise, datei: `GET /api/self/setups/${k.id}/datei` } };
}
