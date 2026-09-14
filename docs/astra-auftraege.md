# Astra-Auftraege aus der Orchestrierung (2026-09-14)

Wann eine Orchestratorin Arbeit an Astra (`codex / gpt-6-astra`) gibt, wie der Auftrag aussieht und
woran sie das Codex-Kontingent misst. Owner-Vorgabe 2026-09-14: „Codex Usage sinnvoll aufbrauchen,
am besten mit guten Prompts an Astra". Sinnvoll heisst: Arbeit mit pruefbarem Ergebnis, die sonst
liegen bliebe oder Opus-/Fable-Kontext kostet — nicht Volumen.

## 1. Der Sensor: Kontingent gegen Wochenfenster

Das Codex-Abo hat ein Wochenfenster. Jede Codex-Session schreibt den Stand in ihr Rollout-Log:

    F=$(ls -t ~/.codex/sessions/*/*/*/*.jsonl | head -1)
    grep -o '"rate_limits":{[^}]*}' "$F" | tail -1

`primary.used_percent` ist der Verbrauch, `window_minutes` 10080 die Woche, `resets_at` das Ende.
Die Regel vergleicht den Verbrauch mit dem verstrichenen Anteil des Fensters:

| Lage | Zug |
|---|---|
| Verbrauch mehr als 10 Punkte UNTER dem verstrichenen Anteil | Astra-Zeilen filen (Abschnitt 2) |
| innerhalb ±10 Punkten | nur filen, was ohnehin ansteht |
| mehr als 10 Punkte DARUEBER | keine neuen Astra-Zeilen; laufende fertig werden lassen |

Gemessen 2026-09-14 21:3x: 33 % verbraucht bei 35 % verstrichenem Fenster (Reset Sa 19.09.). Ein
Server-Sensor dafuer existiert nicht; `server.ts#codexExecUsage` zaehlt nur Tokens je `codex exec`.

## 2. Was an Astra geht — und was nicht

Geeignet, jedes mit einem Ergebnis, das die Orchestratorin in Minuten pruefen kann:
- **Entscheidungsvorlagen** vor einer Owner-Session: Inventar mit `server.ts#symbol`-Belegen, Entwuerfe
  mit Risiken, Empfehlung mit der tragenden Zahl.
- **Sichtungen** eines Backlog-Ausschnitts: je Zeile ein Urteil mit Beleg (erledigt/veraltet/zuordnen/schaerfen).
- **Karten-Schaerfung**: ungueltige Format-Koepfe in Ersatz-Koepfe, gegen `card-extract.ts#validateCard` geprueft.
- **Gegenlese** eines fremden Befunds oder Diffs mit einer benannten Frage.

Nicht an Astra: Code im Land-Pfad unter Zeitdruck, alles, was Owner-Token oder `fleet.json` braucht,
und Arbeit ohne pruefbares DONE. Opus-Lanes bleiben der Default fuer Code (MODELLPOLITIK).

## 3. Die Form

Jede Zeile ist eine normale Queue-Zeile im Karten-Format im Program der Orchestrierung, damit
`card-valid` sie startet und der Lane-Deckel gilt. Kopf: `ROLLE: codex/gpt-6-astra/<effort>` —
`medium` ist der Owner-Default (2026-09-07), `high` die Option fuer Urteile. Ein Lese-Auftrag hat eine
neue Notiz unter `NEU:` und `docs/messungen/INDEX.md` unter `FLAECHE:`; VERIFY ist die kurze Kette.

Nach dem Kopf der Brief in dieser Reihenfolge (Schablone vom 2026-09-11): englischer System-Prefix
(„You are GPT-6 Astra executing a brief … Infer intent. Bias towards action. … Return only the OUTPUT
specified.") · ZIEL · PRIORITY · AUTONOMY · EFFORT · DELEGATION · CONTEXT (Dateien in Reihenfolge) ·
CONSTRAINTS · OUTPUT · DONE MEANS (im Kopf als DONE) · DO NOT · „Tu es. Keine Rueckfrage." Fragt Astra
trotzdem, wird der naechste Brief haerter bei AUTONOMY und DONE, nicht laenger.

**Eingaben ohne Token.** Braucht der Auftrag Queue- oder Program-Daten, zieht die Orchestratorin einen
Auszug per Owner-API in ein privates Verzeichnis ausserhalb des Repos, prueft ihn per `grep` auf
Token und nennt nur den Pfad. Die Lane oeffnet `fleet.json` und `.env` nie: was sie liest, geht als
Kontext an ihren Anbieter.

## 4. Ernte

Der Report ist ein Claim. Die Orchestratorin liest die Notiz, prueft zwei Belege stichprobenhaft und
setzt dann selbst um (archivieren, Ersatzzeile filen, Owner-Vorlage). Astra schreibt keine Queue.

## 5. Erster Lauf, 2026-09-14 21:4x

Drei Zeilen im Program Fleet-Betrieb, alle Karten gueltig: `1e4a2ca5` Freigabe-Analyse fuer die
Owner-Session zu Richtung `247c2f37` (high) · `0afb3b1f` Sichtung der 12 Zeilen ohne Program (medium)
· `7519ac4b` Karten-Schaerfer, erster Lauf (medium).
