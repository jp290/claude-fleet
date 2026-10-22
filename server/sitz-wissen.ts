// WAS EIN SITZ OHNE STEHENDE ROLLE AUS FLEETS BIBLIOTHEK BEKOMMT (Owner 22.10. über Slot 16: „[Zitat entfernt]“
// 
// ). Eine Branch-Session, eine freie Session, ein Sitz in einem anderen Repo bekam bis hierher keinen Pack.
// Lane, MAIN und Orchestratorin haben ihren eigenen Plan und bleiben, wie sie sind.
//
// EIN ZEIGER ALLEIN KOMMT NICHT AN: Claude-Lanes öffneten einen Pack-Zeiger 0 von 13 Mal
// (docs/messungen/2026-10-08-pack-zeiger-gelesen.md). Darum zwei Wege, je Pack entschieden:
// - BOX: was ein Sitz von seinem ersten Akt an braucht, steht wörtlich in seinem Start (SEAT_BOX).
// - SKILL: der Rest wird ein Claude-Code-Skill (Owner-Ja 22.10. über Slot 16). Im Kontext steht nur die Beschreibung
//   (die useWhen-Zeile), der Text lädt, wenn Claude sie aufruft. Fleet schreibt die Skills in ein Verzeichnis und gibt
//   es mit `--add-dir` (Probe an claude 2.1.308: die Skill steht im init und wird über das Skill-Werkzeug geladen;
//   ohne `--add-dir` fehlt sie). Ob Claude sie aufruft, misst skillAufrufe am Transkript.
// Andere Harnesses lesen weder Start-Block noch Skills; sie leihen über GET /api/self/context/<id>.
//
// WELCHE PACKS (Owner 22.10. über Slot 16: „[Zitat entfernt]“
// , „[Zitat entfernt]“): einer aus Fleets Register (`.fleet/context-packs.json` im Fleet-Baum) erreicht einen solchen
// Sitz in JEDEM Repo, wenn er `seat-start-any-repo` trägt, im Fleet-Repo auch mit `seat-start`. Was Fleets eigene Arbeit
// ist (Landen, Deploy, Testinstanz, Agenten aufsetzen, das Systemkonzept), trägt `seat-start`: ein Sitz in einem anderen
// Repo bekommt nur Allgemeines, nie Fleets Betriebswissen. Welcher Pack welchen Auslöser trägt, steht im Register.
//
// Rein: kein Dateizugriff, kein git. Der Server misst, plant und schreibt (server.ts#seatKnowledgeFor, #seatStartFor).
import { CONTEXT_PACK_TRIGGERS, type ContextPackCapability, type ContextPackMode, type ContextPackTrigger } from "../context-packs";
import type { ContextPlanInput } from "../context-plan";
import { textAbschnitt, unknownAbschnitt, type FassungAbschnittEingang } from "./fassung";
import type { SpawnBibliothek } from "./session-start";

export type SeatTree = "fleet" | "foreign";

export const SEAT_TRIGGERS: Readonly<Record<SeatTree, readonly ContextPackTrigger[]>> = {
  fleet: ["seat-start", "seat-start-any-repo"],
  foreign: ["seat-start-any-repo"],
};

// WAS KEIN SITZ BEKOMMT, weder wörtlich noch als Skill, auch wenn sein Auslöser im Register passt; je Pack der Grund. Der
// Eintrag im Register und die Datei bleiben, bis sie selbst gehen (runde4 §6).
export const SEAT_OHNE: Readonly<Record<string, string>> = {
  "working-toward-a-goal": "Owner 22.10.: „[Zitat entfernt]“",
};

// WAS WÖRTLICH IM START STEHT, je Pack ein Satz, warum. Nach Pack-Id, nicht nach Pfad: die Bibliothek zieht um.
// who-it-is-for steht hier, weil einem Sitz an der Leiste genau das fehlte (Orchestratorin 22.10., runde4 §3).
// Gemessen am 22.10. (claude 2.1.308, Opus 5.5, Usage der ersten Antwort im selben Ordner, ohne Bibliothek 29 284 Tokens): ein
// Sitz in einem anderen Repo +1 985 (Box, keine Skill, kein --add-dir), im Fleet-Repo +1 997 (Box, fünf Skills).
export const SEAT_BOX: Readonly<Record<string, string>> = {
  "who-it-is-for": "Jeder Sitz baut etwas, das jemand trifft; für wen, entscheidet er schon mit dem ersten Schritt, und "
    + "kein späterer Moment sagt ihm, dass eine Beschreibung jetzt passen würde.",
  "working-with-the-owner": "Der Owner schreibt jedem Sitz direkt und liest alles, was er schreibt, ab der ersten Nachricht; "
    + "wie man ihn versteht, kommt zu spät, wenn es erst beim zweiten Missverständnis geladen wird.",
};

const SEAT_MODE: ContextPackMode = "mutating";
// what a seat honestly has: it reads tracked text through the borrow door, and git where it works
const SEAT_CAPABILITIES: readonly ContextPackCapability[] = ["tracked-source-read", "git-inspect"];

/** Die Fakten für Fleets Register. Beim Ausleihen öffnet ein Sitz im Fleet-Repo jeden Auslöser, wie eine Lane;
 *  ein Sitz in einem anderen Repo bleibt beim Ausleihen bei dem, was überall gilt. */
export function seatContextFacts(tree: SeatTree, harness: string | null, borrow = false): Omit<ContextPlanInput, "sourceTree"> {
  return { harness, mode: SEAT_MODE, capabilities: SEAT_CAPABILITIES,
    triggers: borrow && tree === "fleet" ? CONTEXT_PACK_TRIGGERS : SEAT_TRIGGERS[tree] };
}

export interface SeatPack {
  readonly id: string;
  readonly useWhen: string | null;
  readonly sources: readonly { readonly path: string; readonly anchor: string }[];
  /** die Abschnitte aller Quellen am Kopf, wie die Ausleihe sie liefert; null, wenn eine Quelle nicht lesbar war */
  readonly text: string | null;
}

export interface SeatKnowledge {
  readonly tree: SeatTree;
  /** Fleets Baum und sein Kopf, aus dem die Packs kommen */
  readonly repoRoot: string;
  readonly head: string;
  readonly packs: readonly SeatPack[];
}

const isBox = (pack: SeatPack): boolean => pack.id in SEAT_BOX;
const imSitz = (k: SeatKnowledge): SeatPack[] => k.packs.filter((pack) => !(pack.id in SEAT_OHNE));
// ein Pack ohne lesbaren Text kommt weder in den Start noch als Skill: ein leerer Text wäre eine falsche Zusage
const boxOf = (k: SeatKnowledge): SeatPack[] => imSitz(k).filter((pack) => isBox(pack) && pack.text !== null);
const skillsOf = (k: SeatKnowledge): SeatPack[] => imSitz(k).filter((pack) => !isBox(pack) && pack.text !== null && pack.useWhen);
const quelleOf = (pack: SeatPack): string => pack.sources.map((source) => `${source.path} · ${source.anchor}`).join(" + ");
const groesse = (bytes: number): string => bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1).replace(".", ",")} kB`;

export const SEAT_START_HEAD = "BIBLIOTHEK (server/sitz-wissen.ts): Fleets Wissen für deinen Sitz.";
const headOf = (k: SeatKnowledge): string => {
  const box = boxOf(k), skills = skillsOf(k);
  return [SEAT_START_HEAD,
    box.length ? `Wörtlich hier: ${box.map((pack) => pack.id).join(", ")}.` : "",
    skills.length ? `Als Skills, wenn ihre Beschreibung passt (Skill-Werkzeug): ${skills.map((pack) => pack.id).join(", ")}.` : ""]
    .filter(Boolean).join(" ");
};
const boxBlock = (pack: SeatPack): string => `--- ${pack.id} (${quelleOf(pack)}) ---\n${pack.text}`;

/** Der Block für den Start: Kopf, dann die Box-Packs wörtlich; leer, wenn nichts zu diesem Sitz passt. */
export function renderSeatStart(k: SeatKnowledge): string {
  if (!boxOf(k).length && !skillsOf(k).length) return "";
  return [headOf(k), ...boxOf(k).map(boxBlock)].join("\n\n");
}

const skillZeile = (pack: SeatPack): string => `- ${pack.id}: ${pack.useWhen}`;
/** Was ein Sitz aus der Bibliothek bekommt, je Weg die Packs: wörtlich im Start, als Skill (mit der Zeile, die Claude in
 *  seiner Skill-Liste sieht). Der Gründungsplan zeigt damit, was der Spawn gibt. */
export function seatPacks(k: SeatKnowledge): { box: string[]; skills: string[]; skillListe: string } {
  return { box: boxOf(k).map((pack) => pack.id), skills: skillsOf(k).map((pack) => pack.id),
    skillListe: skillsOf(k).map(skillZeile).join("\n") };
}

/** Eine SKILL.md: Name = Pack-Id, Beschreibung = useWhen (JSON-Zeichenkette ist gültiges YAML), dann die Quelle und
 *  der Text am Kopf. */
export function renderSkillFile(pack: SeatPack, head: string): string {
  return `---\nname: ${pack.id}\ndescription: ${JSON.stringify(pack.useWhen ?? "")}\n---\n`
    + `Aus Fleets Bibliothek: ${quelleOf(pack)} am Commit ${head.slice(0, 12)}.\n\n${pack.text}`;
}

/** Die Skill-Dateien dieses Sitzes, relativ zum Verzeichnis, das `--add-dir` bekommt. */
export function seatSkillFiles(k: SeatKnowledge): { readonly pfad: string; readonly text: string }[] {
  return skillsOf(k).map((pack) => ({ pfad: `.claude/skills/${pack.id}/SKILL.md`, text: renderSkillFile(pack, k.head) }));
}

/** DER SKILL-ORDNER GEHÖRT EINER BELEGUNG (Abnahme 22.10., FIX): Claude Code lädt Skills aus einem --add-dir in der laufenden
 *  Session neu (code.claude.com/docs/en/skills, „Edit a skill during a session“). Ein Ordner, den zwei Sitze teilen, wäre ein
 *  Weg von einem in den anderen; einer je Belegung trifft nur den Sitz, der ihn ändert, und sein nächster Spawn schreibt ihn neu. */
export const seatSkillsName = (slot: number, openedAt: number): string => `${slot}-${openedAt}`;
export const seatSkillsDir = (root: string, slot: number, openedAt: number): string => `${root}/${seatSkillsName(slot, openedAt)}`;
/** Was unter dem Wurzelordner keiner laufenden Belegung gehört: beim Start des Servers verwaist (ein Ende, das er nicht sah). */
export function seatSkillsVerwaist(names: readonly string[], belegt: readonly { readonly slot: number; readonly openedAt: number }[]): string[] {
  const lebt = new Set(belegt.map((b) => seatSkillsName(b.slot, b.openedAt)));
  return names.filter((name) => !lebt.has(name));
}

/** DIE WAHL AN EINER TÜR: `bibliothek` true | false, oder die Zeile „bibliothek“ eines angenommenen Plans; null heißt, die
 *  Voreinstellung gilt (an, server.ts#seatLibraryOn). Ein Plan ohne diese Zeile wählt nichts. An der Selbst-Tür kann eine
 *  Session für eine andere nur abschalten, nie über die Voreinstellung hinaus anschalten (Abnahme 22.10. 2/2). */
export function bibliothekDerTuer(body: Readonly<Record<string, unknown>>, plan: readonly { readonly id: string; readonly zustand: string }[] | null,
  tuer: "owner" | "self"): { ok: true; wahl: boolean | null } | { ok: false; error: string } {
  if (body.bibliothek !== undefined && typeof body.bibliothek !== "boolean") return { ok: false, error: "bibliothek must be true or false" };
  if (plan && body.bibliothek !== undefined)
    return { ok: false, error: "bibliothek and plan together are two choices — switch it in the plan as bausteine bibliothek=an|aus" };
  const zeile = plan?.find((row) => row.id === "bibliothek")?.zustand;
  const wahl = zeile !== undefined ? zeile === "an" : typeof body.bibliothek === "boolean" ? body.bibliothek : null;
  return { ok: true, wahl: tuer === "self" && wahl === true ? null : wahl };
}

/** „Wissen“ in der Fassung: der Kopf, je Box-Pack sein Text, je Skill die Zeile, die Claude in seiner Skill-Liste
 *  sieht. Die Bytes eines Abschnitts sind die, die immer im Kontext stehen; was eine Skill beim Aufruf lädt, steht im
 *  Grund. `skillsDir` ist der Ordner, den der Start mit `--add-dir` bekommt; null vor dem Start (er gehört der Belegung). `nichtWirksam`: warum der Start-Block in der
 *  laufenden Unterhaltung (noch) nicht gilt — dann sagt die Fassung nicht „wörtlich im Start“. */
export function seatFassungAbschnitte(k: SeatKnowledge, claude: boolean, skillsDir: string | null, nichtWirksam?: string): FassungAbschnittEingang[] {
  if (!claude)
    return [unknownAbschnitt("wissen", "dieser Harness liest weder Start-Block noch Skills; Fleets Packs leiht er über "
      + `GET /api/self/context/<id> aus (${imSitz(k).map((pack) => pack.id).join(", ") || "keiner passt"})`)];
  const box = boxOf(k), skills = skillsOf(k);
  if (!box.length && !skills.length)
    return [unknownAbschnitt("wissen", `kein lesbarer Pack in Fleets Bibliothek passt zu diesem Sitz (${k.tree === "fleet"
      ? "Fleet-Repo" : "anderes Repo"}, ${k.head.slice(0, 8)})`)];
  return [
    textAbschnitt("wissen", "server/sitz-wissen.ts#renderSeatStart", headOf(k), false, undefined, undefined,
      nichtWirksam ? `nicht wirksam: ${nichtWirksam}` : undefined),
    ...box.map((pack) => textAbschnitt("wissen", pack.sources.map((source) => `${k.repoRoot}/${source.path} · ${source.anchor}`).join("\n"),
      boxBlock(pack), true, undefined, undefined, nichtWirksam ? `nicht wirksam: ${nichtWirksam}` : `wörtlich im Start: ${SEAT_BOX[pack.id]}`)),
    ...skills.map((pack) => textAbschnitt("wissen", `${skillsDir ?? "<Ordner dieser Belegung, entsteht beim Start>"}/.claude/skills/${pack.id}/SKILL.md\n`
      + pack.sources.map((source) => `${k.repoRoot}/${source.path} · ${source.anchor}`).join("\n"),
      skillZeile(pack), true, undefined, undefined,
      `Skill: im Kontext steht diese Beschreibung, beim Aufruf lädt sie ${groesse(Buffer.byteLength(renderSkillFile(pack, k.head)))}`)),
  ];
}

/** WELCHEN START-BLOCK DIE UNTERHALTUNG LIEST (Abnahme 22.10. (a)): Claude Code hält den Systemprompt beim ersten Request einer
 *  Unterhaltung fest und behält ihn nach --resume, bis sie kompaktiert wird (code.claude.com/docs/en/cli-reference, „System
 *  prompt flags in resumed conversations“). Ein frischer Start liest seinen Block; ein fortgesetzter den des ersten Starts,
 *  oder — nach einer Kompaktierung seit dem letzten Spawn — den, den dieser angehängt hat. */
export function bibliothekBeimSpawn(prior: SpawnBibliothek | null, resume: boolean, sha: string, compactionAt: number | null, am: number): SpawnBibliothek {
  const wirksam = !resume ? sha : prior && compactionAt !== null && compactionAt > prior.am ? prior.zuletzt : prior?.wirksam ?? null;
  return { wirksam, zuletzt: sha, am };
}
/** Warum der Block `sha` in der laufenden Unterhaltung nicht gilt; undefined, wenn er gilt. */
export function bibliothekNichtWirksam(rec: SpawnBibliothek | null, sha: string, compactionAt: number | null): string | undefined {
  if (!rec) return "der letzte Start dieser Session hat keinen Block aus Fleets Bibliothek festgehalten; sie bekommt ihn mit dem nächsten frischen Start";
  if (rec.wirksam === sha || compactionAt !== null && compactionAt > rec.am && rec.zuletzt === sha) return undefined;
  return rec.zuletzt === sha
    ? "angehängt beim Fortsetzen (--resume); Claude Code liest bis zur nächsten Kompaktierung den Systemprompt vom ersten Start dieser Unterhaltung"
    : "Fleets Register hat sich seit dem Start dieser Session geändert; die Unterhaltung liest den Block ihres Starts";
}

/** DER MESSWEG: was ein Claude-Transkript (JSONL) über Fleets Skills sagt — welche ihm angeboten wurden (Anhang
 *  `skill_listing`) und welche es aufgerufen hat (tool_use `Skill`), in der Reihenfolge der Aufrufe. Gezählt werden nur
 *  Namen aus `ids`; eine kaputte Zeile wird übersprungen und gezählt, nie geraten. */
export function skillAufrufe(transcript: string, ids: readonly string[]): { angeboten: string[]; aufgerufen: string[]; kaputt: number } {
  const known = new Set(ids);
  const angeboten = new Set<string>();
  const aufgerufen: string[] = [];
  let kaputt = 0;
  for (const line of transcript.split("\n")) {
    if (!line.trim()) continue;
    let entry: unknown;
    try { entry = JSON.parse(line); } catch { kaputt++; continue; }
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as { type?: unknown; attachment?: { type?: unknown; content?: unknown }; message?: { content?: unknown } };
    if (e.type === "attachment" && e.attachment?.type === "skill_listing" && typeof e.attachment.content === "string")
      for (const m of e.attachment.content.matchAll(/^- ([^:\n]+):/gm)) if (known.has(m[1]!)) angeboten.add(m[1]!);
    if (e.type === "assistant" && Array.isArray(e.message?.content))
      for (const part of e.message.content as { type?: unknown; name?: unknown; input?: { skill?: unknown } }[])
        if (part?.type === "tool_use" && part.name === "Skill" && typeof part.input?.skill === "string" && known.has(part.input.skill))
          aufgerufen.push(part.input.skill);
  }
  return { angeboten: [...angeboten], aufgerufen, kaputt };
}
