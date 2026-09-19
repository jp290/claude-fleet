// THE precedence rule for "which model is running" — ONE place, three readers, this order:
// the session FILE (the newest request, measured per chat-poll) beats the pane FOOTER (paneModel,
// the 30-s capture tick and a push's read-back) beats the slot RECORD (stale the moment someone
// types /model in the pane). The composer applies it; /api/sessions serves the footer and the
// record as two source-named facts and never merges them (docs/harness-adapter.md describes the
// rule and why). "" = nothing names one; the caller shows its honest default. The footer names no
// effort, so effort keeps its two-reader rule: file > record.

export function runningEffort(record: string | null | undefined, observed: string | null | undefined): string {
  return observed || record || "";
}

// the higher reader wins; one exception: Claude writes message.model WITHOUT the window suffix the
// record carries ("claude-opus-5" for a slot pinned to "claude-opus-5[1m]"), so a higher reader
// naming the record's model minus its [suffix] is the SAME model, and the record keeps its more
// exact id — otherwise the name would drop the 1M window it really has
const base = (id: string) => id.replace(/\[[^\]]*\]$/, "");

export function runningModel(record: string | null | undefined, observed: string | null | undefined, footer?: string | null | undefined): string {
  const top = observed || footer;
  if (!top) return record || "";
  if (!record || base(top) !== base(record)) return top;
  return record;
}
