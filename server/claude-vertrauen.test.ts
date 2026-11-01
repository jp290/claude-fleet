import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeJsonPfad, piTrustDatei, vertraueOrdner, vertraueOrdnerPi, vertrauenJetzt, vertrauenJetztPi, vertrauenNachsehen, vertrauenStand, vertrauenText, vertrauenTextPi, vertrauenMerkenIn, vertrauenUmDenStart, vertrauensSchluessel, vergissOrdnerUnter } from "./claude-vertrauen";
import { lstatSync, symlinkSync } from "node:fs";

// Claude Code keeps a folder's trust in <home>/.claude.json under projects[<git root>].hasTrustDialogAccepted and writes that file
// under the lock directory <file>.lock (measured in 2.1.316, docs/messungen/2026-10-31-claude-json-vertrauen.md). These tests stand in
// for a running session with the same lock, in a temp HOME — the owner's real file is never touched.
let home: string, datei: string, w: string;
const git = (cwd: string, ...a: string[]) => Bun.spawnSync(["git", "-c", "user.email=t@t", "-c", "user.name=t", ...a], { cwd });
const lies = () => JSON.parse(readFileSync(datei, "utf8"));
beforeEach(() => {
  w = realpathSync(mkdtempSync(join(tmpdir(), "vertrauen-")));
  home = join(w, "home"); mkdirSync(home);
  datei = claudeJsonPfad(home, {});
  writeFileSync(datei, JSON.stringify({ numStartups: 3, oauthAccount: { a: 1 }, projects: { "/alt": { hasTrustDialogAccepted: true, lastCost: 2 } } }, null, 2), { mode: 0o600 });
});
afterEach(() => rmSync(w, { recursive: true, force: true }));
const repo = (name: string) => { const r = join(w, name); mkdirSync(r); git(r, "init", "-q"); git(r, "commit", "-q", "--allow-empty", "-m", "i"); return r; };

describe("Fleet trusts the folder it opens, in Claude Code's own file", () => {
  test("a fresh repo gets its entry; everything else in the file stays byte for byte", async () => {
    const r = repo("frisch");
    const vorher = lies();
    const v = await vertraueOrdner(r, datei);
    expect(v.art).toBe("gesetzt");
    const nachher = lies();
    expect(nachher.projects[r].hasTrustDialogAccepted).toBe(true);
    delete nachher.projects[r];
    expect(nachher).toEqual(vorher);
    expect(statSync(datei).mode & 0o777).toBe(0o600);
    expect(readdirSync(home).filter((n) => n.includes(".tmp.") || n.endsWith(".lock"))).toEqual([]);
  });
  test("a worktree and a subfolder trust the repository root, as Claude Code keys them", async () => {
    const r = repo("haupt");
    git(r, "worktree", "add", "-q", join(w, "wt"), "-b", "x");
    mkdirSync(join(r, "unter"));
    expect(await vertrauensSchluessel(join(w, "wt"))).toBe(r);
    expect(await vertrauensSchluessel(join(r, "unter"))).toBe(r);
    expect((await vertraueOrdner(join(w, "wt"), datei)).schluessel).toBe(r);
    expect((await vertraueOrdner(join(r, "unter"), datei)).art).toBe("schon");
  });
  test("outside a repository the folder itself is the key", async () => {
    const o = join(w, "ohne"); mkdirSync(o);
    expect((await vertraueOrdner(o, datei)).schluessel).toBe(o);
  });
  test("a trusted folder is left alone: no write, no line in the start brief", async () => {
    const r = repo("vertraut");
    writeFileSync(datei, JSON.stringify({ projects: { [r]: { hasTrustDialogAccepted: true } } }));
    const m = statSync(datei).mtimeMs;
    expect((await vertraueOrdner(r, datei)).art).toBe("schon");
    expect(statSync(datei).mtimeMs).toBe(m);
    expect(await vertrauenText(r, datei)).toBeNull();
  });
  test("the line says what is trusted and that it stays, the same whoever opened the seat; a running seat's line stands only while the entry is in the file", async () => {
    const r = repo("brief");
    // before the write the start window shows what Fleet sets as the seat starts; a running seat has nothing to show yet
    expect((await vertrauenText(r, datei, home))!.split("\n")[0]).toStartWith(`Fleet trusts the whole repository ${r} for Claude Code`);
    expect(await vertrauenJetzt(r, datei, home)).toBeNull();
    await vertraueOrdner(r, datei);
    const [satz, detail] = (await vertrauenJetzt(r, datei, home))!.split("\n");
    expect(satz).toBe(`Fleet trusts the whole repository ${r} for Claude Code, every folder and worktree of it, because this seat was opened in it; the entry stays in ${datei} after this seat and holds for Claude Code outside Fleet too`);
    expect(detail).toContain(`projects["${r}"].hasTrustDialogAccepted = true`);
    expect(detail).toContain(`"Accessing workspace … Yes, I trust this folder"`);
    // the start window, the held start and the running seat show the same line: it carries no value of the occupancy (no slot, no opener)
    expect(await vertrauenText(r, datei, home)).toBe(await vertrauenJetzt(r, datei, home));
    // a worktree's line names the main checkout it trusts; a folder outside a repository is named as a folder
    git(r, "worktree", "add", "-q", join(w, "brief-wt"), "-b", "y");
    expect((await vertrauenJetzt(join(w, "brief-wt"), datei, home))!.split("\n")[0]).toContain(`the whole repository ${r} for Claude Code, every folder and worktree of it`);
    const o = join(w, "brief-ohne"); mkdirSync(o);
    await vertraueOrdner(o, datei);
    expect((await vertrauenJetzt(o, datei, home))!.split("\n")[0]).toContain(`Fleet trusts the folder ${o} for Claude Code, and every folder below it,`);
    // the entry gone (taken back by hand, or an exit write): a running seat's line goes with it
    writeFileSync(datei, JSON.stringify({ projects: {} }));
    expect(await vertrauenJetzt(r, datei, home)).toBeNull();
  });
  test("an entry Claude Code already made for the folder keeps its other fields", async () => {
    const r = repo("halb");
    writeFileSync(datei, JSON.stringify({ projects: { [r]: { hasTrustDialogAccepted: false, lastCost: 7, allowedTools: ["x"] } } }));
    await vertraueOrdner(r, datei);
    expect(lies().projects[r]).toEqual({ hasTrustDialogAccepted: true, lastCost: 7, allowedTools: ["x"] });
  });
  test("it waits for a session that holds the lock, and writes after it let go", async () => {
    const r = repo("gesperrt");
    const sperre = `${realpathSync(datei)}.lock`;
    mkdirSync(sperre);
    // the session writes its own change and lets go after 150 ms
    setTimeout(() => { const o = lies(); o.numStartups = 99; writeFileSync(datei, JSON.stringify(o, null, 2)); rmSync(sperre, { recursive: true }); }, 150);
    const t = Date.now();
    expect((await vertraueOrdner(r, datei)).art).toBe("gesetzt");
    expect(Date.now() - t).toBeGreaterThanOrEqual(120);
    const o = lies();
    expect(o.numStartups).toBe(99);             // the session's write is not clobbered
    expect(o.projects[r].hasTrustDialogAccepted).toBe(true);   // and Fleet's entry is not lost to it
  });
  test("a lock whose holder died is taken over after its stale time", async () => {
    const r = repo("tot");
    const sperre = `${realpathSync(datei)}.lock`;
    mkdirSync(sperre);
    const alt = new Date(Date.now() - 30_000); utimesSync(sperre, alt, alt);
    expect((await vertraueOrdner(r, datei)).art).toBe("gesetzt");
    expect(existsSync(sperre)).toBe(false);
  });
  test("many Fleet writers and a session writing between them lose nothing", async () => {
    const rs = ["a", "b", "c", "d", "e", "f"].map(repo);
    const sperre = `${realpathSync(datei)}.lock`;
    // a stand-in session, the way Claude Code does it: lock, re-read, change its own key, replace through a temp file
    const sitzung = async (n: number) => {
      for (let i = 0; i < n; i++) {
        while (true) { try { mkdirSync(sperre); break; } catch { await Bun.sleep(3); } }
        try { const o = lies(); o.numStartups = (o.numStartups ?? 0) + 1; writeFileSync(`${datei}.tmp.s`, JSON.stringify(o, null, 2)); Bun.spawnSync(["mv", `${datei}.tmp.s`, datei]); }
        finally { rmSync(sperre, { recursive: true, force: true }); }
        await Bun.sleep(2);
      }
    };
    const res = await Promise.all([sitzung(30), ...rs.map((r) => vertraueOrdner(r, datei))]);
    expect(res.slice(1).map((v) => (v as { art: string }).art)).toEqual(rs.map(() => "gesetzt"));
    const o = lies();
    expect(o.numStartups).toBe(33);
    expect(rs.every((r) => o.projects[r].hasTrustDialogAccepted === true)).toBe(true);
    expect(o.projects["/alt"].lastCost).toBe(2);
  });
  test("a file that is not JSON, a missing file and the home folder are left alone", async () => {
    const r = repo("fremd");
    writeFileSync(datei, "{ kaputt");
    expect((await vertraueOrdner(r, datei)).art).toBe("nicht-lesbar");
    expect(readFileSync(datei, "utf8")).toBe("{ kaputt");
    rmSync(datei);
    expect((await vertraueOrdner(r, datei)).art).toBe("ohne-datei");
    expect(existsSync(datei)).toBe(false);
    writeFileSync(datei, "{}");
    expect((await vertraueOrdner(home, datei, home)).art).toBe("ausgenommen");
    expect(await vertrauenStand(home, datei)).not.toBeNull();
    expect(readFileSync(datei, "utf8")).toBe("{}");
  });
  test("CLAUDE_CONFIG_DIR moves the file, as it does for Claude Code", () => {
    expect(claudeJsonPfad("/h", { CLAUDE_CONFIG_DIR: "/c" })).toBe("/c/.claude.json");
    expect(claudeJsonPfad("/h", {})).toBe("/h/.claude.json");
  });
});

describe("Fleet trusts the folder it opens for pi, in Fleet's own agent home", () => {
  let agent: string;
  beforeEach(() => { agent = join(w, "pi-agent"); });
  test("a folder with project resources gets its entry in trust.json, other entries stay, sorted, one lock under pi's name", async () => {
    const r = repo("pi-frisch");
    mkdirSync(join(r, ".agents", "skills"), { recursive: true });
    mkdirSync(agent);
    writeFileSync(piTrustDatei(agent), JSON.stringify({ "/zzz": true, "/aaa": false }, null, 2) + "\n");
    expect((await vertraueOrdnerPi(r, agent)).art).toBe("gesetzt");
    expect(JSON.parse(readFileSync(piTrustDatei(agent), "utf8"))).toEqual({ "/aaa": false, "/zzz": true, [r]: true });
    expect(Object.keys(JSON.parse(readFileSync(piTrustDatei(agent), "utf8")))).toEqual(["/aaa", "/zzz", r].sort());
    expect(readdirSync(agent)).toEqual(["trust.json"]);
  });
  test("a home without a trust store gets one; a trusted parent counts, a distrusted folder stays distrusted", async () => {
    const r = repo("pi-eltern");
    expect((await vertraueOrdnerPi(r, agent)).art).toBe("gesetzt");
    const kind = join(r, "unter"); mkdirSync(kind);
    expect((await vertraueOrdnerPi(kind, agent)).art).toBe("schon");
    const nein = repo("pi-nein");
    writeFileSync(piTrustDatei(agent), JSON.stringify({ [nein]: false }));
    expect((await vertraueOrdnerPi(nein, agent)).art).toBe("abgelehnt");
    expect(JSON.parse(readFileSync(piTrustDatei(agent), "utf8"))).toEqual({ [nein]: false });
    expect(await vertrauenTextPi(nein, agent)).toBeNull();
  });
  test("the line names the folder and its home, and a running seat's line stands only while trust.json holds it", async () => {
    const r = repo("pi-brief");
    expect(await vertrauenJetztPi(r, agent)).toBeNull();
    await vertraueOrdnerPi(r, agent);
    const [satz, detail] = (await vertrauenJetztPi(r, agent))!.split("\n");
    expect(satz).toBe(`Fleet trusts the folder ${r} for pi, and every folder below it, because this seat was opened in it; the entry stays in ${piTrustDatei(agent)} after this seat and holds for every pi that runs with that agent home`);
    expect(detail).toContain(`["${r}"] = true`);
    expect(await vertrauenTextPi(r, agent)).toBe(await vertrauenJetztPi(r, agent));
    writeFileSync(piTrustDatei(agent), '{"x": "ja"}');
    expect((await vertraueOrdnerPi(r, agent)).art).toBe("nicht-lesbar");
    expect(readFileSync(piTrustDatei(agent), "utf8")).toBe('{"x": "ja"}');
    expect(await vertrauenJetztPi(r, agent)).toBeNull();
  });
  test("it waits for pi's lock and takes over a dead one", async () => {
    const r = repo("pi-lock");
    mkdirSync(agent);
    const sperre = `${piTrustDatei(agent)}.lock`;
    mkdirSync(sperre);
    setTimeout(() => rmSync(sperre, { recursive: true }), 120);
    expect((await vertraueOrdnerPi(r, agent)).art).toBe("gesetzt");
    mkdirSync(sperre);
    const alt = new Date(Date.now() - 30_000); utimesSync(sperre, alt, alt);
    expect((await vertraueOrdnerPi(repo("pi-lock2"), agent)).art).toBe("gesetzt");
  });
});

describe("a test instance takes back the trust it set under its folder", () => {
  test("only keys at or below the folder go; the owner's own entries and a sibling with the same prefix stay", async () => {
    writeFileSync(datei, JSON.stringify({ projects: { "/tmp/fleet-testinstanz-1": { hasTrustDialogAccepted: true }, "/tmp/fleet-testinstanz-1/fixture-repo": { hasTrustDialogAccepted: true },
      "/tmp/fleet-testinstanz-12/x": { hasTrustDialogAccepted: true }, "/alt": { hasTrustDialogAccepted: true } }, numStartups: 4 }, null, 2));
    expect(await vergissOrdnerUnter("/tmp/fleet-testinstanz-1", datei)).toBe(2);
    expect(Object.keys(lies().projects).sort()).toEqual(["/alt", "/tmp/fleet-testinstanz-12/x"]);
    expect(lies().numStartups).toBe(4);
    expect(await vergissOrdnerUnter("/tmp/fleet-testinstanz-1", datei)).toBe(0);
  });
  test("a folder that is already deleted, named through a symlinked parent (/var → /private/var): its real keys still go", async () => {
    mkdirSync(join(w, "echt"));
    symlinkSync(join(w, "echt"), join(w, "verweis"));
    const inst = join(w, "echt", "inst"); mkdirSync(join(inst, "fixture"), { recursive: true });
    // Fleet writes keys under the real path, as Claude Code does
    writeFileSync(datei, JSON.stringify({ projects: { [join(inst, "fixture")]: { hasTrustDialogAccepted: true }, "/alt": { hasTrustDialogAccepted: true } } }, null, 2));
    rmSync(inst, { recursive: true }); // the trap runs after rm -rf
    expect(await vergissOrdnerUnter(join(w, "verweis", "inst"), datei)).toBe(1);
    expect(Object.keys(lies().projects)).toEqual(["/alt"]);
  });
  test("a folder that is itself a symlink to another folder is refused: the owner's entries behind it stay", async () => {
    const owner = join(w, "owner"); mkdirSync(join(owner, "projA"), { recursive: true }); mkdirSync(join(owner, "projB"));
    symlinkSync(owner, join(w, "probe-7"));
    const vorher = { [join(owner, "projA")]: { hasTrustDialogAccepted: true }, [join(owner, "projB")]: { hasTrustDialogAccepted: true }, "/alt": { hasTrustDialogAccepted: true } };
    writeFileSync(datei, JSON.stringify({ projects: vorher }, null, 2));
    expect(await vergissOrdnerUnter(join(w, "probe-7"), datei)).toBe(0);
    expect(lies().projects).toEqual(vorher);
  });
});

// THE FIVE DEFECTS THE INDEPENDENT CHECK FOUND (~/local-notes/w2-start-setzen/pruefung.md), each with the input that showed it
describe("what the check found", () => {
  // 1 — a session that exits writes ~/.claude.json WITHOUT the lock (claude 2.1.316, process.on("exit")): read, change, write. Its read can come
  // before Fleet's write and its write after it, and Fleet's entry is gone again.
  const exitWrite = (gelesen: string) => writeFileSync(datei, gelesen.replace('"lastCost": 2', '"lastCost": 3'));
  test("an exit write that drops the entry before the pane starts: Fleet sets it again, and Claude Code finds it when it starts", async () => {
    const r = repo("exit-vor");
    const gelesen = readFileSync(datei, "utf8");      // the exiting session read the file before Fleet wrote
    expect((await vertraueOrdner(r, datei, home)).art).toBe("gesetzt");
    exitWrite(gelesen);                                // ...and writes it back after, unlocked
    expect(lies().projects[r]).toBeUndefined();
    let beimStart: unknown = null;
    const { nachschau } = await vertrauenUmDenStart(r, datei, home, r, async () => { beimStart = lies().projects[r]?.hasTrustDialogAccepted; }, { nachMs: 10 });
    expect(beimStart).toBe(true);
    await nachschau;
    expect(lies().projects["/alt"].lastCost).toBe(3);  // the session's exit write is kept
  });
  test("an exit write that drops the entry while the pane starts: the look shortly after sets it again", async () => {
    const r = repo("exit-nach");
    const gelesen = readFileSync(datei, "utf8");
    expect((await vertraueOrdner(r, datei, home)).art).toBe("gesetzt");
    const { nachschau } = await vertrauenUmDenStart(r, datei, home, r, async () => exitWrite(gelesen), { nachMs: 500 });
    expect(lies().projects[r]).toBeUndefined();
    expect(await vertrauenJetzt(r, datei, home)).toBeNull(); // while it is gone, the running seat's start brief does not claim it
    // ...while a start computed now (another seat in the same repo) says what Fleet sets again when that seat starts
    expect(await vertrauenText(r, datei, home)).not.toBeNull();
    expect((await nachschau)?.art).toBe("gesetzt");
    expect(lies().projects[r].hasTrustDialogAccepted).toBe(true);
    expect(lies().projects["/alt"].lastCost).toBe(3);
    expect(await vertrauenJetzt(r, datei, home)).not.toBeNull();
    // an entry that is there is only read: no lock, no write
    const m = statSync(datei).mtimeMs;
    expect((await vertrauenNachsehen(r, datei, home)).art).toBe("schon");
    expect(statSync(datei).mtimeMs).toBe(m);
  });

  // 2 — Claude Code locks `<path as named>.lock`, no realpath. With ~/.claude.json a symlink (a dotfile manager), a lock next to the real file never
  // meets a session's. The session here holds ITS lock: it read the file when it took the lock and writes its change 150 ms later.
  const symlinkedConfig = () => {
    const echt = join(w, "dotfiles", "claude.json");
    mkdirSync(join(w, "dotfiles"));
    writeFileSync(echt, readFileSync(datei, "utf8"), { mode: 0o600 });
    const h2 = join(w, "home2"); mkdirSync(h2);
    const link = join(h2, ".claude.json");
    symlinkSync(echt, link);
    return { echt, link };
  };
  const sessionHoldsLock = (link: string, echt: string, change: (o: Record<string, unknown>) => void) => {
    mkdirSync(`${link}.lock`);
    const o = JSON.parse(readFileSync(link, "utf8"));
    change(o);
    return new Promise<void>((fertig) => setTimeout(() => { writeFileSync(echt, JSON.stringify(o, null, 2)); rmSync(`${link}.lock`, { recursive: true }); fertig(); }, 150));
  };
  test("with a symlinked config Fleet waits on the lock Claude Code takes, beside the link, and the link stays a link", async () => {
    const { echt, link } = symlinkedConfig();
    const r = repo("link");
    const sitzung = sessionHoldsLock(link, echt, (o) => { o.numStartups = 99; });
    expect((await vertraueOrdner(r, link, home)).art).toBe("gesetzt");
    await sitzung;
    const o = JSON.parse(readFileSync(link, "utf8"));
    expect(o.numStartups).toBe(99);                                  // the session's write is not clobbered
    expect(o.projects[r].hasTrustDialogAccepted).toBe(true);         // and Fleet's entry is not lost to it
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(existsSync(`${realpathSync(link)}.lock`)).toBe(false);    // no lock of Fleet's own next to the real file
  });
  test("taking back a test instance's trust waits on the same lock", async () => {
    const { echt, link } = symlinkedConfig();
    const o0 = JSON.parse(readFileSync(link, "utf8"));
    o0.projects["/tmp/fleet-testinstanz-9/f"] = { hasTrustDialogAccepted: true };
    writeFileSync(echt, JSON.stringify(o0, null, 2));
    const sitzung = sessionHoldsLock(link, echt, (o) => { o.numStartups = 77; });
    expect(await vergissOrdnerUnter("/tmp/fleet-testinstanz-9", link)).toBe(1);
    await sitzung;
    const o = JSON.parse(readFileSync(link, "utf8"));
    expect(o.numStartups).toBe(77);
    expect(o.projects["/tmp/fleet-testinstanz-9/f"]).toBeUndefined();
  });

  // 3 — a repository whose separate git dir is named .git and lives elsewhere is no worktree: Claude Code keys it by its own top level
  test("a repository with its git dir elsewhere is trusted under its own folder, not the git dir's parent", async () => {
    const work = join(w, "e-work");
    mkdirSync(join(w, "e-store"));
    expect(git(w, "init", "-q", `--separate-git-dir=${join(w, "e-store", ".git")}`, work).exitCode).toBe(0);
    mkdirSync(join(work, "unter"));
    expect(await vertrauensSchluessel(work)).toBe(work);
    expect(await vertrauensSchluessel(join(work, "unter"))).toBe(work);
    expect((await vertraueOrdner(join(work, "unter"), datei, home)).schluessel).toBe(work);
    expect(lies().projects[join(w, "e-store")]).toBeUndefined();
  });
  test("a worktree of a bare repository is trusted on its own, and the line says so: the worktree, not the whole repository", async () => {
    const r = repo("quelle");
    expect(git(w, "clone", "-q", "--bare", r, join(w, "nackt.git")).exitCode).toBe(0);
    expect(git(join(w, "nackt.git"), "worktree", "add", "-q", join(w, "nackt-wt"), "-b", "y").exitCode).toBe(0);
    const wt = join(w, "nackt-wt");
    expect(await vertrauensSchluessel(wt)).toBe(wt);
    await vertraueOrdner(wt, datei, home);
    const satz = (await vertrauenJetzt(wt, datei, home))!.split("\n")[0];
    expect(satz).toContain(`Fleet trusts the worktree ${wt} for Claude Code, and every folder below it,`);
    expect(satz).not.toContain("the whole repository");
  });

  // a preview and the start that holds it may run in two server processes (a restart, a deploy): what Fleet set is in its state, not only in memory
  test("after a restart Fleet still names the trust it set, and not a folder trusted before it", async () => {
    const merk = join(w, "state", "vertrauen-gesetzt.json"); mkdirSync(join(w, "state"));
    try {
      vertrauenMerkenIn(merk);
      const r = repo("neustart"), vorher = repo("vorher");
      expect((await vertraueOrdner(r, datei, home)).art).toBe("gesetzt");
      const satz = await vertrauenText(join(r), datei, home);
      expect(satz).not.toBeNull();
      writeFileSync(datei, JSON.stringify({ ...lies(), projects: { ...lies().projects, [vorher]: { hasTrustDialogAccepted: true } } }, null, 2));
      vertrauenMerkenIn(merk); // the restarted server: an empty memory, the same state file
      expect(await vertrauenText(r, datei, home)).toBe(satz);
      expect(await vertrauenText(vorher, datei, home)).toBeNull();
    } finally { vertrauenMerkenIn(null); }
  });

  test("what Fleet set in one config file does not name a folder the owner trusted before in another (FLEET_CLAUDE_HOME changed)", async () => {
    const merk = join(w, "state2", "vertrauen-gesetzt.json"); mkdirSync(join(w, "state2"));
    try {
      vertrauenMerkenIn(merk);
      const r = repo("zwei-dateien");
      expect((await vertraueOrdner(r, datei, home)).art).toBe("gesetzt");
      const homeB = join(w, "home-b"); mkdirSync(homeB);
      const dateiB = claudeJsonPfad(homeB, {});
      writeFileSync(dateiB, JSON.stringify({ projects: { [r]: { hasTrustDialogAccepted: true } } }, null, 2)); // trusted by the owner, before Fleet
      vertrauenMerkenIn(merk);
      expect(await vertrauenText(r, datei, home)).not.toBeNull();
      expect(await vertrauenText(r, dateiB, homeB)).toBeNull();
    } finally { vertrauenMerkenIn(null); }
  });

  // 4 — the line stands only when the entry is in the file; a file in a shape Fleet does not know stays as it is
  test("a lock held the whole wait: nothing is written and the start brief claims nothing", async () => {
    const r = repo("zu");
    mkdirSync(`${datei}.lock`);                     // a live holder: its lock is fresh
    const roh = readFileSync(datei, "utf8");
    expect(await vertrauenText(r, datei, home)).not.toBeNull(); // before the start: what Fleet means to set
    expect((await vertraueOrdner(r, datei, home)).art).toBe("gesperrt");
    expect(readFileSync(datei, "utf8")).toBe(roh);
    expect(await vertrauenText(r, datei, home)).toBeNull();   // after it failed: no promise
    expect(await vertrauenJetzt(r, datei, home)).toBeNull();
  }, 15_000);
  test("a write that fails: the start brief claims nothing", async () => {
    const r = repo("fehler");
    Bun.spawnSync(["chmod", "500", home]);          // the temp file can't be made beside the config
    try {
      expect((await vertraueOrdner(r, datei, home)).art).toBe("fehler");
      expect(await vertrauenText(r, datei, home)).toBeNull();
      expect(await vertrauenJetzt(r, datei, home)).toBeNull();
    } finally { Bun.spawnSync(["chmod", "700", home]); }
  });
  test("\"projects\" as an array is a shape Fleet does not know: the file stays byte for byte", async () => {
    const r = repo("array");
    writeFileSync(datei, JSON.stringify({ numStartups: 1, projects: ["keep-me"] }, null, 2));
    const roh = readFileSync(datei, "utf8");
    expect((await vertraueOrdner(r, datei, home)).art).toBe("nicht-lesbar");
    expect(readFileSync(datei, "utf8")).toBe(roh);
    expect(await vertrauenText(r, datei, home)).toBeNull();
  });
  test("pi: a lock held the whole wait leaves no line either", async () => {
    const r = repo("pi-zu");
    const agent = join(w, "pi-agent-zu"); mkdirSync(agent);
    mkdirSync(`${piTrustDatei(agent)}.lock`);
    expect(await vertrauenTextPi(r, agent)).not.toBeNull();
    expect((await vertraueOrdnerPi(r, agent)).art).toBe("gesperrt");
    expect(await vertrauenTextPi(r, agent)).toBeNull();
    expect(await vertrauenJetztPi(r, agent)).toBeNull();
  }, 15_000);
});
