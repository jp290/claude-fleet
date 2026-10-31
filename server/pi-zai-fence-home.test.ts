// Mangel 175: das pi-Agent-Home eines gezäunten Sitzes ist im Zaun nur lesbar. pi lädt daraus ohne Projekt-Trust Code und
// Anweisungen (settings.json, extensions/, skills/ …), und alle Sitze eines Adapters teilen das Verzeichnis: was ein Sitz
// dort ablegt, führt sein Geschwister beim nächsten Start aus. Die Tests prüfen das VERHALTEN der beiden Zäune, nicht den
// Wortlaut: bwrap an den Argumenten, die das Kernel-Verhalten festlegen (die echte Probe steht in e2e/pi-zai-bwrap-probe.ts),
// SBPL an einer kleinen Auswertung der Regeln nach Apples Reihenfolge (die spätere Regel gewinnt; Standard erlaubt).
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PI_AGENT_HOME_LOCKS, piSessionSlug, piZaiBwrapArgs, piZaiFenceProfile, piZaiTmpFor, type PiZaiFenceInput } from "./pi-zai-fence";

const root = realpathSync(mkdtempSync(join(tmpdir(), "fleet-pihome-")));
const home = join(root, "home");
const deny = join(root, "deny");
const cwd = join(root, "work");
const agent = join(home, ".config/claude-fleet/pi-zai-agent");
const other = join(home, ".config/claude-fleet/pi-zai-unfenced-agent"); // pi-zai-unfenced (server.ts#PI_ZAI_UNFENCED_AGENT_DIR)
for (const d of [home, deny, cwd, agent, other, `${agent}/sessions/${piSessionSlug(cwd)}`]) mkdirSync(d, { recursive: true });
writeFileSync(`${agent}/auth.json`, "{}");
const own = piZaiTmpFor(realpathSync(tmpdir()), cwd);

const input = (agentDir: string): PiZaiFenceInput => ({
  home, fleetDir: join(root, "fleet"), agentDir, keyFile: join(home, ".config/claude-fleet/secrets/zai.key"), cwd,
  tmuxDir: join(root, "tmux"), sockets: [], denyRoots: [deny], tmpRoots: [realpathSync(tmpdir())], ownTmp: own,
  suiteLock: join(root, "suite.lock"), toolRoots: [], git: null,
});
const bwrap = (agentDir = agent): string[] => piZaiBwrapArgs(input(agentDir), { newSession: false })!.args;
const at = (args: string[], ...seq: string[]): number => args.findIndex((_, k) => seq.every((s, j) => args[k + j] === s));
process.on("exit", () => rmSync(root, { recursive: true, force: true }));

describe("bwrap: das pi-Agent-Home im Zaun", () => {
  test("das Home ist nur lesbar: kein --bind darauf, die untere Schicht ist das echte Home, die obere ein tmpfs", () => {
    const args = bwrap();
    expect(at(args, "--bind", agent, agent)).toBe(-1);
    // untere Schicht = das echte Home (was Fleet vor dem Start schrieb: skills/, fleet-skills.json, models.json), obere = tmpfs
    const o = at(args, "--overlay-src", agent, "--tmp-overlay", agent);
    expect(o).toBeGreaterThan(-1);
    // ...und keine zweite, DAUERHAFTE obere Schicht: --overlay <rw> <work> <dest> würde ins echte Verzeichnis schreiben
    expect(args).not.toContain("--overlay");
    expect(args).not.toContain("--ro-overlay");
  });

  test("die eigene Session ist beschreibbar, und zwar über dem tmpfs, das die fremden verbirgt", () => {
    const args = bwrap();
    const ownSession = `${agent}/sessions/${piSessionSlug(cwd)}`;
    const overlay = at(args, "--overlay-src", agent);
    const tmpfs = at(args, "--tmpfs", `${agent}/sessions`);
    const ownBind = at(args, "--bind", ownSession, ownSession);
    expect(overlay).toBeGreaterThan(-1);
    // später gewinnt: Overlay, dann leeres sessions/, dann die eine Session zurück
    expect(tmpfs).toBeGreaterThan(overlay);
    expect(ownBind).toBeGreaterThan(tmpfs);
  });

  test("eine fremde Session ist nicht sichtbar: nichts außer der eigenen Session ist unter sessions/ gebunden", () => {
    const args = bwrap();
    const ownSession = `${agent}/sessions/${piSessionSlug(cwd)}`;
    const binds = args.flatMap((a, k) => (a === "--bind" || a === "--ro-bind" || a === "--ro-bind-try" ? [args[k + 2]!] : []));
    expect(binds.filter((d) => d.startsWith(`${agent}/sessions/`))).toEqual([ownSession]);
  });

  test("auth.json bleibt nur lesbar und kommt nach dem Overlay", () => {
    const args = bwrap();
    const auth = at(args, "--ro-bind-try", `${agent}/auth.json`, `${agent}/auth.json`);
    expect(auth).toBeGreaterThan(at(args, "--overlay-src", agent));
    expect(at(args, "--bind", `${agent}/auth.json`, `${agent}/auth.json`)).toBe(-1);
  });

  test("pi-zai-unfenced nennt ein anderes Home als pi-zai: der Zaun einer Belegung fasst das andere Home nicht an", () => {
    const a = bwrap(agent), b = bwrap(other);
    expect(at(a, "--overlay-src", agent)).toBeGreaterThan(-1);
    expect(a).not.toContain(other);
    expect(at(b, "--overlay-src", other)).toBeGreaterThan(-1);
    expect(b).not.toContain(agent);
  });
});

// --- SBPL: eine kleine Auswertung nach Apples Regeln. Eine Regel `(allow|deny OPS FILTER…)`; wer zuletzt zutrifft, entscheidet;
// ohne Treffer gilt der Standard `(allow default)`. Operationen werden nach NAMEN verglichen (der Wildcard-Fall steht im
// Kommentar des Zauns); Regex-Filter treffen hier nichts (sie betreffen nur fleet.json und .env).
function rules(profile: string): { verdict: "allow" | "deny"; ops: string[]; filters: ({ kind: "subpath" | "literal"; path: string })[] }[] {
  const out: ReturnType<typeof rules> = [];
  for (const m of profile.matchAll(/\((allow|deny) ((?:[a-z*-]+ )+)((?:\((?:subpath|literal|regex|remote)[^)]*(?:\([^)]*\))?[^)]*\)\s*)+)\)/g)) {
    const filters = [...m[3]!.matchAll(/\((subpath|literal) "([^"]+)"\)/g)].map((f) => ({ kind: f[1] as "subpath" | "literal", path: f[2]! }));
    out.push({ verdict: m[1] as "allow" | "deny", ops: m[2]!.trim().split(" "), filters });
  }
  return out;
}
const allowed = (profile: string, op: string, path: string): boolean => {
  let verdict = true;
  for (const r of rules(profile)) {
    if (!r.ops.includes(op)) continue;
    if (r.filters.some((f) => (f.kind === "literal" ? path === f.path : path === f.path || path.startsWith(`${f.path}/`)))) verdict = r.verdict === "allow";
  }
  return verdict;
};

describe("SBPL: das pi-Agent-Home im Zaun", () => {
  const profile = piZaiFenceProfile({ ...input(agent), darwin: false })!;
  const ownSession = `${agent}/sessions/${piSessionSlug(cwd)}`;
  const writable = (p: string): boolean => allowed(profile, "file-write*", p);
  const readable = (p: string): boolean => allowed(profile, "file-read-data", p);

  test("das Profil ist gebaut, und die Auswertung sieht die Regeln (sonst prüfte der Rest nichts)", () => {
    expect(profile).toBeTruthy();
    expect(rules(profile).length).toBeGreaterThan(8);
    // die Auswertung trennt: das Arbeitsverzeichnis ist beschreibbar, das Home daneben nicht
    expect(writable(`${cwd}/x.ts`)).toBe(true);
    expect(writable(`${home}/other.txt`)).toBe(false);
  });

  test("das Home ist nur lesbar: nichts, was pi lädt, kann geschrieben werden, auch eine neue Datei nicht", () => {
    for (const f of ["settings.json", "extensions/x.ts", "skills/a/SKILL.md", "prompts/p.md", "mcp.json", "models.json", "AGENTS.md",
      "SYSTEM.md", "APPEND_SYSTEM.md", "models-store.json", "trust.json", "fleet-start/start.md"]) {
      expect(writable(`${agent}/${f}`)).toBe(false);
      expect(readable(`${agent}/${f}`)).toBe(true);
    }
  });

  test("nur die Lock-Verzeichnisse sind beschreibbar, nicht die Dateien, die sie schützen", () => {
    for (const n of PI_AGENT_HOME_LOCKS) expect(writable(`${agent}/${n}`)).toBe(true);
    expect(writable(`${agent}/settings.json.lock/x`)).toBe(false); // der Name, nicht der Baum darunter
    expect(writable(`${agent}/auth.json`)).toBe(false);
    expect(writable(`${agent}/models-store.json`)).toBe(false);
  });

  test("die eigene Session ist beschreibbar, eine fremde weder les- noch beschreibbar", () => {
    expect(writable(`${ownSession}/2026_abc.jsonl`)).toBe(true);
    expect(writable(`${agent}/sessions/--fremd--/2026_abc.jsonl`)).toBe(false);
    expect(readable(`${agent}/sessions/--fremd--/2026_abc.jsonl`)).toBe(false);
  });

  test("auth.json ist nur lesbar (leer) oder gar nicht: nie beschreibbar", () => {
    expect(writable(`${agent}/auth.json`)).toBe(false);
  });

  test("auch ein Agent-Home außerhalb des geschlossenen Homes ist nicht beschreibbar (Standard erlaubt sonst)", () => {
    // weder unter dem Home noch unter den geschlossenen Temp-Wurzeln, sonst schlösse sie schon (A)
    const elsewhere = realpathSync(mkdtempSync(join(existsSync("/var/tmp") ? "/var/tmp" : join(import.meta.dir, ".."), "fleet-pihome-else-")));
    process.on("exit", () => rmSync(elsewhere, { recursive: true, force: true }));
    const p = piZaiFenceProfile({ ...input(elsewhere), darwin: false })!;
    expect(allowed(p, "file-write*", `${elsewhere}/extensions/x.ts`)).toBe(false);
    expect(allowed(p, "file-write*", `${elsewhere}/settings.json.lock`)).toBe(true);
  });

  test("pi-zai-unfenced nennt ein anderes Home als pi-zai: dessen Dateien sind im Zaun von pi-zai nicht beschreibbar", () => {
    expect(writable(`${other}/settings.json`)).toBe(false);
    expect(writable(`${other}/extensions/x.ts`)).toBe(false);
  });
});
