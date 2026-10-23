// WELCHES MODELL EINEM SITZ WIRKLICH ANTWORTETE, für einen Lauf, den jemand von Hand in die Aufgaben-Datei schreibt (laeufe[].sitze[].modelle,
// src/lauf-bericht.ts); das Laufbuch einer Fleet schreibt es beim Schließen jeder Belegung selbst (server.ts, laufZu):
//
//   bun tools/modell-verlauf.ts <transkript.jsonl> [<weiteres, etwa einer Nachfolgerin> …]
//
// Das Transkript liegt unter ~/.claude/projects/<cwd mit „-“>/<sessionId>.jsonl. Gedruckt wird die Liste als JSON.
import { modellVerlauf, type ModellAbschnitt } from "../src/modell-verlauf";

const dateien = process.argv.slice(2);
if (!dateien.length) { console.error("usage: bun tools/modell-verlauf.ts <transkript.jsonl> […]"); process.exit(2); }
const out: ModellAbschnitt[] = [];
for (const d of dateien) out.push(...modellVerlauf(await Bun.file(d).text()));
console.log(JSON.stringify(out, null, 2));
