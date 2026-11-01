// DIE RECHTE AN FLEETS TÜREN, als eine Schicht (Richtung Schritt 2, Owner 2026-10-26: „[Zitat entfernt]“ und „[Zitat entfernt]“). Diese Datei hält die Ids' Bedeutung, die Rollenbundel
// und die eine additive Regel: wirksam = Rollenbundel ∪ Zusagen des Sitzes. Die Türen selbst prüfen mit
// server.ts#verlangeRecht, damit eine Abweisung immer dasselbe Feld und denselben Satz trägt.
import { type RechtId, type Rechte } from "../session-rechte";
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
};

// DIE RECHTE, DIE NUR DER OWNER GIBT (W3 Auftrag 14): über seine Tür (POST /api/slots/<n>/rechte { grant | revoke }) einem Sitz, sonst nie — kein Kind
// bekommt es (kindNieWeiter weist es im Body ab und vererbt es nicht), keine gebildete Rolle trägt es (rolleFormen). Die Orchestratorin trägt
// overview.fleet in ihrem Bundel nur für sich: ein Kind von ihr, vielleicht ein pi-Sitz, sähe sonst Namen und Zwecke jedes Sitzes, was der Owner nie wählte.
export const RECHTE_NUR_DURCH_OWNER: readonly RechtId[] = ["overview.fleet"];
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
  const rights = view.effective.length
    ? view.effective.map((id) => `${id} — ${RECHT_WAS[id]}`).join("; ")
    : "none";
  const rightsLine = `FLEET SERVER RIGHTS (checked at Fleet's doors): ${rights}. Source: role ${view.role} + ${view.granted.length} grant(s).`;
  // DIE VIER SCHALTER, sobald der Start sie setzt (nur Claude Code liest sie, darum dieselbe Grenze wie der Zaun): eine Stufe
  // ändert die Regeln dieses Starts, also nennt der Brief sie. Ohne diese Zeile trüge eine Vorschau mit „Nur lesen“ denselben
  // „darf“-Satz wie eine ohne Wahl, und der Startbrief fiele über `rj !== rn` auf keinen Rechte-Block (src/start-brief.ts:182f;
  // main rot am 28.10., „[Zitat entfernt]“). Der Satz ist der, den die Session selbst im Systemprompt liest.
  const schalter = rechte && !view.noFence ? [rechteSatz(rechte)] : [];
  const fence = view.noFence
    ? `FLEET SETS NO HARNESS FENCE for this seat: ${harness} applies its own rules; only the server rights above are checked at Fleet's doors.`
    : "FLEET'S FENCE: the four start switches are Claude Code permission rules, not server checks; file edits and shell commands beyond them are held only by Claude Code. The owner's key bypasses them.";
  return [rightsLine, ...schalter, fence];
}
