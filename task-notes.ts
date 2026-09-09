// Deterministic, read-only join: the pending `notiz` rows standing on a task's file surface.
//
// docs/notizen-verarbeitung-2026-09-06.md §3 N1 is the measurement this implements.
//
// Pure like task-waves.ts: every fact enters through the arguments, nothing is read from disk or
// from a server global, and the result describes a block a caller may render. That is what makes
// the ranking testable without a running fleet — and the ranking is the whole product here, since
// the raw intersection is useless: measured over 39 open tasks against 61 notes with a surface,
// the median task shares a file with 42 notes, and with 5 once the hub files are cut out.
export const NOTE_HUB_FILES = ["server.ts", "e2e/pins.ts", "AGENTS.md", "CLAUDE.md"] as const;

// The cap is a byte budget, not a taste: a rendered line costs ~280–460 B (id + first sentence),
// so five lines are the measured +1.4 KB median / +2.3 KB p90 on a 4.5–9.8 KB founding prompt.
export const NOTES_CAP_DEFAULT = 5;
// The first sentence is the whole point of the line — a note's median text is 1 397 B and its
// median first sentence 267 B, so this bound clips the p90 tail rather than the normal case.
export const NOTES_SENTENCE_MAX = 300;
// Whether a lane can DO anything with an id it is shown. TRUE since N2 built both doors:
// `GET /api/self/notes` hands a lane the full text of exactly the ids its own receipt names, and
// `POST /api/self/notes/:id/verdict` takes its report on them. A feature test rather than a date —
// the closing sentence appears when the routes do, and never one deploy early. Set it back to
// `false` and the block loses its last line without any other change, which is what the flag is for.
export const NOTES_READ_ROUTES_EXIST = true;

export interface NoteTaskInput {
  id: string;
  repo?: string | null;
  files?: readonly string[];
  cluster?: { prozess: string };
}

export interface NoteInput extends NoteTaskInput {
  kind: string;
  status: string;
  created: number;
  text: string;
}

export interface NoteRow {
  id: string;
  firstSentence: string;
  sharedFiles: string[];
  sameCluster: boolean;
  // N3: the rows of THIS lane that pinned the note, in the lane's own row order. Absent on a
  // surface-join hit, and that absence is the whole distinction the block renders — "the join found
  // this on your files" and "someone chose this for line X" are two different instructions.
  taskIds?: string[];
}

export interface NotesForTaskOptions {
  cap?: number;
  // The dispatcher default, in the caller's own spelling. A row carrying no repo means THIS one —
  // the same `task.repo || dispatchRepo` resolution projectTaskWaves applies, and for the same
  // reason: two rows that both mean "the default" must join, and neither may join a named repo.
  dispatchRepo?: string | null;
}

/** The note's first sentence, on ONE line — a block line per note is the format's contract. */
export function noteFirstSentence(text: string, max = NOTES_SENTENCE_MAX): string {
  const end = text.search(/[.!?](\s|$)/);
  const sentence = end >= 0 ? text.slice(0, end + 1) : text;
  // Collapse AFTER the split, never before: a newline is the whitespace that ends a sentence in a
  // queue note as often as a space is, and normalizing first would hide that boundary.
  return sentence.replace(/\s+/g, " ").trim().slice(0, max);
}

const resolveRepo = (repo: string | null | undefined, fallback: string | null | undefined): string =>
  repo?.trim() || fallback?.trim() || "";

/**
 * The pending notes standing on this task's surface, best first and capped.
 *
 * Rank: same cluster process first, then the number of shared non-hub files descending, then the
 * newer note, then the id. The last one exists so the order is TOTAL — two notes that tie on
 * everything else must not depend on the order the caller happened to hand them over.
 */
export function notesForTask(
  auftrag: NoteTaskInput,
  notizen: readonly NoteInput[],
  opts?: NotesForTaskOptions,
): NoteRow[] {
  const cap = Number.isFinite(opts?.cap) ? Math.max(0, Math.floor(opts!.cap!)) : NOTES_CAP_DEFAULT;
  const taskRepo = resolveRepo(auftrag.repo, opts?.dispatchRepo);
  const hubs = new Set<string>(NOTE_HUB_FILES);
  // Absence, never an empty surface: a task whose files are unknown shares nothing with anything,
  // and a repo nobody could name must not join every unrepo'd row on the queue.
  const surface = new Set((auftrag.files ?? []).filter((path) => !hubs.has(path)));
  if (!taskRepo || surface.size === 0 || cap === 0) return [];

  const scored: { row: NoteRow; created: number }[] = [];
  for (const notiz of notizen) {
    if (notiz.kind !== "notiz" || notiz.status !== "pending") continue;
    if (notiz.id === auftrag.id) continue;
    if (resolveRepo(notiz.repo, opts?.dispatchRepo) !== taskRepo) continue;
    const sharedFiles = [...new Set(notiz.files ?? [])].filter((path) => surface.has(path)).sort();
    if (sharedFiles.length === 0) continue;
    // Absence is not sameness: a note or a task without a cluster is UNKNOWN, and pairing two
    // unknowns as "same process" would promote exactly the rows nothing is known about.
    const sameCluster = !!auftrag.cluster && !!notiz.cluster
      && auftrag.cluster.prozess === notiz.cluster.prozess;
    scored.push({ created: notiz.created, row: { id: notiz.id, sharedFiles, sameCluster,
      firstSentence: noteFirstSentence(notiz.text) } });
  }
  scored.sort((a, b) =>
    Number(b.row.sameCluster) - Number(a.row.sameCluster)
    || b.row.sharedFiles.length - a.row.sharedFiles.length
    || b.created - a.created
    || (a.row.id < b.row.id ? -1 : a.row.id > b.row.id ? 1 : 0));
  return scored.slice(0, cap).map((entry) => entry.row);
}

// --- N3: THE SOURCES A LANE ACTUALLY RECEIVES -------------------------------------------------
// Two populations, and keeping them apart is the point of this whole module:
//   · EXPLICIT — a `notiz` the owner (or a bound Program-MAIN) PINNED to one of this lane's rows.
//     It is a source under a named task, it is delivered whatever the file surfaces say, and the
//     preview cap may never make it unreachable: the cap bounds how many get a rendered sentence,
//     the receipt carries every one of them, and `GET /api/self/notes` serves their full text.
//   · JOIN — a pending note that merely shares a non-hub file with this lane's surface. Exactly
//     what N1 delivered, ranked by notesForTask, and it is the population the cap actually bounds:
//     an un-previewed coincidence was never chosen by anybody and delivering it would be noise.
// A note that is BOTH is explicit: someone chose it, and a coincidence does not un-choose it.
//
// ABSENCE STAYS UNKNOWN. A pin whose id no readable `notiz` of this repo answers is reported in
// `unknown` and never silently dropped — "the source you named is not resolvable here" and "you
// were given fewer sources" are different facts, and only the first is true.
export interface LaneNoteRow {
  id: string;
  /** the note ids this row pins, in the order they were pinned */
  noteIds: readonly string[];
}
export interface LaneNoteSources {
  /** every source this lane may READ — all explicit pins plus the join hits that fit the cap */
  reachable: NoteRow[];
  /** the subset that gets a preview line; `reachable` minus this is named but not previewed */
  shown: NoteRow[];
  /** explicit pins beyond the preview cap — named as bare ids, reachable through the route */
  overflow: NoteRow[];
  /** pinned ids no readable `notiz` of this repo answers */
  unknown: string[];
}

/**
 * The sources of one lane, from its rows' pins and its own file surface.
 *
 * `auftrag` is the JOIN surface (for a wave: the union its head carries), `rows` are the lane's
 * rows head first with their current pins, and `notizen` is the candidate population.
 */
export function laneNoteSources(
  auftrag: NoteTaskInput,
  rows: readonly LaneNoteRow[],
  notizen: readonly NoteInput[],
  opts?: NotesForTaskOptions,
): LaneNoteSources {
  const cap = Number.isFinite(opts?.cap) ? Math.max(0, Math.floor(opts!.cap!)) : NOTES_CAP_DEFAULT;
  const taskRepo = resolveRepo(auftrag.repo, opts?.dispatchRepo);
  const hubs = new Set<string>(NOTE_HUB_FILES);
  const surface = new Set((auftrag.files ?? []).filter((path) => !hubs.has(path)));
  const byId = new Map(notizen.map((n) => [n.id, n]));

  const explicit: NoteRow[] = [];
  const seen = new Map<string, NoteRow>();
  const unknown: string[] = [];
  for (const row of rows) {
    for (const noteId of row.noteIds) {
      const already = seen.get(noteId);
      // ONE full text, however many rows named it — a wave that pinned the same source twice
      // receives it once, carrying both row ids. Duplicating the sentence would spend the byte
      // budget on the fact that two rows agree.
      if (already) { if (!already.taskIds!.includes(row.id)) already.taskIds!.push(row.id); continue; }
      const notiz = byId.get(noteId);
      // A pin resolves against KIND and REPO, never against status: a source stays a source after
      // it has been judged, and a repo nobody could name must not reach across repositories.
      // Status is delivered as data by the read route — it is not this join's business.
      if (!notiz || notiz.kind !== "notiz"
        || !taskRepo || resolveRepo(notiz.repo, opts?.dispatchRepo) !== taskRepo) {
        if (!unknown.includes(noteId)) unknown.push(noteId);
        continue;
      }
      const sharedFiles = [...new Set(notiz.files ?? [])].filter((path) => surface.has(path)).sort();
      const sameCluster = !!auftrag.cluster && !!notiz.cluster
        && auftrag.cluster.prozess === notiz.cluster.prozess;
      const made: NoteRow = { id: noteId, sharedFiles, sameCluster,
        firstSentence: noteFirstSentence(notiz.text), taskIds: [row.id] };
      seen.set(noteId, made);
      explicit.push(made);
    }
  }
  // the join runs over the SAME candidates and is then stripped of everything already chosen
  const joined = notesForTask(auftrag, notizen, opts).filter((r) => !seen.has(r.id));
  const shown = [...explicit.slice(0, cap), ...joined.slice(0, Math.max(0, cap - explicit.length))];
  const overflow = explicit.slice(cap);
  return { reachable: [...explicit, ...shown.filter((r) => !r.taskIds)], shown, overflow, unknown };
}

/** The delivered block, or the empty string — which is what makes a no-hit dispatch byte-identical. */
export function renderNotesBlock(rows: readonly NoteRow[], readRoutesExist = NOTES_READ_ROUTES_EXIST,
  overflow: readonly NoteRow[] = []): string {
  if (rows.length === 0 && overflow.length === 0) return "";
  const lines = [`Notizen auf deiner Flaeche (${rows.length}, Deckel ${NOTES_CAP_DEFAULT}):`];
  for (const row of rows) {
    const shown = row.sharedFiles.slice(0, 3).join(", ");
    const rest = row.sharedFiles.length - 3;
    // THE PIN IS SAID FIRST, before the sentence, because it is the instruction and the sentence is
    // only the identification: "zu <zeile>" is what turns a coincidence into a source under a task.
    const pinned = row.taskIds?.length ? `zu ${row.taskIds.join(", ")} · ` : "";
    lines.push(`- notiz ${row.id} · ${pinned}${row.firstSentence} [${shown}${rest > 0 ? ` +${rest}` : ""}]`);
  }
  // THE CAP BOUNDS THE PREVIEW, NEVER THE REACH. An explicit source past the cap is still delivered
  // and still readable in full through the route — it just does not spend a sentence here. Dropping
  // it instead would let a byte budget silently un-assign work the owner assigned.
  if (overflow.length > 0)
    lines.push(`+ ${overflow.length} weitere angeheftete Quelle${overflow.length === 1 ? "" : "n"}`
      + ` (Volltext ueber die Route, nicht gekuerzt): `
      + overflow.map((row) => `${row.id} zu ${(row.taskIds ?? []).join(", ")}`).join(" · "));
  // Only when a lane could act on the id. Naming a route that 404s would be the founding brief
  // full of dead curls the exit-footer pin exists to prevent.
  if (readRoutesExist) {
    lines.push("Volltext: `GET /api/self/notes` — melde je Notiz `POST /api/self/notes/<id>/verdict`");
    // …and the second sentence ONLY when a pin exists, because `taskId` is meaningless without one:
    // a lane whose notes are all surface hits reports globally, exactly as before N3, and its bytes
    // are unchanged.
    if ([...rows, ...overflow].some((row) => row.taskIds?.length))
      lines.push("Eine ANGEHEFTETE Quelle wird je Aufgabe beurteilt:"
        + " `{\"taskId\":\"<zeile>\",\"verdict\":\"erledigt|widerlegt|offen\",\"text\":\"<ein Satz>\"}`."
        + " Wirksam wird ein `erledigt` erst mit dem Land GENAU DIESER Aufgabe.");
  }
  return `\n\n${lines.join("\n")}`;
}
