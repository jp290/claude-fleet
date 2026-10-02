import { $, el, post, setDrawer } from "./client";
import { boardHead, gateAge, renderBoard } from "./board";

// --- WHICH MACHINES TAKE WORK OFF THIS BOX: the helper device register --------------------------
// The board's only view of the second machine. It sits with the gate line rather than in the lane
// story because it is a fact about the MACHINE ROOM, not about the lane under the cursor: which
// helpers exist, whether they are beating, what the owner asked of them, what they hold right now.
//
// EVERY FIELD BELOW IS FOREIGN DATA. The name, the reported mode, the load and the capability list
// are strings another machine chose and this fleet stores verbatim; they reach the DOM only through
// `el()` / createTextNode (textContent), never as markup and never interpolated into one. Wire
// shape is tolerant on purpose — an older server sends no `helperDevices` at all (the panel is then
// absent, which is what "no register" looks like), and a device that has never reported a mode has
// no `mode` key. `mode` is typed as a plain string, not the closed set: a value this client does
// not know must render as the text it is, never be silently mapped onto one this client does know.
// `slot`/`cmd` ride on a `command` claim only (server.ts#heldClaimsByDevice)
interface HelperDeviceClaim { kind?: string; repo: string; ref: string; claimedAt?: number; expiresAt: number; slot?: number; cmd?: string }
interface HelperDeviceUpdate {
  state?: string; requestedAt?: number; mainSha?: string;
  result?: { ok?: boolean; exitCode?: number | null; mainSha?: string; note?: string };
}
export interface HelperDeviceInfo {
  id: string; name: string; lastSeen: number;
  mode?: string; load?: number; capabilities?: string[];
  desiredMode?: string; desiredSet?: boolean;
  claims?: HelperDeviceClaim[]; lapses?: number;
  daemonSha?: string; update?: HelperDeviceUpdate | null;
  // the capacity pair, shipped together or not at all (server.ts#helperDevicesView). Optional for
  // the usual back-compat reason: a device that never reported them draws no line rather than a
  // number this page made up.
  maxParallelSuites?: number; running?: number;
  // the wake rail. `wakeConfigured` is optional here and NOT on the server for the usual reason:
  // an older server sends neither field, and `undefined` has to stay distinguishable from a server
  // that answered "no MAC, no address" — the first draws nothing, the second says so.
  lastWakeAt?: number; wakeConfigured?: boolean;
}
// ONLINE/OFFLINE IS DERIVED, NEVER STORED — the same reading that makes a claim expire: there is no
// "offline" event anywhere in this system, only a heartbeat that stopped arriving.
// THE WINDOW IS THE SERVER'S AND IS READ, NEVER SPELLED. This file used to carry its own module
// constant holding the same 90-second figure, and the server answered the same question from a
// second copy of it as soon as /api/self/gate learned to — two programs deciding "is that machine
// there?" separately is exactly the drift the projection exists to prevent. It now arrives beside
// the register (server.ts#DEVICE_ONLINE_MS), and e2e/pins.ts §S11 pins the single source: that pin
// counts DECLARATIONS, so this paragraph deliberately names the old constant nowhere.
// `null` = the server sent rows without a window, which only an OLDER server does. That is not
// "offline" and is not "online": the dot says the window was not served and prints the age anyway,
// because the age is a measurement and the verdict would be an invention.
// The age is ALWAYS printed next to the word, so "offline" is never a bare claim: it says how long
// ago the last beat was and lets the owner judge the gap themselves.
export let deviceOnlineMs: number | null = null;
// The closed set the owner can wish for. It is the server's `DEVICE_MODES` (server.ts) spelled a
// second time — deliberately not pinned: the server validates the value and refuses anything else
// with a 400 the button surfaces, so a drift here is a loud button, not a silent wrong state.
const DEVICE_WISH_MODES = ["active", "quiet", "off"] as const;
const DEVICE_WISH_TITLE: Record<string, string> = {
  active: "Take work: the daemon polls for jobs and may claim them.",
  quiet: "Finish what you hold, take nothing new.",
  off: "Stop polling entirely. Anything it holds lapses and falls back to this box.",
};
export let helperDevicesInfo: HelperDeviceInfo[] = [];
export function devicesSection(): HTMLElement | null {
  // no register, no chrome — the same rule the gate and deploy lines follow. A fleet that has never
  // seen a helper draws nothing at all here.
  if (!helperDevicesInfo.length) return null;
  const sec = el("div", "bsec");
  sec.appendChild(boardHead("helper devices", "fleet"));
  for (const d of helperDevicesInfo) sec.appendChild(deviceCard(d));
  return sec;
}
function deviceCard(d: HelperDeviceInfo): HTMLElement {
  const box = el("div", "bdev");
  box.appendChild(el("div", "bidhead", d.name));
  const age = Math.max(0, Date.now() - d.lastSeen);
  const online = deviceOnlineMs === null ? null : age < deviceOnlineMs;
  const state = el("div", "bstate");
  const dot = el("span", online ? "ready" : "",
    online === null ? "○ heartbeat window not served" : online ? "● online" : "○ offline");
  dot.title = online === null
    ? `This server sent the register without its online window, so nothing here can say whether ${gateAge(age)} is inside it. The age is measured; the verdict is not invented.`
    : online
      ? `Its last heartbeat is ${gateAge(age)} old — younger than the ${Math.round(deviceOnlineMs! / 1000)}s window. Derived from lastSeen; nothing here pings the machine.`
      : `Nothing has been heard from it for ${gateAge(age)} (window: ${Math.round(deviceOnlineMs! / 1000)}s). That is a silence, not a report — the machine may be off, asleep, or simply not running the daemon.`;
  state.appendChild(dot);
  // the device's OWN reading of itself, and absent means it never said — not "active"
  state.appendChild(document.createTextNode(
    ` · ${d.mode ? `reports ${d.mode}` : "has never reported a mode"} · last beat ${gateAge(age)} ago`));
  state.title = "What the device says about itself, from its last heartbeat. It is a report, not a setting — the owner's wish is the row below.";
  box.appendChild(state);
  // the owner's half: a wish, stored and nothing more. The device finds out on its next heartbeat.
  const wish = el("div", "bidmeta", d.desiredSet
    ? "your wish for it:"
    : "your wish for it: never set — the default below is what it pulls");
  wish.title = "Stored only. Fleet never opens a connection to that machine: it reads this wish in the reply to its own next heartbeat, or never, if it has stopped beating.";
  box.appendChild(wish);
  const row = el("div", "bbtnrow");
  const btns: HTMLButtonElement[] = [];
  for (const m of DEVICE_WISH_MODES) {
    const b = el("button", `bbtn subtle${d.desiredMode === m ? " on" : ""}`, m) as HTMLButtonElement;
    b.title = DEVICE_WISH_TITLE[m] ?? m;
    b.onclick = async () => {
      for (const x of btns) x.disabled = true;
      const res = await post(`/api/helper/devices/${encodeURIComponent(d.id)}/mode`, { mode: m });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        alert(j?.error ?? "the mode could not be set");
        for (const x of btns) x.disabled = false;
        return;
      }
      // paint the answer at once rather than waiting for the next 2 s poll — the same row is
      // rebuilt from the server's own payload on that poll either way, so this can only be early,
      // never wrong.
      d.desiredMode = m;
      d.desiredSet = true;
      repaintDevices();
    };
    btns.push(b);
    row.appendChild(b);
  }
  box.appendChild(row);
  for (const c of d.claims ?? []) {
    const what = c.kind === "lane-suite" ? "a lane preview" : c.kind === "audit" ? "an audit"
      : c.kind === "command" ? `a gate script${c.cmd ? ` (${c.cmd.replace(/^\.\//, "")})` : ""}` : `a ${c.kind ?? "?"} job`;
    const r = el("div", "bidmeta", `holds ${what} · ${c.repo} ${c.ref} · ${gateAge(Math.max(0, c.expiresAt - Date.now()))} left`);
    r.title = "Work this machine has taken off this box. The local drain skips it until the claim expires; past that it falls back here, whether or not the helper ever answers.";
    box.appendChild(r);
  }
  // ALWAYS drawn, including the zero: "this device has never dropped a job" is the fact the owner
  // is looking for, and an omitted line would be indistinguishable from a device with no history.
  const lap = el("div", "bidmeta", d.lapses === undefined
    ? "lapse count not reported by this server"
    : d.lapses === 0 ? "no lapses" : `${d.lapses} lapse${d.lapses === 1 ? "" : "s"}`);
  lap.title = "A lapse is a job this device claimed and never answered for. Counted by device identity; rows booked before that identity was recorded join by NAME, so a device renamed since then does not carry its older lapses here.";
  box.appendChild(lap);
  // what it says it is carrying, and what it says it can run — reported, uncorroborated, and drawn
  // only when it actually said something
  const rep: string[] = [];
  if (d.load !== undefined) rep.push(`load ${d.load}`);
  // THE LINE `load` COULD NEVER GIVE: how many of the runs on that box are this fleet's, and how
  // many more it will take. Drawn from the device's own count, never derived from the claims list —
  // a claim is held here, a run happens there, and the gap between them is the thing worth seeing.
  if (d.maxParallelSuites !== undefined)
    rep.push(`${d.running ?? 0}/${d.maxParallelSuites} suite slot${d.maxParallelSuites === 1 ? "" : "s"}`);
  if (d.capabilities?.length) rep.push(`can run ${d.capabilities.join(", ")}`);
  if (rep.length) {
    const r = el("div", "bidmeta", rep.join(" · "));
    r.title = "Reported by the device itself on its last heartbeat. Nothing on this box reads these — they are for your eye.";
    box.appendChild(r);
  }
  // the commit the daemon says it runs from — 8 digits, measured on the other machine at its own
  // boot, absent when that daemon predates the field or runs from a plain copy. Beside it, the
  // owner's standing update wish and how it went; the two shas agreeing is what „[Zitat entfernt]“
  // looks like, and the board only ever compares — it never restarts anything over there.
  // THE ONE BUTTON ON THIS BOARD THAT REACHES OUT. Drawn only where the server said the frame
  // would go somewhere (`wakeConfigured`), because a button that can only ever 409 teaches the
  // owner to distrust the panel. Absent field = an older server = no row at all, which is the same
  // silence every other back-compat read here produces.
  if (d.wakeConfigured !== undefined) {
    const wrow = el("div", "bbtnrow");
    if (d.wakeConfigured) {
      const wb = el("button", "bbtn subtle", "wecken") as HTMLButtonElement;
      wb.title = "Send one Wake-on-LAN magic packet to that machine's MAC. The single exception to \"Fleet never opens anything towards a helper\": a broadcast frame with no credential, no session and no reply. It says the frame LEFT this box — never that the machine woke up.";
      wb.onclick = async () => {
        wb.disabled = true;
        const res = await post(`/api/helper/devices/${encodeURIComponent(d.id)}/wake`, {});
        const j = (await res.json().catch(() => null)) as { sent?: boolean; at?: number; error?: string } | null;
        if (!res.ok || j?.sent !== true) alert(j?.error ?? "the wake frame could not be sent");
        // stamped from the server's own `at` either way: the field is "last attempt", and the 2 s
        // poll rebuilds this row from the same value.
        if (typeof j?.at === "number") d.lastWakeAt = j.at;
        wb.disabled = false;
        repaintDevices();
      };
      wrow.appendChild(wb);
    }
    const stamp = el("div", "bidmeta", !d.wakeConfigured
      ? "wake not configured on this Fleet host (no MAC for this device, or no broadcast address)"
      : d.lastWakeAt ? `last wake frame ${gateAge(Math.max(0, Date.now() - d.lastWakeAt))} ago`
        : "never woken from here");
    stamp.title = "When a magic packet last LEFT this box for that machine. There is no acknowledgement to record — whether it arrived is answered only by the next heartbeat.";
    if (d.wakeConfigured) box.appendChild(wrow);
    box.appendChild(stamp);
  }
  const shaLine = el("div", "bidmeta", d.daemonSha ? `daemon at ${d.daemonSha.slice(0, 8)}` : "daemon sha not reported");
  shaLine.title = "git rev-parse HEAD of the tree the daemon started from, sent on its heartbeat. Not a setting: it is what is running there right now.";
  box.appendChild(shaLine);
  const u = d.update;
  if (u && u.state) {
    const target = u.result?.mainSha ?? u.mainSha;
    const went = u.state === "reported"
      ? (u.result?.ok ? "swapped — restarting from the new tree" : `failed${u.result?.note ? `: ${u.result.note}` : ""}`)
      : u.state === "claimed" ? "being applied" : "queued — it takes it on its next poll";
    const applied = u.state === "reported" && u.result?.ok && target && d.daemonSha === target;
    const ul = el("div", "bidmeta",
      `update${target ? ` to ${target.slice(0, 8)}` : ""}: ${applied ? "applied — the daemon now runs it" : went}`);
    ul.title = "Queued by you on this board, taken by the daemon on its own poll: clone, parse-check, symlink swap, exit 75, restart by systemd. The old tree stays on the machine as the way back.";
    box.appendChild(ul);
  }
  return box;
}

// --- ...AND THE WAY IN: the 💻 button and its overlay -------------------------------------------
// The section above lives inside the SESSION BRIEF board, which is opened per pane and is
// desktop-only (renderBoard bails at isMobile()). That made the register something you could only
// see while looking at a lane, and never from the phone — for the one surface whose whole point is
// "both machines in ONE UI", that is the wrong front door. So the same cards get a door of their
// own beside 📣/📥, built from the SAME deviceCard(): two renderers of one row would be two
// chances to disagree about what a device is doing.
export let devdlg: HTMLElement;
let devpanel: HTMLElement;
export let devbtn: HTMLElement;
export const devIsOpen = (): boolean => devdlg.style.display === "flex";
// A device that is not beating while it HOLDS work is the one state on this panel that wants the
// owner's eye: the claim is still the helper's until it expires, so this box is not auditing that
// tree and the other one may or may not be. It is a LOOKING GLASS like the ops inbox — nothing
// here reaps, requeues or fails anything; the claim's own deadline does that, on its own clock.
// …and with no window served there is no such thing as "not beating": the list is empty rather
// than guessed, so the ⚠ badge can never be raised on a threshold this client made up.
const devStale = (): HelperDeviceInfo[] =>
  deviceOnlineMs === null ? []
    : helperDevicesInfo.filter((d) => Date.now() - d.lastSeen >= deviceOnlineMs! && (d.claims?.length ?? 0) > 0);
export function renderDevBtn() {
  const n = helperDevicesInfo.length;
  const m = devStale().length;
  devbtn.textContent = `💻${n > 0 ? n : ""}${m > 0 ? ` ⚠${m}` : ""}`;
  devbtn.classList.toggle("hot", m > 0);
  devbtn.title = n === 0
    ? "helper devices — no machine has ever registered here"
    : `${n} helper device${n === 1 ? "" : "s"}`
      + (m > 0 ? ` · ${m} holding work while not beating` : "")
      + " — the machines that take suite and audit work off this box";
  // same rule as 📣 and 📥: no affordance while there is nothing behind it, so the icon means
  // something the moment it appears. It stays while the dialog is open, or closing it would
  // remove the button under the owner's cursor.
  devbtn.style.display = n > 0 || devIsOpen() ? "" : "none";
}
// ONE entry point for "the register moved": the poll calls it, and so does the wish-mode button,
// which is why deviceCard can repaint both surfaces without knowing which one it is drawn in.
function repaintDevices() {
  renderDevBtn();
  if (devIsOpen()) renderDevDlg();
  void renderBoard();
}
export function closeDevDlg() {
  devdlg.style.display = "none";
  renderDevBtn();
}

export function renderDevDlg() {
  devpanel.replaceChildren();
  devpanel.appendChild(el("h2", "", "Helper devices — the machines that take work off this box"));
  if (!helperDevicesInfo.length) {
    // reachable only with the dialog already open when the last device is evicted
    devpanel.appendChild(el("div", "hint shrhint", "No device has ever registered here."));
  } else {
    devpanel.appendChild(el("div", "hint shrhint",
      "Online/offline is DERIVED from the last heartbeat, never reported: a machine that stops "
      + "beating simply goes quiet, and anything it holds falls back to this box when its claim "
      + "expires. The mode you pick is a WISH — it is stored here and the device reads it on its "
      + "own next heartbeat; nothing on this box ever calls out to that machine."));
    for (const d of helperDevicesInfo) devpanel.appendChild(deviceCard(d));
  }
  const btns = el("div", "shrbtns");
  const close = el("button", "shrbtn", "close") as HTMLButtonElement;
  close.onclick = closeDevDlg;
  btns.appendChild(close);
  devpanel.appendChild(btns);
}



export function setDeviceSnapshot(devices: HelperDeviceInfo[], onlineMs: number | null): void {
  helperDevicesInfo = devices;
  deviceOnlineMs = onlineMs;
}

export function initDevices(): void {
  devdlg = $("devdlg"); devpanel = $("devpanel"); devbtn = $("devbtn");
  devdlg.addEventListener("click", (e) => {
    if (e.target === devdlg) closeDevDlg();
  });
  devbtn.onclick = () => {
    setDrawer(false);
    devdlg.style.display = "flex";
    renderDevDlg();
  };
  renderDevBtn();
}
