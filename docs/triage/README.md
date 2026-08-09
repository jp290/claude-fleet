# Triage der eingefrorenen Queue — der Auftrag für einen Batch-Worker

**Lage:** Am 2026-08-09 hat der Owner die Queue auf Eis gelegt (`POST /api/dispatch {on:false}` —
kein Tick startet mehr etwas). 70 offene Zeilen liegen in acht thematischen Batches unter
`docs/triage/batch-*.md`. Du bearbeitest **genau einen** Batch, den dein Brief nennt.

**Warum es diese Dateien überhaupt gibt:** die Queue lebt in `fleet.json`, und die ist gitignored
(`.gitignore:3`). Ein Worktree bekommt nur getrackte Dateien — du kannst die Queue also **nicht**
lesen. Der Zeilentext in deiner Batch-Datei ist die einzige Quelle, die du hast, und er ist
**wörtlich** kopiert.

---

## 1. Die eine Frage

> **Bringt diese Zeile heute noch eine nennenswerte Verbesserung — und wenn ja, ist sie so
> geschnitten, dass man sie bauen kann?**

Nicht: „ist das gut geschrieben". Nicht: „wie würde ich das bauen". Der Owner entscheidet danach,
was gebaut wird; du lieferst die **Evidenz**, auf der er entscheidet.

## 2. Du baust nichts, und das ist keine Höflichkeitsfloskel

- **Kein Code, kein Commit, keine Suite.** Du bist read-only. (Läufst du als Codex- oder pi-Lane,
  kannst du ohnehin nicht committen — dein `.git` ist im Sandbox-Profil auf `read` herabgestuft.
  Das ist Absicht, kein Defekt: der Host committet.)
- **Deine einzige Schreibung ist deine Ergebnisdatei** `docs/triage/verdict-<BATCH>.md`.
- **Du fasst `fleet.json` nicht an** (du siehst sie nicht) und rufst **keine** `/api/…`-Route auf,
  die etwas ändert. Ein `GET` ist erlaubt, wird aber nicht gebraucht.

## 3. Das Urteilsvokabular — genau vier Werte, und der dritte ist der wertvollste

| Verdikt | Bedeutung |
|---|---|
| `bauen` | Die Zeile beschreibt eine Verbesserung, die es heute noch gibt, und sie ist schneidbar. |
| `streichen` | Die Arbeit ist erledigt, gegenstandslos geworden, oder war nie eine nennenswerte Verbesserung. **Braucht einen POSITIVEN Beleg** — siehe §4. |
| `zusammenlegen mit <id>` | Dieselbe Arbeit wie eine andere Zeile **in deinem Batch**, oder eine echte Teilmenge davon. Nenne, welche Zeile die tragende ist und was die andere hinzufügt. |
| `unklar` | Du kannst es mit dem, was du siehst, nicht beantworten. **Das ist eine vollwertige Antwort und keine Niederlage** — sag genau, welche Tatsache dir fehlt und wer sie hätte. |

## 4. Die Beweisregeln, und sie sind ASYMMETRISCH

Das ist der Kern des Auftrags. Ein zu großzügiges `bauen` kostet eine Diskussion. Ein falsches
`streichen` **löscht Arbeit, die jemand für nötig hielt** — und niemand merkt es je.

- **`streichen` verlangt einen positiven Beleg.** Genau einer von dreien:
  - **(a) erledigt** — ein Commit, der es getan hat: `git log --oneline <sha>` plus die Stelle im
    heutigen Code, an der man es sieht (`datei:zeile`).
  - **(b) gegenstandslos** — die Sache, auf die sich die Zeile bezieht, existiert nicht mehr
    (Datei/Funktion/Feld weg, Feature ausgebaut). Zeig, dass sie weg ist.
  - **(c) widerlegt** — die Behauptung der Zeile stimmt am heutigen Code nachweislich nicht. Zitiere
    die Stelle, die das Gegenteil zeigt.
  „Wirkt unwichtig", „ist nur Kosmetik", „steht schon lange rum" sind **keine** Belege. Ohne (a),
  (b) oder (c) heißt dein Verdikt `unklar` oder `bauen`, nie `streichen`.
- **`bauen` verlangt keinen Beweis, aber eine Kostenaussage.** Ein Satz: was bricht oder bleibt
  schlecht, wenn es NICHT gebaut wird. Fällt dir keiner ein, ist es `unklar`.
- **Jede strukturelle Behauptung zitiert `datei:zeile` oder einen Commit-SHA.** Was du nicht gelesen
  hast, behauptest du nicht — und du sagst, was du **nicht** geprüft hast.
- **Der Analyst hat auf manchen Zeilen schon geurteilt** (`ready`/`needs-you`, in deiner Batch-Datei
  zitiert). Das ist ein **Kandidat, kein Urteil** — er lief teils, bevor die Zeile ihren heutigen
  Text hatte. Widersprich ihm, wenn du Belege hast; das ist eine der wertvollsten Ausgaben.

## 5. Kalibrierung — die Falle, in die der letzte Kritiker gelaufen ist

Am 2026-08-09 hat ein Kritiker-Worker in diesem Repo **12 von 12 Fragen mit einem Befund
beantwortet**, obwohl sein Brief „nichts gefunden" ausdrücklich anbot. Zwei seiner Funde waren echt
und wertvoll; einer war falsch und stand auf Platz 3 seiner eigenen Top-3.

Daraus die Regeln für dich:

- **Gib je Zeile eine Konfidenz an: `hoch` | `mittel` | `niedrig`.** Ein `streichen` mit `niedrig`
  ist ein Widerspruch — mach daraus `unklar`.
- **Es gibt keine Quote.** Wenn alle deine Zeilen `bauen` verdienen, schreib das hin. Wenn die
  Hälfte `unklar` ist, schreib das hin. Erfinde nichts, um Vielfalt zu erzeugen.
- **Nenne am Ende deine drei stärksten und deine schwächste Aussage** — die schwächste ausdrücklich
  benannt, damit der Host weiß, wo er zuerst nachprüft.

## 6. Deine Werkzeuge — und die zwei, die du NICHT hast

**Hast du:**
- `git log`, `git show`, `git diff` — **das Primärbeweismittel.** Jede Zeile trägt ihr Anlegedatum.
  Die nützlichsten Formen:
  ```
  git log --since=<YYYY-MM-DD> --oneline -- <datei> <datei>     # ist es seither passiert?
  git log --since=<YYYY-MM-DD> --format='%h %s%n%b' -- <datei>  # die BODIES sind das Befundregister
  git log -S '<symbol>' --oneline                               # wann kam/ging dieses Symbol
  ```
  **Die Commit-BODIES sind in diesem Repo das Befundregister, nicht die Subjects.** Ein Subject wie
  „fix(send): …" sagt fast nichts; der Body nennt Messung, Ursache und was bewusst offen blieb.
- `rg` für Text — aber **`rg -uu`**, sobald du etwas Operatives suchst: ripgrep respektiert
  `.gitignore`, und ein leeres Ergebnis liest sich wie „gibt es nicht".
- `ast-grep` für die strukturelle Frage (`ast-grep --pattern 'foo($$$)' --lang ts server.ts`).
  **Probe es zuerst** (`ast-grep --version`) und **schreib in deinen Bericht, ob es lief** — ob es im
  Lane-Pane auf dem PATH liegt und der Sandbox-Zaun es ausführen lässt, ist ungeprüft. Läuft es
  nicht, nimm `rg`/`grep` und sag es.
- `docs/` im Baum — und für alles, was seit deinem Fork dazukam: `git show main:docs/<datei>.md`.

**Hast du NICHT** (alle gitignored, ein Worktree bekommt sie nie):
- `fleet.json` — die Queue. Deshalb diese Dateien.
- `CLAUDE.md` — das Regelbuch. `AGENTS.md` ist im Baum und zeigt darauf; lies **die**.
- `audit.jsonl`, `lane-outcomes.jsonl`, `post-land-audits.jsonl` — die Ledger.
- `graphify-out/` — der Wissensgraph. (Hostseitig geprobt und **bewusst weggelassen**: seine
  Ausgabe ist bei ~2000 Tokens abgeschnitten und ihre Zeilennummern driften gegen den heutigen
  Baum.)

Braucht ein Urteil eine dieser Quellen, ist das Verdikt **`unklar`** mit dem Satz „braucht
<Quelle>, die eine Lane nicht sieht". Das ist ein nützliches Ergebnis, kein Scheitern.

## 7. Kontext-Budget — rechne mit 258 400, nicht mit einer Million

Läufst du auf einem GPT-Modell, ist dein Fenster **258 400 Token** (272 000 × 95 %), und ~96 % davon
gehen für **Eingabe** drauf, vor allem für Werkzeug-Ausgaben, die jeder Turn erneut mitschickt.

- **Lies keine Datei ganz, die du bereichsweise lesen kannst.** `server.ts` sind >13 000 Zeilen.
- **Leite lange Ausgaben in eine Datei und lies den Tail**, statt sie in den Kontext zu kippen.
- **Sag Bescheid, wenn du über der Hälfte bist** — das Board kann deinen Füllstand bei einem
  fremden Modell nicht messen (`ctx: null`), ein Satz von dir ersetzt einen Sensor, den es nicht gibt.

## 8. Nicht wieder aufmachen

`docs/work-register-2026-08-06.md` §7 führt, was in diesem Repo **begründet beerdigt** ist. Lies den
Abschnitt, bevor du eine Zeile mit „man könnte doch …" aufwertest. Kurzform: Auto-Rollback auf ein
rotes Tier-2-Audit · `rerere` und ein hartes Land-Gate · Hook-Pflege / Cron auf `.git/hooks` ·
`Stop`-Hooks als Nullpunkt der idle-Uhr · der K2-Shadow-Richter · das Eval-Gate. Eine Zeile, die
eines davon vorschlägt, ist `streichen` mit Beleg (c) — und der Beleg ist §7.

## 9. Dein Ergebnis

Eine Datei, `docs/triage/verdict-<BATCH>.md`, in genau dieser Form:

```markdown
# Verdikt <BATCH> — <Titel>

**Worker:** <harness/modell>  ·  **Baum:** <git rev-parse --short HEAD>  ·  <datum>
**Werkzeug-Probe:** ast-grep <lief / lief nicht: fehler>  ·  rg <ja/nein>

## Übersicht
| Zeile | Verdikt | Konfidenz | Größe | Einzeiler |
|---|---|---|---|---|
| `abcd1234` | bauen | hoch | M | … |

## Je Zeile

### `abcd1234` — <verdikt>, Konfidenz <hoch|mittel|niedrig>
- **Warum:** ein bis drei Sätze.
- **Beleg:** `datei:zeile` und/oder `<sha>` — bei `streichen` PFLICHT, Typ (a)/(b)/(c) benennen.
- **Kosten, wenn nicht gebaut:** ein Satz (nur bei `bauen`).
- **Größe:** S (<1 h) | M (eine Lane) | L (mehrere Lanes / erst Entscheidung).
- **Was noch fehlt, bevor man es starten kann:** hartes Done-Kriterium? Verify-Weg? Owner-Entscheid?
- **Nicht geprüft:** was du bewusst offengelassen hast.

## Kalibrierung
- Meine drei stärksten Aussagen: …
- Meine schwächste Aussage (hier zuerst nachprüfen): …
- Was ich gemessen vs. nur gelesen habe: …

## Batch-Ebene
- Zusammenlegungen, die ich sehe: …
- Reihenfolge, falls eine Zeile eine andere voraussetzt: …
- Was diesem Batch als GANZEM fehlt: …
```

## 10. Was danach passiert — damit du weißt, was dein Urteil ist

Dein Verdikt ist ein **Vorschlag**. Der Host liest ihn, prüft die Belege stichprobenartig nach und
legt dem Owner eine Rangliste vor; der Owner entscheidet. **Nichts in diesem Repo führt dein Urteil
automatisch aus** — kein Tick liest deine Datei, keine Zeile wird durch sie gestrichen. Das ist die
Hausregel: wer produziert, schreibt nicht den Anker, an dem er gemessen wird.

Genau deshalb darfst du hart urteilen. Sag, was du siehst.
