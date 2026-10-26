// THE RIGHTS OF A SESSION — what it may read, said in two separate statements (owner 2026-10-02:
// „[Zitat entfernt]“; material: docs/design/datenrechte-skizze.html and
// its mapping docs/design/datenrechte-notiz.md, elements E1–E39).
//
//   1. EIGENE ARBEIT — what the session reads from its binding: a lane its order and that order's
//      wave, a bound Program-MAIN its Program, everything else nothing. No switch: it follows from
//      the work (server.ts#memoryScopeFor).
//   2. DEINE SICHT — the repo sheet, the owner's own wide view, which is never assignable.
//
// UNKNOWN IS NEVER "KEINE". A Program list that could not be read leaves the session's own work
// "unbekannt".
//
// The board (src/board.ts#renderBoard) only hangs this in.
import { SECTION } from "./board-words";
import { el, type SlotInfo, type TaskInfo } from "./client";
import type { InstanceSource } from "./protocol";
import type { ProgramDigest, ProgramInfo } from "./queue";

// THE BOARD'S READS, handed in by src/board.ts (wireRights) instead of imported.
export interface RightsBoard {
  tasks(): TaskInfo[];
  programs(): ProgramInfo[];
  programsPoll(): ProgramDigest[];
  programsRead(): "unread" | "ok" | "fail";
  loadPrograms(): Promise<void>;
  source(): InstanceSource | null;
  openSheet(repo: string): void;
}
let board: RightsBoard = {
  tasks: () => [], programs: () => [], programsPoll: () => [], programsRead: () => "unread",
  loadPrograms: async () => {}, source: () => null, openSheet: () => {},
};
export function wireRights(b: RightsBoard) { board = b; }

const repoName = (repo: string): string => repo.replace(/\/+$/, "").split("/").pop() || repo;

// --- what is painted --------------------------------------------------------------------------------

function sub(text: string, faint = false): HTMLElement { return el("span", `rgsub${faint ? " faint" : ""}`, text); }
function btn(cls: string, text: string, rk: string, on: () => void, title?: string): HTMLButtonElement {
  const b = el("button", `wordbtn rgbtn${cls ? ` ${cls}` : ""}`, text) as HTMLButtonElement;
  b.type = "button";
  b.dataset.rk = rk;
  b.onclick = on;
  if (title) b.title = title;
  return b;
}

function boundProgram(r: SlotInfo): { title: string; id: string } | null {
  const p = board.programs().find((x) => x.status === "active" && x.main && x.main.slot === r.id && x.main.openedAt === r.openedAt);
  return p ? { title: p.title, id: p.id } : null;
}
function kv(key: string, value: HTMLElement | string): HTMLElement {
  const r = el("div", "rgrow");
  r.append(el("span", "rgkey", key), typeof value === "string" ? el("span", "rgv", value) : value);
  return r;
}

// E2–E4: what the session reads from its binding. Unknown when the Programs could not be read —
// never "Keine" for a session that may be a MAIN.
function ownWork(row: SlotInfo): HTMLElement {
  const v = el("span", "rgv");
  const wave = board.tasks().filter((t) => t.slot === row.id && t.status === "sent" && t.id !== row.taskId);
  if (row.worktree) {
    if (row.taskId) {
      const head = el("span", "rgval");
      head.append(document.createTextNode("Its task "), el("span", "rgmono", row.taskId.slice(0, 8)));
      v.append(head, sub(`${row.taskTitle ? `“${row.taskTitle}”` : "Its row"}${wave.length ? ` and ${wave.length} more ${wave.length === 1 ? "row" : "rows"} of its wave` : ""}: status, sources, evidence, observations.`));
    } else if (wave.length) {
      v.append(el("span", "rgval", `${wave.length} ${wave.length === 1 ? "task" : "tasks"} of its wave`),
        sub("Status, sources, evidence, observations."));
    } else {
      v.append(el("span", "rgmute", "No task"), sub("Founded by hand: it reads nothing until a task starts it."));
    }
  } else {
    const prog = boundProgram(row);
    if (prog) {
      const open = board.tasks().filter((t) => t.programId === prog.id && t.status !== "done" && t.status !== "archived").length;
      v.append(el("span", "rgval", `Its Program “${prog.title}”`),
        sub(`${open} open ${open === 1 ? "task" : "tasks"} and their lanes: status, sources, evidence, observations.`));
    } else if (board.programsRead() !== "ok" && board.programsPoll().some((x) => x.status === "active")) {
      // the 2 s poll names the active Programs but not their MAIN binding; the full rows are read
      // on demand (a no-op inside loadPrograms' own floor) and the next paint has the answer
      void board.loadPrograms();
      v.append(el("span", "rgval", "Unknown"),
        sub(board.programsRead() === "fail" ? "The Programs cannot be read right now — whether it leads one is not measured."
          : "The Programs are being read — whether it leads one shows here in a moment."));
    } else if (board.programs().some((x) => x.status === "active" && x.main
        && (typeof x.main.slot !== "number" || typeof x.main.openedAt !== "number"))) {
      // A BINDING THAT CANNOT BE READ IS NEVER "KEINE" (owner, 2026-10-06): an active program
      // whose main is present but carries no complete slot+openedAt pair could still name THIS
      // session — the honest answer is "not documented", worded by what this instance is.
      const snap = board.source() !== null;
      v.append(el("span", "rgval", snap ? "Not in the snapshot" : "Not on record"),
        sub(snap ? "The snapshot does not carry whether this session leads a Program — that does not mean “none”."
                 : "Whether this session leads a Program is not on record right now — that does not mean “none”."));
    } else {
      v.append(el("span", "rgmute", "None"), sub(`Bound to no task and no Program.${/\borchestrator\b/i.test(row.label ?? "") ? " The role grants no right to read." : ""}`));
    }
  }
  v.append(sub("follows from its work · not assignable", true));
  return v;
}

// THE BOARD'S BLOCK (E1, G6.5: after the context, before the checks): the two statements, and the
// execution contract named between 1 and 2 only so nobody takes "Rechte" for both.
export function rightsSection(row: SlotInfo): HTMLElement {
  const sec = el("div", "bsec brights");
  const h = el("h3", "", SECTION.rights);
  h.append(el("span", "brhint", "what it may read"));
  sec.append(h);
  sec.append(kv("Own work", ownWork(row)));
  const ex = el("span", "rgv");
  ex.append(el("span", "rgmute", "Fleet standard"), sub("Commands and files — a contract of its own, only named here.", true));
  sec.append(kv("Execution", ex));
  sec.append(el("div", "rgrule"));
  // E33: the owner's own view — the repo sheet, opened where it already lives (the queue)
  const repo = row.worktree?.repo ?? row.repo ?? row.cwd ?? "";
  const mine = el("span", "rgv");
  const lk = btn("link", `Repo sheet ${repoName(repo)}`, "sheet", () => board.openSheet(repo),
    "Opens the repo sheet in the task view — your own wide view of this repo.");
  mine.append(lk, sub("Lanes, queue, lands, check, deploy, lane limit — you see these, the session does not."));
  sec.append(kv("Your view", mine));
  return sec;
}

// --- the founding window -----------------------------------------------------------------------------

export type FoundingRightsRole = "leer" | "lane" | "orch" | "main";
// E35: the profile field's rows, per role.
export function foundingRights(role: FoundingRightsRole, program: string | null): HTMLElement {
  const box = el("div", "fdrights");
  const own: Record<FoundingRightsRole, string> = {
    leer: "None — it is bound to nothing.",
    lane: "Its task, once one starts it. Founded by hand: none.",
    orch: "None — the role binds nothing.",
    main: program ? `Its Program “${program}” and its tasks.` : "Its Program, once you pick one.",
  };
  const ex = el("span", "rgv");
  ex.append(el("span", "", "Fleet standard"), sub("Commands and files. Not selectable here.", true));
  box.append(kv("Execution", ex), kv("Own work", own[role]));
  return box;
}
