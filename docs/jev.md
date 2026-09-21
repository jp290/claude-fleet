# Jev — was es ist, wie es sich verhaelt, was im Fleet dafuer gilt

Referenz, kein Bauplan. Stand 2026-09-18; **in diesem Repo ist nichts davon gebaut.** Jede Zahl unten
traegt ihre Herkunft: **[Doc]** = Anbieter-Dokumentation, an diesem Tag von diesem Host gelesen ·
**[Essay]** = „Jev's Architecture Unmasked" (archerhume.com, 2026-09-17; Black-Box-Messung eines
Autors, sein Evidenz-Bundle ist hier nicht geoeffnet worden) · **[Agent]** = von einem Lese-Agenten
dieses Repos am fremden Quellcode oder an dessen Rohdaten nachgerechnet · **[Fremd]** = Angabe eines
Drittprojekts, nicht nachgerechnet. Die Auswertung dahinter:
`docs/messungen/2026-09-18-jev-fuer-den-fleet-auswertung.md`.

## 1. Was es ist

Jev ist das erste „System One"-Modell von TypeSafe (`typesafe.ai`), oeffentlich seit 2026-09-15.
**Es erzeugt keinen Text.** Ein Aufruf nimmt einen `state` und eine Map typisierter Fragen und gibt je
Frage ein typisiertes Urteil mit Wahrscheinlichkeiten zurueck. Was ein LLM als Satz schreiben wuerde
(„zu 90 % sicher"), ist hier eine Zahl aus der Vorhersageverteilung des Modells, laut Anbieter gegen
Ausgaenge trainiert (RLCD) [Doc].

- Modell-ID `jev-1.13.0`; die Aliases `jev-latest` und `jev-preview` zeigen heute beide darauf [Doc].
  Gateways fuehren es unter eigenen Namen (OpenRouter, Cloudflare, Vercel) [Fremd].
- Preis 0,042 $ je Million Input-Tokens, Output frei. Limits 250 000 Tokens/s und 1 200 Requests/min —
  laut Anbieter „adjusting dynamically", also kein Festwert. 64k Tokens je Request, 32k fuer `state`
  plus die laengste Frage [Doc].
- Dieselben Gewichte fuer jeden Account, kein Fine-Tuning auf Kundendaten [Doc]. `/legal.md` verlinkt
  Data Processing Agreement und Privacy Policy und nennt Zero Data Retention fuer Enterprise-Kunden
  [Doc]. Die Vertragstexte selbst sind hier nicht gelesen — siehe §6. (Erste Fassung dieser Datei
  behauptete, eine solche Seite fehle; widerlegt von der Astra-Vorlage, G11.)
- Docs: `https://docs.typesafe.ai/llms.txt` (Index), `/api.md`, `/models.md`, `/confidence.md`,
  `/model-jaggedness/jev-1.13.md`. Lokal installiert ist der Skill `typesafe-ai` des Plugins
  `typesafe@typesafe-ai`.

## 2. Die Schnittstelle [Doc]

    POST https://api.typesafe.ai/v1/systemone        Authorization: Bearer <API_KEY>
    { "model": "jev-latest",
      "state": <string | object | array>,
      "questions": { "<id>": { "type": "noul" | "choice" | "score", "instructions": …, "criteria": … } } }

| Primitiv | `criteria` | Antwort |
|---|---|---|
| **Noul** — eine Aussage gilt oder nicht | optional `{ "true": "...", "false": "..." }` | `noul`: 0…1. **Kein `confidence`-Feld.** |
| **Choice** — eins aus einer Menge | Pflicht: Map Option → Beschreibung | `choice` (argmax), `probabilities` (summiert 1), `confidence` |
| **Score** — Grad auf beschriebenen Stufen | Pflicht: Array der Stufen | `score` (wahrscheinlichkeitsgewichtet, kann zwischen Stufen liegen), `legend`, `probabilities`, `confidence` |

Die Frage-ID geht nicht ans Modell. `usage.output_tokens` ist eine Abrechnungsgroesse der
serialisierten Antwort, kein Mass fuer Generation [Essay]. Ueber einem Limit antwortet die API 429.

## 3. Wie es sich verhaelt

1. **Der State wird einmal kodiert, jede Frage liest ihn fuer sich; Fragen sehen einander nicht.**
   Ein Geheimnis in einer Nachbarfrage wirkte mit P = 0,00, dasselbe im State mit 0,90–0,92 [Essay].
   Bis ~100 Fragen bleibt die Serverzeit flach, 1 500 Fragen kamen in wenigen hundert ms zurueck; ein
   State von 23k Tokens mit 5 000 Fragen passt in einen Request [Essay]. Folge: haengt eine Frage von
   der Antwort einer anderen ab, ist das eine zweite Stufe im Code.
2. **Evidenz gehoert in den State.** Dieselbe Information im State: 48/48 richtig; als erste oder
   mittlere Option 12/16 und 11/16 [Essay].
3. **Eine Choice ist list-abhaengig.** Optionen umdrehen verschob P von 0,84–0,89 auf 0,93–0,96; eine
   irrelevante fuenfte Option aenderte die Odds zweier bestehender in 10 von 10 Bloecken [Essay].
   Eine Noul hat diese Effekte nicht. Eine Schwelle gilt nur fuer genau die Optionsmenge, an der sie
   gemessen wurde.
4. **`confidence` ist Arithmetik ueber `probabilities`:** fuer eine Choice ungefaehr `(k·p_max − 1)/(k − 1)`
   — an 770 echten Antworten mittlerer Fehler 0,0037, maximal 0,0175, nur 356 exakt; die genaue interne
   Formel und Rundung sind unbekannt [Agent]. Es ist kein zweites Urteil
   darueber, ob die Antwort stimmt; eine spitze Verteilung kann falsch sein.
5. **Nicht deterministisch**, auch nicht bei Duplikaten im selben Request; Wahrscheinlichkeiten kommen
   auf zwei Nachkommastellen [Essay].
6. **Kalibrierung ist eine Eigenschaft ueber viele Faelle und pro Aufgabe zu messen.** ECE 0,031 auf
   1 200 MMLU-Items, 990 davon im Bin 0,9–1,0 [Essay]; ECE 0,156 im Workflow eines Drittprojekts
   [Fremd]; ECE₅ 0,010 auf einer Einzelfrage gegen 0,216 auf einer aus vier Fragen zusammengesetzten
   Entscheidung, bei 8–24 verschiedenen Faellen [Agent].
7. **Dokumentierte Schwaechen** [Doc, Jaggedness-Seite]: liest woertlich · zaehlt, rechnet und
   vergleicht Daten schlecht · scheitert an Indirektion · verliert Genauigkeit bei grossem State voller
   Ballast · anfaellig fuer Text im State, der das Urteil lenken will · keine Generation · und
   **Nicht-Englisch hat laut `models.md` geringere Genauigkeit**; eine Noul und eine Choice auf dieselbe
   Aussage koennen weit auseinanderliegen, und Aussage plus Negation summieren nicht auf 1 (Jaggedness-
   Seite: 0,72 + 0,47). Fuer Deutsch gibt es nirgends eine Messung; das
   naechstbeste sind 799 japanische Datensaetze mit nur zwei Positiven [Agent].
8. **Optionsgrenzen lassen sich durch Text nicht faelschen** (105 Versuche, sieben Trennformate)
   [Essay]. Das schuetzt die Form der Antwort, nicht ihren Inhalt.

## 4. Wofuer es taugt — als Form, nicht als Versprechen

Jev ersetzt an einer Stelle ein teures LLM, einen Regex, einen Menschen oder — der interessante Fall —
gar nichts, wenn vier Dinge gelten: der Antwortraum ist geschlossen, der noetige Zustand passt als
kleines JSON in den State, ein Fehlurteil ist verkraftbar, und es gibt spaeter eine billige Wahrheit
zum Gegenpruefen. Die Hebel sind Tempo, Kosten, Abdeckung (Stichprobe wird Vollerhebung), Frequenz
(einmal wird jeder Tick) oder eine neue Faehigkeit. Zwoelf wiederkehrende Zuege aus 45 Fremdprojekten:
`docs/messungen/2026-09-18-grok-jev-rohantworten.md`, Runde 3.

Zwei Bauformen folgen aus §3.1: **ein Aufruf je Ereignis mit dem ganzen Frage-Set**, und die
Umkehrung — **das Gemeinsame in den State, die N Items als N Fragen**. Wie gut Jev bei langen Fragen
ist, hat niemand gemessen.

## 5. Was im Fleet dafuer gilt

Der Vertrag ist der, den `card-extract.ts` fuer jedes kleine Modell hier schon faehrt: das Modell
liefert eine FORM, geprueft wird gegen eine Tatsache.

- **Ein Jev-Urteil ist ein Bericht, nie ein Gate.** `null` heisst unbekannt und ist nie Erlaubnis —
  dieselbe Richtung wie jede Klausel in `lane-signals.ts`. Wo ein deterministischer Fakt existiert,
  fragt niemand ein Modell.
- **„[Zitat entfernt]“ ist zu undifferenziert** (Owner 2026-09-21, woertlich): „[Zitat entfernt]“
  
  
  werden können". Die Trennlinie laeuft also nicht zwischen Bericht und Entscheidung, sondern so: Jev
  waehlt unter Optionen, die CODE als legal gebaut hat, und macht aus Live-Zustand getypte Daten; was
  mit den Daten geschieht, und jede harte Regel (Land, Deploy, Deckel, Master-Stop), bleibt Skript.
  Vorbild ist der Spiel-Lauf: Jev faehrt, der Planer ruft selten ein Ziel hinein, das Bett-Timing
  bleibt Code (`docs/messungen/2026-09-21-video-jev-theo.md` §3). Der Satz darueber gilt unveraendert
  — ein Gate wird Jev dadurch nicht.
- **Fehler faellt auf `null`:** ein hartes Timeout, keine Retries im heissen Pfad, die ganze Antwort
  validieren, bevor ein Urteil gelesen wird (Antwort-IDs = Frage-IDs). Ein zu grosser State fuehrt zur
  Enthaltung, nicht zum Abschneiden.
- **Geloggt wird die Verteilung**; `confidence` hoechstens zusaetzlich zur Reproduzierbarkeit, nie als eigene Evidenz; dazu Frage-Set-Version, Modell angefragt und
  geantwortet, ein HASH des States statt des States. Die Schwelle gehoert nicht in den Hash, damit
  gespeicherte Urteile neu schwellbar bleiben.
- **Fragen:** Aussageform, State-Felder beim Namen genannt, ein Ausschluss fuer den Beinahe-Fall in
  jeder Frage, keine Frage sagt, was zu tun ist, Strings versioniert. Rechnen, Zaehlen und
  Kandidaten-Erzeugen bleiben Code.
- **Schwellen** kommen aus eigenen Labels und aus dem Kostenverhaeltnis der jeweiligen Aktion, nie aus
  einem Cookbook. Vor jedem Einsatz klaeren, wohin ein „unsicher" faellt: ein Drittprojekt war je Aufruf
  96 % billiger und im System 4,1 % teurer, weil unsichere Faelle in einen Alles-oder-nichts-Pfad
  zurueckfielen [Agent].
- **Modell, URL und Schluessel leben in der gitignorierten `.env`**, nie in einer getrackten Datei.

## 6. Offen

- Ob dieser Host `api.typesafe.ai` erreicht (die Docs ja, die API ist ungeprobt).
- Guete auf DEUTSCHEM Fleet-Material — die erste eigene Messung vor jedem Bau.
- Ob DPA und Privacy Policy des Anbieters das Senden von Fleet-Daten tragen: die Vertragstexte sind am
  2026-09-21 gelesen (`docs/messungen/2026-09-21-jev-vertragstexte-gelesen.md`) — kein Training auf
  Input, aber keine Aufbewahrungsfrist, kein Loeschanspruch, unbefristet freie „Telemetry", ZDR nur
  Enterprise. Tragbar fuer bereits oeffentliches Material; eine Freigabe gibt es weiterhin nicht. Bis
  dahin kein API-Aufruf mit Fleet-Daten. Vertraglich ausgeschlossen: Jev-Urteile als Trainingslabels
  fuer ein eigenes Modell (MCA 2.3 b).
- Bestand der Schnittstelle: drei Tage oeffentlich, ein Anbieter, geschlossene Gewichte, Limits in
  Bewegung. Deshalb steht Jev nie auf einem kritischen Pfad.
