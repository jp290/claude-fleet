// DIE LINIE EINES SITZES, die Regel, die Server und Board teilen (server/opener.ts erklärt die Linie): wer die Öffnerin ist, entscheidet ihre
// Linie, nicht ihr Platz. Ein Datensatz mit Linie passt auf den Sitz derselben Linie, wo er heute auch sitzt (eine Nachfolge bleibt im Platz,
// eine Orchestratorin, die der Owner neu öffnet, setzt die Linie der letzten fort); ein Datensatz ohne Linie (von vor der Linie) passt nach
// Platz und Ordner wie bisher. Rein, ohne Laufzeit-Importe: das Board bündelt sie.

// was ein Datensatz von seiner Öffnerin nennt: der Öffner-Datensatz am Sitz, der Öffner im Branch-Buch, die Bildnerin einer Rolle
export type Linienbezug = { slot: number; cwd: string; linie?: string | null };

/** IST DIESER SITZ DIE ÖFFNERIN, DIE DER DATENSATZ NENNT? Ein lebender Sitz in ihrer Linie; ein Datensatz ohne Linie nach Platz und Ordner. */
export function istOeffnerin(seat: { slot: number; cwd: string | null; linie?: string | null }, rec: Linienbezug | null | undefined): boolean {
  if (!rec || !seat.cwd) return false;
  return rec.linie ? rec.linie === seat.linie : rec.slot === seat.slot && rec.cwd === seat.cwd;
}

/** NENNEN ZWEI DATENSÄTZE DIESELBE ÖFFNERIN? (Geschwister): dieselbe Linie; fehlt einem die Linie, derselbe Platz und Ordner wie bisher. */
export function gleicheOeffnerin(a: Linienbezug | null | undefined, b: Linienbezug | null | undefined): boolean {
  if (!a || !b) return false;
  return a.linie && b.linie ? a.linie === b.linie : a.slot === b.slot && a.cwd === b.cwd;
}
