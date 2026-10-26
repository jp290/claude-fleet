// K15 · WER BESTIMMT (Owner 16.10. 09:1x: „[Zitat entfernt]“
// ): je Baustein des
// Gründungsplans, je Zeile, die Claude Code selbst mitbringt, und je Einstellung, ob du es hier einstellst, ob Fleet es festlegt oder ob
// Claude Code es festlegt. Jedes „fest“ trägt seinen Grund in einem Satz und die Herleitung für das Darüberfahren.
// Abgeleitet aus dem Plan, nichts daneben erfunden (session-blocks.ts: grenze, harness, schaltbar, bedingung; dazu `rollenDefault` im
// Plan von „Nur Ordner“: was diese Rolle bekommen kann, ist das Material, das Claude Code selbst lädt, session-blocks.ts#resolveSessionPlan
// `nativ`). Spalte 3 bietet genau dann einen Schalter an, wenn hier „änderbar“ herauskommt (k15-spalte3.ts#bausteinZeile).
// Keine Importe außer Typen, kein DOM: K16 nimmt dieselbe Form für die laufende Konstellation.
import type { Baustein } from "./founding";

export type WerArt = "du" | "fleet" | "claude-code";
export type Wer = { art: "du" } | { art: "fleet" | "claude-code"; grund: string; herleitung: string };
// Owner 16.10. 14:1x: „[Zitat entfernt]“
//  — ein Standard, kein Gesetz; der Grund sagt, ob und wo es heute einstellbar ist
export const WER_WORT: Readonly<Record<WerArt, string>> = { du: "settable", fleet: "Fleet default", "claude-code": "Claude Code default" };
export const DU: Wer = { art: "du" };

// was ein Plan außer dem Baustein selbst braucht: wer eine Pflicht trägt (k15-entwurf-modell.ts#traegerVon), was Claude Code selbst lädt
// (nativVon; null = der Plan von „Nur Ordner“ ist noch nicht gelesen), welche Packs ohne Quelle sind und was der Plan anschaltet, dieser
// Start aber nicht liefert (lieferung.ausgelassen), je mit dem Grund in Worten
export interface WerPlan { traeger: ReadonlyMap<string, Baustein>; nativ: ReadonlySet<string> | null; ohneQuelle: ReadonlyMap<string, string>;
  fehlt: ReadonlyMap<string, string>; name: (b: Baustein) => string }
export const nativVon = (nurOrdner: readonly Baustein[]): Set<string> =>
  new Set(nurOrdner.filter((b) => b.rollenDefault !== "aus").map((b) => b.id));

// null: noch nicht zu sagen (der Plan von „Nur Ordner“ fehlt), dann zeigt die Zeile kein Kennzeichen
export function werBestimmt(b: Baustein, w: WerPlan): Wer | null {
  const an = b.zustand === "an";
  // an, aber die Tür dieses Starts liefert es nicht: hier schaltet niemand etwas, Spalte 3 zeigt keinen Schalter
  const fehlt = an ? w.fehlt.get(b.id) : undefined;
  if (fehlt !== undefined) return { art: "fleet", grund: `This start does not deliver it: ${fehlt}.`,
    herleitung: "on in the plan, but the door of this start does not deliver it (founding plan, lieferung.ausgelassen)" };
  if (b.grenze.art === "noetig" && an)
    return { art: "fleet", grund: b.grenze.grund, herleitung: b.grenze.gesperrt ? "required and locked: not even an equivalent function replaces it (session-blocks.ts, grenze)"
      : `required for this role (session-blocks.ts, grenze)${b.ersatzKandidaten.length ? `; replaceable only by a block with the same function: ${b.ersatzKandidaten.join(", ")}` : ""}` };
  const traegt = an ? w.traeger.get(b.id) : undefined;
  if (traegt) return { art: "fleet", grund: `It is part of “${w.name(traegt)}”, which is required; without it, that would not arrive at this start.`,
    herleitung: `${traegt.id} is part of it through enthaltenIn (founding plan)` };
  if (!b.harness.gueltig) return { art: "fleet", grund: b.harness.grund ?? "Does not apply to this agent.", herleitung: "applies to certain agents only (session-blocks.ts, harness)" };
  if (!b.schaltbar.ja) {
    if (!w.nativ) return null;
    // Claude Code lädt es selbst; ist es bei dieser Rolle aus, hat Fleet es beim Start abgeschaltet
    if (w.nativ.has(b.id) && an) return { art: "claude-code", grund: b.schaltbar.grund, herleitung: "Claude Code loads it itself; Fleet has no switch for it (session-blocks.ts, nichtSchaltbar)" };
    return { art: "fleet", grund: b.schaltbar.grund, herleitung: w.nativ.has(b.id) ? "Fleet switches it off when this role starts (session-blocks.ts, nichtSchaltbar)" : "the plan for this role does not let it be switched (founding plan, schaltbar)" };
  }
  const ohne = w.ohneQuelle.get(b.id);
  if (ohne !== undefined && !an) return { art: "fleet", grund: `The pack has no source: ${ohne}.`, herleitung: "the plan does not accept a pack without a source (founding plan, omitted)" };
  if (b.bedingung?.erfuellt === false && !an) return { art: "fleet", grund: `Only if: ${b.bedingung.grund}; that does not hold here.`, herleitung: "the plan rejects an unmet condition (session-blocks.ts, rollenDefault bedingt)" };
  return DU;
}

// EIN KENNZEICHEN JE ABSCHNITT (Runde 4, Owner Z60: „[Zitat entfernt]“; Auftrag: „[Zitat entfernt]“): was die
// meisten Zeilen eines Abschnitts tragen, steht einmal in seinem Kopf, bei Gleichstand das zuerst genannte; eine Zeile trägt ihr eigenes
// nur, wenn es davon abweicht, sonst steht es in ihrem Title (werTitel). null = keine Zeile sagt etwas
export function werDesAbschnitts(ws: readonly (Wer | null)[]): Wer | null {
  const da = ws.filter((w): w is Wer => w !== null);
  const zahl = (art: WerArt) => da.filter((w) => w.art === art).length;
  const art = da.map((w) => w.art).reduce<WerArt | null>((m, a) => m === null || zahl(a) > zahl(m) ? a : m, null);
  if (art === null) return null;
  if (art === "du") return DU;
  return { art, grund: `${zahl(art)} of ${da.length} rows in this section; a row that differs carries its own tag.`,
    herleitung: "the reason for each row is in its title" };
}
export const werTitel = (w: Wer): string => w.art === "du" ? `${WER_WORT.du}: you set it here` : `${WER_WORT[w.art]}: ${w.grund}`;

// was über Fleets Startzeile kommt, gilt für jede Session der Rolle; was Claude Code selbst mitbringt oder lädt, stellt man dort ein, wo der
// Satz es nennt (Konfig-Ordner, Repo, Plugin), nicht in Fleet
const JE_SESSION_NOCH_NICHT = "Not settable per session yet, Fleet sets it at start: ";
const IN_FLEET_NICHT = "Not settable in Fleet: ";
// ein Claude-Code-Schalter (`--tools`, `--strict-mcp-config` …) steht nur im Title; sichtbar bleibt, was er bewirkt (Prüfung Punkt 12)
// (auch „kein --tools“ bei der MAIN: der Wert daneben sagt es in Worten, „alle eingebauten“)
export const istSchalter = (weg: string): boolean => /(^|\s)--[a-z]/.test(weg);
// EINE ZEILE, DIE CLAUDE CODE MITBRINGT (Systemprompt, Werkzeuge, MCP …): was über die Startzeile kommt (ein Schalter, auch sein
// Fehlen), ist ein Fleet-Standard; was Claude Code selbst hineinschreibt oder aus seiner Konfiguration lädt, ein Claude-Code-Standard. Eine eigene
// Startzeile je Session gibt es noch nicht.
export function werBeiClaudeCode(z: { weg: string; satz: string; quelle: string }): Wer {
  return !istSchalter(z.weg)
    ? { art: "claude-code", grund: `${IN_FLEET_NICHT}${z.satz}`, herleitung: `${z.weg} (${z.quelle})` }
    : { art: "fleet", grund: `${JE_SESSION_NOCH_NICHT}${z.satz}`, herleitung: `Fleet’s start line: ${z.weg} (${z.quelle}); settable per session only with a start line of its own` };
}
// EIN TEIL VON „SYSTEMPROMPT UND WERKZEUGE“ (src/k15-anatomie.ts): wie bei werBeiClaudeCode legt ein Schalter der Startzeile (`--tools`,
// `--settings skillOverrides` …) den Fleet-Standard; was Claude Code mitbringt oder aus einem Ordner, Plugin oder Konto lädt, ist ein Claude-Code-Standard
export function werBeiTeil(t: { weg: string; satz: string }): Wer {
  return istSchalter(t.weg)
    ? { art: "fleet", grund: `${JE_SESSION_NOCH_NICHT}${t.satz}`, herleitung: `Fleet’s start line: ${t.weg}; settable per session only with a start line of its own` }
    : { art: "claude-code", grund: `${IN_FLEET_NICHT}${t.satz}`, herleitung: `${t.weg}: Claude Code loads it itself` };
}
