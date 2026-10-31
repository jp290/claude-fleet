// DIE KORREKTUREN DES OWNERS, GEFALTET (Plan 31.10. W4a „[Zitat entfernt]“, docs/packs/building-an-agent.md
// „[Zitat entfernt]“). Eine Faltung für alle, die das Heft lesen: die Lesetür (server.ts, read-leseansicht),
// der Brief einer Lane oder MAIN (server.ts#ownerKorrekturenFolded) und der Stein im Start eines Sitzes ohne Rolle in Fleets Repo
// (korrekturStein). Ein Eintrag mit modi "*" gilt in jeder Arbeit und steht mit seiner ganzen Aussage da — ein erster Satz allein
// verlor bei karten-bleiben „Ihren Abbau nie vorschlagen“ —; einer mit benannten Modi wird ein Auslöser: Modus und Thema, und der
// Sitz liest ihn ganz an der Tür, wenn seine Arbeit dieser Modus ist.
//
// Rein: Eingang ist die Antwort der Lesetür (konzept-ledger.ts#konzeptLeseansicht), so wie der Server sie für diesen Leser gefaltet hat.
import type { KorrekturLeser } from "../konzept-ledger";

/** Der Autor der + Zeile: die Einträge sind die Worte des Owners, nicht Fleets. */
export const KORREKTUR_AUTOR = "owner";
/** Der Anfang der + Zeile; src/start-steine.ts und src/start-brief.ts erkennen den Stein daran. */
export const KORREKTUR_STEIN_KOPF = "+ corrections ";

export interface KorrekturSteinEintrag {
  readonly id: string;
  readonly aussage: string;
  readonly geltung: { readonly modi: "*" | readonly string[] };
}
/** Die Antwort der Lesetür mit Status 200 (konzept-ledger.ts#konzeptLeseansicht). */
export interface KorrekturLeseantwort {
  readonly konzept: string;
  readonly version: number;
  readonly sha256: string;
  readonly geltendeEintraege: readonly KorrekturSteinEintrag[];
  readonly status?: unknown;
  readonly bindung?: KorrekturLeser;
}
/** Trägt die Antwort der Lesetür ihre Einträge? Die Einträge selbst hat das Ledger gebaut; geprüft wird die Form der Antwort. */
export function istLeseantwort(b: unknown): b is KorrekturLeseantwort {
  return typeof b === "object" && b !== null && "geltendeEintraege" in b && Array.isArray(b.geltendeEintraege)
    && "konzept" in b && typeof b.konzept === "string" && "version" in b && typeof b.version === "number"
    && "sha256" in b && typeof b.sha256 === "string";
}
export interface KorrekturAusloeser { readonly id: string; readonly modi: readonly string[]; readonly thema: string }

// das Thema eines Auslösers: der erste Teilsatz, höchstens `max` Wörter. Der Brief einer Lane und die Tür nehmen neun; der Stein nimmt
// vierzehn, damit die Zeile die Entscheidung trägt und nicht nur ihren Anfang („Kein Brief und kein Setup nennt vor einem …“)
const BRIEF_THEMA_WOERTER = 9;
const STEIN_THEMA_WOERTER = 14;
export function korrekturThema(aussage: string, max = BRIEF_THEMA_WOERTER): string {
  const clause = aussage.split(/;\s| — /)[0]!.replace(/[.!]$/, "").trim();
  const words = clause.split(/\s+/);
  return words.length <= max ? clause : `${words.slice(0, max - 1).join(" ").replace(/,$/, "")} …`;
}

/** Die eine Teilung des Hefts: was in jeder Arbeit gilt, ganz; was nur in benannten Modi gilt, als Auslöser mit seinem Thema. */
export function korrekturTeilung<E extends KorrekturSteinEintrag>(eintraege: readonly E[], themaWoerter = BRIEF_THEMA_WOERTER):
    { ganz: E[]; ausloeser: KorrekturAusloeser[] } {
  return {
    ganz: eintraege.filter((e) => e.geltung.modi === "*"),
    ausloeser: eintraege.flatMap(({ id, aussage, geltung: { modi } }) =>
      modi === "*" ? [] : [{ id, modi, thema: korrekturThema(aussage, themaWoerter) }]),
  };
}

/** Die Faltung, wie die Lesetür sie ausliefert und der Brief einer Lane sie trägt: Auslöser als {id, modi, wann}. */
export function korrekturFaltung(a: KorrekturLeseantwort, tuer: string) {
  const { ganz, ausloeser } = korrekturTeilung(a.geltendeEintraege);
  return { konzept: a.konzept, version: a.version, sha256: a.sha256,
    geltendeEintraege: ganz,
    ausloeser: ausloeser.map(({ id, modi, thema }) => ({ id, modi, wann: `Bei ${modi.join(" oder ")}: ${thema}` })),
    volllesen: `GET ${tuer}/<id>`, status: a.status, bindung: a.bindung };
}
export type KorrekturFaltung = ReturnType<typeof korrekturFaltung>;

/** Der Stein, wie ihn der Start trägt: die + Zeile, ein Satz, wie er sie liest, dann je Eintrag eine Zeile mit seiner Id. */
export function korrekturStein(a: KorrekturLeseantwort, tuer: string): string {
  const { ganz, ausloeser } = korrekturTeilung(a.geltendeEintraege, STEIN_THEMA_WOERTER);
  return [
    `${KORREKTUR_STEIN_KOPF}${a.konzept} v${a.version} (author: ${KORREKTUR_AUTOR})`,
    `YOUR OWNER'S CORRECTIONS (sha256 ${a.sha256.slice(0, 12)}): his standing decisions for this seat, one line each with its id. `
      + `They hold for you. When you act on one, or he asks about one of his decisions, name its id. `
      + `The whole entry: GET ${tuer}/<id> with header "x-fleet-self-token: $FLEET_SELF_TOKEN".`,
    ...(ganz.length ? ganz.map((e) => `- ${e.aussage.replace(/\s+/g, " ").trim()} [${e.id}]`)
      : [ausloeser.length ? "- (no entry holds in every kind of work)" : `- (no entry of v${a.version} applies to this seat)`]),
    ...(ausloeser.length ? ["In one kind of work only — when your work is that kind, read the entry whole first:",
      ...ausloeser.map((t) => `- ${t.modi.join(" / ")}: ${t.thema} [${t.id}]`)] : []),
  ].join("\n");
}
