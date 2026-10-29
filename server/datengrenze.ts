// DIE DATENGRENZE AM TEXT (Owner 29.10.: „[Zitat entfernt]“).
// Claude-Sitze (Anthropic) und pi-Sitze mit GLM oder DeepSeek arbeiten nebeneinander, Codex-Sitze sind ebenfalls nicht
// Anthropic; persönliche oder Firmen-Daten dürfen nie bei einem Nicht-Anthropic-Modell ankommen. Es gibt darum keine Sperre
// zwischen Sitz-Paaren, sondern eine Grenze am TEXT: was als persönlich markiert ist, geht an keiner Tür an einen Sitz, der
// nicht Anthropic ist. Unmarkiertes fließt wie vorher.
//
// DIE MARKE STEHT AM WISSEN SELBST (`personal: true` am Pack, am Konzept, an der Richtung, an der Notiz; server/setup-datei.ts, src/sitz.ts)
// und reist in fleet-setup/1 mit: die Datei trägt sie weiter, den Text nie. Eine Nachricht trägt sie zusätzlich (Body-Feld `personal`).
//
// DIE TÜREN, DIE EINEM SITZ TEXT ZUSTELLEN — jede prüft `istAnthropic`; rechts der Test in server/datengrenze.test.ts, der sie hält:
//   1. Start und Fassung, Packs       server.ts#seatStartFor → wissenFuerSitz; die Fassung nennt jeden weggelassenen Pack als Zeile
//                                     „− pack <id>: personal, not delivered to <harness>/<model>“
//                                       „der eigene persönliche Pack fehlt im Start des pi-Sitzes …“ · „… working-with-the-owner …“
//   2. Skills                         server/sitz-wissen.ts#seatSkillFiles über dasselbe wissenFuerSitz
//                                       „Skills: ein persönlicher Pack wird keine Skill-Datei …“
//   3. Steine der Vorgängerin         Slot.selbst.jetzt.packs, als `dazu` durch seatStartFor (server/selbst-einrichten.ts)
//                                       „Steine der Vorgängerin: …“
//   4. Start und Fassung, Konzepte    server/setup-datei.ts#steineFuerAgentWahl (ohnePersoenliches) über server.ts#agentSteineFuer
//                                       „Start, Konzepte: …“
//   5. Richtung                       trägt nur den leeren Platz (setup-datei.ts#RICHTUNG_PLATZ), nie Text: src/sitz.ts#sitzZumTeilen
//                                       „Richtung: sie reist nur als leerer Platz …“
//   6. setup-datei-Import             ein mitgereister persönlicher Platz (server/sitz-reise.ts#sitzWissen) trägt die Marke in den Start
//                                       „setup-datei-Import: …“ (der Export macht aus der Marke einen leeren Platz: setup-datei.test.ts)
//   7. Postfach, Senden               server.ts#sendMessageFor: 409 vor dem Schreiben
//                                       „… an einen pi-Sitz 409 und nirgends im Postfach …“
//   8. Postfach, Ausliefern           server.ts#messageInboundFor: Tick (tickPostfachZustellung), GET, Quittung
//                                       „der Wechsel des Platzes nach dem Senden …“
//   9. Kanten-Ansicht                 server.ts#kantenTuer, `view`: der Text einer Nachricht fehlt für einen solchen Sitz
//                                       im ersten Postfach-Test, letzte Zeilen („die Orchestratorin liest an der Kante mit“)
//  10. Branch-Packs-Erbe              server.ts#openBoardBranch → seatStartFor des Kindes
//                                       „das Kind einer pi-Öffnerin erbt den persönlichen Pack nicht …“
//  11. Ausleihe eines Packs           server.ts#contextBorrowRoute (GET /api/self/context/<id>): 409, refusal personal-text
//                                       „Ausleihe: ein pi-Sitz leiht einen persönlichen Pack nicht aus …“
//  12. Fernpost                       OFFEN: branch/fernpost ist noch nicht in main; dort muss `istAnthropic(Ziel)` vor den Versand
//                                       test.todo „Fernpost: …“
//  13. Plan-Packs einer Lane oder MAIN (server/session-agents.ts#renderSessionAgents)   OFFEN: trägt die Marke nicht
//                                       test.todo „Plan-Packs einer Lane oder MAIN: …“
//  14. Nachfolge-Brief                server.ts#nachfolgeSteineFuer: die Steine der Vorgängerin stehen im Brief eines Harness ohne Fleets
//                                     Systemprompt als Text; ein persönlicher Pack dort als Zeile „− pack <id>: personal, …“
//                                       server/datengrenze-nachfolge.test.ts
//  15. Korrekturen des Owners         GET /api/self/konzepte/k-owner-korrekturen/leseansicht: UNMARKIERT GEWOLLT — die Korrekturen des
//                                     Owners gelten jedem Sitz (Entscheid der Leitung 29.10.); keine Marke, kein Code, kein Test
// Nicht zugestellt wird an einen Sitz ohne diese Türen nichts: Notizbuch und Auto-Memory liest nur Claude Code (notizbuchFuerStart).
//
// Reine Antworten, sonst nichts: ob ein Sitz Anthropic ist, was die Ablehnung und die Fassungszeile sagen, und das Wissen, wie seine
// Grenze es lässt.
import { MODEL_ALIASES, modelEntry } from "../model-register";
import type { SeatKnowledge } from "./sitz-wissen";

// Anthropic ist nur, was Fleets Claude-Harness mit einem Claude-Modell fährt: kein Harness-Name (leer = Claude Code) oder
// "claude", und ein Modell, das leer ist (dann gilt Claude Codes Voreinstellung), im Register unter "claude" steht oder dessen Alias
// auf ein solches zeigt. Alles andere zählt als NICHT Anthropic, auch ein Harness oder Modell, das wir nicht kennen:
// im Zweifel bleibt der Text daheim.
export function istAnthropic(harness: string | null | undefined, model: string | null | undefined): boolean {
  if (harness !== null && harness !== undefined && harness !== "" && harness !== "claude") return false;
  if (model === null || model === undefined || model === "") return true;
  const id = MODEL_ALIASES[model.trim().toLowerCase()] ?? model;
  return modelEntry("claude", id) !== undefined;
}

const sitzName = (harness: string | null | undefined, model: string | null | undefined): string => `${harness || "claude"}/${model || "default"}`;

/** Der Satz der Abweisung (409): welcher Stein (Pack, Konzept, Nachricht), die Marke, und Harness und Modell des Sitzes. */
export const persoenlichAbgelehnt = (stein: string, harness: string | null | undefined, model: string | null | undefined): string =>
  `personal ${stein} is not delivered to a non-Anthropic seat: ${sitzName(harness, model)}`;

/** Die Zeile der Fassung für einen Stein, der im Start fehlt: nicht still weg, sondern mit Grund. */
export const weggelassenZeile = (stein: string, harness: string | null | undefined, model: string | null | undefined): string =>
  `− ${stein}: personal, not delivered to ${sitzName(harness, model)}`;

/** Das Wissen eines Sitzes, wie es seine Grenze lässt: für einen Sitz, der nicht Anthropic ist, ohne jeden Pack mit der Marke.
 *  Rein. */
export function wissenFuerSitz(k: SeatKnowledge, harness: string | null | undefined, model: string | null | undefined): SeatKnowledge {
  return istAnthropic(harness, model) ? k : { ...k, packs: k.packs.filter((pack) => pack.personal !== true) };
}
