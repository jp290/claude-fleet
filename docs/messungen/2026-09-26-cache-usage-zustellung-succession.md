---
frage: Wie wirken Prompt-Caching, Zustellungen, Buendelung und Nachfolge auf Cache-Treffer und Usage im Fleet (Claude Code und Codex, 7 bzw. 14 Tage)?
urteil: Die Cache-Kante liegt bei Claude hart bei 60 min (unter 58 min 15 von 23 407 Requests kalt, ueber 62 min 119 von 120), ein kalter Weckruf kostet rund 25-mal so viel wie ein warmer; Buendelung spart je nach Event-Anteil 13 bis 30 % der Zustellungen bei 600 s und muss auch bei idlem Empfaenger halten, empfohlen 900 s mit Cache-Deckel 3300 s; Nachfolgen bei ~318k sparen 15 % gegen Weiterlaufen, das Kostenoptimum liegt bei ~24 %, empfohlen FLEET_MIGRATE_PCT=25.
bereich: [cache, usage, zustellung]
belege: [server.ts#tickMigrate, server.ts#contextReading, server.ts#successionFacts, docs/messungen/2026-09-26-zustellungen-klassen-kosten.md, AGENTS.md#context-self-management]
nicht-gemessen: Plan-Limit-Anrechnung von Cache-Reads im Claude-Abo, Antwortqualitaet nach Fuellstand, Inhalt der Zustellungen, Codex-MAIN-Nachfolgen, 43 % der Audit-Zustellungen ohne Claude-Transkript-Gegenstueck
stand: 2026-09-26
---

# Cache-Treffer und Usage: Zustellung, Buendelung und Succession gegen die Caching-Mechanik

2026-09-26, Lane `fleet/260926134604-1678` (Zeile ad578827). Frage: **Was kostet eine Zustellung
oder eine Nachfolge, gemessen an der Caching-Mechanik von Claude Code und Codex, und welche
Grace-Period und welche Nachfolge-Schwelle folgen daraus?**

Alle Dollarwerte sind **API-Listenpreis-Aequivalente**, berechnet aus den usage-Feldern mal den
Preisen aus §1. Der Fleet laeuft auf Abo und Codex-Plan; wie das Abo Cache-Reads und -Writes auf
seine Limits anrechnet, dokumentiert der Hersteller nicht (§1.4). Die Dollarzahlen sind deshalb ein
Gewichtungsmass, keine Rechnung.

## 1. Primaerquellen (abgerufen 2026-09-26)

### 1.1 Claude API

Quelle: <https://platform.claude.com/docs/en/build-with-claude/prompt-caching> und
<https://platform.claude.com/docs/en/about-claude/pricing>, beide abgerufen 2026-09-26.

- TTL: "By default, the cache has a 5-minute lifetime." Eine 1-h-Dauer gibt es gegen Aufpreis.
  "The cache is refreshed for no additional cost each time the cached content is used." Die
  Lebensdauer zaehlt "from the start of the request that writes or reads the cache entry".
- Preise relativ zum Basis-Input: 5-min-Write 1,25x, 1-h-Write 2x, Read 0,1x; Ausnahme
  "Cache hits and refreshes on Claude Opus 5.5 are priced at 0.05x the base input price".
- Opus 5.5 konkret: Input $4, 5-min-Write $5, 1-h-Write $8, Read $0,20, Output $20 je MTok.
  Opus 5: $5 / $6,25 / $10 / $0,50 / $25. Fable 5.1: $10 / $12,50 / $20 / $0,25 / $50.
  1M-Fenster ohne Aufpreis: "A 900k-token request is billed at the same per-token rate as a 9k-token request."
- **Folge fuer Opus 5.5 mit 1-h-TTL: ein Token neu schreiben kostet 40-mal so viel wie ein Token
  lesen** ($8 gegen $0,20).
- Invalidierung: Praefix-Reihenfolge `tools`, `system`, `messages`; Aenderung der Tool-Definitionen
  invalidiert alles, Thinking-Konfiguration und `output_config.effort` invalidieren die
  message-Bloecke. Mindestlaenge fuer Opus 5.5: 512 Token.
- usage-Felder: `cache_creation_input_tokens`, `cache_read_input_tokens`, `input_tokens` (nach dem
  letzten Breakpoint), dazu `cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens`.

### 1.2 Claude Code

Quelle: <https://code.claude.com/docs/en/prompt-caching> und <https://code.claude.com/docs/en/costs>,
abgerufen 2026-09-26.

- TTL je Request-Bucket: Hauptgespraech auf Abo innerhalb des Plans **eine Stunde**; "Everything
  else" (Subagenten, Workflows, Compaction, Titel) fuenf Minuten. Mit Usage-Credits, API-Key oder
  Cloud-Provider fuenf Minuten. Steuerbar ueber `CLAUDE_CODE_PROMPT_CACHE_TTL`,
  `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL`, `ENABLE_PROMPT_CACHING_1H`, `FORCE_PROMPT_CACHING_5M`.
- Invalidieren: Modellwechsel, Effort-Wechsel (ausser Opus 5.5 und Fable 5.1 auf API-Key oder Abo),
  Fast-Mode an, MCP-Server/Plugins mit Tools im Praefix, Tool-Deny, Compaction, viele Bilder,
  Claude-Code-Upgrade (neue Sessions). Cache-neutral: Dateien editieren, CLAUDE.md mitten in der
  Session editieren (wirkt erst nach `/clear`/`/compact`/Neustart), Permission-Mode, Skills, `/rewind`,
  Subagent-Start.
- Cache-Scope: "effectively scoped to one machine and directory"; Worktrees haben je ein eigenes
  Verzeichnis. "Sequential sessions share the prefix only when the git status snapshot taken at
  startup matches."
- Costs-Seite, woertlich zum Fleet-Muster: "Cross-session messages: Claude Code delivers a message
  from another of your sessions as a new turn when this session sits idle, sending your full context
  each time." und "your first message after a break longer than the cache lifetime misses the cache
  and reprocesses your full context."

### 1.3 OpenAI API und Codex

Quelle: <https://developers.openai.com/api/docs/guides/prompt-caching>,
<https://developers.openai.com/api/docs/pricing>, <https://learn.chatgpt.com/docs/pricing>
(Weiterleitung von developers.openai.com/codex/pricing), abgerufen 2026-09-26.

- Automatisch, Praefix-Match: "Cache reuse requires the entire rendered prefix to match."
  Mindestlaenge 1 024 Token ab GPT-5.6.
- Retention ab GPT-5.6: "A cached prefix remains eligible for reuse for 30 minutes after its most
  recent write or reuse, though OpenAI may retain it longer."
- API-Preise je MTok: gpt-6-sol Input $2, cached $0,20, Cache-Write $2,50, Output $10;
  gpt-6-luna $0,10 / $0,01 / $0,125 / $0,50; gpt-6-astra $10 / $1 / $12,50 / $50.
- Codex-Plan-Credits je MTok: gpt-6-sol 50 / cached 5 / Output 250; gpt-6-luna 2,5 / 0,25 / 12,5;
  gpt-6-astra 250 / 25 / 1 250. "Codex credit billing has no separate cache-write charge."
- **Folge: im Codex-Plan kostet ein Miss 10-mal einen Treffer (nicht 40-mal wie bei Opus 5.5).**

### 1.4 Unbekannt, nicht aus dem Gedaechtnis gefuellt

- Wie das Claude-Abo (Max) Cache-Reads und 1-h-Writes auf das 5-h- und Wochenlimit anrechnet: in
  keiner abgerufenen Seite beziffert.
- Welche Retention Codex CLI mit gpt-6-* tatsaechlich bekommt, und ob Modell- oder
  Reasoning-Wechsel im Codex CLI den Cache verwerfen: in keiner abgerufenen Herstellerseite fuer
  Codex CLI beschrieben. §2.3 misst die Retention.
- Codex-Credit-Saetze fuer gpt-5.6-sol und gpt-5.6-terra: nicht in der abgerufenen Tabelle.

## 2. Gemessene Cache-Trefferquote je Rolle und die TTL-Kante (7 Tage)

Fenster: 2026-09-19 13:40 UTC bis 2026-09-26 13:40 UTC.

### 2.1 Claude-Transkripte je Rolle

Korpus: 210 Hauptgespraeche und 71 Subagenten-Dateien, 25 403 Requests (eindeutig nach
`message.id`). Trefferquote = `cache_read / (cache_read + cache_creation + input)` ueber Tokens.
Kosten nach Modell (Opus 5.5: 14 443 Requests, Opus 5: 10 056, Fable 5.1: 882, Rest 22).

| Rolle | Sessions | Requests | Cache-Read | Cache-Write | Treffer | API-Aequ. | davon Write / Read / Output |
|---|---:|---:|---:|---:|---:|---:|---|
| Lane | 116 | 9 176 | 1 674 M | 25,4 M (1 h) | 98,5 % | $1 071 | 22 / 62 / 16 % |
| Program-MAIN | 57 | 9 288 | 1 993 M | 30,5 M (1 h) | 98,5 % | $932 | 32 / 54 / 14 % |
| sonstige Checkout-Session | 18 | 2 575 | 546 M | 8,9 M (1 h) | 98,4 % | $354 | 27 / 60 / 13 % |
| Orchestratorin (Slot 9) | 16 | 2 535 | 560 M | 6,6 M (1 h) | 98,8 % | $211 | 26 / 60 / 15 % |
| Subagent | 71 | 1 658 | 187 M | 10,3 M (5 min) | 94,8 % | $117 | 47 / 50 / 3 % |
| **Summe** (inkl. 3 unzugeordnete) | 281 | 25 403 | 5 005 M | 82,1 M | 98,4 % | **$2 715** | 27 / 59 / 14 % |

Die Token-Trefferquote von 98 % verdeckt die Kosten: 1,6 % der Input-Tokens sind Writes und tragen
27 % der Kosten. Die Reads tragen 59 %: jeder Request liest den ganzen Kontext (im Mittel ~205k Tokens).

### 2.2 Die TTL-Kante (Claude)

Abstand = Zeitstempel des ausloesenden User- oder Tool-Datensatzes minus Ende der vorigen Antwort.
Kalt = Read-Anteil unter 50 %, nur Requests mit mindestens 20k Kontext.

| Abstand | Hauptgespraeche n | kalt | mittlerer Write | Subagenten n | kalt |
|---|---:|---:|---:|---:|---:|
| 0–1 min | 21 384 | 8 (0,0 %) | 1 690 | 1 568 | 8 |
| 1–5 min | 834 | 2 (0,2 %) | 1 157 | 2 | 0 |
| 5–10 min | 456 | 3 (0,7 %) | 1 444 | 2 | 2 |
| 10–30 min | 514 | 2 (0,4 %) | 1 431 | 0 | – |
| 30–50 min | 194 | 0 | 526 | 1 | 1 |
| 50–58 min | 25 | 0 | 304 | 0 | – |
| 58–62 min | 9 | 5 (56 %) | 107 534 | 0 | – |
| 62–70 min | 16 | 16 (100 %) | 193 323 | 0 | – |
| 70–120 min | 49 | 48 (98 %) | 180 592 | 0 | – |
| > 120 min | 55 | 55 (100 %) | 180 423 | 0 | – |

Je Rolle dieselbe Kante: Orchestratorin 2/2 508 kalt unter 58 min, 10/11 darueber; Program-MAIN
3/9 149 gegen 79/82; Lane 3/9 040 gegen 21/21. Nach der Kante bleiben median 12 % Read: das ist der
geteilte Sockel aus System-Prompt und Tools (median 26,5k Tokens, §4.1). **Jede Session im Fleet
laeuft auf der 1-h-TTL; Subagenten auf 5 min.**

### 2.3 Codex-Rollouts

Korpus: 264 Rollouts unter `~/.codex/sessions` mit Requests im Fenster (125 mit cwd im
claude-fleet-Baum), 19 136 Requests aus `token_usage_record`. `cached_input_tokens` ist Teilmenge von
`input_tokens`; `cache_write_input_tokens` ist in allen 19 136 Requests 0.

| Rolle | Sessions | Requests | Input | cached | Treffer | Credits (nur gpt-6-*) | Read-Anteil Credits |
|---|---:|---:|---:|---:|---:|---:|---:|
| Lane | 136 | 13 230 | 1 541 M | 1 516 M | 98,4 % | 9 691 | 77 % |
| Program-MAIN | 2 | 218 | 32 M | 31 M | 96,0 % | 1 188 | 64 % |
| sonstige | 126 | 5 688 | 584 M | 567 M | 97,2 % | 9 244 | 63 % |

Eine Orchestratorin gibt es auf Codex nicht. Kante: 0–30 min 48 von 18 740 kalt; 30–45 min 9/32;
45–60 min 0/9; 60–120 min 4/13; ueber 120 min 10/10. Codex haelt den Cache also meist ueber die
dokumentierten 30 min hinaus bis ~2 h, ohne harte Kante.

## 3. Was eine Zustellung an eine idle Session kostet, und die Grace-Period

### 3.1 Kosten je Zustellung nach Abstand

Verknuepfung: jede angenommene Audit-`send`-Zeile (observed oder unobservable, 3 002 im Fenster;
Klassen und Zahlen wie in `docs/messungen/2026-09-26-zustellungen-klassen-kosten.md`) wird dem
naechsten Turn-Start (User-Datensatz ohne Tool-Result) derselben Slot-Session 0–30 s spaeter
zugeordnet. 1 720 von 3 002 finden einen Claude-Turn; der Rest ging an Codex-Slots oder hat keinen
Gegenpart. Ein Turn = alle Requests bis zum naechsten Turn-Start.

| Leerlauf vor der Zustellung | n | kalt | erster Request median | ganzer Turn median | Turn Mittel |
|---|---:|---:|---:|---:|---:|
| 0–1 min | 265 | 1 | $0,066 | $0,21 | $0,44 |
| 1–5 min | 407 | 0 | $0,068 | $0,25 | $0,58 |
| 5–10 min | 308 | 2 | $0,062 | $0,30 | $0,47 |
| 10–30 min | 338 | 1 | $0,065 | $0,36 | $0,58 |
| 30–58 min | 145 | 0 | $0,067 | $0,41 | $0,68 |
| 58–62 min | 6 | 3 | $0,63 | $0,91 | $0,95 |
| > 62 min | 77 | 77 | $1,61 | $2,18 | $3,60 |

Unter der Kante kostet eine Zustellung unabhaengig vom Abstand gleich viel (erster Request ~$0,066
bei ~220k Kontext); ueber der Kante ~25-mal so viel. 1 281 von 1 546 zugeordneten Zustell-Turns
(83 %) trafen einen Empfaenger, der schon mindestens 1 min idle war.

Die 77 kalten Weckrufe nach Pfad: `owner` 33 ($167), `inbox-nudge` 37 ($94, median 1,7 h idle),
`fleet-event` 4 ($12), `merge-author` 2 ($4), `report-decision` 1 ($1).

### 3.2 Buendelungs-Simulation

Regel (Vorschlag fuer 8100f8d1): je Empfaenger-Slot oeffnet die erste buendelbare Zustellung ein
Fenster G; weitere buendelbare kommen hinein; das Buendel geht als EIN Turn nach G, oder es faehrt
ohne eigenen Turn mit, wenn vorher eine sofort-Zustellung an denselben Slot geht. Buendelbar:
`report-decision`, `merge-verdict`, `inbox-nudge`, `migrate-nudge`, `auto`, `model-push` und die
gruenen `fleet-event`. Der Audit traegt die Event-Farbe nicht; in den 144 in `fleet.json`
gehaltenen Events sind 77 gruen/abgeschlossen (53,5 %) und 67 rot, offen oder unbekannt. Darum zwei
Grenzen und eine lineare Schaetzung:

| G | entfallene Zustellungen, Events nie / immer buendelbar | Schaetzung 53,5 % | MAIN (Orchestratorin + Program-MAIN), nie / immer | Schaetzung MAIN |
|---:|---|---:|---|---:|
| 60 s | 89 / 224 (3,0 / 7,5 %) | 5,4 % | 3,6 / 10,1 % | 7,1 % |
| 300 s | 293 / 615 (9,8 / 20,5 %) | 15,5 % | 12,5 / 25,6 % | 19,5 % |
| 600 s | 395 / 886 (13,1 / 29,5 %) | 21,9 % | 15,4 / 36,6 % | 26,7 % |
| 900 s | 481 / 1 040 (16,0 / 34,6 %) | 26,0 % | 19,2 / 42,6 % | 31,7 % |
| 1 800 s | 585 / 1 275 (19,5 / 42,4 %) | 31,8 % | 22,4 / 52,7 % | 38,6 % |
| 3 300 s | 694 / 1 492 (23,1 / 49,7 %) | 37,3 % | 25,1 / 59,6 % | 43,6 % |

Grenzertrag je zusaetzlicher Minute (Obergrenze): 300→600 s 54 Zustellungen/min, 600→900 s 31/min,
900→1 800 s 16/min, 1 800→3 300 s 9/min. Wert einer entfallenen warmen Zustellung: mindestens der
erste Request (median $0,064), hoechstens der ganze Turn (median $0,28, Mittel $0,44) — ein
Buendel-Turn liest mehr Text als ein Einzel-Turn. Bei 900 s: $31 bis $288 je Woche.

### 3.3 Empfehlung: G = 900 s, mit Cache-Deckel

- **FLEET_DELIVERY_BUNDLE_SEC = 900.** Bis 900 s halbiert sich der Grenzertrag erst einmal, danach
  wieder; 900 s liegt bei einem Viertel der Claude-TTL und haelt eine gruene Nachricht hoechstens
  15 min zurueck.
- **Das Buendel muss auch bei idlem Empfaenger halten.** 83 % der Zustell-Turns treffen einen idlen
  Empfaenger. Eine Auslieferung "beim naechsten Idle-Punkt", wie in 8100f8d1 formuliert, gaebe diese
  Faelle sofort frei und buendelte fast nur, was der Server heute schon parkt.
- **Cache-Deckel:** frueher ausliefern, wenn sonst `letzter Request des Empfaengers + 3 300 s`
  ueberschritten wuerde (Kante gemessen bei 58–62 min, 5 min Abstand). Sonst verwandelt das Halten
  eine $0,07-Zustellung in eine $1,61-Zustellung.
- **Umgekehrt beim kalten Empfaenger** (letzter Request laenger als 3 300 s her): der naechste
  Weckruf zahlt den vollen Write ohnehin; buendelbare Zustellungen haben dann keine Frist ausser der
  naechsten sofort-Zustellung (§5, H1).
- Das 40-%-Ziel aus 8100f8d1 (Senkung je MAIN und Stunde) erreicht die Regel bei 900 s nur, wenn
  praktisch alle Events buendelbar sind (42,6 %); mit 53,5 % gruenen Events liegt die Schaetzung bei
  31,7 %.

## 4. Nachfolge: kalter Start gegen Weiterlaufen (14 Tage)

### 4.1 Korpus

`main_succession` steht im Audit erst ab 2026-09-22 07:42 UTC; das 14-Tage-Fenster enthaelt damit
80 Nachfolgen mit Offset-Paar (4,3 Tage). 64 davon haben Vorgaenger- und Nachfolger-Transkript in
`~/.claude/projects/-Users-owner-claude-fleet/` (45 Program, 19 generic); die uebrigen 16 sind
Codex- oder nicht zuordenbare Sessions.

| Groesse | Median | p25–p75 |
|---|---:|---|
| Kontext des Vorgaengers beim Abgang | 317 883 | 300 311 – 332 494 |
| Sockel des Nachfolgers (erster Request) | 96 215 | 93 300 – 97 061 |
| davon aus dem geteilten Cache gelesen | 26 588 | – |
| Kontext nach 30 Requests / nach 1 h | 148 653 / 182 673 | – |
| Writes der ersten Stunde | 154 397 | 129 012 – 190 859 |
| Steady-State-Write je Request (Vorgaenger) | 864 | 755 – 938 |
| Wachstum je Request (Vorgaenger) | 1 282 | – |
| Uebergabe-Akt des Vorgaengers (letzter Turn) | $0,66 | p75 $1,29 |
| Lebensdauer des Nachfolgers | 5,2 h, 172 Requests | 2,9 – 8,0 h |

Sockel anderer Starts: Orchestratorin 92k, sonstige Checkout-Session 92k, Lane 64k (je median
26,5k gelesen). Vier Vorgaenger lagen beim Abgang ueber 350k (Maximum 457k), sechs unter 290k.

### 4.2 Nachfolge gegen Weiterlaufen

Gegenmodell: der Vorgaenger laeuft die gleichen Requests weiter, sein Kontext waechst mit seiner
eigenen Rate (1 282 Tokens je Request), er schreibt seine Steady-State-Menge und erzeugt denselben
Output. Die Nachfolge traegt ihre tatsaechlichen Kosten plus den Uebergabe-Akt.

| Horizont | Nachfolge | Weiterlaufen | Nachfolge billiger in | Break-even-Kontext F* median (p25–p75) |
|---|---:|---:|---:|---|
| erste 30 Requests | $251 | $176 | 19 / 64 | 382k (298k – 626k) |
| erste 60 | $392 | $366 | 44 / 64 | 267k (221k – 453k) |
| erste 100 | $596 | $633 | 46 / 64 | 234k (194k – 351k) |
| ganze Lebensdauer | $973 | $1 142 | 51 / 64 | 214k (163k – 260k) |

Eine Nachfolge bei ~318k amortisiert sich nach 60 bis 100 Requests und spart ueber die Lebensdauer
des Nachfolgers 15 % ($169 auf 64 Nachfolgen, $2,64 je Nachfolge).

### 4.3 Die kostenoptimale Schwelle

Modell: Session startet bei S0 = 96k, waechst um g = 1 282 Tokens je Request, jede Nachfolge kostet
fix C (Uebergabe-Akt plus Mehr-Writes der ersten Stunde, gemessen je Nachfolge: median $1,56, p25
$1,15, p75 $2,33). Kosten je Request, soweit von der Schwelle T abhaengig:
`C·g/(T−S0) + 0,20 $/MTok · (S0+T)/2`, Minimum bei `T* = S0 + sqrt(2·C·g / 0,20 $/MTok)`.

| C | T* | $/Request bei T* | bei 250k | bei 300k | bei 320k | bei 400k |
|---:|---:|---:|---:|---:|---:|---:|
| $1,15 | 217k | 0,0435 | 0,0442 | 0,0468 | 0,0482 | 0,0545 |
| $1,56 | 237k | 0,0475 | 0,0476 | 0,0494 | 0,0505 | 0,0562 |
| $2,33 | 269k | 0,0538 | 0,0540 | 0,0543 | 0,0550 | 0,0594 |

Der schwellenabhaengige Teil ist rund die Haelfte der Kosten je MAIN-Request ($932 / 9 288 = $0,10).
320k statt 250k kostet also ~3 % je MAIN-Request mehr, grob $40 je Woche auf ~14 400
Checkout-Requests. Die Kurve ist flach; die Kosten allein entscheiden die Schwelle nicht.

### 4.4 Wirken das 25/30-Band und FLEET_MIGRATE_PCT=32?

- Die Schiene greift: 54 von 64 Vorgaengern gingen zwischen 290k und 350k, also am Nudge bei 32 %
  (`server.ts#tickMigrate`, Fuellstand wie `server.ts#contextReading` = input + cache_creation +
  cache_read). `migrate_gave_up` steht zweimal im Audit (gesamte Historie).
- Das Band in `AGENTS.md` §Context self-management (Qualitaet ab ~25 %) und die Schwelle 32 %
  liegen auseinander; die Kosten liegen im Band: T* 22–27 % ueber die C-Quartile.
- **Empfehlung: FLEET_MIGRATE_PCT = 25.** Kostenseitig 0,2 % vom Optimum beim Median-C und ~3 %
  billiger je MAIN-Request als 32; dazu faellt die Schwelle mit dem Qualitaetsband zusammen. Die
  Qualitaet selbst misst diese Notiz nicht. Die Lane-Schiene (`FLEET_LANE_MIGRATE_PCT` = 33 in
  `.env`) liegt ausserhalb des Auftrags.

## 5. Weitere Hebel, nach gemessener Einsparung

**H1: kalte Empfaenger nicht mit buendelbaren Zustellungen wecken — bis ~$107 je Woche.** 42 der
77 kalten Weckrufe waren `inbox-nudge`, `fleet-event` oder `report-decision`: zusammen $107
API-Aequivalent, median 1,7–1,9 h Leerlauf. Regel: ist der letzte Request des Empfaengers laenger
als 3 300 s her, wartet ein buendelbares Buendel auf die naechste sofort-Zustellung und faehrt dort
mit. Gemessen sind nur die 57 % der Zustellungen mit Claude-Gegenstueck.

**H2: Keep-warm fuer MAIN und Orchestratorin — netto ~$94 je Woche, ueberlappt mit H1.**
Simulation: eine minimale Zustellung nach je 55 min Leerlauf, hoechstens 2 h lang, Kosten je Ping =
Kontext × $0,20/MTok + 300 Output + 1k Write (~$0,065). Von 103 kalten Wakes der Checkout-Sessions
fallen 79 in die Deckung: $115 gespart, 328 Pings kosten $22. Bei 1 h Deckung netto $74, bei 3 h
$94, bei 6 h $92. Der groesste Einzelposten sind die 33 kalten Owner-Nachrichten, die H1 nicht
erreicht. Ein Ping ist ein Turn im Transkript des Empfaengers; wie das Abo ihn anrechnet, ist
unbekannt (§1.4).

**H3: den Sockel verkleinern — ~$36 je Woche je 10k Tokens.** Der Sockel steckt in jedem Request:
bei den 23 137 Requests der Sessions, die im Fenster starteten, kostet sein Lesen $606 und sein
Schreiben beim Start $83, von $2 479 (28 %). 10k Tokens weniger Sockel sparen auf den ~14 400
Checkout-Requests ~$29 Lesen plus ~$7 Schreiben je Woche. MAIN- und Lane-Sockel liegen 32k
auseinander (96k gegen 64k); die gerenderten CLAUDE.md-Fassungen unterscheiden sich um 58 KB (79 446
gegen 21 460 Byte). Welcher Anteil der 32k auf die Fassung und welcher auf Brief und Kontext
entfaellt, ist nicht gemessen; ein Schnitt ist eine Owner-Entscheidung.

## Methode

- Claude: jede `*.jsonl` in `~/.claude/projects/-Users-owner-claude-fleet/` und
  `…-claude-fleet-worktrees-*/`, dazu `<session>/subagents/*.jsonl`, mtime im Fenster. Je
  `assistant`-Datensatz mit `message.usage` einmal je `message.id`: input, cache_read,
  cache_creation (5 min / 1 h), output, Modell. Request-Start = letzter `user`-Datensatz davor;
  `kind` = prompt oder tool (erstes Content-Element `tool_result`). Kein Inhalt wurde gelesen oder
  ausgegeben, nur Zahlen und Zeitstempel.
- Rollen: cwd im Worktree → Lane; sessionId in `programs[].lineage.entries[]` oder `programs[].main`
  (`fleet.json`) → Program-MAIN; sonst die naechste `slot_open`- oder `main_succession`-Oeffnung im
  Audit innerhalb 120 s: Slot 9 → Orchestratorin (Label in `fleet.json`), anderer Slot → sonstige
  Checkout-Session.
- Codex: `~/.codex/sessions/*/*/*/*.jsonl`, `token_usage_record` je `response_id`, Modell aus dem
  letzten `turn_context`; Request-Start = letztes `response_item` mit User-/Developer-Nachricht oder
  Tool-Output.
- Zustellungen: `audit.jsonl.1` + `audit.jsonl`, `event=send`, `acceptance` observed oder
  unobservable. Nachfolgen: `event=main_succession`, Offset-Paar aus `detail`, Transkript je
  Offset per Startzeit ±120 s.
- Preise aus §1; Opus 5 und Fable 5.1 zu ihren eigenen Saetzen.
- Die Skripte lagen im Session-Scratchpad und sind nicht Teil des Baums.

## Was nicht gemessen wurde

- Plan-Limit-Anrechnung im Claude-Abo und im Codex-Plan ueber die Credit-Tabelle hinaus (§1.4).
- Antwortqualitaet nach Fuellstand; die Schwellen-Empfehlung stuetzt sich fuer die Qualitaet auf
  `AGENTS.md`, nicht auf eine eigene Messung.
- 1 282 der 3 002 Zustellungen ohne Claude-Turn-Gegenstueck (Codex-Empfaenger, unbestaetigte
  Ankuenfte); fuer sie gibt es Zaehlungen in §3.2, keine Kosten.
- Farbe der `fleet-event`-Zustellungen im Audit; der Anteil 53,5 % stammt aus 144 gehaltenen Events.
- `main_succession` vor 2026-09-22 (Ereignis nicht auditiert), Codex-MAIN-Nachfolgen, Lane-Nachfolgen
  (`lane_succession`, 140 in 14 Tagen).
- Ob ein Buendel-Turn laenger laeuft als ein Einzel-Turn; §3.2 nennt deshalb eine Spanne.
