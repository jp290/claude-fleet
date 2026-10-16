// K15 · DER LADER IM HAUPT-BUNDLE: das Fenster „Neue Session“ kommt erst beim ersten Öffnen nach, als public/k15.js (aus
// src/k15-entwurf.ts, eigene Zeile in package.json „build“) und public/k15.css. Was das Fenster vom Board braucht, legt der Lader
// vorher auf globalThis.k15Haupt (gelesen in src/k15-haupt.ts): k15.js darf client.ts nicht mitbringen, dessen oberste Ebene ein
// zweites Board starten würde.
import { api, baseName, copyText, el, fleet, toast } from "./client";
import { OMIT_SAY, PACK_WORDS, bausteinName, validAnswer } from "./founding";
import { agoDe } from "./board";

const haupt = { el, api, baseName, copyText, flotte: () => fleet, bausteinName, validAnswer, OMIT_SAY, PACK_WORDS, agoDe };
export type K15Haupt = typeof haupt;

type K15 = typeof import("./k15-entwurf");
let geladen: Promise<K15> | null = null;

function stil(): Promise<void> {
  return new Promise((fertig, fehlt) => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "/k15.css";
    l.onload = () => fertig();
    l.onerror = () => { l.remove(); fehlt(new Error("k15.css")); };
    document.head.append(l);
  });
}

export function openK15Entwurf(): void {
  (globalThis as unknown as { k15Haupt: K15Haupt }).k15Haupt = haupt;
  // die Adresse wird erst zur Laufzeit gebildet; ein fester Text würde der Bundler als eigenes Modul auflösen wollen
  geladen ??= Promise.all([import(new URL("/k15.js", location.href).href) as Promise<K15>, stil()]).then(([m]) => m);
  geladen.then((m) => m.openK15Entwurf(), () => {
    geladen = null;
    toast("Das Fenster „Neue Session“ ließ sich nicht laden.");
  });
}
