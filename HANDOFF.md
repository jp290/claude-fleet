# HANDOFF — 2026-07-29/30 (Session 13: der zweite Puls, und ein Datenlayer für Slots)

*Zustand ist ein KOMMANDO: `./state.sh`. Historie: `git log fc24499..HEAD` mit Bodies (das
Befund-Register — die Mechanismen stehen dort, nicht hier). Diese Datei trägt nur das
Residuum: Absicht, Entscheide, was in Flug ist, und die Reihenfolge der nächsten Schritte.*

## Was diese Session getan hat

Der Owner wollte zweierlei: den Steward autonom nach Fehlern/Verbesserungen schauen lassen,
und den Datenlayer über Sessions/Slots/Lanes ausbauen. Beides steht: 10 Commits, `27827a6`
bis `3921560`, alle deployed und verifiziert. (`fc24499..HEAD` sind 13 — die drei ältesten
darin, Privacy-Scrub und `.env`-Umzug, stammen noch aus der Vor-Session.)

**Der Inspektor (`/inspektion`) ist der zweite Puls.** Der Rundgang schaut auf den *Betrieb*,
der Inspektor auf die *Substanz* — ein Revier pro Lauf aus fünf, rotierend über sein eigenes
Register, read-only, filed höchstens 1–2 `pending`. Konzept in `docs/steward.md` §Die zwei
Pulse; Register ist `inspektion-register.jsonl` im Steward-Worktree (untracked, 23 Zeilen).

**Er hat sich in zwei Läufen bezahlt gemacht.** Puls 1: eine verifizierte latente Auth-Lücke
und ein verwaistes Mess-Subsystem. Puls 2: **einen echten Bug in Code, der zwei Stunden vorher
gelandet und auf Owner-Nachfrage kritisch nachgeprüft worden war** (`b7d449a0` → `3afce29`).
Das ist der stärkste Beleg, den es für den Puls gibt.

**Der Slot-Datenlayer** (`slotstats.ts`, `GET /api/slot-stats`, `slotHealth` im Digest) misst,
was ein Slot verspricht: behält er seine Identität über einen Crash. Reine Ableitung aus
Events, die längst geschrieben wurden — plus zwei Erfassungszeilen dort, wo die Ableitung an
eine Wand lief (Heal-Grund, Kill-Grund).

**Der ③-Reviewer bekommt Kontext statt Werkzeug** (`a5a5a52`): die vollen Inhalte der
meistberührten vorbestehenden Dateien reiten im DATA-Block mit. Werkzeuglos und one-shot
bleibt er — die Ablehnungsgründe für die Alternativen stehen an den Konstanten in `server.ts`
und sind die Checkliste für die Eskalation, falls die Messreihe sie fordert.

## Zwei Messreihen laufen — beide brauchen ~15 Lanes, bevor sie etwas sagen

Nicht vorher interpretieren. Beide lesen sich aus vorhandenen Ledgern, ohne neue Erfassung:

1. **Wirkt der ③-Kontext?** Basis vor der Änderung: 46 % der Findings `basis:"inferred"`
   (36/78), und 32 von 66 Notes sagen „did not check code outside the diff". Beides muss
   fallen. Quelle: `review.findings[].basis` und `review.notes` in `lane-outcomes.jsonl`.
2. **Hält der Slot sein Versprechen?** Die Serie startet bei `3afce29` neu — Rows davor können
   die Frage nicht beantworten, weil die Klassifikation kaputt war. Zu lesen an `healReasons`
   in `/api/slot-stats`: `no-session` = die harmlose openSlot-Race, `no-transcript` = die echte
   Verletzung. Vorher war Letzteres unerreichbar.

## Was als Nächstes ansteht — in dieser Reihenfolge

1. **Die Pulse laufen aus, und das ist Absicht.** `/rundgang` (`ad14fc62`, alle 3 h) hat noch 3
   von 8 Läufen; `/inspektion` (`cf216970`, alle 6 h) hat **runsLeft 0** und ist damit still.
   Endliche Run-Caps sind der Mechanismus, der „weiterlaufen" zu einer Entscheidung macht statt
   zu einem Default — genau daran ist der alte Rundgang-Auto im Juli unbemerkt gestorben.
   **Fällige Entscheidung: Inspektor neu aufsetzen (dann ggf. `perpetual: true`, owner-only)
   oder ruhen lassen.** Entscheidungsgrundlage: zwei Läufe, zwei verwertbare Befunde, einer
   davon ein echter Bug.
2. **7 pending Tasks.** Zwei davon sind diese Session verifiziert UND erledigt (`0b21cc94`
   gelöscht in `6dea981`, `d8efc50f` gehärtet in `b6e915e`) — die Rows stehen aber noch auf
   `pending` und gehören abgeräumt, sonst zählen sie beim nächsten Blick doppelt. Der Rest ist
   ungeprüft. Vor einem Dispatch-Einschalten ohnehin durchzusehen (Steward-Benachrichtigungen
   landen in derselben Queue und würden als Brief gespawnt).
3. **Maschinenhygiene wird laut:** 88 geleakte e2e-tmux-Sockets, 60 MB TMPDIR-Scratch. Nichts
   reapt die. Kein Betriebsrisiko heute, aber monoton steigend.
4. **Orphan-Worktree `fleet-260728184459-9e73`** (5523d1f) liegt ohne Slot auf Platte — landen
   oder verwerfen.

## Korrekturen an früheren Behauptungen (diese Session gemessen)

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
  Command geschlossen (`aed9d8e`). Die Lehre: die Puls-Ausgabe ist kein Compliance-Beleg.

## Key Decisions

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

## Womit man sofort fortsetzen kann

`./state.sh`, dann `git log fc24499..HEAD` mit Bodies. Die zwei Messreihen brauchen keine
Erklärung, nur Geduld und einen Ledger-Query; die eine fällige Entscheidung ist Punkt 1.
