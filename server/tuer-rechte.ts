// DIE RECHTE AN FLEETS TÜREN, als eine Schicht (Richtung Schritt 2, Owner 2026-10-26: „[Zitat entfernt]“ und „[Zitat entfernt]“). Diese Datei hält die Ids' Bedeutung, die Rollenbundel
// und die eine additive Regel: wirksam = Rollenbundel ∪ Zusagen des Sitzes. Die Türen selbst prüfen mit
// server.ts#verlangeRecht, damit eine Abweisung immer dasselbe Feld und denselben Satz trägt.
import { RECHTE_STANDARD, type RechtId, type Rechte } from "../session-rechte";
import { rechteSatz } from "./rechte";

// Jedes Recht in einer Zeile, die ein Fremder im Startbrief versteht: was es erlaubt, nicht wie es heißt.
export const RECHT_WAS: Readonly<Record<RechtId, string>> = {
  "seat.open": "open a seat",
  "land.branch": "land its own branch",
  "land.program": "land a Program row",
  "fleet.deploy": "deploy Fleet",
  "edge.grant": "grant or close an edge",
  "text.handover": "write the handover its successor reads",
  "text.pack": "write a context pack another seat can read",
  "text.concept.version": "publish a concept version",
  "text.concept.annotation": "annotate a concept",
  "text.program": "write its Program's text",
  "setup.save": "save an agent as its own setup",
  "setup.export": "export a setup as one file",
  "setup.import": "import a setup file",
  "role.form": "form a role of its own",
  "branch.passt": "give „passt“ on the tip of a seat it opened, so that seat may land it",
  "overview.fleet": "see every seat in the overview, as the Orchestratorin does",
  "owner.bot": "be the owner's own bot: his Info offers a page that holds only the chat with this seat",
};

// DIE RECHTE, DIE NUR DER OWNER GIBT (W3 Auftrag 14): über seine Tür (POST /api/slots/<n>/rechte { grant | revoke }) einem Sitz, sonst nie — kein Kind
// bekommt es (kindNieWeiter weist es im Body ab und vererbt es nicht), keine gebildete Rolle trägt es (rolleFormen). Die Orchestratorin trägt
// overview.fleet in ihrem Bundel nur für sich: ein Kind von ihr, vielleicht ein pi-Sitz, sähe sonst Namen und Zwecke jedes Sitzes, was der Owner nie wählte.
export const RECHTE_NUR_DURCH_OWNER: readonly RechtId[] = ["overview.fleet", "owner.bot"];
/** Die Zusage, wie sie die Tür des Owners einem Sitz gibt: die Rechte, die er hat, plus diese. */
// NUR DIE MARKE „[Zitat entfernt]“ AUF EINEM SITZ OHNE RECHTE (Rechte.nurMarke): sie setzt keine Stufe, sonst läse seine Nachfolge eine neue Zeile und dürfte weniger als er.
export const mitZusage = (vorher: Rechte | null, rechte: readonly RechtId[]): Rechte => {
  const nurMarke = (!vorher || vorher.nurMarke === true) && rechte.every((x) => x === "owner.bot");
  return { stufe: vorher?.stufe ?? RECHTE_STANDARD, an: vorher?.an ?? [], aus: vorher?.aus ?? [],
    recht: [...new Set([...(vorher?.recht ?? []), ...rechte])], ...(vorher?.buendel ? { buendel: vorher.buendel } : {}), ...(nurMarke ? { nurMarke: true as const } : {}) };
};
/** Die Rechte eines Sitzes, wie jede Weitergabe sie liest (Kind öffnen, Agent oder Konstellation speichern): die Marke „mein Bot“ allein ist kein Recht, das ein Sitz
 *  hat, also gibt es nichts weiter, und ein Kind startet wie das des Sitzes ohne Marke. Hält der Sitz echte Rechte neben der Marke, gelten sie (ohneOwnerRechte nimmt die Marke dann aus). */
export const ohneMarke = (r: Rechte | null | undefined): Rechte | null => (r?.nurMarke ? null : r ?? null);
/** Was ein Sitz über eine Self-Tür weitergeben darf: seine wirksamen Rechte ohne die, die nur der Owner gibt (RECHTE_NUR_DURCH_OWNER). Seine eigene Tür deckelt damit
 *  einen gespeicherten Agenten und eine Konstellation; die Tür des Owners nimmt sie weiter, mit seinem Schlüssel. */
export const weitergebbareRechte = (rechte: Rechte | null | undefined, rollen: readonly RechtRolle[]): Set<RechtId> =>
  new Set([...wirksameRechte(rechte, rollen)].filter((id) => !RECHTE_NUR_DURCH_OWNER.includes(id)));
/** Rechte ohne die, die nur der Owner gibt: was ein Kind von seiner Öffnerin erben kann. */
export function ohneOwnerRechte(r: Rechte | null): Rechte | null {
  if (!r?.recht?.some((x) => RECHTE_NUR_DURCH_OWNER.includes(x))) return r;
  return { ...r, recht: r.recht.filter((x) => !RECHTE_NUR_DURCH_OWNER.includes(x)) };
}

// Die Rollen, die ein Sitz gleichzeitig tragen kann (Steward auf einer Lane, Lane als gebundene MAIN, …).
// Die Reihenfolge ist die der Abweisung: Orchestratorin, Program-MAIN, Lane, Steward, sonst generic.
export type RechtRolle = "orchestrator" | "program-main" | "lane" | "steward" | "generic";
export const RECHT_ROLLEN: readonly RechtRolle[] = ["orchestrator", "program-main", "lane", "steward"];

// Jede Zelle stammt aus einer Prüfung, die heute schon an der Tür steht; die Matrix in
// server/rechte-tueren.test.ts hält sie fest. Nichts, was eine Rolle heute tut, fehlt hier.
export const ROLLEN_BUENDEL: Readonly<Record<RechtRolle, readonly RechtId[]>> = {
  orchestrator: ["seat.open", "land.branch", "text.handover", "text.pack", "text.concept.annotation", "edge.grant", "overview.fleet"],
  "program-main": ["seat.open", "land.branch", "land.program", "text.handover", "text.pack",
    "text.concept.version", "text.concept.annotation", "text.program"],
  lane: ["land.branch", "text.handover", "text.pack", "text.concept.version", "text.concept.annotation"],
  steward: ["land.branch", "fleet.deploy", "text.pack", "text.concept.annotation"],
  generic: ["seat.open", "land.branch", "text.handover", "text.pack", "text.concept.annotation"],
};

// Das Rollenbundel eines Sitzes: `none` ersetzt es (nur der Owner wählt ihn beim Öffnen), sonst die Vereinigung
// aller Ansprüche. Ein Sitz ohne Anspruch ist generic, genau wie server.ts#isSeat ihn liest.
export function buendelFuer(rollen: readonly RechtRolle[], rechte: Rechte | null | undefined): RechtId[] {
  if (rechte?.buendel === "none") return [];
  const claims = rollen.length ? rollen : ["generic" as const];
  return [...new Set(claims.flatMap((r) => ROLLEN_BUENDEL[r]))];
}

// Die eine additive Regel: ein Recht des Rollenbundels oder eine Zusage des Owners. Zusagen nehmen nichts weg.
export function wirksameRechte(rechte: Rechte | null | undefined, rollen: readonly RechtRolle[]): Set<RechtId> {
  return new Set([...buendelFuer(rollen, rechte), ...(rechte?.recht ?? [])]);
}

// Was GET /api/self und der Startbrief lesen: dieselbe Rechnung, getrennt nach Herkunft, damit ein Sitz sieht,
// was seine Rolle gibt und was der Owner ihm zusätzlich zugesagt hat.
export function rechteAnsicht(rechte: Rechte | null | undefined, rollen: readonly RechtRolle[], harness: string) {
  const bundle = buendelFuer(rollen, rechte);
  const granted = [...(rechte?.recht ?? [])];
  const effective = [...wirksameRechte(rechte, rollen)];
  return { role: rollen.join("+") || "generic", bundle, granted, effective, noFence: harness !== "claude" };
}

// Die Zeilen des Startbriefs. Die erste nennt jedes wirksame Recht mit seiner Bedeutung, nicht nur seine Id; setzt der Start die
// vier Schalter, folgt ihre Stufe als eigener Satz; die letzte sagt, wo Fleet keinen Zaun setzt. Alles ist Text, keine Prüfung:
// geprüft wird an der Tür.
export function rechteZeilen(rechte: Rechte | null | undefined, rollen: readonly RechtRolle[], harness: string): string[] {
  const view = rechteAnsicht(rechte, rollen, harness);
  // owner.bot steht nicht darin: die Marke ist die Seite des Owners, kein Recht, das der Sitz benutzt, und was er liest, ändert sie nicht
  const liest = view.effective.filter((id) => id !== "owner.bot");
  const rights = liest.length
    ? liest.map((id) => `${id} — ${RECHT_WAS[id]}`).join("; ")
    : "none";
  const rightsLine = `FLEET SERVER RIGHTS (checked at Fleet's doors): ${rights}. Source: role ${view.role} + ${view.granted.filter((id) => id !== "owner.bot").length} grant(s).`;
  // DIE VIER SCHALTER, sobald der Start sie setzt (nur Claude Code liest sie, darum dieselbe Grenze wie der Zaun): eine Stufe
  // ändert die Regeln dieses Starts, also nennt der Brief sie. Ohne diese Zeile trüge eine Vorschau mit „Nur lesen“ denselben
  // „darf“-Satz wie eine ohne Wahl, und der Startbrief fiele über `rj !== rn` auf keinen Rechte-Block (src/start-brief.ts:182f;
  // main rot am 28.10., „[Zitat entfernt]“). Der Satz ist der, den die Session selbst im Systemprompt liest.
  const schalter = rechte && !view.noFence && !rechte.nurMarke ? [rechteSatz(rechte)] : [];
  const fence = view.noFence
    ? `FLEET SETS NO HARNESS FENCE for this seat: ${harness} applies its own rules; only the server rights above are checked at Fleet's doors.`
    : "FLEET'S FENCE: the four start switches are Claude Code permission rules, not server checks; file edits and shell commands beyond them are held only by Claude Code. The owner's key bypasses them.";
  return [rightsLine, ...schalter, fence];
}
