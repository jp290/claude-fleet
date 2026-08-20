// The board's GRUNDBEDIENUNG: clicking a commit, and finding a file.
//
// Two halves, and they are deliberately different KINDS of proof:
//
//   PART A — the ROUTES the two commit lists depend on, as real requests with real status codes.
//     The board shows two commit lists and they are NOT served by one route. Measured here rather
//     than reasoned about, because the answer decided the whole design: the per-slot commit-diff
//     route recomputes `base..HEAD` and checks membership, so a commit from the SECOND list
//     ("already in main") is a 404 there — correctly — while the repo-wide route serves it 200.
//     A regression that quietly widened either membership rule would show up here first.
//
//   PART B — the CLICK ITSELF. Everything the owner does with these surfaces is an interaction,
//     and a regex over src/client.ts proves neither where a click goes nor what survives the 3s
//     board repaint. So the real explorer block is cut out of src/client.ts, transpiled, and RUN
//     against a small DOM stand-in built here — same method as e2e/outcomes.ts's kProgress and
//     postLandAlarm, extended with just enough `document` for a row to be built and clicked.
//     Every precondition of that method (node_modules exposes the source, the block is
//     extractable, it evaluates) is its OWN check, so a probe that could not be set up fails as
//     itself rather than as the thing it was supposed to measure.
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { dirname } from "node:path";
import { REPO, ROOT, check, get, post } from "./harness";

// --- the DOM stand-in -------------------------------------------------------------------------
// Only what the explorer block touches. It is a stand-in, not an emulation: no layout, no event
// bubbling, no CSS. What it DOES model is the two things the checks below are about — a node tree
// you can read back, and an onclick you can fire.
interface StubNode {
  tag: string; className: string; textContent: string; title: string;
  children: StubNode[]; style: Record<string, string>; dataset: Record<string, string>;
  value: string; type: string; placeholder: string; spellcheck: boolean; autocomplete: string;
  selectionStart: number | null;
  onclick: (() => void) | null; oninput: (() => void) | null; onscroll: (() => void) | null;
  onfocus: (() => void) | null; onblur: (() => void) | null;
  scrollTop: number; focused: boolean;
  appendChild(n: StubNode): StubNode;
  append(...n: StubNode[]): void;
  replaceChildren(...n: StubNode[]): void;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | null;
  focus(): void;
  setSelectionRange(a: number, b: number): void;
  attrs: Record<string, string>;
}
function makeNode(tag: string): StubNode {
  const n: StubNode = {
    tag, className: "", textContent: "", title: "", children: [], style: {}, dataset: {},
    value: "", type: "", placeholder: "", spellcheck: false, autocomplete: "",
    selectionStart: 0, onclick: null, oninput: null, onscroll: null, onfocus: null, onblur: null,
    scrollTop: 0, focused: false, attrs: {},
    appendChild(c) { n.children.push(c); return c; },
    append(...c) { n.children.push(...c); },
    replaceChildren(...c) { n.children = [...c]; },
    setAttribute(k, v) { n.attrs[k] = v; },
    getAttribute(k) { return n.attrs[k] ?? null; },
    focus() { n.focused = true; n.onfocus?.(); },
    setSelectionRange(a) { n.selectionStart = a; },
  };
  return n;
}
// every row the paint produced, flattened, in visual order — the order a reader tabs through
const rowsOf = (n: StubNode): StubNode[] =>
  n.children.filter((c) => c.tag === "button" && c.className.includes("fxrow"));
const textOf = (n: StubNode): string =>
  n.textContent + n.children.map(textOf).join("");

export async function run(): Promise<void> {
  // ============================ PART A — the two routes ======================================
  // A lane whose base branch has history of its own, so the board's two commit lists are both
  // non-empty and provably disjoint.
  spawnSync("git", ["-C", REPO, "commit", "--allow-empty", "-qm", "explorer: base history A"]);
  spawnSync("git", ["-C", REPO, "commit", "--allow-empty", "-qm", "explorer: base history B"]);
  const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as
    { slot: number; cwd: string; branch: string };
  await Bun.write(`${ln.cwd}/explorer-lane.txt`, "lane work\n");
  spawnSync("git", ["-C", ln.cwd, "add", "explorer-lane.txt"]);
  for (let i = 0; i < 12; i++) {
    spawnSync("git", ["-C", ln.cwd, "commit", "-qm", "explorer: the lane's own commit"]);
    if (spawnSync("git", ["-C", ln.cwd, "log", "--oneline", "-1"]).stdout.toString()
      .includes("explorer: the lane's own commit")) break;
    await Bun.sleep(300);
  }
  interface BriefC { hash: string; subject: string }
  interface Brief { branch: string | null; laneBase: string | null; laneScoped: boolean;
    commits: BriefC[]; repoCommits: BriefC[]; files: string[] }
  const brief = (await (await get(`/api/slots/${ln.slot}/brief`)).json()) as Brief;
  check("explorer precondition: the board shows TWO non-empty, disjoint commit lists for a lane",
    brief.laneScoped && brief.commits.length > 0 && brief.repoCommits.length > 0
    && !brief.commits.some((c) => brief.repoCommits.some((r) => r.hash === c.hash)),
    JSON.stringify({ own: brief.commits.map((c) => c.hash), repo: brief.repoCommits.map((c) => c.hash) }));
  const own = brief.commits[0]?.hash ?? "";
  const inBase = brief.repoCommits[0]?.hash ?? "";

  const g1 = await get(`/api/slots/${ln.slot}/commit-diff?hash=${own}`);
  const g1b = (await g1.json()) as { hash?: string; diff?: string; files?: string[] };
  check("commit group 1 (this lane's own) opens on the per-slot route — hash, diff and file list",
    g1.status === 200 && g1b.hash === own && !!g1b.diff && (g1b.files ?? []).includes("explorer-lane.txt"),
    `${g1.status} ${JSON.stringify(g1b).slice(0, 160)}`);
  // The rejection the second list would hit if it used the first list's route. It is CORRECT — the
  // route's whole point is that a hash must be one this slot's own list offered — and it is the
  // reason the board sends group 2 somewhere else instead of to a route that would 404 it.
  const g2slot = await get(`/api/slots/${ln.slot}/commit-diff?hash=${inBase}`);
  check("commit group 2 (already in the base branch) is REFUSED by the per-slot route, 404",
    g2slot.status === 404 && /not a commit of this slot/.test(await g2slot.text()), String(g2slot.status));

  const sess = (await (await get("/api/sessions")).json()) as
    { slots: { id: number; cwd: string | null; repo?: string | null; worktree?: { repo: string } | null }[] };
  const slotRow = sess.slots.find((s) => s.id === ln.slot);
  const wtRepo = slotRow?.worktree?.repo ?? "";
  const kr = (await (await get("/api/commits")).json()) as { repos: string[] };
  // repoOfSlot() in src/client.ts sends exactly this string. If knownRepos() ever stopped holding
  // a lane's PARENT repo, the second list's rows would 400 — so the join is asserted, not assumed.
  check("the repo string the board can send for a lane is one /api/commits accepts",
    !!wtRepo && kr.repos.includes(wtRepo), JSON.stringify({ wtRepo, repos: kr.repos }));
  const g2 = await get(`/api/commit-diff?repo=${encodeURIComponent(wtRepo)}&hash=${inBase}`);
  const g2b = (await g2.json()) as { hash?: string; diff?: string; files?: string[] };
  check("commit group 2 opens on the repo-wide route — the lens the board actually sends it to",
    g2.status === 200 && g2b.hash === inBase, `${g2.status} ${JSON.stringify(g2b).slice(0, 160)}`);
  const cmList = (await (await get(`/api/commits?repo=${encodeURIComponent(wtRepo)}`)).json()) as
    { commits: { hash: string }[]; branch: string | null };
  check("every commit in group 2 is in the list that lens renders — no row can select nothing",
    brief.repoCommits.every((c) => cmList.commits.some((x) => x.hash === c.hash)),
    JSON.stringify({ want: brief.repoCommits.map((c) => c.hash), got: cmList.commits.map((c) => c.hash) }));
  // the counter-probe: the LANE's own commit is not in the base branch, so the repo-wide route
  // must refuse it. Without this, "both routes answer 200" could be true of one over-wide route.
  const g1wide = await get(`/api/commit-diff?repo=${encodeURIComponent(wtRepo)}&hash=${own}`);
  check("the repo-wide route refuses a commit that is only on the lane — the two lists stay separate",
    g1wide.status === 404, String(g1wide.status));

  // the tree, and the two states the card has to tell apart from a real listing
  const tr = (await (await get(`/api/tree?slot=${ln.slot}`)).json()) as
    { root?: string; files?: string[]; total?: number; capped?: boolean; error?: string };
  check("the explorer tree lists this lane's tracked files, uncapped, with a total",
    (tr.files ?? []).includes("explorer-lane.txt") && tr.capped === false
    && tr.total === (tr.files ?? []).length, JSON.stringify({ n: tr.files?.length, capped: tr.capped }));
  // A DETACHED HEAD keeps the card: `brief.branch` is the STRING "HEAD" there, not null, so the
  // `if (brief.branch)` gate the card sits behind stays truthy. Measured, because the comment at
  // that gate says a detached HEAD loses the card — and the tree route serves it either way.
  spawnSync("git", ["-C", ln.cwd, "checkout", "-q", "--detach"]);
  const bDet = (await (await get(`/api/slots/${ln.slot}/brief`)).json()) as Brief;
  const trDet = await get(`/api/tree?slot=${ln.slot}`);
  check("a DETACHED-HEAD session keeps a branch string and a readable tree — the card is not lost",
    bDet.branch === "HEAD" && trDet.status === 200,
    JSON.stringify({ branch: bDet.branch, tree: trDet.status }));
  spawnSync("git", ["-C", ln.cwd, "checkout", "-q", ln.branch]);
  await post(`/api/slots/${ln.slot}/kill`, {});

  // ============================ PART B — the interaction =====================================
  // The source under test, resolved through the node_modules symlink back to the tree this
  // instance was staged from (e2e/outcomes.ts:719 resolves it the same way).
  let cliSrc = "";
  try {
    cliSrc = readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/src/client.ts`, "utf8");
  } catch { cliSrc = ""; }
  check("explorer precondition: node_modules exposes src/client.ts for the interaction probes",
    cliSrc.length > 1000, `${cliSrc.length} bytes`);

  const gpSrc = cliSrc.slice(cliSrc.indexOf("const GITPATH_ESCAPES"), cliSrc.indexOf("let dataSaver"));
  const fxSrc = cliSrc.slice(cliSrc.indexOf("interface TreeNode"), cliSrc.indexOf("async function loadTree"));
  check("explorer precondition: the path decoder and the tree/paint block are both extractable",
    gpSrc.includes("function gitUnquote") && gpSrc.includes("function porcelainPath")
    && fxSrc.includes("function treeOf") && fxSrc.includes("function matchTree")
    && fxSrc.includes("function paintTree"),
    JSON.stringify({ gitpath: gpSrc.length, explorer: fxSrc.length }));

  // What the cut-out block needs from the rest of client.ts, supplied here so the REAL code runs
  // unchanged. `el` is client.ts's own builder, re-stated against the stand-in above.
  const PRELUDE = `
    const document = { createElement: (t) => makeNode(t) };
    function el(tag, className, text) {
      const e = document.createElement(tag);
      if (className) e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    }
  `;
  type Painter = (into: StubNode, root: unknown, o: Record<string, unknown>) => void;
  interface Cut {
    gitUnquote: (s: string) => string;
    porcelainPath: (s: string) => string;
    treeOf: (paths: string[]) => unknown;
    matchTree: (paths: string[], q: string) => string[];
    paintTree: Painter;
  }
  let cut: Cut | null = null;
  let cutErr = "";
  try {
    const ts = new Bun.Transpiler({ loader: "ts" });
    cut = new Function("makeNode",
      `${PRELUDE}\n${ts.transformSync(gpSrc)}\n${ts.transformSync(fxSrc)}\n`
      + "return { gitUnquote, porcelainPath, treeOf, matchTree, paintTree };")(makeNode) as Cut;
  } catch (e) { cutErr = e instanceof Error ? e.message : String(e); }
  check("explorer precondition: the extracted block evaluates against the DOM stand-in",
    !!cut, cutErr || "ok");
  if (!cut) return; // every check below would report a client defect it never measured

  // --- B1: the path decoder, against the shapes git was MEASURED to emit (2026-08-20) ---
  check("GITPATH: a space makes git quote a porcelain path — and it is decoded back",
    cut.porcelainPath('?? "untracked file.txt"') === "untracked file.txt",
    cut.porcelainPath('?? "untracked file.txt"'));
  check("GITPATH: \\NNN is an octal BYTE — the escapes spell UTF-8 and decode as one character",
    cut.porcelainPath(' M "umlaut-\\303\\244\\303\\266\\303\\274.txt"') === "umlaut-äöü.txt",
    cut.porcelainPath(' M "umlaut-\\303\\244\\303\\266\\303\\274.txt"'));
  check("GITPATH: a rename resolves to the file that still EXISTS, not to the arrow",
    cut.porcelainPath('R  "old name.txt" -> "new name.txt"') === "new name.txt",
    cut.porcelainPath('R  "old name.txt" -> "new name.txt"'));
  // the counter-probe for the rename rule: the arrow is only read when the STATUS says rename.
  // A file may legitimately be named `a -> b`, and git does not quote it for that.
  check("GITPATH: ` -> ` in a plain modified path is part of the NAME, not a rename arrow",
    cut.porcelainPath(" M a -> b.txt") === "a -> b.txt", cut.porcelainPath(" M a -> b.txt"));
  check("GITPATH: an unquoted path is returned untouched — the common case costs nothing",
    cut.porcelainPath("M  src/client.ts") === "src/client.ts" && cut.gitUnquote("plain.txt") === "plain.txt",
    cut.porcelainPath("M  src/client.ts"));

  // --- B2: the search, as a function of the real file list ---
  const FILES = ["e2e/pins.ts", "e2e/harness.ts", "src/client.ts", "src/shell.ts",
    "docs/verify-tiering.md", "server.ts", "dir with space/nested file.txt"];
  check("search: a PATH fragment finds the file — the question the explorer could not answer",
    cut.matchTree(FILES, "e2e/pins").length === 1 && cut.matchTree(FILES, "e2e/pins")[0] === "e2e/pins.ts",
    JSON.stringify(cut.matchTree(FILES, "e2e/pins")));
  check("search: terms are ANDed in any order, and case is ignored",
    JSON.stringify(cut.matchTree(FILES, "PINS e2e")) === JSON.stringify(cut.matchTree(FILES, "e2e pins")),
    JSON.stringify(cut.matchTree(FILES, "PINS e2e")));
  check("search: a fragment matching several files returns all of them, shortest path first",
    JSON.stringify(cut.matchTree(FILES, "src/")) === JSON.stringify(["src/shell.ts", "src/client.ts"]),
    JSON.stringify(cut.matchTree(FILES, "src/")));
  check("search: a query nothing matches returns nothing — never a silent fallback to everything",
    cut.matchTree(FILES, "zzzz-no-such-thing").length === 0 && cut.matchTree(FILES, "   ").length === 0,
    JSON.stringify(cut.matchTree(FILES, "zzzz-no-such-thing")));

  // --- B3: the CLICK. A row is built by the real paint and then fired. ---
  const openState = { picked: null as string | null };
  const folders = new Set<string>();
  const paint = (into: StubNode, q: string, capped = false) => cut!.paintTree(into, cut!.treeOf(FILES), {
    open: folders, query: q, all: FILES, capped, shown: FILES.length, total: capped ? 99 : FILES.length,
    onPick: (rel: string) => { openState.picked = rel; },
    picked: () => openState.picked,
  } as unknown as Record<string, unknown>);

  const box = makeNode("div");
  paint(box, "");
  const dirRows = rowsOf(box).filter((r) => r.className.includes("fxdir"));
  check("tree: the top level renders FOLDERS, collapsed, and says so on the row itself",
    dirRows.length === 4 && dirRows.every((r) => r.getAttribute("aria-expanded") === "false")
    && dirRows.every((r) => textOf(r).includes("▸")),
    JSON.stringify(dirRows.map((r) => textOf(r))));
  // rowsOf() already filters by tag, so it cannot answer this — ask the CONTAINER instead, or the
  // check would pass by construction on a paint that emitted nothing but divs.
  const rowish = box.children.filter((c) => c.className.includes("fxrow"));
  check("tree: rows are <button>s — tabbable and Enter/Space-activatable without a key handler",
    rowish.length > 0 && rowish.every((r) => r.tag === "button"),
    JSON.stringify(rowish.map((r) => r.tag)));

  // click a folder → it opens, in place, and its children appear
  const e2eRow = dirRows.find((r) => textOf(r).includes("e2e"));
  check("interaction precondition: the e2e folder row was built and carries a click target",
    !!e2eRow?.onclick, JSON.stringify(dirRows.map((r) => textOf(r))));
  e2eRow?.onclick?.();
  check("click: a folder row EXPANDS in place and its files become visible",
    folders.has("e2e") && rowsOf(box).some((r) => textOf(r).includes("pins.ts"))
    && rowsOf(box).some((r) => r.className.includes("fxdir") && r.getAttribute("aria-expanded") === "true"),
    JSON.stringify(rowsOf(box).map((r) => textOf(r))));

  // …and the keyboard is not dropped by the repaint that the fold triggers. Without this, opening a
  // folder with Enter detached the focused row and the next Tab restarted at the top of the page.
  check("click: folding hands focus back to the SAME row — the keyboard stays in the tree",
    rowsOf(box).some((r) => r.className.includes("fxdir") && textOf(r).includes("e2e") && r.focused),
    JSON.stringify(rowsOf(box).filter((r) => r.focused).map((r) => textOf(r))));

  // click a FILE → the pick fires with the full relative path, and the row is marked as open
  const pinsRow = rowsOf(box).find((r) => r.title === "e2e/pins.ts");
  check("interaction precondition: the file row was built and carries its full path as its title",
    !!pinsRow?.onclick, JSON.stringify(rowsOf(box).map((r) => r.title)));
  pinsRow?.onclick?.();
  check("click: a file row opens EXACTLY that path — not its basename, not its folder",
    openState.picked === "e2e/pins.ts", String(openState.picked));
  check("click: the opened file is MARKED in the list, distinctly from the keyboard cursor",
    rowsOf(box).some((r) => r.title === "e2e/pins.ts" && r.className.includes("fxpicked"))
    && !rowsOf(box).some((r) => r.title !== "e2e/pins.ts" && r.className.includes("fxpicked")),
    JSON.stringify(rowsOf(box).filter((r) => r.className.includes("fxpicked")).map((r) => r.title)));

  // --- B4: THE BOARD REPAINT. The 3s repaint builds a NEW card; what the reader did must survive.
  // This is the check the whole per-cwd keying exists for: paint into a FRESH container, exactly
  // as renderBoard does, and assert the state is still theirs.
  const fresh = makeNode("div");
  paint(fresh, "");
  check("refresh: a repaint into a fresh container does NOT fold the open folder shut",
    rowsOf(fresh).some((r) => r.title === "e2e/pins.ts")
    && rowsOf(fresh).some((r) => r.className.includes("fxdir") && r.getAttribute("aria-expanded") === "true"),
    JSON.stringify(rowsOf(fresh).map((r) => textOf(r))));
  check("refresh: a repaint keeps the opened file marked — the selection is not swapped or lost",
    rowsOf(fresh).some((r) => r.title === "e2e/pins.ts" && r.className.includes("fxpicked")),
    JSON.stringify(rowsOf(fresh).filter((r) => r.className.includes("fxpicked")).map((r) => r.title)));

  // ...and the same for a search in progress: the query is module state, so the repaint that
  // lands mid-typing re-renders the FILTERED list rather than dropping back to the whole tree.
  const typed = makeNode("div");
  paint(typed, "pins");
  const hits = rowsOf(typed);
  check("search: typing filters the list to the matches, as a flat path list",
    hits.length === 1 && hits[0].title === "e2e/pins.ts" && hits[0].className.includes("fxhit"),
    JSON.stringify(hits.map((r) => r.title)));
  const typedAgain = makeNode("div");
  paint(typedAgain, "pins");
  check("refresh: a repaint DURING a search re-renders the same filtered list, not the whole tree",
    rowsOf(typedAgain).length === 1 && rowsOf(typedAgain)[0].title === "e2e/pins.ts",
    JSON.stringify(rowsOf(typedAgain).map((r) => r.title)));
  check("search: a hit row still opens exactly its own path",
    (() => { openState.picked = null; rowsOf(typedAgain)[0]?.onclick?.(); return openState.picked; })()
      === "e2e/pins.ts", String(openState.picked));

  // --- B5: the two empty answers, which are different facts ---
  const noneUncapped = makeNode("div");
  paint(noneUncapped, "zzzz-no-such-thing", false);
  check("empty: with the WHOLE tree delivered, no match says plainly that nothing matches",
    rowsOf(noneUncapped).length === 0 && /nothing matches/.test(textOf(noneUncapped))
    && !/may exist outside/.test(textOf(noneUncapped)), textOf(noneUncapped));
  const noneCapped = makeNode("div");
  paint(noneCapped, "zzzz-no-such-thing", true);
  check("empty: with a CAPPED tree, no match says the server sent only part — TREE_CAP is not hidden",
    rowsOf(noneCapped).length === 0 && /may exist outside/.test(textOf(noneCapped))
    && /99/.test(textOf(noneCapped)), textOf(noneCapped));
  const someCapped = makeNode("div");
  paint(someCapped, "pins", true);
  check("empty: with a CAPPED tree, even a HIT says what the search could not reach",
    rowsOf(someCapped).length === 1 && /searched only the first/.test(textOf(someCapped)),
    textOf(someCapped));

  // --- B6: two repos do not share one reader's state (the open-folder set is per cwd) ---
  const otherFolders = new Set<string>();
  const other = makeNode("div");
  cut.paintTree(other, cut.treeOf(["src/other.ts", "e2e/other.ts"]), {
    open: otherFolders, query: "", all: ["src/other.ts", "e2e/other.ts"],
    capped: false, shown: 2, total: 2,
    onPick: () => { /* not exercised here */ }, picked: () => null,
  } as unknown as Record<string, unknown>);
  check("panes: a SECOND repo's tree starts collapsed — one pane's open folders are not the other's",
    rowsOf(other).every((r) => r.getAttribute("aria-expanded") !== "true") && folders.has("e2e"),
    JSON.stringify({ other: rowsOf(other).map((r) => textOf(r)), first: [...folders] }));
}
