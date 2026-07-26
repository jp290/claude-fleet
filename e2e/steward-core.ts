// The steward principal, first half: its scoped token, the reduced fleet-wide reads, the
// deploy-gap / transcript-size / bundle-staleness facts, transcript redaction, the owner-only
// 403s, typed+capped sends across an audit rotation, the journal and the P3 digest.
import { DONE_LOOKING_PROSE } from "../lane-signals";
import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { CONTINUITY_REGIME_START, CONTINUITY_SOURCES, CONTINUITY_WINDOW_MS, type ContinuitySummary } from "../continuity";
import { BASE, REPO, check, get, paneEnv, plogRead, post, readText, tmuxOut } from "./harness";
import type { Ctx, StewardCtx } from "./ctx";
import { settleForMerge } from "./lane-helpers";

export type DigJ = {
  now?: number; prior?: { kind?: string } | null; slots?: { id: number }[];
  digest?: { conditions?: Record<string, string>; changed?: string[]; attention?: string[] } | null;
  digestAt?: number | null; digestAge?: number | null; waitMs?: number; error?: string;
};

export async function run(ctx: Ctx): Promise<StewardCtx> {
  const gapGit = (...a: string[]) => Bun.spawnSync(["git", "-C", ctx.gapRepo, ...a]);
  const auditRead = async (): Promise<{ ts: number; event: string; slot?: number; detail?: string }[]> =>
    (await Bun.file(ctx.auditPath).text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const stewTokRes = await get("/api/steward/token");
  const stewTokJ = (await stewTokRes.json()) as { token?: string };
  check("owner can read the steward token", stewTokRes.ok && !!stewTokJ.token, JSON.stringify(stewTokJ));
  const STEW = stewTokJ.token ?? "";
  const stewH = { "content-type": "application/json", authorization: `Bearer ${STEW}` };
  const stewGet = (path: string) => fetch(BASE + path, { headers: stewH });
  const stewPost = (path: string, body: unknown) =>
    fetch(BASE + path, { method: "POST", headers: stewH, body: JSON.stringify(body) });

  const lnStew = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await post(`/api/slots/${lnStew.slot}/rename`, { label: "⚙ steward" });

  // --- reads: fleet-wide, but reduced (no share secrets, no thinking/tool-result payloads) ---
  const stewSessRes = await stewGet("/api/steward/sessions");
  const stewSessJ = (await stewSessRes.json()) as { slots: { id: number; cwd: string | null; label: string | null }[] };
  check("steward token reads /api/steward/sessions", stewSessRes.ok && Array.isArray(stewSessJ.slots), JSON.stringify(stewSessJ).slice(0, 200));
  check("steward sessions payload carries no share secret field",
    !JSON.stringify(stewSessJ).includes("password"));

  // --- deploy-gap fact (P-4): landing is NOT deploying. The server stamped ctx.gapRepo's HEAD at
  //     its own boot; every read compares it against that repo's CURRENT head, so a commit that
  //     lands after boot is visible as a gap without anyone having to remember to look. ---
  type Gap = { bootHead: string | null; head: string | null; behindCount: number | null; codeBehind: boolean | null };
  const readGap = async (path: string) => ((await (await stewGet(path)).json()) as { deployGap?: Gap }).deployGap;
  const gap0 = await readGap("/api/steward/sessions");
  check("deploy-gap: a just-booted server is level with its repo (behind 0, no code behind)",
    !!gap0 && /^[0-9a-f]{40}$/.test(gap0.bootHead ?? "") && gap0.head === gap0.bootHead
      && gap0.behindCount === 0 && gap0.codeBehind === false, JSON.stringify(gap0));
  writeFileSync(`${ctx.gapRepo}/HANDOFF.md`, "docs-only change\n");
  gapGit("add", "-A");
  gapGit("commit", "-qm", "docs: handoff");
  const gap1 = await readGap("/api/steward/sessions");
  check("deploy-gap: a docs-only commit after boot counts as behind but NOT code-behind",
    gap1?.behindCount === 1 && gap1.codeBehind === false && gap1.head !== gap1.bootHead,
    JSON.stringify(gap1));
  writeFileSync(`${ctx.gapRepo}/server.ts`, "// changed after the server booted\n");
  gapGit("add", "-A");
  gapGit("commit", "-qm", "feat: touch server.ts");
  const gap2 = await readGap("/api/steward/sessions");
  check("deploy-gap: a commit touching code flips codeBehind (bootHead stays pinned to boot)",
    gap2?.behindCount === 2 && gap2.codeBehind === true && gap2.bootHead === gap0?.bootHead,
    JSON.stringify(gap2));
  // --- context-size proxy (docs/steward-pulse-v2.md phase B): how full is a session? The
  //     deterministic stand-in is its transcript JSONL's size. Slot 2 carries the uuid planted
  //     through the state file at the restart above plus a transcript of a known size; the fresh
  //     steward lane is UNPINNED (FLEET_CMD=true pins nothing) and must therefore read null —
  //     the newest-by-mtime fallback is deliberately NOT used here, a flapping subject would be
  //     worse than no fact. ---
  type TFact = { bytes: number; mtime: number } | null;
  const tfSlots = ((await (await stewGet("/api/steward/sessions")).json()) as
    { slots: { id: number; cwd: string | null; transcriptFact: TFact }[] }).slots;
  const tfPinned = tfSlots.find((s) => s.id === 2)?.transcriptFact;
  check("transcript fact: a pinned slot reports its transcript's exact bytes + a plausible mtime",
    tfPinned?.bytes === ctx.plantedTranscriptBytes && typeof tfPinned?.mtime === "number"
      && Math.abs(Date.now() - tfPinned.mtime) < 10 * 60_000, JSON.stringify(tfPinned));
  const tfUnpinned = tfSlots.find((s) => s.id === lnStew.slot)?.transcriptFact;
  check("transcript fact: an UNPINNED active slot is null (no mtime-fallback guess), never a 0",
    tfUnpinned === null, JSON.stringify(tfUnpinned));
  check("transcript fact: an empty slot is null and the field is present on every slot",
    tfSlots.every((s) => "transcriptFact" in s) && tfSlots.filter((s) => !s.cwd).every((s) => s.transcriptFact === null),
    JSON.stringify(tfSlots.map((s) => [s.id, s.transcriptFact?.bytes ?? null])));
  if (ctx.plantedTranscript) (await import("node:fs")).rmSync(ctx.plantedTranscript, { force: true });

  // --- bundle-staleness fact: deployGap's twin. public/*.js are gitignored BUILD artifacts, so
  //     landed client code stays invisible in the UI until `bun run build` runs (it cost an hour
  //     on 2026-07-25). Exercised against ctx.gapRepo (FLEET_REPO_DIR), which starts with neither a
  //     public/ nor a src/ — i.e. in the cannot-tell state. ---
  type Bundle = { appJsMtime: number | null; shareJsMtime: number | null; srcNewestMtime: number | null; stale: boolean | null };
  const readBundle = async (path: string) =>
    ((await (await stewGet(path)).json()) as { bundleStale?: Bundle }).bundleStale;
  const bSet = (rel: string, secs: number) => utimesSync(`${ctx.gapRepo}/${rel}`, secs, secs);
  const T = Math.floor(Date.now() / 1000);
  const bs0 = await readBundle("/api/steward/sessions");
  check("bundle-staleness: no bundle and no src/ reads as cannot-tell (all null, never 'fresh')",
    bs0?.appJsMtime === null && bs0.shareJsMtime === null && bs0.srcNewestMtime === null
      && bs0.stale === null, JSON.stringify(bs0));
  mkdirSync(`${ctx.gapRepo}/public`, { recursive: true });
  mkdirSync(`${ctx.gapRepo}/src`, { recursive: true });
  writeFileSync(`${ctx.gapRepo}/src/client.ts`, "// source\n");
  writeFileSync(`${ctx.gapRepo}/public/app.js`, "// bundle\n");
  writeFileSync(`${ctx.gapRepo}/public/share.js`, "// bundle\n");
  bSet("src/client.ts", T - 100);
  bSet("public/app.js", T - 50);
  bSet("public/share.js", T - 50);
  const bs1 = await readBundle("/api/steward/sessions");
  check("bundle-staleness: bundles built AFTER the newest source read fresh (stale=false)",
    bs1?.stale === false && bs1.appJsMtime === (T - 50) * 1000 && bs1.shareJsMtime === (T - 50) * 1000
      && bs1.srcNewestMtime === (T - 100) * 1000, JSON.stringify(bs1));
  // a NESTED source file flips it — the walk is recursive, so a change in src/<subdir>/ cannot
  // hide behind an untouched top level (the whole point: a false 'fresh' costs another blind hour)
  mkdirSync(`${ctx.gapRepo}/src/sub`, { recursive: true });
  writeFileSync(`${ctx.gapRepo}/src/sub/deep.ts`, "// landed after the last build\n");
  bSet("src/sub/deep.ts", T - 10);
  const bs2 = await readBundle("/api/steward/sessions");
  check("bundle-staleness: a nested src file newer than the bundles flips stale to true",
    bs2?.stale === true && bs2.srcNewestMtime === (T - 10) * 1000, JSON.stringify(bs2));
  // the unknown direction, as with deploy-gap: a MISSING bundle must go null, not report the
  // one bundle it can see and call the answer complete
  rmSync(`${ctx.gapRepo}/public/app.js`, { force: true });
  const bs3 = await readBundle("/api/steward/sessions");
  check("bundle-staleness: an absent bundle yields nulls, never a verdict from the other bundle",
    bs3?.appJsMtime === null && bs3.stale === null && bs3.shareJsMtime === (T - 50) * 1000
      && bs3.srcNewestMtime === (T - 10) * 1000, JSON.stringify(bs3));
  writeFileSync(`${ctx.gapRepo}/public/app.js`, "// bundle\n");
  bSet("public/app.js", T - 50); // leave it STALE for the digest-mirror check below

  const stewBriefRes = await stewGet(`/api/steward/slots/${lnStew.slot}/brief`);
  check("steward token reads a lane's brief", stewBriefRes.ok, String(stewBriefRes.status));
  const stewTrRes = await stewGet(`/api/steward/slots/${lnStew.slot}/transcript`);
  check("steward token reads a lane's transcript", stewTrRes.ok, String(stewTrRes.status));

  // --- transcript REDACTION value-assertions (server.ts steward transcript route): the steward
  // is a fleet-wide reader, so its transcript view must strip claude's private thinking blocks
  // and clamp long tool_result payloads to 400 chars — a `.ok` check alone (above) passes even
  // if both guards are deleted. Plant a transcript with a KNOWN thinking block + an oversize
  // tool_result into the lane cwd's claude project dir, then read it back through the route.
  // The project dir slug matches server.ts's projDir(); the cwd is a unique throwaway worktree
  // path, so this file cannot collide with any real project and is removed right after. ---
  {
    const projDir = `${process.env.HOME}/.claude/projects/${lnStew.cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
    const THINK_MARKER = "THINKING_SECRET_MUST_BE_REDACTED_zzq";
    const VISIBLE_MARKER = "visible-assistant-answer-marker";
    // tool_result: head marker within the first 400 chars (kept), tail marker past 400 (trimmed off)
    const toolContent = `TOOLHEAD_${"x".repeat(500)}_TOOLTAIL_MARKER_MUST_BE_TRIMMED_${"z".repeat(200)}`;
    const jsonl =
      JSON.stringify({ type: "assistant", timestamp: "2026-01-01T00:00:00Z",
        message: { content: [{ type: "thinking", thinking: THINK_MARKER }, { type: "text", text: VISIBLE_MARKER }] } }) + "\n" +
      JSON.stringify({ type: "user", timestamp: "2026-01-01T00:00:01Z",
        message: { content: [{ type: "tool_result", content: toolContent }] } }) + "\n";
    await Bun.write(`${projDir}/planted-redaction.jsonl`, jsonl);
    try {
      const redRes = await stewGet(`/api/steward/slots/${lnStew.slot}/transcript`);
      const redJ = (await redRes.json()) as { entries: { role: string; blocks: { t: string; text: string }[] }[] };
      const raw = JSON.stringify(redJ);
      const allBlocks = redJ.entries.flatMap((e) => e.blocks);
      // positive control: the planted entries actually flowed through (else the redaction asserts are vacuous)
      check("redaction: planted transcript is served (positive control)",
        redRes.ok && allBlocks.some((b) => b.t === "text" && b.text.includes(VISIBLE_MARKER)), raw.slice(0, 200));
      // guard 1 — thinking stripped: no thinking block, and the secret text appears nowhere
      check("steward transcript strips claude's thinking blocks (no t:thinking, secret text absent)",
        !allBlocks.some((b) => b.t === "thinking") && !raw.includes(THINK_MARKER), raw.slice(0, 200));
      // guard 2 — tool_result clamped: the block is trimmed to ≤ ~420 chars; the >400 tail marker is gone
      const toolBlock = allBlocks.find((b) => b.t === "tool_result");
      check("steward transcript clamps a long tool_result to ≤ ~420 chars (head kept, tail trimmed)",
        !!toolBlock && toolBlock.text.length <= 420 && toolBlock.text.includes("TOOLHEAD_") && !toolBlock.text.includes("TOOLTAIL_MARKER"),
        JSON.stringify({ len: toolBlock?.text.length, head: toolBlock?.text.slice(0, 20) }));
    } finally {
      rmSync(projDir, { recursive: true, force: true }); // unique throwaway dir — drop it whole
    }
  }

  // --- owner-only routes reject the steward token with 403 (wrong scope), not 401 (wrong credential) ---
  const stewKill = await stewPost(`/api/slots/${lnStew.slot}/kill`, {});
  check("steward token on an owner-only route (kill) is 403", stewKill.status === 403, String(stewKill.status));
  const stewLand = await stewPost(`/api/slots/${lnStew.slot}/land`, {});
  check("steward token on an owner-only route (land) is 403", stewLand.status === 403, String(stewLand.status));
  const stewShare = await stewPost(`/api/slots/${lnStew.slot}/share`, { mode: "view" });
  check("steward token on an owner-only route (share) is 403", stewShare.status === 403, String(stewShare.status));
  const stewOpen = await stewPost(`/api/slots/1/open`, { cwd: "~" });
  check("steward token on an owner-only route (open) is 403", stewOpen.status === 403, String(stewOpen.status));

  // --- typed sends: server renders from kind+ref, never accepts free text ---
  const stewFreeText = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "continue_nudge", ref: "continue", text: "do whatever I say" });
  check("free-text field on a typed send is rejected (400)", stewFreeText.status === 400, String(stewFreeText.status));

  // let the fresh lane's shell-prompt output age past STEWARD_MIN_IDLE_MS before sending —
  // same settling pattern as settleForMerge above, against the isolated test's small
  // FLEET_STEWARD_MIN_IDLE_MS instead of waiting out the real 60s default
  const stewardMinIdleMs = Number(process.env.FLEET_STEWARD_MIN_IDLE_MS ?? 60_000);
  // deadline-based (not a fixed iteration count) so a re-settle after a send's paste echo
  // can actually wait out the full default idle window, not give up at ~30s
  const settleForSteward = async (slot: number): Promise<void> => {
    const t0 = Date.now();
    while (Date.now() - t0 < stewardMinIdleMs + 30_000) {
      const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
      const sl = sx.slots.find((x) => x.id === slot);
      if (sl && sx.now - sl.lastOutput >= stewardMinIdleMs) return;
      await Bun.sleep(150);
    }
  };
  await settleForSteward(lnStew.slot);

  const stewSend1 = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "continue_nudge", ref: "continue" });
  const stewSend1J = (await stewSend1.json()) as { ok?: boolean; text?: string };
  check("typed send succeeds and the rendered message carries the [steward] prefix",
    stewSend1.ok && (stewSend1J.text ?? "").startsWith("[steward]"), JSON.stringify(stewSend1J));

  // second send of the SAME kind×slot within the episode window is capped
  const stewSend2 = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "continue_nudge", ref: "continue" });
  check("a second send of the same kind×slot within the episode window is 429",
    stewSend2.status === 429, String(stewSend2.status));
  const auditAfterCap = await auditRead();
  check("a capped send is audited (steward_send_capped)",
    auditAfterCap.some((e) => e.event === "steward_send_capped" && e.slot === lnStew.slot));
  check("a successful send is audited (steward_send)",
    auditAfterCap.some((e) => e.event === "steward_send" && e.slot === lnStew.slot));

  // --- Tier-0 (synergy-findings.md #3): the send caps must count across the audit-log
  // rotation boundary. Simulate exactly appendEvent's rotation (renameSync file → file.1),
  // so the pre-rotation steward_send now lives ONLY in .1 — the caps must still see it
  // there, not reset toward zero because the live file is fresh/absent. ---
  await Bun.sleep(300); // let the fire-and-forget audit chain flush before renaming
  renameSync(ctx.auditPath, `${ctx.auditPath}.1`);
  // stewSend1's paste echo reset the target pane's idle clock — wait it out again so the
  // attempt reaches the cap gates (canDeliver runs before them) instead of 409ing on busy
  await settleForSteward(lnStew.slot);
  const stewRotSend = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "continue_nudge", ref: "continue" });
  const stewRotSendJ = (await stewRotSend.json()) as { error?: string; ok?: boolean };
  check("episode cap survives an audit rotation — pre-rotation send still counted from .1 (429)",
    stewRotSend.status === 429 && !stewRotSendJ.ok && (stewRotSendJ.error ?? "").includes("episode"),
    `${stewRotSend.status} ${JSON.stringify(stewRotSendJ)}`);
  // hourly "should refuse" across the same boundary: top .1 up with a cap's worth (server
  // default 10) of recent steward_send lines — exactly what .1 holds right after a real
  // mid-window rotation — then a DIFFERENT kind (immune to the episode cap) must still be
  // refused by the hourly counter. The refused attempt pasted nothing, so the pane is idle.
  const preForge = await readText(`${ctx.auditPath}.1`);
  const forged = Array.from({ length: 10 }, () =>
    JSON.stringify({ ts: Date.now(), event: "steward_send", slot: lnStew.slot, detail: "state_relay:merge_resolved" })).join("\n");
  await Bun.write(`${ctx.auditPath}.1`, `${preForge}${forged}\n`);
  const stewHourlyRot = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "lifecycle_op", ref: "handoff" });
  const stewHourlyRotJ = (await stewHourlyRot.json()) as { error?: string; ok?: boolean };
  check("hourly cap survives an audit rotation — a cap's worth of pre-rotation sends still refuses (429)",
    stewHourlyRot.status === 429 && !stewHourlyRotJ.ok && (stewHourlyRotJ.error ?? "").includes("hourly"),
    `${stewHourlyRot.status} ${JSON.stringify(stewHourlyRotJ)}`);
  await Bun.write(`${ctx.auditPath}.1`, preForge); // drop the forged lines so later real sends aren't hourly-capped

  // --- Tier-0 (synergy-findings.md #1): the master stop and quiet hours now reach the steward's
  // OWN /api/steward/send, not just the scheduled-auto surface. canDeliver runs BEFORE the send
  // caps, so a paused/quiet fleet returns 409 (its own reason) rather than the 429 episode cap
  // already held above — and the distinct error string proves WHICH gate fired (not "not idle"). ---
  await post("/api/autos/switch", { on: false });
  const stewKilled = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "continue_nudge", ref: "continue" });
  const stewKilledJ = (await stewKilled.json()) as { error?: string; ok?: boolean };
  check("master stop (autosOn=false) blocks a direct steward send — no delivery (409, 'paused')",
    stewKilled.status === 409 && !stewKilledJ.ok && (stewKilledJ.error ?? "").includes("paused"),
    `${stewKilled.status} ${JSON.stringify(stewKilledJ)}`);
  await post("/api/autos/switch", { on: true });

  const stewQh = new Date().getHours();
  await post("/api/autos/quiet", { start: stewQh, end: (stewQh + 2) % 24 });
  const stewQuietBlocked = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "continue_nudge", ref: "continue" });
  const stewQuietBlockedJ = (await stewQuietBlocked.json()) as { error?: string; ok?: boolean };
  check("quiet hours now mute a direct steward send too — no delivery (409, 'quiet hours')",
    stewQuietBlocked.status === 409 && !stewQuietBlockedJ.ok && (stewQuietBlockedJ.error ?? "").includes("quiet hours"),
    `${stewQuietBlocked.status} ${JSON.stringify(stewQuietBlockedJ)}`);
  await post("/api/autos/quiet", { start: null });

  // --- scope: unknown kind, unknown ref, and slot 2 (not the steward's own slot) for autos ---
  const stewBadKind = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "not_a_kind", ref: "x" });
  check("an unknown kind is rejected (400)", stewBadKind.status === 400, String(stewBadKind.status));
  const stewBadRef = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "lifecycle_op", ref: "not_a_ref" });
  check("an unrecognized ref is rejected (400)", stewBadRef.status === 400, String(stewBadRef.status));

  const stewAutoRes = await stewPost("/api/steward/autos", { text: "steward self check-in", inSec: 3600, slot: 2 });
  const stewAutoJ = (await stewAutoRes.json()) as { ok?: boolean; auto?: { id: string; slot: number } };
  check("steward's own autos route lands on the steward's OWN slot regardless of a spoofed `slot` field",
    stewAutoRes.ok && stewAutoJ.auto?.slot === lnStew.slot, JSON.stringify(stewAutoJ));
  if (stewAutoJ.auto) await post(`/api/autos/${stewAutoJ.auto.id}/delete`, {});
  const stewPerp = await stewPost("/api/steward/autos", { text: "steward immortal", inSec: 5, everySec: 10, perpetual: true });
  check("steward cannot mint a perpetual auto (owner-only, 403)", stewPerp.status === 403, String(stewPerp.status));
  const stewSwitch = await stewPost("/api/autos/switch", { on: false });
  check("steward cannot flip the global automation kill-switch (out of scope, 403)", stewSwitch.status === 403, String(stewSwitch.status));
  const stewQuiet = await stewPost("/api/autos/quiet", { start: 0, end: 6 });
  check("steward cannot set quiet hours (owner-only, 403)", stewQuiet.status === 403, String(stewQuiet.status));

  // --- an unknown steward token is unauthorized like any other unrecognized credential ---
  const wrongStew = await fetch(BASE + "/api/steward/sessions", { headers: { authorization: "Bearer " + "0".repeat(32) } });
  check("an unknown steward-shaped token is 401 (falls through to the owner gate)", wrongStew.status === 401, String(wrongStew.status));

  // --- self-token regression: the pre-existing self-autos route is untouched by the steward lane ---
  const stewSelfTok = (await paneEnv(`s${lnStew.slot}`, "FLEET_SELF_TOKEN")) ?? "";
  const selfRegRes = await fetch(BASE + "/api/self/autos", {
    method: "POST",
    headers: { "content-type": "application/json", "x-fleet-self-token": stewSelfTok },
    body: JSON.stringify({ text: "self regression after steward lane build", inSec: 3600 }),
  });
  const selfRegJ = (await selfRegRes.json()) as { ok?: boolean; auto?: { id: string; slot: number } };
  check("self-autos route still works unchanged for a lane that also happens to be labeled steward",
    selfRegRes.ok && selfRegJ.auto?.slot === lnStew.slot, JSON.stringify(selfRegJ));
  if (selfRegJ.auto) await post(`/api/autos/${selfRegJ.auto.id}/delete`, {});

  // --- FLEET_STEWARD_TOKEN is baked into the ⚙ steward pane's spawn env (bake-at-spawn, keyed
  // on the steward label) so the Rundgang can self-serve /api/steward/* without the owner token.
  // Env is only injectable at spawn: the lane above was spawned label-less then relabeled, so
  // the token appears only after the pane (re)spawns WITH the label set — identical semantics to
  // FLEET_SELF_TOKEN. Force a self-heal respawn to observe it. ---
  await tmuxOut("kill-session", "-t", `s${lnStew.slot}`);
  for (let i = 0; i < 80; i++) {
    if ((await tmuxOut("has-session", "-t", `s${lnStew.slot}`)).code === 0) break;
    await Bun.sleep(100);
  }
  // paneEnv retries the send-keys until the marked line renders, so no fixed sleep has to
  // guess how long the just-respawned shell needs before it will accept input
  const bakedStewTok = (await paneEnv(`s${lnStew.slot}`, "FLEET_STEWARD_TOKEN")) ?? "";
  check("FLEET_STEWARD_TOKEN is baked into a steward-labeled pane's spawn env and equals the steward token",
    bakedStewTok === STEW && STEW.length === 32, `baked=[${bakedStewTok}] steward=[${STEW}]`);

  // a non-steward slot never carries the steward token
  const plainStewTok = await paneEnv("s2", "FLEET_STEWARD_TOKEN");
  check("FLEET_STEWARD_TOKEN absent for a non-steward slot", plainStewTok === "", `[${plainStewTok}]`);

  // --- steward journal: the typed durable pulse ledger (POST/GET /api/steward/journal), the
  // delta anchor that survives /clear. The route acks without awaiting the append chain, so
  // settle briefly before each read. ---
  const jPost1 = await stewPost("/api/steward/journal", { counts: { "healthy-running": 3, "stalled-dirty": 1 }, decisions_surfaced: 1, changed: true });
  const jPost1J = (await jPost1.json()) as { ok?: boolean; ts?: number };
  check("steward journal accepts a typed record", jPost1.ok && jPost1J.ok === true && typeof jPost1J.ts === "number", JSON.stringify(jPost1J));
  await Bun.sleep(200);
  const jGet1J = (await (await stewGet("/api/steward/journal?tail=1")).json()) as { records: { kind?: string; counts?: Record<string, number>; decisions_surfaced?: number; changed?: boolean; ts?: number }[] };
  const r1 = jGet1J.records?.[0];
  check("steward journal returns the record it stored, server-stamped",
    r1?.kind === "rundgang" && r1?.counts?.["stalled-dirty"] === 1 && r1?.decisions_surfaced === 1 && r1?.changed === true && typeof r1?.ts === "number",
    JSON.stringify(jGet1J).slice(0, 200));

  // typed choke-point: malformed bodies are rejected, no free-text leaks into the ledger
  check("steward journal rejects non-object counts (400)", (await stewPost("/api/steward/journal", { counts: "all clear", decisions_surfaced: 0, changed: false })).status === 400);
  check("steward journal rejects non-number count values (400)", (await stewPost("/api/steward/journal", { counts: { x: "many" }, decisions_surfaced: 0, changed: false })).status === 400);
  check("steward journal rejects a missing changed flag (400)", (await stewPost("/api/steward/journal", { counts: { x: 1 }, decisions_surfaced: 0 })).status === 400);

  // owner token is out of scope for the steward journal, same 404 as the other steward routes
  check("owner token on the steward journal route is out of scope (404)", (await get("/api/steward/journal?tail=1")).status === 404);

  // --- commit-cursor fact layer (step 2): every rundgang record carries a SERVER-stamped
  // per-lane map {head, base, landed, repo} keyed by branch, plus the primary checkout keyed
  // by ITS branch. The map is computed server-side at write time; a body-supplied `lanes` key
  // is ignored like every other unvalidated field (never-spread). ---
  const laneGit = (dir: string, ...a: string[]) => Bun.spawnSync(["git", "-C", dir, ...a]).stdout.toString().trim();
  const lnStewBranch = ((await (await get("/api/sessions")).json()) as { slots: { id: number; worktree: { branch: string } | null }[] })
    .slots.find((x) => x.id === lnStew.slot)?.worktree?.branch ?? "";
  const jInject = await stewPost("/api/steward/journal", { counts: { "healthy-running": 1 }, decisions_surfaced: 0, changed: false,
    lanes: { evil: { head: "deadbeef", landed: true } } });
  check("journal POST carrying a body-supplied lanes key is still accepted", jInject.ok, String(jInject.status));
  await Bun.sleep(200);
  type LaneRec = { kind?: string; lanes?: Record<string, { head?: string | null; base?: string | null; landed?: boolean; repo?: string }> };
  const jLanesRec = ((await (await stewGet("/api/steward/journal?tail=1")).json()) as { records: LaneRec[] }).records?.[0];
  check("rundgang record carries the SERVER-stamped lane map with the lane's real HEAD sha",
    jLanesRec?.lanes?.[lnStewBranch]?.head === laneGit(lnStew.cwd, "rev-parse", "HEAD")
    && typeof jLanesRec?.lanes?.[lnStewBranch]?.base === "string"
    // realpath-insensitive (macOS /var → /private/var): compare the repo by its basename path
    && (jLanesRec?.lanes?.[lnStewBranch]?.repo ?? "").endsWith("/testrepo"),
    JSON.stringify(jLanesRec?.lanes ?? {}).slice(0, 300));
  check("body-supplied lanes are IGNORED (no injected branch in the stored map)",
    !!jLanesRec?.lanes && !("evil" in jLanesRec.lanes), JSON.stringify(jLanesRec?.lanes ?? {}).slice(0, 200));
  const primaryBranch = laneGit(REPO, "rev-parse", "--abbrev-ref", "HEAD");
  check("lane map includes the primary checkout keyed by its branch (owner-side lands observable)",
    jLanesRec?.lanes?.[primaryBranch]?.head === laneGit(REPO, "rev-parse", "HEAD"),
    JSON.stringify({ primaryBranch, entry: jLanesRec?.lanes?.[primaryBranch] }));

  // --- 🧭 steward digest (P3 demand-triggered bounded-wait): prior/slots are computed FRESH
  // every call; only the `digest` field is cached {digest, computedAt}. A GET triggers the
  // worker only on a stale cache, races it against a caller-chosen ?wait (default ~30s, clamped
  // ≤60s), and returns fresh-if-ready else the last snapshot (or null on cold cache) + digestAt/
  // digestAge. The slow FLEET_DIGEST_CMD stand-in sleeps $DIR/digestdelay s to bound the race. ---
  const setDigestDelay = (s: number) => Bun.write(`${REPO.replace(/\/[^/]+$/, "")}/digestdelay`, String(s));

  // (a) cold cache + ?wait=0: returns instantly with fresh prior/slots and a null digest+age,
  //     and STARTS the worker in the background (which will populate the cache).
  await setDigestDelay(3);
  const coldT = Date.now();
  const coldRes = await stewGet("/api/steward/digest?wait=0");
  const coldMs = Date.now() - coldT;
  const coldJ = (await coldRes.json()) as DigJ;
  check("steward digest ?wait=0 on a cold cache returns instantly with fresh prior/slots and a null digest",
    coldRes.ok && coldMs < 1500 && coldJ.digest === null && coldJ.digestAt === null && coldJ.digestAge === null
    && coldJ.waitMs === 0 && Array.isArray(coldJ.slots) && coldJ.slots.length > 0
    && coldJ.prior?.kind === "rundgang" && typeof coldJ.now === "number",
    JSON.stringify({ coldMs, digest: coldJ.digest, digestAt: coldJ.digestAt, slots: coldJ.slots?.length, prior: coldJ.prior?.kind }));

  // (c-i) a second GET while the worker is still in flight, ?wait < worker time → joins the same
  //       inflight (no second spawn), times out, returns the still-null snapshot bounded by wait.
  const midT = Date.now();
  const midJ = (await (await stewGet("/api/steward/digest?wait=1")).json()) as DigJ;
  const midMs = Date.now() - midT;
  check("steward digest ?wait below worker time returns the stale snapshot bounded by wait",
    midJ.digest === null && midJ.waitMs === 1000 && midMs >= 900 && midMs < 2500,
    JSON.stringify({ midMs, digest: midJ.digest, waitMs: midJ.waitMs }));

  // (b)+(c-ii) once the in-flight worker completes it writes the cache; a later GET returns the
  //   now-cached fresh digest INSTANTLY. digestAge >> the worker's 3s run proves it is the cached
  //   snapshot, not a fresh run (delay is set to 0 first so a stray miss couldn't slow this call).
  await new Promise((r) => setTimeout(r, 4500)); // 3s worker delay + spawn margin on a loaded box
  await setDigestDelay(0);
  const warmT = Date.now();
  const warmJ = (await (await stewGet("/api/steward/digest?wait=30")).json()) as DigJ;
  const warmMs = Date.now() - warmT;
  check("steward digest returns the now-cached fresh digest instantly after the worker completes",
    warmMs < 1500 && warmJ.digest?.conditions?.["1"] === "healthy-running"
    && warmJ.digest?.changed?.length === 1 && warmJ.digest?.changed?.[0] === "slot 1 committed"
    && Array.isArray(warmJ.digest?.attention) && warmJ.digest?.attention.length === 0
    && typeof warmJ.digestAt === "number" && typeof warmJ.digestAge === "number" && (warmJ.digestAge ?? 0) >= 3000,
    JSON.stringify({ warmMs, digest: warmJ.digest, digestAge: warmJ.digestAge }));
  // prior is recomputed FRESH each call, and since P-1a it is kind-FILTERED: a parked outcome
  // resolving into the journal between the two calls can no longer move the anchor, so the kind
  // is asserted exactly. now/slots must be fresh alongside the cached digest.
  check("steward digest carries the deterministic payload (fresh prior + slots) alongside the cached verdict",
    Array.isArray(warmJ.slots) && warmJ.slots.length > 0 && warmJ.prior?.kind === "rundgang" && typeof warmJ.now === "number",
    JSON.stringify({ slots: warmJ.slots?.length, prior: warmJ.prior?.kind, now: typeof warmJ.now }));
  // the deploy-gap fact rides the digest too, and like sinceLastLook it is ROUTE-computed: it
  // must be the same fact the sessions route served, not something the worker could shape.
  const gapDigest = await readGap("/api/steward/digest?wait=0");
  check("steward digest serves the same route-computed deploy-gap as the sessions route",
    gapDigest?.behindCount === 2 && gapDigest.codeBehind === true
    && gapDigest.head === gap2?.head && gapDigest.bootHead === gap0?.bootHead,
    JSON.stringify(gapDigest));
  // same for the bundle-staleness twin: route-computed, so the digest serves the identical fact
  // (the sessions section left ctx.gapRepo's bundles older than its newest source)
  const bundleDigest = await readBundle("/api/steward/digest?wait=0");
  check("steward digest serves the same route-computed bundle-staleness as the sessions route",
    bundleDigest?.stale === true && bundleDigest.appJsMtime === bs3?.shareJsMtime
      && bundleDigest.srcNewestMtime === bs3?.srcNewestMtime, JSON.stringify(bundleDigest));

  // --- the CONTINUITY fact on the digest (continuity.ts holds the derivation + its unit tests):
  // per-slot time-to-next-action over a bounded window and which surface resolved each wait.
  // Route-computed like its two neighbours above — a FACT, so it must survive a dead digest
  // worker and must not be shapeable by the model. Display rung: nothing consumes it.
  // The journal is read on both sides of the GET because an auto can log a prompt mid-call, so
  // the accounting identity is asserted as a RANGE rather than a racy equality. ---
  const plogBefore = await plogRead();
  const contJ = (await (await stewGet("/api/steward/digest?wait=0")).json()) as DigJ & { continuity?: ContinuitySummary };
  const plogAfter = await plogRead();
  const c = contJ.continuity;
  const liveCount = (rs: { ts: number; source: string }[]) =>
    rs.filter((e) => e.ts >= CONTINUITY_REGIME_START && (CONTINUITY_SOURCES as readonly string[]).includes(e.source)).length;
  const liveSlots = (rs: { ts: number; slot: number; source: string }[]) =>
    new Set(rs.filter((e) => e.ts >= CONTINUITY_REGIME_START && (CONTINUITY_SOURCES as readonly string[]).includes(e.source))
      .map((e) => e.slot)).size;
  check("steward digest serves the route-computed continuity summary (7d window, per-source + per-slot)",
    !!c && c.windowMs === CONTINUITY_WINDOW_MS && c.regimeStart === CONTINUITY_REGIME_START
    && c.from === c.now - c.windowMs && typeof c.now === "number"
    && CONTINUITY_SOURCES.every((s) => typeof c.bySource?.[s]?.n === "number")
    && Array.isArray(c.slots) && c.slots.every((s) => typeof s.slot === "number" && s.n > 0 && s.medianMs !== null),
    JSON.stringify({ windowMs: c?.windowMs, from: c?.from, now: c?.now, slots: c?.slots?.length, bySource: c?.bySource }));
  // EVERY live journal record is accounted for exactly once — measured, or named as an exclusion.
  // A record that silently disappeared would make the fleet look more continuous than it is.
  check("continuity on the digest accounts for every live journal record (measured + excluded, none dropped)",
    !!c && c.overall.n + c.excluded.total >= liveCount(plogBefore) && c.overall.n + c.excluded.total <= liveCount(plogAfter)
    && c.excluded.total === c.excluded.noPrior + c.excluded.quietHours,
    JSON.stringify({ n: c?.overall.n, excluded: c?.excluded, live: [liveCount(plogBefore), liveCount(plogAfter)] }));
  // this suite's journal is written fresh this run, so each slot's FIRST record is the one gap
  // nobody can know — one unknown per slot, excluded and counted, never a 0ms response
  check("continuity on the digest excludes each slot's first record as unknown, never as a zero gap",
    !!c && c.excluded.noPrior >= liveSlots(plogBefore) && c.excluded.noPrior <= liveSlots(plogAfter)
    && c.outOfScope.preRegime === 0 && c.outOfScope.nonLiveSource === 0 && c.outOfScope.malformed === 0,
    JSON.stringify({ noPrior: c?.excluded.noPrior, slots: [liveSlots(plogBefore), liveSlots(plogAfter)], outOfScope: c?.outOfScope }));
  // the unknown direction is the load-bearing one: with the repo unreadable the counts must go
  // NULL ("cannot tell"), never fall back to 0/false, which would read as "deployed"
  rmSync(`${ctx.gapRepo}/.git`, { recursive: true, force: true });
  const gapUnknown = await readGap("/api/steward/sessions");
  check("deploy-gap: an unreadable repo yields nulls, never a false 'deployed'",
    gapUnknown?.behindCount === null && gapUnknown.codeBehind === null && gapUnknown.head === null
    && gapUnknown.bootHead === gap0?.bootHead, JSON.stringify(gapUnknown));
  rmSync(ctx.gapRepo, { recursive: true, force: true });

  // (c2) anti-drift (docs/perception-layer.md §3): the worker is handed the done-looking rule in
  // prose, and auto-③ fires on a deterministic predicate. The prompt line is COMPOSED from the
  // same clause list the predicate iterates, so the specification cannot drift away from the
  // implementation without this failing — asserted against the prompt the worker actually got.
  const digestPrompt = await Bun.file(`${REPO.replace(/\/[^/]+$/, "")}/digestprompt`).text();
  check("the digest worker's done-looking rule is the predicate's own clause list, verbatim",
    digestPrompt.includes(DONE_LOOKING_PROSE),
    JSON.stringify(digestPrompt.split("\n").find((l) => l.includes("done-looking")) ?? ""));

  // (d) ?wait is clamped to [0, 60s] — observable via the echoed waitMs (cache is fresh, so these
  //     return instantly): an over-max value is capped to 60s, a non-numeric falls back to ~30s.
  const clampJ = (await (await stewGet("/api/steward/digest?wait=9999")).json()) as DigJ;
  check("steward digest clamps an over-max ?wait to 60s", clampJ.waitMs === 60000, JSON.stringify({ waitMs: clampJ.waitMs }));
  const defJ = (await (await stewGet("/api/steward/digest?wait=notanumber")).json()) as DigJ;
  check("steward digest falls back to the ~30s default on a non-numeric ?wait", defJ.waitMs === 30000, JSON.stringify({ waitMs: defJ.waitMs }));

  check("owner token on the steward digest route is out of scope (404)", (await get("/api/steward/digest")).status === 404);
  // no steward slot → 404 (rename the steward slot away, probe, restore)
  await post(`/api/slots/${lnStew.slot}/rename`, { label: "not-steward" });
  check("steward digest without a steward slot is 404", (await stewGet("/api/steward/digest")).status === 404);
  await post(`/api/slots/${lnStew.slot}/rename`, { label: "⚙ steward" });

  // --- commit-cursor fact layer (step 3): the digest serves sinceLastLook — the deterministic
  // per-lane delta vs the prior rundgang record's stamped map. Route-computed with ?wait=0, so
  // it never depends on the digest worker/cache being alive. ---
  type SLL = { new: string[]; advanced: { branch: string; commits: number; shortstat: string }[];
    landed: string[]; vanishedUnlanded: string[]; rewritten: { branch: string }[] } | null;
  const getSLL = async (): Promise<SLL> =>
    ((await (await stewGet("/api/steward/digest?wait=0")).json()) as DigJ & { sinceLastLook?: SLL }).sinceLastLook ?? null;
  // anchor a fresh prior (stamps the lane at its current HEAD), then commit → advanced
  await stewPost("/api/steward/journal", { counts: { "healthy-running": 1 }, decisions_surfaced: 0, changed: false });
  await Bun.sleep(300);
  writeFileSync(`${lnStew.cwd}/cursor-probe.txt`, "commit-cursor probe\n");
  laneGit(lnStew.cwd, "add", "cursor-probe.txt");
  laneGit(lnStew.cwd, "commit", "-qm", "cursor probe");
  const sllAdv = await getSLL();
  check("sinceLastLook.advanced names the committed lane with commit count 1 + a real shortstat",
    sllAdv?.advanced.some((a) => a.branch === lnStewBranch && a.commits === 1 && a.shortstat.includes("1 file")) === true,
    JSON.stringify(sllAdv).slice(0, 300));
  // a prior record WITHOUT lanes (pre-feature) → sinceLastLook null, never a fake-empty diff
  writeFileSync("steward-journal.jsonl",
    `${JSON.stringify({ ts: Date.now(), kind: "rundgang", counts: {}, decisions_surfaced: 0, changed: false })}\n`, { flag: "a" });
  check("a prior record without lanes yields sinceLastLook null (honest, not fake-empty)", (await getSLL()) === null);
  // fresh prior with the commit stamped; then land the branch owner-side + open a new lane
  await stewPost("/api/steward/journal", { counts: { "healthy-running": 1 }, decisions_surfaced: 0, changed: false });
  await Bun.sleep(300);
  const lv = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  const lvBranch = ((await (await get("/api/sessions")).json()) as { slots: { id: number; worktree: { branch: string } | null }[] })
    .slots.find((x) => x.id === lv.slot)?.worktree?.branch ?? "";
  writeFileSync(`${lv.cwd}/vanish.txt`, "unlanded work\n");
  laneGit(lv.cwd, "add", "vanish.txt");
  laneGit(lv.cwd, "commit", "-qm", "vanish work");
  laneGit(REPO, "merge", "-q", lnStewBranch); // owner-side land of the lane's commits into the integration branch
  const sllLand = await getSLL();
  check("sinceLastLook.landed reports a branch merged into the integration branch since the prior record",
    sllLand?.landed.includes(lnStewBranch) === true, JSON.stringify(sllLand).slice(0, 300));
  check("sinceLastLook.new reports a lane opened since the prior record",
    sllLand?.new.includes(lvBranch) === true, JSON.stringify({ lvBranch, new: sllLand?.new }));
  // stamp a prior that includes the unlanded lane, then tear its slot down WITHOUT merging →
  // vanishedUnlanded (the "sessions vanished" insurance); amend the landed lane's head →
  // rewritten (prior head no longer an ancestor), flagged honestly with no fake delta
  await stewPost("/api/steward/journal", { counts: { "healthy-running": 1 }, decisions_surfaced: 0, changed: false });
  await Bun.sleep(300);
  await post(`/api/slots/${lv.slot}/kill`, {});
  laneGit(lnStew.cwd, "commit", "--amend", "-qm", "cursor probe rewritten");
  const sllGone = await getSLL();
  check("sinceLastLook.vanishedUnlanded flags a gone, unmerged lane (the vanished-sessions insurance)",
    sllGone?.vanishedUnlanded.includes(lvBranch) === true, JSON.stringify(sllGone).slice(0, 300));
  check("sinceLastLook.rewritten flags an amended (rebased) lane honestly instead of faking a delta",
    sllGone?.rewritten.some((r) => r.branch === lnStewBranch) === true, JSON.stringify(sllGone?.rewritten));

  return { token: STEW, stewGet, stewPost, slot: lnStew.slot, cwd: lnStew.cwd, settleForSteward };
}
