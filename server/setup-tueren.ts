// DIE SETUP-TÜREN DES SITZES (docs/start/direction.md Schritt 4, „setups in an agent's hands“; Owner 29.10.: „[Zitat entfernt]“). Eine Session mit dem Recht setup.save speichert einen
// eigenen Agenten (auch als Kopie eines anderen, die „[Zitat entfernt]“ trägt), mit setup.export exportiert sie eine Setup-Datei und
// mit setup.import importiert sie eine (Vorschau, dann Schreiben). Die Rechte vergibt nur der Owner je Sitz
// (POST /api/slots/<n>/rechte); kein Rollenbundel trägt sie (server/tuer-rechte.ts#ROLLEN_BUENDEL).
//
// DIESELBEN TÜREN WIE AM OWNER-TOR: server.ts ruft diese Funktionen nach verlangeRecht (server.ts#verlangeRecht), und jede ruft
// die Route, die auch das Owner-Tor ruft — agentenRoute fürs Speichern, setupRoute für Export und Import —, nur dass der Weg unter
// /api/self/… liegt. So sind die Datei und die Prüfungen dieselben, wer auch fragt: Der Export nimmt persönliches Wissen nur als
// leeren Platz mit (setupAusAgent verweigert eine Datei mit persönlichem Text), der Import deckelt Rechte aus der Datei
// (src/sitz.ts#rechteGedeckelt), startet nie in bypass und eine Rolle erbittet er nur zur Freigabe des Owners
// (POST /api/k15/freigabe bleibt hinter dem Owner-Tor). Ein später aus einem importierten Setup geöffneter Sitz bleibt an der
// Öffnen-Tür durch server/kind-weite.ts#kindNieWeiter gedeckelt.
import { AGENTEN_ROUTE, agentenRoute, type AgentenServer } from "./agenten";
import { SETUP_ROUTE, setupRoute, type SetupServer } from "./setup-datei";

const SELF_AGENTEN = "/api/self/agenten";
const SELF_SETUPS = "/api/self/setups";

// Den Self-Weg auf den Weg des Owner-Tors umschreiben: aus dem Pfad der Self-Tür wird der Pfad, den die Route des Owner-Tors
// liest (agentenRoute liest url.pathname ab AGENTEN_ROUTE, setupRoute ab SETUP_ROUTE). Such und Frageteile bleiben, wie sie sind.
function aufOwnerWeg(url: URL, von: string, nach: string): URL {
  const u = new URL(url.toString());
  u.pathname = `${nach}${url.pathname.slice(von.length)}`;
  return u;
}

// SPEICHERN (Recht setup.save): POST …/agenten mit dem Body, den POST /api/agenten nimmt (auch vonSlot), und
// POST …/agenten/<id>/kopie als Kopie eines bestehenden Agenten, die „derived from“ trägt (server/agenten.ts#kopie).
// An dieser Tür nennt vonSlot nur den EIGENEN Platz: eine Session speichert ihr eigenes Setup, nie das eines fremden Sitzes —
// der Body wird einmal gelesen, hier geprüft und der Route unverändert weitergereicht.
export async function selfAgentenTuer(req: Request, url: URL, q: AgentenServer, eigener: number): Promise<Response> {
  const roh = await req.text().catch(() => "");
  let vonFremd = false;
  try {
    const body = JSON.parse(roh) as { vonSlot?: unknown };
    vonFremd = body !== null && typeof body === "object" && body.vonSlot !== undefined && body.vonSlot !== eigener;
  } catch { /* unlesbarer JSON bleibt der Satz der Route selbst */ }
  if (vonFremd) return Response.json({ error: `vonSlot must be your own slot (${eigener}) at this door — another seat's setup saves through the owner's door` }, { status: 400 });
  return agentenRoute(new Request(req.url, { method: req.method, headers: req.headers, body: roh }), aufOwnerWeg(url, SELF_AGENTEN, AGENTEN_ROUTE), q);
}

// EXPORT UND IMPORT (Rechte setup.export, setup.import): GET …/setups/<id>/datei exportiert eine Setup-Datei,
// POST …/setups/import importiert eine — Vorschau ohne `schreiben: true` und Schreiben mit, beide hinter demselben Recht:
// die Vorschau ist die erste Hälfte desselben Akts, und der Owner vergibt das Recht je Sitz, nicht je Hälfte.
export async function selfSetupTuer(req: Request, url: URL, q: SetupServer): Promise<Response> {
  return setupRoute(req, aufOwnerWeg(url, SELF_SETUPS, SETUP_ROUTE), q);
}
