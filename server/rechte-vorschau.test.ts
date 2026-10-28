// DIE VORSCHAU DES STARTFENSTERS FÜR EINEN NEUEN START, am echten Weg statt am Browser (main war am 28.10. rot: „k15 start DOM:
// Rights-Stein“). Das Fenster liest zwei Vorschauen (src/start-fenster.ts#urls, Adresse aus src/k15-zustand.ts#planUrl): normal ohne
// Wahl und diese Wahl als Zusatz an dieselbe Adresse — beide mit role=nur-ordner, anlass=neu. Die Route rechnet sie über den Slot, den
// die Öffnung stempeln würde (server.ts#foundingPlanAnswer → fassungDerOeffnung → fassungFuerSlot); darum geht die gewählte
// Rechte-Stufe dort als `s.rechte` in den „darf“-Abschnitt.
//
// Geprüft wird beides, was den Rechte-Block im Startbrief trägt (src/start-brief.ts:182f: nur bei `rj !== rn`): der „darf“-Abschnitt
// der Wahl unterscheidet sich von dem ohne Wahl, und der Satz der Stufe steht nur auf der Seite der Wahl. Eine Vorschau, die die Stufe
// nicht nennt, trägt denselben Satz wie eine ohne Wahl — dann fällt der Block weg, auf den die DOM-Prüfung klickt.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rechteSatz } from "./rechte";
import type { Rechte } from "../session-rechte";

const ROOT = join(import.meta.dir, "..");

const gitRepo = (dir: string): void => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "AGENTS.md"), "AGENTS fixture\n");
  writeFileSync(join(dir, "CLAUDE.md"), "Projektregel fixture\n");
  Bun.spawnSync(["git", "init", "-q"], { cwd: dir });
  Bun.spawnSync(["git", "add", "."], { cwd: dir });
  Bun.spawnSync(["git", "-c", "user.email=f@f.f", "-c", "user.name=f", "commit", "-qm", "init"], { cwd: dir });
};
const freierPort = (): number => {
  const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const port = probe.port;
  probe.stop(true);
  if (port === undefined) throw new Error("kein freier Port");
  return port;
};

// was die beiden Vorschauen sagen: der „darf“-Abschnitt jeder Seite, und was der Startbrief daraus macht
interface Vorschau {
  status: number;
  hash: string | null;
  darf: string | null;
  startbar: boolean | null;
  brief: { key: string; herkunft: string; zeichen: string | null; text: string | null }[] | null;
  fehler?: string;
}

describe("die Vorschau eines neuen Starts: eine gewählte Rechte-Stufe trägt ihren eigenen „darf“-Satz", () => {
  const dir = mkdtempSync(join(tmpdir(), "rechte-vorschau-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test("role=nur-ordner mit rechte { stufe: lesen } weicht von derselben Adresse ohne Wahl ab, und der Startbrief zeigt den Rechte-Block", async () => {
    const repo = join(dir, "repo");
    gitRepo(repo);
    mkdirSync(join(dir, "state"), { recursive: true });
    mkdirSync(join(dir, "home"), { recursive: true });
    const out = join(dir, "out.json");
    const port = freierPort();
    const rechte: Rechte = { stufe: "lesen", an: [], aus: [] };
    const script = `
      const S = await import(${JSON.stringify(join(ROOT, "server.ts"))});
      const B = await import(${JSON.stringify(join(ROOT, "src/start-brief.ts"))});
      const owner = "vorschautest-" + process.pid;
      process.env.FLEET_TOKEN = owner;
      S.adoptTokens();
      const server = { requestIP: () => null };
      const call = async (path) => {
        const req = new Request("http://127.0.0.1:" + process.env.FLEET_PORT + path, { method: "GET",
          headers: { host: "127.0.0.1:" + process.env.FLEET_PORT, authorization: "Bearer " + owner } });
        const res = await S.serveOptions.fetch.call(server, req, server);
        return { status: res.status, body: await res.json().catch(() => null) };
      };
      const repo = process.env.FIX_REPO;
      const rechte = ${JSON.stringify({ stufe: "lesen", an: [], aus: [] })};
      // die zwei Adressen, die das Fenster liest (src/start-fenster.ts#urls über src/k15-zustand.ts#planUrl)
      const normal = "/api/founding-plan?" + new URLSearchParams({ repo, role: "nur-ordner", anlass: "neu" }).toString();
      const wahl = normal + "&" + new URLSearchParams({ rechte: JSON.stringify(rechte) }).toString();
      const darfOf = (a) => a.body?.fassung?.teile?.find((t) => t.id === "darf")?.abschnitte?.find((x) => x.id === "darf")?.text ?? null;
      const n = await call(normal), w = await call(wahl);
      const dabei = { repo, gitNormal: null, gitJetzt: null, aufgabe: null, hooksAus: false, ccTokens: null };
      const brief = n.status === 200 && w.status === 200 ? B.startbrief(w.body.fassung, n.body.fassung, dabei) : null;
      const einer = (a) => a.status === 200 ? { status: a.status, hash: a.body.fassungsHash ?? null, darf: darfOf(a),
        startbar: a.body.start?.startbar ?? null } : { status: a.status, hash: null, darf: null, startbar: null, fehler: JSON.stringify(a.body).slice(0, 400) };
      const bloecke = brief ? [...brief.anweisungen, ...brief.ersteNachricht, ...brief.wartend].map((b) => ({ key: b.key, herkunft: b.herkunft, zeichen: b.zeichen, text: b.text })) : null;
      await Bun.write(${JSON.stringify(out)}, JSON.stringify({ normal: einer(n), wahl: einer(w), bloecke }));
      process.exit(0);
    `;
    const proc = Bun.spawn([process.execPath, "--no-env-file", "-e", script], { cwd: ROOT, stdout: "pipe", stderr: "pipe",
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: join(dir, "home"), SHELL: "/bin/sh", FLEET_HOST: "127.0.0.1", FLEET_PORT: String(port),
        FLEET_SOCK: `rechtevorschau${process.pid}`, FLEET_STATE_DIR: join(dir, "state"), FLEET_CMD: "/bin/true", FIX_REPO: repo } });
    const code = await Promise.race([proc.exited, Bun.sleep(120_000).then(() => { proc.kill("SIGKILL"); return -1; })]);
    const stderr = await new Response(proc.stderr).text();
    expect({ code, stderr: code === 0 ? "" : stderr.slice(-1500) }).toEqual({ code: 0, stderr: "" });
    const got = JSON.parse(readFileSync(out, "utf8")) as { normal: Vorschau; wahl: Vorschau; bloecke: Vorschau["brief"] };

    // beide Vorschauen lesbar
    expect([got.normal.status, got.wahl.status]).toEqual([200, 200]);
    const ohne = got.normal.darf ?? "", mit = got.wahl.darf ?? "";
    // der Satz der Stufe steht NUR auf der Seite der Wahl — sonst wären „jetzt“ und „normal“ gleich und der Block fiele weg
    const stufeSatz = rechteSatz({ stufe: "lesen", an: [], aus: [] });
    expect([ohne.includes("FLEET RIGHTS (level"), ohne.includes(stufeSatz)]).toEqual([false, false]);
    expect(mit.includes(stufeSatz)).toBe(true);
    // Server-Rechte bleiben die erste Zeile (der Start und die Abnahme lesen sie so), die Stufe folgt darin
    expect(mit.startsWith("FLEET SERVER RIGHTS (checked at Fleet's doors):")).toBe(true);
    expect(mit.includes("seat.open — open a seat")).toBe(true);
    // …und das ist genau die Bedingung, unter der der Startbrief den Block zeigt (src/start-brief.ts:182f)
    expect(mit).not.toBe(ohne);
    const block = (got.bloecke ?? []).find((b) => b.key === "rechte");
    expect(block ? { herkunft: block.herkunft, zeichen: block.zeichen } : null).toEqual({ herkunft: "fleet", zeichen: "+" });
    expect(block!.text).toBe(mit);
  }, 130_000);
});
