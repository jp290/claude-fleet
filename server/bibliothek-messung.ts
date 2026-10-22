// Ob Claude-Sitze Fleets Bibliothek aufrufen, gemessen an ihren Transkripten (server/sitz-wissen.ts#skillAufrufe):
// je Transkript die angebotenen und die aufgerufenen Skills aus Fleets Register.
//
//   bun server/bibliothek-messung.ts <transkript.jsonl | ordner> ...
//
// Ein Ordner wird flach gelesen (ein Projektordner unter ~/.claude/projects). Ausgabe: eine Zeile je Transkript, dem
// Fleets Bibliothek angeboten wurde, dann die Summe. Ein Transkript ohne Angebot zählt nicht mit.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { skillAufrufe } from "./sitz-wissen";

const ids = (JSON.parse(readFileSync(join(import.meta.dir, "../.fleet/context-packs.json"), "utf8")) as { id: string }[]).map((p) => p.id);
const files = process.argv.slice(2).flatMap((arg) => statSync(arg).isDirectory()
  ? readdirSync(arg).filter((name) => name.endsWith(".jsonl")).map((name) => join(arg, name)) : [arg]);
let sitze = 0, mitAufruf = 0, aufrufe = 0;
for (const file of files) {
  const r = skillAufrufe(readFileSync(file, "utf8"), ids);
  if (!r.angeboten.length) continue;
  sitze++; aufrufe += r.aufgerufen.length; if (r.aufgerufen.length) mitAufruf++;
  console.log(`${file}\tangeboten ${r.angeboten.join(",")}\taufgerufen ${r.aufgerufen.join(",") || "-"}${r.kaputt ? `\t${r.kaputt} kaputte Zeilen` : ""}`);
}
console.log(`${sitze} Transkripte mit Bibliothek, ${mitAufruf} davon mit mindestens einem Aufruf, ${aufrufe} Aufrufe`);
