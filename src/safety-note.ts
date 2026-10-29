// A STOPPED ANSWER, NAMED (brief 2026-10-29). The model's safeguards can stop a response, and
// Claude Code then switches to another model — it writes both as its own system lines (measured
// 2026-10-29, Claude Code 2026-10-29 build, one JSON object per line):
//   {"type":"system","subtype":"informational","level":"notice",
//    "content":"Opus 5.5's safeguards stopped the response above · continuing once with that noted"}
//   {"type":"system","subtype":"model_refusal_fallback","level":"warning",
//    "content":"Opus 5.5's safeguards flagged this session. … Opus 4.8 is answering instead, or you
//               can edit and retry with Opus 5.5. …\n\nDetails: `[cyber]`„[Zitat entfernt]“
// 
// 
// words and the measured forms — both sides of the wire detect with the same function, so what the
// server lets through is exactly what the chat can name.
export interface SafetyNote { summary: string; advice: string; raw: string }

// what the owner can do, in one sentence — the same for both forms
export const SAFETY_ADVICE =
  "Rephrase and send again, give this text to a session on another model, or take it back into the composer (Esc).";

// the two measured openings; the model name stands before "'s safeguards", ends at the line, the
// "·" separator or a colon (a quote after a colon is not a model's name) — src/modell-verlauf.ts
// reads the same event's structured fields for the model history; reuse what fits: the fields name
// the models when Claude Code sends them
const STOPPED_RE = /^([^\n·:]+?)'s safeguards stopped the response/;
const FLAGGED_RE = /^([^\n·:]+?)'s safeguards flagged this session/;
const INSTEAD_RE = /([^\n·:]+?) is answering instead/;
// the fallback model is the SUBJECT of its sentence: "… flagged this session. Opus 4.8 is answering
// instead" — what stands after the last sentence end before the verb
function insteadModel(raw: string): string | null {
  const said = INSTEAD_RE.exec(raw)?.[1];
  if (!said) return null;
  return said.split(/[.;!] /).pop()?.trim() || null;
}

const word = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

// The note a system line carries, or null when the line is neither measured form. `content` is the
// line's own text; `originalModel`/`fallbackModel` (model_refusal_fallback's fields) name the
// models when the content leaves them out.
export function safetySystemNote(o: { subtype?: unknown; content?: unknown; originalModel?: unknown; fallbackModel?: unknown }): SafetyNote | null {
  const raw = word(o.content);
  if (raw === null) return null;
  const stopped = STOPPED_RE.exec(raw);
  const flagged = FLAGGED_RE.exec(raw);
  if (!stopped && !flagged) return null;
  if (stopped) {
    const model = word(o.originalModel) ?? stopped[1] ?? null;
    return {
      summary: `${model ?? "The model"}'s safeguards stopped the answer — trying once more`,
      advice: SAFETY_ADVICE, raw,
    };
  }
  const model = word(o.originalModel) ?? flagged![1] ?? null;
  const fallback = word(o.fallbackModel) ?? insteadModel(raw);
  return {
    summary: `${model ?? "The model"}'s safeguards flagged this session — ${fallback ?? "another model"} is answering instead`,
    advice: SAFETY_ADVICE, raw,
  };
}

// Claude Code ALSO writes a user line of its own, addressed to the model (measured 2026-10-29):
// "Your response above was stopped by a safety classifier …". It is not the owner's words, and the
// system line's quiet line already names the event — viewEntry keeps it out of the chat entirely.
export const SAFETY_CLASSIFIER_LEAD = "Your response above was stopped by a safety classifier";
export function safetyClassifierOwn(text: string): boolean {
  return text.startsWith(SAFETY_CLASSIFIER_LEAD);
}
