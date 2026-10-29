// DIE SKILL-ORDNER, DIE FLEET SCHREIBT (Owner-Ja 22.10. zu Skills; pi-Skills 27.10. über Slot 11): eine Datei je Pack
// (`<ort>/<id>/SKILL.md`), Kopf und Text aus server/sitz-wissen.ts#renderSkillFile — für beide Harnesses derselbe Renderer.
// Zwei Orte, ein Unterschied:
// - CLAUDE CODE: ein Ordner je Belegung in Fleets Zustand (server/sitz-wissen.ts#seatSkillsDir), den der Start mit
//   `--add-dir` bekommt. Er wird bei jedem Spawn als Ganzes neu geschrieben und geht mit der Belegung.
// - PI: `skills/` im Agent-Verzeichnis, das der Adapter seinem Sitz gibt (server.ts#piAgentDirOf, PI_CODING_AGENT_DIR der
//   Zeile); pi lädt es ohne weitere Einstellung (docs/configuration.md „<agent-dir>/skills/“, docs/skills.md des
//   installierten Pakets). Diesen Ordner teilen sich alle Belegungen des Adapters und er kann eigene Skills des Owners
//   enthalten: er wird nicht ersetzt, sondern ergänzt. Ein Manifest sagt, was Fleet schrieb, und nur das wird beim
//   nächsten Spawn geräumt (docs/neuaufbau/maengel.md, Mangel 153).
import { chmodSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { logError } from "./errors";
import { packIdGueltig, piSkillsWeg } from "./sitz-wissen";

// A SEAT MAY HAVE CHANGED ITS OWN FOLDER (it runs in auto): taken a write bit away, or put a link where a folder was. lstat
// first: chmod follows a link and would loosen its target; a link or file is unlinked, never followed.
export function seatSkillsRemove(path: string): void {
  try {
    const st = lstatSync(path, { throwIfNoEntry: false });
    if (!st) return;
    if (st.isDirectory()) {
      chmodSync(path, 0o755);
      for (const name of readdirSync(path)) seatSkillsRemove(`${path}/${name}`);
      rmdirSync(path);
    } else unlinkSync(path);
  } catch (e) { logError("seat-library:remove", e); }
}
export function seatSkillsWrite(dir: string, files: readonly { pfad: string; text: string }[]): void {
  const stamp = `${process.pid}-${Date.now()}`;
  const tmp = `${dir}.tmp-${stamp}`;
  for (const file of files) {
    mkdirSync(dirname(`${tmp}/${file.pfad}`), { recursive: true });
    writeFileSync(`${tmp}/${file.pfad}`, file.text);
  }
  // the old folder steps aside first (a rename onto a non-empty folder fails); its removal comes after the new one stands,
  // and a removal that fails is logged, never the spawn's failure
  const old = lstatSync(dir, { throwIfNoEntry: false }) ? `${dir}.alt-${stamp}` : null;
  if (old) {
    if (lstatSync(dir).isDirectory()) chmodSync(dir, 0o755);
    renameSync(dir, old);
  }
  try { renameSync(tmp, dir); } catch (e) {
    seatSkillsRemove(tmp);
    throw e;
  }
  if (old) seatSkillsRemove(old);
}

/** Der Beleg, was Fleet in ein pi-Agent-Verzeichnis schrieb: `{ packs: [ids] }`. */
export const piSkillsManifest = (agentDir: string): string => `${agentDir}/fleet-skills.json`;

/** Schreibt die Skill-Dateien eines pi-Sitzes in `skills/` seines Agent-Verzeichnisses und räumt vorher, was Fleet beim
 *  letzten Spawn dort schrieb und jetzt nicht mehr dazugehört (auch: die Bibliothek ist aus, dann `files` = leer).
 *  Fremde Ordner und eigene Skills des Owners bleiben — auch einer unter dem Namen eines Packs: was Fleet nicht schrieb
 *  (nicht im alten Beleg), wird übersprungen und geloggt. Aus dem Beleg und aus den Dateien zählen nur Ids in der Form einer
 *  Pack-Id, so räumt und schreibt Fleet nie außerhalb von `<agent-dir>/skills/`. Ein Fehler wird geloggt, nie zum Scheitern
 *  des Spawns. */
export function piSkillsWrite(agentDir: string, files: readonly { pfad: string; text: string }[]): void {
  try {
    let alt: string[] = [];
    try {
      const gelesen = JSON.parse(readFileSync(piSkillsManifest(agentDir), "utf8")) as { packs?: unknown };
      alt = Array.isArray(gelesen.packs) ? gelesen.packs.filter(packIdGueltig) : [];
    } catch { /* kein Beleg da: nichts zu räumen */ }
    const eigene = new Set(alt);
    const zuSchreiben = files.filter((file) => {
      const id = basename(dirname(file.pfad));
      if (!packIdGueltig(id) || file.pfad !== `${agentDir}/skills/${id}/SKILL.md`) {
        logError("seat-library:pi-skills", new Error(`Skill-Pfad ausserhalb von skills/<id>/ übersprungen: ${id}`));
        return false;
      }
      if (!eigene.has(id) && lstatSync(`${agentDir}/skills/${id}`, { throwIfNoEntry: false })) {
        logError("seat-library:pi-skills", new Error(`Ordner skills/${id} gehört nicht Fleet: nicht überschrieben`));
        return false;
      }
      return true;
    });
    const jetzt = zuSchreiben.map((file) => basename(dirname(file.pfad)));
    for (const id of piSkillsWeg(alt, jetzt)) seatSkillsRemove(`${agentDir}/skills/${id}`);
    for (const file of zuSchreiben) {
      mkdirSync(dirname(file.pfad), { recursive: true });
      writeFileSync(`${file.pfad}.${process.pid}`, file.text);
      renameSync(`${file.pfad}.${process.pid}`, file.pfad);
    }
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(`${piSkillsManifest(agentDir)}.${process.pid}`, JSON.stringify({ packs: jetzt }));
    renameSync(`${piSkillsManifest(agentDir)}.${process.pid}`, piSkillsManifest(agentDir));
  } catch (e) { logError("seat-library:pi-skills", e); }
}
