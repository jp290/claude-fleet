// K15 · WAS DAS FENSTER VOM BOARD NIMMT: src/k15-lader.ts legt es auf globalThis.k15Haupt, bevor k15.js geladen wird. Ein direkter
// Import aus client.ts, founding.ts oder board.ts brächte den Start des Boards mit in k15.js.
import type { K15Haupt } from "./k15-lader";

const h = (globalThis as unknown as { k15Haupt: K15Haupt }).k15Haupt;
export const { el, api, baseName, copyText, flotte, bausteinName, validAnswer, OMIT_SAY, PACK_WORDS, agoDe } = h;
