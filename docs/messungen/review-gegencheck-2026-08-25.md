---
frage: Tragen die fünf Verdikte des Reviews der System-Analyse (V1 bis V4 plus Delivery-Verdict) gegen Original-Analyse und zitierte Code-Nähte?
urteil: Kein Verdikt gekippt; ein Realbefund ist, dass die zweite dispatchbare Slice (V2-Ersatz null-zu-ID) bei Review-Landung bereits als f16b470 gebaut war und raus aus der Liste muss; eine Lücke bleibt, dass der falsche Owner-Kanal-Satz im Supervisor-Brief unsliced ist
bereich: [verify, lane-lifecycle]
belege: [docs/messungen/system-analyse-review-2026-08-25.md, f16b470, aea965d, server.ts#backfillProgramMainSessionId]
nicht-gemessen: <nicht ausgewiesen>
stand: 2026-08-25
---

# Gegencheck der Review-Verdikte — system-analyse-review-2026-08-25.md

2026-08-25, Lane `fleet/260825145050-0eb5`, Baum `aea965d` (= main). Startbedingung erfüllt:
`git show main:docs/messungen/system-analyse-review-2026-08-25.md` lesbar. Geprüft wurden alle fünf
Verdikte gegen die Original-Analyse und die zitierten Code-Nähte (jede file:line nachgeschlagen;
die Zeilennummern des Reviews beziehen sich auf seinen Ausgangsbaum `0dc7a33` und sind seit
`f16b470` um ~67 Zeilen gewandert — semantisch bleiben alle Zitate auffindbar).

## Verdikte

- **V1 CONFIRM — stimme zu.** Geteilte Occupancy-Naht, 15/19 tote Bindungen, `openAttention`-409
  ohne MAIN-Bindung und die Kostenpfade (101-s-Gate, ~8-min-Isolated, 45-min-Warteetat) sind im
  Code verifiziert; keine harte Invariante übersehen.
- **V2 REFUTE — Verdikt trägt, aber die Slice-Liste ist veraltet** (der einzige Fund, unten).
- **V3 REFUTE — stimme zu.** `sent→pending` ohne Zeitstempel (`detachSlotTasks`), `queued→pending`
  und `archived→pending` ohne `created`-Update (unqueue/unarchive), 18/80 mit `programId`, 21
  bewusst geparkte Zeilen — alles an der Naht verifiziert.
- **V4 CONFIRM — stimme zu.** „owner draft" steht aktiv in Client (`src/client.ts:9622`) und
  Proben (`e2e/watch.ts`, `acceptance-probe.ts`) neben den sechs Server-Kommentaren; die
  Scope-Erweiterung ist berechtigt.
- **Delivery DEFER — stimme zu.** Konsistent mit der eigenen Falsifikation des Originals (kein
  gemessenes Opfer seit `d0fa215`).

## Der Fund: Rang-2-Slice war bei Review-Landung bereits gebaut

Der Review-Commit `aea965d` (15:56) listet „V2-Ersatz — `null→ID` an der Quelle" als zweite
dispatchbare Slice (Write-Set `server.ts, e2e/restart.ts, e2e/programs.ts, docs/self-api.md`).
`f16b470` (14:27, 89 Minuten früher auf main gelandet) implementiert genau diesen Gegenentwurf:
`backfillProgramMainSessionId` (`server.ts:6421`) an vier Lernorten (`:4161` Auto-Bind, `:4841`
codex-bind, `:16179` Boot, `:19381` Spawn), Türenvergleich byte-identisch, Write-Set
`server.ts, e2e/programs.ts, docs/self-api.md`. Der Beleg des Reviews („`tickCodexRecovery` …
zieht `program.main` nicht nach", `server.ts:4147-4161`) beschreibt korrekt den Ausgangsbaum
`0dc7a33` — dort existiert kein Backfill (`git show 0dc7a33:server.ts`, verifiziert) —, war aber
zum Landezeitpunkt des Reviews auf main schon falsch. Wer Slice 2 dispatcht, baut Doppelarbeit;
sie muss aus der Liste kommen.

Nuanz: Die gelandete Implementierung füllt bei mehreren passenden null-Bindungen alle (`for`,
`server.ts:6421-6432`, begründet: Mehrdeutigkeit bleibt an `boundProgramForMain` laut verweigert),
während die Review-Spec „bleiben unverändert" sagt. Beide Designs halten die Tür zu; die
Abweichung ist im Code begründet und dokumentiert.

Das REFUTE selbst kippt nicht — die Landung bestätigt es eher: Die Self-Route wäre toter Code, das
exakte Triple bleibt Owner-Policy der Land-Tür (`server.ts:6647`,
`docs/authority-slice-brief-2026-08-23.md:36-46`).

## Eine Ranglistenlücke (kein gekipptes Verdikt)

Der Supervisor-Founding-Brief behauptet bis heute „POST /api/self/attention (reach the owner)"
(`server.ts:14848-14849`, spiegelgleich in `e2e/supervisor.ts:50`), obwohl die Route für den
Supervisor strukturell 409t (`boundProgramForMain`, `server.ts:6954-6955`; `AGENTS.md:57`). Das
Review benennt die Kollision korrekt, lässt sie aber als „separaten Honest-Surface-Defekt" ohne
Slice und ohne Rang stehen, während V4 — dieselbe Art Textarbeit — als Rang-4-Slice läuft. Ein
Founding-Brief, der eine nicht existierende Fähigkeit lehrt, verletzt die harte Invariante
„honest surfaces" aktiv und gehört mindestens in V4s Terminologie-Schnitt aufgenommen, nicht in
eine Fußnote.

## Fazit

Kein Verdikt gekippt: kein REFUTE, dessen Beleg nicht trägt; kein CONFIRM, das eine harte
Invariante übersieht; kein Autonomie-Item fälschlich unter der Schnittlinie (V1a, V2-Ersatz, V1b
stehen alle darüber). Ein Realbefund: die zweite „dispatchbare" Slice ist seit `f16b470` gebaut
und raus aus der Liste; eine Lücke: der falsche Owner-Kanal-Satz im Supervisor-Brief bleibt
unsliced.
