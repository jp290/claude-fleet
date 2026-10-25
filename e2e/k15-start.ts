// A START FROM THE START WINDOW AGAINST THIS INSTANCE (owner 24.10., src/start-fenster.ts; the build: K15 Runde 5, owner 17.10. „[Zitat entfernt]“
// ). A click on a free place opens the start window; a start there
// gives a session whose door took the Fassung the start brief showed (server.ts#fassungGezeigtPruefung: a hash that moved is a 409), and
// the build over „Lanes, MAIN and constellations ›“ gives a lane with exactly the chosen repo, agent, model and effort, read back at the
// session the server made. Nothing here is stubbed: like e2e/slots.ts#runRightsDom the staged server answers every request; the probe's
// own part is named — the bundles are built from `sourceRoot` and handed to the page in place of the served /app.js, /k15.js, /k15.css
// and /sitzung.css, so a mutant tree is measured against the same server. Both sessions take the same free place one after the other and
// live on FLEET_E2E_REPO (a fixture repo, Mangel 91); each is killed again, the lane's worktree removed. Driven by e2e/dom.ts.
import { mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export interface K15StartLiveResult { claims: Record<string, boolean>; facts: Record<string, unknown> }
export interface K15StartLiveMutant { name: string; claim: keyof typeof K15_START_LIVE_CLAIM; file: string; needle: string; with: string }

export const K15_START_LIVE_CLAIM = {
  opens: "a click on a free place of the bar opens the start window with the repo's own agent; „Lanes, MAIN and constellations ›“ leads to the build with a lane chosen — the old start window does not open",
  fenster: "Start in the start window, on the fixture repo as the repo's agent with „+ Rights“, gives a session on that place in that repo: the door took the Fassung the start brief showed (no 409), and the session's held start Fassung carries the rights sentence",
  values: "„… starten“ in the build gives a session on that place with the repo, the agent, the model and the effort chosen in the window, as the server reports them",
  closes: "after each start the window is gone, and the place it started stands with a session",
} as const;

// each mutant must turn its claim red; a needle that left the source throws
export const K15_START_LIVE_MUTANTS: readonly K15StartLiveMutant[] = [
  { name: "the lane door drops the chosen triple", claim: "values", file: "src/start-tuer.ts",
    needle: `return await tuer(url, { repo: a.repo, ...(a.parent ? { parent: a.parent } : {}), branch: "", ...a.dreier, plan: a.plan }, a.slot);`,
    with: `return await tuer(url, { repo: a.repo, ...(a.parent ? { parent: a.parent } : {}), branch: "", plan: a.plan }, a.slot);` },
  { name: "a free place opens no window", claim: "opens", file: "src/client.ts",
    needle: `row.onclick = () => openK15Entwurf({ slot: s.id });`, with: `row.onclick = () => undefined;` },
  { name: "the start window sends a Fassung its start brief did not show", claim: "fenster", file: "src/start-fenster.ts",
    needle: "...(a.fassungsHash && !rolle ? { fassung: a.fassungsHash } : {})", with: "...(a.fassungsHash && !rolle ? { fassung: \"0\".repeat(64) } : {})" },
];

export async function runK15StartLiveDom(o: { base: string; token: string; repo: string; sourceRoot: string; mutate?: K15StartLiveMutant }): Promise<K15StartLiveResult> {
  const scratch = resolve(tmpdir(), `fleet-k15-start-${process.pid}-${crypto.randomUUID()}`);
  mkdirSync(scratch, { recursive: true });
  const m = o.mutate;
  const mutantPath = m ? resolve(o.sourceRoot, m.file) : null;
  let applied = !m;
  const plugins = m ? [{ name: "k15-start-mutant", setup(build: Bun.PluginBuilder) {
    build.onLoad({ filter: /\.ts$/ }, ({ path }) => {
      if (path !== mutantPath) return;
      const source = readFileSync(path, "utf8");
      applied ||= source.includes(m.needle);
      return { contents: source.replace(m.needle, m.with), loader: "ts" };
    });
  } }] : [];
  const bundle = async (entry: string) => {
    const b = await Bun.build({ entrypoints: [resolve(o.sourceRoot, entry)], target: "browser", plugins });
    if (!b.success) throw new Error(b.logs.join("\n"));
    return b.outputs[0]!.text();
  };
  const appJs = await bundle("src/client.ts");
  const k15Js = await bundle("src/k15-entwurf.ts");
  const k15Css = readFileSync(resolve(o.sourceRoot, "public/k15.css"), "utf8");
  const sitzungCss = readFileSync(resolve(o.sourceRoot, "public/sitzung.css"), "utf8");
  if (!applied) { rmSync(scratch, { recursive: true, force: true }); throw new Error(`k15 start mutant: needle not in ${m?.file}: ${m?.needle.slice(0, 80)}`); }

  const OH = { "content-type": "application/json", authorization: `Bearer ${o.token}` };
  const own = (method: string, path: string, body?: unknown) =>
    fetch(o.base + path, { method, headers: OH, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  type Row = { id: number; cwd: string | null; openedAt?: number; harness?: string; model?: string | null; effort?: string;
    worktree?: { repo: string; branch: string } | null; repo?: string | null };
  const rows = async (): Promise<Row[]> => ((await (await own("GET", "/api/sessions")).json()) as { slots: Row[] }).slots;
  const real = (p: string) => { try { return realpathSync(p); } catch { return p; } };
  const claims: Record<string, boolean> = {};
  const facts: Record<string, unknown> = { mutant: m?.name ?? null };
  // one free place: the start window's session takes it, is read back and killed, then the build's lane takes it
  const free = (await rows()).find((r) => r.id <= 16 && !r.cwd);
  if (!free) { rmSync(scratch, { recursive: true, force: true }); throw new Error("k15 start: no free band slot"); }
  facts.slot = free.id;

  const executable = process.env.FLEET_E2E_BROWSER ?? Bun.which("chromium") ?? Bun.which("chromium-browser") ?? Bun.which("google-chrome") ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!Bun.file(executable).size) { rmSync(scratch, { recursive: true, force: true }); throw new Error("k15 start probe needs Chromium (FLEET_E2E_BROWSER): " + executable); }
  const browser = Bun.spawn([executable, "--headless", "--password-store=basic", "--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-background-networking",
    "--remote-debugging-port=0", `--user-data-dir=${scratch}/profile`, "about:blank"], { stdout: "ignore", stderr: "pipe" });
  let socket: WebSocket | undefined;
  // THE FIXTURE REPO MUST BE CHOOSABLE: the window offers the repos of running sessions and the pinned ones (src/k15-zustand.ts#repoZeilen),
  // „Repo hinzufügen“ pins (POST /api/pins). The repo is pinned here as the owner adds one, and unpinned again; a full list
  // (server.ts#MAX_PINS) would push out another pin, so then nothing runs
  let pinned = false;
  try {
    const before = ((await (await own("GET", "/api/dirs?path=~")).json()) as { pins?: string[] }).pins ?? [];
    if (!before.includes(o.repo)) {
      if (before.length >= 20) throw new Error(`k15 start: ${before.length} pins, pinning the fixture repo would push one out`);
      pinned = (await own("POST", "/api/pins", { path: o.repo, on: true })).ok;
      if (!pinned) throw new Error("k15 start: the fixture repo could not be pinned");
    }
    let log = "";
    const endpoint = await Promise.race([
      (async () => { for await (const c of browser.stderr) { log += new TextDecoder().decode(c); const x = /DevTools listening on (ws:\/\/\S+)/.exec(log); if (x) return x[1]!; } throw new Error("browser exited: " + log); })(),
      Bun.sleep(45000).then(() => { throw new Error("browser CDP startup timeout: " + log); }),
    ]);
    socket = new WebSocket(endpoint);
    await new Promise<void>((ok, bad) => { socket!.onopen = () => ok(); socket!.onerror = () => bad(new Error("CDP connection failed")); });
    let serial = 0, sessionId: string | undefined;
    const pending = new Map<number, (v: Record<string, unknown>) => void>();
    const send = (method: string, params: Record<string, unknown> = {}) => new Promise<Record<string, unknown>>((ok, bad) => {
      const id = ++serial;
      const t = setTimeout(() => { pending.delete(id); bad(new Error("CDP timeout: " + method)); }, 30000);
      pending.set(id, (v) => { clearTimeout(t); ok(v); });
      socket!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const served: Record<string, { body: string; type: string }> = {
      "/app.js": { body: appJs, type: "text/javascript" }, "/k15.js": { body: k15Js, type: "text/javascript" }, "/k15.css": { body: k15Css, type: "text/css" },
      "/sitzung.css": { body: sitzungCss, type: "text/css" } };
    socket.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as { id?: number; result?: Record<string, unknown>; error?: unknown; method?: string; params?: Record<string, unknown> };
      if (msg.id !== undefined) { pending.get(msg.id)?.(msg.error ? { error: msg.error } : msg.result ?? {}); pending.delete(msg.id); return; }
      if (msg.method === "Page.javascriptDialogOpening") { void send("Page.handleJavaScriptDialog", { accept: false }).catch(() => undefined); return; }
      // the substituted responses: the bundles and the stylesheet of the tree under test instead of the served ones
      if (msg.method === "Fetch.requestPaused" && msg.params) {
        const { requestId, request } = msg.params as { requestId: string; request: { url: string } };
        const f = served[new URL(request.url).pathname];
        if (!f) { void send("Fetch.continueRequest", { requestId }).catch(() => undefined); return; }
        void send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: f.type }],
          body: Buffer.from(f.body).toString("base64") }).catch(() => undefined);
      }
    };
    const target = await send("Target.createTarget", { url: "about:blank" });
    sessionId = String((await send("Target.attachToTarget", { targetId: target.targetId, flatten: true })).sessionId);
    await send("Fetch.enable", { patterns: ["/app.js", "/k15.js", "/k15.css", "/sitzung.css"].map((p) => ({ urlPattern: `${o.base}${p}*` })) });
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    const evaluate = async <T>(expression: string): Promise<T | null> => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      return r.exceptionDetails ? null : (r.result as { value: T }).value;
    };
    const wait = async (condition: string, ms = 8000): Promise<boolean> => !!await evaluate<boolean>(`new Promise((ok) => { const until = Date.now() + ${ms};
      const tick = () => { let v = false; try { v = !!(${condition}); } catch {} if (v) return ok(true); if (Date.now() > until) return ok(false); setTimeout(tick, 50); }; tick(); })`);
    // a real pointer on the element's centre, as the owner's click
    const click = async (expression: string): Promise<boolean> => {
      const at = await evaluate<{ x: number; y: number } | null>(`(() => { const e = ${expression}; if (!e) return null; e.scrollIntoView({ block: 'center' });
        const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      if (!at) return false;
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, ...at, button: "left", clickCount: 1 });
      await Bun.sleep(120);
      return true;
    };
    await send("Page.navigate", { url: `${o.base}/?token=${o.token}` });
    await wait(`document.querySelector('.slot.empty[data-slot="${free.id}"]')`, 15000);
    await evaluate(`localStorage.setItem('fleet.k15.rundgang', '1')`);
    const repos = JSON.stringify([o.repo, real(o.repo)]);

    // 1. the free place opens the start window; on the fixture repo the repo's agent with „+ Rights“ starts there, and the door takes the
    // Fassung its start brief showed
    await click(`document.querySelector('.slot.empty[data-slot="${free.id}"]')`);
    const fenster = await wait(`document.querySelector('#shell-found.k15sitz .sf.s1 .sfag.repoag')`, 10000);
    if (fenster) {
      await click(`[...document.querySelectorAll('#shell-found .sfrepo')].find((r) => (${repos}).includes(r.dataset.repo))`);
      await wait(`(${repos}).includes(document.querySelector('#shell-found .sfrepo.sel')?.dataset.repo) && document.querySelector('#shell-found .sfag.repoag')`, 10000);
      await click(`document.querySelector('#shell-found .sfag.repoag')`);
      await wait(`document.querySelector('#shell-found .sf.s2 .sfaddon[data-add="rights"]')`, 10000);
      await click(`document.querySelector('#shell-found .sfaddon[data-add="rights"]')`);
    }
    const bereit = fenster && await wait(`document.querySelector('#shell-found .sftile[data-b="rights"]') && !document.querySelector('#shell-found .sfsheet.laedt')
      && document.querySelector('#shell-found .sfgo') && !document.querySelector('#shell-found .sfgo').disabled`, 15000);
    facts.fenster = await evaluate(`({ repo: document.querySelector('#shell-found .sfrepo.sel')?.dataset.repo ?? null,
      banner: document.querySelector('#shell-found .sfbanner h3')?.textContent ?? null, hint: document.querySelector('#shell-found .sfhint')?.textContent ?? null })`);
    if (bereit) await click(`document.querySelector('#shell-found .sfgo')`);
    const fensterZu = bereit && await wait(`!document.querySelector('#shell-found')`, 20000);
    if (!fensterZu) facts.fensterStehen = await evaluate(`document.querySelector('#shell-found .sfhint')?.textContent ?? null`);
    const amOrt = (await rows()).find((r) => r.id === free.id);
    const gehalten = amOrt?.cwd ? await (await own("GET", `/api/slots/${free.id}/fassung?anlass=laufend`)).json().catch(() => null) as
      { teile?: { id: string; abschnitte: { id: string; text?: string | null }[] }[]; festgehalten?: unknown } | null : null;
    const rechteSatz = gehalten?.teile?.find((t) => t.id === "darf")?.abschnitte.find((x) => x.id === "darf")?.text ?? null;
    facts.fensterSlot = { cwd: amOrt?.cwd ?? null, rechteSatz: rechteSatz?.slice(0, 160) ?? null, festgehalten: !!gehalten?.festgehalten };
    claims.fenster = fensterZu && !!amOrt?.cwd && real(amOrt.cwd) === real(o.repo) && !!rechteSatz?.startsWith("FLEET RIGHTS (level “build”");

    // 2. the place free again: the start window, then „Lanes, MAIN and constellations ›“ leads to the build, a lane chosen
    if (amOrt?.cwd) await own("POST", `/api/slots/${free.id}/kill`, {}).catch(() => undefined);
    await wait(`document.querySelector('.slot.empty[data-slot="${free.id}"]')`, 20000);
    await click(`document.querySelector('.slot.empty[data-slot="${free.id}"]')`);
    const eine = await wait(`document.querySelector('#shell-found.k15sitz .sfaufbau')`, 10000);
    if (eine) await click(`document.querySelector('#shell-found .sfaufbau')`);
    const opened = eine && await wait(`document.querySelector('#shell-found.k15 .k15go')`, 10000);
    facts.opened = await evaluate(`({ k15: !!document.querySelector('#shell-found.k15'), old: !!document.querySelector('.fdgo, .fdkind'),
      knopf: document.querySelector('.k15go')?.textContent ?? null })`);
    claims.opens = fenster && opened && !!await evaluate<boolean>(`!document.querySelector('.fdgo, .fdkind') && /^Lane \\d+ starten$/.test(document.querySelector('.k15go')?.textContent ?? '')`);

    // 2. the repo of the start is the fixture repo; then another model and another effort than the role's standard
    if (opened && real(String(await evaluate<string>(`document.querySelector('.k15wo')?.dataset.repo ?? ''`))) !== real(o.repo)) {
      await click(`document.querySelector('.k15wo')`);
      await wait(`document.querySelector('.k15repomenu')`);
      await click(`[...document.querySelectorAll('.k15repomenu .k15repo')].find((r) => r.dataset.repo && (${JSON.stringify([o.repo, real(o.repo)])}).includes(r.dataset.repo))?.querySelector('.k15repob')`);
      await wait(`!document.querySelector('.k15repomenu')`);
    }
    // the column repaints while a choice re-reads the plan, so a press can land beside the moving switch: up to three presses
    const choose = async (key: string): Promise<string | null> => {
      const row = `[...document.querySelectorAll('.k15c3 .k15z')].find((r) => r.querySelector('.k15zk')?.textContent === ${JSON.stringify(key)})`;
      let open = false;
      for (let i = 0; i < 3 && !open; i++) {
        await wait(`!/wird gelesen/.test(document.querySelector('.k15foot')?.textContent ?? '')`, 5000);
        await click(`${row}?.querySelector('.k15sw')`);
        open = await wait(`document.querySelector('.k15menu')`, 1500);
      }
      if (!open) return null;
      const pick = await evaluate<string | null>(`(() => { const b = [...document.querySelectorAll('.k15menu button')].find((x) => !x.disabled && x.getAttribute('aria-checked') !== 'true');
        return b ? b.dataset.wert : null; })()`);
      if (!pick) return null;
      await click(`document.querySelector('.k15menu button[data-wert=${JSON.stringify(pick)}]')`);
      await wait(`!document.querySelector('.k15menu')`);
      return pick;
    };
    const agent = await evaluate<string>(`[...document.querySelectorAll('.k15c3 .k15z')].find((r) => r.querySelector('.k15zk')?.textContent === 'Agent')?.querySelector('.k15zv')?.textContent ?? ''`);
    const model = await choose("Modell");
    const effort = await choose("Effort");
    const chosenRepo = await evaluate<string>(`document.querySelector('.k15wo')?.dataset.repo ?? ''`);
    facts.chose = { agent, model, effort, repo: chosenRepo };
    const ready = await wait(`document.querySelector('.k15go') && !document.querySelector('.k15go').disabled`, 15000);
    facts.foot = await evaluate<string>(`document.querySelector('.k15foot')?.innerText.replace(/\\s+/g, ' ').slice(0, 400) ?? ''`);

    // 3. start, then read the place back at the server — only on the fixture repo (Mangel 91): a window that kept another repo starts nothing
    const onFixture = real(String(chosenRepo)) === real(o.repo);
    if (!onFixture) facts.notStarted = "the window's repo is not the fixture repo";
    if (ready && onFixture) await click(`document.querySelector('.k15go')`);
    const gone = ready && await wait(`!document.querySelector('#shell-found.k15')`, 20000);
    const row = (await rows()).find((r) => r.id === free.id);
    facts.row = row ? { cwd: row.cwd, repo: row.worktree?.repo ?? row.repo ?? null, harness: row.harness ?? null, model: row.model ?? null, effort: row.effort ?? null } : null;
    // an absent `harness` is the default agent (server.ts: the field is omitted for it); the window names that agent Claude Code
    const harnessOk = (row?.harness ?? "claude") === "claude" ? /^Claude Code/.test(agent ?? "") : (agent ?? "").toLowerCase().startsWith(String(row?.harness));
    claims.values = !!row?.cwd && !!row.worktree && real(row.worktree.repo) === real(o.repo) && harnessOk
      && model !== null && row.model === model && effort !== null && row.effort === effort;
    claims.closes = fensterZu && !!amOrt?.cwd && gone && !!row?.cwd;
    return { claims, facts };
  } finally {
    socket?.close();
    browser.kill();
    // the started session goes again: its place, and a lane's worktree on the fixture repo
    const row = (await rows().catch(() => [] as Row[])).find((r) => r.id === free.id);
    if (row?.cwd) {
      await own("POST", `/api/slots/${free.id}/kill`, {}).catch(() => undefined);
      if (row.worktree) Bun.spawnSync(["git", "worktree", "remove", "--force", row.cwd], { cwd: row.worktree.repo });
    }
    if (pinned) await own("POST", "/api/pins", { path: o.repo, on: false }).catch(() => undefined);
    rmSync(scratch, { recursive: true, force: true });
  }
}
