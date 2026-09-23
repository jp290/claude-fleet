---
frage: Was kann der Datei-Explorer („Open explorer") heute, wie sieht ein Entwurf mit effektiver Flächennutzung, vollem Funktionsumfang und Drag & Drop aus, und was kostet jede Schreib-Operation?
urteil: Heute kann das Fenster getrackte Pfade suchen, eine Datei lesen und eine bestehende Datei bearbeiten, sonst nichts (kein Anlegen, Umbenennen, Verschieben, Löschen, keine Inhaltssuche, kein Diff, keine ungetrackten Dateien, keine Zieh-Quelle). Entwurf A „Werkbank" wird empfohlen vor B „Spalten". Drag & Drop in den Composer zuerst (schreibt nichts), Verschieben im Baum nur als Auslöser eines Dialogs mit dem Hinweis aus „✎ edit", Ablegen vom Schreibtisch in einen Repo-Ordner nicht.
bereich: [explorer, drag-and-drop, oberflaeche]
belege: [src/client.ts#openExplorer, src/client.ts#fileTreeSection, src/client.ts#paintTree, src/client.ts#showFileView, src/client.ts#renderFileBody, src/client.ts#openFileEditor, src/client.ts#uploadDrops, src/client.ts#sessionActive, src/filetree.ts#matchTree, server/dir-explorer.ts#TREE_CAP, server/dir-explorer.ts#FILE_WRITE_DENY, server/dir-explorer.ts#editability, server.ts#dropMention, docs/design/grammatik.md, docs/design/datei-explorer/entwurf.html]
nicht-gemessen: Kein Bau, keine Testinstanz; das Mockup ist statisches HTML mit einem Fixture-Baum. Die Kosten der Bauzeilen sind aus dem Code geschätzt, nicht gemessen. Wie die CLI-Sessions (claude, codex, pi) auf ein fremdes git mv mitten im Lauf reagieren, ist nicht beobachtet, nur abgeleitet.
stand: 2026-09-23
---

# Datei-Explorer: heutiger Umfang, Entwurf zur Wahl, Drag & Drop

2026-09-23, Lane `fleet/260923213514-7916`, Baum `845bd555`. Program „Oberfläche aus einem Guss"
(`0d51b4d4`), nach Grammatik (`8d7d47b7`) und Inventar (`d8e37852`). Der Dateiname trägt das
Datum aus dem Brief (22.), gemessen wurde am 23.

Owner, wörtlich (2026-09-21): „im übrigen muss die Anischt wenn man auf 'open explorer klickt,
auch vollkommen überarbeitet werden. Hier möchte ich eine effektive nutzung der fläche mit
gleichzeiter klarheit, ordnung und vollem funktions umfangs. eine drag&drop funktion der dateien
und vllt sogar Ordner wäre auch seh interessant"

**Mockup:** `docs/design/datei-explorer/entwurf.html` (statisch, öffnet ohne Server; `?f=a`,
`a-datei`, `a-menue`, `a-schreiben`, `b`, `dnd` zeigen je einen Rahmen). **Bilder:**
`docs/design/datei-explorer/bilder/`, `<rahmen>-1200.jpg` (1200 × 900) und `<rahmen>-390.jpg`
(390 × 844, Touch). Ein Bild von heute zum Vergleich: `docs/messungen/2026-09-22-untermenue-bilder/18-explorer-1200.jpg`.

---

## 1. Was der Explorer heute kann, aus dem Code

Gelesen: `src/client.ts` Abschnitt „the file explorer (§F5)" (`fxTree` bis `openExplorer`),
`showFileView`, `renderFileBody`, `openFileEditor`, der Drop-Block um `uploadDrops`;
`src/filetree.ts` ganz; `src/shell.ts#openShell`; in `server.ts` die Routen `/api/tree`,
`/api/file`, `/api/file/write`, `/api/slots/:id/upload`; `server/dir-explorer.ts#editability`,
`#TREE_CAP`, `#FILE_WRITE_DENY`.

**Was es gibt**

| Fähigkeit | Wo | Grenze |
|---|---|---|
| Baum der **getrackten** Dateien | `/api/tree` = `git ls-files -z`, `treeOf` baut die Ordner | höchstens `TREE_CAP` = 4000 Pfade; darüber sagt der Untertitel „only the first N were sent" |
| Zwei Einstiege | Karte „Files" im Info-Tab (`fileTreeSection`, Knopf „Open explorer") und das Fenster (`openExplorer`, `openShell` mit `listWidth: 340`) | die Karte öffnet eine Datei immer im Fenster |
| Dritter Einstieg | Klick auf einen Dateipfad im Terminal oder in der Hover-Karte → `openExplorer(slot, cwd, path, line)` | nur Pfade, die im geladenen Baum stehen (`entityKnown`) |
| Pfadsuche | `matchTree`: ganze relative Pfade, Leerzeichen = UND, kürzester Treffer zuerst, flache Trefferliste | nur Pfade, nie Inhalte; bei gekapptem Baum sagt die Leerzeile, dass ein Treffer fehlen kann |
| Tastatur | ↑↓ und Enter über `shell.setRows`; Zeilen sind `<button>`, Fokus bleibt beim Aufklappen | — |
| Datei lesen | `showFileView` → `/api/file`: Text wie auf der Platte, `.md` bewusst NICHT gerendert, Sprung zu `line` | `FILE_CAP` 512 KB, danach „truncated"; Binärdatei nur als Hinweis; keine Zeilennummern, keine Hervorhebung |
| Datei bearbeiten | „✎ edit this file" (`renderFileBody`) → `openFileEditor` → `/api/file/write` | nur bestehende Dateien, im cwd des Slots (realpath beidseitig), nie `.env*`, `fleet.json`, `.git` (`FILE_WRITE_DENY`); Speichern nur bei unverändertem sha256 (409 sonst); kein Edit bei gekappter oder nicht-UTF-8-Datei (`editability`) |
| Der Hinweis beim Bearbeiten | `openFileEditor`: wenn `sessionActive(slot)` (Ausgabe innerhalb `RECENT_MS`) steht über dem Textfeld „this session is working right now — it may write this same file while you type, and the save will then be refused rather than overwrite it" | nur beim Bearbeiten, und nur solange die Session Ausgabe erzeugt |
| Schließ-Schutz | `shell.setCloseGuard` beim Editor: Esc/✕ fragt „Discard your changes…?" | — |
| Handy | `openShell` wird Vollbild; die Datei schiebt sich über die Liste (`showDetail`) | — |
| Drag & Drop | **eine** Richtung: Dateien vom Schreibtisch auf `#main` → `uploadDrops` → `/api/slots/:id/upload` → `drops/<zeit>-<name>`, Erwähnung „attached: … — read it" in den Composer | nur wenn das Repo `drops/` ignoriert (sonst 409, weil eine ungetrackte Datei das Land blockiert); 20 MB je Datei |

**Was es NICHT gibt** (Suche: `rg -on 'pathname === "/api/[a-z/-]*"' server.ts` liefert an
Datei-Routen nur `/api/file`, `/api/tree`, `/api/file/write`, `/api/dirs`, `/api/dirinfo`, dazu die
Regex-Route `upload`; `rg -n "dragstart|draggable" src/` = 0 Treffer):

- **Anlegen** einer Datei oder eines Ordners: keine Route; `/api/file/write` antwortet auf einen
  neuen Pfad 404 „this editor changes files that exist, it does not create them".
- **Umbenennen, Verschieben, Löschen**: keine Route, kein Knopf.
- **Suche im Inhalt**: `matchTree` filtert Pfade.
- **Diff im Explorer**: `openExplorer` übergibt `showFileView` kein `diff`; die Registerkarte
  „What this changed" gibt es nur im Review- und Commit-Fenster. Geänderte Dateien stehen in der
  Karte „uncommitted" des Info-Tabs (`brief.uncommittedFiles`), nicht im Baum.
- **Ungetrackte Dateien**: `git ls-files` listet sie nicht; der Kommentar an `/api/tree` sagt es.
- **Git-Zustand im Baum** (M, ?, „Ordner enthält Änderungen"): keiner.
- **Neu lesen im Fenster**: nur die Karte hat ↻; das Fenster zeigt einen Baum, den es einmal je
  Verzeichnis geladen hat (`fxAsked`). Eine Datei, die der Agent gerade angelegt hat, fehlt bis zum
  ↻ in der Karte.
- **Pfad kopieren, Pfad in den Prompt**: nichts im Explorer (`copyText` gibt es im Client, der
  Explorer nutzt es nicht).
- **Zieh-Quelle**: keine Zeile irgendwo ist ziehbar.
- **Material**: `.shellwin`/`.panel`-Palette (`#1d1d1d`, Radius 14; Inventar Zeile 65); `.fvback`
  und `.fvedit-ta:focus` in `--accent`-Blau, das G0.2 abschafft.

## 2. Das Mockup: zwei Anordnungen

Beide nach `docs/design/grammatik.md`: `openShell`-Fenster im Chat-Material (G6.3), Knöpfe G1.1 bis G1.3,
Filter als Tabs G3.1, Kontextmenü G4.2, Bestätigung als Dialog G4.5, Fußzeile als Statuszeile G2.3,
Handy nach `MOBILE_MQ` (G0.7). Beschriftungen Fleet-Englisch, Tooltips deutsch (G0.5, W1).

**A · Werkbank** (Bilder `a-1200`, `a-390`, `a-datei-390`, `a-menue-1200`). Das Fenster füllt den
Bildschirm bis auf 16 px wie `#shell-queue`. Links der Baum (300 px), rechts die Datei.
- Kopf: Repo, Branch, `969 tracked · 3 changed · 1 untracked`; ↻ und ✕ als Icon-Knöpfe.
- Werkzeugzeile: Suche; `Paths | Contents`; `All | Changed`; Umschalter `Untracked`; `New ▾`.
- Baum: Zähler je Ordner, `M` in `--amber`, `?` gedimmt und kursiv, ein Punkt an Ordnern mit
  Änderungen; ⋯ an der Zeile öffnet das Kontextmenü.
- Dateikopf: Pfad in Mono, `✎ Edit`, `Mention` (Pfad in den Prompt), Pfad kopieren, ⋯;
  „as it is on disk right now" bleibt; `The whole file | What changed` erscheint nur bei einer
  geänderten Datei; Zeilennummern mit einer Randmarke an geänderten Zeilen.
- Fußzeile: „Session 7 is working right now" (dieselbe Bedingung wie `sessionActive`) und wann der Baum
  gelesen wurde.

Am Handy: Liste im Vollbild, Filter in einer Zeile, Zeilen 40 px; die Datei schiebt sich darüber,
die Handlungen brechen in eine eigene Zeile um. `Untracked` und `New` stehen am Handy nicht in der
Werkzeugzeile, sondern im ⋯ eines Ordners (im Bild nicht gezeigt).

**B · Spalten** (Bilder `b-1200`, `b-390`). Ordner als Spalten oben (38 % der Höhe), die Datei in
voller Breite darunter. Gewinnt bei tiefen Pfaden (keine Einrückung) und bei breitem Code;
verliert Höhe (bei 900 px bleiben der Datei ~17 sichtbare Zeilen statt ~34 in A) und lässt bei
flachen Repos die Spaltenleiste halb leer (rechts in `b-1200`). Am Handy fällt B auf dieselbe Liste
wie A zurück, mit einer Zurück-Zeile statt Einrückung.

**Empfehlung: A.** Der Explorer ist ein Lesewerkzeug mit gelegentlichem Schreiben; A gibt der
Datei die volle Höhe, und der Baum ist die Form, die Karte und Fenster heute schon teilen
(`paintTree`, ein Renderer für beide). B hieße einen zweiten Renderer.

## 3. Drag & Drop: drei Bedeutungen

Skizze: Bild `dnd-1200` / `dnd-390`.

| | Was passiert | Kosten | Risiko |
|---|---|---|---|
| **(a) im Baum verschieben** | Zeile auf Ordner → Move-Dialog (Bild `a-schreiben`) → `git mv` im cwd der Session | mittel: neue Route mit der Eindämmung von `/api/file/write` (realpath beidseitig, `FILE_WRITE_DENY` für Quelle UND Ziel, nur im Git-Arbeitsbaum), Dialog, Zieh-Logik im Baum | schreibt ins Verzeichnis einer vielleicht laufenden Session: ihre nächste Änderung trifft den alten Pfad oder scheitert; Importe ziehen nicht mit (für `src/filetree.ts`: `src/client.ts`, `e2e/explorer.ts`); die Lane trägt danach einen unkommittierten Umzug |
| **(b) in den Composer ziehen** | Zeile auf `#main` → der Pfad steht als Text im Prompt des Slots, dem das Verzeichnis gehört | klein, nur Client: `draggable` an der Zeile, ein eigener MIME-Typ, der Drop-Handler an `#main` nimmt ihn neben `Files` an | keine Schreib-Operation. Zwei Fallen: nicht als `@pfad` einfügen (öffnet im CLI die Vervollständigung und schluckt das Enter, gemessen an `server.ts#dropMention`); und in den Entwurf des RICHTIGEN Slots schreiben (`drafts.attach`, wie `uploadDrops` es für eine verschobene Fokus-Pane tut) |
| **(c) vom Schreibtisch in einen Ordner** | Datei aus dem Finder auf einen Repo-Ordner → dort ablegen | mittel: zweite Upload-Route mit frei gewähltem Ziel, Schutz gegen gleichnamige Datei, Dialog | das Ergebnis ist eine ungetrackte Datei in einem nicht ignorierten Ordner: genau der Fall, den `/api/slots/:id/upload` heute mit 409 ablehnt, weil er das Land blockiert |

**Empfehlung.** (b) zuerst: täglicher Nutzen, keine Schreib-Operation. (a) danach, und nur als
Auslöser des Move-Dialogs, nie als sofortiges `git mv`. (c) nicht bauen, solange „keine
ungetrackten Dateien im Worktree" die Land-Regel ist. Wer eine Datei ins Repo legen will, legt sie
heute schon der Session hin und lässt sie committen. Ordner ziehen (Owner: „vllt sogar Ordner") ist
in (a) und (b) derselbe Griff an einer Ordnerzeile; in (c) hieße es einen ganzen Baum hochladen.

## 4. Das Schreib-Risiko

**Regel für jede Schreib-Operation im Entwurf** (Anlegen, Umbenennen, Verschieben, Löschen, auch
per Ziehen): sie geht durch einen G4.5-Dialog, nie direkt. Wenn `sessionActive(slot)` gilt, steht oben
derselbe Hinweis, den `openFileEditor` heute zeigt: derselbe Anfang „this session is working
right now — …", dieselbe Bedingung, dieselbe Klasse `.ocwarn`. Nur der zweite Halbsatz nennt die
Folge der jeweiligen Operation (Bild `a-schreiben`). Darunter vier Zeilen:
- **Runs**: der genaue Befehl.
- **Where**: das Verzeichnis und der Slot.
- **Afterwards**: was danach in der Lane liegt.
- **Not moved/Not changed**: was die Operation nicht mitzieht.

Was die Operationen im Einzelnen anrichten, abgeleitet aus git und der Land-Regel:

| Operation | danach im Worktree | Land | Rückweg |
|---|---|---|---|
| New file | 1 ungetrackte Datei | blockiert, bis sie committet ist | Löschen |
| New folder | nichts, was git sieht (leere Ordner trackt git nicht) | unberührt | — (darum „New file" mit Pfad `ordner/name`, kein eigenes „New folder") |
| Rename / Move (`git mv`) | 1 gestagte Umbenennung | braucht einen Commit | `git mv` zurück |
| Delete, getrackt (`git rm`) | 1 gestagte Löschung | braucht einen Commit | `git restore --staged --worktree` |
| Delete, ungetrackt | Datei weg | unberührt | **keiner** (nie in git) |

Eine zweite Grenze gilt unabhängig vom Hinweis: jede neue Route übernimmt die Eindämmung von
`/api/file/write` wörtlich (realpath beider Seiten, Präfix-Test auf das Slot-cwd, `FILE_WRITE_DENY`,
nur im Git-Arbeitsbaum, `audit()`-Zeile), und `e2e/security.ts` bekommt je Route eine Probe mit
Symlink und `../`.

## 5. Karten-Vorlagen (nicht gefilt; die MAIN filt nach der Owner-Wahl)

Gerankt nach Nutzen je Kosten. VERIFY jeweils: `pins`, dazu `FLEET_E2E_MODULES=explorer` über ein
Suite-Angebot, dazu Screenshots bei 1200 und 390 px gegen die genannten Regeln.

- **X1 (M) Explorer-Fenster neu, nur lesend.** Anordnung nach Owner-Wahl (A empfohlen) im
  Chat-Material. Git-Zustand im Baum (M, ?, Ordnerpunkt) aus `brief.uncommittedFiles`, das der
  Info-Tab schon hat: kein neuer Serverweg, gekappt bei 200 Statuszeilen wie dort. Mit diesem
  Weg erscheinen ungetrackte NEUE Ordner als eine Zeile `ordner/`, weil `git status` sie so
  zusammenfasst. Dazu: Filter `Changed`, Umschalter `Untracked`, ↻ im Fenster, Zeilennummern,
  „What changed" als Sprung in `openReview(slot, "working", {k:"file"})`, Fußzeile.
  Regeln G6.3, G3.1, G1.1–G1.3, G2.3, G0.7. Vorsicht: `e2e/explorer.ts` schneidet den
  Paint-Block aus `src/client.ts` und führt ihn aus. Wer `paintTree` umbaut, zieht die Probe in
  derselben Lane mit.
- **X2 (M) Pfad in den Prompt und Inhaltssuche.** `Mention`-Knopf, ⋯-Menü (harmloser Teil), Pfad
  kopieren, Drag & Drop (b). Dazu `Contents` als neue lesende Route (`git grep -n -I` im Slot-cwd,
  mit Zeit- und Treffer-Deckel, `GIT_READ_ENV`). Ein Treffer öffnet die Datei an der Zeile.
  Regeln G1.2, G4.2, G3.1. Nach X1.
- **X3 (L) Schreiben.** `New file`, `Rename`, `Move` (auch per Ziehen, (a)) und `Delete` hinter
  EINEM Dialog nach §4, mit Hinweis und Rückweg-Zeile; eine Routenfamilie mit der Eindämmung aus
  §4. VERIFY zusätzlich ein `./e2e-isolated.sh`-Vorschaulauf (Suite-Angebot), weil
  `e2e/security.ts` nur dort läuft. Nach X1, nach Grammatik-Karte K3 (Dialog-Helfer) und nach
  Owner-Frage 3.

(c) steht absichtlich auf keiner Karte.

## 6. Fragen an den Owner

1. **A oder B?** Werkbank (Baum links, Datei rechts, volle Höhe) oder Spalten (Ordner oben
   nebeneinander, Datei darunter in voller Breite)? Empfehlung A.
2. **Drag & Drop:** zuerst „Zeile in den Composer ziehen" (Pfad im Prompt, schreibt nichts), dann
   „im Baum verschieben", aber immer mit Dialog und Hinweis. „Vom Schreibtisch in einen
   Repo-Ordner" bleibt weg, weil es das Land blockiert. Einverstanden?
3. **Voller Funktionsumfang:** reicht New file (mit Ordnerpfad), Rename/Move und Delete? Und soll
   Delete ungetrackte Dateien löschen dürfen, obwohl es dafür keinen Rückweg gibt? (Vorschlag:
   nein, nur getrackte.)
4. **Ungetrackte Dateien** standardmäßig zeigen, gedimmt mit „?"? Gitignorte nie. (Vorschlag: ja.)

## Methode

```sh
# Umfang: gelesen, nicht ausgeführt
rg -n "openExplorer|fileTreeSection|function paintTree|fxSearchInput|function showFileView|edit this file|uploadDrops" src/*.ts
rg -on 'pathname === "/api/[a-z/-]*"' server.ts        # Datei-Routen
rg -n "dragstart|draggable" src/                        # 0 Treffer: keine Zieh-Quelle
rg -l 'filetree"' src e2e server.ts                     # Importeure: src/client.ts, e2e/explorer.ts
git ls-files | wc -l                                    # 969 — der Zähler im Mockup
# Bilder: playwright-core im Scratchpad, Chrome for Testing aus ~/Library/Caches/ms-playwright/chromium-1208,
# je Rahmen ein frischer Kontext; 1200×900 (dsf 1) und 390×844 (isMobile, hasTouch);
# file://…/entwurf.html?f=<rahmen>; dnd als ganze Seite; Probe scrollWidth − clientWidth = 0 für alle 10 Bilder.
```

## Was nicht gemessen wurde

- Kein Bau, keine Testinstanz: der Baum im Mockup ist eine Fixture. Die Pfade stammen aus diesem
  Repo, die Zahl 969 aus `git ls-files`; die drei geänderten und die ungetrackte Datei sind erfunden.
- Kosten S/M/L geschätzt, nicht an einer Lane gemessen.
- Das Verhalten einer laufenden claude-/codex-/pi-Session nach einem fremden `git mv` ist
  abgeleitet (ihr Edit-Werkzeug hält einen Pfad), nicht beobachtet.
- Das Kontextmenü am Handy (unten angesetzt, G4.1-Mobil) ist nur im CSS vorgesehen, nicht fotografiert.
- Tastenkürzel im Mockup (F2, ⌘C, ⌥⏎) sind Vorschläge, nicht gegen die vorhandenen Shell-Kürzel
  geprüft.
- Die Demo (`~/claude-fleet-demo`) ist nicht berührt; es gibt keinen Produktcode.
