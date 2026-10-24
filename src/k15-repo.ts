// K15 · WO DIE NEUE SESSION STARTET (Owner 16.10. 00:5x: „[Zitat entfernt]“
// ; „[Zitat entfernt]“
// ). Der Kopf des Fensters liest sich so; darunter stehen klein Branch,
// offene Änderungen und der letzte Commit (GET /api/dirinfo). Die Auswahl nennt die Repos mit laufender Session und die gepinnten, am
// Ende „Repo hinzufügen …“: eine Ordnerwahl über GET /api/dirs, die per POST /api/pins pinnt. Keine neue Route.
import { el, baseName, agoDe } from "./k15-haupt";
import { icon } from "./icons";
import { projectHue } from "./marks";
import { gehe, info, oeffneOrdner, pinne, plural, render, repoZeilen, tilde, verwirft, type Ordner, type St } from "./k15-zustand";
import { schliesseAblauf } from "./k15-agentmd";
import { packUngesichert } from "./k15-packs-ui";
import { knopf } from "./k15-teile";
import { startSchliesst } from "./start-fenster";

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
  b.title =s.repo ? `${baseName(s.repo)} · ${tilde(s.repo)}: anderes Repo wählen` : "Repo wählen";
  b.append(...(s.repo ? [punkt(s.repo)] : []), el("span", "k15wor", s.repo ? baseName(s.repo) : "Repo wählen"), icon("chevron"));
  b.onclick = () => { s.repoMenu = !s.repoMenu; s.ordner = null; render(); };
  h2.replaceChildren(el("span", "k15woi", "Neue Session in"), b);
  sub.replaceChildren(...repoStand(s));
}
// Branch, offene Änderungen, voraus/zurück, Worktrees und der letzte Commit, klein in einer Zeile; der Pfad im Title
function repoStand(s: St): HTMLElement[] {
  if (!s.repo) return [el("span", "", s.pins === null ? "Die Repos werden gelesen …" : "Noch kein Repo: Wähl oben eines oder füg eines hinzu.")];
  const i = info(s, s.repo);
  if (i === "laedt") return [el("span", "", "wird gelesen …")];
  if ("fehler" in i) return [el("span", "", `nicht lesbar: ${i.fehler}`)];
  if (!i.exists || !i.git) return [el("span", "", i.exists ? "kein Git-Repo: Eine Session mit Rolle braucht eines." : "Den Ordner gibt es nicht mehr.")];
  const stand = el("span", "k15wos", [i.branch ? `Branch ${i.branch}` : "ohne Branch",
    i.dirty ? plural(i.dirty, "offene Änderung", "offene Änderungen") : "nichts offen",
    ...(i.ahead ? [`${i.ahead} voraus`] : []), ...(i.behind ? [`${i.behind} zurück`] : []),
    ...(i.lanes ? [plural(i.lanes, "Worktree", "Worktrees")] : [])].join(" · "));
  stand.title = tilde(s.repo);
  if (!i.last) return [stand];
  const c = el("span", "k15woc", `${agoDe(Date.now() - i.last.ts)}: ${i.last.subject}`);
  c.title = `letzter Commit ${i.last.hash} ${i.last.subject}`;
  return [stand, el("span", "k15wopf", "·"), c];
}

// DIE AUSWAHL: liegt im Fenster unter dem Kopf; zu geht sie per Klick daneben, Escape oder Wahl
export function repoMenue(s: St): HTMLElement | null {
  if (!s.repoMenu) return null;
  const m = el("div", "k15repomenu");
  m.setAttribute("role", "menu");
  m.setAttribute("aria-label", "Repo der neuen Session");
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
      el("span", "k15ks", `${z.sessions ? plural(z.sessions, "Session läuft", "Sessions laufen") : "keine Session"}${z.gepinnt ? " · gepinnt" : ""}`));
    b.append(punkt(z.repo), t, ...(on ? [icon("check")] : []));
    b.onclick = () => { s.repoMenu = false; if (s.repo !== z.repo) { s.repo = z.repo; gehe(s.tief, 2); } else render(); };
    r.append(b);
    if (z.gepinnt && !z.sessions) {
      const x = el("button", "k15repox");
      x.title = `${baseName(z.repo)} aus der Auswahl nehmen; der Ordner bleibt`;
      x.setAttribute("aria-label", x.title);
      x.append(icon("x"));
      x.onclick = () => { void pinne(s, z.repo, false); };
      r.append(x);
    }
    m.append(r);
  }
  if (!zeilen.length) m.append(el("div", "k15leer", s.pins === null ? "Die Repos werden gelesen …" : "Noch kein Repo: Füg eines hinzu."));
  const neu = el("button", "k15repoplus");
  neu.setAttribute("role", "menuitem");
  neu.append(icon("plus"), el("span", "", "Repo hinzufügen …"));
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
    // Escape schließt zuerst den Ablauf „Deine Agent-MD“ (mit Warnung, wenn darin Ungesichertes steht), dann die Auswahl, dann das
    // Fenster; steht anderswo ungesicherter Text, warnt das erste Schließen (Prüfung Punkt 2)
    if (s.ablauf) { schliesseAblauf(s); return true; }
    const wo = packUngesichert(s) ? "im Kontextpack" : s.bearbeite !== null && s.bearbeiteText !== null ? "in deiner eigenen Fassung" : null;
    if (wo && !verwirft(s, wo)) return true;
    if (!s.repoMenu) return startSchliesst(s);
    s.repoMenu = false;
    s.ordner = null;
    render();
    return true;
  });
}

// die Ordnerwahl von „Repo hinzufügen“: Git-Repos zuerst, nur sie lassen sich hinzufügen. Ein Klick auf eine Zeile öffnet den Ordner,
// hinzugefügt wird nur über den Knopf „Hinzufügen“ (Prüfung Punkt 7: ein Klick auf die Zeile pinnte sofort)
function ordnerWahl(s: St, o: Ordner): HTMLElement {
  const box = el("div", "k15ordner");
  const nav = el("div", "k15ordnk");
  const hoch = knopf("k15ordnh");
  hoch.title = "eine Ebene höher";
  hoch.setAttribute("aria-label", hoch.title);
  hoch.append(icon("up"));
  hoch.disabled = !o.liste?.parent;
  hoch.onclick = () => { if (o.liste?.parent) void oeffneOrdner(s, o.liste.parent); };
  const zu = el("button", "k15link", "Zurück");
  zu.onclick = () => { s.ordner = null; render(); };
  nav.append(hoch, el("span", "k15ordnp", tilde(o.liste?.path ?? o.pfad)), zu);
  box.append(nav);
  if (o.fehler) { box.append(el("div", "k15leer", o.fehler)); return box; }
  if (!o.liste) { box.append(el("div", "k15leer", "wird gelesen …")); return box; }
  const liste = o.liste;
  const schon = new Set(repoZeilen(s).map((r) => r.repo));
  if (liste.git) {
    const hier = knopf("k15ghost k15ordnhier");
    hier.append(icon("plus"), el("span", "", `${baseName(liste.path)} hinzufügen`));
    hier.disabled = schon.has(liste.path);
    hier.onclick = () => { void pinne(s, liste.path, true); };
    box.append(hier);
  }
  const rows = el("div", "k15ordnl");
  const repoSet = new Set(liste.repos);
  for (const d of [...liste.dirs.filter((x) => repoSet.has(x)), ...liste.dirs.filter((x) => !repoSet.has(x))]) {
    const pfad = `${liste.path}/${d}`.replace("//", "/");
    const git = repoSet.has(d);
    const r = el("div", "k15ordnz");
    const b = knopf(`k15ordnb${git ? " git" : ""}`);
    b.append(icon(git ? "branch" : "folder"), el("span", "k15ordnn", d), el("span", "k15ordnt", git && schon.has(pfad) ? "in der Auswahl" : ""));
    b.title = `${d} öffnen`;
    b.onclick = () => { void oeffneOrdner(s, pfad); };
    r.append(b);
    if (git && !schon.has(pfad)) {
      const dazu = el("button", "k15ordnadd", "Hinzufügen");
      dazu.title = `${tilde(pfad)} in die Auswahl nehmen`;
      dazu.onclick = () => { void pinne(s, pfad, true); };
      r.append(dazu);
    }
    rows.append(r);
  }
  if (!liste.dirs.length) rows.append(el("div", "k15leer", "Hier gibt es keine Unterordner."));
  box.append(rows);
  return box;
}
