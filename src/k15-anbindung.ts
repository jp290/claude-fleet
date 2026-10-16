// K15 · WIE VIEL FLEET MITKOMMT (Teil 3; Owner 16.10.: „[Zitat entfernt]“
// ). Eine Leiter in vier Stufen statt der Wahl zwischen drei Rollen:
// „Nur Ordner“ ist der Plan ohne Rolle; darüber der Plan der Rolle mit den Stufen des Gruppen-Reglers (src/k15-entwurf-modell.ts#reglerVon),
// diesmal über alle Gruppen: „Pflicht“ schaltet jeden freien Baustein aus, „Alles“ jeden an, den der Server für die Rolle annimmt. Die
// Leiter ist nicht streng aufsteigend: die Lane schaltet Claudes eigenes Gedächtnis ab, das „Nur Ordner“ anlässt; darum nennt jede Stufe,
// was gegenüber der darunter dazukommt und was wegfällt.
import type { Answer } from "./founding";
import { GRUPPEN, EINSTELLUNGEN_ID, reglerVon, stufenSchalter, type PlanRolle, type Schalter, type Stufe } from "./k15-entwurf-modell";
import { NATIV_ID } from "./k15-startzahl";

export type Anbindung = "ordner" | Stufe;
export const ANBINDUNGEN: readonly { id: Anbindung; wort: string; satz: string }[] = [
  { id: "ordner", wort: "Nur Ordner", satz: "Ohne Rolle: Claude Code lädt, was im Repo liegt; von Fleet kommt nur, was jeder Start trägt." },
  { id: "pflicht", wort: "Pflicht", satz: "Dazu, was Fleet braucht, um die Session in ihrer Rolle zu führen; alles Freie ist aus." },
  { id: "standard", wort: "Standard", satz: "Dazu Wissen und Gedächtnis, wie die Rolle sie von sich aus bekommt." },
  { id: "alles", wort: "Alles", satz: "Dazu jeder freie Baustein, den diese Tür für die Rolle noch liefert." },
];

export const anbindungRolle = (stufe: Anbindung, rolle: PlanRolle): PlanRolle => stufe === "ordner" ? "nur-ordner" : rolle;
// die Schalter einer Stufe, aus dem Plan der Rolle ohne Schalter; „Standard“ ist dieser Plan selbst
export function anbindungSchalter(stufe: Anbindung, voll: Answer): Schalter {
  if (stufe === "ordner" || stufe === "standard") return {};
  return GRUPPEN.reduce<Schalter>((sch, g) => ({ ...sch, ...stufenSchalter(stufe, reglerVon(voll, g.id)) }), {});
}
// was bei diesem Start ankommt, nach derselben Regel wie die Tabelle in Schritt 3 und Spalte 3: was die Tür liefert (lieferung.geliefert;
// was an ist, aber eine Karte braucht, fehlt; ohne Tür-Auskunft, was an ist) und was sie trotz „aus“ im Plan liefert
// (server.ts#planDoorVerdict); ohne die Einstellungen, die jeder Start trägt
const TROTZDEM = /^(\S+) ist im Plan \S+, diese Tuer liefert es trotzdem/;
export function ankommend(a: Answer): Set<string> {
  const geliefert = a.lieferung ? new Set(a.lieferung.geliefert.map((x) => x.id)) : null;
  const trotzdem = new Set(a.start.refusals.map((x) => TROTZDEM.exec(x)?.[1]));
  return new Set(a.plan.bausteine.filter((b) => b.id !== EINSTELLUNGEN_ID && ((geliefert ? geliefert.has(b.id) : b.zustand === "an") || trotzdem.has(b.id))).map((b) => b.id));
}
// WAS DIE TÜR NICHT EINHÄLT: ein Schalter, den dieser Start nicht einhalten kann, steht in start.refusals (server.ts#planDoorVerdict) — „<id> ist
// im Plan aus, diese Tuer liefert es trotzdem (<weg>)“ (die Lane-Tür liefert den Zustell-Kopf immer) oder „<id> ist angeschaltet, diese Tuer
// liefert es nicht: <grund>“ (den Quellcode liefert nur eine Karte). Mit ihm wäre die Stufe nicht startbar (start.startbar); `bereinigt`
// nimmt ihn heraus und sagt, warum. Der Grund bleibt im Wortlaut des Servers (k15-zustand.ts#grundWort macht ihn lesbar).
const NICHT = /^(\S+) ist angeschaltet, diese Tuer liefert es nicht: (.+)$/;
export const IMMER = "liefert diese Tür immer";
export function bereinigt(sch: Schalter, a: Answer): { schalter: Schalter; abgelehnt: { id: string; grund: string }[] } {
  const abgelehnt = a.start.refusals.flatMap((x) => {
    const t = TROTZDEM.exec(x)?.[1], n = NICHT.exec(x);
    return t && sch[t] === "aus" ? [{ id: t, grund: IMMER }] : n && sch[n[1]] === "an" ? [{ id: n[1], grund: n[2] }] : [];
  });
  const weg = new Set(abgelehnt.map((x) => x.id));
  return { schalter: Object.fromEntries(Object.entries(sch).filter(([id]) => !weg.has(id))), abgelehnt };
}
// gegenüber der Stufe darunter: was dazukommt, was wegfällt und was oben angeschaltet ist, bei diesem Start aber nicht ankommt (der
// Quellcode der Lane kommt nur mit einer Karte); in der Reihenfolge des Plans darüber bzw. darunter
export function unterschied(unten: Answer, oben: Answer): { dazu: string[]; weg: string[]; nichtJetzt: string[] } {
  const u = ankommend(unten), o = ankommend(oben);
  const untenAn = new Set(unten.plan.bausteine.filter((b) => b.zustand === "an").map((b) => b.id));
  return { dazu: [...o].filter((id) => !u.has(id)), weg: [...u].filter((id) => !o.has(id)),
    nichtJetzt: oben.plan.bausteine.filter((b) => b.id !== EINSTELLUNGEN_ID && b.zustand === "an" && !untenAn.has(b.id) && !o.has(b.id)).map((b) => b.id) };
}
// WAS FLEET DAZUGIBT, je Stufe in Tokens: Fleets Teil der Start-Summe des Servers (server.ts#startSumme) ohne die Dateien des Repos, die
// Claude Code selbst lädt. Der Server misst sie nur ohne Rolle (server.ts: nativeLoaderBytes nur bei „nur-ordner“); mit ihnen stünde
// „Nur Ordner“ über „Standard“. `offen` nennt, was Fleet liefert, aber nicht gemessen ist.
export { NATIV_ID };
export function fleetTeil(a: Answer): { tokens: number; offen: string[] } | null {
  const s = a.startSumme;
  if (!s) return null;
  const nativ = a.plan.bausteine.find((b) => b.id === NATIV_ID);
  const nativB = nativ && typeof nativ.bytes === "number" && a.lieferung?.geliefert.some((x) => x.id === NATIV_ID) ? nativ.bytes : 0;
  return { tokens: Math.round((s.fleetBytes - nativB) / s.bytesJeToken.wert), offen: s.fleetUnbekannt.filter((id) => id !== NATIV_ID) };
}
