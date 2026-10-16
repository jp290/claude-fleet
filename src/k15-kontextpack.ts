// K15 · EIN KONTEXTPACK ALS ENTWURF (Owner 16.10. 00:5x: „[Zitat entfernt]“
// ). Fehlt einer Session ein Thema, legt man einen Pack an: Name, Text und je Rolle, ob er als Text
// mitgeht, nur als Hinweis auf Abruf oder gar nicht. Das sind die Orte eines Pack-Teils in .fleet/context-packs.json
// (context-packs.ts#ContextPartPositions: box, ausleihe), je Lane, MAIN und Orchestratorin. Ein Pack kommt wie jeder andere in den
// Lesehinweisen (context-anchors, server.ts#renderContextAnchorBlock) an; wohin die bei einer Rolle gehen, sagt ihr Plan.
// Eine Route, die einen Pack anlegt, gibt es nicht (POST /api/self/program-context-packs schreibt nur die MAIN eines Programs, und nur
// Verweise auf Dateien im Repo). Der Pack bleibt deshalb ein Entwurf im Browser und reist im Export mit. Dieses Modul hat kein DOM.
import type { Answer } from "./founding";
import type { PlanRolle } from "./k15-entwurf-modell";
import { bytesVon } from "./k15-wortlaut";

export type PackRolle = "lane" | "main" | "orchestratorin";
export const PACK_ROLLEN: readonly { id: PackRolle; wort: string }[] = [{ id: "lane", wort: "Lane" }, { id: "main", wort: "MAIN" }, { id: "orchestratorin", wort: "Orchestratorin" }];
export type PackOrt = "text" | "abruf" | "nicht";
export const PACK_ORTE: readonly { id: PackOrt; wort: string; satz: string }[] = [
  { id: "text", wort: "Als Text", satz: "der Text steht in ihren Lesehinweisen" },
  { id: "abruf", wort: "Auf Abruf", satz: "nur ein Hinweis steht dort; den Text liest sie bei Bedarf" },
  { id: "nicht", wort: "Nicht", satz: "diese Rolle bekommt ihn nicht" },
];
export interface PackEntwurf { id: string; name: string; text: string; orte: Record<PackRolle, PackOrt>; v: number; am: number; autor: string }
export const LESEHINWEISE = "context-anchors";

export const istPackRolle = (r: PlanRolle): r is PackRolle => r !== "nur-ordner";
// ein neuer Entwurf geht als Text an die Rolle der gewählten Session, an keine andere
export function neuerPack(rolle: PlanRolle, autor: string, jetzt: number): PackEntwurf {
  const orte: Record<PackRolle, PackOrt> = { lane: "nicht", main: "nicht", orchestratorin: "nicht" };
  return { id: `pk${jetzt}`, name: "", text: "", orte: istPackRolle(rolle) ? { ...orte, [rolle]: "text" } : orte, v: 0, am: jetzt, autor };
}

// WO DER ENTWURF BEI EINER ROLLE LANDET: in den Lesehinweisen, und die gehen dorthin, wohin der Plan dieser Rolle sie liefert
// (Lane: Session-Datei; MAIN und Orchestratorin: erste Nachricht). Sind die Lesehinweise aus, kommt auch der Pack nicht an. Sind sie an
// und fehlen nur, weil kein Pack an ist, brächte der Pack sie mit (server.ts#planDoorRow: `packsOn ? { folgt: "Prompt" }`).
export type PackLandung = { art: "mit"; ort: "text" | "abruf"; weg: string } | { art: "nicht"; grund: string };
export function packLandung(pk: PackEntwurf, rolle: PlanRolle, a: Answer | null): PackLandung {
  if (!istPackRolle(rolle)) return { art: "nicht", grund: "Eine Session ohne Rolle bekommt keine Lesehinweise, also auch keinen Pack." };
  const ort = pk.orte[rolle];
  if (ort === "nicht") return { art: "nicht", grund: "Für diese Rolle nicht gewählt." };
  if (!a) return { art: "nicht", grund: "Der Plan dieser Session wird gelesen." };
  const lh = a.plan.bausteine.find((b) => b.id === LESEHINWEISE);
  const leer = a.lieferung?.ausgelassen.some((x) => x.id === LESEHINWEISE && x.grund === "kein Pack ist an");
  const weg = a.lieferung?.geliefert.find((x) => x.id === LESEHINWEISE)?.weg ?? (leer ? (rolle === "lane" ? "Session-Datei" : "Prompt") : undefined);
  if (!lh || lh.zustand !== "an" || !weg) return { art: "nicht", grund: "Die Lesehinweise sind bei dieser Session aus; ein Pack käme nur mit ihnen." };
  return { art: "mit", ort, weg };
}
// was er beim Start mitbrächte: als Text der Text selbst mit Überschrift, auf Abruf nur die Zeile mit seinem Namen
export const packBytes = (pk: PackEntwurf, ort: "text" | "abruf"): number =>
  ort === "text" ? bytesVon(`### ${pk.name}\n\n${pk.text}`) : bytesVon(`- ${pk.name}: auf Abruf`);

// ein Entwurf ist sicherbar, wenn er einen Namen und Text hat und mindestens eine Rolle bekommt ihn
export function packFehler(pk: Pick<PackEntwurf, "name" | "text" | "orte">): string | null {
  if (!pk.name.trim()) return "Gib dem Pack einen Namen.";
  if (!pk.text.trim()) return "Schreib, was im Pack stehen soll.";
  if (PACK_ROLLEN.every((r) => pk.orte[r.id] === "nicht")) return "Wähl mindestens eine Rolle, die ihn bekommt.";
  return null;
}

// EXPORT UND IMPORT: wie die eigenen Fassungen nur im vollständigen Export, mit Text
export const packsExport = (liste: readonly PackEntwurf[]): object[] =>
  liste.map((p) => ({ id: p.id, name: p.name, version: p.v, autor: p.autor, orte: p.orte, text: p.text }));
const str = (v: unknown, max: number): string | null => typeof v === "string" ? v.slice(0, max) : null;
const ortVon = (v: unknown): PackOrt => v === "text" || v === "abruf" ? v : "nicht";
// liest, was ein Export trägt; was nicht passt, fällt einzeln heraus
export function packsImport(liste: unknown, jetzt: number): { packs: PackEntwurf[]; verworfen: number } {
  const packs: PackEntwurf[] = [];
  let verworfen = 0;
  for (const [i, x] of (Array.isArray(liste) ? liste : []).entries()) {
    const r: Record<string, unknown> = x && typeof x === "object" ? { ...x } : {};
    const o: Record<string, unknown> = r.orte && typeof r.orte === "object" ? { ...r.orte } : {};
    const pk: PackEntwurf = { id: str(r.id, 60) ?? `pk${jetzt}-${i}`, name: str(r.name, 80)?.trim() ?? "", text: str(r.text, 200_000) ?? "",
      orte: { lane: ortVon(o.lane), main: ortVon(o.main), orchestratorin: ortVon(o.orchestratorin) },
      v: typeof r.version === "number" && r.version >= 1 ? Math.floor(r.version) : 1, am: jetzt, autor: str(r.autor, 40) ?? "?" };
    if (packFehler(pk)) { verworfen++; continue; }
    packs.push(pk);
  }
  return { packs, verworfen };
}
