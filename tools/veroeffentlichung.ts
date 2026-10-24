#!/usr/bin/env bun
// EINE BEREINIGTE KOPIE VON FLEETS GESCHICHTE, die der Owner ansehen kann, bevor er veröffentlicht. Nichts verlässt die Maschine:
// ein frischer Mirror-Klon ohne Remote, ein Geheimnis-Scan über die ganze Geschichte, git filter-repo mit --replace-text und
// --replace-message aus der Bindung (~/.config/claude-fleet/namen.json, server/bindung.ts), derselbe Scan danach, ein Bericht.
//
//   bun tools/veroeffentlichung.ts <ziel> [--quelle <repo>] [--weiter]
//
// <ziel>     ein neuer Ordner außerhalb von Fleets Checkout und seinen Worktrees; der Klon liegt in <ziel>/mirror.git
// --quelle   das Repo, das geklont wird (Default: der Haupt-Checkout dieses Repos); es wird nur gelesen
// --weiter   auch dann umschreiben, wenn der Scan vorher ein bekanntes Geheimnis oder einen privaten Schlüssel findet
// Ergebnis: <ziel>/bericht.md und <ziel>/bericht.json. Kein Geheimnis steht darin, nur Art, Ort und ein Hash-Präfix.
// Exit: 0 fertig · 2 angehalten vor dem Umschreiben (Geheimnis gefunden) · 1 Fehler
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { BINDUNG_DIR } from "../server/bindung";
import { ersetzungsDatei, funde, GEHEIM_ARTEN, geheimWerte, HALT_ARTEN, pfadArt, scanSetup, type Ersetzung, type ScanSetup } from "../server/veroeffentlichung";

const args = process.argv.slice(2);
const opt = (name: string): string | null => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] ?? null; };
const zielArg = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--quelle");
if (!zielArg) { console.error("usage: bun tools/veroeffentlichung.ts <ziel> [--quelle <repo>] [--weiter]"); process.exit(1); }

const run = (cmd: string[], cwd?: string): string => {
  const r = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
  if (r.exitCode !== 0) throw new Error(`${cmd.slice(0, 3).join(" ")} … exit ${r.exitCode}: ${r.stderr.toString().trim().slice(-400)}`);
  return r.stdout.toString();
};
const tilde = (p: string): string => p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
const lies = (p: string): string | null => { try { return readFileSync(p, "utf8"); } catch { return null; } };

const quelle = realpathSync(opt("--quelle") ?? dirname(run(["git", "-C", import.meta.dir, "rev-parse", "--path-format=absolute", "--git-common-dir"]).trim()));
const ziel = resolve(zielArg);
for (const verboten of [quelle, `${quelle}.worktrees`])
  if (ziel === verboten || ziel.startsWith(`${verboten}/`)) { console.error(`refused: ${ziel} liegt in ${verboten}`); process.exit(1); }
const mirror = join(ziel, "mirror.git");
if (existsSync(mirror)) { console.error(`refused: ${mirror} gibt es schon — der Lauf braucht einen frischen Klon`); process.exit(1); }
const filterRepo = ["git-filter-repo", "/opt/homebrew/bin/git-filter-repo"].find((c) => Bun.which(c) || existsSync(c));
if (!filterRepo) { console.error("refused: git-filter-repo nicht gefunden"); process.exit(1); }

// DIE BINDUNG: was ersetzt wird, was der Owner entscheidet, wo die Geheimnisse liegen, deren Werte der Scan exakt sucht
// geprueft: Funde einer Halt-Art, die ein Mensch angesehen hat (eine Test-Fixture, kein Geheimnis), je mit dem Hash-Präfix des Funds
interface Namen { ersetzen?: (Ersetzung & { art?: string })[]; bleibt?: { name: string }[]; entscheiden?: { name: string; warum?: string }[]; geheimnisDateien?: string[];
  geprueft?: { hash: string; wo?: string; warum?: string }[] }
const namen = JSON.parse(lies(join(BINDUNG_DIR, "namen.json")) ?? "null") as Namen | null;
if (!namen?.ersetzen?.length) { console.error(`refused: keine Namen in ${join(BINDUNG_DIR, "namen.json")} ("ersetzen")`); process.exit(1); }
const geheim = geheimWerte({ fleetJson: lies(join(quelle, "fleet.json")), env: lies(join(quelle, ".env")),
  dateien: (namen.geheimnisDateien ?? []).flatMap((p) => { const t = lies(tilde(p)); return t === null ? [] : [{ pfad: p, text: t }]; }) });
const setup = scanSetup(namen.ersetzen.map((e) => e.name), (namen.entscheiden ?? []).map((e) => e.name), geheim);

// --- der Scan -------------------------------------------------------------------------------------------------------
interface Art { blobs: number; nachrichten: number; vorkommen: number; verschiedene: number; beispiele: { obj: string; wert: string | null }[] }
interface Scan { arten: Record<string, Art>; werte: Record<string, Record<string, number>>; halt: Record<string, string[]>; binaer: { anzahl: number; mib: number };
  objekte: number; textMib: number; dauerS: number }

// git cat-file --batch als Strom: Kopfzeile `<sha> <type> <size>`, dann size Bytes und ein \n; Chunks nur einmal zusammengesetzt
async function* objekte(repo: string, shas: string[]): AsyncGenerator<{ sha: string; type: string; data: Uint8Array }> {
  const p = Bun.spawn(["git", "-C", repo, "cat-file", "--batch"], { stdin: new Blob([`${shas.join("\n")}\n`]), stdout: "pipe", stderr: "ignore" });
  const reader = p.stdout.getReader();
  const chunks: Uint8Array[] = [];
  let have = 0;
  const fill = async (n: number): Promise<boolean> => {
    while (have < n) { const r = await reader.read(); if (r.done) return false; chunks.push(r.value); have += r.value.length; }
    return true;
  };
  const take = (n: number): Uint8Array => {
    const out = new Uint8Array(n);
    let off = 0;
    while (off < n) {
      const c = chunks[0]!, k = Math.min(c.length, n - off);
      out.set(c.subarray(0, k), off); off += k;
      if (k === c.length) chunks.shift(); else chunks[0] = c.subarray(k);
    }
    have -= n;
    return out;
  };
  const zeile = async (): Promise<string | null> => {
    for (;;) {
      let n = 0;
      for (const c of chunks) { const i = c.indexOf(10); if (i >= 0) return new TextDecoder().decode(take(n + i + 1)).slice(0, -1); n += c.length; }
      if (!(await fill(have + 1))) return null;
    }
  };
  for (;;) {
    const kopf = await zeile();
    if (kopf === null) break;
    const [sha, type, size] = kopf.split(" ");
    if (type === "missing" || !sha || !type) continue;
    const n = Number(size);
    if (!(await fill(n + 1))) break;
    const data = take(n); take(1);
    yield { sha, type, data };
  }
  await p.exited;
}

async function scan(repo: string, s: ScanSetup): Promise<Scan> {
  const t0 = Date.now();
  const liste = run(["git", "-C", repo, "cat-file", "--batch-all-objects", "--batch-check=%(objectname) %(objecttype)"]).trim().split("\n")
    .map((l) => l.split(" ")).filter(([, t]) => t === "blob" || t === "commit" || t === "tag").map(([sha]) => sha!);
  const arten: Record<string, Art & { set: Set<string> }> = {};
  const werte: Record<string, Record<string, number>> = {};
  let binaer = 0, binaerBytes = 0, textBytes = 0;
  const dec = new TextDecoder();
  for await (const o of objekte(repo, liste)) {
    let text: string;
    if (o.type === "blob") {
      if (o.data.subarray(0, 8000).includes(0)) { binaer++; binaerBytes += o.data.length; continue; }
      text = dec.decode(o.data);
    } else {
      // eine Nachricht ohne Kopf: Autor und Committer bleiben (eine Mailmap gibt der Owner), sie zählen hier nicht
      const roh = dec.decode(o.data), i = roh.indexOf("\n\n");
      text = i < 0 ? "" : roh.slice(i + 2);
    }
    textBytes += o.data.length;
    const gesehen = new Set<string>();
    for (const f of funde(text, s)) {
      const a = arten[f.art] ??= { blobs: 0, nachrichten: 0, vorkommen: 0, verschiedene: 0, beispiele: [], set: new Set() };
      a.vorkommen++; a.set.add(f.wert);
      // Namen, Entscheidungswörter und Adressen sind keine Geheimnisse: ihre Werte stehen mit ihrer Zahl im Bericht
      if (!GEHEIM_ARTEN.has(f.art)) { const w = (werte[f.art] ??= {}); w[f.wert] = (w[f.wert] ?? 0) + 1; }
      if (gesehen.has(f.art)) continue;
      gesehen.add(f.art);
      if (o.type === "blob") a.blobs++; else a.nachrichten++;
      if (a.beispiele.length < 3) a.beispiele.push({ obj: `${o.type}:${o.sha}`, wert: GEHEIM_ARTEN.has(f.art) && f.art !== "geheimnis-exakt" ? null : f.wert });
    }
  }
  // ...und die Pfade selbst: eine .env, eine fleet.json, ein Schlüssel, je mit dem Commit, der ihn anlegte
  const pfade = new Map<string, { commit: string; pfad: string }[]>();
  let commit = "";
  for (const l of run(["git", "-C", repo, "log", "--all", "--no-renames", "--raw", "--no-abbrev", "--format=@%H"]).split("\n")) {
    if (l.startsWith("@")) { commit = l.slice(1); continue; }
    const tab = l.indexOf("\t");
    if (!l.startsWith(":") || tab < 0) continue;
    const pfad = l.slice(tab + 1), art = pfadArt(pfad);
    if (!art || l.split(" ")[4]?.startsWith("D")) continue;
    const liste = pfade.get(art) ?? [];
    if (!liste.some((x) => x.pfad === pfad)) liste.push({ commit, pfad });
    pfade.set(art, liste);
  }
  const ergebnis: Record<string, Art> = {};
  for (const [k, a] of Object.entries(arten)) ergebnis[k] = { blobs: a.blobs, nachrichten: a.nachrichten, vorkommen: a.vorkommen, verschiedene: a.set.size, beispiele: a.beispiele };
  for (const [k, l] of pfade) ergebnis[k] = { blobs: l.length, nachrichten: 0, vorkommen: l.length, verschiedene: new Set(l.map((x) => x.pfad)).size,
    beispiele: l.slice(0, 3).map((x) => ({ obj: `commit:${x.commit}`, wert: x.pfad })) };
  const halt = Object.fromEntries(HALT_ARTEN.map((k) => [k, [...(arten[k]?.set ?? [])]]));
  return { arten: ergebnis, werte, halt, binaer: { anzahl: binaer, mib: +(binaerBytes / 1048576).toFixed(1) }, objekte: liste.length,
    textMib: +(textBytes / 1048576).toFixed(1), dauerS: Math.round((Date.now() - t0) / 1000) };
}

// das Beispiel eines Blobs bekommt einen Commit und einen Pfad: der erste Commit (neueste zuerst), der ihn schrieb
function orte(repo: string, scans: Scan[]): Map<string, { commit: string; pfad: string }> {
  const gesucht = new Set(scans.flatMap((s) => Object.values(s.arten).flatMap((a) => a.beispiele.map((b) => b.obj)))
    .filter((o) => o.startsWith("blob:")).map((o) => o.slice(5)));
  const m = new Map<string, { commit: string; pfad: string }>();
  let commit = "";
  for (const l of run(["git", "-C", repo, "log", "--all", "--no-renames", "--raw", "--no-abbrev", "--format=@%H"]).split("\n")) {
    if (l.startsWith("@")) { commit = l.slice(1); continue; }
    const tab = l.indexOf("\t"), neu = l.split(" ")[3];
    if (l.startsWith(":") && tab >= 0 && neu && gesucht.has(neu) && !m.has(neu)) m.set(neu, { commit, pfad: l.slice(tab + 1) });
  }
  return m;
}

const kib = (p: string): number => Number(run(["du", "-sk", p]).split("\t")[0]);
const schritt = (was: string): void => console.log(`${new Date().toISOString().slice(11, 19)} ${was}`);

// --- der Lauf -------------------------------------------------------------------------------------------------------
const t0 = Date.now();
mkdirSync(ziel, { recursive: true, mode: 0o700 });
schritt(`Klon ${quelle} → ${mirror}`);
run(["git", "clone", "--quiet", "--mirror", "--no-local", quelle, mirror]);
const ohneRemotes = (): string[] => {
  for (const r of run(["git", "-C", mirror, "remote"]).split("\n").filter(Boolean)) run(["git", "-C", mirror, "remote", "remove", r]);
  return run(["git", "-C", mirror, "remote"]).split("\n").filter(Boolean);
};
// der eine Remote des Klons (origin, der lokale Pfad der Quelle) bleibt bis nach filter-repo: an ihm erkennt es den frischen Klon
// der Stash der Quelle ist der geteilte Stapel laufender Sessions, keine Geschichte: er kommt mit dem Mirror und geht nur dort weg
if (run(["git", "-C", mirror, "for-each-ref", "--format=%(refname)", "refs/stash"]).trim()) run(["git", "-C", mirror, "update-ref", "-d", "refs/stash"]);
const groesseVorher = kib(mirror);
schritt(`Scan vorher (${geheim.size} bekannte Geheimnis-Werte aus fleet.json, .env und der Bindung)`);
const vorher = await scan(mirror, setup);
// die Orte der Beispiele von vorher jetzt: nach dem Umschreiben gibt es diese Blobs nicht mehr (die Commits stehen in der Quelle)
const ortVorher = orte(mirror, [vorher]);
const geprueft = new Set((namen.geprueft ?? []).map((g) => g.hash));
// ein bekannter echter Wert hält immer an; Schlüssel-Formen nur, solange einer nicht als geprüft in der Bindung steht
const ungeprueft = Object.fromEntries(HALT_ARTEN.map((k) => [k, (vorher.halt[k] ?? []).filter((w) => k === "geheimnis-exakt" || !geprueft.has(w))]));
const echt = HALT_ARTEN.filter((k) => ungeprueft[k]!.length > 0);
let nachher: Scan | null = null, groesseNachher: number | null = null, filterS: number | null = null;
if (echt.length && !args.includes("--weiter")) {
  ohneRemotes();
  schritt(`ANGEHALTEN vor dem Umschreiben: ${echt.join(", ")} in der Geschichte — siehe bericht.md`);
}
else {
  const datei = join(ziel, "ersetzungen.txt");
  writeFileSync(datei, ersetzungsDatei(namen.ersetzen), { mode: 0o600 });
  chmodSync(datei, 0o600);
  schritt(`git filter-repo (${namen.ersetzen.length} Namen, Inhalte und Nachrichten)`);
  const tf = Date.now();
  run([filterRepo, "--replace-text", datei, "--replace-message", datei], mirror);
  // filter-repo packt mit dem Standard-Fenster neu (Lauf 3: 711 MiB statt 82); ein volles Repack findet die Deltas wieder
  schritt("git repack -a -d -f --window=250 --depth=50");
  run(["git", "-C", mirror, "repack", "-a", "-d", "-f", "-q", "--window=250", "--depth=50"]);
  filterS = Math.round((Date.now() - tf) / 1000);
  const bleiben = ohneRemotes();
  if (bleiben.length) throw new Error(`Remotes nach dem Umschreiben: ${bleiben.join(", ")}`);
  groesseNachher = kib(mirror);
  schritt("Scan nachher");
  nachher = await scan(mirror, setup);
}
const ort = orte(mirror, nachher ? [nachher] : []);

// was der Owner entscheidet, am Stand von main der Kopie: die Wörter der Bindung, die Bilder (kein Text-Scan sieht in sie hinein)
const main = run(["git", "-C", mirror, "rev-parse", "--verify", "-q", "refs/heads/main"]).trim();
const grep = (muster: string, opts: string[]): string[] => {
  const r = Bun.spawnSync(["git", "-C", mirror, "grep", "-l", ...opts, "-e", muster, main], { stdout: "pipe" });
  return r.stdout.toString().split("\n").filter(Boolean).map((l) => l.slice(main.length + 1));
};
const entscheiden = (namen.entscheiden ?? []).map((e) => ({ name: e.name, warum: e.warum ?? "", dateien: grep(`\\b${e.name}\\b`, ["-i", "-P"]) }));
const bilder = run(["git", "-C", mirror, "ls-tree", "-r", "--name-only", main]).split("\n").filter((p) => /\.(png|jpe?g|gif|webp|svg|mp4|mov|webm|cast)$/i.test(p));
const bleibt = (namen.bleibt ?? []).map((b) => ({ name: b.name, dateien: grep(b.name, ["-i", "-F"]).length }));
const autoren = Object.entries(run(["git", "-C", mirror, "log", "--all", "--format=%an <%ae>"]).split("\n").filter(Boolean)
  .reduce<Record<string, number>>((m, a) => { m[a] = (m[a] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
const committer = [...new Set(run(["git", "-C", mirror, "log", "--all", "--format=%cn <%ce>"]).split("\n").filter(Boolean))];
const refs = run(["git", "-C", mirror, "for-each-ref", "--format=%(refname)"]).split("\n").filter(Boolean)
  .reduce<Record<string, number>>((m, r) => { const k = r.split("/").slice(0, 2).join("/"); m[k] = (m[k] ?? 0) + 1; return m; }, {});

const bericht = { quelle, mirror, dauerS: Math.round((Date.now() - t0) / 1000), filterRepoS: filterS, remotes: run(["git", "-C", mirror, "remote"]).trim() || null,
  groesseMib: { vorher: +(groesseVorher / 1024).toFixed(1), nachher: groesseNachher === null ? null : +(groesseNachher / 1024).toFixed(1) },
  angehalten: echt.length && !args.includes("--weiter") ? echt : null, ungeprueft, geprueft: geprueft.size, geheimnisWerte: geheim.size, vorher, nachher, refs, autoren, committer, entscheiden, bilder, bleibt };
writeFileSync(join(ziel, "bericht.json"), JSON.stringify(bericht, null, 2), { mode: 0o600 });

// ein Beispiel: Commit und Pfad, dazu der Text des Funds, wenn er kein Geheimnis ist (Namen, Adressen, die Quelle eines bekannten Werts)
const beispiel = (art: string, b: { obj: string; wert: string | null }, orte: Map<string, { commit: string; pfad: string }>): string => {
  const [typ, sha] = b.obj.split(":") as [string, string];
  if (art.startsWith("datei-")) return `${sha.slice(0, 9)} ${b.wert}`;
  const o = typ === "blob" ? orte.get(sha) : null;
  const wo = typ !== "blob" ? `${sha.slice(0, 9)} (Nachricht)` : o ? `${o.commit.slice(0, 9)} ${o.pfad}` : `blob ${sha.slice(0, 9)} (nur in einem Merge)`;
  return b.wert ? `${wo} — ${b.wert}` : wo;
};
const alleArten = [...new Set([...Object.keys(vorher.arten), ...Object.keys(nachher?.arten ?? {})])].sort();
const md = [
  `# Bereinigte Kopie: ${mirror}`, "",
  `Quelle ${quelle} (nur gelesen) · Lauf ${bericht.dauerS} s${filterS === null ? "" : `, davon filter-repo und Repack ${filterS} s`} · Größe ${bericht.groesseMib.vorher} MiB → ${bericht.groesseMib.nachher ?? "–"} MiB · Remotes: ${bericht.remotes ?? "keine"}`,
  `Scan vorher ${vorher.dauerS} s über ${vorher.objekte} Objekte (${vorher.textMib} MiB Text, ${vorher.binaer.anzahl} Binärdateien mit ${vorher.binaer.mib} MiB ungelesen) · ${geheim.size} bekannte Geheimnis-Werte exakt gesucht`,
  bericht.angehalten ? `\n**Angehalten vor dem Umschreiben:** ${bericht.angehalten.map((k) => `${k} (${ungeprueft[k]!.join(", ")})`).join("; ")}. Ist ein Fund eine Fixture, gehört sein Hash nach "geprueft" in die Bindung.` : "",
  `Halt-Arten: ${HALT_ARTEN.map((k) => `${k} ${(vorher.halt[k] ?? []).length} (davon geprüft ${(vorher.halt[k] ?? []).filter((w) => geprueft.has(w)).length})`).join(" · ")}`, "",
  "| Art | vorher (Blobs/Nachrichten/verschiedene) | nachher | Beispiele vorher (Commits der Quelle) | Beispiele nachher (Commits der Kopie) |", "|---|---|---|---|---|",
  ...alleArten.map((k) => {
    const v = vorher.arten[k], n = nachher?.arten[k];
    const zahl = (a: Art | undefined): string => a ? `${a.blobs}/${a.nachrichten}/${a.verschiedene}` : "0";
    const bsp = (a: Art | undefined, o: Map<string, { commit: string; pfad: string }>): string => a?.beispiele.map((b) => beispiel(k, b, o)).join("<br>") ?? "";
    return `| ${k} | ${zahl(v)} | ${nachher ? zahl(n) : "–"} | ${bsp(v, ortVorher)} | ${bsp(n, ort)} |`;
  }),
  "", "Namen je Vorkommen in der ganzen Geschichte (vorher → nachher):",
  ...Object.entries(vorher.werte.name ?? {}).sort((a, b) => b[1] - a[1]).map(([w, c]) => `- ${w}: ${c} → ${nachher?.werte.name?.[w] ?? 0}`),
  "", "Adressen nachher (Vorkommen; die Ersatzadressen der Bindung sind 10.0.0.x und 192.168.0.x):",
  ...(["ip-tailnet", "ip-privat", "ip-oeffentlich"] as const).map((k) => `- ${k}: ${Object.entries((nachher ?? vorher).werte[k] ?? {}).sort((a, b) => b[1] - a[1]).map(([w, c]) => `${w} ${c}`).join(", ") || "keine"}`),
  "", "## Entscheidungen des Owners (Stand main der Kopie)",
  ...entscheiden.map((e) => `- **${e.name}** (${e.warum}): ${e.dateien.length} Dateien${e.dateien.length ? ` — ${e.dateien.slice(0, 8).join(", ")}${e.dateien.length > 8 ? " …" : ""}` : ""}; in der Geschichte ${(nachher ?? vorher).werte.entscheiden?.[e.name.toLowerCase()] ?? 0} Vorkommen`),
  `- **Bilder und Aufnahmen** (kein Text-Scan sieht hinein): ${bilder.length} Dateien in main${bilder.length ? ` — ${bilder.slice(0, 10).join(", ")}${bilder.length > 10 ? " …" : ""}` : ""}`,
  ...bleibt.map((b) => `- bleibt laut Bindung: ${b.name} in ${b.dateien} Dateien von main`),
  "", "## Autoren (bleiben bis zu einer Mailmap)", ...autoren.map(([a, c]) => `- ${a}: ${c} Commits`),
  `Committer: ${committer.join(" · ")}`, "", `Refs: ${Object.entries(refs).map(([k, c]) => `${k} ${c}`).join(" · ")}`,
].join("\n");
writeFileSync(join(ziel, "bericht.md"), `${md}\n`, { mode: 0o600 });
console.log(md);
process.exit(bericht.angehalten ? 2 : 0);
