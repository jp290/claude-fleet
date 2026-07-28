# HANDOFF — 2026-07-28 (Session 12: First-Principles-Reset — das Projekt ist wieder die Harness)

*Zustand ist ein KOMMANDO: `./state.sh`. Historie: `git log 41ddc57..HEAD` mit Bodies (das
Befund-Register). Diese Datei trägt nur das Residuum — Absicht, Entscheide, was git nicht trägt.*

## Status

- **Der Owner hat die Grundidee neu gezogen** (wörtlich: „einfach nur eine Harness für Claude
  Code … die Idee war nie viel mehr als das"). Konsequenz umgesetzt, nicht nur beschlossen —
  7 Commits `41ddc57..ddc5128`, alle deployed:
  1. Zwei Lands durch den vollen Zyklus (`1b0b99c` steward-truth via **Dispatcher-Arm**,
     `1cf2bee`+`8e0f232` delete-Lane via **Hand-Arm, Sonnet-Pin**) — Brief → Arbeit → Gate →
     Land → Audit, beides sauber.
  2. Der Tier-2-Audit auf dem Merge wurde ROT und fand damit einen **echten Zählfehler** im
     frisch gelandeten Journal-Cap: `b9bb130` (slice-vor-Filter-Leck + Restart-Whitelist-Lücke,
     zwei sich gegenseitig kaschierende Bugs — Mechanismus vollständig im Commit-Body). Danach
     volle Suite **ALL PASS (759) seriell** auf exakt diesem Baum.
  3. Das Reset-Paket: `8edbbd8` Shadow-② **off** · `7cb9e03` **Attic** (52 Docs eingelagert,
     12 operative bleiben) · `ddc5128` **Suiten serialisieren sich selbst** (Mutex in
     e2e-stage.sh, bewiesen: zweite Suite wartet, beide grün).
- **Deploy verifiziert, kein Gap:** srv-Start 18:45:49 trägt `b9bb130` (18:45:38) und
  `8edbbd8` (18:45:46); danach nur e2e-/docs-Commits. Health 200, `bundleStale:false`.
- Kaputt ist nichts. In-Flight ist nichts (Monitore/Poller gestoppt, Lanes gelandet+abgeräumt).

## Abgeschlossene Zahlen (final — die Serie ist zu, das rottet nicht mehr)

- **K2/Shadow-②: 46 Rows, 38 valide, ausnahmslos „pass", `would_stop` 0, 8 invalid** (4 leere
  rawAnswer ≈ Timeout, 4 unparsebar). Der Richter hat in 46 Lands null Information geliefert —
  das IST die Begründung für off, nicht Sparsamkeit.
- **Audit-Ledger: newest = ROT auf `8e0f232` — ADJUDIZIERT.** Wer `./state.sh` liest, darf das
  Rot nicht als offen deuten: Ursache gefunden, gefixt (`b9bb130`), Suite danach grün. 27 Audits
  gesamt (16 grün / 11 rot); FIX1-Rate seit dem Race-Fix weiter 0.
- Trial 1 (Protokoll im Attic), Antworten: Q1 select+brief 1/1 · Q2 n=2, beide gelandet
  (Hand-Arm brauchte 2 Mid-Flight-Korrekturen — Ursache Suite-Kontention, seit `ddc5128`
  mechanisch gelöst) · Q3 2 Audits, 1 grün + 1 rot mit echtem Fund · Q4 = 3 Interventionen,
  alle eine Wurzel: Serialisierung war Prosa, jetzt Mechanismus. S1 feuerte und wurde befolgt.

## Next Steps

1. **Keine. Benutzen.** Die Harness ist deckungsgleich mit der Idee; nächste Session braucht
   kein Programm. Bei Bedarf, in dieser Reihenfolge sinnvoll (alles Owner-Entscheid, nichts drängt):
   (a) L3 aus der Löcher-Analyse: `./state.sh` um einen lane-outcomes-Auswerteblock erweitern
   (pro Modell Lands/Median-sessionMs/ownerPrompts — die Daten liegen ungelesen im Ledger);
   (b) L4: `dispositions.jsonl` wire-or-delete (1 Row seit Bestehen, Schreiber `server.ts:3837`);
   (c) Stash vom 21.07. entscheiden (`git stash list` — klaus-Domain + share.html-Emoji).
2. Falls dieser Checkout je woanders repliziert wird: **CLAUDE.md ist gitignored** — die heutigen
   Regel-Updates (unten) müssten von Hand mitreisen.

## Key Decisions

- **„Nur eine Harness"** — Autonomie ist KEIN Ziel mehr. Nichts gelöscht, alles eingelagert:
  Reaktivierung wäre `git mv` aus dem Attic + env-Flip; ② dürfte aber erst nach einer
  bestandenen **Feuerprobe** (absichtlich schlechter Land, Richter muss ihn stoppen) je gaten.
- **Suite-Mutex in `e2e-stage.sh`** statt Trap-Chirurgie in 7 Wrappern. Semantik, die man kennen
  muss: `/tmp/fleet-e2e.lock` **existiert ≠ gehalten** — die `pid`-Datei entscheidet; toter
  Halter wird vom nächsten Anwärter gereapt; **pid-LOSE Dir = manueller Park-Halt**, wird nie
  gereapt. Manuelles `until mkdir` um Suite-Läufe ist obsolet.
- **Dispatcher off** nach Trial-Ende (heute wieder ausgeschaltet, `fleet.json` geprüft). Bleibt
  als Feature: Queue kuratieren → `POST /api/dispatch {on:true}`.
- Die geschobenen Session-11-Briefs (interact-Guard, Ring-Reste, Kostüm-Variablen,
  saveState-Feldtabelle) sind unter dem Reset **größtenteils gegenstandslos** — nicht
  wiedervorlegen, außer ein konkreter Anlass entsteht.

## Context to Restore

- `./state.sh` — Zustand ableiten (Achtung: newest Audit rot = adjudiziert, s. o.)
- `git log 41ddc57..HEAD` mit Bodies — jede Mechanik des Tages steht dort, nicht hier
- `CLAUDE.md` — das Rulebook, enthält alle heutigen Updates
- `docs/attic/README.md` — was eingelagert wurde und warum; `docs/` (12 Dateien) = Betriebswissen
- `lane-outcomes.jsonl` — 69 Rows, reichstes Artefakt (model/briefHash/sessionMs/ownerPrompts)

## Nicht-offensichtlicher Zustand

- **CLAUDE.md heute geändert** (gitignored, nur hier dokumentiert): Flake-Signatur generisch
  „N marks, 1..N-1" · Arena-cp-Zeile korrigiert (Stage-Fold heilt alle sieben) · Clean-Review-
  Absatz auf off umgeschrieben (mit finalen Zahlen) · Dispatcher-Absatz auf Feature gekürzt ·
  Suite-Mutex-Absatz ersetzt die manuelle Lock-Anleitung.
- Steward-Worktree liegt auf `4ee56f6` (vor allen heutigen Commits) — langlebige Konvention,
  driftet per Design; bei nächster Steward-Nutzung dort main mergen.
- Slot-1-Auto `c01fdd90` („TRIAL WATCH") disabled — kann gelöscht werden, Trial ist vorbei.
- Task `0b4568f2` steht korrekt auf `done` (auto beim Land). Queue leer.
- stray pid 51871 (`rag-job-channel/serve-dexter`) ist NICHT Fleet — state.sh zeigt ihn immer.
- Die fünfte Flake-Familie feuerte heute 1× (Lauf 3 der Cap-Diagnose, „41 marks") — Basisrate
  besteht, kein Handlungsbedarf.
