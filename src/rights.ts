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
      head.append(document.createTextNode("Ihren Auftrag "), el("span", "rgmono", row.taskId.slice(0, 8)));
      v.append(head, sub(`${row.taskTitle ? `„${row.taskTitle}“` : "Ihre Zeile"}${wave.length ? ` und ${wave.length} ${wave.length === 1 ? "weitere Zeile" : "weitere Zeilen"} ihrer Welle` : ""}: Stand, Quellen, Belege, Beobachtung.`));
    } else if (wave.length) {
      v.append(el("span", "rgval", `${wave.length} ${wave.length === 1 ? "Auftrag" : "Aufträge"} ihrer Welle`),
        sub("Stand, Quellen, Belege, Beobachtung."));
    } else {
      v.append(el("span", "rgmute", "Keinen Auftrag"), sub("Von Hand gegründet: sie liest erst etwas, wenn ein Auftrag sie startet."));
    }
  } else {
    const prog = boundProgram(row);
    if (prog) {
      const open = board.tasks().filter((t) => t.programId === prog.id && t.status !== "done" && t.status !== "archived").length;
      v.append(el("span", "rgval", `Ihr Program „${prog.title}“`),
        sub(`${open} ${open === 1 ? "offener Auftrag" : "offene Aufträge"} und ihre Lanes: Stand, Quellen, Belege, Beobachtung.`));
    } else if (board.programsRead() !== "ok" && board.programsPoll().some((x) => x.status === "active")) {
      // the 2 s poll names the active Programs but not their MAIN binding; the full rows are read
      // on demand (a no-op inside loadPrograms' own floor) and the next paint has the answer
      void board.loadPrograms();
      v.append(el("span", "rgval", "Unbekannt"),
        sub(board.programsRead() === "fail" ? "Die Programs sind gerade nicht lesbar — ob sie eines führt, ist nicht gemessen."
          : "Die Programs werden gelesen — ob sie eines führt, steht gleich hier."));
    } else if (board.programs().some((x) => x.status === "active" && x.main
        && (typeof x.main.slot !== "number" || typeof x.main.openedAt !== "number"))) {
      // A BINDING THAT CANNOT BE READ IS NEVER "KEINE" (owner, 2026-10-06): an active program
      // whose main is present but carries no complete slot+openedAt pair could still name THIS
      // session — the honest answer is "not documented", worded by what this instance is.
      const snap = board.source() !== null;
      v.append(el("span", "rgval", snap ? "Im Snapshot nicht belegt" : "Nicht belegt"),
        sub(snap ? "Ob diese Session ein Program führt, trägt der Snapshot nicht — das heißt nicht „keine“."
                 : "Ob diese Session ein Program führt, ist gerade nicht belegt — das heißt nicht „keine“."));
    } else {
      v.append(el("span", "rgmute", "Keine"), sub(`An keinen Auftrag, kein Program gebunden.${/\borchestrator\b/i.test(row.label ?? "") ? " Die Rolle gibt kein Leserecht." : ""}`));
    }
  }
  v.append(sub("folgt aus ihrer Arbeit · nicht zuweisbar", true));
  return v;
}

// THE BOARD'S BLOCK (E1, G6.5: after the context, before the checks): the two statements, and the
// execution contract named between 1 and 2 only so nobody takes "Rechte" for both.
export function rightsSection(row: SlotInfo): HTMLElement {
  const sec = el("div", "bsec brights");
  const h = el("h3", "", "Rechte");
  h.append(el("span", "brhint", "was sie lesen darf"));
  sec.append(h);
  sec.append(kv("Eigene Arbeit", ownWork(row)));
  const ex = el("span", "rgv");
  ex.append(el("span", "rgmute", "Fleet-Standard"), sub("Befehle und Dateien — eigener Vertrag, hier nur genannt.", true));
  sec.append(kv("Ausführung", ex));
  sec.append(el("div", "rgrule"));
  // E33: the owner's own view — the repo sheet, opened where it already lives (the queue)
  const repo = row.worktree?.repo ?? row.repo ?? row.cwd ?? "";
  const mine = el("span", "rgv");
  const lk = btn("link", `Repo-Blatt ${repoName(repo)}`, "sheet", () => board.openSheet(repo),
    "Öffnet das Repo-Blatt in der Aufgabenansicht — deine eigene, breite Sicht auf dieses Repo.");
  mine.append(lk, sub("Lanes, Queue, Lands, Check, Deploy, Lane-Grenze — das siehst du, nicht die Session."));
  sec.append(kv("Deine Sicht", mine));
  return sec;
}

// --- the founding window -----------------------------------------------------------------------------

export type FoundingRightsRole = "leer" | "lane" | "orch" | "main";
// E35: the profile field's rows, per role.
export function foundingRights(role: FoundingRightsRole, program: string | null): HTMLElement {
  const box = el("div", "fdrights");
  const own: Record<FoundingRightsRole, string> = {
    leer: "Keine — sie ist an nichts gebunden.",
    lane: "Ihren Auftrag, sobald einer sie startet. Von Hand gegründet: keinen.",
    orch: "Keine — die Rolle bindet nichts.",
    main: program ? `Ihr Program „${program}“ und seine Aufträge.` : "Ihr Program, sobald du eines wählst.",
  };
  const ex = el("span", "rgv");
  ex.append(el("span", "", "Fleet-Standard"), sub("Befehle und Dateien. Hier nicht wählbar.", true));
  box.append(kv("Ausführung", ex), kv("Eigene Arbeit", own[role]));
  return box;
}
