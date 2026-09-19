// Which value the composer's switches show as the session's own: the one its FILE says the newest
// request ran on (Pane.observedModel / observedEffort, read server-side from the transcript) wins
// over the slot record, and the record is only the fallback (eighteenth cut: slot 1's record said
// "max" while its file said "high" — an /effort typed in the pane never reaches the record, so
// the record is the stale half). "" = neither names one; the caller shows its honest default.

export function runningEffort(record: string | null | undefined, observed: string | null | undefined): string {
  return observed || record || "";
}

// the same order for the model, with one exception: Claude writes message.model WITHOUT the
// window suffix the record carries ("claude-opus-5" for a slot pinned to "claude-opus-5[1m]"),
// so a file naming the record's model minus its [suffix] is the SAME model, and the record keeps
// its more exact id — otherwise the name would drop the 1M window it really has
const base = (id: string) => id.replace(/\[[^\]]*\]$/, "");

export function runningModel(record: string | null | undefined, observed: string | null | undefined): string {
  if (observed && (!record || base(observed) !== base(record))) return observed;
  return record || observed || "";
}
