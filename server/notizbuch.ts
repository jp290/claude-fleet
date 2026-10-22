// DAS NOTIZBUCH EINES SETUPS (docs/start/direction.md Schritt 3: „Every setup has its own notebook“). Bis hierher
// lud jede Claude-Session im Fleet-Repo denselben Projektordner (~/.claude/projects/<repo>/memory): eine Session las
// die Notizen der Orchestratorin, und niemand sah, wessen Notizbuch ein Setup hat.
//
// Ein Notizbuch gehört dem Namen, den ein Setup über eine Nachfolge behält: dem Profil, wenn die Session aus einem
// gestartet ist, sonst ihrem Sitz — der Orchestratorin oder dem Board-Branch, auf dem sie arbeitet. Nicht dem Hash:
// er ändert sich mit jeder Änderung am Setup, und ein Notizbuch, das dabei verschwindet, lehrt nichts. Nicht dem
// Slot: seine Nummer bekommt danach fremde Arbeit. Eine Lane hat keins (wie bisher): was sie lernt, geht in ihren
// Bericht. Eine freie Session oder MAIN ohne Profil und Branch behält den Projektordner und sieht ihn als geteilt:
// Fleet kennt dort kein Setup über den Ordner hinaus, und sie bekäme sonst nicht mehr, was dort schon steht.
//
// Das Notizbuch bleibt auf diesem Rechner, unter Claudes Projektordner; ein Export trägt es nie. Rein: dieses Modul
// liest und schreibt nichts. Claude Code nimmt `autoMemoryDirectory` aus jeder Settings-Ebene einschließlich
// `--settings` und `autoMemoryEnabled: false` schaltet ab (code.claude.com/docs/en/memory).
import type { ClaudeStartRole } from "./session-start";

export type NotizbuchArt = "eigen" | "geteilt" | "aus";
export interface Notizbuch {
  readonly art: NotizbuchArt;
  /** der Ordner mit MEMORY.md; null = aus */
  readonly pfad: string | null;
  /** wem es gehört, als Satzende („gehört …“) */
  readonly wem: string;
}

export interface NotizbuchFakten {
  /** die Rolle, die der Spawn kennt (session-start.ts#spawnListRole); null = Fleet setzt auf dieser Zeile nichts */
  readonly rolle: ClaudeStartRole | null;
  readonly profil: string | null;
  /** der Board-Branch, in dessen Worktree die Session sitzt; null = keiner */
  readonly branch: string | null;
  /** Claudes Ordner für dieses Repo: ~/.claude/projects/<Namensraum des Haupt-Checkouts> */
  readonly projektOrdner: string;
}

// ein Name wird ein Ordnername, umkehrbar: kein `/`, kein `..` als eigener Pfadteil, zwei Namen nie derselbe Ordner
const ordnerName = (name: string): string => encodeURIComponent(name);

export function notizbuchFuer(f: NotizbuchFakten): Notizbuch {
  if (f.rolle === "lane") return { art: "aus", pfad: null, wem: "niemandem: eine Lane schreibt, was sie lernt, in ihren Bericht" };
  const eigen = (name: string, wem: string): Notizbuch => ({ art: "eigen", pfad: `${f.projektOrdner}/notizbuecher/${name}`, wem });
  if (f.rolle && f.profil) return eigen(`profil-${ordnerName(f.profil)}`, `dem Profil „${f.profil}“`);
  if (f.rolle === "orchestrator") return eigen("orchestratorin", "dem Sitz der Orchestratorin");
  if (f.rolle && f.branch) return eigen(`branch-${ordnerName(f.branch)}`, `dem Branch ${f.branch}`);
  return { art: "geteilt", pfad: `${f.projektOrdner}/memory`,
    wem: "dem Projekt: jede Session in diesem Repo ohne eigenes Notizbuch liest und schreibt hier" };
}

/** Was der Spawn in sein `--settings` legt (server.ts#agentCmd). */
export function notizbuchSettings(n: Notizbuch): { autoMemoryDirectory: string } | { autoMemoryEnabled: false } | Record<string, never> {
  return n.art === "aus" ? { autoMemoryEnabled: false } : n.art === "eigen" && n.pfad ? { autoMemoryDirectory: n.pfad } : {};
}
