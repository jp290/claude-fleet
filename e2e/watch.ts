// THE OUTBOUND CHANNEL for `doneLooking` (server.ts, interface Watch + tickWatches). Fleet has
// computed this predicate on the 2s poll since the perception layer landed and told nobody: auto-③
// consumed it, every other reader was already looking. A watch is a subscription — one slot asks to
// be told, ONCE, when another slot's lane looks done.
//
// What these checks are really guarding is the difference between a notification and a verdict.
// The message must carry the facts it fired on (branch, ahead/dirty) AND say that "looks done" is a
// predicate, not a report from the lane — CLAUDE.md's four look-alike states are indistinguishable
// to it. A message that read as "it is finished" would turn a wait-remover into a land-trigger.
//
// Timing: the harness shrinks the idle gate (FLEET_AUTO_REVIEW_IDLE_MS=1500) and the delivery tick
// (FLEET_AUTOS_TICK_MS), but the git facts the predicate reads refresh on the 10s tickGit, so the
// first fire cannot happen sooner than that. Every wait here is a POLL with a loud bound, never a
// fixed sleep.
import { spawnSync } from "node:child_process";
import { AUTOS_TICK_MS, REPO, check, get, plogRead, post, tmuxOut } from "./harness";

interface WatchRow {
  id: string; slot: number; target: number; targetBranch: string;
  armed: boolean; firedAt: number | null; lastResult: string | null;
}
const watchRows = async (): Promise<WatchRow[]> =>
  ((await (await get("/api/sessions")).json()) as { watches: WatchRow[] }).watches;
const watchRow = async (id: string): Promise<WatchRow | undefined> =>
  (await watchRows()).find((w) => w.id === id);
const freeSlot = async (): Promise<number> =>
  ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((x) => x.cwd === null)?.id ?? 0;

export async function run(): Promise<void> {
  // --- the subject: a lane that commits and goes quiet (idle + clean + ahead>0) ---
  const tgt = (await (await post("/api/lanes", { repo: REPO })).json()) as
    { slot: number; cwd: string; branch: string };
  await Bun.write(`${tgt.cwd}/watch-target.txt`, "the work the watcher is waiting for\n");
  spawnSync("git", ["-C", tgt.cwd, "add", "watch-target.txt"]);
  spawnSync("git", ["-C", tgt.cwd, "commit", "-qm", "watch target lane work"]);

  // --- the receivers, both PLAIN slots: the session this feature exists for is a driving main
  // checkout, which is exactly the slot shape that carries no FLEET_SELF_TOKEN (hence the owner
  // route). `rcvA` is left quiet and gets idleSec:0; `rcvB` is deliberately kept busy. ---
  const aId = await freeSlot();
  const openA = aId ? await post(`/api/slots/${aId}/open`, { cwd: REPO }) : null;
  check("watch setup: a plain receiver slot is open", !!openA?.ok, `${aId} ${openA?.status}`);
  const bId = await freeSlot();
  const openB = bId ? await post(`/api/slots/${bId}/open`, { cwd: REPO }) : null;
  check("watch setup: a second plain receiver slot is open", !!openB?.ok, `${bId} ${openB?.status}`);

  // --- REJECTIONS. Every one answers the same question — can this watch ever fire? A watch that
  // cannot is worse than none, because it is a silent forever-wait, which is the failure the whole
  // surface removes. So a target the predicate never classifies is refused at CREATE time. ---
  const rNonLane = await post(`/api/slots/${aId}/watch`, { target: bId });
  check("watch on a NON-LANE slot is refused (done-looking only classifies lanes)",
    rNonLane.status === 409, `${rNonLane.status} ${await rNonLane.text()}`);
  const rSelf = await post(`/api/slots/${aId}/watch`, { target: aId });
  check("a session cannot watch itself", rSelf.status === 400, String(rSelf.status));
  const rIdle = await post(`/api/slots/${aId}/watch`, { target: await freeSlot() });
  check("watch on an INACTIVE slot is refused", rIdle.status === 400, String(rIdle.status));
  const rBogus = await post(`/api/slots/${aId}/watch`, { target: 999 });
  check("watch on a nonexistent slot is refused", rBogus.status === 400, String(rBogus.status));
  {
    // the ⚙ steward is a lane by every mechanical test and is still excluded by name — a planning
    // pane's diff is not lane work, so the predicate never fires for it and neither may a watch
    const st = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number };
    await post(`/api/slots/${st.slot}/rename`, { label: "⚙ steward" });
    const rStew = await post(`/api/slots/${aId}/watch`, { target: st.slot });
    check("watch on the ⚙ steward is refused even though it is a worktree lane",
      rStew.status === 409, `${rStew.status} ${await rStew.text()}`);
    await post(`/api/slots/${st.slot}/kill`, {});
  }

  // --- the subscription itself ---
  const wA = await post(`/api/slots/${aId}/watch`, { target: tgt.slot, idleSec: 0 });
  const wAJ = (await wA.json()) as { watch: WatchRow };
  check("subscribe: a plain slot may watch a lane", wA.ok && !!wAJ.watch?.id && wAJ.watch.armed === true,
    JSON.stringify(wAJ).slice(0, 160));
  check("the watch pins the target's BRANCH, not just its recycled slot id",
    wAJ.watch?.targetBranch === tgt.branch, `${wAJ.watch?.targetBranch} vs ${tgt.branch}`);
  // a second subscribe is the same subscription, not a second one: two armed watches would deliver
  // the same news twice into one pane
  const wDup = (await (await post(`/api/slots/${aId}/watch`, { target: tgt.slot })).json()) as
    { watch: WatchRow; existing?: boolean };
  check("re-subscribing to the same target returns the SAME watch, never a second",
    wDup.existing === true && wDup.watch?.id === wAJ.watch.id
    && (await watchRows()).filter((w) => w.slot === aId && w.armed).length === 1,
    `${wDup.watch?.id} vs ${wAJ.watch.id}`);

  // the busy receiver: same target, but its pane is loud and the gate is an hour. The wait for
  // lastOutput>0 is what makes this a test of the BUSY gate rather than a race with it: until
  // poll() has seen a first byte the field is 0, and `now - 0` is ~1.79e12 ms — the arithmetic
  // that made this very check fail on the first run by handing the message to a pane that had
  // produced nothing yet (server.ts, THE UNOBSERVED-PANE HOLE).
  await tmuxOut("send-keys", "-t", `s${bId}`, "echo watch-busy-marker", "Enter");
  let observed = 0;
  for (let i = 0; i < 60 && !observed; i++) {
    await Bun.sleep(250);
    observed = ((await (await get("/api/sessions")).json()) as { slots: { id: number; lastOutput: number }[] })
      .slots.find((x) => x.id === bId)?.lastOutput ?? 0;
  }
  check("watch setup: the busy receiver's pane has actually been observed (lastOutput>0)",
    observed > 0, String(observed));
  const wB = (await (await post(`/api/slots/${bId}/watch`, { target: tgt.slot, idleSec: 3600 })).json()) as
    { watch: WatchRow };
  check("subscribe: a busy receiver may also watch the same lane", !!wB.watch?.id, JSON.stringify(wB).slice(0, 120));

  // --- the fire. Poll the watch row, bounded and loud: the git facts refresh on the 10s tickGit,
  // so this is the one genuinely slow wait in the section. ---
  let fired: WatchRow | undefined;
  for (let i = 0; i < 45 && !(fired?.lastResult === "sent"); i++) {
    await Bun.sleep(1000);
    fired = await watchRow(wAJ.watch.id);
  }
  check("the watch fired by itself when the lane went done-looking — no owner click anywhere",
    fired?.lastResult === "sent" && fired.armed === false && typeof fired.firedAt === "number",
    JSON.stringify(fired));

  // --- WHAT IT SAID. Asserted against the prompt log, which stores the text verbatim, not against
  // capture-pane (a ~450-char line wraps at the pane width and would make the assertion a test of
  // tmux's reflow). The pane itself is checked separately, on a substring that starts a line. ---
  const msgs = (await plogRead()).filter((e) => e.slot === aId && e.text.startsWith("[fleet] slot "));
  check("the notification reached the pane exactly once", msgs.length === 1,
    `${msgs.length}: ${msgs.map((m) => m.text.slice(0, 40)).join(" | ")}`);
  const msg = msgs[0]?.text ?? "";
  check("the message names the target slot AND its branch",
    msg.includes(`slot ${tgt.slot} (${tgt.branch})`), msg.slice(0, 120));
  check("the message carries the facts the predicate fired on (ahead/dirty)",
    msg.includes("1 ahead / 0 dirty"), msg.slice(0, 200));
  check("the message says LOOKS done, and says why that is not 'is done'",
    msg.includes("LOOKS done") && !/\bis done\b/.test(msg)
    && msg.includes("NOT a report from that lane") && msg.includes("never land on this message alone"),
    msg.slice(0, 260));
  const capA = await tmuxOut("capture-pane", "-t", `s${aId}`, "-p");
  check("the notification is really in the receiving pane, not just the log",
    capA.out.includes("[fleet] slot "), capA.out.slice(-200));

  // --- EXACTLY ONCE. The predicate is LEVEL-triggered — the lane stays idle+clean+ahead forever —
  // so an armed-forever watch would be a nudge every tick. Several ticks later: still one message. ---
  await Bun.sleep(AUTOS_TICK_MS * 4 + 1500);
  const after = await watchRow(wAJ.watch.id);
  check("a spent watch stays spent — later ticks deliver nothing more",
    after?.armed === false
    && (await plogRead()).filter((e) => e.slot === aId && e.text.startsWith("[fleet] slot ")).length === 1,
    JSON.stringify(after));

  // --- the busy receiver, over the same window: the news does not EXPIRE. A notification dropped
  // because its receiver happened to be working is the exact hole the background-watcher crutch
  // had, so the idle gate holds the watch ARMED instead of spending it. ---
  const busy = await watchRow(wB.watch.id);
  check("a busy receiver's watch is held, not spent — it still owes the message",
    busy?.armed === true && busy.lastResult === null
    && !(await plogRead()).some((e) => e.slot === bId && e.text.startsWith("[fleet] slot ")),
    JSON.stringify(busy));

  // --- the target goes away while a watch is still armed. Deleting the row silently would leave
  // "still waiting" indistinguishable from "will never come" — the belief this feature exists to
  // make impossible. It disarms WITH the reason attached. ---
  await post(`/api/slots/${tgt.slot}/kill`, {});
  const orphan = await watchRow(wB.watch.id);
  check("killing the target disarms the watch with its reason, rather than deleting it silently",
    orphan?.armed === false && (orphan.lastResult ?? "").includes("target session ended"),
    JSON.stringify(orphan));
  check("a disarmed watch never delivers",
    !(await plogRead()).some((e) => e.slot === bId && e.text.startsWith("[fleet] slot ")));

  // --- teardown: a watch must not outlive its receiver either ---
  check("delete a watch", (await post(`/api/watches/${wAJ.watch.id}/delete`, {})).ok);
  check("deleted watch gone", !(await watchRow(wAJ.watch.id)));
  await post(`/api/slots/${bId}/kill`, {});
  check("killing the RECEIVER drops its watches entirely — nobody left to tell",
    !(await watchRows()).some((w) => w.slot === bId), JSON.stringify(await watchRows()));
  await post(`/api/slots/${aId}/kill`, {});
}
