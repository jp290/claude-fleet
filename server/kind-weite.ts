// EIN KIND IST NIE WEITER ALS SEINE ÖFFNERIN (Sicherheitsprüfung, Lauf „laeufe“, Befund F4): eine Session unter einer Schranke
// öffnete über POST /api/self/branches/open mit dem eigenen Self-Token eine Codex-Session ohne Sandbox und ohne Freigabe, denn
// server.ts#openBoardBranch nimmt Harness, permissions und rechte aus dem Body wie die Owner-Tür. Die Regel steht in
// docs/self-api.md §branches: eine Öffnerin unter einer Schranke (Klassifizierer, Sandbox, Freigabe) öffnet nur ihren eigenen
// Harness, mit ihren Schranken oder engeren; was der Body nicht nennt, erbt das Kind von ihr. Frei öffnet nur, wer keine
// Schranke hat: Claude Code in bypassPermissions (die Orchestratorin) oder Codex mit danger-full-access und approval never.
import { RECHTE_BEFEHLE, befehlAn, rechteAus, type Rechte } from "../session-rechte";
import type { ClaudePermissionMode } from "./session-start";
import type { CodexPermissions } from "./types";

// was die Öffnerin selbst hat, vom Slot gelesen, nie vom Body: `harness` "claude" für den Standard-Adapter, `modus` der
// Permission-Mode ihres letzten Starts (nur Claude Code), `permissions` ihre Codex-Schranken (null: keine lesbaren)
export interface Oeffnerin {
  harness: string;
  modus: ClaudePermissionMode | null;
  permissions: CodexPermissions | null;
  rechte: Rechte | null;
}

const SANDBOX = ["read-only", "workspace-write", "danger-full-access"] as const;
const APPROVAL = ["on-request", "never"] as const;
const ENGSTE: CodexPermissions = { sandbox: "read-only", approval: "on-request" };

export function ohneSchranke(o: Oeffnerin): boolean {
  if (o.harness === "claude") return o.modus === "bypassPermissions";
  if (o.harness === "codex") return o.permissions?.sandbox === "danger-full-access" && o.permissions.approval === "never";
  return false;
}

// je Befehl der Rechte-Tabelle, wie frei die Session ihn hat: 0 gesperrt (deny), 1 der Klassifizierer entscheidet (keine
// Regel), 2 ohne Rückfrage (allow). Ohne Rechte gibt es keine Regel; „Dateien ändern“ setzt auch an keine (rechteRegeln).
function freiheit(r: Rechte | null, id: string): number {
  if (!r) return 1;
  if (!befehlAn(r, id)) return 0;
  return id === "dateien" ? 1 : 2;
}

type Antwort = { ok: true; body: Record<string, unknown> } | { ok: false; error: string };
const nein = (was: string): { ok: false; error: string } =>
  ({ ok: false, error: `${was} — a session opens no seat wider than itself (docs/self-api.md §branches)` });

// Harness und Codex-Schranken eines Bodys (harness, permissions), wie jede Self-Tür ihn bekommt, die einen Spawn wählt: fehlende
// von der Öffnerin ergänzt, eine weitere abgelehnt. Die Aufgaben-Türen (POST /api/self/tasks, /api/self/tasks/:id/spawn) fragen
// nur das: eine Lane trägt keine `rechte`.
export function spawnNieWeiter(o: Oeffnerin, body: Record<string, unknown>): Antwort {
  if (ohneSchranke(o)) return { ok: true, body };
  const gefragt = body.harness === undefined || body.harness === null || body.harness === "" ? o.harness : body.harness;
  if (gefragt !== o.harness) return nein(`harness ${String(gefragt)} is not yours (${o.harness})`);
  const kind: Record<string, unknown> = { ...body, harness: o.harness };
  if (o.harness !== "codex") return { ok: true, body: kind };
  const eigen = o.permissions ?? ENGSTE;
  if (body.permissions === undefined) return { ok: true, body: { ...kind, permissions: { ...eigen } } };
  const p: unknown = body.permissions;
  const sandbox = p && typeof p === "object" && "sandbox" in p ? p.sandbox : null;
  const approval = p && typeof p === "object" && "approval" in p ? p.approval : null;
  const s = SANDBOX.findIndex((x) => x === sandbox), a = APPROVAL.findIndex((x) => x === approval);
  // eine unlesbare Angabe lehnt die Tür selbst ab (permissionsOf), mit ihrem eigenen Satz
  if (s >= 0 && a >= 0 && (s > SANDBOX.indexOf(eigen.sandbox) || a > APPROVAL.indexOf(eigen.approval)))
    return nein(`permissions ${SANDBOX[s]}/${APPROVAL[a]} are wider than yours (${eigen.sandbox}/${eigen.approval})`);
  return { ok: true, body: kind };
}

// der Body der Self-Tür, wie openBoardBranch ihn bekommt: dazu die `rechte` einer Claude-Code-Öffnerin
export function kindNieWeiter(o: Oeffnerin, body: Record<string, unknown>): Antwort {
  const sp = spawnNieWeiter(o, body);
  if (!sp.ok || ohneSchranke(o) || o.harness !== "claude") return sp;
  if (body.rechte === undefined) return { ok: true, body: { ...sp.body, rechte: o.rechte } };
  const r = body.rechte === null ? null : rechteAus(body.rechte);
  const weiter = body.rechte === null || r ? RECHTE_BEFEHLE.filter((b) => freiheit(r, b.id) > freiheit(o.rechte, b.id)) : [];
  return weiter.length ? nein(`rechte give ${weiter.map((b) => b.id).join(", ")} more than yours`) : sp;
}
