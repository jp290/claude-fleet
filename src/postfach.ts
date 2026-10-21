// Neuaufbau K13 · Owner 14.10.: „[Zitat entfernt]“
//  Das Postfach einer Session im Board:
// jede Nachricht, die sie geschrieben oder bekommen hat, mit Absender, Empfänger, Zeit und ob sie gelesen
// ist. In ihrer Pane steht davon nur die eine Hinweis-Zeile (server.ts#tickMessageNudge).
// Quelle ist GET /api/messages (Owner), gelesen, solange das Board eine Session zeigt, höchstens alle
// FRESH_MS. Das Lesen hier ist keine Quittung: quittieren kann nur die Session selbst.
// S6 · Owner 14.10.: „[Zitat entfernt]“.
// Darum je Gegenstelle ein Gespräch, wer spricht steht über seinen Nachrichten, diese Session rechts, Zeit
// deutsch. S9 (unten an fillConversation): Farbe je Sprecher, die neueste Nachricht oben.
import { api, el, fleet } from "./client";
import { icon } from "./icons";
import { popover } from "./popover";

interface Address { kind: string; slot?: number; openedAt?: number; id?: string; role?: string }
interface Message { id: string; from: Address; to: Address; at: number; payload: { text?: string };
  replyTo: string | null; readAt: number | null }

const FRESH_MS = 15_000;
// ein langes Gespräch zeigt die neuesten SHOWN, darunter ein Knopf für die früheren
const SHOWN = 10;
let stand: { at: number; entries: Message[]; failed: boolean } | null = null;
let inflight = false;
const unfolded = new Set<string>();

// liest das Postfach neu, wenn der Stand älter als FRESH_MS ist; danach zeichnet `repaint`
export function loadPostfach(repaint: () => void): void {
  if (inflight || (stand && Date.now() - stand.at < FRESH_MS)) return;
  inflight = true;
  void (async () => {
    try {
      const r = await api("/api/messages");
      const body = r.ok ? await r.json() as { entries?: Message[] } : null;
      stand = { at: Date.now(), entries: body?.entries ?? stand?.entries ?? [], failed: !body };
    } catch {
      // the board says so on the tab instead of showing an empty postfach as if nothing was written
      stand = { at: Date.now(), entries: stand?.entries ?? [], failed: true };
    } finally {
      inflight = false;
    }
    repaint();
  })();
}

// the occupant's own address, and every address it reads its Postfach under (SlotInfo.addresses): a message
// to its role or Program is its message as well, so is what it sent under that role
const own = (a: Address, slot: number, openedAt: number): boolean =>
  ((a.kind === "session" || a.kind === "lane") && a.slot === slot && a.openedAt === openedAt)
  || (fleet.find((x) => x.id === slot && x.openedAt === openedAt)?.addresses ?? []).some((b) => keyOf(b) === keyOf(a));

// die Nachrichten dieser Besetzung, neueste zuerst (so liefert die Route); null = noch nie gelesen
export function postfachOf(slot: number, openedAt: number): Message[] | null {
  return stand ? stand.entries.filter((m) => own(m.from, slot, openedAt) || own(m.to, slot, openedAt)) : null;
}

export function postfachSummary(list: Message[], slot: number, openedAt: number): string {
  const unread = list.filter((m) => own(m.to, slot, openedAt) && m.readAt === null).length;
  return `${list.length}${unread ? ` · ${unread} unread` : ""}${stand?.failed ? " · not current" : ""}`;
}

// der Name einer Adresse und (fürs Hovern) was hinter ihm steht
function who(a: Address): { name: string; hint: string } {
  if (a.kind === "session" || a.kind === "lane") {
    const s = fleet.find((x) => x.id === a.slot);
    const name = s?.label || `Slot ${a.slot}`;
    const now = s?.openedAt === a.openedAt;
    return { name: now ? name : `${name} (earlier occupant)`,
      hint: `Slot ${a.slot}${now && s?.cwd ? ` · ${s.cwd}` : ""}${now ? "" : " · the session there is a different one now"}` };
  }
  if (a.kind === "program") return { name: `Program ${(a.id ?? "").slice(0, 8)}`, hint: `Program ${a.id ?? ""}` };
  const name = a.role === "orchestrator" ? "Orchestrator" : a.role === "owner" ? "Owner" : a.role ?? a.kind;
  return { name, hint: name };
}

const clock = (ms: number): string => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
// „08:08“ heute, „yesterday 08:08“, sonst „13/10 08:08“
function when(ms: number): string {
  const d = new Date(ms);
  const day = (x: Date) => x.toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (day(d) === day(new Date())) return clock(ms);
  if (day(d) === day(yesterday)) return `yesterday ${clock(ms)}`;
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })} ${clock(ms)}`;
}

// Ein Gespräch ist alles mit derselben Gegenstelle: der Empfänger dessen, was diese Session schrieb, der
// Absender dessen, was sie bekam. Heute hat jede Nachricht genau einen Empfänger; ein späterer Gruppenchat
// wäre ein eigenes Ziel und damit hier ein eigener Schlüssel, die Sprecher stehen schon je Nachricht.
const keyOf = (a: Address): string =>
  a.kind === "session" || a.kind === "lane" ? `${a.kind}:${a.slot}:${a.openedAt}` : `${a.kind}:${a.id ?? a.role ?? ""}`;

interface Conversation { key: string; with: Address; msgs: Message[]; last: number }

function conversations(list: Message[], slot: number, openedAt: number): Conversation[] {
  const byKey = new Map<string, Conversation>();
  for (const m of [...list].sort((a, b) => a.at - b.at)) {
    const other = own(m.from, slot, openedAt) ? m.to : m.from;
    const key = keyOf(other);
    let c = byKey.get(key);
    if (!c) byKey.set(key, c = { key, with: other, msgs: [], last: m.at });
    c.msgs.push(m);
    c.last = m.at;
  }
  // das Gespräch mit der jüngsten Nachricht zuerst
  return [...byKey.values()].sort((a, b) => b.last - a.last);
}

// S9 · Owner 14.10.: „[Zitat entfernt]“
// . Diese Session spricht immer im Akzent-Blau; jede andere Adresse hat einen festen Ton
// ohne Blau, aus ihrem Schlüssel gerechnet: sie behält ihn über das Neuzeichnen und in jedem Gespräch.
// S11 · Owner 14.10. 12:1x „[Zitat entfernt]“: der Ton steht nur am Punkt vor dem
// Namen, Blase und Schrift sind grau (public/index.html, .bmsgwho::before).
const OWN_HUE = 222;
const OTHER_HUES = [160, 35, 290, 345];
function hueOf(a: Address, slot: number, openedAt: number): number {
  if (own(a, slot, openedAt)) return OWN_HUE;
  const key = keyOf(a);
  let h = 0x811c9dc5; // FNV-1a, wie src/marks.ts#projectHue
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return OTHER_HUES[(h >>> 0) % OTHER_HUES.length];
}

// S10 · Owner 14.10. 10:3x: „[Zitat entfernt]“
// 
//  Jede Nachricht ist zuerst eine Posteingangszeile: wer und
// wann, darunter die erste Zeile des Textes; ein Klick klappt sie auf (Text ganz). Die Kurzfassung ist die
// erste Zeile, kein Server-Text; „…“ sagt, dass mehr kommt. Was aufgeklappt ist, bleibt es über das
// Neuzeichnen (expanded, je Nachricht).
const expanded = new Set<string>();
function firstLine(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return `${lines[0] ?? ""}${lines.length > 1 ? " …" : ""}`;
}

// S12 · Owner 14.10. 13:2x: „[Zitat entfernt]“
//  Mit zwei und mehr
// Gegenstellen steht im Kopf statt des Namens eine Liste; darunter steht nur das gewählte Gespräch. Vorgewählt ist
// das mit der jüngsten Nachricht; die Wahl hält je Besetzung über das Neuzeichnen.
const chosen = new Map<string, string>();
const unreadIn = (c: Conversation, slot: number, openedAt: number): number =>
  c.msgs.filter((m) => own(m.to, slot, openedAt) && m.readAt === null).length;
// S12b · Owner 14.10. 20:3x: „[Zitat entfernt]“
//  Die Liste ist kein <select> mehr — dessen offene Liste malt das
// System (am Mac und am Telefon in dessen Hell/Dunkel und Akzentfarbe) —, sondern Knopf und Menü der Spalte
// (.optsw, .bpop, .bmenuitem: dieselben Tokens, am Telefon das Blatt von unten). Offen ist höchstens eine Liste
// (pickOpen, Schlüssel Slot:openedAt); eine Wahl schließt sie, Escape, ein Klick daneben und die Pfeiltasten
// gehen über die eine Popover-Registrierung der Seite (src/popover.ts, K5).
let pickOpen: string | null = null;
let pickClose: ((refocus: boolean) => void) | null = null;
popover({
  panel: () => document.querySelector<HTMLElement>("#board .bgesprpop"),
  trigger: () => document.querySelector<HTMLElement>("#board .bgesprsel.on"),
  isOpen: () => pickOpen !== null,
  close: (refocus) => pickClose?.(refocus),
  rows: () => [...document.querySelectorAll<HTMLElement>("#board .bgesprpop .bmenuitem")],
});

// S9 · „[Zitat entfernt]“: die neueste Nachricht oben, die
// früheren klappen unten auf.
// S12c · Owner 14.10. 21:0x–22:1x zu „[Zitat entfernt]“: beide Richtungen
// bleiben, aber „[Zitat entfernt]“, und „[Zitat entfernt]“
// . Was diese Session schrieb, steht
// rechts ohne Namen, nur mit der Zeit; den Namen trägt nur die Gegenseite links. Jede Antwort trägt über sich eine
// leise Zitatzeile mit dem Anfang ihres Originals, auch zugeklappt. Der Lesestand ist ein Zeichen neben der Zeit,
// die Worte stehen im title. Die Blase zeichnet nur noch das CSS beim Drüberfahren (public/index.html, .bmsg).
function fillConversation(box: HTMLElement, c: Conversation, slot: number, openedAt: number, all: Conversation[]): void {
  box.replaceChildren();
  const partner = who(c.with);
  const hd = el("div", "bgesprhd");
  const name = el("span", "bgesprwho", all.length > 1 ? "" : partner.name);
  name.title = partner.hint;
  name.style.setProperty("--who-h", String(hueOf(c.with, slot, openedAt)));
  const seat = `${slot}:${openedAt}`;
  const listOpen = all.length > 1 && pickOpen === seat;
  if (all.length > 1) {
    const unread = unreadIn(c, slot, openedAt);
    const sw = el("button", `optsw bgesprsel${listOpen ? " on" : ""}`) as HTMLButtonElement;
    sw.type = "button";
    sw.setAttribute("aria-haspopup", "listbox");
    sw.setAttribute("aria-expanded", String(listOpen));
    sw.title = "Choose a conversation";
    sw.append(el("span", "t", `${partner.name}${unread ? ` · ${unread} unread` : ""}`), icon("chevron"));
    const redraw = (next: Conversation, focus: "button" | "list" | null) => {
      fillConversation(box, next, slot, openedAt, all);
      const target = focus === "button" ? box.querySelector<HTMLElement>(".bgesprsel")
        : focus === "list" ? box.querySelector<HTMLElement>(".bgesprpop [aria-selected=\"true\"]") : null;
      target?.focus();
    };
    const close = (refocus: boolean) => { pickOpen = null; pickClose = null; redraw(c, refocus ? "button" : null); };
    sw.onclick = () => { if (listOpen) close(true); else { pickOpen = seat; redraw(c, "list"); } };
    name.appendChild(sw);
    if (listOpen) {
      pickClose = close;
      const pop = el("div", "bpop bgesprpop");
      pop.setAttribute("role", "listbox");
      pop.setAttribute("aria-label", "Conversations of this session");
      pop.append(...all.map((o) => {
        const n = unreadIn(o, slot, openedAt);
        const b = el("button", "bmenuitem") as HTMLButtonElement;
        b.type = "button";
        b.setAttribute("role", "option");
        b.setAttribute("aria-selected", String(o.key === c.key));
        b.dataset.key = o.key;
        const dot = el("span", "bgesprdot");
        dot.style.setProperty("--who-h", String(hueOf(o.with, slot, openedAt)));
        b.append(dot, el("span", "t", who(o.with).name));
        if (n) b.append(el("span", "kk", `${n} unread`));
        b.title = who(o.with).hint;
        b.onclick = () => { chosen.set(seat, o.key); pickOpen = null; pickClose = null; redraw(o, "button"); };
        return b;
      }));
      const scrim = el("div", "bpopscrim");
      scrim.onclick = () => close(true);
      hd.append("Conversation with ", name, scrim, pop);
    }
  }
  if (!listOpen) hd.append("Conversation with ", name);
  box.appendChild(hd);
  const newest = [...c.msgs].reverse();
  const shown = unfolded.has(c.key) ? newest : newest.slice(0, SHOWN);
  const refill = () => fillConversation(box, c, slot, openedAt, all);
  shown.forEach((m, i) => {
    const mine = own(m.from, slot, openedAt), open = expanded.has(m.id);
    const row = el("div", `bmsg ${mine ? "mine" : "theirs"}${open ? " open" : ""}`);
    row.dataset.mid = m.id;
    const above = shown[i - 1];
    if (!above || keyOf(above.from) !== keyOf(m.from)) row.classList.add("first");
    const text = m.payload.text ?? "";
    if (m.replyTo) {
      const orig = c.msgs.find((p) => p.id === m.replyTo);
      if (orig) {
        const re = el("button", "bmsgre", firstLine(orig.payload.text ?? "")) as HTMLButtonElement;
        re.type = "button";
        re.title = `Reply to ${own(orig.from, slot, openedAt) ? "this session" : who(orig.from).name}, ${when(orig.at)} — show it`;
        re.onclick = () => {
          unfolded.add(c.key);
          expanded.add(orig.id);
          refill();
          const target = box.querySelector<HTMLElement>(`[data-mid="${CSS.escape(orig.id)}"]`);
          target?.scrollIntoView({ block: "center" });
          target?.classList.add("flash");
          setTimeout(() => target?.classList.remove("flash"), 1200);
        };
        row.appendChild(re);
      } else row.appendChild(el("div", "bmsgre", "Reply to an older message"));
    }
    const line = el("button", "bmsgline") as HTMLButtonElement;
    line.type = "button";
    line.setAttribute("aria-expanded", String(open));
    line.title = open ? "Collapse" : "Read in full";
    const hd = el("span", "bmsghd");
    if (!mine) {
      const speaker = who(m.from);
      const w = el("span", "bmsgwho", speaker.name);
      w.title = speaker.hint;
      row.style.setProperty("--who-h", String(hueOf(m.from, slot, openedAt)));
      hd.appendChild(w);
    }
    const at = el("span", "bmsgat", when(m.at));
    at.title = `${new Date(m.at).toLocaleString("en-GB")} · message ${m.id}`;
    hd.appendChild(at);
    if (mine) {
      const seen = el("span", `bmsgread${m.readAt === null ? "" : " seen"}`);
      seen.title = m.readAt === null ? "not read yet" : `read ${when(m.readAt)}`;
      if (m.readAt !== null) seen.appendChild(icon("check"));
      hd.appendChild(seen);
    } else if (m.readAt === null) {
      const dot = el("span", "bmsgdot");
      dot.title = "unread";
      hd.appendChild(dot);
    }
    line.append(hd, el("span", "bmsgfirst", firstLine(text)));
    line.onclick = () => { if (open) expanded.delete(m.id); else expanded.add(m.id); refill(); };
    row.appendChild(line);
    if (open) row.appendChild(el("div", "bmsgtx", text));
    box.appendChild(row);
  });
  const hidden = newest.length - shown.length;
  if (hidden) {
    const more = el("button", "bmsgmore", `${hidden} earlier ${hidden === 1 ? "message" : "messages"}`) as HTMLButtonElement;
    more.type = "button";
    more.onclick = () => { unfolded.add(c.key); refill(); };
    box.appendChild(more);
  }
}

export function postfachBody(body: HTMLElement, list: Message[], slot: number, openedAt: number): void {
  if (stand?.failed) body.appendChild(el("div", "bstate", "The messages could not be reached at the last read; shown is the state before."));
  const all = conversations(list, slot, openedAt);
  const c = all.find((x) => x.key === chosen.get(`${slot}:${openedAt}`)) ?? all[0];
  if (!c) return;
  const box = el("div", "bgespr");
  fillConversation(box, c, slot, openedAt, all);
  body.appendChild(box);
}
