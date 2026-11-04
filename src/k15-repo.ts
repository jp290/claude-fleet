// K15 · WO DIE NEUE SESSION STARTET (Owner 16.10. 00:5x: „[Zitat entfernt]“
// ; „[Zitat entfernt]“
// ). Der Kopf des Fensters liest sich so; darunter stehen klein Branch,
// offene Änderungen und der letzte Commit (GET /api/dirinfo). Die Auswahl nennt die Repos mit laufender Session und die gepinnten, am
// Ende „Repo hinzufügen …“: eine Ordnerwahl über GET /api/dirs, die per POST /api/pins pinnt. Keine neue Route.
import { api, el, baseName, agoDe } from "./k15-haupt";
import { icon } from "./icons";
import { projectHue } from "./marks";
import { info, oeffneOrdner, ordnerSatz, pinne, plural, render, repoZeilen, S, tilde, type Ordner, type St } from "./k15-zustand";
import { startSchliesst } from "./start-fenster";

const knopf = (cls: string): HTMLButtonElement => {
  const b = el("button", cls) as HTMLButtonElement;
  b.type = "button";
  return b;
};
const punkt = (repo: string): HTMLElement => {
  const dot = el("i", "fddot");
  dot.style.setProperty("--proj-h", String(projectHue(repo)));
  return dot;
};

// DER KOPF: „Neue Session in [Repo ▾]“ und darunter der Stand des Repos
export function repoKopf(s: St): void {
  const h2 = s.shell.root.querySelector(".shelltitles h2");
  const sub = s.shell.root.querySelector(".shellsub");
  if (!h2 || !sub) return;
  const b = el("button", `k15wo${s.repoMenu ? " on" : ""}`);
  b.setAttribute("aria-haspopup", "menu");
  b.setAttribute("aria-expanded", String(s.repoMenu));
  if (s.repo) b.dataset.repo = s.repo;
  b.title =s.repo ? `${baseName(s.repo)} · ${tilde(s.repo)}: choose another repo` : "Choose a repo";
  b.append(...(s.repo ? [punkt(s.repo)] : []), el("span", "k15wor", s.repo ? baseName(s.repo) : "Choose a repo"), icon("chevron"));
  b.onclick = () => { s.repoMenu = !s.repoMenu; s.ordner = null; render(); };
  h2.replaceChildren(el("span", "k15woi", "New session in"), b);
  sub.replaceChildren(...repoStand(s));
}
// Branch, offene Änderungen, voraus/zurück, Worktrees und der letzte Commit, klein in einer Zeile; der Pfad im Title
function repoStand(s: St): HTMLElement[] {
  if (!s.repo) return [el("span", "", s.pins === null ? "Reading your repos …" : "No repo yet: choose one above or add one.")];
  const i = info(s, s.repo);
  if (i === "laedt") return [el("span", "", "reading …")];
  if ("fehler" in i) return [el("span", "", `not readable: ${i.fehler}`)];
  if (!i.exists) return [el("span", "", "The folder no longer exists.")];
  if (!i.git) return [el("span", "", "Not a git repo: your agent works in the folder itself.")];
  const stand = el("span", "k15wos", [i.branch ? `Branch ${i.branch}` : i.last ? "no branch" : "no commit yet",
    i.dirty ? plural(i.dirty, "open change", "open changes") : "nothing open",
    ...(i.ahead ? [`${i.ahead} ahead`] : []), ...(i.behind ? [`${i.behind} behind`] : []),
    ...(i.lanes ? [plural(i.lanes, "Worktree", "Worktrees")] : [])].join(" · "));
  stand.title = tilde(s.repo);
  if (!i.last) return [stand];
  const c = el("span", "k15woc", `${agoDe(Date.now() - i.last.ts)}: ${i.last.subject}`);
  c.title = `last commit ${i.last.hash} ${i.last.subject}`;
  return [stand, el("span", "k15wopf", "·"), c];
}

// DIE AUSWAHL: liegt im Fenster unter dem Kopf; zu geht sie per Klick daneben, Escape oder Wahl
export function repoMenue(s: St): HTMLElement | null {
  if (!s.repoMenu) return null;
  const m = el("div", "k15repomenu");
  m.setAttribute("role", "menu");
  m.setAttribute("aria-label", "Repo of the new session");
  if (s.ordner) { m.append(ordnerWahl(s, s.ordner)); return m; }
  const zeilen = repoZeilen(s);
  for (const z of zeilen) if (z.gepinnt && !z.sessions) info(s, z.repo);
  for (const z of zeilen) {
    const on = z.repo === s.repo;
    const r = el("div", `k15repo${on ? " on" : ""}`);
    r.dataset.repo = z.repo;
    const b = el("button", "k15repob");
    b.setAttribute("role", "menuitemradio");
    b.setAttribute("aria-checked", String(on));
    b.title = `${baseName(z.repo)} · ${tilde(z.repo)}`;
    const t = el("span", "k15kt");
    t.append(el("span", "k15kn", baseName(z.repo)),
      el("span", "k15ks", `${z.sessions ? plural(z.sessions, "session running", "sessions running") : "no session"}${z.gepinnt ? " · pinned" : ""}`));
    b.append(punkt(z.repo), t, ...(on ? [icon("check")] : []));
    b.onclick = () => { s.repoMenu = false; if (s.repo !== z.repo) s.repo = z.repo;
      render(); };
    r.append(b);
    if (z.gepinnt && !z.sessions) {
      const x = el("button", "k15repox");
      x.title = `Remove ${baseName(z.repo)} from the list; the folder stays`;
      x.setAttribute("aria-label", x.title);
      x.append(icon("x"));
      x.onclick = () => { void pinne(s, z.repo, false); };
      r.append(x);
    }
    m.append(r);
  }
  if (!zeilen.length) m.append(el("div", "k15leer", s.pins === null ? "Reading your repos …" : "No repo yet: add one."));
  const neu = el("button", "k15repoplus");
  neu.setAttribute("role", "menuitem");
  neu.append(icon("plus"), el("span", "", "Add repo …"));
  neu.onclick = () => { void oeffneOrdner(s, "~"); };
  m.append(neu);
  return m;
}
// unter den Kopf legen, sobald beide im Fenster stehen
export function legeMenue(s: St, m: HTMLElement): void {
  const win = s.shell.root.querySelector<HTMLElement>(".shellwin");
  const b = s.shell.root.querySelector<HTMLElement>(".k15wo");
  if (!win || !b) return;
  win.append(m);
  const a = b.getBoundingClientRect(), w = win.getBoundingClientRect();
  m.style.top = `${a.bottom - w.top + 6}px`;
  m.style.left = `${Math.max(8, Math.min(a.left - w.left, w.width - m.offsetWidth - 8))}px`;
}
// ein Klick neben die Auswahl schließt sie; Escape schließt erst sie, dann das Fenster
export function menueZu(s: St, signal: AbortSignal): void {
  document.addEventListener("pointerdown", (e) => {
    if (!s.repoMenu || !(e.target instanceof Element) || e.target.closest(".k15repomenu, .k15wo")) return;
    s.repoMenu = false;
    s.ordner = null;
    render();
  }, { capture: true, signal });
  s.shell.setCloseGuard(() => {
    // Escape closes the menu first, then the window (which may hold back for unsaved text, src/start-fenster.ts#startSchliesst)
    if (!s.repoMenu) return startSchliesst(s);
    s.repoMenu = false;
    s.ordner = null;
    render();
    return true;
  });
}

// THE PATH FIELD (orchestrator 3.11.: a stranger knows where their folder is and should not walk the tree): a path typed or pasted is read by the
// same door the tree uses (GET /api/dirs: `~` and a trailing slash are its to take) and, if it is a folder, pinned and chosen like the tree's Add
// (POST /api/pins, k15-zustand.ts#pinne). A refusal is one sentence under the field and nothing else happens.
// The window morphs its redraws (src/dom-morph.ts): the field stays the same element, so a handler reads it from its event, never from `inp`.
const FELD = 'input[data-feld="ordnerpfad"]';
// the field and its sentence in view: in a list longer than the window they stand below the fold, where a refusal would go unseen
const feldZeigen = (s: St): void => { s.shell.root.querySelector(".k15ordnfw")?.scrollIntoView({ block: "nearest" }); };
const feldVon = (s: St): HTMLInputElement | null => s.shell.root.querySelector<HTMLInputElement>(FELD);
function pfadFeld(s: St, o: Ordner): HTMLElement {
  const wrap = el("div", "k15ordnfw");
  const form = el("form", "k15ordnf") as HTMLFormElement;
  form.noValidate = true;
  const inp = el("input", "k15ordni") as HTMLInputElement;
  inp.type = "text";
  inp.dataset.feld = "ordnerpfad";
  inp.placeholder = "~/path/to/folder";
  inp.value = o.eingabe ?? "";
  inp.setAttribute("aria-label", "Path of a folder");
  inp.autocomplete = "off";
  inp.spellcheck = false;
  inp.setAttribute("autocapitalize", "off");
  inp.setAttribute("autocorrect", "off");
  inp.oninput = (e) => {
    const f = e.currentTarget as HTMLInputElement, a = s.ordner;
    if (a) { a.eingabe = f.value; if (a.meldung) { a.meldung = null; f.closest(".k15ordnfw")?.querySelector(".k15ordnm")?.remove(); } }
  };
  const go = knopf("k15ordng");
  go.type = "submit";
  go.textContent = "Add";
  form.append(inp, go);
  wrap.append(form);
  form.onsubmit = (e) => { e.preventDefault(); void nimmPfad(s, ((e.currentTarget as HTMLFormElement).querySelector(".k15ordni") as HTMLInputElement).value); };
  if (o.meldung) { const m = el("div", "k15ordnm", o.meldung); m.setAttribute("role", "alert"); wrap.append(m); }
  return wrap;
}
// the cursor goes into the field once, at the first draw of the picker (not when the listing arrives: keys come before it), where a keyboard is
// at hand; on a phone none jumps up. Called by the window's draw after it has brought the live DOM up to date (src/start-fenster.ts#zeichneStart).
export function ordnerFokus(s: St): void {
  const o = s.ordner;
  if (!s.repoMenu || !o || o.fokus) return;
  o.fokus = true;
  feldZeigen(s);
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) feldVon(s)?.focus({ preventScroll: true });
}
// what a person types, as a folder the server can read: quotes and spaces around it go, `$HOME` and a backslash before a space (a path copied from a
// terminal) are read as the terminal reads them, and a path that is neither absolute nor ~ is read from the folder the picker shows (`von`), the
// same folder the tree below the field stands in, never from the folder Fleet itself runs in
export function pfadAus(roh: string, von: string): string {
  const p = roh.trim().replace(/^(['"`])(.*)\1$/, "$2").trim().replace(/^\$\{?HOME\}?(?=\/|$)/, "~").replace(/\\ /g, " ");
  if (!p || p.startsWith("/") || p === "~" || p.startsWith("~/")) return p;
  return `${von.replace(/\/+$/, "")}/${p}`;
}
async function nimmPfad(s: St, roh: string): Promise<void> {
  const o = s.ordner;
  const pfad = o ? pfadAus(roh, o.liste?.path ?? o.pfad) : "";
  if (!o || !pfad) return;
  // the listing that arrives meanwhile replaces the picker's state but keeps its seq; a step in the tree or opening a picker anew gets a seq no
  // older answer holds (k15-zustand.ts#oeffneOrdner counts across closings)
  const seq = o.seq;
  const da = (): Ordner | null => (S === s && s.ordner?.seq === seq ? s.ordner : null);
  const sagt = (t: string): void => {
    const a = da();
    if (!a) return;
    a.meldung = t;
    render();
    feldZeigen(s);
    // the person is about to correct the line: the cursor is in the field again, at the end of what stands there
    const f = feldVon(s);
    if (f && document.activeElement !== f) { f.focus({ preventScroll: true }); f.setSelectionRange(f.value.length, f.value.length); }
  };
  const res = await api(`/api/dirs?path=${encodeURIComponent(pfad)}`).catch(() => null);
  const j = (res ? await res.json().catch(() => null) : null) as { path?: string; error?: string } | null;
  if (!da()) return;
  if (!res) return sagt(ordnerSatz(undefined, undefined));
  if (!res.ok || typeof j?.path !== "string") return sagt(ordnerSatz(res.status, j?.error));
  await pinne(s, j.path, true);
}

// die Ordnerwahl von „Repo hinzufügen“: Git-Repos zuerst, jeder Ordner lässt sich hinzufügen (Jeder kommt rein: auch ein Ordner ohne Git). Ein Klick auf eine Zeile öffnet den Ordner,
// hinzugefügt wird nur über den Knopf „Hinzufügen“ (Prüfung Punkt 7: ein Klick auf die Zeile pinnte sofort)
function ordnerWahl(s: St, o: Ordner): HTMLElement {
  const box = el("div", "k15ordner");
  const nav = el("div", "k15ordnk");
  const hoch = knopf("k15ordnh");
  hoch.title = "one level up";
  hoch.setAttribute("aria-label", hoch.title);
  hoch.append(icon("up"));
  hoch.disabled = !o.liste?.parent;
  hoch.onclick = () => { if (o.liste?.parent) void oeffneOrdner(s, o.liste.parent); };
  const zu = el("button", "k15link", "Back");
  zu.onclick = () => { s.ordner = null; render(); };
  const pfadTeil = el("span", "k15ordnp");
  // the span runs right to left so a long path cuts at its start; the text inside runs the right way round
  pfadTeil.append(el("bdi", "", tilde(o.liste?.path ?? o.pfad)));
  nav.append(hoch, pfadTeil, zu);
  box.append(nav, pfadFeld(s, o));
  if (o.fehler) { box.append(el("div", "k15leer", o.fehler)); return box; }
  if (!o.liste) { box.append(el("div", "k15leer", "reading …")); return box; }
  const liste = o.liste;
  const schon = new Set(repoZeilen(s).map((r) => r.repo));
  const hier = knopf("k15ghost k15ordnhier");
  hier.append(icon("plus"), el("span", "", `Add ${baseName(liste.path)}`));
  hier.disabled = schon.has(liste.path);
  hier.onclick = () => { void pinne(s, liste.path, true); };
  box.append(hier);
  const rows = el("div", "k15ordnl");
  const repoSet = new Set(liste.repos);
  for (const d of [...liste.dirs.filter((x) => repoSet.has(x)), ...liste.dirs.filter((x) => !repoSet.has(x))]) {
    const pfad = `${liste.path}/${d}`.replace("//", "/");
    const git = repoSet.has(d);
    const r = el("div", "k15ordnz");
    const b = knopf(`k15ordnb${git ? " git" : ""}`);
    b.append(icon(git ? "branch" : "folder"), el("span", "k15ordnn", d), el("span", "k15ordnt", schon.has(pfad) ? "in the list" : ""));
    b.title = `Open ${d}`;
    b.onclick = () => { void oeffneOrdner(s, pfad); };
    r.append(b);
    if (!schon.has(pfad)) {
      const dazu = el("button", "k15ordnadd", "Add");
      dazu.title = `Add ${tilde(pfad)} to the list`;
      dazu.onclick = () => { void pinne(s, pfad, true); };
      r.append(dazu);
    }
    rows.append(r);
  }
  if (!liste.dirs.length) rows.append(el("div", "k15leer", "No subfolders here."));
  box.append(rows);
  return box;
}
