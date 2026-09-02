import { readdir } from "node:fs/promises";
import { statSync } from "node:fs";
import { createHash } from "node:crypto";

// How many folder names one listing serves. The number is unchanged; what is new is that the
// payload SAYS when it bit — `total` and `capped` are what let the tree draw "200 of 1284 — refine"
// instead of quietly presenting a truncated directory as the whole directory.
export const DIRS_CAP = 200;
// what a search from a root is allowed to cost. Every one of these is reported through `truncated`
// rather than silently applied, for the same reason.
export const FIND_MAX_DEPTH = 6;    // levels below the root
export const FIND_MAX_VISIT = 4000; // directories read
export const FIND_MAX_HITS = 200;   // matches returned
// A COUNT OF DIRECTORIES IS NOT A BOUND ON TIME, and this is not theoretical: measured on this
// machine, 119 of the 120 folders in the home directory answer readdir in under 10ms and ~/Desktop
// — an iCloud-synced folder — does not answer within 8 SECONDS, reproducibly. A visit cap cannot
// bound that, because the cost is not in the number of reads. So one read races a short timeout and
// the walk as a whole races a deadline; a search is a keystroke away from the next one and has to
// come back on a human scale or not at all.
export const FIND_MAX_MS = 2500;    // wall clock for the whole walk
const FIND_DIR_MS = 400;     // one directory's readdir
export const FIND_FANOUT = 32;      // directories read at once — the deadline buys far more ground in parallel
// A read that times out is not cancelled, only abandoned: it goes on occupying the filesystem thread
// pool, and the next search queues behind it. Measured: a full walk of this home directory abandons
// 4 reads, and back-to-back walks that abandon many more make the FOLLOWING search time out on its
// own root — 0 hits, one directory visited. So the tail a search may leave behind is bounded too,
// well above what a healthy walk needs.
export const FIND_MAX_SLOW = 8;

// Folders that did not answer in time, and when. A timed-out read is not CANCELLED, only abandoned:
// it goes on occupying libuv's filesystem thread pool — four threads, shared with everything else
// this server does — so abandoning reads is the expensive part, not waiting for them. Measured: five
// home searches in a row abandoned 100+ reads and every search after them timed out on its own root
// (0 hits, one directory visited), and the picker stayed that way. Remembering the offenders means
// the SECOND search does not pay for them at all. The entry expires, because "slow" can also mean
// "the machine was busy for a moment", and a permanent verdict on that would quietly blind the
// search to a real folder forever.
export const findSlow = new Map<string, number>();
const FIND_SLOW_TTL_MS = 5 * 60_000;
export function knownSlow(dir: string): boolean {
  const at = findSlow.get(dir);
  if (at === undefined) return false;
  if (Date.now() - at < FIND_SLOW_TTL_MS) return true;
  findSlow.delete(dir);
  return false;
}

// null = unreadable (permissions, or it vanished). "slow" = it did not answer in time, which is a
// different fact and one the caller must report rather than treat as an empty folder.
export async function readdirSoon(dir: string) {
  return await Promise.race([
    readdir(dir, { withFileTypes: true }).catch(() => null),
    new Promise<"slow">((r) => setTimeout(() => r("slow"), FIND_DIR_MS)),
  ]);
}

// one statSync probe classifies a folder: .git-as-dir = a real repo (badge it, you can start a lane
// here); .git-as-file = a git worktree (a lane already — the picker's "hide worktrees" toggle
// filters these). Same syscall budget as a plain existsSync.
export function gitKind(path: string): { repo: boolean; wt: boolean } {
  try { return { repo: true, wt: statSync(`${path}/.git`).isFile() }; }
  catch { return { repo: false, wt: false }; }
}

// the subfolders of one directory, sorted. `hidden` is the picker's dotfolder toggle: .claude and
// .github are real places to open a session in, and the filter that hid them was unconditional.
export async function subdirNames(dir: string, hidden: boolean): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && (hidden || !e.name.startsWith(".")))
    .filter((e) => { try { return statSync(`${dir}/${e.name}`).isDirectory(); } catch { return false; } })
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

export interface DirEntry { name: string; dir: boolean }
// The detail pane and the folder tree describe the SAME directory, side by side, and stopped at
// different places: the tree listed up to DIRS_CAP (200) while this pane stopped at 40, so the
// right-hand surface contradicted its own neighbour about what is in there. Owner-observed
// 2026-08-04, on a home directory of 153 folders: "auf der grossen Fläche rechts werden nicht alle
// Ordner angezeigt". Tied to DIRS_CAP rather than re-typed, so the two cannot drift apart again.
// The cap itself stays — with entryTotal it is a stated one — and folders sort before files, so
// what a cap removes is always files first.
const DIRINFO_ENTRIES = DIRS_CAP;
export const DIRINFO_COMMITS = 5;
// what one file's body is allowed to be. The cap is on the SERVED text, and `truncated` says so —
// a viewer that silently shows the first half of a file is worse than one that refuses.
export const FILE_CAP = 512 * 1024;
export function fileBody(text: string): { text: string; binary: boolean; truncated: boolean } {
  // a NUL anywhere in the first 8 KB is the practical binary test (git uses the same idea). Decoding
  // a PNG as UTF-8 produces replacement characters, not an error, so "did it decode" proves nothing.
  if (text.slice(0, 8192).includes("\u0000")) return { text: "", binary: true, truncated: false };
  return text.length > FILE_CAP
    ? { text: text.slice(0, FILE_CAP), binary: false, truncated: true }
    : { text, binary: false, truncated: false };
}
// Whether this file may be EDITED, decided where the bytes are rather than in the client. Three
// files must never reach a textarea, and each for a reason only the reader of the bytes knows:
//   · binary — there is no text to edit, and the viewer already says so
//   · truncated — the client holds the first FILE_CAP of it, and saving that back would delete the
//     tail. This is the one failure mode an editor bolted onto a capped viewer creates for free.
//   · not byte-identical when re-encoded — a latin-1 line inside an otherwise clean source file
//     decodes to replacement characters, and saving would rewrite bytes the viewer had to guess at
// `hash` is the whole conflict story and is ABSENT in exactly those three cases: the client offers
// ✎ if and only if the server sent one, so "is this editable" is never a client-side opinion. It
// is over the bytes ON DISK, so an agent writing the same file in the same lane invalidates it.
export function editability(bytes: Uint8Array, text: string, body: { binary: boolean; truncated: boolean }):
  { hash?: string; noEdit?: string } {
  if (body.binary) return {};
  if (body.truncated) return { noEdit: "longer than the viewer serves — editing here would save only the part you can see" };
  if (Buffer.compare(Buffer.from(text, "utf8"), Buffer.from(bytes)) !== 0)
    return { noEdit: "not valid UTF-8 — saving it back would rewrite bytes this viewer had to guess at" };
  return { hash: createHash("sha256").update(bytes).digest("hex") };
}
// How many tracked paths the explorer tree serves. `git ls-files` on this repo returns ~130; the
// cap is for the checkout that is two orders larger, and `capped` says so rather than pretending
// the tree is the repo.
export const TREE_CAP = 4000;
// Never editable through the board, wherever in the tree they sit. The first two hold this
// server's own secrets — .env is where the deploy identity lives and fleet.json holds the owner
// token, every share secret and every lane's scoped credential — and .git is the repository's
// integrity, which is not text a textarea should be able to touch. Matched against the path
// RELATIVE to the working directory, so it cannot be sidestepped by depth.
export const FILE_WRITE_DENY = /(^|\/)(\.env(\.[^/]*)?|fleet\.json|\.git)(\/|$)/;

// What the folder CONTAINS — the question "which of these two checkouts is it" is answered by the
// files, not by the branch name. Returns null rather than an empty list when the directory cannot be
// read: "nothing is in here" and "I was not allowed to look" are different facts and the pane says so.
export async function dirEntries(path: string): Promise<{ entries: DirEntry[]; entryTotal: number; hidden: number } | null> {
  let all;
  try {
    all = await readdir(path, { withFileTypes: true });
  } catch {
    return null;
  }
  const hidden = all.filter((e) => e.name.startsWith(".")).length;
  const rows: DirEntry[] = all.filter((e) => !e.name.startsWith(".")).map((e) => {
    // a symlink to a directory is a directory here: the picker's tree treats it as one (listDirs
    // resolves it the same way), and the two views must not disagree about what a name is
    let dir = e.isDirectory();
    if (!dir && e.isSymbolicLink()) {
      try { dir = statSync(`${path}/${e.name}`).isDirectory(); } catch { dir = false; }
    }
    return { name: e.name, dir };
  }).sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
  return { entries: rows.slice(0, DIRINFO_ENTRIES), entryTotal: rows.length, hidden };
}
