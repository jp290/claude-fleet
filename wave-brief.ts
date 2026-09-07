// The founding brief of a WAVE lane — n queue rows, one lane, one land (S3 of
// docs/queue-wellen-2026-09-06.md §5).
//
// Its own module for the reason clarify-prompt.ts and task-notes.ts are: these are BYTES A LANE
// EXECUTES, and bytes that decide what work happens must be readable and checkable without booting
// a server. Pure and deterministic — no clock, no git, no state — so the same rows always render
// the same brief and a check can assert the whole string.
//
// WHAT THIS BRIEF HAS TO CARRY that a single-row brief does not:
//   · the ORDER, fixed, because the rows are worked and committed in it;
//   · one commit per row, which is the ONLY thing that makes a red post-land audit attributable
//     across a wave by hand — the wave buys its saving by giving up the per-row bisect that n
//     separate lands would have handed the reader for free, and a per-row commit buys it back;
//   · ONE land for the whole lane, said in as many words, because every other lane this fleet
//     dispatches lands exactly the row it was founded on;
//   · the SELF-SPLIT door, because the surface that bundled these rows is a declaration and the
//     lane is the first party in a position to find out it did not reach.

export interface WaveBriefRow {
  id: string;
  text: string;
  /** the compiled brief, when the row has one — otherwise the raw request in `text` is the brief */
  brief: string | null;
  /** the owner-confirmed done-criterion, when the row carries one */
  criterion: string | null;
}

export interface WaveBriefInput {
  rows: readonly WaveBriefRow[];
  /** files at least two of these rows stand on — the evidence FOR bundling them, from the sensor */
  sharedFiles: readonly string[];
  klasse: "docs" | "code";
  /** `http://host:port` — the split door is quoted with the same base every other self route is */
  baseUrl: string;
}

const numbered = (row: WaveBriefRow, at: number, total: number): string => {
  const body = (row.brief ?? row.text).trim();
  const criterion = row.criterion?.trim();
  return `--- ZEILE ${at + 1} VON ${total} · ${row.id} ---

${body}${criterion ? `\n\nDONE-KRITERIUM DIESER ZEILE (vom Owner bestätigt): ${criterion}` : ""}`;
};

/**
 * The exact bytes a wave lane is founded on. `rows` are in the wave's fixed order, head first;
 * fewer than two rows is a caller error and throws rather than rendering a wave brief for a single
 * row — that lane gets the ordinary brief, and silently degrading here would hide which one it got.
 */
export function renderWaveBrief(input: WaveBriefInput): string {
  const { rows, sharedFiles, klasse, baseUrl } = input;
  if (rows.length < 2) throw new Error("a wave brief needs at least two rows");
  const ids = rows.map((r) => r.id);
  return `DIESE LANE TRÄGT EINE WELLE: ${rows.length} QUEUE-ZEILEN, EIN LAND.

Der Owner hat diese ${rows.length} Zeilen zusammengelegt, weil sie zu EINEM Program gehören und auf
einer gemeinsamen, BESTÄTIGTEN Datei-Fläche stehen. Gespart wird genau eine Sache: das Land-Gate
und der Post-Land-Audit laufen einmal statt ${rows.length}-mal. Das ist der ganze Grund — inhaltlich
sind es weiterhin ${rows.length} getrennte Aufträge, und du erledigst sie als solche.

  Reihenfolge (fest):  ${ids.join(" → ")}
  Klasse:              ${klasse}
  Gemeinsame Dateien:  ${sharedFiles.length ? sharedFiles.join(", ") : "— (keine, die zwei Zeilen teilen)"}

DREI REGELN, DIE NUR FÜR EINE WELLEN-LANE GELTEN:

1. EIN COMMIT JE ZEILE, in der Reihenfolge oben, und die Zeilen-Id steht im Subject. Ein rotes
   Stufe-2-Audit über eine Welle ist sonst von Hand nicht zuzuordnen: n getrennte Lands hätten dem
   Leser den Bisect geschenkt, diese Lane kauft ihn mit den Commits zurück.

2. EIN LAND FÜR DIE GANZE LANE. Lande nicht je Zeile und melde nicht je Zeile fertig — die
   ${rows.length} Queue-Zeilen gehen mit dem einen Land GEMEINSAM auf done. Ein Abbruch dieser Lane
   gibt alle ${rows.length} zurück, keine bleibt halb erledigt stehen.

3. REICHT DIE FLÄCHE NICHT, TEILE DICH SELBST. Die Fläche, auf der diese Welle gebildet wurde, ist
   eine Behauptung über den Baum, und du bist die erste Instanz, die sie prüfen kann. Stellst du
   fest, dass eine Zeile hier nicht hingehört — sie greift viel weiter, sie kollidiert mit einer
   anderen der Welle, oder sie ist erst nach dem Land einer anderen zu machen — dann gib GENAU DIESE
   Zeilen zurück, statt die Welle abzubrechen oder sie schlecht mitzumachen:

     curl -s -X POST ${baseUrl}/api/self/wave/split \\
       -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \\
       -d '{"ids":["<zeile>"],"reason":"<warum diese Zeile nicht in diese Welle gehört>"}'

   Die zurückgegebenen Zeilen gehen auf \`queued\` (mit deinem Grund in der note) und werden neu
   eingeplant; die verbleibenden landest du wie gehabt mit dieser Lane. Mindestens eine Zeile muss
   bei dir bleiben — willst du alle zurückgeben, ist das kein Split, sondern ein Abbruch, und der
   gehört in deinen Report.

${rows.map((row, at) => numbered(row, at, rows.length)).join("\n\n")}`;
}
