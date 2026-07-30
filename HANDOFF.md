# HANDOFF — 2026-07-29/30 (Session 13: der zweite Puls und ein Datenlayer · Session 14: die Demo-Aufnahme)

*Zustand ist ein KOMMANDO: `./state.sh`. Historie: `git log fc24499..HEAD` mit Bodies (das
Befund-Register — die Mechanismen stehen dort, nicht hier). Diese Datei trägt nur das
Residuum: Absicht, Entscheide, was in Flug ist, und die Reihenfolge der nächsten Schritte.*

---

## Session 14 (2026-07-30): Teil A der öffentlichen Demo ist aufgenommen

Zwei Commits, `d638c63` + `214f630`, **nicht gepusht**. Vier echte Claude-Code-Sessions auf
einer Wegwerf-Instanz (Port 8877, eigener Socket, Scratch-Kopie — die Live-Instanz auf 8790
wurde nicht berührt), ihre Roh-Streams liegen in `demo/fixtures/`. Neues Bild in
`docs/screenshot.png`, dazu erstmals ein Handy-Bild. **Das operative Wissen dazu steht in
`docs/demo-fixtures.md`** — vier Fallen, die aus den Bytes nicht ableitbar sind; wer den
Replay-Player baut (Session B) oder das Bild neu schießt, liest das zuerst.

**Der Owner-Entscheid dieser Session, und er gilt weiter: der Maschinen-Accountname darf
nirgends sichtbar sein.** Er stand 80× in den Aufnahmen und im Screenshot. Konsequenzen, die
über diese Session hinausreichen:

1. **Redaktion in einem Terminal-Stream muss längentreu sein** (8 Bytes für 8), sonst
   verschiebt sich jede Cursor-Adresse danach. Kein Text-Ersetzen ohne diese Eigenschaft.
2. **Ein Grep über die Bytes reicht nicht.** Ein Vorkommen lag als die ersten sieben Zeichen
   des Namens + Cursor-Sprung im Stream, das achte hatte ein früherer Redraw gemalt — der Grep
   war sauber, der *gerenderte Frame* zeigte den Namen. Gefunden über alle Fragmente ≥ 3
   Zeichen, bewiesen durch Rendern des Frames vor/nach dem Patch. Für Terminal-Aufnahmen gilt:
   prüfen, was **malt**, nicht was greppt.
3. **Die Regel gilt auch für die Prosa.** Der erste Anlauf dieser Dokumentation nannte das
   Fragment wörtlich und hätte sieben Achtel des Namens in ein öffentliches Repo geschrieben —
   in derselben Datei, die vor genau diesem Fehler warnt. Beschreiben, nicht zitieren.
4. **Die Commits wurden vor jedem Push umgeschrieben**, damit kein Blob den Namen je trug. Ein
   Nachbesserungs-Commit hätte ihn dauerhaft in der Historie gelassen — das ist das Leck, nicht
   der Working Tree. Prüfung: `git log -p 4b8fec4..HEAD` gegen den Namen und gegen jedes seiner
   Fragmente ≥ 3 Zeichen = 0.

**Was als Nächstes ansteht (Demo-Strang):** Session B baut den Replay-Modus, Session C bettet
ein. Beide brauchen `docs/demo-fixtures.md`; der Geometrie-Vertrag (76×28) und „vor dem ersten
Byte den Terminal löschen" sind harte Vorgaben, keine Vorschläge.

**Offen, klein:** Das Board-Bild rendert die Fixtures, nicht eine lebende Flotte (vier fertige
Live-Sessions sind nachträglich nicht mehr fotografierbar) — steht im Commit-Body und in der
Doc. Wer es je wieder live schießen will, muss die Aufnahme neu fahren.

**Nicht im Repo, aber erhalten:** die vier echten Diffs der Sessions und die Aufnahme-Skripte
liegen in `~/claude-fleet-private/demo-2026-07-30/`. Der `claude-deck`-Patch (500 → 400 an der
Boundary) ist ein echter Fix für dieses öffentliche Repo und wartet dort auf Übernahme; die
Scratch-Klone sind weg.

---

## Session 13 (2026-07-29/30): der zweite Puls, und ein Datenlayer für Slots

### Was diese Session getan hat

Der Owner wollte zweierlei: den Steward autonom nach Fehlern/Verbesserungen schauen lassen,
und den Datenlayer über Sessions/Slots/Lanes ausbauen. Beides steht: 10 Commits, `c1f4ad5`
bis `fd982e9`, alle deployed und verifiziert. (`fc24499..HEAD` sind 13 — die drei ältesten
darin, Privacy-Scrub und `.env`-Umzug, stammen noch aus der Vor-Session.)

**Der Inspektor (`/inspektion`) ist der zweite Puls.** Der Rundgang schaut auf den *Betrieb*,
der Inspektor auf die *Substanz* — ein Revier pro Lauf aus fünf, rotierend über sein eigenes
Register, read-only, filed höchstens 1–2 `pending`. Konzept in `docs/steward.md` §Die zwei
Pulse; Register ist `inspektion-register.jsonl` im Steward-Worktree (untracked, 23 Zeilen).

**Er hat sich in zwei Läufen bezahlt gemacht.** Puls 1: eine verifizierte latente Auth-Lücke
und ein verwaistes Mess-Subsystem. Puls 2: **einen echten Bug in Code, der zwei Stunden vorher
gelandet und auf Owner-Nachfrage kritisch nachgeprüft worden war** (`b7d449a0` → `ba4b24f`).
Das ist der stärkste Beleg, den es für den Puls gibt.

**Der Slot-Datenlayer** (`slotstats.ts`, `GET /api/slot-stats`, `slotHealth` im Digest) misst,
was ein Slot verspricht: behält er seine Identität über einen Crash. Reine Ableitung aus
Events, die längst geschrieben wurden — plus zwei Erfassungszeilen dort, wo die Ableitung an
eine Wand lief (Heal-Grund, Kill-Grund).

**Der ③-Reviewer bekommt Kontext statt Werkzeug** (`b50c233`): die vollen Inhalte der
meistberührten vorbestehenden Dateien reiten im DATA-Block mit. Werkzeuglos und one-shot
bleibt er — die Ablehnungsgründe für die Alternativen stehen an den Konstanten in `server.ts`
und sind die Checkliste für die Eskalation, falls die Messreihe sie fordert.

### Zwei Messreihen laufen — beide brauchen ~15 Lanes, bevor sie etwas sagen

Nicht vorher interpretieren. Beide lesen sich aus vorhandenen Ledgern, ohne neue Erfassung:

1. **Wirkt der ③-Kontext?** Basis vor der Änderung: 46 % der Findings `basis:"inferred"`
   (36/78), und 32 von 66 Notes sagen „did not check code outside the diff". Beides muss
   fallen. Quelle: `review.findings[].basis` und `review.notes` in `lane-outcomes.jsonl`.
2. **Hält der Slot sein Versprechen?** Die Serie startet bei `ba4b24f` neu — Rows davor können
   die Frage nicht beantworten, weil die Klassifikation kaputt war. Zu lesen an `healReasons`
   in `/api/slot-stats`: `no-session` = die harmlose openSlot-Race, `no-transcript` = die echte
   Verletzung. Vorher war Letzteres unerreichbar.

### Was als Nächstes ansteht — in dieser Reihenfolge

1. **Die Pulse laufen aus, und das ist Absicht.** `/rundgang` (`ad14fc62`, alle 3 h) hat noch 3
   von 8 Läufen; `/inspektion` (`cf216970`, alle 6 h) hat **runsLeft 0** und ist damit still.
   Endliche Run-Caps sind der Mechanismus, der „weiterlaufen" zu einer Entscheidung macht statt
   zu einem Default — genau daran ist der alte Rundgang-Auto im Juli unbemerkt gestorben.
   **Fällige Entscheidung: Inspektor neu aufsetzen (dann ggf. `perpetual: true`, owner-only)
   oder ruhen lassen.** Entscheidungsgrundlage: zwei Läufe, zwei verwertbare Befunde, einer
   davon ein echter Bug.
2. **7 pending Tasks.** Zwei davon sind diese Session verifiziert UND erledigt (`0b21cc94`
   gelöscht in `59eccbb`, `d8efc50f` gehärtet in `d495607`) — die Rows stehen aber noch auf
   `pending` und gehören abgeräumt, sonst zählen sie beim nächsten Blick doppelt. Der Rest ist
   ungeprüft. Vor einem Dispatch-Einschalten ohnehin durchzusehen (Steward-Benachrichtigungen
   landen in derselben Queue und würden als Brief gespawnt).
3. **Maschinenhygiene wird laut:** 88 geleakte e2e-tmux-Sockets, 60 MB TMPDIR-Scratch. Nichts
   reapt die. Kein Betriebsrisiko heute, aber monoton steigend.
4. **Orphan-Worktree `fleet-260728184459-9e73`** (5523d1f) liegt ohne Slot auf Platte — landen
   oder verwerfen.

### Korrekturen an früheren Behauptungen (diese Session gemessen)

- **„Der Steward-Ladepfad funktioniert" war falsch.** `/steward` Schritt 0 (`git merge main`)
  hätte **418 fremde Commits** gezogen (History-Rewrite beim Public-Release), und 11 von 13
  Doc-Referenzen der drei Steward-Commands zeigten ins Attic. Beides behoben: Branch auf main
  zurückgesetzt (Rückweg als Tag `steward-pre-reset-2026-07-29`; 13 Unikate gerettet nach
  `~/claude-fleet-private/steward-rescue/`), Pfade korrigiert.
- **Der Doc-Index war zu 84 % falsch** — 10 von 61 Pointern lösten auf. Neu geschrieben auf die
  10 operativen Docs, mit dem Pointer-Check als ausführbarer Zeile darin. Der Check fand beim
  ersten Lauf einen Fehler in seiner eigenen Neufassung und danach fünf weitere in
  `steward.md` — das ist der Grund, ihn zu behalten.
- **`self_heal_recreate` feuert bei JEDEM `ensureSlot`-Spawn**, nicht nur bei Heilungen. Das
  erklärt `opens ≈ heals` in den Live-Zahlen; die 196:1-Zahl der ersten Messung war deshalb nie
  „196 Heilungen". Die Trennung leistet jetzt die Reason-Spalte.
- **Zwei Protokoll-Abweichungen des ersten Pulses** waren im Pane-Output unsichtbar und nur im
  Audit-Trail zu sehen (zwei Reviere in einem Lauf; erfundene Register-Zeitstempel), beide im
  Command geschlossen (`41e8313`). Die Lehre: die Puls-Ausgabe ist kein Compliance-Beleg.

### Key Decisions

- **„Deliver context, not tools" statt Snapshot-Worktree für ③.** Gemessen, nicht geraten: das
  Defizit war Kontext (46 % inferred, 32 „did not check"-Notes), nicht Werkzeug (Truncation nur
  3×). Ein Reviewer mit Tools im *lebenden* Lane-Baum wurde verworfen — er rennt gegen die
  index.lock-Klasse, liest die kopierte `.env` und bricht die patchId-Ehrlichkeit. Der
  Snapshot-Worktree bleibt die Eskalationsstufe, falls die Messreihe sie fordert.
- **Die A2-Nullkontrollgruppe gelöscht, nicht repariert.** Keine der zwei Entscheidungen, die
  sie verwaisen ließen, war falsch — erst ihre Konjunktion ließ eine Messung ohne Frage laufen.
  Zusätzliches Argument, das die Sache entschied: die Baseline war in-memory und starb bei jedem
  Deploy, akkumulierte also nie über ein Boot-Fenster — genau der Fehler, den
  `graduation-criteria.md` selbst benannt hatte.
- **Endliche Run-Caps für beide Pulse.** `perpetual` existiert (owner-only) und wurde bewusst
  nicht genommen: ein Puls, der nie ausläuft, wird nie wieder bewertet.
- **Der Datenlayer ist Ableitung, nicht Erfassung.** Kriterium des Owners, wörtlich: „aufpassen
  das wir nicht irgendwelche Daten erfassen und mitgeben die unbrauchbar sind". Es hat sofort
  gegriffen — der Realdaten-Lauf fand `malformed: 468` auf einer Datei ohne eine einzige kaputte
  Zeile (Scope-Prüfung stand hinter der Feldvalidierung). Jede Zahl beantwortet eine benannte
  Frage, sonst fliegt sie raus.

### Womit man sofort fortsetzen kann

`./state.sh`, dann `git log fc24499..HEAD` mit Bodies. Die zwei Messreihen brauchen keine
Erklärung, nur Geduld und einen Ledger-Query; die eine fällige Entscheidung ist Punkt 1.
