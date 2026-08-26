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

interface Job {
  id: string; repo: string; main: string; branches: string[]; covers: number; oldestAt: number;
  claim: { name: string; claimedAt: number; expiresAt: number } | null; localRunning: boolean;
}
interface Lapse { id: string; repo: string; name: string; claimedAt: number; expiredAt: number; covers: number }
interface JobsPayload {
  claimTimeoutMs: number; configured: boolean; jobs: Job[]; lapsed: Lapse[];
  device: { id: string; name: string } | null; error?: string;
}
interface ClaimedJob {
  id: string; repo: string; main: string; mainSha: string;
  branches: string[]; covers: number; claimedAt: number; expiresAt: number; name: string;
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
  return [
    "# needs: bun · tmux · git · zsh on PATH",
    "# 1 — download the bundle with the link above, then in the directory it landed in:",
    `git clone ${file} fleet-audit && cd fleet-audit`,
    "bun install --frozen-lockfile",
    './e2e-isolated.sh > log 2>&1; echo "exit=$?"',
    "# 2 — paste both of these into the boxes below:",
    "tail -40 log",
    "grep -ao 'isolated-[0-9TZ]*-[0-9]*' log | sort -u | head -1   # trail id",
  ].join("\n");
}

function chipFor(j: Job, mine: boolean): HTMLElement {
  if (j.localRunning) return el("span", { class: "chip busy" }, "local audit running");
  if (mine && claimed) return el("span", { class: "chip mine" }, `yours · ${left(claimed.expiresAt)} left`);
  if (j.claim) return el("span", { class: "chip other" }, `${j.claim.name} · ${left(j.claim.expiresAt)} left`);
  return el("span", { class: "chip" }, "open");
}

function jobCard(j: Job): HTMLElement {
  const mine = !!claimed && claimed.id === j.id;
  const card = el("div", { class: "card" });
  card.append(
    el("div", { class: "row" },
      el("b", {}, `${j.repo} ${j.main}`),
      chipFor(j, mine),
      el("span", { class: "muted grow right" }, `${j.covers} land(s) · oldest ${ago(j.oldestAt)} ago`)),
    el("div", { class: "branches" }, j.branches.join(", ")));
  const msg = el("div", { class: "msg", id: `m-${j.id}` });

  if (!mine || !claimed) {
    const btn = el("button", { "data-claim": j.id }, "claim this audit");
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
  qs("sub").textContent = d.configured
    ? `post-land audits this fleet has queued — a claim lasts ${Math.round(d.claimTimeoutMs / 60000)} min,`
      + " then the job falls back to the local drain"
    : "this fleet has no post-land audit command configured — nothing will ever queue here";
  // a job we believe we hold that the fleet no longer lists as claimed is a job that lapsed or was
  // already reported: drop the local memory of it rather than showing a run box for work nobody is
  // waiting for.
  if (claimed && !d.jobs.some((j) => j.id === claimed?.id && j.claim)) setClaimed(null);
  if (!d.jobs.length) jobsBox.append(el("div", { class: "card muted" },
    "no audit is waiting. Land something and this page fills up."));
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
