// FLEETS VORLAGEN (W3a, plan-dynamiken-2026-10-31 §W3: „[Zitat entfernt]“). Eine Vorlage ist
// ein Setup (`fleet-setup/1`, server/setup-datei.ts), das Fleet selbst mitbringt: Sitze, `reports-to`-Kanten und Rollen, die ihre Packs lesen.
// Sie geht durch denselben Import wie jede Setup-Datei (importiereSetup), danach öffnet der Owner die oberste Position und sie öffnet ihre
// Kinder über POST /api/self/seats/open {sitz} — kein eigener Startpfad.
//
// DIE DATEI ENTSTEHT BEIM LESEN aus dem Register an Fleets Kopf (die Bibliothek eines Sitzes in Fleets Repo): die Packs reisen mit ihrem
// heutigen Text und Hash, so driftet keine abgelegte Kopie gegen docs/packs/. Fehlt ein Pack, gibt es die Vorlage nicht, mit Satz.
//
// „Lead with builders“ ist das Muster MAIN mit Lanes als Konstellation: die Rollenkarten bleiben, wo sie sind (server/rollenkarten.ts), und ihr
// Inhalt für einen Sitz ohne Program steht in den Packs `leiten` und `bauen`. Die Rollen tragen kein Rechtebundel: was die Leitung zum Öffnen
// braucht (`seat.open`), trägt jeder freie Sitz. Die vier Rechte, die nur je Sitz vergeben werden (role.form, setup.save, setup.export,
// setup.import), erbittet der Sitz der Leitung in seinem `may.rechte` — der Import deckelt sie, und EINE Freigabe des Owners an dieser Position
// (POST /api/k15/freigabe) gibt sie alle. Welche davon die Leitung tragen soll, ist das Wort des Owners (Auftrag W3a); bis dahin steht nur hier,
// was sie erbittet.
import { RECHTE_STANDARD, type RechtId } from "../session-rechte";
import { SETUP_FORMAT, mitSetupHash, packAusBibliothek, roleHash, type SetupDatei, type SetupPack, type SetupRole, type SetupSeat } from "./setup-datei";
import type { SeatKnowledge } from "./sitz-wissen";

/** `spitze`: der Sitz, den der Start öffnet (die Leitung; bei einem einzelnen Agenten er selbst). `sitze`: wie viele Sitze die Vorlage trägt. */
export interface Vorlage { id: string; name: string; satz: string; spitze: string; sitze: number }

export const LEAD_WITH_BUILDERS = "lead-with-builders";
export const SUPER_FLEETBOT = "super-fleetbot";
export const VORLAGEN: readonly Vorlage[] = [
  { id: SUPER_FLEETBOT, name: "Super FleetBot", spitze: "fleetbot", sitze: 1,
    satz: "The agent you talk to: keeps the overview, thinks along, and sends each piece of work to the seat that fits it." },
  { id: LEAD_WITH_BUILDERS, name: "Lead with builders", spitze: "lead", sitze: 3,
    satz: "A lead opens a builder and a checker, gives each a checkable goal, judges their reports; both report to it." },
];

/** Was die Leitung erbittet, damit sie ihr Team als Setup bilden, speichern und teilen kann, und das „passt“ auf die Spitze ihrer Kinder (W3b),
 *  damit ihr Team fertig wird, ohne den Owner zu wecken: die Rechte, die kein Rollenbundel trägt — eine Freigabe für alle. */
export const LEITUNG_ERBITTET: readonly RechtId[] = ["role.form", "setup.save", "setup.export", "setup.import", "branch.passt"];

interface RolleBau { id: string; name: string; text: string; packs: readonly string[] }
const ROLLEN: readonly RolleBau[] = [
  { id: "leitung", name: "Lead", packs: ["leiten"],
    text: "You lead this constellation. Open its builder and checker positions, give each a goal it can check, judge their reports against the diff and the check, and decide what lands. What a builder can build, a builder builds. The pack leiten says how." },
  { id: "bauer", name: "Builder", packs: ["bauen"],
    text: "You build the one goal your lead gives you, on your own branch or folder, and report to your lead with the commits and the check's tail. The pack bauen says how." },
  { id: "pruefer", name: "Checker", packs: ["clean-and-effective-code"],
    text: "You check a builder's claim for your lead: read the diff, run the check yourself, and report what holds and what doesn't, each with file:line and the command with its result. You build nothing and you don't fix what you find; the builder does. Your lead is the seat that opened you (me.reportsTo in GET /api/self/constellation); write to it through POST /api/self/messages." },
];

const leererOrdner = { text: null, personal: true as const, hint: null };
const sitz = (id: string, name: string, role: string, reportsTo: string | null, rechte: unknown = null): SetupSeat => ({
  id, name, who: { harness: "claude", model: null, effort: null },
  start: { role, folder: leererOrdner }, reads: [],
  may: { rechte, permissionMode: null }, worksWith: reportsTo ? { reportsTo } : {}, notebook: null });

/** DER SUPER-FLEETBOT: der Agent, mit dem man spricht (Owner 1.11.: „[Zitat entfernt]“).
 *  Er liest, was in Fleets Bibliothek allgemein ist. Was persönlich ist, reist nie mit Text, sondern als leerer Platz, den die Person mit ihrem eigenen füllt:
 *  `working-with-the-owner` zählt als persönlich (src/sitz.ts#PERSOENLICH), `working-with-this-owner` und die Briefe des Owners liegen nur in dessen
 *  Zustandsordner und stehen hier nicht; `your-own-agent` liegt nicht in der Bibliothek, sein Zweck steht unten in eigenen Worten. Sein Zweck steht hier, ohne Namen, Daten und Pfade einer Person. */
export const FLEETBOT_PACKS: readonly string[] = ["operating-a-constellation", "finishing-desktop-work", "fleet-doors"];
export const FLEETBOT_PLATZ = { id: "working-with-the-owner", useWhen: "When you talk with this person or write something they will read." };
const FLEETBOT_ZWECK = { titel: "Super FleetBot", text: [
  "You are this person's own agent in Fleet: the one they talk to, who keeps the overview and sends each piece of work to where it fits.",
  "",
  "The person thinks out loud with you and decides with you. You know what runs and what waits, and you answer from the state you read, not from memory.",
  "Work that needs a seat of its own goes from you to a seat that fits it: you open it, give it a goal it can check, and judge what it reports back.",
  "You stay light and reachable, so the person never waits on a busy pane and never has to ask twice where things stand.",
  "",
  "You are not a messenger. You understand what they mean, say your view next to theirs, and disagree with a reason when you disagree.",
  "",
  "How you write is a habit, not a form; choose what the moment needs.",
  "Lead with what you did or found, and say where they can see it when that helps.",
  "Questions come at the end: usually one, more when you are truly unsure what is yours to decide. What you can answer yourself with confidence, you don't ask.",
  "A message nobody asked for is one line of what is new, and it asks for nothing.",
  "When what runs or waits has changed, close with it in at most three lines.",
  "Keep it short enough for a phone: no tables, their names for things, ids only at the end, and the long version when they ask for more.",
  "",
  "Anything irreversible, anything public and any money stays with the person."].join("\n") };

function fleetbotDatei(vorlage: Vorlage, bibliothek: SeatKnowledge): SetupDatei | string {
  const packs: SetupPack[] = [];
  for (const pid of FLEETBOT_PACKS) {
    const block = packAusBibliothek(bibliothek, pid);
    if (!block) return `the template „${vorlage.id}“ needs the pack „${pid}“, which Fleet's library at ${bibliothek.head.slice(0, 12)} does not have`;
    packs.push(block);
  }
  const platz: SetupPack = { kind: "pack", id: FLEETBOT_PLATZ.id, hash: null, text: null, personal: true, useWhen: FLEETBOT_PLATZ.useWhen, sources: [] };
  const reads = [...packs, platz].map((p) => ({ kind: "pack" as const, id: p.id, hash: p.hash }));
  const seat: SetupSeat = { ...sitz(vorlage.spitze, vorlage.name, "", null), start: { purpose: FLEETBOT_ZWECK, folder: leererOrdner }, reads };
  return mitSetupHash({ format: SETUP_FORMAT, name: vorlage.name, derivedFrom: null, derivedFromLine: [], seats: [seat], edges: [], packs: [...packs, platz], concepts: [], roles: [] });
}

/** Die Vorlage als Setup-Datei, aus der Bibliothek eines Sitzes in Fleets Repo; ein Satz, wenn sie nicht zu bauen ist. Rein. */
export function vorlageDatei(id: string, bibliothek: SeatKnowledge): SetupDatei | string {
  const vorlage = VORLAGEN.find((v) => v.id === id);
  if (!vorlage) return `no Fleet template „${id}“ — Fleet's templates: ${VORLAGEN.map((v) => v.id).join(", ")}`;
  if (vorlage.id === SUPER_FLEETBOT) return fleetbotDatei(vorlage, bibliothek);
  const packs: SetupPack[] = [];
  const roles: SetupRole[] = [];
  for (const r of ROLLEN) {
    const refs = [];
    for (const pid of r.packs) {
      const block = packs.find((p) => p.id === pid) ?? packAusBibliothek(bibliothek, pid);
      if (!block) return `the template „${id}“ needs the pack „${pid}“, which Fleet's library at ${bibliothek.head.slice(0, 12)} does not have`;
      if (!packs.includes(block)) packs.push(block);
      refs.push({ kind: "pack" as const, id: block.id, hash: block.hash });
    }
    const start = { titel: r.name, text: r.text };
    roles.push({ id: r.id, name: r.name, hash: roleHash({ id: r.id, name: r.name, start, rights: [], packs: refs }), start, rights: [], packs: refs });
  }
  const erbeten = { stufe: RECHTE_STANDARD, an: [], aus: [], recht: [...LEITUNG_ERBITTET] };
  const seats = [sitz("lead", "Lead", "leitung", null, erbeten), sitz("builder", "Builder", "bauer", "lead"), sitz("checker", "Checker", "pruefer", "lead")];
  return mitSetupHash({ format: SETUP_FORMAT, name: vorlage.name, derivedFrom: null, derivedFromLine: [], seats,
    edges: seats.flatMap((s) => s.worksWith.reportsTo ? [{ from: s.id, to: s.worksWith.reportsTo, kind: "reports-to" as const }] : []),
    packs, concepts: [], roles });
}
