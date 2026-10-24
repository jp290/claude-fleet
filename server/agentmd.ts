// DIE AGENT-MD EINES PROFILS KOMMT BEIM START AN (Harness 2.0 Schritt 2, docs/konstellation/modell.md Änderung 1: „ein Profil liegt am Server,
// und die Tür nimmt es ganz“). Das Fenster „Neue Session“ speichert eigene Profile mit ihrer Agent-MD im K15-Speicher (server/k15-speicher.ts).
// Eine Tür bekommt nur die Kennung (`profil`), liest das Profil dort und gibt seine Agent-MD der Session mit: als Block im Systemprompt jeder
// Startzeile, also auch nach einem Neustart und bei einer Nachfolgerin (Slot.agentMd, persistiert wie Slot.rechte). Nur Claude Code: der
// Block steht in dessen `--append-system-prompt`.
import { join } from "node:path";
import { SPEICHER_DATEI } from "../src/k15-speicher";

// `getippt`: kein Profil, sondern ein Purpose, den die Tür als Text bekam (`purpose`); dann ist `profil` leer und die Session behält ihr
// Notizbuch (server/notizbuch.ts zählt nur ein Profil mit Namen)
export interface AgentMd { profil: string; titel: string; text: string; sha256: string; name?: string; getippt?: true }
export const MAX_AGENTMD_BYTES = 64_000;

const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
// die Datei eines Profils (k15-entwurf-modell.ts#Quelle) als Text, wie die Session sie liest: Abschnitt für Abschnitt, Überschrift und Text
export function agentMdText(datei: unknown): { titel: string; text: string } | null {
  const d = rec(datei);
  if (!d || typeof d.titel !== "string" || !Array.isArray(d.abschnitte)) return null;
  const teile = d.abschnitte.flatMap((x: unknown) => {
    const a = rec(x);
    return a && typeof a.titel === "string" && typeof a.text === "string" ? [[a.titel, a.text].filter((t) => t.trim()).join("\n")] : [];
  });
  const text = teile.join("\n\n").trim();
  return text ? { titel: d.titel, text } : null;
}
const sha = (t: string): string => new Bun.CryptoHasher("sha256").update(t).digest("hex");

// der Body einer Tür: fehlt `profil`, startet die Session wie bisher; sonst muss es ein gespeichertes Profil mit Agent-MD sein, und der Agent
// Claude Code
export async function agentMdDerTuer(body: Record<string, unknown> | null, harness: string, dir: string):
  Promise<{ ok: true; agentMd: AgentMd | null } | { ok: false; error: string }> {
  if (body?.purpose !== undefined && body.purpose !== null) return purposeDerTuer(body.purpose, body.profil, harness);
  const id = body?.profil;
  if (id === undefined || id === null) return { ok: true, agentMd: null };
  if (typeof id !== "string" || !id || id.length > 120) return { ok: false, error: "profil must be the id of a saved profile" };
  if (harness !== "claude") return { ok: false, error: `harness ${harness} takes no profil — its Agent-MD goes into Claude Code's system prompt` };
  let gespeichert: unknown;
  try { gespeichert = await Bun.file(join(dir, SPEICHER_DATEI)).json(); } catch { return { ok: false, error: "no saved profiles to read" }; }
  const liste = rec(gespeichert)?.profile;
  const p = Array.isArray(liste) ? liste.map(rec).find((x) => x?.id === id) : undefined;
  if (!p) return { ok: false, error: `no saved profile „${id}“` };
  const md = agentMdText(p.datei);
  if (!md) return { ok: false, error: `profile „${id}“ has no Agent-MD` };
  if (new TextEncoder().encode(md.text).length > MAX_AGENTMD_BYTES) return { ok: false, error: `the Agent-MD of „${id}“ is larger than ${MAX_AGENTMD_BYTES / 1000} KB` };
  return { ok: true, agentMd: { profil: id, titel: md.titel, text: md.text, sha256: sha(md.text), ...(typeof p.name === "string" ? { name: p.name } : {}) } };
}

// EIN PURPOSE ALS TEXT AN DER TÜR (Slot 16 für den Owner, 24.10.: was das Fenster zeigt, nimmt eine Tür): `purpose` ist der Text, den die
// Session als ihren Zweck im Systemprompt liest, ohne gespeichertes Profil. Er ersetzt das Gedächtnis nicht (Prüfung Runde 7, C2).
export const PURPOSE_TITEL = "Purpose";
function purposeDerTuer(v: unknown, profil: unknown, harness: string): { ok: true; agentMd: AgentMd } | { ok: false; error: string } {
  if (profil !== undefined && profil !== null) return { ok: false, error: "purpose and profil are two purposes — send one" };
  if (typeof v !== "string" || !v.trim()) return { ok: false, error: "purpose must be a non-empty text" };
  if (harness !== "claude") return { ok: false, error: `harness ${harness} takes no purpose — it goes into Claude Code's system prompt` };
  const text = v.trim();
  if (new TextEncoder().encode(text).length > MAX_AGENTMD_BYTES) return { ok: false, error: `purpose is larger than ${MAX_AGENTMD_BYTES / 1000} KB` };
  return { ok: true, agentMd: { profil: "", titel: PURPOSE_TITEL, text, sha256: sha(text), getippt: true } };
}

// was fleet.json für einen Slot hält: nur eine lesbare Agent-MD und nur an Claude Code
export function agentMdGeladen(raw: unknown, harness: string): AgentMd | null {
  const r = rec(raw);
  if (harness !== "claude" || !r) return null;
  const { profil, titel, text, name, getippt } = r;
  if (typeof profil !== "string" || typeof titel !== "string" || typeof text !== "string" || !text) return null;
  return { profil: getippt === true ? "" : profil, titel, text, sha256: sha(text), ...(typeof name === "string" ? { name } : {}),
    ...(getippt === true ? { getippt: true as const } : {}) };
}

// der Block im Systemprompt
export const agentMdBlock = (a: AgentMd): string => a.getippt ? `PURPOSE (beim Start vom Owner geschrieben):\n${a.text}`
  : `AGENT-MD (Profil „${a.profil}“, Datei „${a.titel}“, beim Start vom Owner gesetzt):\n${a.text}`;
