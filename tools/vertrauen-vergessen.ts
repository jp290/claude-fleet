// bun tools/vertrauen-vergessen.ts <folder> [<claude.json>] — remove the folder trust Fleet set for <folder> and everything below it from Claude
// Code's config (server/claude-vertrauen.ts#vergissOrdnerUnter). testinstanz.sh down/reap call it for the instance directory: a test instance with
// real seats runs claude under the owner's HOME, so the trust Fleet sets for its fixture folders lands in the owner's file.
import { homedir } from "node:os";
import { claudeJsonPfad, istSymlink, vergissOrdnerUnter } from "../server/claude-vertrauen";

const [wurzel, datei] = process.argv.slice(2);
if (!wurzel || wurzel === "/" || wurzel.split("/").filter(Boolean).length < 2) { console.error("usage: bun tools/vertrauen-vergessen.ts <folder> [<claude.json>]"); process.exit(2); }
if (istSymlink(wurzel)) { console.error(`refused: ${wurzel} is a symlink; name the folder itself, not a link to it`); process.exit(2); }
const n = await vergissOrdnerUnter(wurzel, datei ?? claudeJsonPfad(homedir()));
console.log(`trust entries removed: ${n}`);
