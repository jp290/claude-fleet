// K15 · DER ORT „SYSTEMPROMPT UND WERKZEUGE“ AUFGESCHLÜSSELT (Owner 16.10. 11:3x; Form src/k15-anatomie.ts): je Gruppe eine Zeile mit
// Zählung, Größe und wer bestimmt; aufgeklappt jeder Teil mit Herkunft, Größe und Kennzeichen, aufgeklappt sein Satz und Text. Dieselben
// Gruppen stehen in „Wo es landet“ und „Rechte“ (k15-spalte4.ts), in Spalte 3 (k15-spalte3.ts) und im Title der Summe unten
// (k15-entwurf.ts#tokenSumme).
import { el, agoDe } from "./k15-haupt";
import { icon } from "./icons";
import { modelLabel } from "./modelname";
import { fmt } from "./k15-entwurf-modell";
import { S, render } from "./k15-zustand";
import { nachZahl, werTag } from "./k15-teile";
import { werBeiTeil, type Wer } from "./k15-wer";
import { anatomieVon, gruppenBytes, zaehltMit, type AnatomieGruppe, type AnatomieStand, type AnatomieTeil, type CcAnatomie } from "./k15-anatomie";

export { anatomieVon };
const STAND_WORT: Readonly<Record<AnatomieStand, string>> = { an: "an", abruf: "auf Abruf", name: "nur der Name", aus: "aus" };
const STAENDE: readonly AnatomieStand[] = ["an", "abruf", "name", "aus"];
// Bytes in Tokens mit dem Verhältnis, das an der Quelle gemessen ist (ihre erste Anfrage durch die Tokens ihrer ersten Antwort); ohne
// Quelle Fleets eigenes (session-blocks.ts#FLEET_BYTES_JE_TOKEN)
const jeToken = (an: CcAnatomie): number => an.quelle?.bytesJeToken ?? 2.1;
export const tokCc = (bytes: number, an: CcAnatomie): string => {
  const t = bytes / jeToken(an);
  return bytes <= 0 ? "" : t < 10 ? "< 10 Tok" : fmt(Math.round(t / 10) * 10);
};
export const anatomieBytes = (an: CcAnatomie): number => an.gruppen.filter(zaehltMit).reduce((n, g) => n + gruppenBytes(g).bytes, 0);
export const zaehlung = (g: AnatomieGruppe): string => STAENDE
  .map((st) => [st, g.teile.filter((t) => t.stand === st).length] as const).filter(([, n]) => n > 0).map(([st, n]) => `${n} ${STAND_WORT[st]}`).join(" · ") || "keine";
// der sichtbare Satz nennt nur die Quelle; wie gemessen und geschätzt wird, steht in quelleTitel
export function quelleSatz(an: CcAnatomie): string {
  const q = an.quelle;
  if (!q) return `Claude Codes Teil: ${an.grund ?? "noch nicht gemessen"}. Fleets Teil steht aus dem Code da.`;
  return `Gemessen am Start einer Session in ${q.ort}${q.slot !== null ? ` (Slot ${q.slot})` : ""}, Claude Code ${q.claude}, ${agoDe(Date.now() - q.seit).replace(/\.$/, "")}.`;
}
export function quelleTitel(an: CcAnatomie): string {
  const q = an.quelle;
  return [
    q ? `Quelle: ${q.rolle}${q.slot !== null ? `, Slot ${q.slot}` : ", beendet"}, ${q.ort}, Claude Code ${q.claude}${q.modell ? `, ${modelLabel(q.modell)}` : ""}.` : "",
    "Claude Codes Teil kommt aus dem Transkript dieser Session (die Anhänge vor ihrer ersten Antwort), was vom Ordner abhängt aus dem gewählten Repo, Fleets Teil aus Fleets Code für diese Rolle.",
    q?.bytesJeToken ? `Tokens geschätzt mit ${q.bytesJeToken.toLocaleString("de-DE")} Bytes je Token: die erste Anfrage dieser Session durch die Tokens ihrer ersten Antwort.` : "",
    "Die Zahl „Claude Code gemessen“ oben ist ein ganzer Start in einem leeren Ordner (session-blocks.ts#CLAUDE_CODE_MESSUNG); dazu zählen auch deine globalen Regeln und die Anhänge zu Umgebung und Datum, die hier nicht stehen.",
  ].filter(Boolean).join("\n");
}
// die Summe je Gruppe in einem Satz, für den Title der Summe unten
export const anatomieKurz = (an: CcAnatomie): string =>
  an.gruppen.filter(zaehltMit).map((g) => `${g.wort} ${tokCc(gruppenBytes(g).bytes, an) || "0 Tok"}`).join(" · ");

// wer die Gruppe bestimmt: jedes Kennzeichen, das ihre Teile tragen, das häufigere zuerst; ein Teil trägt sein eigenes nur, wenn es
// nicht das erste ist
function werDerGruppe(g: AnatomieGruppe): Wer[] {
  const n = (art: "fleet" | "claude-code") => g.teile.filter((t) => werBeiTeil(t).art === art).length;
  const arten = (["claude-code", "fleet"] as const).filter((a) => n(a) > 0).sort((a, b) => n(b) - n(a));
  return arten.map((art): Wer => ({ art, grund: `${n(art)} von ${g.teile.length}: ${art === "fleet" ? "Fleet schaltet sie über die Startzeile" : "Claude Code bringt sie mit oder lädt sie selbst"}.`,
    herleitung: art === "fleet" ? "Fleets Startzeile; je Session einstellbar erst mit einer eigenen Startzeile" : "Claude Code lädt es selbst" }));
}

function teilZeile(an: CcAnatomie, g: AnatomieGruppe, t: AnatomieTeil, gw: Wer | undefined): HTMLElement {
  const s = S;
  const key = `cc:${g.id}:${t.name}`;
  const offen = !!s?.offen.has(key);
  // Abschnitte des Systemprompts und Fleets Anhang sind Sätze, alles andere sind Namen (Werkzeug, Skill, Agent, Server)
  const prosa = g.id === "systemprompt" || g.id === "fleet";
  const box = el("div", `k15lk k15cct${prosa ? " prosa" : ""}${t.stand === "aus" ? " aus" : ""}${offen ? " open" : ""}`);
  box.dataset.cct = `${g.id}:${t.name}`;
  const r = el("button", "k15lkz");
  r.setAttribute("aria-expanded", String(offen));
  const w = werBeiTeil(t);
  const wo = [t.stand === "an" ? "" : STAND_WORT[t.stand], t.weg.startsWith("--") ? "" : t.weg].filter(Boolean).join(" · ");
  r.append(el("span", "k15lkn", t.name), el("span", "k15lkg", wo), ...(gw?.art !== w.art ? [werTag(w)] : []),
    nachZahl("k15lkt", t.stand === "aus" ? "" : t.bytes === null ? "nicht gemessen" : tokCc(t.bytes, an)));
  r.title = `${t.name}\n${t.satz}${t.stand === "aus" && t.bytes ? ` · fiele an mit ${tokCc(t.bytes, an)}` : ""}`;
  r.onclick = () => { if (!s) return; if (offen) s.offen.delete(key); else s.offen.add(key); render(); };
  box.append(r);
  if (offen) {
    const satz = el("div", "k15lkp", t.satz);
    satz.title = w.art === "fleet" ? w.herleitung : `${t.weg}`;
    box.append(satz);
    if (t.text) box.append(el("pre", "k15pre k15ccpre", t.text));
  }
  return box;
}

// die Gruppen als Baum; welche Gruppe und welcher Teil offen ist, merkt sich das Fenster (S.offen)
export function anatomieGruppen(an: CcAnatomie): HTMLElement[] {
  const s = S;
  return an.gruppen.filter((g) => g.teile.length).map((g) => {
    const key = `cc:${g.id}`;
    const offen = !!s?.offen.has(key);
    const box = el("div", `k15lk k15ccg${offen ? " open" : ""}`);
    box.dataset.cc = g.id;
    const r = el("button", "k15lkz");
    r.setAttribute("aria-expanded", String(offen));
    const gw = werDerGruppe(g);
    const { bytes, offen: ungemessen } = gruppenBytes(g);
    // Name und Größe in der Zeile, darunter die Zählung und wer bestimmt: so bricht nichts um, auch nicht am Handy
    r.append(icon("chevron"), el("span", "k15lkn", g.wort), el("span", "k15lkg", ""),
      nachZahl("k15lkt", !zaehltMit(g) ? "" : bytes ? tokCc(bytes, an) : ungemessen ? "nicht gemessen" : ""));
    r.title = `${g.satz}${zaehltMit(g) && ungemessen ? ` · ${ungemessen} Teile nicht gemessen` : ""}`;
    r.onclick = () => { if (!s) return; if (offen) s.offen.delete(key); else s.offen.add(key); render(); };
    const unter = el("div", "k15ccz");
    unter.append(el("span", "k15ccw", zaehlung(g)), ...gw.map(werTag));
    box.append(r, unter);
    if (offen) {
      box.append(el("div", "k15lkp", g.satz));
      const kids = el("div", "k15lkk");
      for (const t of g.teile) kids.append(teilZeile(an, g, t, gw[0]));
      box.append(kids);
    }
    return box;
  });
}
