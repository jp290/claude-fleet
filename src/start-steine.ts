// DIE STEINE DES STARTS (docs/start/direction.md, Schritt 3) FÜR INFO → SETUP: Rolle, Packs, Konzepte, der leere
// Platz der Richtung, die leeren persönlichen Plätze und die Rechte — was ein Sitz von Fleet als Stein mitbekam,
// nicht als Datei seines Ordners. Gelesen wird nur die Fassung des Starts (GET /api/slots/<n>/fassung?anlass=
// laufend, src/board.ts#fassungLesen); jeder Stein wird an der QUELLE erkannt, die der Server an seinen Abschnitt
// schreibt (server.ts#fassungFuerSlot), nie am Inhalt allein — so bleibt die Ansicht einer Fassung ohne Steine
// unverändert, und eine Rollenkarte der Lane oder MAIN ist kein Stein.
//
// WAS EIN STEIN DEM AGENTEN GIBT, sagt der Stein selbst (Owner 24.10.: „[Zitat entfernt]“; docs/session-ui/setup-ansicht.md): der Pack seine eigenen Anfangszeilen (server/sitz-wissen.ts#packBlock
// trägt den ganzen Text) oder, als Skill, seine useWhen-Zeile — die die Fassung als seinen ganzen Text trägt —,
// das Konzept seine Anfangszeilen (sein `purpose` erreicht die Fassung nicht), die Rolle ihr Starttext, die Rechte
// ihre Zeile im Startbrief (server/tuer-rechte.ts#rechteZeilen). Kein Satz wird hier erfunden; wo der Stein keinen
// hergibt, sagt die Zeile in schlichten Worten, was er ist.
//
// Kein DOM: src/board.ts zeichnet Zeile und Kästchen, der Klick öffnet den ganzen Stein (src/client.ts#openSteine). Der Name
// eines Packs oder Konzepts ist der Titel seines Texts — dasselbe Wort, mit dem das Startfenster ihn nennt
// (src/start-fenster.ts, „pk?.titel ?? id“).
import type { UmfeldAbschnitt, UmfeldTeil } from "./fassung-umfeld-zeilen";
import { KORREKTUR_STEIN_KOPF } from "../server/korrektur-stein";

// die Quellen, an denen server.ts#fassungFuerSlot einen Stein setzt
const ROLLE_EIGEN_QUELLE = "server/setup-datei.ts#steineFuerAgentWahl (role stone)";
const ROLLE_DATEI_QUELLE = "Slot.sitz.rolle (role stone from fleet-setup/1)";
const RICHTUNG_QUELLE = "server/setup-datei.ts#RICHTUNG_PLATZ";
const LEER_QUELLE = "server/sitz-reise.ts#leererPlatzZeilen";
const ROLLE_PACK_QUELLE = "server/setup-datei.ts#roleStein (";
const KONZEPT_QUELLE = "server/setup-datei.ts#steineFuerAgentWahl (k-";
const DARF_QUELLE = "server/tuer-rechte.ts#rechteZeilen (Server-Rechte und Zaun)";
// die Wurzel, unter der server/sitz-reise.ts#sitzWissen die Quellen eines mitgereisten Packs nennt
const MITGEREIST_QUELLE = "mitgereist";
const KONZEPT_ID = /^k-[a-z0-9-]{1,64}$/;

export type SteinArt = "rolle" | "korrekturen" | "pack" | "konzept" | "richtung" | "platz" | "rechte";
export interface StartStein {
  readonly art: SteinArt;
  /** das Wort über der Zeile (Rolle, Richtung, leerer Platz, Rechte) oder über der Box (Pack, Konzept) */
  readonly label: string;
  /** die Kennung des Steins; null bei Richtung und Rechten, die keine haben */
  readonly id: string | null;
  /** der Name des Steins, wie das Startfenster ihn nennt: der Titel seines Texts, sonst die Kennung */
  readonly name: string;
  /** wer den Stein geschrieben hat, wie ihn die Fassung nennt; null, wo sie niemanden nennt */
  readonly autor: string | null;
  /** was der Stein dem Agenten gibt — ein Satz aus dem Stein selbst, sonst was er ist, in schlichten Worten */
  readonly satz: string;
  /** woher der Stein kommt: die quelle des Abschnitts, der ihn trägt */
  readonly quelle: string;
  /** der ganze Stein, wie die Fassung ihn trägt; der Klick zeigt ihn (board.ts#openStein) */
  readonly text: string;
}

// DER KOPF EINES PACKS (server/sitz-wissen.ts#packBlock): Kennung, in Klammern Quellen und Autor, dann der Text
const PACK_KOPF = /^--- ([a-z0-9][a-z0-9._@-]{0,85})(?: \(([^)]*)\))? ---\n([\s\S]*)$/;
// eine Skill-Zeile (server/sitz-wissen.ts#skillZeile): die useWhen-Zeile, die Claude in seiner Skill-Liste sieht
const SKILL_ZEILE = /^- ([a-z0-9][a-z0-9._@-]{0,85}): (.+)$/s;
const ROLLE_EIGEN_KOPF = /^FLEET ROLE \(([a-z0-9-]+), author: (.+?)\)\n\n([\s\S]*)$/;
const ROLLE_DATEI_KOPF = /^FLEET ROLE ([a-z0-9-]+)(?: \(author: ([^)]+)\))? — /;
const KONZEPT_KOPF = /^\+ concept (k-[a-z0-9-]{1,64}) \(author: ([^)]+)\)\n\n([\s\S]*)$/;
// die Größe eines Steins, wie das Startfenster sie schreibt (src/start-fenster.ts#KB): die Bytes, die die Fassung an seinen Abschnitt schreibt
const groesse = (a: UmfeldAbschnitt): string => {
  const b = typeof a.bytes === "number" ? a.bytes : new TextEncoder().encode(a.text ?? "").length;
  return b < 1000 ? `${b} B` : `${(b / 1000).toFixed(1)} kB`;
};
// DIE + ZEILE DER OWNER-KORREKTUREN (server/korrektur-stein.ts#korrekturStein): ihr Kopf, dann Konzept, Fassung, Autor
const KORREKTUR_REST = /^(k-[a-z0-9-]{1,64}) v(\d+) \(author: ([^)]+)\)$/;
const korrekturKopf = (zeile: string): RegExpExecArray | null =>
  zeile.startsWith(KORREKTUR_STEIN_KOPF) ? KORREKTUR_REST.exec(zeile.slice(KORREKTUR_STEIN_KOPF.length)) : null;
const RECHTE_ZEILE = /^FLEET SERVER RIGHTS \(checked at Fleet's doors\): (.+?)\. Source: role (.+) \+ (\d+) grant\(s\)\.$/;
const EIGENES_KOPF = /^(?:AGENT-MD|PURPOSE)[^\n]*:\n([\s\S]*)$/;

// der erste Absatz unter dem Titel, in den Worten des Steins — dieselbe Lesart wie der Katalog des Startfensters
// (server/sitz-wissen.ts#ersterAbsatz): ein Absatz, der keine Liste, Überschrift oder Tabelle ist und kurz bleibt
const ersterAbsatz = (koerper: string): string | null => {
  const nach = koerper.split(/^#\s+.+$/m)[1];
  const absatz = nach?.trim().split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  return absatz && !/^[#\-*|>`]/.test(absatz) && absatz.length <= 280 ? absatz : null;
};
const titel = (koerper: string, id: string): string => koerper.match(/^#\s+(.+?)\s*$/m)?.[1] ?? id;

// DER SATZ EINER ROLLE: die erste Zeile ihres Starttexts, die kein Titel ist, bis zum ersten Punkt — eine Karte
// nennt ihre Art vor dem Doppelpunkt („--- ROLE --- Lane: you carry out…“), die bleibt weg. Fett und Wine kommen
// raus, der Schlusspunkt auch; ein längerer Satz wird am Wort abgeschnitten.
const ROLLE_MARK = /^--- ROLE ---[ \t]*/;
const satzDerRolle = (start: string | null): string | null => {
  const erste = start?.replace(ROLLE_MARK, "").split("\n").map((z) => z.trim())
    .find((z) => z && !z.startsWith("#"))?.replace(/\*\*/g, "").replace(/\s+/g, " ").trim() ?? null;
  if (!erste) return null;
  const satz = /^(?:[A-Za-z][A-Za-z0-9 &'-]{0,23}:\s*)?([^.]+\.)/.exec(erste)?.[1] ?? null;
  if (!satz) return null;
  const kurz = satz.replace(/\.$/, "");
  return kurz.length <= 140 ? kurz : `${kurz.slice(0, 139).replace(/\s+\S*$/, "")}…`;
};

/** Die Steine, mit denen dieser Sitz startete, in der Ordnung der Ansicht: Rolle, Korrekturen, Packs, Konzepte, Richtung, leere Plätze, Rechte. Eine Fassung ohne Steine ergibt []. */
export function startSteine(teile: readonly UmfeldTeil[]): StartStein[] {
  const alle = teile.flatMap((t) => t.abschnitte);
  const mit = (id: string): readonly UmfeldAbschnitt[] => alle.filter((a) => a.id === id);
  const packs: StartStein[] = [], konzepte: StartStein[] = [], platz: StartStein[] = [];
  let rolle: StartStein | null = null, richtung: StartStein | null = null, rechte: StartStein | null = null, korrekturen: StartStein | null = null;
  let rolleBewilligt = false;

  const richtungStein = (quelle: string, text: string): StartStein => ({ art: "richtung", label: "Direction", id: null,
    name: "the direction", autor: null, satz: "empty place: yours to fill", quelle, text });
  const konzeptStein = (id: string, autor: string | null, koerper: string, quelle: string, text: string): StartStein =>
    ({ art: "konzept", label: "Concept", id, name: titel(koerper, id), autor, satz: ersterAbsatz(koerper) ?? "a concept", quelle, text });
  const packStein = (a: UmfeldAbschnitt, id: string, autor: string | null, koerper: string): StartStein =>
    ({ art: "pack", label: "Context pack", id, name: titel(koerper, id),
      // ein Pack aus Fleets Rollenstein kam von Fleet; einen mitgereisten nennt nur seine Datei
      autor: autor ?? (a.quelle?.startsWith(ROLLE_PACK_QUELLE) ? "Fleet" : null),
      satz: ersterAbsatz(koerper) ?? "a context pack", quelle: a.quelle ?? "", text: a.text ?? "" });

  // DIE ROLLE: ein eigener Agent trägt seinen Rollenstein ganz (Starttext, Rechte, Konzepte), ein importierter
  // Sitz nur den Verweis — sein Starttext reist unter „eigenes“ (server/agentmd.ts#agentMdBlock).
  const eigenes = mit("eigenes").find((a) => a.text && EIGENES_KOPF.test(a.text))?.text ?? null;
  for (const a of mit("rolle")) {
    if (!a.text) continue;
    if (a.quelle === ROLLE_EIGEN_QUELLE) {
      const m = ROLLE_EIGEN_KOPF.exec(a.text);
      if (!m) continue;
      const [, id, autor, rest] = m;
      // der Kopf wird hier abgetrennt und unten wieder vorgesetzt, damit der Block dem KONZEPT_KOPF entspricht
      const ohneKonzepte = rest.split(/\n\n\+ concept /);
      const start = ohneKonzepte[0]!.split(/\n\nROLE RIGHTS /)[0]!.trim();
      rolleBewilligt ||= /^ROLE RIGHTS \(step 2 bundle, granted to this seat\)/m.test(ohneKonzepte[0]!);
      rolle = { art: "rolle", label: "Role", id, name: autor, autor,
        satz: satzDerRolle(start) ?? `role ${id}`, quelle: a.quelle!, text: a.text };
      for (const block of ohneKonzepte.slice(1)) {
        const k = KONZEPT_KOPF.exec(`+ concept ${block}`);
        if (k) konzepte.push(konzeptStein(k[1]!, k[2]!, k[3]!, a.quelle!, k[0]!));
      }
    } else if (a.quelle === ROLLE_DATEI_QUELLE) {
      const m = ROLLE_DATEI_KOPF.exec(a.text);
      if (!m) continue;
      const [, id, autor] = m;
      // nur die Freigabe des Owners hier ist ein Recht des Starts — „[Zitat entfernt]“ (server.ts#fassungSitzRolle);
      // was die Datei nur erbittet, startet ohne, und Zusagen aus dem Lauf sind kein Stein des Starts
      rolleBewilligt ||= /^ROLE RIGHTS \(step 2 bundle, confirmed by this Fleet's owner/m.test(a.text);
      const start = EIGENES_KOPF.exec(eigenes ?? "")?.[1]?.trim() ?? null;
      rolle = { art: "rolle", label: "Role", id, name: autor ?? id, autor: autor ?? null,
        satz: satzDerRolle(start) ?? `role ${id}`, quelle: a.quelle!, text: a.text };
    }
  }

  // DER LEERE PLATZ DER RICHTUNG, wo ihn die Fassung als eigenen Abschnitt trägt (eigener Agent mit Rolle)
  for (const a of mit("richtung"))
    if (a.quelle === RICHTUNG_QUELLE && a.text?.startsWith("DIRECTION")) richtung ??= richtungStein(a.quelle, a.text);

  // WISSEN: die Packs des Rollensteins, die mitgereisten Packs und Konzepte eines importierten Sitzes und seine
  // leeren persönlichen Plätze. Fleets Bibliothek eines schlichten Sitzes steht nicht darunter: ihre Quellen sind
  // Pfade des eigenen Baums, und ein Konzept ohne Rolle trägt seine eigene Quelle.
  for (const a of mit("wissen")) {
    if (a.quelle === LEER_QUELLE && a.text) {
      for (const zeile of a.text.split("\n")) {
        const p = /^EMPTY PLACE ([a-z0-9][a-z0-9._-]{0,85}) — /.exec(zeile);
        if (p) platz.push({ art: "platz", label: "Empty place", id: p[1]!, name: p[1]!, autor: null,
          satz: `${p[1]}: yours to fill`, quelle: a.quelle!, text: zeile });
        else if (zeile.startsWith("DIRECTION")) richtung ??= richtungStein(a.quelle!, zeile);
      }
      continue;
    }
    if (a.quelle?.startsWith(KONZEPT_QUELLE)) {
      const k = a.text ? KONZEPT_KOPF.exec(a.text) : null;
      if (k) konzepte.push(konzeptStein(k[1]!, k[2]!, k[3]!, a.quelle, k[0]!));
      continue;
    }
    // Quelle „mitgereist/…“ (auch in der Skill-Zeile, die den Ordner davor nennt) oder ohne Quelle: ein
    // mitgereistes Konzept reist ohne Quellen als Pack (server/setup-datei.ts#sitzAusSetup)
    if (a.quelle && (a.quelle.includes(MITGEREIST_QUELLE) || a.quelle === "" || a.quelle.startsWith(ROLLE_PACK_QUELLE))) {
      const s = a.text ? SKILL_ZEILE.exec(a.text) : null;
      if (s) packs.push({ ...packStein(a, s[1]!, null, ""), satz: s[2]!, name: s[1]!, text: a.text! });
      else {
        const p = a.text ? PACK_KOPF.exec(a.text) : null;
        if (p) {
          const autorTeil = p[2]?.split(" · ").find((x) => x.startsWith("author: "));
          if (KONZEPT_ID.test(p[1]!)) konzepte.push(konzeptStein(p[1]!, autorTeil?.slice(8) ?? null, p[3]!, a.quelle, a.text!));
          else packs.push(packStein(a, p[1]!, autorTeil?.slice(8) ?? null, p[3]!));
        }
      }
    }
  }

  // DIE KORREKTUREN DES OWNERS: ein Sitz ohne Rolle in Fleets Repo trägt sie als eigenen Stein (server.ts#fassungKorrekturZeiger);
  // der Zeiger, der an seiner Stelle steht, wenn die Tür abweist, ist kein Stein
  for (const a of mit("korrekturen")) {
    const k = a.text ? korrekturKopf(a.text.split("\n")[0]!) : null;
    if (!k) continue;
    // je Eintrag eine Zeile, die mit seiner Id in Klammern endet
    const n = a.text!.split("\n").filter((z) => /^- .+ \[[a-z0-9][a-z0-9-]*\]$/.test(z)).length;
    korrekturen ??= { art: "korrekturen", label: "Your corrections", id: k[1]!, name: `your corrections v${k[2]}`, autor: k[3]!,
      satz: `${n === 1 ? "1 of your decisions, with its id" : `${n} of your decisions, each with its id`} · ${groesse(a)}`, quelle: a.quelle ?? "", text: a.text! };
  }

  // DIE RECHTE: die Zeile des Startbriefs nennt jedes wirksame Recht mit seiner Bedeutung und seine Herkunft
  // (Rollenbundel ∪ Zusagen). Eine Zeile zeigt nur, was der Sitz ALS STEIN DES STARTS mitbekam — die Freigabe eines
  // Rollensteins, die der Text selbst sagt („granted to this seat“ / „confirmed … the seat starts with them“).
  // Zusagen aus dem Lauf (POST /api/slots/<n>/rechte) stehen in derselben Zahl und sind kein Start: die Zeile bliebe sonst
  // eine über den Start.
  const darf = mit("darf").find((a) => a.quelle === DARF_QUELLE);
  const r = darf?.text ? RECHTE_ZEILE.exec(darf.text.split("\n")[0]!) : null;
  if (r && rolleBewilligt) {
    const bedeutungen = r[1] === "none" ? [] : r[1]!.split("; ").map((t) => t.split(" — ")[1] ?? t);
    rechte = { art: "rechte", label: "Rights", id: null, name: "Fleet's server rights", autor: null,
      satz: bedeutungen.length ? `may ${bedeutungen.join("; ")}` : "no right beyond its role",
      quelle: DARF_QUELLE, text: darf!.text! };
  }

  // DIE ORDNERUNG DER ANSICHT: Rolle, Packs, Konzepte, Richtung, leere Plätze, Rechte (Mockup des Owners, 29.10.); seine Korrekturen gleich nach der Rolle
  return [rolle, korrekturen, ...packs, ...konzepte, richtung, ...platz, rechte].filter((s): s is StartStein => s !== null);
}
