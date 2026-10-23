// WELCHES MODELL WIRKLICH GEANTWORTET HAT (Schritt 5, Lauf 2: Claude Code stellte den Beweiser nach einer Meldung seiner Sicherung um
// 02:14:42Z von Opus 5.5 auf Opus 4.8 um, der größte Teil seiner Aufrufe kam von Opus 4.8, und die Datei sagte „Opus 5.5“). Aus dem
// Transkript einer Claude-Code-Session: je Abschnitt das Modell, ab wann es antwortete, mit wie vielen Aufrufen und warum es wechselte.
// Gelesen wird, was Claude Code selbst schreibt: `message.model` jeder Antwort und die Zeile `system/model_refusal_fallback` (Ursprungs- und
// Ersatzmodell, Kategorie). Ein Subagent (isSidechain) ist nicht der Sitz; `<synthetic>` ist keine Antwort eines Modells. Kein DOM, keine Importe.
export interface ModellAbschnitt { modell: string; ab: string; aufrufe: number; grund: string | null }

const obj = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
const str = (v: unknown): string | null => typeof v === "string" && v ? v : null;

export function modellVerlauf(jsonl: string): ModellAbschnitt[] {
  const out: ModellAbschnitt[] = [];
  const aufrufe: Set<string>[] = [];
  let wechsel: { ab: string; grund: string } | null = null;
  for (const zeile of jsonl.split("\n")) {
    if (!zeile.trim()) continue;
    let o: Record<string, unknown> | null;
    try { o = obj(JSON.parse(zeile)); } catch { continue; }
    if (!o || o.isSidechain === true) continue;
    const zeit = str(o.timestamp);
    if (o.type === "system" && o.subtype === "model_refusal_fallback" && zeit) {
      const von = str(o.originalModel) ?? "?", nach = str(o.fallbackModel) ?? "?", art = str(o.apiRefusalCategory);
      wechsel = { ab: zeit, grund: `Claude Code stellte nach einer Meldung seiner Sicherung${art ? ` („${art}“)` : ""} von ${von} auf ${nach} um (model_refusal_fallback)` };
      continue;
    }
    const m = o.type === "assistant" ? obj(o.message) : null;
    const modell = str(m?.model);
    if (!modell || modell === "<synthetic>" || !zeit) continue;
    const letzter = out.at(-1);
    if (letzter?.modell !== modell) {
      out.push({ modell, ab: wechsel?.ab ?? zeit, aufrufe: 0, grund: letzter ? wechsel?.grund ?? null : null });
      aufrufe.push(new Set());
      wechsel = null;
    }
    // ein Aufruf schreibt je Inhaltsblock eine Zeile mit derselben requestId
    aufrufe.at(-1)!.add(str(o.requestId) ?? str(m?.id) ?? zeit);
  }
  return out.map((a, i) => ({ ...a, aufrufe: aufrufe[i]!.size }));
}

// was ein Lauf-Bericht davon annimmt (src/lauf-bericht.ts): ein Abschnitt mit Modell, Zeitpunkt und einer Zahl
export function modellAbschnittAus(v: unknown): ModellAbschnitt | null {
  const o = obj(v);
  const modell = str(o?.modell), ab = str(o?.ab), n = o?.aufrufe;
  if (!o || !modell || !ab || !Number.isFinite(Date.parse(ab)) || typeof n !== "number" || !Number.isInteger(n) || n < 0) return null;
  const grund = o.grund === null || o.grund === undefined ? null : str(o.grund);
  if (o.grund !== null && o.grund !== undefined && !grund) return null;
  return { modell, ab, aufrufe: n, grund };
}
