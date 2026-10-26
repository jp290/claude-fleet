// The /hub page's client. Lives here and not inline in public/hub.html because every line of
// client code in this repo is in src/ and ships as a bundle — the rule fleet-e2e-security.ts §7
// enforces over the WHOLE public/ directory, and the reason the §7 sink scan can trust that
// scanning src/ is scanning all of it. Nodes are built with createElement + textContent only;
// there is no HTML sink here on purpose.
//
// It reads three routes and joins them, and it invents nothing: a LANE is a slot carrying a
// worktree, a MAIN is the slot a program names, and a lane belongs to a program when a task of
// that program was sent to its slot. Where that join finds nothing, the row says so instead of
// guessing.
import { CONTEXT_PACKS } from "../context-packs";

interface Git { branch: string; dirty: number; ahead: number; behind: number }
interface Ctx { usedTokens: number; windowTokens: number; pct: number }
interface Spawn { harness: string | null; model: string | null; effort: string | null }
interface Slot {
  id: number; cwd: string | null; label: string | null; repo: string | null;
  worktree: { repo: string; branch: string } | null; model: string | null; agent: string | null;
  git: Git | null; ctx: Ctx | null;
}
interface Task {
  id: string; slot: number | null; programId: string | null; kind: string; status: string;
  text: string; files: string[] | null; spawn: Spawn | null;
}
interface Program { id: string; title: string | null; status: string; main: { slot: number } | null }
interface Commit { hash: string; ts: number; subject: string; stat: string | null }

interface State {
  slots: Slot[]; programs: Program[]; tasks: Task[]; commits: Commit[];
  receipts: Record<string, unknown>[]; repo: string | null; sel: number | null;
}

const S: State = { slots: [], programs: [], tasks: [], commits: [], receipts: [], repo: null, sel: null };

function el<K extends keyof HTMLElementTagNameMap>(t: K, c?: string, x?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(t);
  if (c) e.className = c;
  if (x !== undefined) e.textContent = x;
  return e;
}
  function q(id: string): HTMLElement { return document.getElementById(id) as HTMLElement; }

  function getJSON(u: string): Promise<any> {
    return fetch(u, { credentials: "same-origin" }).then(function (r: Response) {
      if (!r.ok) throw new Error(u + " -> HTTP " + r.status);
      return r.json();
    });
  }

  function isLane(s: Slot): boolean { return !!s.worktree; }
  function alive(s: Slot): boolean { return s.agent === "alive"; }

  /* which tasks were sent to this slot */
  function tasksOfSlot(id: number): Task[] { return S.tasks.filter(function (t) { return t.slot === id; }); }

  /* lanes that belong to a program: a lane slot carrying a task of that program */
  function lanesOfProgram(pid: string): Slot[] {
    return S.slots.filter(function (s) {
      return isLane(s) && tasksOfSlot(s.id).some(function (t) { return t.programId === pid; });
    });
  }

  function slotRow(s: Slot, kind: string): HTMLElement {
    const b = el("button", "slot" + (kind === "lane" ? " lane" : ""));
    b.type = "button";
    b.setAttribute("aria-pressed", S.sel === s.id ? "true" : "false");
    const k = el("span", "k");
    const d = el("span", "dot" + (alive(s) ? " on" : "") + (s.git && s.git.dirty ? " dirty" : ""));
    k.appendChild(d);
    k.appendChild(document.createTextNode(kind === "lane" ? "Lane " + s.id : "Slot " + s.id));
    b.appendChild(k);
    var nm = s.label || (s.git && s.git.branch) || s.cwd || "-";
    b.appendChild(el("span", "nm", nm));
    b.appendChild(el("span", "mdl", s.model || "-"));
    b.appendChild(el("span", "ctx", s.ctx && s.ctx.pct != null ? s.ctx.pct + "%" : "-"));
    b.addEventListener("click", function () { S.sel = s.id; renderWork(); renderDetail(); });
    return b;
  }

  function renderWork(): void {
    var host = q("work");
    host.textContent = "";
    var here = S.slots.filter(function (s) { return s.cwd && (!S.repo || s.repo === S.repo); });
    const used: Record<number, boolean> = {};
    var n = 0;

    S.programs.forEach(function (p) {
      const mainId = p.main ? p.main.slot : null;
      const mainSlot = mainId === null ? null : here.filter(function (s) { return s.id === mainId; })[0] || null;
      var lanes = lanesOfProgram(p.id);
      if (!mainSlot && !lanes.length) return;
      const box = el("div", "prog");
      const t = el("div", "t");
      t.appendChild(el("span", "", p.title || "(untitled)"));
      t.appendChild(el("span", "id", String(p.id).slice(0, 8)));
      t.appendChild(el("span", "st", p.status || ""));
      box.appendChild(t);
      if (mainSlot) { box.appendChild(slotRow(mainSlot, "main")); used[mainSlot.id] = true; n++; }
      lanes.forEach(function (l) { box.appendChild(slotRow(l, "lane")); used[l.id] = true; n++; });
      host.appendChild(box);
    });

    var rest = here.filter(function (s) { return !used[s.id]; });
    if (rest.length) {
      const box2 = el("div", "prog");
      const t2 = el("div", "t");
      t2.appendChild(el("span", "", "No Program"));
      t2.appendChild(el("span", "st", rest.length + " slots"));
      box2.appendChild(t2);
      rest.forEach(function (s) { box2.appendChild(slotRow(s, isLane(s) ? "lane" : "main")); n++; });
      host.appendChild(box2);
    }

    if (!n) host.appendChild(el("div", "empty", "No occupied slots in this repo"));
    q("workN").textContent = n + " slots";
  }

  function kv(host: HTMLElement, k: string, v: string): void {
    const r = el("div", "kv");
    r.appendChild(el("span", "k", k));
    r.appendChild(el("span", "v", v));
    host.appendChild(r);
  }

  function renderDetail(): void {
    var host = q("detail");
    host.textContent = "";
    var s = S.slots.filter(function (x) { return x.id === S.sel; })[0];
    if (!s) {
      host.appendChild(el("div", "empty", "Pick a slot on the left - its brief, delivered file, tools and model show here."));
      q("detN").textContent = "";
      return;
    }
    q("detN").textContent = (isLane(s) ? "Lane " : "Slot ") + s.id;

    kv(host, "cwd", s.cwd || "-");
    kv(host, "worktree", s.worktree ? s.worktree.branch + " in " + s.worktree.repo : "- (main checkout)");
    if (s.git) kv(host, "git", s.git.branch + "  dirty " + s.git.dirty + "  ahead " + s.git.ahead + "  behind " + s.git.behind);
    kv(host, "Agent", s.agent || "-");
    kv(host, "Model", s.model || "- (record empty, env applies)");
    kv(host, "Context", s.ctx ? (s.ctx.pct + "%  " + s.ctx.usedTokens + " / " + s.ctx.windowTokens) : "not measurable");

    var ts = tasksOfSlot(s.id);
    var t = ts[0];

    /* Tools + Modell aus dem Spawn-Tripel der Aufgabe */
    var sp = t && t.spawn ? t.spawn : null;
    const chips = el("div", "chips");
    if (sp) {
      chips.appendChild(el("span", "chip", "harness: " + (sp.harness || "claude")));
      chips.appendChild(el("span", "chip", "model: " + (sp.model || "-")));
      chips.appendChild(el("span", "chip", "effort: " + (sp.effort || "-")));
    } else {
      chips.appendChild(el("span", "chip none", "no spawn settings - Fleet default"));
    }
    const r1 = el("div", "kv");
    r1.appendChild(el("span", "k", "Tools"));
    const v1 = el("span", "v"); v1.appendChild(chips); r1.appendChild(v1);
    host.appendChild(r1);

    /* Die zugestellte Datei: was tatsaechlich an diese Session ging, aus dem Receipt */
    var rec = S.receipts.filter(function (x) { return x && (x.slot === s.id); });
    const r2 = el("div", "kv");
    r2.appendChild(el("span", "k", "Delivered"));
    const v2 = el("span", "v");
    if (rec.length) {
      const newest = rec.reduce(function (a, b) { return num(b.at) > num(a.at) ? b : a; });
      receiptFile(v2, newest, rec.length);
    } else {
      v2.appendChild(el("span", "chip none", "no context receipt for this slot"));
    }
    r2.appendChild(v2);
    host.appendChild(r2);

    /* Write-Set */
    if (t && t.files && t.files.length) {
      const fc = el("div", "chips");
      t.files.forEach(function (f) { fc.appendChild(el("span", "chip", f)); });
      const r3 = el("div", "kv");
      r3.appendChild(el("span", "k", "Write-Set"));
      const v3 = el("span", "v"); v3.appendChild(fc); r3.appendChild(v3);
      host.appendChild(r3);
    }

    /* Brief */
    const head = el("div", "kv");
    head.appendChild(el("span", "k", "Brief"));
    head.appendChild(el("span", "v", t ? (t.kind + " - " + t.status + " - " + String(t.id).slice(0, 8)) : "no task at this slot"));
    host.appendChild(head);
    if (t) host.appendChild(el("pre", "brief", t.text || "(empty)"));
  }

  function num(v: unknown): number { return typeof v === "number" && Number.isFinite(v) ? v : 0; }
  function kb(bytes: number): string { return (bytes / 1000).toFixed(1) + " KB"; }

  /* THE DELIVERED FILE in the founding window's form (src/founding.ts#renderFile): the fixed order
     Rolle, Auftrag, Anleitung, Wissen, Packs auf Abruf, Schluss, each with its sentence and size. A
     receipt that carries its parts (task 197966d7) is read part by part; one without them names its
     packs per group and its delivered bytes, and says "im Receipt nicht gemeldet" for the rest —
     never an estimate. */
  function receiptFile(host: HTMLElement, r: Record<string, unknown>, count: number): void {
    const parts = Array.isArray(r.parts) ? (r.parts as unknown[]).filter(function (p): p is Record<string, unknown> {
      return !!p && typeof p === "object" && typeof (p as Record<string, unknown>).id === "string";
    }) : null;
    const selected = Array.isArray(r.selected) ? (r.selected as unknown[]).filter(function (p): p is Record<string, unknown> {
      return !!p && typeof p === "object" && typeof (p as Record<string, unknown>).id === "string";
    }) : [];
    const delivered = typeof r.deliveredBytes === "number" ? r.deliveredBytes : null;
    const head = el("div", "chips");
    head.appendChild(el("span", "chip", delivered === null ? "Size not reported" : kb(delivered) + " delivered"));
    head.appendChild(el("span", "chip", "harness " + (r.harness || "claude") + " · " + (r.model || "-") + " · " + (r.effort || "-")));
    if (typeof r.at === "number") head.appendChild(el("span", "chip", new Date(r.at).toLocaleString("en-GB")));
    if (count > 1) head.appendChild(el("span", "chip none", count + " receipts for this slot — the newest one counts"));
    host.appendChild(head);
    const said = "not reported in the receipt";
    const sum = function (pred: (p: Record<string, unknown>) => boolean): string | null {
      if (!parts) return null;
      const hit = parts.filter(pred);
      return hit.length ? kb(hit.reduce(function (n, p) { return n + num(p.bytes); }, 0)) : null;
    };
    const box = function (sorte: string) { return function (p: Record<string, unknown>) { return p.sorte === sorte && p.ort === "box"; }; };
    const groups: Record<string, string> = { "grundlagen": "Basics", "pruefen-landen": "Checking and landing", "sessions-fuehren": "Running sessions", "vor-arbeiten": "Before certain work" };
    const groupOf = function (p: Record<string, unknown>): string {
      const own = typeof p.group === "string" ? p.group : CONTEXT_PACKS.find(function (c) { return c.id === p.id; })?.group;
      return own && groups[own] ? groups[own]! : "No group";
    };
    const byGroup: Record<string, string[]> = {};
    selected.forEach(function (p) { (byGroup[groupOf(p)] = byGroup[groupOf(p)] || []).push(String(p.id)); });
    const rows: [string, string, string][] = [
      ["Role", "Who the agent is, what it decides itself and who it reports to.", sum(function (p) { return p.id === "role"; }) ?? said],
      ["Task", "The card for this start.", "in the brief"],
      ["Instructions", "Rules and steps, in full in the file.", parts ? sum(box("anleitung")) ?? "nothing in full" : said],
      ["Knowledge", "Background, in full in the file.", parts ? sum(box("wissen")) ?? "nothing in full" : said],
      ["Packs on demand", selected.length ? selected.length + " pointers: " + Object.keys(byGroup).map(function (g) { return g + " (" + byGroup[g]!.join(", ") + ")"; }).join(" · ") : "no pointers", parts ? "" : "Size " + said],
      ["Closing", "How it hands in at the end.", sum(function (p) { return p.id === "footer"; }) ?? said],
    ];
    rows.forEach(function (row, i) {
      const line = el("div", "kv");
      line.appendChild(el("span", "k", (i + 1) + " " + row[0]));
      const v = el("span", "v", row[1]);
      if (row[2]) { v.appendChild(document.createTextNode("  ")); v.appendChild(el("span", "chip" + (row[2].indexOf("not reported") >= 0 ? " none" : ""), row[2])); }
      line.appendChild(v);
      host.appendChild(line);
    });
  }

  function renderCommits(): void {
    var host = q("commits");
    host.textContent = "";
    if (!S.commits.length) { host.appendChild(el("div", "empty", "No commits")); q("cmN").textContent = ""; return; }
    S.commits.slice(0, 40).forEach(function (c) {
      const r = el("div", "cm");
      r.appendChild(el("span", "h", c.hash));
      r.appendChild(el("span", "s", c.subject));
      r.appendChild(el("span", "d", new Date(c.ts).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })));
      r.title = c.subject + "\n" + (c.stat || "");
      host.appendChild(r);
    });
    q("cmN").textContent = S.commits.length + " commits read";
  }

  function fail(m: string): void { var e = q("error"); e.hidden = false; e.textContent = m; }

  function load(): void {
    q("error").hidden = true;
    var repoQ = S.repo ? "?repo=" + encodeURIComponent(S.repo) : "";
    Promise.all([
      getJSON("/api/sessions"),
      getJSON("/api/commits" + repoQ),
      getJSON("/api/context-receipts")["catch"](function () { return { receipts: [] }; })
    ]).then(function (r) {
      var sess = r[0], cm = r[1], rc = r[2];
      S.slots = sess.slots || [];
      S.programs = sess.programs || [];
      S.tasks = (sess.tasks || []);
      S.commits = cm.commits || [];
      S.receipts = rc.receipts || [];
      if (!S.repo) S.repo = cm.repo || null;

      var sel = q("repo");
      sel.textContent = "";
      ((cm.repos || []) as string[]).forEach(function (p: string) {
        var o = document.createElement("option");
        o.value = p; o.textContent = p.split("/").slice(-1)[0];
        if (p === S.repo) o.selected = true;
        sel.appendChild(o);
      });
      q("branch").textContent = cm.branch ? "branch " + cm.branch : "";
      q("stamp").textContent = new Date().toLocaleTimeString("en-GB");

      renderWork(); renderDetail(); renderCommits();
    })["catch"](function (e: Error) { fail(String(e.message || e)); });
  }

  q("repo").addEventListener("change", function (e) { S.repo = (e.target as HTMLSelectElement).value; S.sel = null; load(); });
  q("reload").addEventListener("click", load);
  load();

export {};
