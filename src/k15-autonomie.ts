// K15 ENTWURF D · DIE AUTONOMIE einer Rolle (Z16, Owner 15.10. 11:4x „[Zitat entfernt]“
// ; „[Zitat entfernt]“): drei Listen aus der Rollenkarte im Plan.
// Eine Fleet-Vorlage ist nur zu lesen und lädt zur eigenen Fassung ein; in der eigenen verschiebt man Punkte zwischen „selbst“ und
// „fragt zuerst“, streicht oder ergänzt sie. Die Blocker gelten für jede Rolle gleich und bleiben. In Spalte 4 steht die Karte selbst.
import { el } from "./k15-haupt";
import { icon } from "./icons";
import type { Answer } from "./founding";
import { DU, autoAenderungen, autonomieAus, karteMit, leseFassung, punkteVon, type AutoArt, type Autonomie, type PlanRolle, type Position, type Profil, type Punkt } from "./k15-entwurf-modell";
import { antwort, gehe, lage, plural, render, wegVon, toast, type St } from "./k15-zustand";
import { geaendertTag, kennzeichen, profilHerkunft, qLeiste, qTitel } from "./k15-teile";

// null = die Rolle hat keine Karte (Nur Ordner, eigene Agent-MD)
function autonomieVon(a: Answer): Autonomie | null {
  const teil = a.sessionAgents?.parts.find((x) => x.id === "role");
  return teil?.content ? autonomieAus(teil.content, [teil.path, teil.anchor].filter(Boolean).join("#")) : null;
}
const KARTE_ID: Record<PlanRolle, string | null> = { orchestratorin: "orchestrator-card", main: "role-card", lane: "role-card", "nur-ordner": null };
const AUTO_ART: readonly { art: AutoArt; wort: string }[] = [{ art: "selbst", wort: "Entscheidet selbst" }, { art: "fragt", wort: "Fragt zuerst" }, { art: "nie", wort: "Nie" }];
// wen sie fragt, aus DEIN EMPFAENGER der Karte, im Akkusativ: „der Owner“ → „[Zitat entfernt]“, „[Zitat entfernt]“ → „[Zitat entfernt]“
const wenAkk = (wen: string | null): string => (wen ?? "").replace(/^der /, "den ").replace(/^deine /, "ihre ");

export function autonomieBlock(s: St, p: Profil, q: Position | null): HTMLElement[] {
  const l = lage(s, p, q);
  const a = l ? antwort(l.voll) : null;
  const au = a ? autonomieVon(a) : null;
  if (!au) return [];
  const eigen = p.autonomie !== null;
  const punkte = punkteVon(p, au);
  const sec = el("div", "k15sec");
  sec.append(el("span", "k15secw", "Autonomie"), ...kennzeichen(profilHerkunft(p), p.v));
  const quelle = el("button", `k15glink${s.quelle === "auto" ? " on" : ""}`);
  quelle.append(el("span", "", "Rollenkarte"), icon("chevron"));
  quelle.onclick = () => { s.quelle = "auto"; gehe(3, 3); };
  sec.append(quelle);
  const box = el("section", "k15auto");
  const aenderungen = autoAenderungen(punkte);
  const zahl = (art: AutoArt) => punkte.filter((x) => x.art === art).length;
  if (s.detail === "gruppen") {
    const z = el("button", "k15autosum");
    z.append(...AUTO_ART.flatMap((x, i) => [...(i ? [el("span", "k15autod", "·")] : []), el("span", "", `${x.wort.toLowerCase()} ${zahl(x.art)}`)]));
    if (aenderungen.length) z.append(geaendertTag(aenderungen.join("\n")));
    z.title = "Die Punkte zeigt der Detailgrad „Bausteine“; die Karte selbst steht in Spalte 4.";
    z.onclick = () => { s.quelle = "auto"; gehe(3, 3); };
    box.append(z);
    return [sec, box];
  }
  for (const { art, wort } of AUTO_ART) {
    const zl = au.zeilen[art];
    const g = el("div", `k15autog ${art}`);
    const h = el("div", "k15autoh");
    h.append(el("span", "k15auton", wort), el("span", "k15autoz", String(zahl(art))));
    const satz = art === "selbst" ? "ohne Rückfrage" : art === "fragt" ? [au.wen ? `fragt ${wenAkk(au.wen)}` : "", zl?.notiz ? leseFassung(zl.notiz) : ""].filter(Boolean).join(" · ")
      : "gilt für jede Rolle gleich";
    g.append(h, el("div", "k15autos", satz));
    const liste = el("ul", "k15autol");
    for (const pt of punkte.filter((x) => x.art === art || (x.art === "weg" && x.vorlage === art))) {
      const anders = pt.art !== pt.vorlage;
      const li = el("li", `k15autop${anders ? " anders" : ""}${pt.art === "weg" ? " weg" : ""}`);
      li.append(el("span", "k15autot", leseFassung(pt.text)));
      li.title = [anders ? (pt.vorlage === null ? "selbst ergänzt" : pt.art === "weg" ? "in deiner Fassung gestrichen" : `Vorlage: ${AUTO_ART.find((x) => x.art === pt.vorlage)?.wort ?? ""}`) : "",
        pt.vorlage !== null && leseFassung(pt.text) !== pt.text ? `Wortlaut der Karte: ${pt.text}` : ""].filter(Boolean).join("\n");
      if (eigen && art !== "nie") {
        const k = el("span", "k15autok");
        if (pt.art === "weg") {
          const zurueck = el("button", "k15link", "zurückholen");
          zurueck.onclick = () => setzePunkte(s, p, punkte.map((x) => x === pt ? { ...x, art } : x));
          k.append(zurueck);
        } else {
          const ziel: AutoArt = art === "selbst" ? "fragt" : "selbst";
          const mv = el("button", "k15autob");
          mv.title = `nach „${AUTO_ART.find((x) => x.art === ziel)?.wort}“`;
          mv.setAttribute("aria-label", `${leseFassung(pt.text)}: ${mv.title}`);
          mv.append(icon(art === "selbst" ? "down" : "up"));
          // ans Ende der Zielliste, auch in der Karte
          mv.onclick = () => setzePunkte(s, p, [...punkte.filter((x) => x !== pt), { ...pt, art: ziel }]);
          const weg = el("button", "k15autob");
          weg.title = pt.vorlage === null ? "entfernen" : "streichen";
          weg.setAttribute("aria-label", `${leseFassung(pt.text)}: ${weg.title}`);
          weg.append(icon("x"));
          weg.onclick = () => setzePunkte(s, p, pt.vorlage === null ? punkte.filter((x) => x !== pt) : punkte.map((x) => x === pt ? { ...x, art: "weg" as const } : x));
          k.append(mv, weg);
        }
        li.append(k);
      }
      liste.append(li);
    }
    g.append(liste);
    if (eigen && art !== "nie") {
      const neu = document.createElement("input");
      neu.className = "k15autoin";
      neu.type = "text";
      neu.placeholder = art === "selbst" ? "Was sie noch selbst entscheidet …" : "Wobei sie noch fragt …";
      neu.setAttribute("aria-label", `${wort}: Punkt ergänzen`);
      neu.onkeydown = (e) => {
        if (e.key !== "Enter" || !neu.value.trim()) return;
        e.preventDefault();
        setzePunkte(s, p, [...punkte, { id: `neu-${Date.now()}`, text: neu.value.trim(), art, vorlage: null }]);
      };
      g.append(neu);
    }
    box.append(g);
  }
  const fuss = el("div", "k15autof");
  if (!eigen) {
    const b = el("button", "k15ghost");
    b.append(icon("copy"), el("span", "", "Eigene Fassung machen"));
    b.onclick = () => eigeneFassung(s, p, q, au);
    fuss.append(b, el("span", "k15labs", `Probier aus, was ${p.name === "Orchestratorin" ? "sie" : `eine ${p.name}`} allein entscheiden darf. Deine Fassung bekommt eine eigene Nummer; die Vorlage bleibt.`));
  } else {
    fuss.append(el("span", "k15labs", aenderungen.length ? `${plural(aenderungen.length, "Änderung", "Änderungen")} gegenüber ${p.kopieVon ? `${p.kopieVon.name} v${p.kopieVon.v}` : "der Rollenkarte"}. Heute schickt Fleet noch die Vorlage; die eigene Fassung mitzugeben ist Schritt 4.`
      : `Noch wie ${p.kopieVon ? `${p.kopieVon.name} v${p.kopieVon.v}` : "die Rollenkarte"}. Verschieb einen Punkt mit den Pfeilen oder ergänze einen.`));
    if (aenderungen.length) {
      const z = el("button", "k15ghost", "Zurück zur Vorlage");
      z.onclick = () => setzePunkte(s, p, structuredClone(au.punkte));
      fuss.append(z);
    }
  }
  box.append(fuss);
  return [sec, box];
}
// eine eigene Fassung des Profils, mit der Autonomie zum Bearbeiten; die angeklickte Session nimmt sie, die Vorlage bleibt
function eigeneFassung(s: St, p: Profil, q: Position | null, au: Autonomie): void {
  const neu: Profil = { ...structuredClone(p), id: `${p.id}-${Date.now()}`, name: `${p.name} (Kopie)`, v: 1, autor: DU, kopieVon: { name: p.name, v: p.v },
    autonomie: structuredClone(punkteVon(p, au)) };
  s.profile = [...s.profile, neu];
  if (q) { q.profil = neu.id; s.konstNeu.add(s.k.id); } else s.sel = { art: "profil", id: neu.id };
  s.quelle = "auto";
  toast(`${neu.name} v1 ist deine eigene Fassung${q ? ` und gilt jetzt für ${q.name}` : ""}. ${p.name} v${p.v} bleibt, wie sie ist.`);
  gehe(2, 1);
}
function setzePunkte(s: St, p: Profil, punkte: Punkt[]): void {
  p.autonomie = punkte;
  s.profilNeu.add(p.id);
  s.quelle = "auto";
  render();
}

// SPALTE 4 · DIE ROLLENKARTE, wie der Start sie trägt: die drei Zeilen der Autonomie hervorgehoben; in einer eigenen Fassung so, wie sie
// mit deinen Punkten stünde (karteMit), und darunter, was die Vorlage dort sagt
export function rollenkarteAnsicht(p: Profil, a: Answer | null, ohnePlan: () => HTMLElement): HTMLElement[] {
  const au = a ? autonomieVon(a) : null;
  const kid = KARTE_ID[p.rolle];
  const kb = a && kid ? a.plan.bausteine.find((x) => x.id === kid) : undefined;
  const out = qTitel(p.autonomie ? `Rollenkarte · ${p.name}` : "Rollenkarte", p.autonomie ? p.v : null, a && kb ? `kommt ${wegVon(a, kb) || "beim Start"}` : "");
  if (au) out[out.length - 1].title = au.quelle;
  if (!a) return [...out, ohnePlan()];
  if (!au) return [...out, el("div", "k15leer", "Diese Rolle hat keine Rollenkarte. Sie arbeitet nach der AGENTS.md des Ordners und nach deiner eigenen Datei.")];
  const punkte = punkteVon(p, au);
  const alt = au.karte.split("\n");
  const geaendert = autoAenderungen(punkte);
  out.push(qLeiste(p.autonomie ? (geaendert.length ? `${plural(geaendert.length, "Änderung", "Änderungen")}. Heute schickt Fleet die Vorlage; die eigene Fassung mitzugeben ist Schritt 4.` : "Deine Fassung, noch wie die Vorlage.")
    : "Wortlaut, den die Session bekommt. Die drei hervorgehobenen Zeilen sind ihre Autonomie.", []));
  const AUTO_ZEILE = /^--- (DU ENTSCHEIDEST|DER OWNER ENTSCHEIDET|DEINE GRENZE|BLOCKER \(immer\)) --- /;
  karteMit(au, punkte).split("\n").forEach((z, i) => {
    const m = /^--- (.+?) --- (.*)$/.exec(z);
    const r = el("div", `k15kz${AUTO_ZEILE.test(z) ? " auto" : ""}${z !== alt[i] ? " anders" : ""}`);
    r.append(el("span", "k15kzk", m ? m[1] : ""), el("span", "k15kzt", m ? m[2] : z));
    if (z !== alt[i]) r.append(el("span", "k15kzv", `Vorlage: ${/^--- .+? --- (.*)$/.exec(alt[i] ?? "")?.[1] ?? alt[i] ?? ""}`));
    out.push(r);
  });
  return out;
}
