// DIE TESTINSTANZ ALS WERKZEUG DER ABNAHME (W3b-Zusatz, Owner 31.10.: Testinstanzen „[Zitat entfernt]“): ein Sitz, der eine sichtbare Änderung abnimmt (Prüfer oder Leitung), fährt die Instanz über POST /api/self/testinstanz hoch. Fleet merkt sich,
// welcher Sitz sie für welchen Branch hochfuhr, und beendet sie im Takt, sobald ein „passt“ auf diesen Branch kommt (des Owners oder eines Sitzes) oder ihr Sitz
// endet. Vorher starb eine Instanz aus der Shell eines Sitzes mit dessen Nachfolge nicht und lief bis zu ihrer Frist weiter (Mangel 81).
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ABNAHME_DATEI = "abnahme-instanzen.json";

/** Eine Instanz, die ein Sitz zur Abnahme hochfuhr: der Worktree, aus dem sie gebaut ist, sein Repo und Branch, der Sitz und wann. */
export interface AbnahmeInstanz {
  readonly path: string; readonly repo: string; readonly branch: string | null;
  /** der Sitz, der sie hochfuhr; `linie` (Slot.linie, server/opener.ts) hält ihn über seine Nachfolgen, ohne sie (ein Eintrag von vor der Linie) zählt
   *  die Belegung (openedAt) */
  readonly von: { readonly slot: number; readonly openedAt: number; readonly linie?: string };
  readonly at: number;
  /** welche Instanz es war: ihr Start (`started` in testinstanz.state), damit der Takt nie eine andere im selben Worktree beendet (Prüfung W3b, W3-3);
   *  null = beim Hochfahren keine gefunden */
  readonly start?: string | null;
}
/** `weg`: die Instanz läuft nicht mehr oder eine andere läuft dort — der Eintrag fällt, ohne dass Fleet etwas beendet */
export type AbnahmeGrund = "passt" | "sitz-ende" | "weg";

const istInstanz = (v: unknown): v is AbnahmeInstanz => {
  const r = v as Record<string, unknown> | null;
  const von = r?.von as Record<string, unknown> | undefined;
  return !!r && typeof r.path === "string" && typeof r.repo === "string" && (r.branch === null || typeof r.branch === "string")
    && typeof r.at === "number" && !!von && Number.isInteger(von.slot) && typeof von.openedAt === "number";
};
export function liesAbnahme(dir: string): AbnahmeInstanz[] {
  try {
    const roh: unknown = JSON.parse(readFileSync(join(dir, ABNAHME_DATEI), "utf8"));
    return Array.isArray(roh) ? roh.filter(istInstanz) : [];
  } catch { return []; }
}
export function schreibAbnahme(dir: string, liste: readonly AbnahmeInstanz[]): void {
  const ziel = join(dir, ABNAHME_DATEI), tmp = `${ziel}.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(liste, null, 2));
  renameSync(tmp, ziel);
}
/** WER SIE HOCHFUHR, wie die Tür es einträgt: Platz, Belegung und seine Linie (Slot.linie, die jede Öffnung bekommt und jede Nachfolge weiterträgt). Die
 *  lineageId taugt dafür nicht: eine frische Öffnung hat keine, also hing die Instanz an der Belegung und endete mit der ersten Nachfolge (W3-4). */
export const vonSitz = (s: { readonly id: number; readonly openedAt: number; readonly linie?: string | null }): AbnahmeInstanz["von"] =>
  ({ slot: s.id, openedAt: s.openedAt, ...(s.linie ? { linie: s.linie } : {}) });
/** LEBT DER SITZ NOCH, DER SIE HOCHFUHR? Mit Linie: solange irgendein Sitz sie trägt oder eine Nachfolge sie gerade weitergibt (`lebendeLinien`); ohne
 *  Linie: dieselbe Belegung im Platz. */
export const vonLebt = (von: AbnahmeInstanz["von"], lebendeLinien: ReadonlySet<string>, belegung: (slot: number) => number | null): boolean =>
  von.linie ? lebendeLinien.has(von.linie) : belegung(von.slot) === von.openedAt;
/** Eine Instanz je Worktree: eine neue ersetzt eine alte desselben Pfades. */
export const mitAbnahme = (liste: readonly AbnahmeInstanz[], neu: AbnahmeInstanz): AbnahmeInstanz[] => [...liste.filter((x) => x.path !== neu.path), neu];
export const ohneAbnahme = (liste: readonly AbnahmeInstanz[], path: string): AbnahmeInstanz[] => liste.filter((x) => x.path !== path);

/** WELCHE INSTANZEN JETZT ENDEN: ihr Sitz lebt nicht mehr (seine Linie endete, `vonLebt`), oder ihr Branch bekam nach dem Hochfahren ein „passt“
 *  (`passtSeit` = wann das jüngste „passt“ auf diesen Branch gegeben wurde, des Owners oder eines Sitzes; null = keins). */
export function faellig(liste: readonly AbnahmeInstanz[], d: { lebt(von: AbnahmeInstanz["von"]): boolean; passtSeit(repo: string, branch: string): number | null;
  /** der Start der Instanz, die jetzt im Worktree läuft; null = keine */
  laeuft(path: string): string | null }):
  { instanz: AbnahmeInstanz; grund: AbnahmeGrund }[] {
  return liste.flatMap((instanz): { instanz: AbnahmeInstanz; grund: AbnahmeGrund }[] => {
    const jetzt = d.laeuft(instanz.path);
    if (jetzt === null || jetzt !== instanz.start) return [{ instanz, grund: "weg" }];
    if (!d.lebt(instanz.von)) return [{ instanz, grund: "sitz-ende" as const }];
    const seit = instanz.branch === null ? null : d.passtSeit(instanz.repo, instanz.branch);
    return seit !== null && seit >= instanz.at ? [{ instanz, grund: "passt" as const }] : [];
  });
}
