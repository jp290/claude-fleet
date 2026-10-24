// EIN KLICK ODER TAB, DER EIN FELD VERLÄSST: change feuert zwischen pointerdown und click; ein render() dazwischen ersetzt den Knopf, und
// der Klick ginge verloren (Partner 20.10.). Solange ein Zeiger gedrückt ist, zeichnet das Feld erst nach dem Klick neu, sonst nach dem
// Fokuswechsel; das Neuzeichnen hält dann das Feld, in das man gegangen ist (data-feld, start-fenster.ts#zeichneStart, k15-entwurf.ts#render)
let gedrueckt = false, danach: (() => void) | null = null;
const losgelassen = (): void => { setTimeout(() => { gedrueckt = false; const f = danach; danach = null; f?.(); }, 0); };
document.addEventListener("pointerdown", () => { gedrueckt = true; }, true);
document.addEventListener("pointerup", losgelassen, true);
document.addEventListener("pointercancel", losgelassen, true);
export const nachDemKlick = (f: () => void): void => { if (gedrueckt) danach = f; else setTimeout(f, 0); };
