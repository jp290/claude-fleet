frage: Wie lassen sich die Abos gleichmaessig nutzen und vor einem nahen Reset staerker gewichten, wenn nur Codex einen Fuellstand liefert?
urteil: Heute sind statische Arbeitsanteile und eine frischeabhaengige Codex-Bremse ehrlich; gleichmaessiger Abo-Verbrauch und Schutz vor vorzeitigem Leerlaufen aller Abos sind ohne Claude- und GLM-Nenner nicht regelbar.
bereich: [routing, provider, kontingent, sensoren, ram]
belege: [codex-quota.ts:11, codex-quota.ts:40, server/types.ts:1191, server.ts:12811, land-quality.ts:21, Rohquellen Q/R/B im Abschnitt Herkunft]
nicht-gemessen: keine neue Verbrauchsmessreihe; Claude-/GLM-Limits und Resets, Token-zu-Kontingent-Gewichte, Routingwirkung und Spitzen-RAM unbekannt; Vorschlaege sind nicht implementiert
stand: 2026-09-17

---

# Sub-Routing: Arbeit verteilen, Regelbarkeit nicht vortaeuschen

## Urteil und Grenze

Der Owner-Wunsch ist mit den vorgegebenen Eingaengen **teilweise** erfuellbar:
Arbeitsanteile zwischen geeigneten Providern verteilen und Codex bei nachgewiesen
knappem Kontingent bremsen. Nur fuer Codex ist eine zeitbezogene Kontingentregelung
moeglich, solange dessen Beobachtung frisch und das relevante Fenster bekannt ist.
Fuer Claude ist ein relativer Lasttrend moeglich; fuer GLM bleibt eine explizite
statische Zuteilung. Fehlender Fuellstand bedeutet `unknown`, niemals `0` oder `ok`.

Ein Router kann ohne Nenner fuer Claude und GLM weder gleiche Verbrauchsprozente
herstellen noch Restlaufzeit oder erschoepfungsfreie Arbeit bis zum Reset zusichern.
Er kann nicht feststellen, welches dieser Abos gerade am leersten ist, ob es frisch
zurueckgesetzt wurde oder ob eine Umlenkung dorthin sicher ist. Gleiche Lane-Zahlen,
Tokenzahlen oder Laufzeiten sind keine gleichen Abo-Kosten. Auch ein bekanntes
Codex-Kontingent garantiert nichts ueber die Kosten des naechsten Auftrags.
Kosten eines falschen Versprechens: Arbeit wird auf ein vermeintlich freies Abo
gelenkt und scheitert dort; ein fehlendes Signal wird zur versteckten Freigabe.

„Abo laeuft ab“ braucht zwei getrennte Bedeutungen: Kontingent-Reset und Ende der
bezahlten Vertragslaufzeit. `resets_at` belegt nur Ersteres. Fuer Letzteres ist heute
bei keinem Provider ein Eingang belegt. Ein manueller Ablaufzeitpunkt waere eine
gekennzeichnete Vorgabe mit Herkunft und Gueltigkeit, keine Sensormessung.

## Herkunft: vorhandene Messlage, gezielt nachgelesen

Alle Zeiten unten sind mit Zone angegeben. Hostpfade sind lokale Rohbelege, keine
portablen Datenquellen; die Inhalte werden nicht ins Repo kopiert. Zeilen sind
JSONL-Zeilen, lesbar mit `sed -n '<Zeile>p' <Pfad>`; bei Transkripten nur das genannte
Feld lesen, nicht beliebige Tool-Eingaben oder Credentials ausgeben.

- **Q** = `/Users/owner/.codex/sessions/2026/09/08/rollout-2026-09-08T10-12-19-01a08013-3c11-76d2-bafb-d1d30bcf4bd4.jsonl`.
- **R** = `/Users/owner/.claude/projects/-Users-owner-claude-fleet/6ba575c0-939c-4263-8106-99481d7373b9.jsonl`.
- **B** = `/Users/owner/.codex/sessions/2026/09/17/rollout-2026-09-17T08-13-48-01a0adff-f6b1-7cb1-b818-a18cb4d53ee8.jsonl:9`, `payload.content`: Auftrag mit vorgegebener Messlage und Entscheidungsanlaessen.

| Eingang | Befund / Zahl | Herkunft und Beweisgrenze |
|---|---|---|
| Codex | `used_percent=42.0`, `window_minutes=10080`, `resets_at=1790101219`, `limit_id=codex`; `secondary=null` | Q:8292, `payload.rate_limits.primary`; Ereignis `timestamp=2026-09-16T19:15:22.505Z`. Reset umgerechnet: 2026-09-22 18:20:19 UTC = 20:20:19 Europe/Berlin. Das Wochenfenster ist beobachtet, weitere Fenster nicht. |
| Dateireihenfolge | Datei mit Namensdatum 09-08 war am 09-16 um 21:15 lokaler Zeit die neueste | R:1394, Tool-Ergebnis der mtime-Sortierung; Q:8292 bestaetigt das spaetere Ereignis im alten Dateinamen. Kein Beleg fuer heutige Frische. |
| Claude | Tokenzaehler, kein belegter Abo-Nenner oder Reset | R:24 zeigt `message.usage` mit `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`, ausserdem verschachtelte Details. Die negative CLI-/Limit-Pruefung und veraltete `stats-cache.json` werden aus B uebernommen, nicht erneut vollstaendig vermessen. Nicht jede JSONL-Zeile ist ein Usage-Ereignis. |
| GLM / Z.AI | Kein nutzbares Verbrauchs-/Kontingentsignal in der vorgegebenen Suche | R:1382 dokumentiert Verzeichnis und CLI-Suche unter `/Users/owner/.config/claude-fleet/pi-zai-agent`; B berichtet das negative Ergebnis. `auth.json` ist kein Sensor und wurde hier nicht gelesen. Keine Aussage ueber unbekannte externe Provider-APIs. |
| RAM | Claude 1587 MB bei 7 Prozessen; Codex 54 MB bei 4 Prozessen | R:1178, Tool-Ergebnis vom 2026-09-17T05:25:37.656Z. Prozessgruppen-RSS, keine garantierten Slot-Spitzenwerte. |
| Host | 8,0 GB physisch | R:586, Tool-Ergebnis `physmem: 8.0 GB`; B setzt denselben 8-GB-Host voraus. |
| Anlass | Zwei Entscheidungen innerhalb von 24 h haetten von einer Lastzahl profitiert: Master-Stop-Rueckdrehung und Routing | B. Auftraggeberurteil ueber den Nutzen eines Sensors, kein gemessener kausaler Nachweis, dass beide Entscheidungen damit richtig ausgefallen waeren. |

Die vorgeschlagene Claude-Suche umfasst `~/.claude/projects/**/*.jsonl`, einschliesslich
verschachtelter Subagent-Dateien, ueber alle Slots. Ohne Account-/Provider-Zuordnung
ist das nur **lokaler beobachteter Traffic**: Fremdrechner desselben Abos fehlen,
andere Accounts oder Provider duerfen nicht unbemerkt in dessen Zaehler geraten.

Im Baum nachgelesene Anschlussstellen: `server/types.ts:1191` speichert das Tripel
in `Task.spawn`; `server.ts:12887` beschreibt dessen Verwendung im Dispatch;
`server.ts:12717` startet Variantengruppen und prueft ab `server.ts:12738` die
Automatisierbarkeit. Varianten sind parallele Arbeit mit genau einem spaeteren
Gewinner (`server/types.ts:1199`), keine kostenlose Sparoption.
`land-quality.ts:21` behandelt fehlende Ergebnisdaten als null und offene
Nacharbeitsfenster als unbekannt; `land-quality.ts:41` nennt die Ergebnisfelder.
Das ist spaete Qualitaetsrueckmeldung, kein kausaler Providervergleich bei verschieden
schweren Auftraegen. Hier wurde weder eine neue Ergebnisserie noch der gesamte
Dispatch-/Adaptercode gelesen. Graphify diente als Wegweiser; die Belege stammen
aus den genannten Quellstellen. Der Graph-CLI meldete ein gekuerztes Budget von
ungefaehr 2000 Tokens, keine gemessenen Modellkosten.

## Landbare und ruecknehmbare Schnitte

Die Reihenfolge **a → b → c** ist sinnvoll. Eine Ergaenzung ist zwingend: Frische
muss schon mit b geliefert werden, nicht erst mit c. a liefert sofort eine Zahl
fuer Lastentscheidungen, ohne eine Abo-Prozentzahl vorzutaeuschen. b darf unabhaengig
von a auslieferbar bleiben; der Claude-Trend ist dort Anzeige, kein Quota-Eingang.
Jeder Schnitt bekommt einen eigenen Commit und eine eigene Umsetzungskarte; diese
Notiz implementiert oder aktiviert keinen davon.

### a — Claude-Lastsensor, rein lesend

**Flaeche / Wirkung:** Ein eigener Transcript-Reader mit CLI-Ausgabe fuer die vier
Usage-Kategorien pro Stunde, Vorfenstervergleich, Beobachtungszeit und Abdeckung.
Die Feldnamen stehen in R:24. Die Summe darf als Tokenvolumen angezeigt werden,
aber Cache-Read, Cache-Write, Input und Output bleiben daneben getrennt: deren
Kontingentgewicht ist unbekannt. Verschachtelte `iterations` und Cache-Details
nicht noch einmal addieren. Wiederholte Message-Eintraege nach Session/Message-ID
und dokumentierter Update-Semantik deduplizieren; nicht blind jede Zeile summieren.

Fenster anhand Ereigniszeit schneiden, unvollstaendige Stunden kennzeichnen,
fehlerhafte/fehlende Dateien als Abdeckungsluecke melden. Vollstaendig gelesene
Fenster ohne Usage koennen null Traffic zeigen; ein Scanfehler kann das nicht.
Ein fallender Trend belegt weniger beobachtete Arbeit, keinen Reset und kein freies
Abo. Damit kann eine Stop-Rueckdrehung besser begruendet werden, aber nicht allein
als „Kontingent wieder frei“ entschieden werden.

**Done / Probe:** Synthetische Transkripte liefern exakte getrennte Stundensummen
und Trends; doppelte Messages, Subagents, Fenstergrenzen und kaputte JSON-Zeilen
haben eigene Checks. Reject-Fall: fehlende Quelle ergibt unknown, nicht null Last.
**Ruecknahme / Kosten:** Reader und Anzeige entfernen, kein Dispatch-Zustand zu
migrieren. Kosten sind lokales I/O und Parserpflege; spaeter inkrementell lesen,
keinen Vollscan pro Dispatch-Tick. Keine gemessene Laufzeit behauptet.

### b — Statische Arbeitsanteile mit Codex-Schutz

**Flaeche / Wirkung:** Eine reine Auswahlfunktion liefert bei Task-Erstellung
fuer austauschbare, freigegebene Ausfuehrungsoptionen ein bestehendes Spawn-Tripel.
Speichern ueber den bestehenden validierten Task-Pfad (`server/types.ts:1191`),
keine laufende Lane migrieren und kein explizites ROLLE-Tripel ueberschreiben.
Start-/Release-/automatable-Gates bleiben massgeblich. Die Auswahl wird zuerst
als Vorschau pruefbar; Automatisierung gilt nur fuer ausdruecklich freigegebene
Optionen. Kosten: Modelleignung muss vor der Quote entschieden sein.

Owner-gewaehlte Gewichte verteilen **Zuteilungen innerhalb vergleichbarer
Auftragsklassen**, keine Abo-Prozente. Es gibt mangels Kostenkalibrierung hier
keine begruendbare optimale Gewichtszahl. Entscheidungsbeleg: Kandidaten,
Zielanteile, bisherige Zuteilungen, gewaehltes Tripel, ausgenommene Optionen und
Gruende. Wiederholte Vorschauen zaehlen keine neue Zuteilung. Laenger laufende
Arbeit macht diese Startanteile nicht zu gleichen Laufzeitanteilen.

Ein frischer Codex-Wert darf beim Unterschreiten einer expliziten Restreserve
weitere Codex-Zuteilungen begrenzen. Ein unbekannter Wert entfaellt als Live-Eingang;
Codex bleibt nur gemaess vorher festgelegter statischer Unknown-Policy zulaessig.
Claude/GLM bekommen ebenfalls nur explizit budgetierte Anteile unter unknown,
keine automatische Restkapazitaets-Freigabe. Wird Codex gebremst, darf der Router
nicht grenzenlos in die anderen Abos umleiten: deren Anteil-/Parallelitaetsgrenzen
gelten weiter, sonst wartet der Auftrag. Tatsaechliche Limits/Fehler stoppen neue
Starts dort bis zur geklaerten Freigabe; blindes Retry waere weiterer Verbrauch.

**Done / Probe:** Deterministische Zuteilungsfolge erfuellt vorgegebene Gewichte
bei gleichen geeigneten Kandidaten; Tests fuer feste Rollen, ausgeschlossene
Adapter, Codex-Reserve und fehlende/veraltete Werte. Reject-Fall: kein geeigneter
Kandidat ergibt einen sichtbaren Wartegrund, keinen stillen Modellwechsel.
**Ruecknahme / Kosten:** Auswahl abschalten/reverten; bereits gespeicherte Tripel
bleiben normale Tasks, neue werden wieder explizit besetzt. Kein neuer Scheduler.

### c — Zeit-/lastabhaengiges Nachsteuern nur mit Nenner

**Flaeche / Wirkung:** Auf b aufbauend eine begrenzte Anpassung der Codex-Gewichte.
`codex-quota.ts:11` berechnet bereits Verbrauch minus verstrichenen Fensteranteil;
`codex-quota.ts:40` liest nach mtime, gibt aber keinen Ereigniszeitstempel zurueck.
Diese Auswertung braucht einen gemeinsamen frischefaehigen Snapshot, bevor sie
Entscheidungen traegt. Bei mehreren bekannten Fenstern begrenzt das engste; fehlende
Fenster sind nicht als unbegrenzt bewiesen. Claude/GLM bleiben statisch, bis je Abo
Limit, beobachteter Verbrauch, Reset und Identitaet belastbar zusammenpassen.

Vorschlag fuer Codex: Rest = 100 − used_percent; verbleibende Zeit = Reset − jetzt.
Aus Q folgen **58 Prozentpunkte historischer Rest**, nicht heutige Verfuegbarkeit.
Eine Reserve abziehen und den verbleibenden Rest auf die Restzeit verteilen;
beobachteten Verbrauchszuwachs nur innerhalb desselben Fensters vergleichen.
Fensterwechsel trennt die Reihe. Eine lineare Verbrauchskurve ist eine
Planungsannahme, keine Zusage des Providers. Ein Owner-Parameter fuer den Fokus
bestimmt, wie stark ein Verbrauchsrueckstand vor Reset das Basisgewicht erhoeht;
begrenzte Schritte und Hysterese verhindern dauerndes Umschalten.

Ein naher Reset allein ist kein Beschleunigungsgrund: nur frischer Rest oberhalb
der Reserve und geeignete wartende Arbeit erlauben mehr Gewicht. RAM-,
Qualitaets- und Freigabegrenzen bleiben davor. Keine sinnlosen Aufgaben zum
„Leerfahren“. **Done / Probe:** Zeitachsen fuer Rueckstand, vorauslaufenden Verbrauch,
Reserve, Reset, fehlende Fenster und stale Werte liefern exakte Entscheidungen;
Reject-Fall: ohne Nenner keine dynamische Gewichtung. **Ruecknahme / Kosten:**
Dynamik entfernen, b bleibt statisch nutzbar. Kalibrierung kostet Beobachtungszeit;
Nacharbeit/Audit aus `land-quality.ts:41` gegen vergleichbare Aufgaben verfolgen,
keine automatische Qualitaetsrangliste aus gemischten Auftraegen ableiten.

## Passivitaets-Falle: Frische ist ein Eingang

Datei-mtime findet Kandidaten, ist aber nicht das Alter des Fuellstands: eine
Rollout-Datei kann durch andere Ereignisse frisch werden. Ausschlaggebend ist der
Zeitstempel des letzten gueltigen Kontingentereignisses fuer Account/Fenster.
Reader-Ausgabe muss Quelle, Ereigniszeit, Lesezeit, Fenster und Status enthalten.
Gueltige Ereignisse verschiedener Dateien nach Ereigniszeit abgleichen; die erste
Datei nach mtime allein beweist nicht den juengsten Kontingentwert.

Vorschlag: eine explizit konfigurierte maximale Altersgrenze. Deren konkreter Wert
ist noch zu kalibrieren, kein aus dieser Messung abgeleiteter Standard. Alter ueber
Grenze, vergangener Reset ohne neue Probe, Zukunftszeit oder defekter Inhalt ergeben
`unknown` mit Grund. Ein stundenalter Wert darf daher nur dann als frisch gelten,
wenn die erklaerte Policy das bewusst erlaubt; sonst entfaellt seine Regelwirkung.
Nach Reset insbesondere nicht automatisch `used_percent=0` setzen.

Ohne laufende Codex-Session entsteht kein neuer beobachteter Wert. Deshalb weder
„voll“ behaupten noch endlos auf einen Sensor warten, dessen Entstehung der Router
selbst verhindert. Ein unter der statischen Unknown-Policy ohnehin erlaubter,
nuetzlicher Codex-Auftrag kann neue Evidenz liefern; bis dahin gelten dessen feste
Grenzen. Wenn Unknown-Starts nicht freigegeben sind, sichtbar warten und eine
manuelle Entscheidung verlangen. Keine heimliche Heartbeat-Session: auch eine
Sensor-Aktivierung verbraucht Ressourcen. Wiederholtes Lesen alter Bytes ist keine
neue Messung. Eine automatische Wiederaufnahme wegen angeblichem Reset ist gesperrt.

## RAM ist ein zweites Budget

Aus R:1178: 1587 / 7 = **226,7 MB** je beobachtetem Claude-Prozess; 54 / 4 =
**13,5 MB** je Codex-Prozess. Quotient **16,8**, Differenz **213,2 MB**. Das erklaert
die gerundeten **~227 MB gegen ~13,5 MB** des Auftrags. Als reine Hochrechnung
entspraechen vier solche Prozesse **~906,9 MB gegen 54 MB**, Differenz **~852,9 MB**.
Alle Ableitungen sind Division/Multiplikation derselben gerundeten RSS-Gruppensummen;
keine neue Messung und keine garantierte Einsparung pro umgerouteter Lane.

Auf dem belegten **8-GB-Host** (R:586) ist dieser Abstand entscheidungsrelevant.
RSS zaehlt geteilte Seiten mehrfach, schwankt mit Arbeit und Alter und erfasst hier
nicht den kompletten Prozessbaum je Lane. GLM-RAM, Spitzen und freie Startreserve
sind unbekannt. Daraus folgt **keine maximale sichere Slotzahl**. OS, Server,
Builds, Tests und sonstige Prozesse brauchen ebenfalls Speicher.

Schon b sollte mit expliziten Parallelitaetsbudgets arbeiten. Ein eigener,
unabhaengig landbarer **Schnitt r** kann spaeter einen read-only Host-/Prozessbaum-
Sensor und danach eine Startbegrenzung bei Speicherdruck liefern: ohne vertrauliche
Kommandozeilen auszugeben, mit unbekanntem Messwert als eigenem Zustand.
Done: synthetischer Speicherdruck verhindert neue Starts, vorhandene Arbeit bleibt
unberuehrt; fehlende Messung verwendet nur das explizite statische Limit und meldet
unknown. Ruecknahme: dynamische Begrenzung entfernen, statisches Limit behalten.
Dieser Schnitt ist keine Voraussetzung fuer den Claude-Trendsensor und kein Anlass,
jetzt aus RSS eine Scheingenauigkeit fuer freie Slots abzuleiten.

## Adapter und Oberflaechen: ausdrueckliche Disposition

| Flaeche | Entscheidung fuer die vorgeschlagenen Schnitte |
|---|---|
| Claude | apply: a/Trend, b/statische Anteile; unsupported: c/Abo-Regelung ohne Nenner |
| Codex | apply: b/Frische und Reserve, c/Fensterregelung |
| pi-zai / GLM | apply: b/statische Anteile bei bestehender Freigabe; unsupported: live Quota/Trend aus den vorgegebenen Quellen |
| Wire / Server | apply: Snapshot mit unknown/Quelle/Zeit und nachvollziehbarer Auswahl; bestehendes Spawn-Tripel verwenden |
| Client / Ruecklesen | apply: Quelle, Alter, feste Anteile und Wartegrund sichtbar machen; aus gewaehlt nicht „Kontingent reicht“ ableiten |
| Reverse-State / Neustart | apply: gespeicherte Zuteilungen nachvollziehbar laden; Verlust von Messdaten ergibt unknown, kein Reset der Kontingente |
| Docs / Probes | apply: Einheiten, Freshness-Policy, Grenzen und Reject-Faelle je Schnitt mitliefern |
| Provider-API / Credentials / automatable-Aenderung | not-applicable: keiner der Schnitte benoetigt hier eine neue externe API oder veraenderte Freigabe |

Offen bleiben die zu promovierenden Arbeitsgewichte, Unknown-Startbudgets,
Freshness-Grenze, Restreserve und Fokusstaerke. Diese fehlenden Policywerte verhindern
nicht den ersten rein lesenden Schnitt a. Die fehlenden Claude-/GLM-Nenner verhindern
weiterhin das Versprechen, dass keines der Abos vorzeitig leerlaeuft.
