import { modelLabel } from "./modelname";

// A SLASH COMMAND CLAUDE CODE RAN (/model, /effort, /usage …) reaches the transcript as two lines of its own, never as
// something the owner wrote (docs/neuaufbau/befunde/12-modellwechsel.md §7 — both of Claude Code's forms arrive in
// the chat as these two texts, server.ts#viewEntry):
//   `<command-name>/model</command-name> <command-message>model</command-message> <command-args>X</command-args>`
//   `<local-command-stdout>Set model to `Fable 5.1` and saved as your default for new sessions</local-command-stdout>`
// The chat shows the pair as ONE quiet line (owner 14.10.: „[Zitat entfernt]“
// ).
export interface SlashCommand { name: string; args: string }
export interface SlashOutput { stream: "stdout" | "stderr"; text: string }

const RECORD = /^<command-name>(\/[^<\s]+)<\/command-name>\s*<command-message>[^<]*<\/command-message>\s*<command-args>([^<]*)<\/command-args>$/;
const OUTPUT = /^<local-command-(stdout|stderr)>([\s\S]*)<\/local-command-\1>$/;
const ANSI = /\u001b\[[0-9;]*m/g;

export function slashCommand(text: string): SlashCommand | null {
  const m = RECORD.exec(text.trim());
  return m ? { name: m[1]!, args: m[2]!.trim() } : null;
}
export function slashOutput(text: string): SlashOutput | null {
  const m = OUTPUT.exec(text.trim());
  return m ? { stream: m[1] === "stderr" ? "stderr" : "stdout", text: m[2]!.replace(ANSI, "").trim() } : null;
}
export function isSlashLine(text: string): boolean {
  return slashCommand(text) !== null || slashOutput(text) !== null;
}

// Claude Code's own words (counted in this machine's transcripts 01.–14.10.): „[Zitat entfernt]“
// , „[Zitat entfernt]“, "Set effort level to xhigh (saved as your default for new sessions):
// …", "… (this session only): …", or a bare "Set effort level to xhigh"
const MODEL_SET = /^Set model to (.+?)( and saved as your default for new sessions| \(this session only\))?$/;
const MODEL_KEPT = /^Kept model as (.+)$/;
const EFFORT_SET = /^Set effort level to (\S+?)(?: \((saved as your default for new sessions|this session only)\))?(?::|$)/;
const scope = (said: string | undefined): string =>
  !said ? "" : said.includes("saved as your default") ? ", gespeichert als Standard" : ", nur diese Session";

// The line's text: before the output, what was typed; after it, what Claude Code did — /model and /effort as a
// sentence, any other command as its first output line. A label from the typed id ("Fable 5.1 · 1M", as the switch
// writes it) only where it names the model Claude Code says it set.
export function slashSentence(cmd: SlashCommand | null, out: SlashOutput | null): string {
  if (!out) return cmd?.args ?? "";
  const said = out.text.replaceAll("`", "");
  const first = said.split("\n")[0]!.trim();
  if (cmd?.name !== "/effort") {
    const set = MODEL_SET.exec(first);
    if (set) {
      const label = cmd?.args ? modelLabel(cmd.args) : "";
      const name = set[1]!.replace(/ \([^)]*\)$/, "");
      return `Modell: ${label.split(" · ")[0] === name ? label : set[1]}${scope(set[2]?.trim())}`;
    }
    const kept = MODEL_KEPT.exec(first);
    if (kept) return `Modell bleibt ${kept[1]}`;
  }
  if (cmd?.name !== "/model") {
    const effort = EFFORT_SET.exec(first);
    if (effort) return `Effort: ${effort[1]}${scope(effort[2])}`;
  }
  return first;
}
