# HANDOFF — 2026-07-28 (Session 11 final: drei Lands, das Race ist tot, ab jetzt wird benutzt)

*Zustand ist ein KOMMANDO: `./state.sh` (mit Config-Sensor). Historie: `git log <dieser Commit>^..HEAD`
mit Bodies. Owner-Sicht ohne FS-Zugriff: der Atlas, `http://100.64.0.1:8794/`. Diese Datei trägt
nur das Residuum.*

## Was diese Session gelandet hat (Kette, seriell, je durch den Gate)

1. **fold** `3d38960` — `e2e-stage.sh`: EINE abgeleitete Kopier-Regel (transitiver Import-Closure,
   fatal bei unauflösbar) für alle sieben Skripte; der Pre-Land-Gate schreibt erstmals Trail-Rows.
2. **protocol/pins** `8304cc3` — `src/protocol.ts` (tsc macht Paar-Drift zum Compile-Fehler) +
   `e2e/pins.ts` (21 Regeln, ~40 ms, ERSTE Stufe im Gate seit dem kickstart dieser Session);
   BACKGROUND_MARKS-Bug an der Form gefixt (Pflichtfeld, Prompts byte-identisch bewiesen).
3. **merge-Härtung** `2bca3d2` — **das Race ist ursächlich behoben**: `.git/index.lock` aus Fleets
   eigenen Status-Polls; `GIT_OPTIONAL_LOCKS=0` an den read-only-Aufrufen. Beweis: 16/60 Abort-Fails
   ohne, 0/60 mit Flag; FIX1 **10/10** über 5 serielle Läufe (Basisrate 8/16). Der ⏸-Fall-Through
   war REAL (auf altem Code nachgestellt: ungereviewte Agent-Resolution erreichte main) und ist zu,
   inkl. Error-Verdicts + Interrupt-Marker; der verworfene Abort-Exit war ZWEIMAL da (auch
   Confirm-Land-Replay), beide zu. Eine erklärte Coverage-Lücke steht im Code, nicht versteckt.

**Deploy-Stand beim Schreiben:** fold+protocol voll deployed (build+kickstart+srv, Tier-2 GRÜN auf
8304cc3). Für `2bca3d2` lief der Tier-2-Audit noch; srv-Restart folgt direkt danach (nur der —
kein watchdog-/Client-Diff). Nachprüfen: `./state.sh` (deploy gap) + `GET /api/post-land-audits`.

## Nächste Session: NICHT mit Analyse öffnen

**Benutzen, nicht messen.** Die verbleibenden Unbekannten sind Laufzeit-Unbekannte: widerspricht ②
je auf echtem Traffic (K2-Serie Richtung N≥25 — jedes Clean-Auto-Land zahlt ein), und hält die
FIX1-Rate bei ~0 jetzt, wo der Tier-2-Alarm wieder informativ ist. Konkreter Opener: Autonomie-
Trial — Queue kuratieren, Dispatcher an (`POST /api/dispatch {on:true}`), Steward briefed nach dem
Ritual unten. Meta:Produktion lag bei ~2:1; noch ein Analyse-Durchgang wäre Selbststudium.

## Geschobene Lanes (Briefs = Residuum; Fakten im Faktendokument §3/§7)

- **delete-Lane** (Intervention-Outcome, ~645 Zeilen): KORRIGIERTE Lage beachten — outcomeTally hat
  vier Schreiber, propose lief 11×, promotionEligible wäre TRUE; im propose-Block `audit()` behalten,
  `bumpTally` kappen; e2e-Kopplungen (Digest-Anker, Tier-1-Fixture oc2, security-Route-Pin) umbauen
  statt schneiden; Persistenz selbstheilend, KEIN Migrationscode; die zwei falschen dismissed-Rows
  nicht reparieren (gegenstandslos). Günstigeres Modell pinnen — mechanische Arbeit.
- **steward-truth-Lane**: `ref:"verify"` muss das `landed`-Feld lesen (heute sagt auch
  blocked/error „Lane gelandet"); Pulse ohne mtime-Fallback (zitiert sonst fremde Sessions);
  Journal-POST-Rate-Cap. Token-Rotation als Route = eigener Owner-Entscheid.

Geparkt bis Anlass (unverändert): interact-Guard, Ring 2.3/3.4/3.5-Rest, Ring-4-Rest + Slot.mission,
Kostüm-Variablen (nur als Vorschlag, drills/ erst prüfen), saveState-Feldtabelle (eigene ruhige
Session, Round-Trip-Property zuerst).

## Das Lane-Ritual, jetzt n=4 und belastbar

Residuum-Brief per `POST /send {slot,text}` (Fakten committen, Brief zeigt darauf) → Monitor auf
Pane-Idle-Transition (Busy-Regex `esc to interrupt|· ↓|thinking|ing… \(` — Spinner-Verben rotieren)
→ Mid-Flight-Korrektur, wenn die Lane etwas nicht wissen KANN (einmal gebraucht: Fork älter als
neues Wissen) → Land über `POST /api/slots/:id/merge` (NICHT /land) → Verdict-Poll ebendort →
rote Audits ZUERST per Trail (`$TMPDIR/fleet-e2e-trail` bzw. `e2e-trail/`) adjudizieren →
**direkt nach dem Land die nächste Lane spawnen** (Audit-Warten war ~7 min Totzeit; nur SUITEN
brauchen die stille Maschine, nicht die Lese-Phase einer Lane).

## Nicht-offensichtlicher Zustand

- **Atlas**: tmux-Session `atlas` (Live-Socket), Port 8794, Regen alle 120 s, `atlas.sh` im Repo.
- **CLAUDE.md dieser Session geändert** (gitignored, nur hier dokumentiert): Verify-Zeile = echter
  Gate; NUL-Regel raus; sechs cp-Skripte (jetzt via e2e-stage.sh abgeleitet); Dispatcher-Zeile auf
  „aus"; FIX1-Zeile ZWEIMAL gedreht — final: Flake BEHOBEN, ein FIX1-Rot nach `2bca3d2` ist echt;
  fünfte Flake-Familie benannt („41 marks, 1..40", reseed+live-bytes, 2/22 Läufe, Vorfahr-Beweis).
- **Stash vom 21.07. weiter offen** (klaus.example.com raus + share.html-Emoji) —
  Owner-Entscheid, nicht anwenden, nicht droppen.
- Steward-Worktree hat main gemergt (4ee56f6), Tree sauber. Slot-1-Auto „TRIAL WATCH (dispatcher
  on)" stammt aus einer früheren Nacht-Konfiguration — vor dem nächsten Trial prüfen/erneuern.
- 81 gemergte Lane-Branches, 693 Sockets, 109 Scratch-Dirs (~800 MB) abgeräumt; der
  Scratch-Wachstums-Mechanismus (behalten-bei-Fehler, kein Reaper) besteht als benannter Trade.
- Session-10-Geist: Slot 7 kann noch ein stales 0a5b-Merge-Verdict zeigen — kosmetisch,
  überschreibt sich beim nächsten Merge dort.

## Faktenlage zum Nachschlagen

`docs/analysis-2026-07-28-verification.md` (§1 Paare, §2 Fold, §3 Outcome-KORREKTUR, §4 Kollisionen,
§5 Race-Anker, §7 Steward-Tiefenlese, §8 Assertion-Audit, §9 FIX1-Basisrate=Vorgeschichte) ·
`docs/simplification-plan-2026-07-28.md` (die geborgenen RINGE, Session-10-Scratchpad) ·
Commit-Bodies von `9d3944f..2bca3d2`.
