// WAS EINE SESSION DARF, VON DER TÜR BIS IN IHRE STARTZEILE (Auftrag session-ui-bau.md A, Owner 19.10. 08:5x: „[Zitat entfernt]“
// ; Urteil 09:5x Punkt 5). Das Fenster „[Zitat entfernt]“ schickt `rechte` an /api/slots/:id/open
// oder /api/branches/open; der Slot hält sie (Slot.rechte, persistiert, auch für Neustart und Nachfolge), und jede Startzeile eines
// Claude-Code-Slots trägt sie als `permissions` im `--settings` und als einen Satz im Systemprompt (server.ts#agentCmd). Gesetzt wird nur
// beim Start; die Tabelle und der weiche Zaun stehen in session-rechte.ts.
import { istRechtId, RECHT_IDS, RECHTE_BEFEHLE, RECHTE_STUFEN, befehlAn, rechteAus, rechteFuerHarness, rechteRegeln, type Rechte } from "../session-rechte";

// the level as the session reads it in its rights sentence (the picker's own words stay in session-rechte.ts)
const STUFE_IM_SATZ: Readonly<Record<string, string>> = { lesen: "read only", bauen: "build", landen: "land", deployen: "deploy" };

// der Body einer Tür: fehlt `rechte`, startet die Session wie bisher ohne Regeln. `recht` und `buendel` gelten auf
// jedem Harness; die vier Schalter (`stufe`, `an`, `aus`) bleiben Claude Codes und werden auf einem anderen Harness
// auf die Standardstufe mit leeren Listen gesetzt, nie angewendet (Owner 2026-10-26).
export function rechteDerTuer(body: Record<string, unknown> | null, harness: string):
  { ok: true; rechte: Rechte | null } | { ok: false; error: string } {
  const v = body?.rechte;
  if (v === undefined || v === null) return { ok: true, rechte: null };
  // Ein unbekanntes Recht wird MIT SEINEM NAMEN abgewiesen, nie still fallen gelassen.
  const roh = v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
  const unbekannt = roh && Array.isArray(roh.recht) ? roh.recht.filter((id) => !istRechtId(id)) : [];
  if (unbekannt.length)
    return { ok: false, error: `rechte names unknown right(s): ${unbekannt.map(String).join(", ")} — valid right ids: ${RECHT_IDS.join(", ")}` };
  if (roh && roh.buendel !== undefined && roh.buendel !== "none")
    return { ok: false, error: `rechte.buendel must be "none"` };
  const r = rechteAus(v);
  if (!r) return { ok: false, error: `rechte must be { stufe?: ${RECHTE_STUFEN.map((s) => s.id).join("|")}, an?: [id], aus?: [id], recht?: [id], buendel?: "none" } with switch ids from ${RECHTE_BEFEHLE.map((b) => b.id).join(", ")} and right ids from ${RECHT_IDS.join(", ")}, none both an and aus` };
  return { ok: true, rechte: rechteFuerHarness(r, harness) };
}

// was fleet.json für einen Slot hält: lesbare Rechte auf jedem Harness; die Schalter eines fremden Harness
// bleiben gespeichert, aber neutralisiert, damit ein Harnesswechsel kein Recht verliert.
export const rechteGeladen = (raw: unknown, harness: string): Rechte | null => rechteFuerHarness(rechteAus(raw), harness);

// der Teil des `--settings` der Startzeile; ohne Rechte nichts, damit eine Zeile ohne sie Byte für Byte bleibt
export const rechteSettings = (r: Rechte | null): { permissions?: { allow: string[]; deny: string[] } } =>
  r ? { permissions: rechteRegeln(r) } : {};

// der Satz, den die Session im Systemprompt liest, damit sie weiß, was sie selbst erledigen darf
export function rechteSatz(r: Rechte): string {
  const stufe = STUFE_IM_SATZ[r.stufe] ?? r.stufe;
  const erlaubt = RECHTE_BEFEHLE.filter((b) => befehlAn(r, b.id)).map((b) => b.befehl);
  const gesperrt = RECHTE_BEFEHLE.filter((b) => !befehlAn(r, b.id)).map((b) => b.befehl);
  return `FLEET RIGHTS (level “${stufe}”, set at start): allowed ${erlaubt.length ? erlaubt.join(", ") : "none of these"}; `
    + `blocked ${gesperrt.length ? gesperrt.join(", ") : "none of these"}. If you need something that is blocked, ask the owner.`;
}
