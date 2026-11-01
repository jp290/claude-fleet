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

export interface Vorlage { id: string; name: string; satz: string }

export const LEAD_WITH_BUILDERS = "lead-with-builders";
export const VORLAGEN: readonly Vorlage[] = [
  { id: LEAD_WITH_BUILDERS, name: "Lead with builders",
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

/** Die Vorlage als Setup-Datei, aus der Bibliothek eines Sitzes in Fleets Repo; ein Satz, wenn sie nicht zu bauen ist. Rein. */
export function vorlageDatei(id: string, bibliothek: SeatKnowledge): SetupDatei | string {
  const vorlage = VORLAGEN.find((v) => v.id === id);
  if (!vorlage) return `no Fleet template „${id}“ — Fleet's templates: ${VORLAGEN.map((v) => v.id).join(", ")}`;
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
