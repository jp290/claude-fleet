// K15 · DER AGENT EINER POSITION (Runde 4, Owner Z62: „[Zitat entfernt]“
// ). Welche Agenten es gibt, welche
// Modelle und Effort-Stufen jeder nimmt und ob er auf diesem Rechner startet, steht im Katalog des Servers (GET /api/harnesses: server.ts
// HARNESSES, die Modelle aus model-register.ts), nicht in einer Liste hier. Ohne Katalog bietet das Fenster keine Wahl an.
export interface KatAgent {
  id: string; models: string[]; effortLevels: string[]; modell: boolean; effort: boolean; standard: boolean; lanes: boolean;
  // null = startet hier; sonst warum nicht, kurz und in Server-Worten (FLEET_HARNESSES_OFF, HARNESS_AVAILABILITY)
  aus: { wort: string; grund: string } | null;
}
// `abgeloest`: „harness|id“ der Modelle, die das Register als abgelöst führt; `standardModell`: was ein Start des Standard-Agenten ohne
// Modell bekommt (server.ts DEFAULT_MODEL)
export interface Katalog { agenten: KatAgent[]; abgeloest: ReadonlySet<string>; standardModell: string | null }

const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? { ...v } : null;
const texte = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

// die Antwort von GET /api/harnesses; `container` ist ein Ort, kein Agent (role "place"), und steht nicht darin. null = passt nicht
export function katalogAus(j: unknown): Katalog | null {
  const o = rec(j);
  if (!o || !Array.isArray(o.harnesses)) return null;
  const agenten: KatAgent[] = [];
  for (const x of o.harnesses) {
    const h = rec(x);
    if (!h || typeof h.id !== "string" || (h.role ?? "agent") !== "agent") continue;
    const sup = rec(h.supports) ?? {};
    const av = rec(h.availability);
    const grund = typeof h.grund === "string" ? h.grund : "switched off on this machine";
    agenten.push({ id: h.id, models: texte(h.models), effortLevels: texte(h.effortLevels), modell: sup.model === true, effort: sup.effort === true,
      standard: h.default === true, lanes: h.allowsLanes !== false,
      // Bauleitung e768d9f5: was dieser Rechner nicht startet, heißt „nur auf einem anderen Rechner“; der Grund des Servers steht im Title
      aus: h.hier === false ? { wort: "only on another machine", grund }
        : av?.status === "unavailable" ? { wort: "paused", grund: typeof av.reason === "string" ? av.reason : "paused (model-register.ts#HARNESS_AVAILABILITY)" } : null });
  }
  const abgeloest = new Set((Array.isArray(o.modelRegistry) ? o.modelRegistry : []).flatMap((x) => {
    const e = rec(x);
    return e && e.status === "superseded" && typeof e.harness === "string" && typeof e.id === "string" ? [`${e.harness}|${e.id}`] : [];
  }));
  return { agenten, abgeloest, standardModell: typeof o.defaultModel === "string" ? o.defaultModel : null };
}

// der Name, wie die Oberfläche ihn sagt: Claude Code für claude, sonst die ID groß geschrieben (src/founding.ts#harnessWord)
export const agentWort = (id: string): string => id === "claude" ? "Claude Code" : id ? id.charAt(0).toUpperCase() + id.slice(1) : "";
export const agentVon = (k: Katalog, id: string): KatAgent | undefined => k.agenten.find((a) => a.id === id);
export const standardAgent = (k: Katalog): string | null => k.agenten.find((a) => a.standard)?.id ?? null;
// die Modelle, die ein Agent zur Wahl stellt, ohne die abgelösten; leer = er nimmt keins oder führt keine Liste (pi)
export function modelleVon(k: Katalog, id: string): string[] {
  const a = agentVon(k, id);
  return a?.modell ? a.models.filter((m) => !k.abgeloest.has(`${id}|${m}`)) : [];
}
export function effortVon(k: Katalog, id: string): string[] {
  const a = agentVon(k, id);
  return a?.effort ? a.effortLevels : [];
}
// ob ein gesetzter Wert zum Agenten passt; ohne Katalog lässt sich das nicht sagen, er gilt dann. Ein Agent ohne Modell-Liste nimmt
// jeden Namen, den der Server annimmt (server.ts#modelOf prüft dort nur die Schreibweise)
export function passtModell(k: Katalog | null, id: string, m: string): boolean {
  if (!k) return true;
  const a = agentVon(k, id);
  return !!a?.modell && (a.models.length === 0 || a.models.includes(m));
}
export function passtEffort(k: Katalog | null, id: string, e: string): boolean {
  if (!k) return true;
  return effortVon(k, id).includes(e);
}
// die Agenten zur Wahl: was hier nicht startet oder keine Lane sein kann, steht darin, ist aber nicht wählbar
export interface AgentOption { wert: string; wort: string; aus?: string; grund?: string }
export function agentOptionen(k: Katalog, lane: boolean): AgentOption[] {
  return k.agenten.map((a) => {
    const nein = a.aus ?? (lane && !a.lanes ? { wort: "no lanes", grund: `${agentWort(a.id)} runs only as a main session, not as a lane (allowsLanes)` } : null);
    return { wert: a.id, wort: agentWort(a.id), ...(nein ? { aus: nein.wort, grund: nein.grund } : {}) };
  });
}
