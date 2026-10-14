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

const own = (a: Address, slot: number, openedAt: number): boolean =>
  (a.kind === "session" || a.kind === "lane") && a.slot === slot && a.openedAt === openedAt;

// die Nachrichten dieser Besetzung, neueste zuerst (so liefert die Route); null = noch nie gelesen
export function postfachOf(slot: number, openedAt: number): Message[] | null {
  return stand ? stand.entries.filter((m) => own(m.from, slot, openedAt) || own(m.to, slot, openedAt)) : null;
}

export function postfachSummary(list: Message[], slot: number, openedAt: number): string {
  const unread = list.filter((m) => own(m.to, slot, openedAt) && m.readAt === null).length;
  return `${list.length}${unread ? ` · ${unread} ungelesen` : ""}${stand?.failed ? " · nicht aktuell" : ""}`;
}

// der Name einer Adresse und (fürs Hovern) was hinter ihm steht
function who(a: Address): { name: string; hint: string } {
  if (a.kind === "session" || a.kind === "lane") {
    const s = fleet.find((x) => x.id === a.slot);
    const name = s?.label || `Slot ${a.slot}`;
    const now = s?.openedAt === a.openedAt;
    return { name: now ? name : `${name} (frühere Besetzung)`,
      hint: `Slot ${a.slot}${now && s?.cwd ? ` · ${s.cwd}` : ""}${now ? "" : " · die Session dort ist inzwischen eine andere"}` };
  }
  if (a.kind === "program") return { name: `Program ${(a.id ?? "").slice(0, 8)}`, hint: `Program ${a.id ?? ""}` };
  const name = a.role === "orchestrator" ? "Orchestratorin" : a.role === "owner" ? "Owner" : a.role ?? a.kind;
  return { name, hint: name };
}

const clock = (ms: number): string => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
// „08:08“ heute, „gestern 08:08“, sonst „13.10. 08:08“
function when(ms: number): string {
  const d = new Date(ms);
  const day = (x: Date) => x.toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (day(d) === day(new Date())) return clock(ms);
  if (day(d) === day(yesterday)) return `gestern ${clock(ms)}`;
  return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ${clock(ms)}`;
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
// wann, darunter die erste Zeile des Textes; ein Klick klappt sie auf (Text ganz, Zitat, Lesestand). Die Kurzfassung ist die
// erste Zeile, kein Server-Text; „…“ sagt, dass mehr kommt. Was aufgeklappt ist, bleibt es über das
// Neuzeichnen (expanded, je Nachricht).
const expanded = new Set<string>();
function firstLine(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return `${lines[0] ?? ""}${lines.length > 1 ? " …" : ""}`;
}

// S9 · „[Zitat entfernt]“: die neueste Nachricht oben, die
// früheren klappen unten auf. Ein Zitat steht, wo das Original nicht direkt unter der Antwort steht.
function fillConversation(box: HTMLElement, c: Conversation, slot: number, openedAt: number): void {
  box.replaceChildren();
  const partner = who(c.with);
  const hd = el("div", "bgesprhd");
  const name = el("span", "bgesprwho", partner.name);
  name.title = partner.hint;
  name.style.setProperty("--who-h", String(hueOf(c.with, slot, openedAt)));
  hd.append("Gespräch mit ", name);
  box.appendChild(hd);
  const newest = [...c.msgs].reverse();
  const shown = unfolded.has(c.key) ? newest : newest.slice(0, SHOWN);
  const refill = () => fillConversation(box, c, slot, openedAt);
  shown.forEach((m, i) => {
    const mine = own(m.from, slot, openedAt), open = expanded.has(m.id);
    const row = el("div", `bmsg ${mine ? "mine" : "theirs"}${open ? " open" : ""}`);
    row.dataset.mid = m.id;
    row.style.setProperty("--who-h", String(hueOf(m.from, slot, openedAt)));
    const above = shown[i - 1], below = shown[i + 1];
    if (!above || keyOf(above.from) !== keyOf(m.from)) row.classList.add("first");
    const text = m.payload.text ?? "";
    const line = el("button", "bmsgline") as HTMLButtonElement;
    line.type = "button";
    line.setAttribute("aria-expanded", String(open));
    line.title = open ? "Zuklappen" : "Ganz lesen";
    const speaker = who(m.from);
    const w = el("span", "bmsgwho", speaker.name);
    w.title = speaker.hint;
    const at = el("span", "bmsgat", when(m.at));
    at.title = `${new Date(m.at).toLocaleString("de-DE")} · Nachricht ${m.id}`;
    line.append(w, at);
    if (!mine && m.readAt === null) {
      const dot = el("span", "bmsgdot");
      dot.title = "ungelesen";
      line.appendChild(dot);
    }
    line.appendChild(el("span", "bmsgfirst", firstLine(text)));
    line.onclick = () => { if (open) expanded.delete(m.id); else expanded.add(m.id); refill(); };
    row.appendChild(line);
    if (open) {
      if (m.replyTo && below?.id !== m.replyTo) {
        const orig = c.msgs.find((p) => p.id === m.replyTo);
        if (orig) {
          const re = el("button", "bmsgre", `↳ ${firstLine(orig.payload.text ?? "")}`) as HTMLButtonElement;
          re.type = "button";
          re.title = `Antwort auf die Nachricht von ${when(orig.at)} — zeigen`;
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
        } else row.appendChild(el("div", "bmsgre", "↳ Antwort auf eine ältere Nachricht"));
      }
      row.appendChild(el("div", "bmsgtx", text));
      const state = mine ? (m.readAt === null ? "noch nicht gelesen" : `gelesen ${when(m.readAt)}`) : m.readAt === null ? "ungelesen" : "";
      if (state) row.appendChild(el("div", `bmsgmeta${!mine && m.readAt === null ? " open" : ""}`, state));
    }
    box.appendChild(row);
  });
  const hidden = newest.length - shown.length;
  if (hidden) {
    const more = el("button", "bmsgmore", `${hidden} frühere ${hidden === 1 ? "Nachricht" : "Nachrichten"}`) as HTMLButtonElement;
    more.type = "button";
    more.onclick = () => { unfolded.add(c.key); refill(); };
    box.appendChild(more);
  }
}

export function postfachBody(body: HTMLElement, list: Message[], slot: number, openedAt: number): void {
  if (stand?.failed) body.appendChild(el("div", "bstate", "Das Postfach war beim letzten Lesen nicht erreichbar; gezeigt ist der Stand davor."));
  for (const c of conversations(list, slot, openedAt)) {
    const box = el("div", "bgespr");
    fillConversation(box, c, slot, openedAt);
    body.appendChild(box);
  }
}
