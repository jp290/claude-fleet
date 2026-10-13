// Neuaufbau K5 · Task = Branch. Owner 11.10.: „[Zitat entfernt]“
// . Bauleitung 13.10.: Punkte
// gehören zu (Repo, Branch), nicht zum Worktree-Pfad; am Branch steht „Owner hat gesehen / passt“
// (wer, wann, an welchem Commit). Entwurf K2: ein Name, der im Repo schon vergeben ist, wird
// abgewiesen; K4: genau eine Punkteliste, kein Punkt geht verloren.
import { describe, expect, test } from "bun:test";
import {
  adoptNotes, BRANCH_NAME_MAX, BRANCH_OTHERS_MAX, BRANCH_TEXT_MAX, type BranchBook, type BranchRecord, dropBranch, findBranch,
  markSeen, openBranch, pruneBook, repoBranches, restoreBook, writeText,
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
    const good: BranchRecord = { repo: REPO, branch: "a", name: "A", base: "main", text: "", rev: 1, seen: null, createdAt: at, updatedAt: at };
    expect(restoreBook("kaputt")).toEqual([]);
    expect(restoreBook([good, { ...good, branch: 7 }, null, { ...good, branch: "c", seen: { at, head: "x", via: "cookie" } },
      { ...good, branch: "d", rev: -1 }])).toEqual([good]);
  });
  test("zwei Einträge für denselben Branch: der erste gilt", () => {
    const good: BranchRecord = { repo: REPO, branch: "a", name: "A", base: null, text: "", rev: 1, seen: null, createdAt: at, updatedAt: at };
    expect(restoreBook([good, { ...good, name: "B" }])).toEqual([good]);
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
    }).not.toThrow();
    expect(findBranch(book, REPO, "b")?.text).toBe("- [ ] eins");
  });
});
