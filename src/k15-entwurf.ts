// K15 · THE START WINDOW'S SHELL: the one window "New session" that every free place, the + of a repo, ⎇+ on a session and "New session" on
// the phone open (src/k15-lader.ts loads this module as public/k15.js on first open). The window itself is drawn by src/start-fenster.ts;
// this module opens the shell, reads what the window needs from the board (pinned folders, machine settings, the agents and their
// models) and hands every redraw to it. A repo-+ opens it with that repo, ⎇+ with the repo and the session the lane hangs under
// (`eingang`, src/k15-lader.ts). `#k15@<path>` opens it on a repo without a running session.
import { api } from "./k15-haupt";
import { icon } from "./icons";
import { openShell } from "./shell";
import { katalogAus } from "./k15-agent";
import { S, beimZeichnen, liesPins, repos, setzeS, type St } from "./k15-zustand";
import { menueZu } from "./k15-repo";
import type { Eingang } from "./k15-lader";
import { fensterStand0, startFlotteNeu, zeichneStart } from "./start-fenster";

// the board has read a new fleet: the window checks whether its free place still holds
export function flotteNeu(): void {
  if (S) startFlotteNeu(S);
}

export function openK15Entwurf(eingang?: Eingang): void {
  if (S) return;
  // what the window hangs on document and matchMedia it lets go of again on close
  const zu = new AbortController();
  const shell = openShell({ id: "found", title: "New session", subtitle: "", onClose: () => { zu.abort(); setzeS(null); } });
  shell.root.classList.add("k15");
  shell.root.querySelector(".shellclose")?.replaceChildren(icon("x"));
  let repo: string | null = eingang && "repo" in eingang ? eingang.repo : null;
  const pfad = location.hash.match(/^#k15(?:@(\/[^#]+))?/)?.[1];
  try { repo ??= pfad ? decodeURIComponent(pfad) : null; } catch { repo = null; }
  const s: St = { shell, repo: repo ?? repos()[0] ?? null, env: undefined, plaene: new Map(), katalog: undefined,
    pins: null, infos: new Map(), repoMenu: false, ordner: null, warnAm: 0, toastT: 0,
    eingang: eingang ?? null, sitz: fensterStand0() };
  setzeS(s);
  beimZeichnen(render);
  void liesPins(s);
  void api("/api/machine-settings").then((r) => r.ok ? r.json() : null).then((j: unknown) => {
    const liste = j && typeof j === "object" && "settings" in j && Array.isArray(j.settings) ? j.settings : null;
    const wert = (name: string): unknown => {
      const x: unknown = liste?.find((y: unknown) => !!y && typeof y === "object" && "name" in y && y.name === name);
      return x && typeof x === "object" && "value" in x ? x.value : undefined;
    };
    const m = wert("FLEET_MIGRATE_PCT"), l = wert("FLEET_LANE_MIGRATE_PCT");
    if (S !== s) return;
    s.env = typeof m === "number" && typeof l === "number" ? { migratePct: m, laneMigratePct: l } : null;
    render();
  }).catch(() => { if (S === s) { s.env = null; render(); } });
  // which agents there are and which models each takes: once per open (src/client.ts#loadHarnesses)
  void api("/api/harnesses").then((r) => r.ok ? r.json() : null).then((j: unknown) => {
    if (S !== s) return;
    s.katalog = katalogAus(j);
    render();
  }).catch(() => { if (S === s) { s.katalog = null; render(); } });
  menueZu(s, zu.signal);
  render();
}

// A PRESS IS NEVER LOST TO A REDRAW: an answer that arrives while a button is held down (the agents, a preview, a folder's git) would
// replace the node under the pointer, and the release would click nothing (e2e/k15-start.ts lost its click to the repo's agent; a hand
// loses it the same way). The redraw waits for the release, at most a second and a half.
let gedrueckt = false, aufgeschoben = false, frei: ReturnType<typeof setTimeout> | undefined;
const loslassen = (): void => {
  clearTimeout(frei);
  if (!gedrueckt) return;
  gedrueckt = false;
  if (aufgeschoben) { aufgeschoben = false; setTimeout(render); }
};
document.addEventListener("pointerdown", (e) => {
  if (e.target instanceof Node && S?.shell.root.contains(e.target)) { gedrueckt = true; clearTimeout(frei); frei = setTimeout(loslassen, 1500); }
}, true);
for (const t of ["pointerup", "pointercancel"]) document.addEventListener(t, loslassen, true);
addEventListener("blur", loslassen);

function render(): void {
  const s = S;
  if (!s) return;
  if (gedrueckt) { aufgeschoben = true; return; }
  if (!s.repo) s.repo = repos()[0] ?? null;
  s.shell.root.classList.add("k15sitz");
  s.shell.root.querySelector(".k15menu")?.remove();
  s.shell.root.querySelector(".k15repomenu")?.remove();
  zeichneStart(s);
}
