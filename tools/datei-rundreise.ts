// DIE RUNDREISE EINER KONSTELLATION über zwei Testinstanzen (Auftrag datei-traegt 22.10., docs/start/direction.md Schritt 3 und 5): A hat eine
// Konstellation mit zwei Sitzen, deren persönlichen Platz A's Owner gefüllt hat; beide Sitze starten, ihre Fassung (GET /api/slots/:n/fassung)
// wird gemessen. A exportiert die Datei (GET /api/k15/konst/:id/datei). B, frisch, importiert sie so, wie das Fenster es tut (k15-import.ts →
// Speicher), startet dieselben Sitze und misst. Erwartet: je Sitz unterscheidet sich die Fassung nur im persönlichen Platz; füllt B ihn mit
// demselben Text, ist der Hash gleich. Die Datei enthält A's persönlichen Text nicht, und abgeleitetVon ist A's Fassung der Konstellation.
//
//   bun tools/datei-rundreise.ts <worktree A> <worktree B> [freier Slot] [zweiter freier Slot] [--datei <pfad>]
// Beide Worktrees haben eine laufende Testinstanz (./testinstanz.sh up). Die Instanz B bleibt mit der importierten Konstellation stehen.
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PROFILE0, alle, exportObjekt, type Konst, type Profil } from "../src/k15-entwurf-modell";
import { importKonst } from "../src/k15-import";
import type { Rechte } from "../session-rechte";

const args = process.argv.slice(2);
const dateiArg = args.indexOf("--datei");
const dateiZiel = dateiArg >= 0 ? args.splice(dateiArg, 2)[1] : null;
const [A, B, s1 = "14", s2 = "15"] = args;
if (!A || !B) { console.error("usage: bun tools/datei-rundreise.ts <worktree A> <worktree B> [slot] [slot] [--datei <pfad>]"); process.exit(2); }
const SLOTS = [Number(s1), Number(s2)];
const REPO = join(import.meta.dir, "..");

let n = 0;
function probe(wt: string, method: string, path: string, body?: unknown): { status: number; json: Record<string, unknown> } {
  const args = [join(wt, "testinstanz.sh"), "probe", method, path, "--as", "owner"];
  if (body !== undefined) {
    const f = join(tmpdir(), `rundreise-${process.pid}-${n++}.json`);
    writeFileSync(f, JSON.stringify(body));
    args.push("--body", f);
  }
  const r = Bun.spawnSync(args, { cwd: wt });
  const out = r.stdout.toString();
  const status = Number(/^HTTP (\d+)/.exec(out)?.[1] ?? 0);
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(out.replace(/^HTTP \d+\n/, "")); } catch { json = { roh: out.slice(0, 300) }; }
  return { status, json };
}
const muss = (ok: boolean, satz: string): void => { if (!ok) { console.error(`FEHLER: ${satz}`); process.exit(1); } };

// DIE AUSGANGSDATEI, wie eine Fleet mit git-Bibliothek sie exportiert hätte: zwei Sitze ohne Rolle mit Agent-MD, Packs aus docs/packs als Text
const pack = (id: string, weg: "start" | "skill", wofuer: string) => {
  const pfad = `docs/packs/${id}.md`, text = readFileSync(join(REPO, pfad), "utf8").trim();
  return { id, weg, quellen: [{ pfad, anker: text.split("\n")[0]! }], wofuer, text };
};
const liest = [pack("who-it-is-for", "start", "Read this when you choose, brief or build work that someone will use."),
  pack("how-fleet-remembers", "skill", "Wenn du etwas gelernt hast und entscheiden musst, wohin die Notiz gehört.")];
const persoenlich = [{ ...pack("working-with-the-owner", "start", "Read this when you talk with the owner."), text: null }];
const NOTIZ = "---\nname: rundreise\ndescription: was der Bauer über Läufe weiß\nmetadata:\n  type: project\n---\nEin Lauf dieser Konstellation dauert etwa zwei Stunden.";
const profil = (id: string, name: string, md: string) => ({ id, version: 1, name, glyph: "file", kurz: name, satz: name, autor: "du", rolle: "nur-ordner",
  schiene: "session", agent: "claude", modell: null, effort: null, uebergabeAb: null, einV: 1, rechteV: 1, werte: {},
  datei: { titel: `${id}.md`, v: 1, pfad: "eigene Datei", abschnitte: [{ titel: `# ${name}`, text: md }] } });
const SEED = { format: 1, fleet: "konstellation", name: "Bauer und Prüferin", version: 1, satz: "eine baut, eine prüft", autor: "du",
  aufgabe: { ziel: "Eine kleine Änderung bauen und prüfen.", fertig: "Die Prüferin hat jede Änderung gelesen." },
  positionen: [
    { id: "bauer", name: "Bauer", profil: profil("bauer-rr", "Bauer", "Du baust, was die Aufgabe sagt."),
      sitz: { liest, persoenlich, darf: { rechte: null, modus: null },
        notizbuch: { index: "- [Rundreise](rundreise.md) — was der Bauer über Läufe weiß", notizen: [{ datei: "rundreise.md", text: NOTIZ }], daheim: 0 } } },
    { id: "pruefer", name: "Prüferin", meldetAn: "bauer", profil: profil("pruefer-rr", "Prüferin", "Du prüfst, was der Bauer baut."),
      sitz: { liest, persoenlich, darf: { rechte: null, modus: null }, notizbuch: null } },
  ] };

// SO TUT ES DAS FENSTER: importieren (k15-import.ts#importKonst), als eigene Konstellation in den Speicher (k15-zustand.ts#konstForm, #sende)
// `aendere`: was der Owner danach im Fenster an der Konstellation setzt (etwa „[Zitat entfernt]“ je Session, k15-mitgereist.ts#darfWahl)
function importiere(wt: string, text: string, eigenes: string | null, aendere: (k: Konst) => void = () => {}): string {
  const imp = importKonst(text, PROFILE0, Date.now());
  muss(typeof imp !== "string", `Import auf ${wt}: ${String(imp)}`);
  if (typeof imp === "string") throw new Error(imp);
  const k: Konst = imp.k;
  if (eigenes) for (const q of alle(k.wurzeln)) for (const p of q.sitz?.persoenlich ?? []) p.text = eigenes;
  aendere(k);
  const profile: Profil[] = [...PROFILE0, ...imp.neueProfile];
  const form = { id: k.id, ...exportObjekt({ ebene: "konst", voll: true, konst: [k], k, profile, q: null, p: profile[0]! }) };
  const voll = (p: Profil) => (exportObjekt({ ebene: "session", voll: true, konst: [k], k, profile, q: null, p }) as { profil: unknown }).profil;
  const r = probe(wt, "PUT", "/api/k15/eigenes", { fassungen: [], packs: [], profile: imp.neueProfile.filter((p) => p.datei).map(voll), konstellationen: [form] });
  muss(r.status === 200, `Speicher auf ${wt}: ${JSON.stringify(r.json).slice(0, 200)}`);
  return k.id;
}
// DER ORDNER, IN DEM DIE SITZE STARTEN: das HOME der Instanz (testinstanz.sh: $TI_ROOT/fleet-testinstanz-<hash>/home), als realpath. Start und
// Fassung lesen das Notizbuch sonst unter zwei Namen desselben Ordners (/tmp und /private/tmp auf macOS) und zeigen verschiedene
function heim(wt: string): string {
  const st = Bun.spawnSync([join(wt, "testinstanz.sh"), "status"], { cwd: wt }).stdout.toString();
  const h = /socket fleetti(\d+)/.exec(st)?.[1];
  muss(!!h, `${wt}: keine laufende Testinstanz`);
  return realpathSync(join(process.env.FLEET_TI_ROOT ?? "/tmp", `fleet-testinstanz-${h}`, "home"));
}
// je Abschnitt Teil/Kennung und Text; verglichen wird als Menge, damit ein fehlender Abschnitt die übrigen nicht verschiebt
interface Gemessen { hash: string; abschnitte: string[] }
function starteUndMiss(wt: string, kid: string, rechte: Record<string, Rechte> = {}): Gemessen[] {
  return (["bauer", "pruefer"] as const).map((pos, i) => {
    const slot = SLOTS[i]!;
    probe(wt, "POST", `/api/slots/${slot}/kill`, {});
    const o = probe(wt, "POST", `/api/slots/${slot}/open`, { cwd: heim(wt), harness: "claude", profil: `${pos}-rr`, sitz: `${kid}/${pos}`,
      ...(rechte[pos] ? { rechte: rechte[pos] } : {}) });
    muss(o.status === 200, `open ${pos} auf ${wt}: ${JSON.stringify(o.json).slice(0, 300)}`);
    const f = probe(wt, "GET", `/api/slots/${slot}/fassung?anlass=laufend`);
    muss(f.status === 200 && typeof f.json.hash === "string", `fassung ${pos}: ${JSON.stringify(f.json).slice(0, 200)}`);
    const abschnitte = (f.json.teile as { id: string; abschnitte: { id: string; text: string | null }[] }[])
      .flatMap((t) => t.abschnitte.map((a) => `${t.id}/${a.id}: ${a.text ?? "(fehlt)"}`));
    return { hash: f.json.hash as string, abschnitte };
  });
}
const nurIn = (x: Gemessen, y: Gemessen): string[] => x.abschnitte.filter((a) => !y.abschnitte.includes(a));
const kurz = (a: string): string => a.split("\n")[0]!.slice(0, 90);

const EIGENES_A = "PERSOENLICH-A: Der Owner von A will jede Antwort in drei Sätzen und liest nachts. Das gehört nur nach A.";
console.log("A: Ausgangsdatei importieren, persönlichen Platz mit A's Eigenem füllen, Sitze starten");
// die Datei bringt keine Rechte mit; A's Owner setzt sie im Fenster, und so startet das Fenster die Sitze (k15-start.ts#auftrag schickt q.rechte)
// der Bauer darf auf A landen: mehr als „bauen“, also deckelt B ihn, bis B's Owner es freigibt (src/sitz.ts#sitzRechte)
const RECHTE_A: Record<string, Rechte> = { bauer: { stufe: "landen", an: [], aus: [] }, pruefer: { stufe: "lesen", an: [], aus: [] } };
const kidA = importiere(A, JSON.stringify(SEED), EIGENES_A, (k) => { for (const q of alle(k.wurzeln)) q.rechte = RECHTE_A[q.id]; });
const a = starteUndMiss(A, kidA, RECHTE_A);
const aktivA = probe(A, "GET", `/api/k15/konst/${kidA}/fassungen`).json.aktiv;
console.log(`A: Konstellation ${String(aktivA).slice(0, 12)} · Bauer ${a[0]!.hash.slice(0, 12)} · Prüferin ${a[1]!.hash.slice(0, 12)}`);

// EIN LAUF AUF A: der Bauer an einen Lauf gebunden und der Lauf beendet (server/laeufe.ts); er reist als Bericht mit
const lauf = probe(A, "POST", "/api/k15/laeufe", { konst: kidA, pos: "bauer", slot: SLOTS[0] });
const laufId = (lauf.json.lauf as { id?: string } | undefined)?.id ?? lauf.json.id;
muss(lauf.status >= 200 && lauf.status < 300 && typeof laufId === "string", `Lauf auf A: ${JSON.stringify(lauf.json).slice(0, 200)}`);
muss(probe(A, "POST", `/api/k15/laeufe/${String(laufId)}/ende`, {}).status < 300, "der Lauf auf A endet nicht");
const ex = probe(A, "GET", `/api/k15/konst/${kidA}/datei`);
muss(ex.status === 200, `Export: ${JSON.stringify(ex.json).slice(0, 300)}`);
const datei = JSON.stringify(ex.json.datei, null, 2);
if (dateiZiel) writeFileSync(dateiZiel, datei);
const d = ex.json.datei as Record<string, unknown>;
muss(Array.isArray(d.laeufe) && (d.laeufe as { fassung: string }[]).some((l) => l.fassung === aktivA), "der Lauf von A reist nicht mit");
console.log(`Datei: ${datei.length} Zeichen · ${(d.laeufe as unknown[]).length} Lauf als Bericht · abgeleitetVon ${String(d.abgeleitetVon).slice(0, 12)} · persönlicher Text von A darin: ${datei.includes("PERSOENLICH-A") ? "JA" : "nein"} · Text von working-with-the-owner darin: ${datei.includes("He dictates.") ? "JA" : "nein"}`);
muss(d.abgeleitetVon === aktivA, "abgeleitetVon ist nicht A's Fassung der Konstellation");
muss(!datei.includes("PERSOENLICH-A") && !datei.includes("He dictates."), "die Datei enthält persönlichen Text");
for (const h of (ex.json.hinweise as string[] | undefined) ?? []) console.log(`  Hinweis: ${h}`);
// was A's Sitze dürfen, reist im Sitz-Block, und die Datei bleibt unter der Grenze, die der Import liest (k15-import.ts#MAX_DATEI_BYTES)
const ps = d.positionen as { id: string; rechte?: unknown; sitz?: { darf: { rechte: unknown } } }[];
console.log(`Darf in der Datei: ${ps.map((p) => `${p.id} ${JSON.stringify(p.sitz?.darf.rechte)}`).join(" · ")} · ${new TextEncoder().encode(datei).length} Bytes`);
muss(ps.every((p) => JSON.stringify(p.sitz?.darf.rechte) === JSON.stringify(RECHTE_A[p.id]) && p.rechte === undefined), "die Rechte von A reisen nicht im Sitz-Block");
muss(new TextEncoder().encode(datei).length < 1_000_000, "die Datei ist größer, als ein Import liest");

console.log("B: Datei importieren, Platz leer lassen, Sitze starten");
const kidB = importiere(B, datei, null);
const b = starteUndMiss(B, kidB);
const kB = probe(B, "GET", `/api/k15/konst/${kidB}/fassungen`).json.aktiv;
const gespeichertB = probe(B, "GET", "/api/k15/eigenes").json.eigenes as { konstellationen: { abgeleitetVon?: string; laeufe?: unknown[] }[] };
console.log(`B: gespeichert mit abgeleitetVon ${String(gespeichertB.konstellationen[0]?.abgeleitetVon).slice(0, 12)} und ${gespeichertB.konstellationen[0]?.laeufe?.length ?? 0} Lauf`);
muss(gespeichertB.konstellationen[0]?.abgeleitetVon === aktivA && gespeichertB.konstellationen[0]?.laeufe?.length === 1, "B hat abgeleitetVon oder den Lauf nicht gespeichert");
muss(kB === aktivA, `die Konstellation auf B hat nicht A's Fassung (${String(kB).slice(0, 12)} statt ${String(aktivA).slice(0, 12)})`);
console.log(`B: Konstellation ${String(kB).slice(0, 12)} (gleich A: ${kB === aktivA}) · Bauer ${b[0]!.hash.slice(0, 12)} · Prüferin ${b[1]!.hash.slice(0, 12)}`);
const ok: boolean[] = [];
for (const [i, name] of ["Bauer", "Prüferin"].entries()) {
  const nurA = nurIn(a[i]!, b[i]!), nurB = nurIn(b[i]!, a[i]!);
  console.log(`  ${name}: Hash gleich ${a[i]!.hash === b[i]!.hash}; nur auf A: ${nurA.map(kurz).join(" | ") || "nichts"}; nur auf B: ${nurB.map(kurz).join(" | ") || "nichts"}`);
  // A trägt den gefüllten Platz und nennt ihn im Kopf der Bibliothek; B hat ihn leer und nennt ihn nicht. Beim Bauer dazu sein Darf: A „Landen“,
  // B gedeckelt auf „Bauen“
  const wA = nurA.filter((x) => !x.startsWith("darf/")), wB = nurB.filter((x) => !x.startsWith("darf/"));
  const dA = nurA.filter((x) => x.startsWith("darf/")), dB = nurB.filter((x) => x.startsWith("darf/"));
  const darfOk = i === 0 ? dA.length === 1 && dA[0]!.includes("Stufe „Landen“") && dB.length === 1 && dB[0]!.includes("Stufe „Bauen“") : !dA.length && !dB.length;
  ok.push(darfOk && wA.length === 2 && wA.some((x) => x.includes("PERSOENLICH-A")) && wA.every((x) => x.startsWith("liest/wissen:")) && wB.length === 1
    && wB[0]!.startsWith("liest/wissen: BIBLIOTHEK") && !wB[0]!.split("\n")[0]!.includes("working-with-the-owner"));
}
muss(ok.every(Boolean), "B unterscheidet sich von A nicht nur im persönlichen Platz und im gedeckelten Darf des Bauers");

console.log("B: persönlichen Platz mit demselben Text füllen, Sitze neu starten");
console.log("  … und B's Owner gibt das Landen des Bauers frei");
const kidB2 = importiere(B, datei, EIGENES_A);
// die Freigabe hat ihre eigene Tür (server/k15-speicher.ts#k15Freigabe): ein PUT des Speichers bringt sie nicht mit
muss(probe(B, "POST", "/api/k15/freigabe", { konst: kidB2, pos: JSON.parse(datei).positionen[0].id }).status === 200, "Freigabe auf B");
const b2 = starteUndMiss(B, kidB2);
for (const [i, name] of ["Bauer", "Prüferin"].entries()) console.log(`  ${name}: A ${a[i]!.hash.slice(0, 12)} · B ${b2[i]!.hash.slice(0, 12)} · gleich ${a[i]!.hash === b2[i]!.hash}`);
muss(b2.every((x, i) => x.hash === a[i]!.hash), "mit demselben persönlichen Text ist der Hash auf B nicht der von A");
// DER DECKEL an der Tür: dieselbe Datei, aber der Bauer darf darin „deployen“
const fremd = JSON.parse(datei);
fremd.positionen[0].sitz.darf.rechte = { stufe: "deployen", an: [], aus: [] };
const kidF = importiere(B, JSON.stringify(fremd), null);
probe(B, "POST", `/api/slots/${SLOTS[0]}/kill`, {});
muss(probe(B, "POST", `/api/slots/${SLOTS[0]}/open`, { cwd: heim(B), harness: "claude", profil: "bauer-rr", sitz: `${kidF}/bauer` }).status === 200, "open mit deployen");
const darfF = ((probe(B, "GET", `/api/slots/${SLOTS[0]}/fassung?anlass=laufend`).json.teile as { id: string; abschnitte: { text: string | null }[] }[])
  .find((t) => t.id === "darf")?.abschnitte[0]?.text ?? "").split(";")[0]!;
console.log(`B: Bauer mit „deployen“ aus der Datei startet mit: ${darfF}`);
muss(/Stufe „Bauen“/.test(darfF) && !/ctl\.sh land|api\/deploy|discard/.test(darfF), "der Deckel greift nicht");
console.log("B: zurück auf den leeren Platz, damit der Owner die Ankunft so sieht, wie sie kommt");
starteUndMiss(B, importiere(B, datei, null));
console.log("RUNDREISE GRÜN");
