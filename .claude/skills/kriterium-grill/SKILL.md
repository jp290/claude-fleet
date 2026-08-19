---
name: kriterium-grill
description: Bevor du ein Done-Kriterium für eine vage Auftragszeile festlegst — führt den Owner in Frage-Runden durch den Entscheidungsbaum, bis Kriterium und Verifikationsweg je Teil feststehen.
---

# kriterium-grill

Adaption von mattpocock/skills `grilling` (MIT, © Matt Pocock) für Clarify-Lanes dieses Repos.

Du bist eine **Clarify-Lane**, wenn dein Gründungsprompt sinngemäß sagt „settle WHAT DONE MEANS …
not to implement it yet". Dann gilt der Prompt vor der normalen Arbeitsdisziplin: kein Code, kein
Commit, bis der Owner bestätigt hat.

## Erst erden, dann fragen

**Fakten sind DEINE Arbeit, nie die des Owners.** Bevor eine Runde rausgeht: die genannten Dateien
lesen (`rg -n '<symbol>'`, `ast-grep --pattern '<muster>' --lang ts <datei>`, `sed -n 'A,Bp'`),
`git log --oneline HEAD..main -- docs/` gegen dein Regal prüfen, den relevanten Regelbuch-Abschnitt
nachschlagen. Alles, was du selbst nachsehen kannst, fragst du nicht.

Der Owner entscheidet nur, was eine ENTSCHEIDUNG ist.

## Der Baum, in Runden

Zeichne den Auftrag als Entscheidungsbaum: jede Entscheidung verzweigt in die, die an ihr hängen.

Die **Frontier** ist die Menge der Entscheidungen, deren Voraussetzungen schon geklärt sind — die
Fragen, die du JETZT stellen kannst, ohne eine Antwort zu raten, die du noch nicht gehört hast.
Stelle die ganze Frontier in EINER Runde, dann warte.

Eine Frage, deren Antwort von einer anderen offenen Frage dieser Runde abhängt, gehört in eine
SPÄTERE Runde. Das ist die Regel, die den Grill von einem Fragebogen unterscheidet.

Frageformat — 2 bis 4 Beispielantworten, damit der Owner durchantworten kann statt zu formulieren:

```
❓ **F1 — <Titel>**: <Frage, ggf. mit dem Fakt, den du gefunden hast>

   A) <konkrete Antwort>
   B) <konkrete Antwort>
   C) <konkrete Antwort>

➡️ Meine Empfehlung: <A/B/C> — <ein Satz Begründung>
```

Nach jeder Antwortrunde: Baum neu rechnen, Frontier neu bestimmen, nächste Runde. Fertig ist es,
wenn die Frontier leer ist — jeder Zweig besucht, nichts stillschweigend angenommen.

## Das Ergebnis

Je TEIL des Auftrags ein Paar, kein Sammelsatz:

- **Done-Kriterium** — ein prüfbarer Satz. Prüfbar heißt: zwei Leser kämen zum selben Urteil.
  „funktioniert" ist keins; „`bun e2e/pins.ts` endet mit ALL PASS und die neue Zeile X existiert"
  ist eins.
- **Verifikationsweg** — das ausgeschriebene Kommando, das dieses Kriterium prüft, plus was ein
  Fehlschlag bedeutet (Rethink oder Fix).

Dann ablegen und STOPPEN:

```
curl -X POST http://<fleet-host>:<port>/api/self/criterion \
  -H "content-type: application/json" \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  -d '{"text":"<Kriterium + Verify-Weg je Teil>"}'
```

Grenzen der Route (Stand: `server.ts`, grep `self/criterion` — bei Abweichung gilt der Code): nur
aus einer Lane (sonst 409), hängt an der Gründungs-Task mit Status `sent`, max 4000 Zeichen, der
Vorschlag steht mit `confirmedAt: null` da. Ein erneutes POST ERSETZT einen unbestätigten Entwurf,
aber nie einen bestätigten — danach gehört das Kriterium dem Owner (409).

## Danach

Nicht anfangen zu bauen. Dein Slot steht auf `awaiting: "owner"`; nur seine Nachricht oder seine
Bestätigung löst das Warten. Der Report ist: Baum in Kurzform, das abgelegte Kriterium, eine Zeile
Offenes.
