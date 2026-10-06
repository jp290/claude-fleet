import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { composerArrival, composerBuffer, composerCollapsedPaste, composerDeliveryResidue,
  composerHoldsExactly, composerRows } from "../composer";
import { fleetEventFrom, type StuckDeliveryFact, type StuckDeliveryFleetEvent } from "../server/types";
import { BASE, H, ROOT, check, get, post, restartSrv, tmuxOut, until } from "./harness";

// t (after Enter) | event                    | exclusive owner
// 0              | hide in late mode        | raw Claude-shaped stand-in
// 800 ms         | acceptance window ends   | server (suite's existing setting)
// 1200 ms        | repaint the held paste   | stand-in
// receipt+1000ms | first sensor read        | server
// receipt+3000ms | sensor deadline          | server
const fixture = String.raw`
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <termios.h>
#include <poll.h>
#include <sys/time.h>
static char buf[32768], mode[64];
static size_t len, paste_start;
static int enters, backspaces, keys, pasted, pasting;
static long long hidden_until;
static const char *mode_file, *state_file;
static long long now_ms(void) {
  struct timeval t; gettimeofday(&t, NULL);
  return (long long)t.tv_sec * 1000 + t.tv_usec / 1000;
}
static void save(void) {
  FILE *f = fopen(state_file, "w");
  if (!f) return;
  fprintf(f, "enters=%d backspaces=%d keys=%d\n", enters, backspaces, keys);
  fwrite(buf, 1, len, f); fclose(f);
}
static void paint(void) {
  fputs("\033[2J\033[H", stdout);
  if (hidden_until > now_ms()) { fputs("redrawing\r\n", stdout); fflush(stdout); return; }
  hidden_until = 0;
  fputs("────────────────────────────────────────\r\n❯ ", stdout);
  if (!len) {
    fputs("\033[2mTry a prompt\033[0m", stdout);
  } else if (pasted && (!strcmp(mode, "collapsed") || !strcmp(mode, "late"))) {
    fwrite(buf, 1, paste_start, stdout);
    fputs("[Pasted text #1 +79 lines]", stdout);
  } else {
    for (size_t i = 0; i < len; i++) {
      if (buf[i] == '\n') fputs("\r\n  ", stdout); else putchar(buf[i]);
    }
  }
  fputs("\r\n────────────────────────────────────────\r\n", stdout); fflush(stdout);
}
int main(int argc, char **argv) {
  if (argc < 3) return 2;
  mode_file = argv[1]; state_file = argv[2];
  FILE *f = fopen(mode_file, "r");
  if (!f || !fgets(mode, sizeof mode, f)) return 3;
  fclose(f); mode[strcspn(mode, "\r\n")] = 0;
  struct termios t;
  if (tcgetattr(0, &t)) return 4;
  cfmakeraw(&t); tcsetattr(0, TCSANOW, &t);
  fputs("\033[?2004h", stdout); save(); paint();
  struct pollfd p = { .fd = 0, .events = POLLIN };
  for (;;) {
    if (poll(&p, 1, hidden_until ? 20 : -1) == 0) {
      if (hidden_until && now_ms() >= hidden_until) paint();
      continue;
    }
    unsigned char c;
    if (read(0, &c, 1) != 1) break;
    keys++;
    if (c == 27) {
      char seq[32]; size_t n = 0;
      while (n < sizeof seq - 1 && read(0, &c, 1) == 1) {
        seq[n++] = c; if (c == '~' || (n > 1 && c >= 'A' && c <= 'Z')) break;
      }
      seq[n] = 0;
      if (!strcmp(seq, "[200~")) { pasting = 1; paste_start = len; }
      if (!strcmp(seq, "[201~")) { pasting = 0; pasted = 1; save(); paint(); }
      else save();
      continue;
    }
    if (!pasting && (c == '\r' || c == '\n')) {
      enters++;
      if (!strcmp(mode, "normal")) { len = 0; pasted = 0; }
      if (!strcmp(mode, "foreign") && len + 6 < sizeof buf) { memcpy(buf + len, " owner", 6); len += 6; }
      if (!strcmp(mode, "late")) hidden_until = now_ms() + 1200;
      save(); paint();
    } else if (!pasting && (c == 127 || c == 8)) {
      backspaces++; if (len) len--; save(); paint();
    } else if (len < sizeof buf - 1) {
      buf[len++] = c;
      if (!pasting) { save(); paint(); }
    }
  }
  return 0;
}
`;

interface Row { id: number; cwd: string | null; openedAt: number; agent: string | null; stuckDelivery?: StuckDeliveryFact }
const sessions = async (): Promise<Row[]> =>
  ((await (await get("/api/sessions")).json()) as { slots: Row[] }).slots;
const tokenOf = (slot: number): string => {
  const state = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
    { slots: Record<string, { selfToken: string }> };
  return state.slots[String(slot)]?.selfToken ?? "";
};
const events = async (token: string): Promise<StuckDeliveryFleetEvent[]> => {
  const r = await fetch(BASE + "/api/self", { headers: { "x-fleet-self-token": token } });
  const body = await r.json() as { events?: StuckDeliveryFleetEvent[]; error?: string };
  if (!r.ok || !Array.isArray(body.events))
    throw new Error(`stuck-delivery Self events read: HTTP ${r.status}, ${body.error ?? "missing events"}`);
  return body.events.filter((e) => e.kind === "delivery-stuck");
};

export async function run(): Promise<void> {
  const form = { kind: "glyph" as const, re: /^❯/ };
  const header = "[fleet-zustellung · Messung · path=owner · Slot 1] ";
  const label = "[Pasted text #1 +79 lines]";
  const payload = header + Array.from({ length: 80 }, (_, i) => `Messzeile ${i}`).join("\n");
  const frame = `\x1b[39m❯\u00a0${header}${label}\n${"─".repeat(40)}\n`;
  const rows = composerRows(form, frame) ?? [];
  const collapsed = composerCollapsedPaste(rows, header);
  check("stuck-delivery measured Claude 2.1.291: collapsed paste is visible, differs and never exact payload",
    composerBuffer(form, frame) === header + label && composerArrival(rows, payload) === "differs"
      && !composerHoldsExactly(rows, payload));
  check("stuck-delivery collapsed paste counts only with the previously read header and label",
    collapsed === header + label && composerDeliveryResidue(rows, payload, collapsed)?.kind === "collapsed-paste"
      && composerDeliveryResidue(rows, payload, null) === null);
  const wrappedLabel = composerRows(form,
    `❯ ${header}[Pasted text #1 +79\n  lines]\n${"─".repeat(40)}\n`) ?? [];
  check("stuck-delivery collapsed label survives one omitted space at a visual row boundary",
    composerCollapsedPaste(wrappedLabel, header) === header + label
      && composerDeliveryResidue(wrappedLabel, payload, collapsed)?.kind === "collapsed-paste");
  for (const foreign of [header + label + " owner", "owner " + header + label, header + "[Pasted text #2 +79 lines]",
    header + "[Pasted text #1 +79lines]"])
    check("stuck-delivery foreign composer is not the measured paste: " + foreign.slice(-32),
      composerDeliveryResidue([foreign], payload, collapsed) === null
        && composerCollapsedPaste([foreign], header) !== header + label);
  check("stuck-delivery dim hint is empty and never a delivery remainder",
    composerDeliveryResidue(composerRows(form, "❯ \x1b[2mTry a prompt\x1b[0m\n") ?? [], payload, collapsed) === null);

  const dir = mkdtempSync(`${ROOT}/stuck-delivery-`);
  const modeFile = `${dir}/mode`, stateFile = `${dir}/state`;
  writeFileSync(`${dir}/fixture.c`, fixture);
  const cc = spawnSync("cc", ["-O2", "-o", `${dir}/claude`, `${dir}/fixture.c`], { encoding: "utf8" });
  check("stuck-delivery SETUP: isolated raw-mode Claude-shaped fixture compiles", cc.status === 0, cc.stderr);
  if (cc.status !== 0) { rmSync(dir, { recursive: true, force: true }); return; }
  const owned: number[] = [];
  try {
    writeFileSync(modeFile, "normal\n");
    await restartSrv({ FLEET_CMD: `claude '${modeFile}' '${stateFile}'`,
      PATH: `${dir}:${process.env.PATH ?? "/usr/bin:/bin"}` });
    const vacant = (await sessions()).filter((s) => !s.cwd).map((s) => s.id);
    check("stuck-delivery SETUP: two vacant slots", vacant.length >= 2);
    if (vacant.length < 2) return;
    const sender = vacant[0]!;
    const senderOpen = await post(`/api/slots/${sender}/open`, { cwd: ROOT });
    if (!senderOpen.ok) throw new Error(`sender open ${senderOpen.status}`);
    owned.push(sender);
    const senderToken = tokenOf(sender);
    check("stuck-delivery SETUP: sender Self principal is bound", senderToken.length > 0);
    const requestHeaders = { ...H, "x-fleet-self-token": senderToken };
    const target = vacant[1]!;
    for (const mode of ["hold", "collapsed", "late", "normal", "foreign", "owner-only", "replaced"]) {
      writeFileSync(modeFile, `${mode === "owner-only" || mode === "replaced" ? "hold" : mode}\n`);
      const open = await post(`/api/slots/${target}/open`, { cwd: ROOT });
      if (!open.ok) throw new Error(`target open ${open.status}`);
      owned.push(target);
      await until(async () => (await sessions()).find((s) => s.id === target)?.agent === "alive",
        { timeoutMs: 12000, what: `${mode}: target raw agent alive` });
      const ready = await until(async () => {
        const frame = await tmuxOut("capture-pane", "-p", "-e", "-t", `s${target}`);
        return composerRows(form, frame.out) !== null && composerBuffer(form, frame.out) === "";
      }, { timeoutMs: 2000, what: `${mode}: raw fixture exposes the declared empty composer` });
      check(`stuck-delivery ${mode} SETUP: raw fixture offers the declared empty composer`, ready);
      if (!ready) throw new Error(`stuck-delivery ${mode}: raw fixture exposes no empty composer`);
      const before = await events(senderToken);
      const text = mode === "collapsed" || mode === "late"
        ? Array.from({ length: 80 }, (_, i) => `stuck-delivery ${mode} line ${i}`).join("\n")
        : `stuck-delivery ${mode} payload`;
      const sent = await post("/send", { slot: target, text }, mode === "owner-only" ? H : requestHeaders);
      const receipt = await sent.json() as { acceptance?: string; receipt?: { acceptance?: string } };
      const acceptance = receipt.acceptance ?? receipt.receipt?.acceptance;
      check(`stuck-delivery ${mode}: ACP-25 acceptance keeps its original meaning`,
        acceptance === (mode === "normal" ? "observed" : mode === "late" ? "unobservable" : "not-observed"),
        `${sent.status} ${acceptance}`);
      const immediateState = readFileSync(stateFile, "utf8");
      if (mode === "replaced") {
        await post(`/api/slots/${target}/kill`, {});
        writeFileSync(modeFile, "normal\n");
        await post(`/api/slots/${target}/open`, { cwd: ROOT });
      }
      const shouldHold = !["normal", "foreign", "replaced"].includes(mode);
      if (shouldHold) await until(async () => (await sessions()).find((s) => s.id === target)?.stuckDelivery,
        { timeoutMs: 4500, what: `${mode}: typed composer remainder visible` });
      await Bun.sleep(3500);
      const row = (await sessions()).find((s) => s.id === target);
      const delta = (await events(senderToken)).filter((e) => !before.some((prior) => prior.id === e.id));
      check(`stuck-delivery ${mode}: bounded sensor reports exactly the expected slot fact`,
        shouldHold ? row?.stuckDelivery?.kind === "delivery-stuck" : row?.stuckDelivery === undefined);
      const wantEvent = shouldHold && mode !== "owner-only";
      check(`stuck-delivery ${mode}: exactly one fact to Self sender, none for accepted/foreign/replaced/owner-only`,
        delta.length === (wantEvent ? 1 : 0), `${delta.length}`);
      if (wantEvent) {
        const event = delta[0]!;
        check(`stuck-delivery ${mode}: event is pull-only, identity-bound, same fact as the poll`,
          event.delivery === "inbox" && event.status === "inbox" && event.attempts === 0
            && event.receiverSlot === sender && event.payload.sendId === row?.stuckDelivery?.sendId
            && event.payload.openedAt === row?.openedAt);
        check(`stuck-delivery ${mode}: evidence distinguishes payload from collapsed rendering`,
          event.payload.composer.kind === (mode === "collapsed" || mode === "late" ? "collapsed-paste" : "exact-payload"));
        check(`stuck-delivery ${mode}: durable event normalizer accepts its exact shape`,
          fleetEventFrom(event)?.kind === "delivery-stuck");
        check(`stuck-delivery ${mode}: normalizer rejects a fact with a foreign subject`,
          fleetEventFrom({ ...event, subjectSlot: target + 1 }) === null);
        check(`stuck-delivery ${mode}: normalizer refuses a fact queued for automatic pane transport`,
          fleetEventFrom({ ...event, status: "pending" }) === null);
        const ack = await fetch(`${BASE}/api/self/events/${event.id}/ack`, { method: "POST",
          headers: { "x-fleet-self-token": senderToken, "content-type": "application/json" }, body: "{}" });
        check(`stuck-delivery ${mode}: sender can acknowledge the fact`, ack.ok, String(ack.status));
      }
      if (mode !== "replaced") {
        const finalState = readFileSync(stateFile, "utf8");
        check(`stuck-delivery ${mode}: sensor sends zero Enter/erase/replay and preserves the input`,
          immediateState === finalState && /^enters=1 backspaces=0 keys=\d+\n/.test(finalState));
      }
      const cap = await tmuxOut("capture-pane", "-p", "-e", "-t", `s${sender}`);
      check(`stuck-delivery ${mode}: sender composer receives no automatic notification paste`,
        composerBuffer(form, cap.out) === "");
      await post(`/api/slots/${target}/kill`, {});
    }
  } finally {
    for (const id of new Set(owned)) await post(`/api/slots/${id}/kill`, {});
    await restartSrv();
    rmSync(dir, { recursive: true, force: true });
  }
}
