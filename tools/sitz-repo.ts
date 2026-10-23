// EIN REPO FÜR DIE SITZE EINER IMPORTIERTEN AUFGABE, ohne ihre früheren Läufe (server/sitz-repo.ts):
//
//   bun tools/sitz-repo.ts <ziel> --aufgabe <pfad der Datei im Repo> [--commit <rev>] [--quelle <repo>] [--in <blindes Haupt-Repo>]
//
// Mit --in wird das Ziel ein Worktree des blinden Haupt-Repos (fehlt es, wird es angelegt): dann startet ein echter claude dort ohne
// Vertrauensfrage, wenn der Owner das Haupt-Repo einmal vertraut hat. Auf diesem Rechner ist das ~/fleet-testinstanz-repo (Mängel 118).
// Kennt es Branches früherer Läufe (die Sitze committen dorthin), lehnt das Werkzeug ab; --alte-zweige-weg nimmt sie weg, wenn ihre Arbeit
// geerntet ist.
// Ohne --commit HEAD, ohne --quelle dieses Repo. Das Ziel muss fehlen oder leer sein; für eine Testinstanz liegt es in ihrem Verzeichnis
// (`$DIR/sitz-repo`), dann räumt `./testinstanz.sh down` es mit ab. Gedruckt wird das Ergebnis als JSON.
import { join, resolve } from "node:path";
import { sitzRepo } from "../server/sitz-repo";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const aufgabe = opt("--aufgabe"), commit = opt("--commit") ?? "HEAD", quelle = resolve(opt("--quelle") ?? join(import.meta.dir, ".."));
const haupt = opt("--in");
const at = args.indexOf("--alte-zweige-weg");
const raeumen = at >= 0 && args.splice(at, 1).length === 1;
const ziel = args[0];
if (!ziel || !aufgabe) { console.error("usage: bun tools/sitz-repo.ts <ziel> --aufgabe <pfad> [--commit <rev>] [--quelle <repo>] [--in <haupt> [--alte-zweige-weg]]"); process.exit(2); }
const r = sitzRepo(quelle, commit, resolve(ziel), aufgabe, haupt ? resolve(haupt) : null, raeumen);
if (typeof r === "string") { console.error(r); process.exit(1); }
console.log(JSON.stringify(r, null, 2));
