// Neuaufbau K5 · Task = Branch. Owner 11.10.: „[Zitat entfernt]“
// . Bauleitung 13.10.: Punkte
// gehören zu (Repo, Branch), nicht zum Worktree-Pfad; am Branch steht „Owner hat gesehen / passt“
// (wer, wann, an welchem Commit). Entwurf K2: ein Name, der im Repo schon vergeben ist, wird
// abgewiesen; K4: genau eine Punkteliste, kein Punkt geht verloren.
import { describe, expect, test } from "bun:test";
import {
  adoptNotes, BRANCH_NAME_MAX, BRANCH_OTHERS_MAX, BRANCH_TEXT_MAX, type BranchBook, type BranchLand, type BranchRecord, chargeBase,
  chargeMessage, doneSinceLastLand, dropBranch, findBranch, markSeen, openBranch, openedBy, pruneBook, recordLand, repoBranches, restoreBook, setLandForm,
  setOpener, usableCheck, writeText,
} from "./branches";

const REPO = "/r/fleet";
const OTHER = "/r/Fremdprojekt";
const HEAD = "a".repeat(40);
const at = 1_760_000_000_000;

function opened(book: BranchBook, branch: string, name: string, points: string[] = [], repo = REPO): BranchBook {
  const r = openBranch(book, { repo, branch, name, base: "main", points, at });
  if (!r.ok) throw new Error(`openBranch ${branch}: ${r.error}`);
  return r.book;
}
function deepFreeze(book: BranchBook): BranchBook {
  for (const r of book) { Object.freeze(r.seen); Object.freeze(r); }
  return Object.freeze(book);
}

describe("Name: eindeutig je Repo", () => {
  test("ein zweiter Branch mit demselben Namen wird abgewiesen und nennt den vorhandenen", () => {
    const book = opened([], "fleet/branch-a", "Snappiness");
    const r = openBranch(book, { repo: REPO, branch: "fleet/branch-b", name: "  snappiness ", base: "main", points: [], at });
    expect(r).toEqual({ ok: false, status: 409, error: expect.stringContaining("Snappiness"),
      existing: { branch: "fleet/branch-a", name: "Snappiness" } });
  });
  test("derselbe Name in einem anderen Repo ist frei", () => {
    const book = opened([], "fleet/branch-a", "Snappiness");
    expect(openBranch(book, { repo: OTHER, branch: "fleet/branch-a", name: "Snappiness", base: "main", points: [], at }).ok).toBe(true);
  });
  test("ein Branch, der seinen eigenen Namen noch einmal bekommt, bleibt ein Datensatz", () => {
    const book = opened(opened([], "bau/k5", "Task = Branch"), "bau/k5", "Task = Branch");
    expect(book.map((r) => [r.branch, r.name])).toEqual([["bau/k5", "Task = Branch"]]);
  });
  test("Leerraum wird zusammengezogen; leer, zu lang und Steuerzeichen werden abgewiesen", () => {
    expect(findBranch(opened([], "b", "  Kritik   Probe "), REPO, "b")?.name).toBe("Kritik Probe");
    for (const name of ["", "   ", "x".repeat(BRANCH_NAME_MAX + 1), "a\u0007b"]) {
      const r = openBranch([], { repo: REPO, branch: "b", name, base: "main", points: [], at });
      expect(r.ok ? "angenommen" : r.status).toBe(400);
    }
  });
});

describe("Punkte: eine Liste, kein Punkt geht verloren", () => {
  test("die Punkte aus dem Öffnen stehen als offene Zeilen im Text", () => {
    const rec = findBranch(opened([], "b", "Probe", ["Datei anlegen", "  Readme ergänzen  ", ""]), REPO, "b");
    expect(rec?.text).toBe("- [ ] Datei anlegen\n- [ ] Readme ergänzen");
    expect(rec?.rev).toBe(1);
  });
  test("ein bestehender Branch mit Text bekommt neue Punkte angehängt, nichts wird ersetzt", () => {
    const first = opened([], "b", "Probe", ["eins"]);
    const w = writeText(first, REPO, "b", "- [x] eins\nNotiz", 1, at);
    if (!w.ok) throw new Error(w.error);
    expect(findBranch(opened(w.book, "b", "Probe", ["zwei"]), REPO, "b")?.text).toBe("- [x] eins\nNotiz\n- [ ] zwei");
  });
  test("Schreiben mit dem gelesenen Stand gelingt und zählt den Stand hoch", () => {
    const w = writeText(opened([], "b", "Probe", ["eins"]), REPO, "b", "- [x] eins", 1, at + 1);
    expect(w.ok && [w.record.text, w.record.rev, w.record.updatedAt]).toEqual(["- [x] eins", 2, at + 1]);
  });
  test("Schreiben auf einem veralteten Stand wird abgewiesen, der gespeicherte Text bleibt und kommt mit", () => {
    const book = opened([], "b", "Probe", ["eins"]);
    const phone = writeText(book, REPO, "b", "- [ ] eins\n- [ ] vom Telefon", 1, at);
    if (!phone.ok) throw new Error(phone.error);
    const desk = writeText(phone.book, REPO, "b", "- [x] eins", 1, at);
    expect(desk.ok ? "angenommen" : [desk.status, desk.current?.text, desk.current?.rev])
      .toEqual([409, "- [ ] eins\n- [ ] vom Telefon", 2]);
  });
  test("ein Branch ohne Datensatz bekommt beim ersten Schreiben mit Stand 0 einen", () => {
    const w = writeText([], REPO, "fleet/lose", "- [ ] erst", 0, at);
    expect(w.ok && [w.record.name, w.record.text, w.record.rev]).toEqual([null, "- [ ] erst", 1]);
  });
  test("über dem Deckel wird abgewiesen und nichts gekürzt", () => {
    const book = opened([], "b", "Probe", ["eins"]);
    const w = writeText(book, REPO, "b", "x".repeat(BRANCH_TEXT_MAX + 1), 1, at);
    expect(w.ok ? "angenommen" : w.status).toBe(400);
    expect(findBranch(book, REPO, "b")?.text).toBe("- [ ] eins");
  });
  test("neue Punkte über den Deckel hinaus werden beim Öffnen abgewiesen", () => {
    const r = openBranch([], { repo: REPO, branch: "b", name: "Probe", base: "main", points: ["x".repeat(BRANCH_TEXT_MAX)], at });
    expect(r.ok ? "angenommen" : r.status).toBe(400);
  });
});

describe("passt: wer, wann, an welchem Commit", () => {
  test("passt hält Zeit, Commit und Weg fest", () => {
    const s = markSeen(opened([], "b", "Probe"), REPO, "b", HEAD, "cookie", at + 5);
    expect(s.ok && s.record.seen).toEqual({ at: at + 5, head: HEAD, via: "cookie" });
  });
  test("ein Commit, der keine volle SHA ist, wird abgewiesen", () => {
    const s = markSeen(opened([], "b", "Probe"), REPO, "b", "abc123", "cookie", at);
    expect(s.ok ? "angenommen" : s.status).toBe(400);
  });
  test("ein späteres passt ersetzt das frühere", () => {
    const one = markSeen(opened([], "b", "Probe"), REPO, "b", HEAD, "cookie", at);
    if (!one.ok) throw new Error(one.error);
    const two = markSeen(one.book, REPO, "b", "b".repeat(40), "bearer", at + 9);
    expect(two.ok && two.record.seen).toEqual({ at: at + 9, head: "b".repeat(40), via: "bearer" });
  });
});

describe("Altbestand: Notizblöcke je Pfad wandern auf ihren Branch", () => {
  const notes = { "/wt/k5": "- [ ] alt", "/wt/weg": "verwaist" };
  const branchAt = new Map([["/wt/k5", { repo: REPO, branch: "bau/k5" }]]);

  test("eine Notiz auf einem Worktree mit Branch wird dessen Text; die alte Liste bleibt unberührt", () => {
    const frozen = Object.freeze({ ...notes });
    const r = adoptNotes([], frozen, branchAt, at);
    expect(findBranch(r.book, REPO, "bau/k5")?.text).toBe("- [ ] alt");
    expect(r.orphans).toEqual(["/wt/weg"]);
    expect(frozen).toEqual(notes);
  });
  test("zweimal umschlüsseln ergibt denselben Stand", () => {
    const once = adoptNotes([], notes, branchAt, at).book;
    expect(adoptNotes(once, notes, branchAt, at + 1000).book).toEqual(once);
  });
  test("ein Branch, der schon einen Datensatz hat, behält seinen Text, auch einen geleerten", () => {
    const w = writeText([], REPO, "bau/k5", "- [x] neu", 0, at);
    if (!w.ok) throw new Error(w.error);
    expect(findBranch(adoptNotes(w.book, notes, branchAt, at).book, REPO, "bau/k5")?.text).toBe("- [x] neu");
    const cleared = writeText(w.book, REPO, "bau/k5", "", 1, at);
    if (!cleared.ok) throw new Error(cleared.error);
    expect(findBranch(adoptNotes(cleared.book, notes, branchAt, at).book, REPO, "bau/k5")?.text).toBe("");
  });
});

describe("Lebensdauer: der Datensatz endet nur mit dem Branch", () => {
  test("ohne Branch-Ref fällt er weg, in einem unlesbaren Repo bleibt er", () => {
    const book = opened(opened(opened([], "lebt", "A"), "weg", "B"), "weg", "C", [], OTHER);
    const alive = (repo: string, branch: string): boolean | null => repo === OTHER ? null : branch === "lebt";
    expect(pruneBook(book, alive).map((r) => `${r.repo} ${r.branch}`)).toEqual([`${REPO} lebt`, `${OTHER} weg`]);
  });
  test("dropBranch nimmt genau diesen Branch heraus", () => {
    const book = opened(opened([], "a", "A"), "b", "B");
    expect(dropBranch(book, REPO, "a").map((r) => r.branch)).toEqual(["b"]);
  });
});

describe("Sicht je Repo: Board-Branches und die übrigen", () => {
  const ref = (branch: string, at_: number) => ({ branch, head: HEAD, at: at_ });
  test("ein benannter Branch steht mit seinem Worktree bei den Board-Branches, auch ohne Worktree", () => {
    const book = opened(opened([], "bau/k5", "Task = Branch"), "fleet/weg", "Ohne Worktree");
    const v = repoBranches(book, REPO, [ref("main", 9), ref("bau/k5", 5), ref("fleet/weg", 4)],
      [{ path: "/r/fleet", branch: "main", primary: true }, { path: "/wt/k5", branch: "bau/k5", primary: false }]);
    expect(v.named.map((n) => [n.record.name, n.path])).toEqual([["Task = Branch", "/wt/k5"], ["Ohne Worktree", null]]);
    expect(v.others).toEqual([]);
  });
  test("ein Datensatz ohne lebenden Branch und einer aus einem anderen Repo erscheinen nicht", () => {
    const book = opened(opened([], "fleet/tot", "Tot"), "x", "Fremd", [], OTHER);
    expect(repoBranches(book, REPO, [ref("main", 1)], []).named).toEqual([]);
  });
  test("übrig sind die Branches ohne Board-Namen außer dem Haupt-Checkout, jüngster zuerst, gedeckelt mit Gesamtzahl", () => {
    const refs = [ref("main", 1000), ...Array.from({ length: BRANCH_OTHERS_MAX + 2 }, (_, i) => ref(`f${i}`, i))];
    const migrated = adoptNotes([], { "/wt/f3": "- [ ] alt" }, new Map([["/wt/f3", { repo: REPO, branch: "f3" }]]), at).book;
    const v = repoBranches(migrated, REPO, refs, [{ path: "/r/fleet", branch: "main", primary: true }, { path: "/wt/f3", branch: "f3", primary: false }]);
    expect(v.othersTotal).toBe(BRANCH_OTHERS_MAX + 2);
    expect(v.others.length).toBe(BRANCH_OTHERS_MAX);
    expect(v.others[0]).toEqual({ ...ref(`f${BRANCH_OTHERS_MAX + 1}`, BRANCH_OTHERS_MAX + 1), path: null });
    expect(v.others.find((o) => o.branch === "f3")?.path).toBe("/wt/f3");
    expect(v.others.some((o) => o.branch === "main")).toBe(false);
  });
});

describe("Persistenz", () => {
  test("ein gespeicherter Stand kommt gleich zurück", () => {
    const s = markSeen(opened(opened([], "a", "A", ["eins"]), "b", "B"), REPO, "a", HEAD, "cookie", at);
    if (!s.ok) throw new Error(s.error);
    expect(restoreBook(JSON.parse(JSON.stringify(s.book)))).toEqual(s.book);
  });
  test("Kaputtes fällt beim Laden heraus, Gültiges bleibt", () => {
    const good: BranchRecord = { repo: REPO, branch: "a", name: "A", base: "main", text: "", rev: 1, seen: null, lands: [], createdAt: at, updatedAt: at };
    expect(restoreBook("kaputt")).toEqual([]);
    expect(restoreBook([good, { ...good, branch: 7 }, null, { ...good, branch: "c", seen: { at, head: "x", via: "cookie" } },
      { ...good, branch: "d", rev: -1 }])).toEqual([good]);
  });
  test("zwei Einträge für denselben Branch: der erste gilt", () => {
    const good: BranchRecord = { repo: REPO, branch: "a", name: "A", base: null, text: "", rev: 1, seen: null, lands: [], createdAt: at, updatedAt: at };
    expect(restoreBook([good, { ...good, name: "B" }])).toEqual([good]);
  });
});

describe("Chargen: jede zählt ab dem Tip der letzten", () => {
  const T1 = "1".repeat(40), T2 = "2".repeat(40), M1 = "c".repeat(40);
  const land = (tip: string, points: string[]): BranchLand =>
    ({ sha: M1, at, tip, base: "main", subject: "Charge", points, passt: false, checked: true });
  test("die erste Charge zählt ab der Basis des Branches, sonst ab dem Integrationszweig; jede weitere ab dem letzten Tip", () => {
    const book = opened([], "b", "Probe");
    expect(chargeBase(findBranch(book, REPO, "b"), "main")).toBe("main");
    const withBase = openBranch([], { repo: REPO, branch: "b", name: "Probe", base: "bau/neuaufbau", points: [], at });
    expect(withBase.ok && chargeBase(withBase.record, "main")).toBe("bau/neuaufbau");
    const landed = recordLand(book, REPO, "b", land(T1, []));
    expect(chargeBase(landed.record, "main")).toBe(T1);
    expect(chargeBase(recordLand(landed.book, REPO, "b", land(T2, [])).record, "main")).toBe(T2);
    expect(chargeBase(undefined, null)).toBeNull();
  });
  test("eine Charge nennt nur die Punkte, die seit der letzten erledigt wurden", () => {
    const w = writeText(opened([], "b", "Probe"), REPO, "b", "- [x] eins\n- [x] zwei\n- [ ] drei\nfreier Text", 0, at);
    if (!w.ok) throw new Error(w.error);
    expect(doneSinceLastLand(w.record)).toEqual(["eins", "zwei"]);
    const landed = recordLand(w.book, REPO, "b", land(T1, ["eins", "zwei"]));
    const later = writeText(landed.book, REPO, "b", "- [x] eins\n- [x] zwei\n- [x] drei", landed.record.rev, at);
    expect(later.ok && doneSinceLastLand(later.record)).toEqual(["drei"]);
  });
  test("der Charge-Commit trägt den Betreff, die Commits des Branches und den passt-Stand", () => {
    const msg = chargeMessage("  Snappiness: Messung vorher  ", { branch: "branch/snap", tip: T1, passt: true, checked: false,
      commits: [{ sha: "a".repeat(40), subject: "Vorher-Messung" }, { sha: "b".repeat(40), subject: "Plan" }] });
    expect(msg).toBe(["Snappiness: Messung vorher", "", "Charge aus branch/snap bis 11111111 (ohne Merge-Check):",
      "- aaaaaaaa Vorher-Messung", "- bbbbbbbb Plan", "", "Owner hat diesen Stand gesehen: passt (11111111)."].join("\n"));
    expect(chargeMessage("X", { branch: "b", tip: T1, passt: false, checked: true, commits: [] })).toContain("nicht als „passt“");
  });
  test("ein Land kommt mit dem Stand zurück, ein kaputtes fällt heraus", () => {
    const landed = recordLand(opened([], "b", "Probe"), REPO, "b", land(T1, ["eins"])).book;
    const raw = JSON.parse(JSON.stringify(landed)) as Record<string, unknown>[];
    expect(restoreBook(raw)).toEqual(landed);
    raw[0]!.lands = [{ ...land(T1, []), tip: "kurz" }, land(T2, [])];
    expect(restoreBook(raw)[0]?.lands.map((l) => l.tip)).toEqual([T2]);
  });
});

// K16 Runde 4, Bauleitung e194d4b3: „alle Commits“ oder „ein Commit“ ist eine Wahl am Branch, nicht im
// Browser; Vorgabe ein Commit. Sie überdauert das Laden; ein Land sagt, in welcher Form es kam.
describe("Land-Form am Branch: alle Commits oder ein Commit", () => {
  test("die Wahl steht am Datensatz und kommt beim Laden zurück; ein unbekannter Wert fällt beim Laden weg", () => {
    const book = opened([], "b", "Probe");
    expect(findBranch(book, REPO, "b")?.landForm).toBeUndefined();
    const set = setLandForm(book, REPO, "b", "commits", at + 1);
    expect([set.record.landForm, set.record.updatedAt, set.record.text]).toEqual(["commits", at + 1, findBranch(book, REPO, "b")?.text]);
    expect(findBranch(book, REPO, "b")?.landForm).toBeUndefined(); // der alte Stand bleibt
    expect(restoreBook(JSON.parse(JSON.stringify(set.book)))).toEqual(set.book);
    const raw = JSON.parse(JSON.stringify(set.book)) as Record<string, unknown>[];
    raw[0]!.landForm = "alles";
    expect(restoreBook(raw)[0]?.landForm).toBeUndefined();
    expect(restoreBook(raw)[0]?.name).toBe("Probe");
  });
  test("ein Land trägt seine Form; eines ohne Form (vor K16) kommt ohne zurück, eines mit kaputter Form fällt heraus", () => {
    const l = { sha: "c".repeat(40), at, tip: "1".repeat(40), base: "main", subject: "Reihe", points: [], passt: false, checked: true };
    const landed = recordLand(opened([], "b", "Probe"), REPO, "b", { ...l, form: "commits" }).book;
    expect(restoreBook(JSON.parse(JSON.stringify(landed)))[0]?.lands[0]?.form).toBe("commits");
    const raw = JSON.parse(JSON.stringify(landed)) as Record<string, unknown>[];
    raw[0]!.lands = [l, { ...l, tip: "2".repeat(40), form: "beides" }];
    expect(restoreBook(raw)[0]?.lands).toEqual([l]);
  });
});

describe("Merge-Check-Zeile: nur genau dieser Tip, diese Basis, dieser main", () => {
  const T = "1".repeat(40), M = "2".repeat(40), C = "3".repeat(40), TR = "4".repeat(40), K1 = "5".repeat(40);
  const want = { branch: "bau/x", base: "main", tip: T, main: M };
  const row = (o: Record<string, unknown> = {}) => ({ at, branch: "bau/x", base: "main", tip: T, main: M, candidate: C, tree: TR,
    commits: [K1, T], verdict: "green", mergeable: true, why: "main grün", ...o });
  test("grün auf diesem Tip gegen diese Basis bei diesem main: verwendbar, mit Kandidat, Baum und den geprüften Commits", () => {
    expect(usableCheck([row()], want)).toEqual({ ok: true, row: { tip: T, base: "main", main: M, candidate: C, tree: TR, at, commits: [K1, T] } });
    expect(usableCheck([row({ commits: [] })], want)).toMatchObject({ ok: true, row: { commits: [] } });
  });
  // was der Owner sieht, wird gemergt: die Liste der Zeile ist die einzige, die zum Baum des Kandidaten passt
  test("eine Zeile ohne die Liste ihrer Commits, oder mit einer kaputten, ist nicht verwendbar", () => {
    for (const commits of [undefined, "x", [K1, "kurz"], [K1, 7]])
      expect(usableCheck([row({ commits })], want)).toEqual({ ok: false, why: expect.stringContaining("neu prüfen") });
  });
  test("die jüngste Zeile zählt: ein späteres Rot sticht ein früheres Grün", () => {
    expect(usableCheck([row(), row({ verdict: "red", mergeable: false, why: "rot: s1" })], want))
      .toEqual({ ok: false, why: expect.stringContaining("rot: s1") });
  });
  test("keine Zeile, anderer Tip, andere Basis, weitergelaufener main: nicht verwendbar", () => {
    expect(usableCheck([], want).ok).toBe(false);
    expect(usableCheck([row({ tip: "9".repeat(40) })], want).ok).toBe(false);
    expect(usableCheck([row({ base: "bau/neuaufbau" })], want)).toEqual({ ok: false, why: expect.stringContaining("neu prüfen") });
    expect(usableCheck([row({ main: "8".repeat(40) })], want)).toEqual({ ok: false, why: expect.stringContaining("main ist") });
    expect(usableCheck([row({ branch: "bau/y" })], want).ok).toBe(false);
  });
});

describe("keine Funktion verändert den Stand, den sie bekommt", () => {
  test("Öffnen, Schreiben, passt, Umschlüsseln, Aufräumen auf einem eingefrorenen Stand", () => {
    const book = deepFreeze(opened([], "b", "Probe", ["eins"]));
    expect(() => {
      openBranch(book, { repo: REPO, branch: "b", name: "Probe", base: "main", points: ["zwei"], at });
      writeText(book, REPO, "b", "- [x] eins", 1, at);
      markSeen(book, REPO, "b", HEAD, "cookie", at);
      adoptNotes(book, { "/wt/b": "x" }, new Map([["/wt/b", { repo: REPO, branch: "neu" }]]), at);
      pruneBook(book, () => false);
      dropBranch(book, REPO, "b");
      recordLand(book, REPO, "b", { sha: HEAD, at, tip: HEAD, base: "main", subject: "x", points: [], passt: false, checked: false });
    }).not.toThrow();
    expect(findBranch(book, REPO, "b")?.text).toBe("- [ ] eins");
  });
});

// Neuaufbau K13: Wer einen Branch über die Tür öffnet, steht an ihm, damit er und die Session darauf sich im
// Postfach schreiben. Der Öffner ist ein Sitz (Slot und Ordner): Eine Nachfolge behält beides, ein anderer
// Ordner im selben Slot ist jemand anderes.
describe("Öffner: Slot und Ordner der Session, die den Branch öffnet", () => {
  const LEAD = { slot: 2, cwd: "/w/bau-neuaufbau" };
  test("der Öffner steht am Branch, übersteht das Speichern und findet seine Branches wieder", () => {
    const book = setOpener(opened(opened([], "a", "A", ["eins"]), "b", "B"), REPO, "a", { ...LEAD, at }).book;
    expect(findBranch(book, REPO, "a")?.opener).toEqual({ ...LEAD, at });
    expect(findBranch(book, REPO, "a")?.text).toBe("- [ ] eins");
    expect(findBranch(book, REPO, "b")?.opener).toBeUndefined();
    expect(restoreBook(JSON.parse(JSON.stringify(book)))).toEqual(book);
    expect(openedBy(book, LEAD).map((r) => r.branch)).toEqual(["a"]);
    expect(openedBy(book, { slot: 2, cwd: "/w/anderswo" })).toEqual([]);
    expect(openedBy(book, { slot: 3, cwd: LEAD.cwd })).toEqual([]);
  });
  test("eine andere Session, die neu öffnet, wird Öffner; der alte Stand bleibt unberührt", () => {
    const first = deepFreeze(setOpener(opened([], "a", "A"), REPO, "a", { ...LEAD, at }).book);
    const second = setOpener(first, REPO, "a", { slot: 4, cwd: "/w/other", at: at + 1 }).book;
    expect(findBranch(second, REPO, "a")?.opener).toEqual({ slot: 4, cwd: "/w/other", at: at + 1 });
    expect(findBranch(first, REPO, "a")?.opener).toEqual({ ...LEAD, at });
    expect(openedBy(second, LEAD)).toEqual([]);
  });
  test("ein kaputter Öffner fällt beim Laden heraus, der Datensatz bleibt", () => {
    const good: BranchRecord = { repo: REPO, branch: "a", name: "A", base: null, text: "", rev: 1, seen: null, lands: [], createdAt: at, updatedAt: at };
    expect(restoreBook([{ ...good, opener: { slot: 0, cwd: "/w", at } }, { ...good, branch: "b", opener: { slot: 2, cwd: "", at } }]))
      .toEqual([good, { ...good, branch: "b" }]);
  });
});
