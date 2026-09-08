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

/** The delivered block, or the empty string — which is what makes a no-hit dispatch byte-identical. */
export function renderNotesBlock(rows: readonly NoteRow[], readRoutesExist = NOTES_READ_ROUTES_EXIST): string {
  if (rows.length === 0) return "";
  const lines = [`Notizen auf deiner Flaeche (${rows.length}, Deckel ${NOTES_CAP_DEFAULT}):`];
  for (const row of rows) {
    const shown = row.sharedFiles.slice(0, 3).join(", ");
    const rest = row.sharedFiles.length - 3;
    lines.push(`- notiz ${row.id} · ${row.firstSentence} [${shown}${rest > 0 ? ` +${rest}` : ""}]`);
  }
  // Only when a lane could act on the id. Naming a route that 404s would be the founding brief
  // full of dead curls the exit-footer pin exists to prevent.
  if (readRoutesExist)
    lines.push("Volltext: `GET /api/self/notes` — melde je Notiz `POST /api/self/notes/<id>/verdict`");
  return `\n\n${lines.join("\n")}`;
}
