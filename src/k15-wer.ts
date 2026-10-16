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
export const WER_WORT: Readonly<Record<WerArt, string>> = { du: "änderbar", fleet: "Fleet-Standard", "claude-code": "Claude-Code-Standard" };
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
  if (fehlt !== undefined) return { art: "fleet", grund: `Dieser Start liefert es nicht: ${fehlt}.`,
    herleitung: "an im Plan, aber die Tür dieses Starts liefert es nicht (Gründungsplan, lieferung.ausgelassen)" };
  if (b.grenze.art === "noetig" && an)
    return { art: "fleet", grund: b.grenze.grund, herleitung: b.grenze.gesperrt ? "nötig und gesperrt: auch eine gleichwertige Funktion ersetzt es nicht (session-blocks.ts, grenze)"
      : `nötig für diese Rolle (session-blocks.ts, grenze)${b.ersatzKandidaten.length ? `; ersetzbar nur durch einen Baustein derselben Funktion: ${b.ersatzKandidaten.join(", ")}` : ""}` };
  const traegt = an ? w.traeger.get(b.id) : undefined;
  if (traegt) return { art: "fleet", grund: `Darin steckt „${w.name(traegt)}“, und das ist Pflicht; ohne dies käme es bei diesem Start nicht an.`,
    herleitung: `${traegt.id} steckt über enthaltenIn darin (Gründungsplan)` };
  if (!b.harness.gueltig) return { art: "fleet", grund: b.harness.grund ?? "Gilt nicht für diesen Agenten.", herleitung: "gilt nur für bestimmte Agenten (session-blocks.ts, harness)" };
  if (!b.schaltbar.ja) {
    if (!w.nativ) return null;
    // Claude Code lädt es selbst; ist es bei dieser Rolle aus, hat Fleet es beim Start abgeschaltet
    if (w.nativ.has(b.id) && an) return { art: "claude-code", grund: b.schaltbar.grund, herleitung: "Claude Code lädt es selbst; Fleet hat dafür keinen Schalter (session-blocks.ts, nichtSchaltbar)" };
    return { art: "fleet", grund: b.schaltbar.grund, herleitung: w.nativ.has(b.id) ? "Fleet schaltet es beim Start dieser Rolle ab (session-blocks.ts, nichtSchaltbar)" : "der Plan dieser Rolle lässt es nicht schalten (Gründungsplan, schaltbar)" };
  }
  const ohne = w.ohneQuelle.get(b.id);
  if (ohne !== undefined && !an) return { art: "fleet", grund: `Die Quelle des Packs fehlt: ${ohne}.`, herleitung: "der Plan nimmt einen Pack ohne Quelle nicht an (Gründungsplan, omitted)" };
  if (b.bedingung?.erfuellt === false && !an) return { art: "fleet", grund: `Nur wenn: ${b.bedingung.grund}; das trifft hier nicht zu.`, herleitung: "eine unerfüllte Bedingung lehnt der Plan ab (session-blocks.ts, rollenDefault bedingt)" };
  return DU;
}

// was über Fleets Startzeile kommt, gilt für jede Session der Rolle; was Claude Code selbst mitbringt oder lädt, stellt man dort ein, wo der
// Satz es nennt (Konfig-Ordner, Repo, Plugin), nicht in Fleet
const JE_SESSION_NOCH_NICHT = "Noch nicht je Session einstellbar, Fleet setzt es beim Start: ";
const IN_FLEET_NICHT = "Nicht in Fleet einstellbar: ";
// ein Claude-Code-Schalter (`--tools`, `--strict-mcp-config` …) steht nur im Title; sichtbar bleibt, was er bewirkt (Prüfung Punkt 12)
// (auch „kein --tools“ bei der MAIN: der Wert daneben sagt es in Worten, „alle eingebauten“)
export const istSchalter = (weg: string): boolean => /(^|\s)--[a-z]/.test(weg);
// EINE ZEILE, DIE CLAUDE CODE MITBRINGT (Systemprompt, Werkzeuge, MCP …): was über die Startzeile kommt (ein Schalter, auch sein
// Fehlen), ist ein Fleet-Standard; was Claude Code selbst hineinschreibt oder aus seiner Konfiguration lädt, ein Claude-Code-Standard. Eine eigene
// Startzeile je Session gibt es noch nicht.
export function werBeiClaudeCode(z: { weg: string; satz: string; quelle: string }): Wer {
  return !istSchalter(z.weg)
    ? { art: "claude-code", grund: `${IN_FLEET_NICHT}${z.satz}`, herleitung: `${z.weg} (${z.quelle})` }
    : { art: "fleet", grund: `${JE_SESSION_NOCH_NICHT}${z.satz}`, herleitung: `Fleets Startzeile: ${z.weg} (${z.quelle}); je Session einstellbar erst mit einer eigenen Startzeile` };
}
// EIN TEIL VON „SYSTEMPROMPT UND WERKZEUGE“ (src/k15-anatomie.ts): wie bei werBeiClaudeCode legt ein Schalter der Startzeile (`--tools`,
// `--settings skillOverrides` …) den Fleet-Standard; was Claude Code mitbringt oder aus einem Ordner, Plugin oder Konto lädt, ist ein Claude-Code-Standard
export function werBeiTeil(t: { weg: string; satz: string }): Wer {
  return istSchalter(t.weg)
    ? { art: "fleet", grund: `${JE_SESSION_NOCH_NICHT}${t.satz}`, herleitung: `Fleets Startzeile: ${t.weg}; je Session einstellbar erst mit einer eigenen Startzeile` }
    : { art: "claude-code", grund: `${IN_FLEET_NICHT}${t.satz}`, herleitung: `${t.weg}: Claude Code lädt es selbst` };
}
