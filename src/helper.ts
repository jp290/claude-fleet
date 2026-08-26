// The remote audit helper's portal — the client half of THE REMOTE HELPER PORTAL (server.ts, grep
// `handleHelperRoute`). It talks to five routes and holds exactly two pieces of browser-local
// state: the token the page was opened with, and a device id. The NAME is deliberately NOT local
// state — it lives on the fleet, because a ledger row must still be able to say which machine
// produced it after this browser has forgotten everything.
//
// EVERY NODE IS BUILT, never written as markup. Branch names, device names and the server's own
// refusal texts all reach this page and all of them are attacker-influenceable in principle; the
// repo's one rule (fleet-e2e-security.ts §7) is that nothing untrusted becomes markup, asserted as
// "no HTML sink exists in src/ at all" rather than as an escaping test per call site. So: `el()`
// and `textContent`, and no `innerHTML` anywhere below.
const TOKEN = new URLSearchParams(location.search).get("token") ?? "";
const HDR: Record<string, string> = TOKEN ? { "x-fleet-helper-token": TOKEN } : {};

// TWO JOB KINDS, one list, one button. `kind` is the whole difference this page sees: an `audit`
// carries a landed integration tip and `covers` lands; a `lane-suite` carries a LANE's working tree
// (uncommitted work included) and covers no land at all. Optional on the wire so a page served by an
// older server still renders — an absent kind is read as `audit`, which is what it was.
interface Job {
  id: string; kind?: string; repo: string; main: string; branches: string[]; covers: number;
  oldestAt: number;
  claim: { name: string; claimedAt: number; expiresAt: number } | null; localRunning: boolean;
  untracked?: number;
}
const isLaneSuite = (j: { kind?: string }): boolean => j.kind === "lane-suite";
interface Lapse { id: string; repo: string; name: string; claimedAt: number; expiredAt: number; covers: number }
interface JobsPayload {
  claimTimeoutMs: number; configured: boolean; jobs: Job[]; lapsed: Lapse[];
  device: { id: string; name: string } | null; error?: string;
}
interface ClaimedJob {
  id: string; kind?: string; repo: string; main: string; mainSha: string;
  branches: string[]; covers: number; claimedAt: number; expiresAt: number; name: string;
  // lane-suite only. `branch` is the transient branch the bundle carries and the ONE string the
  // clone command must name — it is served rather than reconstructed here, because a clone whose
  // branch name is wrong (or missing) produces an EMPTY directory and no hint why.
  branch?: string; treeSha?: string; untracked?: number;
}

const qs = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
type Kid = string | Node;
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...kids: Kid[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const kid of kids) node.append(typeof kid === "string" ? document.createTextNode(kid) : kid);
  return node;
}
const clear = (node: HTMLElement): void => { while (node.firstChild) node.removeChild(node.firstChild); };

// a per-browser id, and never a secret: it only ties this browser to the name it chose. Regenerated
// whenever what is stored does not match the shape the server accepts, so a hand-edited or
// truncated value cannot wedge the page into permanent 400s.
function deviceIdOf(): string {
  const stored = localStorage.getItem("fleetHelperDevice") ?? "";
  if (/^[a-z0-9]{8,32}$/.test(stored)) return stored;
  const fresh = Array.from(crypto.getRandomValues(new Uint8Array(8)),
    (b) => b.toString(16).padStart(2, "0")).join("");
  localStorage.setItem("fleetHelperDevice", fresh);
  return fresh;
}
const deviceId = deviceIdOf();

const ago = (t: number): string => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 90 ? `${s}s` : s < 5400 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`;
};
const left = (t: number): string => {
  const s = Math.max(0, Math.round((t - Date.now()) / 1000));
  return s < 90 ? `${s}s` : `${Math.round(s / 60)}m`;
};

interface Answer<T> { ok: boolean; status: number; body: T & { error?: string } }
async function api<T>(path: string, init?: RequestInit): Promise<Answer<T>> {
  const headers: Record<string, string> = { ...HDR };
  if (init?.body) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    // a request that never got an answer is not a refusal — say so rather than invent a status
    return { ok: false, status: 0, body: { error: "no answer from the fleet — is it still up?" } as T & { error?: string } };
  }
  let body = {} as T & { error?: string };
  try { body = (await res.json()) as T & { error?: string }; } catch { /* a non-JSON answer is still an answer */ }
  return { ok: res.ok, status: res.status, body };
}
const failure = (a: Answer<unknown>): string => a.body.error ?? (a.status ? `HTTP ${a.status}` : "no answer");

// The claim this browser holds, kept only so the run box knows which bundle it is talking about.
// ONE claim per device is a portal convention, not a server rule: the server refuses a second
// machine on the same tree, but nothing stops one person from claiming two different repos.
let claimed: ClaimedJob | null = null;
try {
  const raw = localStorage.getItem("fleetHelperClaim");
  claimed = raw ? (JSON.parse(raw) as ClaimedJob) : null;
} catch { claimed = null; } // a corrupt entry is no claim, not a broken page
function setClaimed(c: ClaimedJob | null): void {
  claimed = c;
  if (c) localStorage.setItem("fleetHelperClaim", JSON.stringify(c));
  else localStorage.removeItem("fleetHelperClaim");
}

function bootstrapText(job: ClaimedJob): string {
  const file = `${job.id}-${job.mainSha.slice(0, 8)}.bundle`;
  // THE ONE LINE THAT DIFFERS, and it is not cosmetic. An audit bundle names the integration branch
  // and a plain `git clone` checks it out. A preview bundle names a TRANSIENT branch that is not the
  // bundle's HEAD, and a plain clone of it produces a directory with no working tree in it — no
  // error a person would read as "you needed -b". So the preview clone names the branch, and the
  // comment above it says what happens without it.
  const clone = isLaneSuite(job)
    ? [
      `# the -b is required: without it this bundle clones with NO working tree and no error saying so`,
      `git clone -b ${job.branch ?? ""} ${file} fleet-suite && cd fleet-suite`,
    ]
    : [`git clone ${file} fleet-audit && cd fleet-audit`];
  return [
    "# needs: bun · tmux · git · zsh on PATH",
    "# 1 — download the bundle with the link above, then in the directory it landed in:",
    ...clone,
    "bun install --frozen-lockfile",
    './e2e-isolated.sh > log 2>&1; echo "exit=$?"',
    "# 2 — paste both of these into the boxes below:",
    "tail -40 log",
    "grep -ao 'isolated-[0-9TZ]*-[0-9]*' log | sort -u | head -1   # trail id",
  ].join("\n");
}

function chipFor(j: Job, mine: boolean): HTMLElement {
  if (j.localRunning) return el("span", { class: "chip busy" }, "local audit running");
  // …and there is deliberately no "local preview running" twin: nothing on this machine drains a
  // preview, so a chip claiming otherwise would be a statement about a state nothing measures.
  if (mine && claimed) return el("span", { class: "chip mine" }, `yours · ${left(claimed.expiresAt)} left`);
  if (j.claim) return el("span", { class: "chip other" }, `${j.claim.name} · ${left(j.claim.expiresAt)} left`);
  return el("span", { class: "chip" }, "open");
}

function jobCard(j: Job): HTMLElement {
  const mine = !!claimed && claimed.id === j.id;
  const card = el("div", { class: "card" });
  // The right-hand line says WHAT this job is, and the two kinds have nothing in common there: an
  // audit answers for N landed branches, a preview answers for one lane's working tree — including
  // the part of it that is not committed, which is exactly what a helper needs to know before
  // spending ~13 minutes on it.
  const summary = isLaneSuite(j)
    ? `preview suite · offered ${ago(j.oldestAt)} ago`
      + (j.untracked ? ` · ${j.untracked} untracked file(s) NOT included` : "")
    : `${j.covers} land(s) · oldest ${ago(j.oldestAt)} ago`;
  card.append(
    el("div", { class: "row" },
      el("b", {}, `${j.repo} ${j.main}`),
      chipFor(j, mine),
      el("span", { class: "muted grow right" }, summary)),
    el("div", { class: "branches" },
      isLaneSuite(j) ? "a lane's own tree, uncommitted work included" : j.branches.join(", ")));
  const msg = el("div", { class: "msg", id: `m-${j.id}` });

  if (!mine || !claimed) {
    const btn = el("button", { "data-claim": j.id }, isLaneSuite(j) ? "claim this preview run" : "claim this audit");
    if (j.claim || j.localRunning) btn.setAttribute("disabled", "");
    card.append(el("div", { class: "row spaced" }, btn), msg);
    return card;
  }

  const href = `/api/helper/bundle/${j.id}${TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : ""}`;
  const link = el("a", { href, download: "" }, `download bundle (${claimed.mainSha.slice(0, 8)})`);
  card.append(
    el("div", { class: "row spaced" }, link),
    el("pre", {}, bootstrapText(claimed)),
    el("div", { class: "row spaced" },
      el("span", { class: "lbl" }, "exit code"),
      el("input", { id: `exit-${j.id}`, class: "narrow", inputmode: "numeric", placeholder: "0" }),
      el("span", { class: "lbl" }, "trail id"),
      el("input", { id: `trail-${j.id}`, class: "grow", placeholder: "isolated-…" })),
    el("textarea", { id: `tail-${j.id}`, placeholder: "paste the tail of log here" }),
    el("div", { class: "row spaced" }, el("button", { "data-report": j.id }, "report result")),
    msg);
  return card;
}

function lapsedCard(lapsed: Lapse[]): HTMLElement | null {
  if (!lapsed.length) return null;
  const card = el("div", { class: "card" }, el("div", { class: "lbl" }, "lapsed claims"));
  for (const l of lapsed)
    card.append(el("div", { class: "muted" },
      `${l.name} · ${l.repo} · held ${ago(l.claimedAt)}, expired ${ago(l.expiredAt)} ago · `
      + `${l.covers} land(s) went back to the local drain`));
  return card;
}

async function refresh(): Promise<void> {
  const a = await api<JobsPayload>(`/api/helper/jobs?deviceId=${deviceId}`);
  const jobsBox = qs("jobs");
  clear(jobsBox);
  if (!a.ok) {
    jobsBox.append(el("div", { class: "card msg err" }, failure(a)));
    return;
  }
  const d = a.body;
  const nameBox = qs("name") as unknown as HTMLInputElement;
  if (d.device && document.activeElement !== nameBox) nameBox.value = d.device.name;
  // The subline used to say "post-land audits this fleet has queued", full stop, and that sentence
  // was the reason a lane's preview run could not be found here — it described the only source
  // there was. Both are named now, and so is the difference in what a lapse means: an audit falls
  // back to this machine, a preview does not (nothing drains it; its lane runs it itself).
  const claimMin = Math.round(d.claimTimeoutMs / 60000);
  qs("sub").textContent = d.configured
    ? `post-land audits this fleet has queued, and preview suites its lanes have offered — a claim`
      + ` lasts ${claimMin} min; an audit then falls back to the local drain, a preview goes back to its lane`
    : `this fleet has no post-land audit command configured — only preview suites a lane offers can`
      + ` appear here, and a claim on one lasts ${claimMin} min`;
  // a job we believe we hold that the fleet no longer lists as claimed is a job that lapsed or was
  // already reported: drop the local memory of it rather than showing a run box for work nobody is
  // waiting for.
  if (claimed && !d.jobs.some((j) => j.id === claimed?.id && j.claim)) setClaimed(null);
  if (!d.jobs.length) jobsBox.append(el("div", { class: "card muted" },
    "nothing is waiting. Land something, or let a lane offer its preview suite, and this page fills up."));
  for (const j of d.jobs) jobsBox.append(jobCard(j));
  const lapsedBox = qs("lapsed");
  clear(lapsedBox);
  const lc = lapsedCard(d.lapsed);
  if (lc) lapsedBox.append(lc);
}

async function doClaim(btn: HTMLElement, id: string): Promise<void> {
  btn.setAttribute("disabled", "");
  const a = await api<{ job: ClaimedJob }>("/api/helper/claim",
    { method: "POST", body: JSON.stringify({ jobId: id, deviceId }) });
  if (!a.ok) {
    const m = qs(`m-${id}`);
    m.className = "msg err";
    m.textContent = failure(a);
    btn.removeAttribute("disabled");
    return;
  }
  setClaimed(a.body.job);
  await refresh();
}

async function doReport(btn: HTMLElement, id: string): Promise<void> {
  const m = qs(`m-${id}`);
  const raw = (qs(`exit-${id}`) as unknown as HTMLInputElement).value.trim();
  // the exit code IS the verdict — an empty box would be reported as "no measurement", which is a
  // very different claim from the one somebody who just watched a suite finish means to make
  if (!/^-?\d+$/.test(raw)) {
    m.className = "msg err";
    m.textContent = "an exit code is the verdict — type the number the run printed.";
    return;
  }
  btn.setAttribute("disabled", "");
  const a = await api<{ result: string; reason?: string }>("/api/helper/result", {
    method: "POST",
    body: JSON.stringify({
      jobId: id, exitCode: Number(raw),
      tail: (qs(`tail-${id}`) as unknown as HTMLTextAreaElement).value,
      trail: (qs(`trail-${id}`) as unknown as HTMLInputElement).value,
    }),
  });
  if (!a.ok) {
    m.className = "msg err";
    m.textContent = failure(a);
    btn.removeAttribute("disabled");
    return;
  }
  setClaimed(null);
  m.className = "msg ok";
  m.textContent = `reported: ${a.body.result}${a.body.reason ? ` — ${a.body.reason}` : ""}`;
  setTimeout(() => void refresh(), 1200);
}

document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement | null;
  const claimBtn = target?.closest("[data-claim]") as HTMLElement | null;
  if (claimBtn) { void doClaim(claimBtn, claimBtn.dataset.claim ?? ""); return; }
  const reportBtn = target?.closest("[data-report]") as HTMLElement | null;
  if (reportBtn) void doReport(reportBtn, reportBtn.dataset.report ?? "");
});

qs("savename").addEventListener("click", () => void (async () => {
  const name = (qs("name") as unknown as HTMLInputElement).value.trim();
  const a = await api<{ device: { name: string } }>("/api/helper/device",
    { method: "POST", body: JSON.stringify({ deviceId, name }) });
  const note = qs("namemsg");
  note.className = a.ok ? "muted" : "msg err";
  note.textContent = a.ok ? `saved on the fleet as “${a.body.device.name}”.` : failure(a);
})());

void refresh();
setInterval(() => void refresh(), 10000);
