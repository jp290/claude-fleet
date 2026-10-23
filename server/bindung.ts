// DIE LOKALE BINDUNG: was eine Fleet über die Rechner weiß, auf denen sie läuft, und was keine getrackte Datei trägt
// (AGENTS.md: „Tracked files carry no real hostnames, addresses, account names or tokens. Those live in the local
// binding.“). Ein Fremder klont das Repo und trägt hier seine eigenen Namen ein; der Code nennt keinen.
//
//   ~/.config/claude-fleet/namen.json  die echten Namen seiner Maschinen, je Name mit seiner Art:
//                                      { "ersetzen": [{ "name", "art", "ersatz"?, "wo"? }], "bleibt": [...] }
//                                      liest: Prüfungen, die einen Text gegen sie halten (server/aufgaben.test.ts),
//                                      und das Bereinigungsskript der Veröffentlichung (git filter-repo --replace-text)
//   .env im Haupt-Checkout             Deploy-Identität (FLEET_HOST, FLEET_ALLOWED_HOSTS, FLEET_SHARE_*, FLEET_INSTANCES,
//                                      FLEET_HELPER_WAKE_ADDR, FLEET_HELPER_MAC_*), liest: server.ts, ctl.sh, testinstanz.sh
//   git remote `hub` (FLEET_HUB_REMOTE) Nutzer und Host des Helfers, liest: das Land, ci/merge-check.ts (oder MERGE_CHECK_HOST)
//   fleet.json helperDevices           Geräte-IDs der Helfer, schreibt und liest: server.ts
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const BINDUNG_DIR = join(homedir(), ".config", "claude-fleet");

// die Namen, die nie in einer getrackten Datei stehen; ohne Datei (ein frischer Klon) keine
export function bindungsNamen(dir = BINDUNG_DIR): string[] {
  try {
    const roh: unknown = JSON.parse(readFileSync(join(dir, "namen.json"), "utf8"));
    const liste = roh !== null && typeof roh === "object" && "ersetzen" in roh && Array.isArray(roh.ersetzen) ? roh.ersetzen : [];
    return liste.map((e: unknown) => e !== null && typeof e === "object" && "name" in e ? e.name : null)
      .filter((n): n is string => typeof n === "string" && n.length >= 3);
  } catch {
    return []; // keine oder keine lesbare Datei: diese Maschine hat ihre Namen nicht eingetragen
  }
}
