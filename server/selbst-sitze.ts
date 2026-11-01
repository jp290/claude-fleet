// DER SITZ ÖFFNET SITZE, UND BILDET ROLLEN (Owner 29./30.10.: „[Zitat entfernt]“). Zwei Türen teilen sich diese Schicht:
// - POST /api/self/seats/open (Recht `seat.open`): eine Session öffnet einen Sitz in EINEM ORDNER — nicht nur einen Branch
//   des eigenen Repos — durch denselben Weg, den die Owner-Tür geht (server.ts#openSeatInFolder); kindNieWeiter deckelt das
//   Kind wie an der Branch-Tür (server/kind-weite.ts).
// - POST /api/self/roles (Recht `role.form`, in keinem Rollenbundel): eine Session bildet eine Rolle als SetupRole und legt
//   sie aufs Regal (server/setup-datei.ts#liesShelf) — kein zweites Rollenformat. Das Bundel ist nie weiter als ihre
//   wirksamen Rechte; die Tür nennt das Recht, wenn eines weiter wäre. Die Rolle bekommt eine Adresse
//   ({kind:"role", role:<id>}), die an den jüngsten lebenden Inhaber geht (server.ts#resolveMessageAddress).
//
// DIE ORDNER-REGEL: ein Ordner unter FLEET_SELF_SEAT_ROOT, ohne Env das Home des Nutzers. Eine ungezäunte Session kann
// ohnehin jeden Shell-Befehl als dieser Nutzer laufen lassen, darum wäre eine Verweigerung von Hause aus nur ein Stau
// („[Zitat entfernt]“); der Zaun selbst hält weiter über kindNieWeiter — eine gezäunte Öffnerin öffnet nie ein
// ungezäuntes Kind. Der Deckel FLEET_SELF_SEAT_CAP (Standard 3) zählt, wie viele lebende Sitze eine Öffnerin geöffnet hat.
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { RECHTE_STANDARD, istRechtId, rechteAus, type RechtId, type Rechte } from "../session-rechte";
import { liesShelf, packAusBibliothek, roleHash, roleStein, schreibShelf, type RoleStein, type SetupPack, type SetupRole } from "./setup-datei";
import { gleicheOeffnerin, istOeffnerin, LINIE_RE, type Opener } from "./opener";
import { RECHTE_NUR_DURCH_OWNER } from "./tuer-rechte";
import type { SeatKnowledge } from "./sitz-wissen";

/** Die Wurzel, unter der eine Session Sitze öffnet: FLEET_SELF_SEAT_ROOT, sonst das Home des Nutzers (siehe oben). */
export function seatRoot(env: Record<string, string | undefined> = process.env): string {
  const gesetzt = env.FLEET_SELF_SEAT_ROOT?.trim();
  const roh = gesetzt ? resolve(gesetzt) : homedir();
  try { return realpathSync(roh); } catch { return roh; }
}

/** Wie viele lebende Sitze eine Session geöffnet haben darf (FLEET_SELF_SEAT_CAP, Standard 3): der Deckel gegen einen Wuchs ohne Ende. */
export const SEAT_CAP_STANDARD = 3;
export function seatCap(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.FLEET_SELF_SEAT_CAP);
  return env.FLEET_SELF_SEAT_CAP !== undefined && env.FLEET_SELF_SEAT_CAP.trim() !== "" && Number.isInteger(n) && n >= 0 ? n : SEAT_CAP_STANDARD;
}

/** Der Ordner einer Öffnung, geprüft gegen die Wurzel: derselbe Pfad oder darunter (Symlinks aufgelöst), vorhanden, ein Verzeichnis. */
export function ordnerDerTuer(pfad: string, root: string): { ok: true; ordner: string } | { ok: false; error: string; status: number } {
  const abs = resolve(pfad);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return { ok: false, status: 400, error: `not a directory: ${abs}` };
  const echt = realpathSync(abs);
  const drin = echt === root || echt.startsWith(root.endsWith(sep) ? root : `${root}${sep}`);
  if (!drin)
    return { ok: false, status: 409, error: `the folder ${echt} is outside the root a seat may open in (${root}; FLEET_SELF_SEAT_ROOT sets it) — a session opens seats under it, not beyond` };
  return { ok: true, ordner: echt }; // der echte Pfad, den die Prüfung gelesen hat: das Kind öffnet dort, wo sie hinsah, nicht an einem Symlink, den man danach umlegt
}

/** Was vom Sitz für diese Schicht zählt: sein Platz, seine Belegung, sein Ordner, seine Linie, wer ihn öffnete, und die Rolle, in der er startete. */
export interface SitzTatsache {
  slot: number; openedAt: number; cwd: string | null; linie?: string | null; openedBy: Opener | null;
  rolleStein: { id: string } | null;
}

/** WIE VIELE LEBENDE SITZE DIESE ÖFFNERIN GEÖFFNET HAT: die Kinder ihrer Linie (server/opener.ts#istOeffnerin) — eine Nachfolge der
 *  Öffnerin bleibt die Öffnerin, eine fremde Session im selben Platz und Ordner ist es nicht, ein recycelter Platz fällt heraus. */
export function geoeffneteKinder(seats: readonly SitzTatsache[], oeffner: { slot: number; cwd: string; linie?: string | null }): SitzTatsache[] {
  return seats.filter((x) => x.cwd !== null && x.slot !== oeffner.slot && istOeffnerin(oeffner, x.openedBy));
}

/** DIE GEGENSEITE ZWEIER SITZE (wie branchPeers an der Branch-Tür): wer einen Sitz in einem Ordner öffnete und der Sitz selbst sind
 *  einander Gegenüber im Postfach, und zwei Sitze derselben Öffnerin ebenso („[Zitat entfernt]“) —
 *  solange beide leben und die Linie passt (server/opener.ts): die Nachfolgerin der Öffnerin bleibt im Paar, eine fremde Session im
 *  selben Platz und Ordner nicht. */
export function sitzGegenseite(a: SitzTatsache, b: SitzTatsache): boolean {
  if (!a.cwd || !b.cwd || a.slot === b.slot) return false;
  if (istOeffnerin(a, b.openedBy) || istOeffnerin(b, a.openedBy)) return true;
  return gleicheOeffnerin(a.openedBy, b.openedBy);
}

/** DER JÜNGSTE LEBENDE INHABER EINER GEBILDETEN ROLLE: die Adresse der Rolle geht an ihn — jüngste Belegung gewinnt,
 *  bei gleicher die höhere Platznummer (zwei Inhaber derselben Rolle sind zulässig, die Adresse wählt einen). */
export function neuesterInhaber(seats: readonly SitzTatsache[], rolle: string): SitzTatsache | null {
  return seats.filter((x) => x.cwd !== null && x.rolleStein?.id === rolle)
    .reduce<SitzTatsache | null>((neu, x) => !neu || x.openedAt > neu.openedAt || (x.openedAt === neu.openedAt && x.slot > neu.slot) ? x : neu, null);
}

/** DIE SCHLÜSSEL, DIE EINE TÜR LIEST: ein Schlüssel daneben (`bundle` statt `rights`) wäre sonst still ignoriert, und die Rolle entstünde ohne das, was ihre
 *  Bildnerin meinte. Die Selbst-Türen weisen ihn ab und nennen, was sie lesen; die Owner-Türen bleiben, wie sie sind. */
export const ROLLE_SCHLUESSEL: readonly string[] = ["name", "text", "rights", "packs"];
// was openSeatInFolder und seine Helfer aus dem Body lesen (harness bis tools), dazu `role`, `agent`, `sitz`, `plan` (der Satz der Tür dazu) und `fassung`
export const SITZ_SCHLUESSEL: readonly string[] = ["cwd", "label", "harness", "model", "effort", "container", "containerContext", "context", "permissions", "packs",
  "remote", "rechte", "profil", "purpose", "goal", "aufgabe", "sitz", "schwelle", "notizbuch", "permissionMode", "weglassen", "autoModeEnvironment", "tools",
  "bibliothek", "konzepte", "agent", "role", "plan", "fassung"];
export function unbekannteSchluessel(body: Record<string, unknown>, erlaubt: readonly string[]): string | null {
  const fremd = Object.keys(body).filter((k) => !erlaubt.includes(k));
  if (!fremd.length) return null;
  return `unknown key${fremd.length > 1 ? "s" : ""} ${fremd.map((k) => `"${k}"`).join(", ")} — this door reads ${erlaubt.join(", ")}`;
}

/** DER ERSTE SATZ EINES SITZES, DEN EINE SELBST-TÜR ÖFFNETE: wer ihn öffnete und durch welche Tür; die Öffnerin ist sein Gegenüber im Postfach. */
export const geoeffnetVonZeile = (slot: number, tuer: string): string =>
  `[opened by the session in slot ${slot} through ${tuer} — it is your counterpart in the mailbox]`;

/** DIE ÖFFNERIN BEENDET EIN KIND, DAS SIE ÖFFNETE (POST /api/self/seats/<slot>/end): nur ein lebender Sitz, den diese Session oder ihre Linie durch die Ordner-Tür
 *  oder die Branch-Tür öffnete (server/opener.ts#istOeffnerin) — nie die eigene Öffnerin, nie ein Geschwister, nie ein Fremder, nie ein Sitz in einer
 *  Rolle von Fleet. `openedAt`, wenn der Body ihn nennt, muss der Besetzer sein, den die Öffnerin meint (ein Platz wird neu belegt). Rein. */
export function kindBeenden(oeffnerin: SitzTatsache, ziel: SitzTatsache | undefined, fleetRolle: boolean, openedAt: number | undefined):
  { ok: true } | { ok: false; status: number; error: string } {
  if (!ziel || ziel.cwd === null) return { ok: false, status: 409, error: "no live seat on that place — nothing to end" };
  if (openedAt !== undefined && ziel.openedAt !== openedAt) return { ok: false, status: 409, error: "this place has another occupant now" };
  if (istOeffnerin(ziel, oeffnerin.openedBy))
    return { ok: false, status: 409, error: "that seat opened you — a seat never ends its opener" };
  if (!istOeffnerin(oeffnerin, ziel.openedBy))
    return { ok: false, status: 409, error: `you did not open slot ${ziel.slot} — a seat ends only a child it opened itself, not a sibling or a stranger` };
  if (fleetRolle) return { ok: false, status: 409, error: `slot ${ziel.slot} holds one of Fleet's own roles (lane, steward, Orchestratorin) — those end through their owner` };
  return { ok: true };
}

/** DIE NAMEN, DIE FLEETS EIGENE ROLLEN TRAGEN — eine gebildete Rolle nimmt keinen von ihnen (und kein lesbares Rollen-Label, das prüft
 *  die Tür mit ihrem Prädikat): Fleets Rollen bleiben, wie sie sind, und behalten jedes Recht. */
export const FLEET_ROLLEN_IDS: readonly string[] = ["orchestrator", "orchestratorin", "program-main", "lane", "steward", "generic", "main",
  "owner", "controller", "supervisor"];
const ROLLE_ID = /^[a-z][a-z0-9-]{0,79}$/;
/** DIE RECHTE, DIE KEIN ROLLENBUNDEL TRÄGT (session-rechte.ts#RECHT_IDS, rechte-tueren.test.ts): der Owner vergibt sie je Sitz. Eine gebildete Rolle trägt sie ebenso wenig. */
export const RECHTE_NUR_JE_SITZ: readonly RechtId[] = ["setup.save", "setup.export", "setup.import", "role.form", "branch.passt"];

/** Die Kennung einer gebildeten Rolle aus ihrem Namen: klein, Bindestriche, so wie eine Adresse sie trägt. */
export function rolleAusName(name: string): string | null {
  const id = name.trim().normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return ROLLE_ID.test(id) ? id : null;
}

// ---- das Buch der Rollen, die hier gebildet wurden ------------------------------------------------------------------------
// Das Regal hält jede Rolle, auch die eines importierten Setups; deren Rechte warten auf die Freigabe des Owners. Gebildet hier
// heißt: eine Session mit `role.form` schrieb sie, ihr Bundel ist an ihre Rechte gedeckelt. Nur solche Rollen öffnet die Selbst-Tür —
// der Hash gehört zum Eintrag, damit ein Import derselben Kennung mit anderem Inhalt nicht als gebildet gilt.
export const GEBILDETE_ROLLEN_DATEI = "gebildete-rollen.json";
// `slot`, `cwd` und `linie`: die Linie der Bildnerin (server/opener.ts) — eine Nachfolge bleibt dieselbe Linie, eine fremde Session im selben
// Platz und Ordner ist es nicht; ein Eintrag von vor der Linie (ohne `linie`) gilt nach Platz und Ordner wie bisher
export interface Bildnerin { text: string; slot: number; cwd: string; linie?: string | null }
export interface GebildeteRolle { id: string; hash: string; von: string; at: number; slot?: number; cwd?: string; linie?: string }
export function liesGebildete(dir: string): GebildeteRolle[] {
  try {
    const raw: unknown = JSON.parse(readFileSync(join(dir, GEBILDETE_ROLLEN_DATEI), "utf8"));
    const rows = raw && typeof raw === "object" && "rollen" in raw && Array.isArray(raw.rollen) ? raw.rollen : [];
    return rows.flatMap((x: unknown): GebildeteRolle[] => {
      const r = x && typeof x === "object" ? x as Record<string, unknown> : null;
      return r && typeof r.id === "string" && typeof r.hash === "string" && typeof r.von === "string" && typeof r.at === "number"
        ? [{ id: r.id, hash: r.hash, von: r.von, at: r.at, ...(typeof r.slot === "number" ? { slot: r.slot } : {}),
          ...(typeof r.cwd === "string" ? { cwd: r.cwd } : {}), ...(typeof r.linie === "string" && LINIE_RE.test(r.linie) ? { linie: r.linie } : {}) }] : [];
    });
  } catch { return []; }
}
function merkeGebildete(dir: string, rows: readonly GebildeteRolle[]): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const ziel = join(dir, GEBILDETE_ROLLEN_DATEI), tmp = `${ziel}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: 1, rollen: rows }, null, 1), { mode: 0o600 });
  renameSync(tmp, ziel);
}
/** Die Rollen des Regals, die hier gebildet wurden und noch so dastehen, wie sie gebildet wurden. */
export function gebildeteAufRegal(dir: string): { role: SetupRole; von: string; at: number }[] {
  const gebildet = liesGebildete(dir);
  return (liesShelf(dir).roles ?? []).flatMap((role) => {
    const g = gebildet.find((x) => x.id === role.id && x.hash === role.hash);
    return g ? [{ role, von: g.von, at: g.at }] : [];
  });
}

export interface RolleAntwort { id: string; name: string; rights: RechtId[]; packs: string[]; address: { kind: "role"; role: string }; hash: string; von?: string }
const rolleAntwort = (r: SetupRole, von?: string): RolleAntwort => ({ id: r.id, name: r.name, rights: [...r.rights], packs: r.packs.map((p) => p.id),
  address: { kind: "role", role: r.id }, hash: r.hash, ...(von ? { von } : {}) });
export const gebildeteAntworten = (dir: string): RolleAntwort[] => gebildeteAufRegal(dir).map((g) => rolleAntwort(g.role, g.von));

/** EINE ROLLE BILDEN (Recht `role.form`): Name, Starttext, Bundel (nie weiter als die wirksamen Rechte der Bildnerin) und die Packs,
 *  die sie liest — vom Regal oder aus der Bibliothek des Sitzes. Die Tür nennt jedes Recht, das weiter wäre, und jeden Namen, der als Fleets
 *  eigene Rolle gelesen würde. Abgelegt wird der Rollenstein aufs Regal — dasselbe Format, das ein Setup reist
 *  (server/setup-datei.ts). `von`: wer sie bildete („the session in slot 6“) und ihre Linie; nur sie bildet dieselbe Kennung neu. */
export function rolleFormen(body: Record<string, unknown> | null, wirksame: ReadonlySet<RechtId>, dir: string,
  istRollenLabel: (name: string) => boolean, von: Bildnerin, bibliothek: SeatKnowledge | null = null, jetzt = Date.now()):
  { ok: true; rolle: RolleAntwort } | { ok: false; status: number; error: string; missingRight?: RechtId } {
  if (!body) return { ok: false, status: 400, error: "expected { name, text, rights?, packs? }" };
  const fremd = unbekannteSchluessel(body, ROLLE_SCHLUESSEL);
  if (fremd) return { ok: false, status: 400, error: fremd };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) return { ok: false, status: 400, error: "name is one line of at most 120 characters" };
  if (istRollenLabel(name))
    return { ok: false, status: 409, error: `the name „${name}“ reads as one of Fleet's own role labels (Orchestrator, steward) — those stay the owner's to give` };
  if (typeof body.text !== "string" || !body.text.trim())
    return { ok: false, status: 400, error: "text is the role's start text (purpose and rules in your words) — a non-empty text" };
  if (new TextEncoder().encode(body.text).length > 64_000) return { ok: false, status: 400, error: "text is larger than 64 KB" };
  const id = rolleAusName(name);
  if (!id) return { ok: false, status: 400, error: "the name yields no role id of lowercase letters, digits and dashes — choose another" };
  if (FLEET_ROLLEN_IDS.includes(id) || istRollenLabel(id))
    return { ok: false, status: 409, error: `„${id}“ is one of Fleet's own roles — a formed role never takes one of their names` };
  const rohRechte = body.rights === undefined || body.rights === null ? [] : body.rights;
  if (!Array.isArray(rohRechte) || rohRechte.some((x) => !istRechtId(x)))
    return { ok: false, status: 400, error: "rights is a list of right ids" };
  const rights = [...new Set(rohRechte as RechtId[])];
  const nurJeSitz = rights.filter((x) => RECHTE_NUR_JE_SITZ.includes(x));
  if (nurJeSitz.length)
    return { ok: false, status: 409, missingRight: nurJeSitz[0],
      error: `the right \`${nurJeSitz[0]}\` is no part of a role bundle: ${nurJeSitz.join(", ")} change the setup as such, so the owner grants them per seat — a formed role never carries them` };
  const nurOwner = rights.filter((x) => RECHTE_NUR_DURCH_OWNER.includes(x));
  if (nurOwner.length)
    return { ok: false, status: 409, missingRight: nurOwner[0],
      error: `the right \`${nurOwner[0]}\` is given only by the owner, to one seat through his own door — a formed role never carries it` };
  const weiter = rights.filter((x) => !wirksame.has(x)).sort();
  if (weiter.length)
    return { ok: false, status: 409, missingRight: weiter[0],
      error: `missing right \`${weiter[0]}\`: the role gives ${weiter.join(", ")} more than yours — a seat forms no role wider than itself` };
  const shelf = liesShelf(dir);
  const schon = shelf.roles?.find((r) => r.id === id);
  const bisher = liesGebildete(dir).find((g) => g.id === id);
  if (schon && bisher?.hash !== schon.hash)
    return { ok: false, status: 409, error: `a role „${id}“ stands on this shelf already, from an imported setup — form another name` };
  // EINE ROLLE, DIE SCHON JEMAND TRÄGT, ÄNDERT NUR IHRE BILDNERIN: ein anderer Sitz mit role.form tauschte sonst Starttext und Bundel unter ihr aus
  if (schon && !(bisher?.slot !== undefined && bisher.cwd !== undefined && istOeffnerin(von, { slot: bisher.slot, cwd: bisher.cwd, linie: bisher.linie })))
    return { ok: false, status: 409, error: `the role „${id}“ was formed by ${bisher?.von ?? "another seat"} — only the seat that formed it forms it anew; form another name` };
  const packIds = body.packs === undefined || body.packs === null ? [] : body.packs;
  if (!Array.isArray(packIds) || packIds.some((x) => typeof x !== "string"))
    return { ok: false, status: 400, error: "packs is a list of pack ids the role reads (from the shelf or this seat's library)" };
  const neuePacks: SetupPack[] = [], refs: { kind: "pack"; id: string; hash: string | null }[] = [];
  for (const raw of packIds as string[]) {
    if (refs.some((p) => p.id === raw)) continue;
    const block: SetupPack | null = shelf.packs.find((p) => p.id === raw && p.personal !== true && p.text !== null) ?? packAusBibliothek(bibliothek, raw);
    if (!block) return { ok: false, status: 400, error: `pack „${raw}“ is neither on this shelf nor a pack of the library a role may read (a personal pack stays with its person)` };
    if (!shelf.packs.some((p) => p.id === block.id && p.hash === block.hash)) neuePacks.push(block);
    refs.push({ kind: "pack", id: block.id, hash: block.hash });
  }
  const start = { titel: name, text: body.text };
  const rolle: SetupRole = { id, name, hash: roleHash({ id, name, start, rights, packs: refs }), start, rights, packs: refs };
  schreibShelf(dir, { version: 1, packs: [...shelf.packs.filter((p) => !neuePacks.some((n) => n.id === p.id)), ...neuePacks],
    concepts: shelf.concepts, roles: [...(shelf.roles ?? []).filter((r) => r.id !== id), rolle] });
  merkeGebildete(dir, [...liesGebildete(dir).filter((g) => g.id !== id), { id, hash: rolle.hash, von: von.text, at: jetzt, slot: von.slot, cwd: von.cwd,
    ...(von.linie ? { linie: von.linie } : {}) }]);
  return { ok: true, rolle: rolleAntwort(rolle, von.text) };
}

/** EINE GEBILDETE ROLLE AN DER ÖFFNEN-TÜR: nur eine, die hier gebildet wurde — Fleets eigene Rollen (orchestratorin, lane, main) bleiben
 *  der Slot-Tür des Owners und den Startfenstern, wie sie sind, und die Rechte einer importierten Rolle warten auf seine Freigabe
 *  (POST /api/k15/freigabe). Der Stein trägt Starttext, Bundel und Packs. */
/** DIE FREIGABE DES OWNERS FÜR EINE IMPORTIERTE ROLLE: sie steht an der Position der gespeicherten Konstellation, die den Rollensitz trägt
 *  (`sitz.rolle` ist die Rolle, `sitz.darf.bestaetigt` setzt POST /api/k15/freigabe). Sie gilt den Rechten, die sie bestätigte: trägt die Rolle
 *  auf dem Regal heute andere als `sitz.darf.rolle`, wartet sie wieder. Eine Rolle ohne Rechte hat nichts zu bestätigen. */
export function rolleBestaetigt(dir: string, role: SetupRole): boolean {
  if (!role.rights.length) return true;
  try {
    const raw: unknown = JSON.parse(readFileSync(join(dir, SPEICHER_DATEI), "utf8"));
    const liste = raw && typeof raw === "object" && "konstellationen" in raw && Array.isArray(raw.konstellationen) ? raw.konstellationen : [];
    const gleich = (a: readonly unknown[], b: readonly string[]): boolean => a.length === b.length && b.every((x) => a.includes(x));
    return liste.some((k: unknown) => {
      const pos = k && typeof k === "object" && "positionen" in k && Array.isArray(k.positionen) ? k.positionen : [];
      return pos.some((p: unknown) => {
        const sitz = p && typeof p === "object" && "sitz" in p && p.sitz && typeof p.sitz === "object" ? p.sitz as Record<string, unknown> : null;
        const darf = sitz?.darf && typeof sitz.darf === "object" ? sitz.darf as Record<string, unknown> : null;
        return sitz?.rolle === role.id && darf?.bestaetigt === true && Array.isArray(darf.rolle) && gleich(darf.rolle, role.rights);
      });
    });
  } catch { return false; }
}

export function rolleSteinDerTuer(v: unknown, dir: string): { ok: true; stein: RoleStein; von: string } | { ok: false; status: number; error: string } {
  if (typeof v !== "string" || !ROLLE_ID.test(v))
    return { ok: false, status: 400, error: "rolle must be the id of a formed role (POST /api/self/roles forms one)" };
  if (FLEET_ROLLEN_IDS.includes(v))
    return { ok: false, status: 409, error: `„${v}“ is one of Fleet's own roles — a seat opens a formed role of the shelf, and Fleet's roles stay the owner's to give` };
  const stein = roleStein(v, dir);
  if (!stein) return { ok: false, status: 404, error: `no formed role „${v}“ on this shelf (POST /api/self/roles forms one)` };
  const g = gebildeteAufRegal(dir).find((x) => x.role.id === v);
  if (g) return { ok: true, stein, von: g.von };
  if (!rolleBestaetigt(dir, stein.role))
    return { ok: false, status: 409, error: `the role „${v}“ came with an imported setup — its rights wait for the owner's confirmation (POST /api/k15/freigabe); a session opens roles formed here and imported roles the owner confirmed` };
  // nichts zu bestätigen heißt nicht „bestätigt“: die Herkunft sagt, was wahr ist
  return { ok: true, stein, von: stein.role.rights.length ? "an imported setup, confirmed by the owner" : "an imported setup (no rights to confirm)" };
}

const IMPORTIERT_VON = "an imported setup, confirmed by the owner";
/** Was ein Slot von der Rolle trägt, in der er startet (Slot.rolleStein), aus dem Stein, den die Tür annahm. */
export const rolleBezug = (stein: RoleStein, von: string): RolleBezug => ({ id: stein.role.id, name: stein.role.name, hash: stein.role.hash, von });

/** DIE ROLLE EINER POSITION (`sitz.rolle` einer importierten Konstellation): der Sitz, den der Owner aus ihr öffnet, trägt sie als Stein, wenn der Owner
 *  ihre Rechte bestätigt hat — dann ist die ROLE-RIGHTS-Zeile seines Starts wahr, und die Adresse der Rolle geht an ihn. Vorher startet er, wie
 *  er heute startet (die Rolle als Purpose, die Rechte gedeckelt). Fleets eigene Rollen und unbekannte gibt es hier nicht. */
export function rolleDerPosition(id: string | undefined, dir: string): RolleBezug | null {
  if (!id) return null;
  const r = rolleSteinDerTuer(id, dir);
  return r.ok ? rolleBezug(r.stein, r.von) : null;
}

/** `role` AN DER OWNER-TÜR (POST /api/slots/N/open): dieselbe Rolle wie an der Selbst-Tür (gebildet hier oder vom Owner bestätigt), ihr Bundel als Zusagen
 *  in den Rechten des Bodys. Der Owner hat keine Öffnerin, die deckelt; die Rolle ist, was er will. Ohne `role` bleibt der Body, wie er ist. */
export function rolleAnDerOwnerTuer(body: Record<string, unknown>, dir: string):
  { ok: true; body: Record<string, unknown>; rolle: RolleBezug | null } | { ok: false; status: number; error: string } {
  if (body.role === undefined || body.role === null) return { ok: true, body, rolle: null };
  const r = rolleSteinDerTuer(body.role, dir);
  if (!r.ok) return r;
  const { role: _role, ...ohne } = body;
  return { ok: true, body: r.stein.role.rights.length ? mitRolleRechten(ohne, r.stein.role.rights, null) : ohne, rolle: rolleBezug(r.stein, r.von) };
}

/** DER ZWECK IM START, WENN DER ROLLENSTEIN IHN SCHON TRÄGT: ein Sitz aus einer Position mit bestätigter Rolle hat den Starttext der Rolle zweimal — als Purpose
 *  aus dem Profil der Position (die Datei trug ihn dorthin) und als Rollenstein. Ist der Purpose derselbe Text, bleibt er im Start weg und der Stein trägt ihn.
 *  Der Slot behält seine Agent-MD (Profil, Notizbuch): nur was der Start druckt, ändert sich. */
export function zweckOhneRollentext<T extends { text: string }>(agentMd: T | null, bezug: RolleBezug | null | undefined, dir: string): T | null {
  if (!agentMd || !bezug) return agentMd;
  const text = roleStein(bezug.id, dir)?.role.start.text.trim();
  return text && text === agentMd.text.trim() ? null : agentMd;
}

/** DIE ROLLE IM BRIEF EINER NACHFOLGERIN auf einem Harness ohne Fleets Systemprompt (Codex, pi): ihr Block aus rolleSteinBlock mit einer Kopfzeile, die sagt, dass die
 *  Rolle und ihre Adresse mit der Nachfolge bleiben. Ohne Rolle oder ohne lesbaren Stein nichts. */
export function rolleImBrief(bezug: RolleBezug | null | undefined, block: string | null): string | null {
  return bezug && block
    ? `YOUR ROLE (${bezug.id}) stays with the succession: the address {kind:"role", role:"${bezug.id}"} is still yours, and its start text follows.\n${block}` : null;
}

/** Die Rechte, mit denen ein Kind in der Rolle startet: das Bundel der Rolle als Zusagen (additiv, wie jede Rolle). Die vier Schalter,
 *  die Stufe und ein ersetztes Rollenbundel (`buendel: none`) bleiben die des Bodys, sonst die der Öffnerin; ihre eigenen Zusagen gehen nur mit, wenn der Body sie nennt — die Rolle
 *  IST das Bundel des Kindes. Rein; kindNieWeiter deckelt das Ergebnis danach an den Rechten der Öffnerin. */
export function mitRolleRechten(body: Record<string, unknown>, rolle: readonly RechtId[], oeffnerin: Rechte | null): Record<string, unknown> {
  const gegeben = body.rechte === undefined ? null : body.rechte === null ? null : rechteAus(body.rechte);
  if (body.rechte !== undefined && body.rechte !== null && !gegeben) return body; // unlesbar: die Tür antwortet mit ihrem eigenen Satz
  const basis = body.rechte === undefined ? oeffnerin : gegeben;
  const recht = [...new Set([...(body.rechte === undefined ? [] : gegeben?.recht ?? []), ...rolle])];
  return { ...body, rechte: { stufe: basis?.stufe ?? RECHTE_STANDARD, an: [...(basis?.an ?? [])], aus: [...(basis?.aus ?? [])], recht,
    ...(basis?.buendel ? { buendel: basis.buendel } : {}) } };
}

/** Was ein Slot von seiner gebildeten Rolle trägt (Slot.rolleStein, persistiert wie Slot.agent): Kennung, Name, Hash. */
export interface RolleBezug { id: string; name: string; hash: string; von?: string }
export function rolleSteinGeladen(raw: unknown): RolleBezug | null {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  return r && ROLLE_ID.test(String(r.id)) && typeof r.name === "string" && typeof r.hash === "string" && /^[0-9a-f]{64}$/.test(r.hash)
    ? { id: String(r.id), name: r.name, hash: r.hash, ...(typeof r.von === "string" ? { von: r.von } : {}) } : null;
}
