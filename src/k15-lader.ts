// K15 · DER LADER IM HAUPT-BUNDLE: das Fenster „Neue Session“ kommt erst beim ersten Öffnen nach, als public/k15.js (aus
// src/k15-entwurf.ts, eigene Zeile in package.json „build“) und public/k15.css. Was das Fenster vom Board braucht, legt der Lader
// vorher auf globalThis.k15Haupt (gelesen in src/k15-haupt.ts): k15.js darf client.ts nicht mitbringen, dessen oberste Ebene ein
// zweites Board starten würde.
import { api, baseName, copyText, el, fleet, showSlot, toast } from "./client";
import { OMIT_SAY, PACK_WORDS, bausteinName, partFixed, validAnswer } from "./founding";
import { agoDe } from "./board";
import { liesAndere, liesPrograms, progSagt, starte, waehlbar } from "./start-tuer";
import type { LaneAnchor } from "./protocol";

const haupt = { el, api, baseName, copyText, flotte: () => fleet, bausteinName, validAnswer, OMIT_SAY, PACK_WORDS, partFixed, agoDe,
  starte, liesPrograms, liesAndere, waehlbar, progSagt, zeigeSlot: showSlot, meldung: toast };
export type K15Haupt = typeof haupt;
// WOHER DAS FENSTER KAM: ein freier Platz in der Leiste (dort sitzt die Session), das + eines Repos (dessen Repo) oder ⎇+ an einer Session
// (dazu die Session, unter der die Lane hängt — nie der Slot allein, Slots werden neu belegt)
export type Eingang = { slot: number } | { repo: string; parent?: LaneAnchor };

type K15 = typeof import("./k15-entwurf");
let geladen: Promise<K15> | null = null;

// das Fenster und seine Ansicht „Eine Session“ (public/sitzung.css, src/sitzung.ts)
function stil(datei: string): Promise<void> {
  return new Promise((fertig, fehlt) => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = `/${datei}`;
    l.onload = () => fertig();
    l.onerror = () => { l.remove(); fehlt(new Error(datei)); };
    document.head.append(l);
  });
}

export function openK15Entwurf(eingang?: Eingang): void {
  (globalThis as unknown as { k15Haupt: K15Haupt }).k15Haupt = haupt;
  // die Adresse wird erst zur Laufzeit gebildet; ein fester Text würde der Bundler als eigenes Modul auflösen wollen
  geladen ??= Promise.all([import(new URL("/k15.js", location.href).href) as Promise<K15>, stil("k15.css"), stil("sitzung.css")]).then(([m]) => m);
  geladen.then((m) => m.openK15Entwurf(eingang), () => {
    geladen = null;
    toast("Das Fenster „Neue Session“ ließ sich nicht laden.");
  });
}
