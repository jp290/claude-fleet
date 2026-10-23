// Tests für das Notizbuch je Setup (docs/start/direction.md Schritt 3: „Every setup has its own notebook“):
// jedes Setup, das Fleet startet, bekommt sein eigenes Notizbuch oder keins — den geteilten Projektordner
// nur, wo Fleet kein Setup über den Ordner hinaus kennt.
import { describe, expect, test } from "bun:test";
import { notizbuchDerTuer, notizbuchFuer, notizbuchSettings } from "./notizbuch";

const PROJ = "/home/u/.claude/projects/-repo";
const wahl = (over: Partial<Parameters<typeof notizbuchFuer>[0]> = {}) =>
  notizbuchFuer({ rolle: "generic", profil: null, branch: null, projektOrdner: PROJ, ...over });

describe("wem ein Notizbuch gehört", () => {
  test("die Orchestratorin hat ein eigenes, nicht den geteilten Projektordner", () => {
    expect(wahl({ rolle: "orchestrator" })).toEqual({ art: "eigen", pfad: `${PROJ}/notizbuecher/orchestratorin`,
      wem: "dem Sitz der Orchestratorin" });
  });

  test("ein Profil hat ein eigenes, auch auf einem Branch und auch als Orchestratorin", () => {
    expect(wahl({ profil: "pruefer" })).toMatchObject({ art: "eigen", pfad: `${PROJ}/notizbuecher/profil-pruefer` });
    expect(wahl({ profil: "pruefer", branch: "branch/x" }).pfad).toBe(`${PROJ}/notizbuecher/profil-pruefer`);
    expect(wahl({ profil: "pruefer", rolle: "orchestrator" }).pfad).toBe(`${PROJ}/notizbuecher/profil-pruefer`);
  });

  test("eine Session auf einem Board-Branch hat das Notizbuch ihres Branches", () => {
    expect(wahl({ branch: "branch/notizbuch-je-setup" })).toEqual({ art: "eigen",
      pfad: `${PROJ}/notizbuecher/branch-branch%2Fnotizbuch-je-setup`, wem: "dem Branch branch/notizbuch-je-setup" });
  });

  test("eine Lane hat keins, auch mit Profil oder Branch", () => {
    expect(wahl({ rolle: "lane", profil: "p", branch: "b" })).toEqual({ art: "aus", pfad: null,
      wem: "niemandem: eine Lane schreibt, was sie lernt, in ihren Bericht" });
  });

  test("eine freie Session und eine MAIN ohne Profil und Branch behalten den geteilten Projektordner", () => {
    expect(wahl()).toEqual({ art: "geteilt", pfad: `${PROJ}/memory`,
      wem: "dem Projekt: jede Session in diesem Repo ohne eigenes Notizbuch liest und schreibt hier" });
    expect(wahl({ rolle: "main" }).art).toBe("geteilt");
  });

  test("ein Start, dessen Rolle Fleet nicht kennt, setzt nichts und liest den Projektordner", () => {
    expect(wahl({ rolle: null, profil: "p", branch: "b" })).toMatchObject({ art: "geteilt", pfad: `${PROJ}/memory` });
  });

  // DIE WAHL AN DER TÜR (Owner 23.10. ~22:30): eine ausdrückliche Wahl geht vor dem, was Profil und Branch sonst geben
  test("die Wahl „aus“ schaltet ab, auch mit Profil oder Branch; die Wahl „branch“ geht vor dem Profil", () => {
    expect(wahl({ wahl: "aus", profil: "p", branch: "b" })).toEqual({ art: "aus", pfad: null, wem: "niemandem: beim Öffnen abgeschaltet" });
    expect(wahl({ wahl: "branch", profil: "p", branch: "b" }).pfad).toBe(`${PROJ}/notizbuecher/branch-b`);
    expect(wahl({ wahl: "branch" }).art).toBe("geteilt");
    expect(notizbuchSettings(wahl({ wahl: "aus" }))).toEqual({ autoMemoryEnabled: false });
  });

  test("die Tür nimmt nur „aus“ und „branch“; ohne Feld keine Wahl", () => {
    expect(notizbuchDerTuer(undefined)).toEqual({ ok: true, wahl: null });
    expect(notizbuchDerTuer("aus")).toEqual({ ok: true, wahl: "aus" });
    expect(notizbuchDerTuer("branch")).toEqual({ ok: true, wahl: "branch" });
    for (const falsch of ["an", true, "profil"]) expect(notizbuchDerTuer(falsch).ok).toBe(false);
  });

  test("zwei verschiedene Namen landen nie im selben Ordner", () => {
    const pfade = [wahl({ branch: "a/b" }), wahl({ branch: "a-b" }), wahl({ profil: "a/b" }), wahl({ profil: "orchestratorin" }),
      wahl({ rolle: "orchestrator" }), wahl({ branch: "../memory" })].map((n) => n.pfad);
    expect(new Set(pfade).size).toBe(pfade.length);
    for (const pfad of pfade) expect(pfad!.startsWith(`${PROJ}/notizbuecher/`) && !pfad!.slice(PROJ.length).includes("/../")).toBe(true);
  });
});

describe("was auf der Startzeile steht", () => {
  test("eigen setzt autoMemoryDirectory, aus schaltet ab, geteilt setzt nichts", () => {
    expect(notizbuchSettings(wahl({ rolle: "orchestrator" }))).toEqual({ autoMemoryDirectory: `${PROJ}/notizbuecher/orchestratorin` });
    expect(notizbuchSettings(wahl({ rolle: "lane" }))).toEqual({ autoMemoryEnabled: false });
    expect(notizbuchSettings(wahl())).toEqual({});
  });
});
