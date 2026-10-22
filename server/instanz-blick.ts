// WER SCHAUT, HÄLT SIE — auch ohne offene Verbindung in dieser Sekunde. Eine Verbindung zum Port (testinstanz.sh
// verweigert `down` dann mit exit 3) sieht nur, wer GERADE verbunden ist: ein Handy-Tab im Hintergrund (iOS trennt
// den Socket) und ein Desktop-Tab zwischen zwei Verbindungsversuchen zählten nicht, und ein Takt hätte die Instanz
// beendet, in die der Owner gerade schaut (Abnahme 22.10., Pflicht 1). Deshalb notiert die Instanz selbst, wann
// zuletzt ein Browser bei ihr war (server.ts#noteInstanceLook: jede Anfrage mit dem Owner-Cookie, also jeder Poll
// des Boards), in `.testinstanz.seen` ihres Verzeichnisses; beendet wird erst nach LOOK_GRACE_MS ohne jeden Blick.
// Ohne Notiz zählt der Start der Instanz: eine frische, noch nie geöffnete, steht ebenso lange.
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

export const LOOK_GRACE_MS = 10 * 60_000;
export const SEEN_FILE = ".testinstanz.seen";

const realOf = (p: string): string => { try { return realpathSync(p); } catch { return resolve(p); } };
const msIn = (raw: string | undefined, scale: number): number | null => {
  const n = Number(raw?.trim());
  return raw !== undefined && Number.isSafeInteger(n) && n > 0 ? n * scale : null;
};

// das Verzeichnis der Instanz eines Worktrees, aus den State-Dateien unter `root` (testinstanz.sh: src=<worktree>)
export function instanceDirOf(root: string, worktree: string): string | null {
  const want = realOf(worktree);
  let names: string[];
  try { names = readdirSync(root); } catch { return null; }
  for (const n of names) {
    if (!n.startsWith("fleet-testinstanz-")) continue;
    try {
      const src = /^src=(.*)$/m.exec(readFileSync(`${root}/${n}/testinstanz.state`, "utf8"))?.[1];
      if (src && realOf(src) === want) return `${root}/${n}`;
    } catch { /* keine State-Datei: keine Instanz */ }
  }
  return null;
}

// wann zuletzt jemand schaute: die eigene Notiz der Instanz (ms), sonst ihr Start (State `started=`, s); null = unbekannt
export function lastLook(dir: string): number | null {
  let seen: string | undefined, state: string | undefined;
  try { seen = readFileSync(`${dir}/${SEEN_FILE}`, "utf8"); } catch { /* noch nie geöffnet */ }
  try { state = readFileSync(`${dir}/testinstanz.state`, "utf8"); } catch { /* ohne State kein Start */ }
  const started = msIn(state ? /^started=(.*)$/m.exec(state)?.[1] : undefined, 1000);
  const looked = msIn(seen, 1);
  return looked !== null && started !== null ? Math.max(looked, started) : looked ?? started;
}

// null = darf enden; sonst warum sie steht
export function lookHolds(last: number | null, now: number, grace = LOOK_GRACE_MS): string | null {
  if (last === null) return "unbekannt, wann zuletzt jemand in die Testinstanz schaute";
  const ago = now - last;
  if (ago < grace) return `vor ${Math.max(0, Math.floor(ago / 60_000))} min schaute jemand in die Testinstanz (Schonfrist ${grace / 60_000} min)`;
  return null;
}
