// DIE RUNDREISE EINES SETUPS über zwei Testinstanzen (Schritt 3, Runde 4): A hat einen Aufbau aus zwei Sitzen, einer mit
// Rollenstein, einer ohne; ein geteilter Pack, ein persönlicher Pack, ein persönliches Konzept und eine persönliche Notiz,
// verschiedene Rechte und eine Kante. A exportiert ihn durch GET /api/setups/<id>/datei. Die Datei darf keinen persönlichen
// Text aus A enthalten. B, ein frisches Zustandsverzeichnis, importiert sie durch POST /api/setups/import (Vorschau, dann
// Schreiben), bestätigt das Rollenbündel durch POST /api/k15/freigabe und startet dieselben Sitze. Die Starttexte beider
// Seiten werden über GET /api/slots/:n/fassung verglichen: jeder nicht-persönliche Text byte-gleich, jeder persönliche Platz
// auf B leer oder B's eigener. Danach ändert B einen Text, exportiert erneut, und ein drittes frisches Zustandsverzeichnis
// importiert die Kette; derivedFrom/derivedFromLine müssen erhalten bleiben. Zuletzt startet ein eigener Agent in einem
// Nicht-Fleet-Repo mit Rolle und Konzept als Steinen.
//
//   bun tools/datei-rundreise.ts <worktree A> <worktree B> [freier Slot] [zweiter freier Slot] [--datei <pfad>]
// Beide Worktrees haben eine laufende Testinstanz OHNE --real-seats (FLEET_CMD=true, kein echtes Modell).
// Das dritte Zustandsverzeichnis und das fremde Repo entstehen als temporäre Ordner im Prozess; es braucht keinen dritten Server.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { RICHTUNG_PLATZ, SETUP_FORMAT, hashText, importiereSetup, mitSetupHash, pruefeSetupDatei, roleStein,
  setupAusKonstellation, type SetupConcept, type SetupDatei, type SetupPack, type SetupSeat } from "../server/setup-datei";

const args = process.argv.slice(2);
const dateiArg = args.indexOf("--datei");
const dateiZiel = dateiArg >= 0 ? args.splice(dateiArg, 2)[1] : null;
const [A, B, s1 = "14", s2 = "15"] = args;
if (!A || !B) { console.error("usage: bun tools/datei-rundreise.ts <worktree A> <worktree B> [slot] [slot] [--datei <pfad>]"); process.exit(2); }
const SLOTS = [Number(s1), Number(s2)];
const REPO = join(import.meta.dir, "..");

let n = 0, failed = 0;
function check(ok: boolean, satz: string, detail = ""): boolean {
  console.log(`${ok ? "PASS" : "FAIL"}  ${satz}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
  return ok;
}
function need(ok: boolean, satz: string, detail = ""): asserts ok {
  if (!check(ok, satz, detail)) { console.error("Abbruch: eine Voraussetzung der Rundreise fehlt."); process.exit(1); }
}
function probe(wt: string, method: string, path: string, body?: unknown): { status: number; json: Record<string, any> } {
  const a = [join(wt, "testinstanz.sh"), "probe", method, path, "--as", "owner"];
  if (body !== undefined) {
    const f = join(tmpdir(), `rundreise-${process.pid}-${n++}.json`);
    writeFileSync(f, JSON.stringify(body));
    a.push("--body", f);
  }
  const r = Bun.spawnSync(a, { cwd: wt });
  const out = r.stdout.toString();
  const status = Number(/^HTTP (\d+)/.exec(out)?.[1] ?? 0);
  let json: Record<string, any> = {};
  try { json = JSON.parse(out.replace(/^HTTP \d+\n/, "")); } catch { json = { roh: out.slice(0, 300) }; }
  return { status, json };
}
const kurz = (v: unknown): string => JSON.stringify(v).slice(0, 300);
const gleiche = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// DER ORDNER, IN DEM DIE SITZE STARTEN: das HOME der Instanz, als realpath (Start und Fassung lesen das Notizbuch sonst
// unter zwei Namen desselben Ordners). Für die Rundreise ein frischer Unterordner, damit kein altes Gedächtnis mitzählt.
function heim(wt: string): string {
  const st = Bun.spawnSync([join(wt, "testinstanz.sh"), "status"], { cwd: wt }).stdout.toString();
  need(!/^real seats:/m.test(st), `${wt}: Testinstanz ohne --real-seats`, "sonst startet die Rundreise ein echtes Modell");
  const h = /socket fleetti(\d+)/.exec(st)?.[1];
  need(!!h, `${wt}: eine laufende Testinstanz`);
  return realpathSync(join(process.env.FLEET_TI_ROOT ?? "/tmp", `fleet-testinstanz-${h}`, "home"));
}
function startOrdner(wt: string): string {
  const d = join(heim(wt), `rundreise-${process.pid}`);
  mkdirSync(d, { recursive: true });
  return d;
}
function keineKonstellation(wt: string): boolean {
  const e = probe(wt, "GET", "/api/k15/eigenes").json.eigenes as { konstellationen?: unknown[] } | null;
  return !e || !Array.isArray(e.konstellationen) || e.konstellationen.length === 0;
}
function formVon(wt: string, kid: string): Record<string, any> | null {
  const e = probe(wt, "GET", "/api/k15/eigenes").json.eigenes as { konstellationen?: Record<string, any>[] } | null;
  return e?.konstellationen?.find((k) => k.id === kid) ?? null;
}

type Fassung = { hash: string; teile: { id: string; abschnitte: { id: string; text: string | null }[] }[]; wahlen?: Record<string, unknown> };
function starteMit(wt: string, slot: number, body: Record<string, unknown>, satz: string): Fassung {
  probe(wt, "POST", `/api/slots/${slot}/kill`, {});
  const o = probe(wt, "POST", `/api/slots/${slot}/open`, body);
  need(o.status === 200, `${satz}: open`, kurz(o.json));
  const f = probe(wt, "GET", `/api/slots/${slot}/fassung?anlass=laufend`);
  need(f.status === 200 && typeof f.json.hash === "string", `${satz}: Fassung`, kurz(f.json));
  return f.json as Fassung;
}
const starteSitz = (wt: string, kid: string, pos: string, slot: number, cwd: string): Fassung =>
  starteMit(wt, slot, { cwd, harness: "claude", sitz: `${kid}/${pos}` }, `${pos} auf ${wt}`);
const texte = (f: Fassung): string[] => f.teile.flatMap((t) => t.abschnitte.flatMap((a) => typeof a.text === "string" ? [a.text] : []));
const ohnePrivat = (f: Fassung, privat: readonly string[]): string[] => texte(f).filter((t) => !privat.some((p) => t.includes(p))).sort();

// ---------------------------------------------------------------- der Aufbau, der reisen soll
const SHARED_TEXT = "# Shared pack\n\nThis text travels with its hash and starts on both sides.";
const CONCEPT_TEXT = "# Shared concept\n\nA concept that travels as a stone.";
const NOTE_TEXT = "---\nname: shared-note\ndescription: a shared note\nmetadata:\n  type: project\n---\nA note both sides start with.";
const PRIVATE_A = "PRIVATE-A: this sentence belongs only to A's owner and may never stand in a shared setup file.";
const PERSONAL_PACK = "personal-pack", PERSONAL_CONCEPT = "k-personal", SHARED_CONCEPT = "k-shared";
const ROLE_SEAT = "bauer", PLAIN_SEAT = "pruefer", ROLE_ID = "lane";

const stein = roleStein(ROLE_ID, null, REPO);
need(!!stein, `Rollenstein ${ROLE_ID} lesbar`);
const role = stein!.role;
const shared: SetupPack = { kind: "pack", id: "shared-pack", hash: hashText(SHARED_TEXT), text: SHARED_TEXT,
  useWhen: "Read this on both sides.", sources: [{ path: "docs/packs/shared-pack.md", anchor: "# Shared pack" }], way: "start" };
const personal: SetupPack = { kind: "pack", id: PERSONAL_PACK, hash: null, text: null, personal: true,
  useWhen: "Read this when you talk with the owner.", sources: [{ path: "docs/packs/personal-pack.md", anchor: "# Personal pack" }], way: "start" };
const sharedConcept: SetupConcept = { kind: "concept", id: SHARED_CONCEPT, version: 1, hash: hashText(CONCEPT_TEXT), text: CONCEPT_TEXT,
  author: "owner", purpose: "A concept both sides start with." };
const personalConcept: SetupConcept = { kind: "concept", id: PERSONAL_CONCEPT, version: null, hash: null, text: null, personal: true,
  purpose: "A private concept place." };
const ref = (kind: "pack" | "concept", b: SetupPack | SetupConcept) => ({ kind, id: b.id, hash: b.hash });
const roleSeat: SetupSeat = { id: ROLE_SEAT, name: "Bauer", who: { harness: "claude", model: null, effort: null },
  start: { purpose: { titel: "Bauer.md", text: "You build what the task says." }, role: ROLE_ID, direction: { text: null, personal: true } },
  reads: [ref("pack", shared), ref("pack", personal), ref("concept", sharedConcept), ref("concept", personalConcept)],
  may: { rechte: { stufe: "lesen", an: [], aus: [] }, permissionMode: "auto" }, worksWith: {},
  notebook: { index: "- [Shared note](shared-note.md)", notes: [
    { id: "shared-note.md", hash: hashText(NOTE_TEXT), text: NOTE_TEXT },
    { id: "private-note.md", hash: null, text: null, personal: true }], home: 1 } };
const plainSeat: SetupSeat = { id: PLAIN_SEAT, name: "Prüferin", who: { harness: "claude", model: null, effort: null },
  start: { purpose: { titel: "Pruefer.md", text: "You review what the builder builds." } },
  reads: [ref("pack", shared), ref("concept", sharedConcept)],
  may: { rechte: { stufe: "bauen", an: [], aus: [] }, permissionMode: "auto" }, worksWith: { reportsTo: ROLE_SEAT }, notebook: null };
const datei: SetupDatei = mitSetupHash({ format: SETUP_FORMAT, name: "Rundreise: Bauer und Prüferin", setupHash: "", derivedFrom: null,
  derivedFromLine: [], seats: [roleSeat, plainSeat], edges: [{ from: PLAIN_SEAT, to: ROLE_SEAT, kind: "reports-to" }],
  packs: [shared, personal], concepts: [sharedConcept, personalConcept], roles: [role] });
const geprueft = pruefeSetupDatei(datei);
need(typeof geprueft !== "string", "die Ausgangsdatei ist ein gültiges fleet-setup/1", typeof geprueft === "string" ? geprueft : "");

// ---------------------------------------------------------------- A: importieren, persönlichen Platz füllen, exportieren
need(keineKonstellation(A), "A ist ein frisches Zustandsverzeichnis (keine gespeicherte Konstellation)");
const preA = probe(A, "POST", "/api/setups/import", { datei });
need(preA.status === 200 && preA.json.geschrieben === false, "A: die Vorschau schreibt nichts", kurz(preA.json));
check(preA.json.vorschau?.seats === 2, "A: die Vorschau sieht zwei Sitze", String(preA.json.vorschau?.seats));
check(keineKonstellation(A), "A: nach der Vorschau steht keine Konstellation im Speicher");
const wroteA = probe(A, "POST", "/api/setups/import", { datei, schreiben: true });
need(wroteA.status === 201, "A: der Import schreibt den Aufbau", kurz(wroteA.json));
const kidA = String(wroteA.json.konstellation?.id ?? "");
need(!!kidA, "A: der Import nennt die Konstellation", kurz(wroteA.json));
const reqA = wroteA.json.vorschau?.requestedRoles as { id: string; rights: string[] }[] | undefined;
check(!!reqA?.some((r) => r.id === ROLE_ID && r.rights.length > 0), "A: der Rollenstein erbittet sein Rechtebündel", kurz(reqA));
const freiA = probe(A, "POST", "/api/k15/freigabe", { konst: kidA, pos: ROLE_SEAT });
check(freiA.status === 200, "A: der Owner bestätigt das Rollenbündel", kurz(freiA.json));

// A's persönlicher Platz bekommt A's eigenen Text (so wie der Owner ihn im Fenster füllt); der Export muss ihn herausnehmen.
const eigenesA = probe(A, "GET", "/api/k15/eigenes").json.eigenes as { konstellationen: Record<string, any>[] };
const aForm = eigenesA.konstellationen.find((k) => k.id === kidA);
let gefuellt = 0;
for (const p of aForm?.positionen ?? []) for (const q of p.sitz?.persoenlich ?? []) if (q.id === PERSONAL_PACK) { q.text = PRIVATE_A; gefuellt++; }
need(gefuellt === 1, "A: der persönliche Platz für den eigenen Text ist da", String(gefuellt));
const putA = probe(A, "PUT", "/api/k15/eigenes", eigenesA);
need(putA.status === 200, "A: der eigene persönliche Text ist gespeichert", kurz(putA.json));

const exA = probe(A, "GET", `/api/setups/${encodeURIComponent(kidA)}/datei`);
need(exA.status === 200 && exA.json.datei, "A: GET /api/setups/<id>/datei liefert die Datei", kurz(exA.json));
const aFile = exA.json.datei as SetupDatei;
if (dateiZiel) writeFileSync(dateiZiel, JSON.stringify(aFile, null, 2));
const aFileText = JSON.stringify(aFile);
check(aFile.format === SETUP_FORMAT && aFile.seats.length === 2, "A: die Datei ist ein fleet-setup/1 mit zwei Sitzen", `${aFile.format}, ${aFile.seats.length}`);
check(aFile.edges.length === 1 && aFile.edges[0]!.from === PLAIN_SEAT && aFile.edges[0]!.to === ROLE_SEAT, "A: die eine Kante reist mit", kurz(aFile.edges));
check(aFile.roles.length === 1 && aFile.seats.find((s) => s.id === ROLE_SEAT)?.start.role === ROLE_ID,
  "A: der Rollensitz trägt seinen Rollenstein", `${aFile.roles.length} Rolle(n)`);
check(aFile.packs.find((p) => p.id === shared.id)?.text === SHARED_TEXT, "A: der geteilte Pack reist mit Text und Hash");
check(aFile.concepts.find((c) => c.id === SHARED_CONCEPT)?.text === CONCEPT_TEXT, "A: das geteilte Konzept reist mit Text und Hash");
const privPack = aFile.packs.find((p) => p.id === PERSONAL_PACK), privConcept = aFile.concepts.find((c) => c.id === PERSONAL_CONCEPT);
const privNote = aFile.seats.find((s) => s.id === ROLE_SEAT)?.notebook?.notes.find((x) => x.personal === true);
check(!!privPack && privPack.text === null && privPack.hash === null && privPack.personal === true, "A: der persönliche Pack ist ein leerer Platz");
check(!!privConcept && privConcept.text === null && privConcept.hash === null && privConcept.personal === true, "A: das persönliche Konzept ist ein leerer Platz");
check(!!privNote && privNote.text === null && privNote.hash === null, "A: die persönliche Notiz ist ein leerer Platz");
check(!aFileText.includes(PRIVATE_A), "A: kein persönlicher Text von A steht in der Datei");

const cwdA = startOrdner(A);
const aRole = starteSitz(A, kidA, ROLE_SEAT, SLOTS[0]!, cwdA);
const aPlain = starteSitz(A, kidA, PLAIN_SEAT, SLOTS[1]!, cwdA);
check(texte(aRole).some((t) => t.includes(role.start.text.trim())), "A: der Rollensitz startet mit dem Rollentext");
check(texte(aRole).some((t) => t.includes(CONCEPT_TEXT)), "A: der Rollensitz startet mit dem Konzept");
check(texte(aRole).some((t) => t.includes(PRIVATE_A)), "A: der persönliche Platz ist auf A mit A's Text gefüllt");
check(texte(aRole).some((t) => t.includes(role.rights[0]!)), "A: der Rollensitz trägt das bestätigte Recht", role.rights[0]);
check(!texte(aPlain).some((t) => t.includes(role.start.text.trim())), "A: der Sitz ohne Rolle trägt keinen Rollentext");

// ---------------------------------------------------------------- B: importieren, Rolle bestätigen, Starttexte vergleichen
need(keineKonstellation(B), "B ist ein frisches Zustandsverzeichnis (keine gespeicherte Konstellation)");
const preB = probe(B, "POST", "/api/setups/import", { datei: aFile });
need(preB.status === 200 && preB.json.geschrieben === false, "B: die Vorschau schreibt nichts", kurz(preB.json));
check(keineKonstellation(B), "B: nach der Vorschau steht keine Konstellation im Speicher");
const wroteB = probe(B, "POST", "/api/setups/import", { datei: aFile, schreiben: true });
need(wroteB.status === 201, "B: der Import schreibt den Aufbau", kurz(wroteB.json));
const kidB = String(wroteB.json.konstellation?.id ?? "");
need(!!kidB, "B: der Import nennt die Konstellation", kurz(wroteB.json));
const bForm = formVon(B, kidB);
const bRolePos = bForm?.positionen?.find((p: Record<string, any>) => p.id === ROLE_SEAT);
const bPlainPos = bForm?.positionen?.find((p: Record<string, any>) => p.id === PLAIN_SEAT);
check(bForm?.positionen?.length === 2, "B: der Aufbau hat zwei Sitze", String(bForm?.positionen?.length));
check(bPlainPos?.meldetAn === ROLE_SEAT, "B: die Kante ist angekommen", String(bPlainPos?.meldetAn));
check(bRolePos?.profil?.rolle !== "orchestratorin", "B: der Rollensitz trägt keinen eingebauten Rollennamen", String(bRolePos?.profil?.rolle));
check(Array.isArray(bRolePos?.sitz?.darf?.rolle) && bRolePos.sitz.darf.rolle.length > 0 && bRolePos.sitz.darf.bestaetigt === undefined,
  "B: das Rollenbündel kommt als erbetene Rechte an, nicht als gewährte", kurz(bRolePos?.sitz?.darf));
const freiB = probe(B, "POST", "/api/k15/freigabe", { konst: kidB, pos: ROLE_SEAT });
check(freiB.status === 200, "B: der Owner bestätigt das Rollenbündel durch POST /api/k15/freigabe", kurz(freiB.json));

const cwdB = startOrdner(B);
const bRole = starteSitz(B, kidB, ROLE_SEAT, SLOTS[0]!, cwdB);
const bPlain = starteSitz(B, kidB, PLAIN_SEAT, SLOTS[1]!, cwdB);
check(texte(bRole).some((t) => t.includes(PERSONAL_PACK) && t.includes("person's own") && t.includes("empty here")),
  "B: der Rollensitz nennt seinen leeren persönlichen Pack-Platz");
check(texte(bRole).some((t) => t.includes(PERSONAL_CONCEPT) && t.includes("person's own") && t.includes("empty here")),
  "B: der Rollensitz nennt seinen leeren persönlichen Konzept-Platz");
check(texte(bRole).some((t) => t.includes(RICHTUNG_PLATZ)), "B: der Rollensitz nennt den leeren Richtungsplatz");
check(texte(aRole).some((t) => t.includes(`author: ${sharedConcept.author}`)), "A: der Start nennt den Autor des Konzepts");
check(texte(bRole).some((t) => t.includes(`author: ${sharedConcept.author}`)), "B: der Start nennt denselben Autor des Konzepts");
// der Rollensitz wird erst verglichen, wenn B seinen persönlichen Platz selbst gefüllt hat (unten)
const aPlainClean = ohnePrivat(aPlain, [PRIVATE_A]), bPlainClean = ohnePrivat(bPlain, [PRIVATE_A]);
// bei einer Abweichung nennt die Zeile die erste Stelle, die sich unterscheidet, mit beiden Fassungen
const ersteAbweichung = (a: unknown[], b: unknown[]): string => {
  const i = a.findIndex((x, k) => JSON.stringify(x) !== JSON.stringify(b[k]));
  if (i < 0) return `${a.length}/${b.length}`;
  const x = String(a[i] ?? ""), y = String(b[i] ?? "");
  let c = 0; while (c < x.length && x[c] === y[c]) c++;
  const um = (t: string) => JSON.stringify(t.slice(Math.max(0, c - 60), c + 120));
  return `${a.length}/${b.length}, erste Abweichung in Text [${i}] bei Zeichen ${c}: A ${um(x)} · B ${um(y)}`;
};
check(gleiche(aPlainClean, bPlainClean), "B: die nicht-persönlichen Starttexte des Sitzes ohne Rolle sind byte-gleich mit A", ersteAbweichung(aPlainClean, bPlainClean));
check(!texte(bRole).some((t) => t.includes(PRIVATE_A)), "B: A's persönlicher Text steht nicht im Start");
check(Array.isArray(bRolePos?.sitz?.persoenlich) && bRolePos.sitz.persoenlich.some((p: Record<string, any>) => p.id === PERSONAL_PACK && p.text === null),
  "B: der persönliche Pack-Platz ist leer (kein Text aus der Datei)");
check(Array.isArray(bRolePos?.sitz?.konzepte) && bRolePos.sitz.konzepte.some((c: Record<string, any>) => c.id === PERSONAL_CONCEPT && c.personal === true && c.text === null),
  "B: der persönliche Konzept-Platz ist leer (kein Text aus der Datei)");
check(texte(bRole).some((t) => t.includes(role.rights[0]!)), "B: der Rollensitz startet nach der Freigabe mit dem Rollenrecht", role.rights[0]);

// B's Owner füllt den persönlichen Platz mit seinem eigenen Text, wie A's Owner es tat. Erst dann ist der Rollensitz mit A
// vergleichbar: sein Start nennt die gefüllten Plätze beim Namen, ein leerer Platz fehlt dort (beides gewollt). Verglichen wird
// alles außer den zwei persönlichen Texten, also auch die Zeile, die die Plätze aufzählt.
const PRIVATE_B = "PRIVATE-B: this sentence belongs only to B's owner.";
const eigenesB = probe(B, "GET", "/api/k15/eigenes").json.eigenes as { konstellationen: Record<string, any>[] };
let gefuelltB = 0;
for (const p of eigenesB.konstellationen.find((k) => k.id === kidB)?.positionen ?? [])
  for (const q of p.sitz?.persoenlich ?? []) if (q.id === PERSONAL_PACK) { q.text = PRIVATE_B; gefuelltB++; }
need(gefuelltB === 1, "B: der leere persönliche Platz lässt sich mit B's eigenem Text füllen", String(gefuelltB));
need(probe(B, "PUT", "/api/k15/eigenes", eigenesB).status === 200, "B: B's eigener persönlicher Text ist gespeichert");
const bRoleEigen = starteSitz(B, kidB, ROLE_SEAT, SLOTS[0]!, cwdB);
check(texte(bRoleEigen).some((t) => t.includes(PRIVATE_B)) && !texte(bRoleEigen).some((t) => t.includes(PRIVATE_A)),
  "B: der persönliche Platz startet mit B's eigenem Text, nie mit A's");
const aRoleOhne = ohnePrivat(aRole, [PRIVATE_A, PRIVATE_B]), bRoleOhne = ohnePrivat(bRoleEigen, [PRIVATE_A, PRIVATE_B]);
check(gleiche(aRoleOhne, bRoleOhne), "B: die nicht-persönlichen Starttexte des Rollensitzes sind byte-gleich mit A", ersteAbweichung(aRoleOhne, bRoleOhne));

// ---------------------------------------------------------------- die Kette: B ändern, exportieren, C importieren
const bEigenes = probe(B, "GET", "/api/k15/eigenes").json.eigenes as { konstellationen: Record<string, any>[] };
const bEdit = bEigenes.konstellationen.find((k) => k.id === kidB);
const changed = "You review what the builder builds after B changed this one text.";
const plainInB = bEdit?.positionen?.find((p: Record<string, any>) => p.id === PLAIN_SEAT);
need(!!plainInB?.profil?.datei?.abschnitte?.[0], "B: der Text, den die Kette ändert, ist da");
plainInB.profil.datei.abschnitte[0].text = changed;
const putB = probe(B, "PUT", "/api/k15/eigenes", bEigenes);
need(putB.status === 200, "B: die eine Textänderung ist gespeichert", kurz(putB.json));
const exB = probe(B, "GET", `/api/setups/${encodeURIComponent(kidB)}/datei`);
need(exB.status === 200 && exB.json.datei, "B: der zweite Export liefert die Datei", kurz(exB.json));
const bFile = exB.json.datei as SetupDatei;
check(bFile.setupHash !== aFile.setupHash, "Kette: B's geänderter Körper hat einen anderen setupHash");
check(bFile.concepts.find((c) => c.id === SHARED_CONCEPT)?.author === sharedConcept.author,
  "Kette: das Konzept behält seinen Autor im zweiten Export", String(bFile.concepts.find((c) => c.id === SHARED_CONCEPT)?.author));
check(bFile.seats.find((s) => s.id === PLAIN_SEAT)?.start.purpose?.text === changed, "Kette: der geänderte Text reist im zweiten Export");
check(bFile.derivedFrom === aFile.setupHash, "Kette: B's Datei nennt A's setupHash als derivedFrom", `${String(bFile.derivedFrom).slice(0, 12)} / ${aFile.setupHash.slice(0, 12)}`);
const erwarteteLinie = [...new Set([...(aFile.derivedFrom ? [aFile.derivedFrom] : []), ...(aFile.derivedFromLine ?? [])])];
check(gleiche(bFile.derivedFromLine, erwarteteLinie), "Kette: B's derivedFromLine trägt A's Kopf und Linie", kurz(bFile.derivedFromLine));

const dirC = mkdtempSync(join(tmpdir(), "fleet-rundreise-c-"));
try {
  const impC = await importiereSetup(bFile, { dir: dirC }, { schreiben: true });
  need(impC.status === 201, "C: das dritte frische Zustandsverzeichnis importiert B's Datei", kurz(impC.body));
  const cState = JSON.parse(readFileSync(join(dirC, SPEICHER_DATEI), "utf8")) as { konstellationen?: Record<string, any>[] };
  const cForm = cState.konstellationen?.[0];
  need(!!cForm, "C: die importierte Konstellation steht da");
  const cErwarteteLinie = [...new Set([...(bFile.derivedFrom ? [bFile.derivedFrom] : []), ...(bFile.derivedFromLine ?? [])])];
  check(cForm.setupHash === bFile.setupHash, "C: B's setupHash ist der abgelegte Ursprung", `${String(cForm.setupHash).slice(0, 12)} / ${bFile.setupHash.slice(0, 12)}`);
  check(cForm.abgeleitetVon === bFile.derivedFrom, "C: B's derivedFrom ist abgelegt", `${String(cForm.abgeleitetVon).slice(0, 12)} / ${String(bFile.derivedFrom).slice(0, 12)}`);
  check(gleiche(cForm.derivedFromLine, cErwarteteLinie), "C: B's Kopf und derivedFromLine sind abgelegt", kurz(cForm.derivedFromLine));
  const cExp = setupAusKonstellation(cForm, cForm, [], { dir: dirC });
  if (typeof cExp === "string") check(false, "C: der Export des unveränderten Aufbaus geht", cExp);
  else {
    check(cExp.datei.derivedFrom === bFile.derivedFrom && gleiche(cExp.datei.derivedFromLine, cErwarteteLinie),
      "C: ein unveränderter Export führt dieselbe Kette weiter", `${String(cExp.datei.derivedFrom).slice(0, 12)}`);
    const cRole = cExp.datei.roles.find((r) => r.id === ROLE_ID);
    check(cRole?.hash === role.hash && cExp.datei.seats.find((s) => s.id === ROLE_SEAT)?.start.role === ROLE_ID,
      "C: die Datei trägt denselben Rollenstein wie A", `${String(cRole?.hash).slice(0, 12)} / ${role.hash.slice(0, 12)}`);
  }
} finally { rmSync(dirC, { recursive: true, force: true }); }

// ---------------------------------------------------------------- eigener Agent im fremden Repo: Rolle und Konzept als Steine
const ownRepo = mkdtempSync(join(tmpdir(), "fleet-own-repo-"));
try {
  const git = (a: string[]) => Bun.spawnSync(["git", ...a], { cwd: ownRepo, env: { ...process.env, GIT_AUTHOR_NAME: "rundreise", GIT_AUTHOR_EMAIL: "rundreise@invalid",
    GIT_COMMITTER_NAME: "rundreise", GIT_COMMITTER_EMAIL: "rundreise@invalid" } });
  need(git(["init", "-q", "-b", "main"]).exitCode === 0, "eigenes Repo: git init");
  writeFileSync(join(ownRepo, "README.md"), "# own repo\n");
  git(["add", "README.md"]);
  need(git(["commit", "-q", "-m", "start"]).exitCode === 0, "eigenes Repo: erster Commit");
  const ag = probe(B, "POST", "/api/agenten", { name: "Stein-Agent", wahlen: { rolle: ROLE_ID, konzepte: [SHARED_CONCEPT], permissionMode: "auto" } });
  need(ag.status === 201 && ag.json.agent?.id, "eigener Agent: mit Rolle und Konzept angelegt", kurz(ag.json));
  const aid = String(ag.json.agent.id);
  const own = starteMit(B, SLOTS[0]!, { cwd: ownRepo, agent: aid }, "eigener Agent im fremden Repo");
  const ownTexts = texte(own);
  check(ownTexts.some((t) => t.includes(role.start.text.trim())), "eigener Agent: der Start zeigt den Rollentext");
  check(ownTexts.some((t) => t.includes(CONCEPT_TEXT)), "eigener Agent: der Start zeigt das Konzept als Stein");
  check(ownTexts.some((t) => t.includes(RICHTUNG_PLATZ)), "eigener Agent: der Start zeigt den leeren Richtungsplatz");
  check(own.wahlen?.permissionMode !== "bypassPermissions" && !JSON.stringify(own).includes("bypassPermissions"),
    "eigener Agent: er läuft nicht in bypass", String(own.wahlen?.permissionMode ?? "kein Modus"));
} finally { rmSync(ownRepo, { recursive: true, force: true }); }

if (failed) { console.error(`${failed} Prüfung(en) rot — RUNDREISE ROT`); process.exit(1); }
console.log("RUNDREISE GRÜN");
