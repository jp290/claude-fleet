// WAS EINE SESSION DARF, VON DER TÜR BIS IN IHRE STARTZEILE (Auftrag session-ui-bau.md A, Owner 19.10. 08:5x: „[Zitat entfernt]“
// ; Urteil 09:5x Punkt 5). Das Fenster „[Zitat entfernt]“ schickt `rechte` an /api/slots/:id/open
// oder /api/branches/open; der Slot hält sie (Slot.rechte, persistiert, auch für Neustart und Nachfolge), und jede Startzeile eines
// Claude-Code-Slots trägt sie als `permissions` im `--settings` und als einen Satz im Systemprompt (server.ts#agentCmd). Gesetzt wird nur
// beim Start; die Tabelle und der weiche Zaun stehen in session-rechte.ts.
import { RECHTE_BEFEHLE, RECHTE_STUFEN, befehlAn, rechteAus, rechteRegeln, type Rechte } from "../session-rechte";

// the level as the session reads it in its rights sentence (the picker's own words stay in session-rechte.ts)
const STUFE_IM_SATZ: Readonly<Record<string, string>> = { lesen: "read only", bauen: "build", landen: "land", deployen: "deploy" };

// der Body einer Tür: fehlt `rechte`, startet die Session wie bisher ohne Regeln; sonst nur für Claude Code, dessen Regeln es sind
export function rechteDerTuer(body: Record<string, unknown> | null, harness: string):
  { ok: true; rechte: Rechte | null } | { ok: false; error: string } {
  const v = body?.rechte;
  if (v === undefined || v === null) return { ok: true, rechte: null };
  const r = rechteAus(v);
  if (!r) return { ok: false, error: `rechte must be { stufe: ${RECHTE_STUFEN.map((s) => s.id).join("|")}, an?: [id], aus?: [id] } with ids from ${RECHTE_BEFEHLE.map((b) => b.id).join(", ")}, none both an and aus` };
  if (harness !== "claude") return { ok: false, error: `harness ${harness} takes no rechte — they are Claude Code rules` };
  return { ok: true, rechte: r };
}

// was fleet.json für einen Slot hält: nur lesbare Rechte und nur an Claude Code, sonst keine
export const rechteGeladen = (raw: unknown, harness: string): Rechte | null => harness === "claude" ? rechteAus(raw) : null;

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
