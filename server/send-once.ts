// ONE SEND, HOWEVER MANY TIMES IT IS ASKED FOR. On a bad line the answer to POST /send can get lost after the server
// typed the text, and the page has no way to tell that from a send that never arrived. So the page names each press
// (`clientId`, src/send-once.ts) and asks again under the same name: a name already here gets the answer of the first
// time, also while that one is still running, and nothing is typed twice. A send without a name is what it always was.
// Refused means nothing was typed, so that answer is not kept and the same name may try again.
//
// THE NAMES SURVIVE A RESTART, in a small file beside the server's state: a land within the two minutes a page keeps
// asking would otherwise type the message a second time, with nobody pressing. The name goes to disk BEFORE the typing,
// so a server that stopped in the middle knows it may have typed: that name answers „uncertain“, never a second typing.
// The file holds names, a hash of the text and the receipt, never the text.

import { createHash } from "node:crypto";
import { appendFileSync, chmodSync, readFileSync, renameSync, writeFileSync } from "node:fs";

// A name holds as long as a box can hold its text: the toast at two minutes, then a tunnel and a coffee, then the press
const KEEP_MS = 24 * 60 * 60_000;
const MAX_KEPT = 2_000;
export const SEND_REPEAT_HEADER = "x-fleet-send-repeat";

interface Answer { status: number; type: string; body: string }
interface Kept { at: number; hash: string; answer: Promise<Answer> | null } // null: typed by a server that has stopped
const kept = new Map<string, Kept>();
let file: string | null = null;
let linesInFile = 0;

export const validClientId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(id);

const textHash = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 16);
const keyOf = (slot: number, clientId: string): string => `${slot}:${clientId}`;

function write(row: Record<string, unknown>): void {
  if (!file) return;
  try {
    appendFileSync(file, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    linesInFile++;
  } catch { /* a full disk: the names still hold until the next restart */ }
}

// Called once at the start. What is finished comes back as it was answered; a name with no answer was being typed
export function keepSendNamesIn(path: string, now = Date.now()): void {
  file = path;
  kept.clear();
  linesInFile = 0;
  let text = "";
  try { text = readFileSync(path, "utf8"); } catch { return; }
  const rows = new Map<string, { at: number; hash: string; answer: Answer | null }>();
  for (const line of text.split("\n")) {
    if (!line) continue;
    let row: { k?: string; at?: number; h?: string; a?: Answer; gone?: true };
    try { row = JSON.parse(line) as typeof row; } catch { continue; } // a line cut by the stop: its name was not typed yet
    if (!row.k) continue;
    if (row.gone) rows.delete(row.k);
    else if (row.a) { const r = rows.get(row.k); if (r) r.answer = row.a; }
    else if (typeof row.at === "number" && typeof row.h === "string") rows.set(row.k, { at: row.at, hash: row.h, answer: null });
  }
  for (const [k, r] of rows) {
    if (now - r.at < KEEP_MS) kept.set(k, { at: r.at, hash: r.hash, answer: r.answer ? Promise.resolve(r.answer) : null });
  }
  compact(rows);
}

// The file shrinks to what still holds, so it stays small however long the server runs
function compact(rows: Map<string, { at: number; hash: string; answer: Answer | null }>): void {
  if (!file) return;
  const lines: string[] = [];
  for (const [k, r] of rows) {
    if (!kept.has(k)) continue;
    lines.push(JSON.stringify({ k, at: r.at, h: r.hash }));
    if (r.answer) lines.push(JSON.stringify({ k, a: r.answer }));
  }
  try {
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, lines.length ? `${lines.join("\n")}\n` : "", { mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, file);
    linesInFile = lines.length;
  } catch { /* the old file still reads the same */ }
}

async function compactNow(): Promise<void> {
  const rows = new Map<string, { at: number; hash: string; answer: Answer | null }>();
  for (const [k, row] of kept) rows.set(k, { at: row.at, hash: row.hash, answer: row.answer ? await row.answer : null });
  compact(rows);
}

function forget(now: number): void {
  for (const [key, row] of kept) {
    if (now - row.at < KEEP_MS && kept.size <= MAX_KEPT) break; // oldest first: a Map keeps its order
    kept.delete(key);
  }
  if (linesInFile > MAX_KEPT * 4) void compactNow();
}

const respond = (a: Answer, repeat: boolean): Response => {
  const res = new Response(a.body, { status: a.status, headers: { "content-type": a.type } });
  if (repeat) res.headers.set(SEND_REPEAT_HEADER, "1");
  return res;
};

// A name already here answers before anything else is looked at: a pin or a closed slot would say „nothing typed“
// about a message its old occupant did get. `stopped` answers a name that a stopped server was typing.
export function repeatOf(slot: number, clientId: string, text: string, stopped: () => Response): Promise<Response> | null {
  const row = kept.get(keyOf(slot, clientId));
  if (!row) return null;
  if (row.hash !== textHash(text)) return Promise.resolve(Response.json({ error: "this name belongs to another text — nothing typed" }, { status: 409 }));
  row.answer ??= (async () => {
    const res = stopped();
    const a: Answer = { status: res.status, type: res.headers.get("content-type") ?? "application/json", body: await res.text() };
    write({ k: keyOf(slot, clientId), a });
    return a;
  })();
  return row.answer.then((a) => respond(a, true));
}

// No await before `run`: the door's occupant check stays right in front of sendText's own capture
export async function sendOnce(slot: number, clientId: string, text: string, run: () => Promise<Response>, now = Date.now()): Promise<Response> {
  forget(now);
  const key = keyOf(slot, clientId);
  const hash = textHash(text);
  write({ k: key, at: now, h: hash });
  const answer = run().then(async (res): Promise<Answer> => ({ status: res.status, type: res.headers.get("content-type") ?? "application/json", body: await res.text() }));
  kept.set(key, { at: now, hash, answer });
  const drop = (): void => { kept.delete(key); write({ k: key, gone: true }); };
  void answer.then((a) => {
    if (a.status >= 400 && !answerIsUncertain(a.body)) drop();
    else write({ k: key, a });
  }, drop);
  return respond(await answer, false);
}

// „send outcome uncertain“ may have typed part of it: asking again under the same name must not type it again
function answerIsUncertain(body: string): boolean {
  try {
    return (JSON.parse(body) as { receipt?: { delivery?: string } }).receipt?.delivery === "uncertain";
  } catch { return false; }
}
