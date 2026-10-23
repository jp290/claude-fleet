// EIN REPO FÜR DIE SITZE OHNE FRÜHERE LÄUFE (Schritt 5, Lauf 2: das Repo der zweiten Instanz enthielt die Datei samt Lauf 1; der Prover las die
// früheren Befunde, und der Finder sah den Commit-Text von Lauf 1). Aus einem Commit wird ein frisches Repo mit genau einem Commit: sein Baum,
// darin die Aufgaben-Datei ohne `laeufe`, und ohne jede Datei, die einer dieser Läufe nennt (seine Beweis-Skripte). Keine Geschichte, keine
// anderen Refs: `git log --all` zeigt nur diesen einen Commit. Was sonst im Baum frühere Befunde erwähnt (eine Mängel-Zeile, ein Kommentar an
// einer Reparatur), bleibt, und der Bericht sagt das nicht weg.
// MIT EINEM HAUPT-REPO (`haupt`, Mängel 118): ein echter claude fragt in einem frischen Repo, ob er ihm vertraut, und Fleet beantwortet die Frage
// nie. Ein Worktree eines vertrauten Haupt-Repos fragt nicht (docs/testinstanz.md, gemessen 22.10.). Das Sitz-Repo wird deshalb ein Worktree auf
// einem eigenen Branch ohne Vorfahren (`sitz/…`) in einem blinden Haupt-Repo, das nur solche Branches kennt; eins mit anderen Refs oder einem
// Remote nimmt es nicht, denn dessen Geschichte stünde in `git log --all` jedes Sitzes. Sein `main` zeigt auf den jüngsten Stand: eine
// Board-Branch-Tür setzt einen neuen Branch auf den Stand des Haupt-Checkouts (server.ts#integrationBranch), und ein Branch ohne Commit
// ließ den Finder nicht entstehen. Die Sitze eines Laufs committen in dieses Repo (der
// Prover auf seinen Sitz-Branch, der Finder auf seinen Board-Branch): ein Sitz der nächsten Instanz sähe ihre Ergebnisse. Darum nimmt es nur ein
// Repo, in dem jeder Ref `main` oder ein Sitz-Branch mit einem einzigen Commit ist; `raeumen` nimmt die Branches beendeter Läufe vorher weg (nie einen, der
// noch in einem Worktree ausgecheckt ist), nachdem ihre Arbeit geerntet ist.
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface SitzRepo { ziel: string; commit: string; von: string; laeufe: number; entfernt: string[] }

// ohne geerbte GIT_*-Variablen: ein GIT_DIR der Umgebung lenkte init und commit in ein anderes Repo
const UMGEBUNG = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
const git = (cwd: string, ...args: string[]): string => gitMit(cwd, {}, ...args);
const gitMit = (cwd: string, env: Record<string, string>, ...args: string[]): string => {
  const r = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe", env: { ...UMGEBUNG, GIT_CONFIG_NOSYSTEM: "1", ...env } });
  if (r.exitCode !== 0) throw new Error(`git ${args[0]}: ${r.stderr.toString().trim().slice(0, 300)}`);
  return r.stdout.toString();
};

// die Vorlagen eines Pfads mit Platzhalter („beweise/<n>.sh“) als Muster; ein Platzhalter steht für einen Namen ohne „/“
export function beweisOrte(text: string): RegExp[] {
  const vorlagen = new Set(text.match(/[\w.-]+\/(?:[\w.-]*<[^<>\s/"]+>[\w.-]*\/?)+/g) ?? []);
  return [...vorlagen].map((v) => new RegExp(`^${v.split(/<[^<>]+>/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+")}$`));
}

export const SITZ_BRANCH = "refs/heads/sitz/";
// ob `haupt` ein blindes Haupt-Repo ist (oder noch keins ist und eins werden kann); ein Satz, wenn nicht
function blind(haupt: string, raeumen: boolean): string | null {
  if (!existsSync(haupt)) return null;
  // die Wurzel eines eigenen Repos: nicht ein Unterordner eines anderen und nicht ein Worktree, dessen Objekte woanders liegen
  let top: string, gemeinsam: string;
  try {
    top = git(haupt, "rev-parse", "--show-toplevel").trim();
    gemeinsam = git(haupt, "rev-parse", "--path-format=absolute", "--git-common-dir").trim();
  } catch { return `${haupt} ist kein git-Repo`; }
  if (realpathSync(top) !== realpathSync(haupt) || realpathSync(gemeinsam) !== realpathSync(join(haupt, ".git")))
    return `${haupt} ist nicht die Wurzel eines eigenen git-Repos`;
  if (git(haupt, "remote").trim()) return `${haupt} hat einen Remote — ein blindes Haupt-Repo kennt nur Sitz-Branches`;
  // was ein Sitz sehen könnte: ein Ref, der kein Sitz-Branch ist, oder ein Sitz-Branch, auf den jemand weiter committet hat
  git(haupt, "worktree", "prune");
  const refs = git(haupt, "for-each-ref", "--format=%(refname)").split("\n").filter(Boolean);
  const fremd = refs.filter((r) => !(r.startsWith(SITZ_BRANCH) || r === "refs/heads/main") || git(haupt, "rev-list", "--min-parents=1", "--count", r).trim() !== "0");
  if (!fremd.length) return null;
  if (!raeumen) return `${haupt} kennt ${fremd[0]}${fremd.length > 1 ? ` und ${fremd.length - 1} weitere` : ""} — ein blindes Haupt-Repo kennt nur main und Sitz-Branches `
    + `(${SITZ_BRANCH}…) mit je einem Commit; ist die Arbeit früherer Läufe geerntet, nimmt --alte-zweige-weg sie weg`;
  const ausgecheckt = new Set(git(haupt, "worktree", "list", "--porcelain").split("\n").flatMap((z) => z.startsWith("branch ") ? [z.slice(7)] : []));
  const noch = fremd.find((r) => ausgecheckt.has(r));
  if (noch) return `${noch} ist noch in einem Worktree ausgecheckt (eine laufende Instanz?) — erst sie abräumen`;
  // main mit Arbeit eines Laufs geht nicht weg: es zeigt gleich auf den neuen Stand
  for (const r of fremd) if (r !== "refs/heads/main") git(haupt, "update-ref", "-d", r);
  // ...und was nur sie erreichten, auch aus dem Objektspeicher: ein Sitz fände es sonst über git fsck
  git(haupt, "reflog", "expire", "--expire=now", "--all");
  git(haupt, "gc", "-q", "--prune=now");
  return null;
}

export function sitzRepo(quelle: string, commit: string, ziel: string, aufgabe: string, haupt: string | null = null, raeumen = false): SitzRepo | string {
  if (existsSync(ziel) && readdirSync(ziel).length) return `${ziel} ist nicht leer`;
  const nichtBlind = haupt ? blind(haupt, raeumen) : null;
  if (nichtBlind) return nichtBlind;
  let von: string;
  try { von = git(quelle, "rev-parse", "--verify", `${commit}^{commit}`).trim(); } catch (e) { return e instanceof Error ? e.message : String(e); }
  const dateien = git(quelle, "ls-tree", "-r", "-z", "--name-only", von).split("\0").filter(Boolean);
  if (!dateien.includes(aufgabe)) return `${aufgabe} steht nicht im Baum von ${von.slice(0, 9)}`;
  let o: unknown;
  try { o = JSON.parse(git(quelle, "show", `${von}:${aufgabe}`)); } catch { return `${aufgabe} ist kein lesbares JSON`; }
  if (!o || typeof o !== "object" || Array.isArray(o)) return `${aufgabe} ist keine Aufgaben-Datei`;
  const { laeufe, ...ohne } = o as Record<string, unknown>;
  const liste = Array.isArray(laeufe) ? laeufe : [];
  // was die Läufe nennen und dort liegt, wo die Datei selbst ihre Beweise hinlegt (eine Vorlage wie „beweise/<n>.sh“ in einem Brief): ein
  // Beleg nennt auch Quellcode („server.ts:123“), und der bleibt. Die Aufgaben-Datei selbst bleibt, nur ohne Läufe
  const text = JSON.stringify(liste);
  const orte = beweisOrte(JSON.stringify(ohne));
  const entfernt = dateien.filter((d) => d !== aufgabe && orte.some((re) => re.test(d)) && text.includes(d));
  if (haupt) {
    if (!existsSync(haupt)) git(dirname(haupt), "init", "-q", "-b", "main", haupt);
    if (existsSync(ziel)) rmSync(ziel, { recursive: true, force: true });
    git(haupt, "worktree", "add", "-q", "--orphan", "-b", `sitz/${von.slice(0, 9)}-${Date.now().toString(36)}`, ziel);
  } else mkdirSync(ziel, { recursive: true });
  // der Baum genau so, wie git ihn hat: über einen eigenen Index des Quell-Repos (sein eigener bleibt unberührt), nicht über `git archive`,
  // das export-ignore befolgt
  const index = join(tmpdir(), `sitz-repo-${process.pid}-${Date.now()}.index`);
  try {
    gitMit(quelle, { GIT_INDEX_FILE: index }, "read-tree", von);
    gitMit(quelle, { GIT_INDEX_FILE: index }, "checkout-index", "-a", "-f", `--prefix=${ziel}/`);
  } catch (e) { return e instanceof Error ? e.message : String(e); } finally { rmSync(index, { force: true }); }
  for (const d of entfernt) rmSync(join(ziel, d), { force: true });
  for (const d of new Set(entfernt.map((x) => dirname(x)))) {
    if (existsSync(join(ziel, d)) && !readdirSync(join(ziel, d)).length) rmSync(join(ziel, d), { recursive: true, force: true });
  }
  writeFileSync(join(ziel, aufgabe), `${JSON.stringify(ohne, null, 2)}\n`);
  const wer = ["-c", "user.name=Fleet", "-c", "user.email=fleet@localhost", "-c", "commit.gpgsign=false"];
  if (!haupt) git(ziel, "init", "-q", "-b", "main");
  // -f: was der Baum trägt, kommt hinein, auch wenn eine .gitignore es sonst ausließe
  git(ziel, "add", "-A", "-f");
  // ein neutraler Text: der Commit sagt, woraus er ist, nicht was frühere Läufe fanden
  git(ziel, ...wer, "commit", "-q", "-m", `Stand ${von.slice(0, 9)}`);
  const neu = git(ziel, "rev-parse", "HEAD").trim();
  // main des Haupt-Repos auf diesen Stand, samt seinem Checkout: das ist die Basis jedes Board-Branches, den ein Sitz dort anlegt
  if (haupt) {
    git(haupt, "reset", "-q", "--hard", neu);
    if (raeumen) { git(haupt, "reflog", "expire", "--expire=now", "--all"); git(haupt, "gc", "-q", "--prune=now"); }
  }
  // die Probe: ein Commit ohne Vorfahren, und keiner im ganzen Repo hat einen; die Datei ohne Läufe; der Baum ist der Commit ohne die Beweise
  const zahl = git(ziel, "rev-list", "--count", "HEAD").trim(), mitVorfahren = git(ziel, "rev-list", "--all", "--min-parents=1", "--count").trim();
  const nachher = JSON.parse(readFileSync(join(ziel, aufgabe), "utf8")) as Record<string, unknown>;
  const baum = git(ziel, "ls-tree", "-r", "-z", "--name-only", "HEAD").split("\0").filter(Boolean).sort();
  const soll = dateien.filter((d) => !entfernt.includes(d)).sort();
  if (zahl !== "1" || mitVorfahren !== "0" || "laeufe" in nachher || JSON.stringify(baum) !== JSON.stringify(soll)) return "die Probe des neuen Repos schlug fehl: sein Baum ist nicht der Commit ohne die Läufe";
  return { ziel, commit: neu, von, laeufe: liste.length, entfernt };
}
