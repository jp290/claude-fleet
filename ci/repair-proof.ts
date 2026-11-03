// DIE REPARATUR EINES ROTEN main — belegt, nicht behauptet (Karte cb1edfe3 der Mac-Queue, 27.10.; die
// Grenzen der Workhorse-Orchestratorin: „--repair bekommt nur ein Branch, dessen Änderung das rote Audit
// tatsächlich betrifft: Zeilen oder Dateien der roten Prüfungen, vom Check selbst belegt, nicht vom
// Aufrufer behauptet").
//
// Die Not: ist main einmal rot, antwortet jeder Merge-Check „nicht mergebar: main ist rot" — auch der
// Branch, der es repariert. `--repair` gab es dafür, aber die Tür reichte es nie weiter. Eine Flagge
// aus dem Body wäre die falsche Antwort: dann dürfte jeder Branch sich selbst zum Reparateur erklären.
// Darum entscheidet der CHECK, und zwar aus zwei Dingen, die er selbst lesen kann:
//   · der jüngsten roten Audit-Zeile auf main — ihre `fails` sind die Namen der roten Prüfungen;
//   · dem Kandidatenbaum — er nennt zu jedem Namen die Datei(en), in denen der Name WÖRTLICH oder in der
//     Escape-Form eines Quelltext-Strings steht (eine Nadel mit `"` oder `\` findet sonst nichts).
// Ein Name, den keine Datei nennt, ist nicht zugeordnet; ein Name, den zu viele nennen, ist keine
// Zuordnung. Beides ist „nicht belegt" und der Check läuft ohne repair.
//
// WIE BELASTBAR DAS IST (offen gesagt, weil es die Grenze der Tür ist): belegt ist damit, dass der
// Branch eine Datei ändert, die die rote Prüfung selbst nennt. Für die Prüfungen der Suite ist das die
// Datei, in der der Satz der Prüfung steht (e2e/slots.ts für „the words in the structure's rectangles …");
// eine Reparatur auf der PRODUKTSEITE (public/index.html), die den Satz nicht anfasst, belegt sich so
// NICHT und braucht das Urteil des Owners. Die Zuordnung ist also streng auf der Prüfseite und blind
// auf der Produktseite — die sichere Richtung: sie lässt eher eine echte Reparatur warten als eine
// falsche durch.
//
// WAS DER TESTLAUF SELBST BAUT (Auftrag 11 und 13, 3.11.): zwei Sorten Namen stehen in keinem Baum, kein Branch
// könnte sie je belegen, und die Tür klemmte. Eine Mutanten-Zeile setzt der Lauf aus Name und Satz zusammen
// (`… mutant: <Name> turns red: <Satz>`, `… MUTATION — <Name>: "<Satz>…" turns red`), eine Zählung schreibt er
// in die Klammer am Ende (`(271 needles, no browser)`). Weggelassen wird genau das, und nur, wenn der wörtliche
// Satz nirgends steht. Der Baum muss dann zeigen, dass der Lauf es baut: der Mutant steht als `name: "<Name>"` in
// seiner Liste, die Zählung als `<Satz> (${` im Template. Es zählen dabei nur Dateien unter e2e/ (die 9 Reste aller
// bisherigen Roten stehen alle dort), und was übrig bleibt, muss die Prüfung allein tragen: unter
// REPAIR_NEEDLE_MIN wird nicht gesucht, mehr als REPAIR_FILES_MAX Dateien bleiben keine Zuordnung.
//
// NUR DER BAUM DES KANDIDATEN: Ein Satz, der nur noch in main steht, belegt nichts. Sonst wäre das Löschen einer
// roten Prüfung ihre Reparatur, und nichts Späteres würde es merken (Prüfung 4, 3.11.).
export const REPAIR_NEEDLE_MIN = 16;
/** mehr Dateien als das nennen einen Namen — dann ist der Name keiner Datei zuzuordnen */
export const REPAIR_FILES_MAX = 8;
export const REPAIR_CHECKS_MAX = 40;

export interface RepairCheck {
  /** der Name der roten Prüfung, wie das Audit ihn trägt */
  name: string;
  /** das Stück des Namens, nach dem im Baum gesucht wurde (der Satz der Prüfung, sonst der Name) */
  needle: string;
  /** die Dateien des Baums, die `needle` nennen (wörtlich oder escaped) (leer = nicht belegt) */
  files: string[];
  touched: boolean;
  /** warum diese Prüfung nicht als behoben gilt — fehlt, wenn sie es ist */
  why?: string;
}

export interface RepairProof {
  ok: boolean;
  why: string;
  /** die roten Prüfungen, die das Audit nennt */
  red: number;
  checks: RepairCheck[];
  files: string[];
}

export interface RepairInput {
  /** die rote Audit-Zeile, die main rot hält (ci/merge-check.ts#mainAuditOf); null = main nicht rot */
  row: Record<string, unknown> | null;
  /** was der Branch gegen main ändert (git diff --name-only main..kandidat) */
  diff: readonly string[];
  /** die Dateien des Kandidatenbaums, die `needle` nennen — der Beleg selbst (wörtlich oder escaped) */
  namesIn: (needle: string) => readonly string[];
}

// Der Satz der Prüfung: alles nach dem ersten „: ". Davor steht die Familie („arbeitsorte DOM 1200x900
// lane"): sie ist im ausgebenden Modul wörtlich zu finden, aber sie bindet die Prüfung an ein Modul,
// nicht an ihren Satz — der Satz ist der genauere Beleg.
export function repairNeedleOf(name: string): string {
  const cut = name.indexOf(": ");
  const claim = cut >= 0 ? name.slice(cut + 2) : name;
  return (claim.length >= REPAIR_NEEDLE_MIN ? claim : name).trim();
}

// Der Name ohne das, was der Testlauf baut, und die Form, in der der Baum zeigen muss, dass der Lauf es baut —
// null, wenn der Name nichts davon trägt. Bewusst ohne den Rückfall von repairNeedleOf auf den ganzen Namen:
// bliebe zu wenig übrig, ist das ein Nein, keine breite Suche.
const MUTANT_ZEILE = [/^.+? mutant: (.+?) turns red: .+$/s, /^.+? MUTATION — (.+?): ".+" turns? red$/s];
const LAUF_ZAEHLUNG = / \(\d[^()]*\)$/;
export function repairNeedleOhneLauf(name: string): { rest: string; suche: string } | null {
  for (const form of MUTANT_ZEILE) {
    const hit = name.match(form);
    if (hit) { const rest = hit[1]!.trim(); return { rest, suche: `name: "${rest}"` }; }
  }
  const needle = repairNeedleOf(name);
  const rest = needle.replace(LAUF_ZAEHLUNG, "").trim();
  return rest === needle ? null : { rest, suche: `${rest} (\${` };
}
const unterE2e = (f: string): boolean => f.startsWith("e2e/");

const ZU_KURZ = "der Name ist zu kurz, um eine Datei zu belegen";
const short = (sha: string): string => sha.slice(0, 8);
const list = (a: readonly string[], max = 4): string => (a.length <= max ? a.join(", ") : `${a.slice(0, max).join(", ")} …`);

export function repairProofOf(i: RepairInput): RepairProof {
  const none = (why: string): RepairProof => ({ ok: false, why, red: 0, checks: [], files: [] });
  if (!i.row) return none("main ist nicht bekannt rot — es gibt nichts zu reparieren");
  const mainSha = typeof i.row.mainSha === "string" ? i.row.mainSha : "";
  const names = [...new Set((Array.isArray(i.row.fails) ? i.row.fails : [])
    .filter((n): n is string => typeof n === "string" && n.trim() !== ""))].slice(0, REPAIR_CHECKS_MAX);
  if (!names.length)
    return none(`der rote Audit ${mainSha ? short(mainSha) : "(ohne Sha)"} nennt keine roten Prüfungen — nichts, woran ein Branch sich halten könnte`);
  const diff = new Set(i.diff);
  const checks: RepairCheck[] = names.map((name) => {
    let needle = repairNeedleOf(name);
    if (needle.length < REPAIR_NEEDLE_MIN) return { name, needle, files: [], touched: false, why: ZU_KURZ };
    let files = [...new Set(i.namesIn(needle))];
    const ohneLauf = files.length ? null : repairNeedleOhneLauf(name);
    if (ohneLauf) {
      if (ohneLauf.rest.length < REPAIR_NEEDLE_MIN) return { name, needle: ohneLauf.rest, files: [], touched: false, why: `${ZU_KURZ}, sobald weg ist, was der Testlauf baut` };
      needle = ohneLauf.suche;
      files = [...new Set(i.namesIn(needle))];
    }
    if (files.length > REPAIR_FILES_MAX) return { name, needle, files, touched: false, why: `${files.length} Dateien nennen diese Prüfung — keine Zuordnung` };
    if (ohneLauf) files = files.filter(unterE2e);
    if (!files.length) return { name, needle, files, touched: false, why: "kein Quelltext nennt diese Prüfung" };
    const touched = files.some((f) => diff.has(f));
    return { name, needle, files, touched, ...(touched ? {} : { why: `der Diff berührt keine dieser Dateien (${list(files)})` }) };
  });
  const files = [...new Set(checks.flatMap((c) => c.files))].sort();
  const open = checks.filter((c) => !c.touched);
  if (open.length)
    return { ok: false, red: names.length, checks, files,
      why: `nicht als Reparatur belegt: ${open.length} von ${checks.length} roten Prüfungen ohne Beleg: ${open.map((c) => `${c.why} — „${c.needle.slice(0, 120)}"`).join("; ")}` };
  return { ok: true, red: names.length, checks, files,
    why: `der Branch behebt den roten Audit ${short(mainSha)}: ${checks.length} rote Prüfungen, belegt in ${files.length} Datei(en), jede davon im Diff (${list(files)})` };
}
