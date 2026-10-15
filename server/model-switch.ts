// MODEL AND EFFORT SWITCH FROM THE BOARD (Neuaufbau K10, Mangel 53 S-b, docs/neuaufbau/befunde/12-modellwechsel.md
// §5–§6). A leaf like recall.ts: server.ts hands in the pane. Measured 2026-10-13 on Claude Code 2.1.296:
// - A session WITH a conversation answers `/model <id>` with a question instead of switching:
//     Switch model? … ❯ 1. Yes, switch to <Name> / 2. No, go back
//   It paints in place of the input field when the session rests, above an empty field when a turn runs (then
//   only at the turn's end). Only a second Enter switches; Esc writes "Kept model as …".
// - A session without a conversation switches at once.
// - Either way the transcript gets a local_command line with commandRun {command, args}: "Set model to …",
//   "Kept model as …" (or the error Claude Code met).
// Owner, 13.10.: „[Zitat entfernt]“. So Fleet answers that
// question with ONE Enter, and only on the dialog that names exactly the model it asked for; what happened is
// read from the local_command line alone.
// - /effort asks the same way (Mangel 74, measured 15.10. on Claude Code 2.1.300, a Sonnet pane with a conversation):
//     Change effort level? … ❯ 1. Yes, switch to <level> / 2. No, go back
//   the level as typed; Esc writes "Kept effort level as …". So Fleet answers it with the same ONE Enter.
import { open, stat } from "node:fs/promises";
import { modelLabel } from "../src/modelname";

export type SwitchField = "model" | "effort";
// typed: in the pane, no answer yet · set / kept: Claude Code's own line · asks: a question Fleet does not
// answer stands in the terminal · not-set: nothing by the deadline, or Claude Code answered with an error
export type SwitchState = "typed" | "set" | "kept" | "asks" | "not-set";
export interface ModelSwitch { field: SwitchField; want: string; state: SwitchState; at: number }

const SGR_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;
const YES_RE = /^(❯ )?1\. Yes, switch to (.+)$/;
const NO_RE = /^(❯ )?2\. No, go back$/;

// the name Claude Code writes for a model id: Fleet's label without its window ("Fable 5.1"), and for a [1m] id
// also with Claude Code's own suffix — its "Kept model as" line spells the 1M Opus "Opus 5.5 (1M context)"
export function dialogNames(id: string): string[] {
  const name = modelLabel(id).split(" · ")[0];
  return id.endsWith("[1m]") ? [name, `${name} (1M context)`] : [name];
}

const DIALOG_TITLE: Record<SwitchField, string> = { model: "Switch model?", effort: "Change effort level?" };

// what the frame shows about a switch of `field` to `want`: "confirm" = the question for exactly this model or level
// with "1. Yes" marked; "foreign" = the question for another one, or another option marked, or options Fleet cannot
// read; "none" = no question (or one still painting its options)
export function switchDialog(frame: string, field: SwitchField, want: string): "confirm" | "foreign" | "none" {
  const lines = frame.replace(SGR_RE, "").split("\n").map((l) => l.trim());
  const at = lines.lastIndexOf(DIALOG_TITLE[field]);
  if (at < 0) return "none";
  const rest = lines.slice(at + 1, at + 8);
  const yes = rest.map((l) => YES_RE.exec(l)).find((m) => m !== null);
  const no = rest.map((l) => NO_RE.exec(l)).find((m) => m !== null);
  if (!yes && !no) return "none";
  if (!yes || !no) return "foreign";
  const names = field === "model" ? dialogNames(want) : [want];
  return yes[1] && !no[1] && names.includes(yes[2]!) ? "confirm" : "foreign";
}

// HOW CLAUDE CODE WRITES A COMMAND IT RAN — two shapes, both in every version from 2.1.270 to 2.1.296 (counted in the
// transcripts of this machine, 13.10.; for /model the second is the more frequent):
//   (a) system/local_command lines: "<command-name>/model</command-name>…" without commandRun, then
//       "<local-command-stdout>…</local-command-stdout>" WITH commandRun {command, args}
//   (b) user lines: a caveat (isMeta), "<command-name>/model</command-name>…<command-args>X</command-args>", then
//       "<local-command-stdout>…</local-command-stdout>" without commandRun — the args stand only in the line before
// readCommandLine reads one line of either: the command it names (pending until its output) or the output with
// what ran. A sidechain's lines are not this conversation's.
export interface PendingCommand { name: string; args: string }
export interface CommandRun { command: string; args: string; out: string }
const NAME_RE = /<command-name>\/?([^<]*)<\/command-name>/;
const ARGS_RE = /<command-args>([\s\S]*?)<\/command-args>/;
const OUT_RE = /^<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/;
export function readCommandLine(raw: string, pending: PendingCommand | null): { pending: PendingCommand | null; run: CommandRun | null } {
  if (!raw.includes("<command-name>") && !raw.includes("<local-command-stdout>")) return { pending, run: null };
  let d: { type?: unknown; subtype?: unknown; isSidechain?: unknown; content?: unknown; message?: { content?: unknown };
    commandRun?: { command?: unknown; args?: unknown } };
  try { d = JSON.parse(raw) as typeof d; } catch { return { pending, run: null }; } // torn line
  if (d.isSidechain === true) return { pending, run: null };
  const text = d.type === "system" && d.subtype === "local_command" && typeof d.content === "string" ? d.content
    : d.type === "user" && typeof d.message?.content === "string" ? d.message.content : null;
  if (text === null) return { pending, run: null };
  const name = NAME_RE.exec(text);
  if (name) return { pending: { name: name[1]!.trim(), args: (ARGS_RE.exec(text)?.[1] ?? "").trim() }, run: null };
  const out = OUT_RE.exec(text.trim());
  if (!out) return { pending, run: null };
  const ran = typeof d.commandRun?.command === "string"
    ? { command: d.commandRun.command, args: typeof d.commandRun.args === "string" ? d.commandRun.args.trim() : "" }
    : pending ? { command: pending.name, args: pending.args } : null;
  return { pending: null, run: ran ? { ...ran, out: out[1]!.trim() } : null };
}

// Claude Code's answer to `/<field> <want>` among transcript lines written after it was typed
export function switchVerdict(lines: readonly string[], field: SwitchField, want: string): "set" | "kept" | "not-set" | null {
  let verdict: "set" | "kept" | "not-set" | null = null;
  let pending: PendingCommand | null = null;
  for (const raw of lines) {
    const read = readCommandLine(raw, pending);
    pending = read.pending;
    if (!read.run || read.run.command !== field || read.run.args !== want) continue;
    verdict = read.run.out.startsWith(field === "model" ? "Set model to " : "Set effort level to ") ? "set"
      : read.run.out.startsWith(field === "model" ? "Kept model as " : "Kept effort level as ") ? "kept" : "not-set";
  }
  return verdict;
}

// the transcript lines written after `offset`, read incrementally: each call reads only the bytes added since the last
// one (a watch can last a 15-min turn with large tool output), keeps a line still being written — as bytes, so a
// character split between two reads stays whole — and hands back every complete line so far
export function lineTail(file: string, offset: number) {
  let pos = offset, carry = Buffer.alloc(0), bytesRead = 0;
  const lines: string[] = [];
  return {
    async lines(): Promise<readonly string[]> {
      const size = (await stat(file).catch(() => null))?.size ?? 0;
      if (size <= pos) return lines;
      const fh = await open(file, "r");
      try {
        const buf = Buffer.alloc(size - pos);
        const { bytesRead: n } = await fh.read(buf, 0, buf.length, pos);
        pos += n;
        bytesRead += n;
        const data = Buffer.concat([carry, buf.subarray(0, n)]);
        let start = 0;
        for (let i = data.indexOf(0x0a); i >= 0; i = data.indexOf(0x0a, start)) {
          const line = data.subarray(start, i).toString("utf8");
          if (line.trim() !== "") lines.push(line);
          start = i + 1;
        }
        carry = Buffer.from(data.subarray(start));
      } finally { await fh.close(); }
      return lines;
    },
    get bytesRead(): number { return bytesRead; },
  };
}

export interface SwitchPane {
  // the occupant that got the command still holds the slot
  alive(): boolean;
  // `capture-pane -p -e` of the slot's pane; null = no pane
  frame(): Promise<string | null>;
  // one Enter into the slot's pane, in its input chain
  enter(): Promise<boolean>;
  // the transcript lines written since the command was typed
  lines(): Promise<readonly string[]>;
  // the live turn says "working"
  working(): Promise<boolean>;
  publish(state: SwitchState): void;
}
// the deadline: a running turn holds the question back until its end, so the watch lasts until the turn has
// rested for graceMs, at most capMs; a question Fleet leaves to the owner counts as running
export const SWITCH_LIMITS = { tickMs: 400, graceMs: 10_000, capMs: 15 * 60_000 };

export function watchSwitch(field: SwitchField, want: string, pane: SwitchPane,
  limits = SWITCH_LIMITS, now: () => number = Date.now, sleep: (ms: number) => Promise<unknown> = Bun.sleep) {
  let stopped = false;
  const done = (async (): Promise<SwitchState | "stopped"> => {
    const start = now();
    let restSince = start, entered = false, asked = false;
    pane.publish("typed");
    for (;;) {
      if (stopped || !pane.alive()) return "stopped";
      const verdict = switchVerdict(await pane.lines(), field, want);
      if (stopped || !pane.alive()) return "stopped";
      if (verdict) { pane.publish(verdict); return verdict; }
      if (!entered && !asked) {
        const frame = await pane.frame();
        if (stopped || !pane.alive()) return "stopped";
        const read = frame === null ? "none" : switchDialog(frame, field, want);
        if (read === "confirm") { entered = true; await pane.enter(); }
        else if (read === "foreign") { asked = true; pane.publish("asks"); }
      }
      if (asked || await pane.working()) restSince = now();
      if (now() - restSince > limits.graceMs || now() - start > limits.capMs) { pane.publish("not-set"); return "not-set"; }
      await sleep(limits.tickMs);
    }
  })();
  return { stop: () => { stopped = true; }, done };
}

// what the board types for the switch: Claude Code's own commands, pi-zai's (`/model zai/<id>`, `/thinking`);
// any other harness keeps the one command the push has always typed
export function switchCommand(harness: string, field: SwitchField, value: string): string {
  if (harness === "pi-zai") return field === "model" ? `/model zai/${value}` : `/thinking ${value}`;
  return `/${field} ${value}`;
}
