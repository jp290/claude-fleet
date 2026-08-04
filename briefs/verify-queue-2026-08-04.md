# Lane-Brief ⑦ — Verify-Queue: erst sichtbar, dann besessen (v1 = Sichtbarkeit)

## Motivation, konkret belegt (2026-08-04)

Zwei Sessions fuhren gleichzeitig Suiten. Beobachtet aus Lane `fleet-260804150902-7c66`:
- Ein isolated-Lauf (Wrapper-PID 55587) starb mittendrin mit exit 144 — kein Log, kein Killer
  benennbar, Instanz-Dir als einzige Spur (13 legitime srv-Restarts, dann ConnectionRefused im
  Harness). Zeitgleich startete die andere Session ihre Gate-Kette (Trail: security 16:09:09Z,
  claude-gate 16:09:47Z, isolated 16:10:24Z).
- Wrapper koordinieren sich über `/tmp/fleet-e2e.lock` (e2e-stage.sh:44–54): mkdir-Mutex,
  15-s-Sleep-Poll, Reap toter Halter. Das funktioniert — aber niemand SIEHT es. Wer wartet,
  wer hält, seit wann, warum ein Lauf starb: alles unbeobachtbar.

## Scope v1 — NUR Sichtbarkeit (Fleet-Linie: Surfaces informieren, Gates entscheiden)

1. **Selbst-Meldung der Gate-Läufe.** `POST /api/self/verify-intent` (self-token, hart
   slot-gebunden wie `/api/self/autos` und `/api/self/drift`): Body
   `{phase: "waiting"|"running"|"done"|"failed", suite: string, exitCode?: number}`.
   Freiwillig und advisory — der Mutex bleibt die Wahrheit der Serialisierung. Server hält
   die letzte Meldung pro Slot im Speicher + auf audit.jsonl (jede Phasenänderung eine Zeile:
   damit hat der nächste exit 144 einen Kontext).
2. **Lock-Transparenz server-seitig.** Der Server liest `/tmp/fleet-e2e.lock/pid` + prüft
   Liveness (kill -0-Äquivalent) und projiziert auf `/api/sessions`: Halter-PID, alive?,
   Haltedauer, plus die gemeldeten waiting/running-Slots aus 1. Anzeigen, NIE reapen —
   das Reapen gehört den Wrappern (e2e-stage.sh), doppelte Reaper wären ein neuer Kollider.
3. **Board-Anzeige.** Kleine Gate-Zeile in der Info-Karte (Platzierung mit Owner festnageln,
   pin-the-surface): „Gate: Lane 4 läuft isolated seit 3 min · Lane 7 wartet".

## Explizit NICHT in v1 (jedes Stück einzeln verworfen, nicht vergessen)

- Server startet/stoppt KEINE Suiten (das wäre Queue-Besitz = v2, erst nach Datenlage aus v1).
- Kein Fairness-Scheduling, keine Prioritäten, kein Merge-Train (Volumen rechtfertigt es nicht:
  ~6 Lands/Tag, docs-Verweis lane-outcomes).
- Kein Ersatz des mkdir-Mutex. Er ist bewiesen; die Queue ist erst Beobachtung.

## Mechanik-Hinweise für die Lane

- Auth-Muster 1:1 von `/api/self/drift` übernehmen (server.ts, Route direkt nach
  `/api/self/autos`; flat-cost 401, 409 für Nicht-Lane).
- `e2e/security.ts` PRE_AUTH_ROUTES braucht die neue Zeile `'= /api/self/verify-intent'` —
  sonst schlägt „§1 the pre-auth route set equals the reviewed allowlist" (deterministisch,
  genau dafür da; Scheibe ① ist exakt daran einmal rot gewesen).
- Checks als neue Familie `e2e/verify-queue.ts` — e2e/-Siblings brauchen KEINE
  Wrapper-Änderung (Kopierliste ist Import-Closure seit Stage-Fold 3d38960).
- Wrapper-Seite: e2e-stage.sh könnte die Meldung selbst absetzen (curl, best-effort,
  `|| true`) — dann melden ALLE Suiten, nicht nur brave Lanes. Entscheidung in der Lane:
  nur wenn es ohne neue Env-Kopplung geht (der Wrapper kennt PORT/TOKEN des LIVE-Servers
  nicht — vermutlich v1 nur Lane-Sessions + Lock-Transparenz, Wrapper-Meldung v1.5).
- Session-21-Lektion (HANDOFF): `. ./e2e-stage.sh` NIMMT den Suite-Lock — jede
  Instrumentierung des Stage-Skripts läuft also IM Lock-Fenster; die Meldung „waiting"
  müsste VOR dem Sourcen passieren, sonst kann sie nie gesendet werden, während man wartet.

## Done-Kriterium (ein Satz)

Der Server zeigt Halter + Wartende des Suite-Mutex und die selbst gemeldeten Gate-Phasen pro
Lane auf /api/sessions, jede Phasenänderung steht auf audit.jsonl, bewiesen durch
e2e/verify-queue.ts-Checks + volle Gate-Kette grün.
