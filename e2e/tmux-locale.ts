import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SOCK as SERVER_SOCK } from "../server/tmux";
import { ROOT, SOCK, UntilTimeout, check, post, restartSrv, tmuxOut, until, wsUrl, ownerWs } from "./harness";

interface Probe {
  created: { code: number; timedOut: boolean; out: string };
  target: { paneId: string; windowId: string } | null;
  shown: string; raw: string; root: string | null; known: boolean;
  size: string; pane: string; rawPane: string; paneEnv: string; rawPaneEnv: string;
  missing: { paneId: string; windowId: string } | null;
}

export async function run(): Promise<void> {
  if (SERVER_SOCK !== SOCK) throw new Error("tmux-locale: wrapper and runner sockets disagree");
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), "fleet-tmux-locale-")));
  const cwd = join(scratch, "pane path with spaces");
  mkdirSync(cwd);
  const source = readFileSync(join(ROOT, "server.ts"), "utf8");
  const fn = (name: string): string => {
    const start = source.indexOf(`async function ${name}(`);
    const end = source.indexOf("\n}", start);
    if (start < 0 || end < 0) throw new Error(`tmux-locale: missing function ${name}`);
    return source.slice(start, end + 2);
  };
  const parserStart = source.indexOf("const parseTmuxTarget =");
  const parserEnd = source.indexOf("\n};", parserStart);
  if (parserStart < 0 || parserEnd < 0) throw new Error("tmux-locale: missing target parser");
  const newFormat = source.match(/tmuxNewSession\("-d", "-P", "-F", ("[^"\n]+")/)?.[1];
  const sizeFormat = source.match(/tmux\("display-message", "-p", "-t", windowId, ("[^"\n]+")/)?.[1];
  if (!newFormat || !sizeFormat) throw new Error("tmux-locale: missing server formats");
  const functions = new Bun.Transpiler({ loader: "ts" }).transformSync([
    source.slice(parserStart, parserEnd + 3), fn("existingTmuxTarget"), fn("observeTmuxSlots"),
  ].join("\n"));
  const probePath = join(scratch, "probe.ts");
  const panePrefix = 'printf \'%s|%s|%s\' "${LANG-unset}" "${LC_ALL-unset}" "${LC_CTYPE-unset}" > ';
  writeFileSync(probePath, `
import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute } from "node:path";
import { tmux, tmuxNewSession } from ${JSON.stringify(join(ROOT, "server/tmux.ts"))};
const sessTarget = name => "=" + name;
const paneTarget = name => "=" + name + ":";
const repoCanon = path => realpathSync(path);
${functions}
const cwd = ${JSON.stringify(cwd)};
const paneCommand = file => ${JSON.stringify(panePrefix)} + "'" + file + "'; printf 'locale-pane-ready\\\\n'; exec sleep 120";
const raw = async (...args) => {
  const p = Bun.spawn(["tmux", "-L", process.env.FLEET_SOCK, ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { out: out.trim(), err: err.trim(), code };
};
try {
  const created = await tmuxNewSession("-d", "-P", "-F", ${newFormat}, "-s", "locale", "-x", "91", "-y", "31", "-c", cwd, paneCommand(${JSON.stringify(join(scratch, "pane-env"))}));
  const control = await raw("new-session", "-d", "-s", "raw", "-x", "91", "-y", "31", "-c", cwd, paneCommand(${JSON.stringify(join(scratch, "raw-pane-env"))}));
  if (control.code !== 0) throw new Error("raw pane creation failed: " + control.err);
  const target = await existingTmuxTarget("locale");
  const shown = await tmux("display-message", "-p", "-t", "=locale:", ${newFormat});
  const legacy = await raw("display-message", "-p", "-t", "=locale:", ${newFormat});
  const observed = await observeTmuxSlots();
  const size = await tmux("display-message", "-p", "-t", "=locale:", ${sizeFormat});
  let pane = "", rawPane = "";
  for (let i = 0; i < 100; i++) {
    pane = (await tmux("capture-pane", "-p", "-t", "=locale:")).out;
    rawPane = (await tmux("capture-pane", "-p", "-t", "=raw:")).out;
    if (pane.includes("locale-pane-ready") && rawPane.includes("locale-pane-ready")) break;
    await Bun.sleep(20);
  }
  console.log(JSON.stringify({ created, target, shown: shown.out, raw: legacy.out,
    known: observed.known, root: observed.sessions.get("locale") ?? null, size: size.out, pane, rawPane,
    paneEnv: readFileSync(${JSON.stringify(join(scratch, "pane-env"))}, "utf8"),
    rawPaneEnv: readFileSync(${JSON.stringify(join(scratch, "raw-pane-env"))}, "utf8"),
    missing: await existingTmuxTarget("absent") }));
} finally { await tmux("kill-server"); }
`);
  const locales: { name: string; env: Record<string, string> }[] = [
    { name: "UTF-8", env: { LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" } },
    { name: "no LANG/LC_ALL", env: {} },
    { name: "LANG=C", env: { LANG: "C", LC_ALL: "C" } },
  ];
  const globalEnvironment = await tmuxOut("show-environment", "-g");
  const keeper = `tmux-locale-keep-${process.pid}`;
  let keeperOwned = false;
  try {
    const kept = await tmuxOut("new-session", "-d", "-s", keeper, "sleep 600");
    if (kept.code !== 0) throw new Error("tmux-locale: isolated daemon keeper unavailable");
    keeperOwned = true;
    let baseline: Probe | null = null;
    for (const [index, locale] of locales.entries()) {
      const env: Record<string, string> = {
        PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? scratch,
        SHELL: "/bin/sh", FLEET_SOCK: `${SOCK}-locale-${index}`, ...locale.env,
      };
      if (process.env.TMUX_TMPDIR) env.TMUX_TMPDIR = process.env.TMUX_TMPDIR;
      const p = Bun.spawn([process.execPath, probePath], { env, stdout: "pipe", stderr: "pipe" });
      const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
      check(`tmux-locale: ${locale.name} probe executes in a minimal environment`, code === 0, err);
      if (code !== 0) continue;
      const result = JSON.parse(out) as Probe;
      baseline ??= result;
      check(`tmux-locale: ${locale.name} new-session returns exact pane/window IDs`,
        result.created.code === 0 && !result.created.timedOut && /^%\d+\t@\d+$/.test(result.created.out), result.created.out);
      check(`tmux-locale: ${locale.name} existingTmuxTarget finds the same IDs as UTF-8`,
        result.target !== null && JSON.stringify(result.target) === JSON.stringify(baseline.target)
          && result.shown === result.created.out && result.shown === baseline.shown,
        JSON.stringify({ target: result.target, shown: result.shown, withoutU: result.raw }));
      check(`tmux-locale: ${locale.name} enumeration preserves the path with spaces`,
        result.known && result.root === cwd && result.root === baseline.root, String(result.root));
      check(`tmux-locale: ${locale.name} numeric space-separated format is unchanged`,
        result.size === "91 31" && result.size === baseline.size, result.size);
      check(`tmux-locale: ${locale.name} -u leaves pane output and environment unchanged`,
        result.pane === "locale-pane-ready" && result.rawPane === result.pane
          && result.paneEnv === result.rawPaneEnv, JSON.stringify({ pane: result.pane, paneEnv: result.paneEnv, rawPaneEnv: result.rawPaneEnv }));
      check(`tmux-locale: ${locale.name} an absent exact target stays unavailable`, result.missing === null);
    }

    const bin = join(scratch, "bin");
    mkdirSync(bin);
    const envProof = join(scratch, "server-locale");
    const quote = (value: string): string => "'" + value.replaceAll("'", "'\\''") + "'";
    for (const locale of locales) {
      writeFileSync(join(bin, "bun"), "#!/bin/sh\nunset LANG LC_ALL LC_CTYPE LC_COLLATE LC_MESSAGES LC_MONETARY LC_NUMERIC LC_TIME TMUX TMUX_PANE\n"
        + Object.entries(locale.env).map(([k, v]) => `export ${k}=${quote(v)}\n`).join("")
        + `printf '%s|%s|%s' "\${LANG-unset}" "\${LC_ALL-unset}" "\${LC_CTYPE-unset}" > ${quote(envProof)}\n`
        + `exec ${quote(process.execPath)} "$@"\n`);
      chmodSync(join(bin, "bun"), 0o755);
      await restartSrv({ PATH: `${bin}:${process.env.PATH ?? ""}` });
      check(`tmux-locale: ${locale.name} server starts with the requested locale`,
        readFileSync(envProof, "utf8") === `${locale.env.LANG ?? "unset"}|${locale.env.LC_ALL ?? "unset"}|unset`);
      try {
        const opened = await post("/api/slots/14/open", { cwd });
        check(`tmux-locale: ${locale.name} server creates a usable slot`, opened.ok, String(opened.status));
        if (!opened.ok) continue;
        // longer than the slot's 200 columns, so the line wraps inside the marker whatever the prompt: a shell that counts the
        // header's `·` as two columns (a pane in LANG=C) cuts it in two there. Red only in the helper's audit until 24.10.,
        // whose long scratch path put a 72-character text's wrap into the marker (prompt 138 columns; the merge check had 126).
        const marker = `tmux-locale-send-${locale.name.replaceAll(/[^a-zA-Z0-9]/g, "-")}-${"0123456789".repeat(21)}`;
        const sent = await post("/send", { slot: 14, text: marker, submit: false });
        const body = await sent.json() as { error?: string };
        check(`tmux-locale: ${locale.name} /send accepts the exact pane`, sent.ok, JSON.stringify({ status: sent.status, error: body.error }));
        if (sent.ok) {
          // a miss is this check's FAIL with the pane as it stood, never a throw that ends the shard
          let screen = "";
          const pasted = await until(async () => {
            screen = (await tmuxOut("capture-pane", "-p", "-J", "-t", "=s14:")).out;
            return screen.includes(marker);
          }, { timeoutMs: 5000, stepMs: 50, what: `tmux-locale ${locale.name} paste visible` })
            .catch((e) => { if (e instanceof UntilTimeout) return false; throw e; });
          check(`tmux-locale: ${locale.name} /send really pastes into the pane`, pasted, pasted ? "" : JSON.stringify({ screen: screen.trimEnd() }));
        }
        const connected = await new Promise<boolean>((resolve) => {
          const ws = ownerWs(wsUrl(14));
          const timer = setTimeout(() => { ws.close(); resolve(false); }, 5000);
          ws.onopen = () => { clearTimeout(timer); ws.close(); resolve(true); };
          ws.onerror = () => { clearTimeout(timer); resolve(false); };
          ws.onclose = () => { clearTimeout(timer); resolve(false); };
        });
        check(`tmux-locale: ${locale.name} WebSocket accepts the exact pane`, connected);
      } finally { await post("/api/slots/14/kill", {}); }
    }
  } finally {
    await restartSrv({ PATH: process.env.PATH ?? "/usr/bin:/bin" });
    const restoredEnvironment = await tmuxOut("show-environment", "-g");
    check("tmux-locale: server restarts preserve the daemon's entire global environment",
      globalEnvironment.code === 0 && restoredEnvironment.code === 0
        && globalEnvironment.out === restoredEnvironment.out);
    if (keeperOwned) {
      const stopped = await tmuxOut("kill-session", "-t", `=${keeper}`);
      check("tmux-locale: cleanup removes its exact daemon keeper", stopped.code === 0);
    }
    rmSync(scratch, { recursive: true, force: true });
  }
}
