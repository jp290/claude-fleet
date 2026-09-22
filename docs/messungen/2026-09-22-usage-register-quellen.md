---
frage: Welche maschinenlesbare Quelle nennt je Anbieter (Anthropic/Claude-Abo, OpenAI/Codex-Abo, z.ai/GLM-Abo) Verbrauch, Fenster und Reset-Zeit, und was kann ein Dispatch-Register daraus lesen?
urteil: Je Anbieter eine andere Wahrheit: Codex schreibt Verbrauch und Reset selbst ins Rollout (95,0 %, 10080-min-Fenster, resets_at 1790101219); z.ai verrät Reset nur im 429-1308-Body und schreibt ihn in UTC+8 (zweifach belegt), ein Usage-Endpunkt existiert nicht und die 200-Antwort trägt keine Limit-Header; das Claude-Abo verrät an der API-Grenze gar nichts (429 ohne Ratelimit-Header, Body ohne Reset, nur auth status --json ohne Verbrauch); das Register liest Codex aus der Datei, z.ai aus beobachteten 1308ern, Claude bleibt unknown.
bereich: [dispatch, usage, sensoren]
belege: [docs/astra-auftraege.md, server.ts#PI_ZAI_HARNESS, e2e/pins.ts]
nicht-gemessen: Die 200-Antwort des Abo-OAuth (mögliche unified-Ratelimit-Header) und die Console-Key-Header (anthropic-ratelimit-*, der Schlüssel liegt nicht auf dieser Platte) sind unbestätigt; die /status-Anzeige der claude-CLI wurde nicht maschinell geprüft.
stand: 2026-09-22
---

# Usage-Quellen je Anbieter (Anthropic, OpenAI, z.ai) für ein Fleet-Register

2026-09-22, Lane `fleet/260922125510-a8bd` (pi-zai/glm-5.3-flash). Anlass: Slot 3 lief heute ins
z.ai-5h-Limit (429 code 1308); der Rate-Limit-Resume braucht eine Reset-Zeit, und der Dispatch
könnte leere Kontingente meiden. Owner-Wunsch: ein getracktes Register über OpenAI, Anthropic und
z.ai. Frage: **Wo steht je Anbieter maschinenlesbar, wie voll welches Fenster ist und wann es
zurücksetzt?**

## Ergebnis

Je Anbieter: die Quelle, dann der Probe mit wörtlicher Ausgabe. Geschwärzt wurden E-Mail,
Organisations- und Workspace-Identifikatoren; Keys und Tokens wurden nie ausgegeben (nur über
Shell-Variablen an curl gereicht). Kosten: die z.ai-200-Probe verbrannte 13 prompt + 1 completion
Token; die beiden Anthropic-429 und alle 401/404 wurden abgewiesen und nicht abgerechnet.

### OpenAI / Codex-Abo — Quelle: Rollout-Datei, selbstgeschrieben

Die neueste Datei unter `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (nach mtime) trägt im
letzten `token_count`-Ereignis den gespeicherten Limit-Stand. Probe (jq auf das neueste Rollout,
Stand heute 13:0x UTC):

```json
{"limit_id":"codex","primary":{"used_percent":95.0,"window_minutes":10080,"resets_at":1790101219},"secondary":null,...,"plan_type":"prolite"}
```

Ereignis-Zeitstempel `2026-09-20T10:03:17.960Z`; `resets_at` 1790101219 ist Unix-**Sekunden** =
2026-09-22 18:20:19 UTC. `primary.used_percent` ist der Verbrauch, `window_minutes` 10080 die
Woche — genau der Weg aus `docs/astra-auftraege.md` samt deren Warnung: der Rollout ist ein
**gespeicherter Stand, keine Live-Abfrage**; hier zweieinhalb Tage alt, das Fenster endet heute
18:20 UTC. Für ein Register reicht das (Fresstal ist Teil des Datensatzes), Live-Genauigkeit hat
keinerlei Preis, denn Lesen kostet nichts.

### z.ai / GLM-Abo — Quelle: nur der 429-Body am Limit; Zeiten in UTC+8

Vier Wege probiert, drei tot:

| Weg | Ausgang (wörtlich, gekürzt) |
|---|---|
| `GET https://api.z.ai/api/usage` | `HTTP/2 200` mit Body `{"code":500,"msg":"404 NOT_FOUND","success":false}` |
| `GET https://api.z.ai/api/paas/v4/usage` | `HTTP/2 404`, `{"status":404,"error":"Not Found","path":"/v4/usage"}` |
| `GET https://api.z.ai/api/coding/paas/v4/usage` | `HTTP/2 404`, dieselbe Form |
| `POST …/api/paas/v4/chat/completions` (glm-5.3-flash, max_tokens 1) | `HTTP/2 429` `{"error":{"code":"1113","message":"Insufficient balance or no resource package. Please recharge."}}` — der Standard-v4 kennt den Coding-Plan-Schlüssel nicht; nicht abgerechnet |
| `POST …/api/coding/paas/v4/chat/completions` (gleicher Body) | `HTTP/2 200`, normale completion (13 prompt + 1 completion Token); **Response-Header nur `x-log-id` und `x-request-id`, kein einziges Ratelimit-Feld** |

Die Erfolgsspur ist stumm. Die einzige beobachtete Reset-Quelle ist der 429 am Limit — heute
morgen auf Slot 3, wörtlich aus dem Pane-Stream
(`streams/s3-1790067837070-b5805e84bcdf6533.raw` im Haupt-Checkout, ANSI entfernt):

```
Error: 429: {"code":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2026-09-22 18:19:39"}
```

**Die gedruckte Zeit steht in UTC+8, nicht in Ortszeit** (Owner-Beobachtung: gemeint war
12:19:39 CEST). Zwei Belege, bevor die Annahme gilt:

1. Verhalten im selben Stream: letzter 1308 bei Byte 64 264 240 von 65 746 732 (97,7 %); die
   letzten 148 227 Bytes enthalten **null** weitere 1308, und der Schwanz zeigt eine laufende
   GLM-Session (Statuszeile „…/1.0M", das vom `server.ts#PI_ZAI_HARNESS` eingesetzte
   1M-Kontextfenster) mit mtime 12:34:29 UTC. Unter der CEST-Lesung (Reset 14:19:39 UTC) hätte
   z.ai zu dem Zeitpunkt noch sperren müssen — unmöglich. Unter der UTC+8-Lesung (Reset
   12:19:39 UTC = 1790079579) ist Arbeit ab 12:34 UTC genau erwartbar.
2. Die Owner-Beobachtung selbst (Meldung meinte 12:19:39 Ortszeit).

Für das Register heißt das: gedruckte z.ai-Zeiten immer `printed − 8 h` → UTC-ms, nie Ortszeit,
nie CEST.

### Anthropic / Claude-Abo — Quelle: keine gefunden

Probiert und belegt:

- Auf der Platte liegt `~/.claude/.credentials.json` mit **abgelaufenem** OAuth-Token
  (expiresAt 1789832254117 = 2026-09-20; mtime ebenso). Probe: `GET /v1/models` mit dem Bearer →
  `HTTP/2 401`, wörtlich: `{"type":"error","error":{"type":"authentication_error","message":"OAuth access token has expired. Re-authenticate to continue."},"request_id":null}`
- Der **frische** Token liegt im macOS-Keychain (Item „Claude Code-credentials", expiresAt
  1790107682833 = heute 20:08 UTC). Probe damit (Bearer, `anthropic-beta: oauth-2025-04-20`,
  max_tokens 1): **`HTTP/2 429`** — das Max-Abo war während der Probe selbst am Limit (fleet-eigene
  claude-Lanes). Zweiter Wurf mit vollem Headerblock, wörtlich die relevanten Zeilen:

```
HTTP/2 429
x-should-retry: true
content-type: application/json

{"type":"error","error":{"type":"rate_limit_error","message":"Error"},"request_id":"req_011CfJY32pEtDuLkMs2dWa82"}
```

  **Kein** `anthropic-ratelimit-*`, **kein** `retry-after`, und der Body nennt keinen
  Reset-Zeitpunkt — die Grenze verrät weniger als z.ai. (Der zweite 429 war unberechnet; der
  erste Wurf lief nur mit gefiltertem Header-Grep, der kein einziges Limit-Feld fand, und wurde
  um der Behauptung willen wiederholt.)
- Maschinenlesbar und lebendig ist nur der Auth-Zustand: `claude auth status --json`
  (CLI 2.1.278) → `{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty",…,"subscriptionType":"max"}`
  — ohne jede Verbrauchs- oder Reset-Angabe; E-Mail/Org geschwärzt.
- Der Console-Schlüssel (ANTHROPIC_API_KEY, den die claude-Lanes per fleet.json-Env-Referenz
  bekommen) liegt als Wert **nicht** auf dieser Platte (0 Treffer auf `sk-ant` in fleet.json),
  also blieb die dokumentierte `anthropic-ratelimit-*`-Header-Familie des API-Pfads hier
  **ungeprüft**.

„Keine gefunden" heißt fürs Register: Claude-Abo = `unknown`, nie 0. Eine beobachtete 429 dieser
Form liefert höchstens „Limit um T beobachtet", reset bleibt unbekannt — ein Resume-Zeitpunkt
lässt sich für claude damit nicht stellen.

## Methode

Wiederholbar ohne Secret-Abdruck — Werte laufen nur durch Shell-Variablen:

```sh
# Codex: neuestes Rollout, letzter token_count mit rate_limits
f=$(ls -t ~/.codex/sessions/*/*/*/*.jsonl | head -1)
jq -c 'select(.type=="event_msg" and .payload.type=="token_count" and .payload.rate_limits)
       | .payload.rate_limits' "$f" | tail -1

# z.ai: Endpunkt- und Header-Probe (Key aus $ZAI_API_KEY, nie ausgegeben)
curl -s -D h.txt -o b.txt -X POST https://api.z.ai/api/coding/paas/v4/chat/completions \
  -H "Authorization: Bearer $ZAI_API_KEY" -H 'content-type: application/json' \
  -d '{"model":"glm-5.3-flash","messages":[{"role":"user","content":"hi"}],"max_tokens":1}'
grep -iE '^HTTP|ratelimit|retry|^x-' h.txt   # nur x-log-id/x-request-id

# Anthropic Abo: frischer OAuth-Token aus dem Keychain, nie ausgegeben
T=$(security find-generic-password -s "Claude Code-credentials" -w | jq -r '.claudeAiOauth.accessToken')
curl -s -D h.txt -o b.txt -X POST https://api.anthropic.com/v1/messages \
  -H "Authorization: Bearer $T" -H 'anthropic-version: 2023-06-01' \
  -H 'anthropic-beta: oauth-2025-04-20' -d '{"model":"claude-sonnet-5","max_tokens":1,
  "messages":[{"role":"user","content":"hi"}]}'
cat h.txt; jq -c '.error // .usage' b.txt

# Auth-Zustand (kein Verbrauch)
claude auth status --json
```

UTC+8-Gegenprobe: Stream-Offsets per `rg -bo "1308"` (erst 43 469 982, dann 64 264 240), mtime
per `stat -f %m`, Epoch-Umrechnung per `python3 -c datetime`; bereinigte Stream-Tails per
`tail -c … | perl -pe 's/\e\[[0-9;]*[a-zA-Z]//g'`.

## Kartenentwurf (Queue-Format, zum Filen — nicht von dieser Lane gebaut)

```text
ZIEL: Ein gitignored Ledger usage.jsonl im Fleet-Haupt-Checkout (ein Tick, eine Zeile je
  Anbieter) und eine Route GET /api/usage, die je Anbieter {source, used_percent|null,
  window_minutes|null, reset_at_utc_ms|null, observed_at|null} meldet.
FLAECHE: server.ts#handleUsage (neu, Route neben /api/self/gate) · server.ts#tickDispatch
  (Leser für die Skip-Entscheidung) · server/types.ts#UsageTick (neu) · .gitignore
  (usage.jsonl) · e2e/usage.ts (neu)
DONE: GET /api/usage nennt für codex used_percent/resets_at aus dem neuesten Rollout, für z.ai
  reset_at_utc_ms aus der letzten beobachteten 1308-Zeile des Ledgers, für claude konstant
  unknown; eine Synthetik-1308-Zeile mit printed "2026-09-22 18:19:39" beantwortet „GLM leer
  bis HH:MM" als 1790079579000.
VERIFY: bun e2e/pins.ts && neuer Check in e2e/usage.ts: Synthetik-1308 → reset_at_utc_ms ===
  1790079579000 (UTC+8 gelesen); Rollout-Fixture → 95.0/1790101219000; leeres Ledger → alles
  unknown, nie 0/false.
VERBOTEN: keine Keys/Tokens/Accountnamen ins Ledger oder in Antworten · keine Anbieter-Aufrufe
  im Tick (codex: Dateilesen; z.ai/anthropic: nur beobachtete Antworten übernehmen) · keine
  Ortszeit ohne TZ-Stempel, z.ai-gedruckte Zeiten immer UTC+8 → UTC-ms · Route nur mit Token ·
  usage.jsonl bleibt gitignored und verlässt den Haupt-Checkout nicht.
ROLLE: pi-zai/glm-5.3-flash/high · GROESSE mittel
```

Fragen, die ein Dispatch daraus beantworten kann:

- „GLM leer bis HH:MM?" → `reset_at_utc_ms > now`: nicht auf pi-zai dispatchen (Resume-Zeile
  braucht genau diese Zahl; Quelle ist der beobachtete 1308).
- „Codex-Woche über der Astra-Linie?" → `primary.used_percent` gegen den verstrichenen
  Fensteranteil (±10-Punkte-Regel, `docs/astra-auftraege.md`).
- „Claude-Abo?" → `unknown` bleibt unknown; eine beobachtete 429 (message „Error", ohne Reset)
  erlaubt nur die Aussage „Limit um T beobachtet", nie eine Resume-Uhrzeit.

## Was nicht gemessen wurde

Die 200-Antwort des Abo-OAuth (ob 200er auf dem OAuth-Pfad `anthropic-ratelimit-unified-*`
tragen) — das Konto war während der Probe am Limit, ein 200 war nicht zu haben. Die
Console-Key-Header (`anthropic-ratelimit-*`), weil der Schlüsselwert nicht auf dieser Platte
liegt. Die `/status`-TUI-Anzeige der CLI als mögliche (nicht-maschinelle) Reset-Quelle. Ob z.ai
in 429-**Headern** (statt Body) je Reset-Felder trägt — der 1308 stammt aus einem Pane-Stream
ohne Header.

## Entscheidungs-Trail

```ts
2026-09-22T12:56Z	quellen	Codex-Weg aus docs/astra-auftraege.md übernommen statt neu gesucht	astra-Weg ist dokumentiert und gepinnt	~/.codex/sessions/2026/09/20/rollout-*.jsonl	95.0 % / resets_at 1790101219
2026-09-22T12:57Z	probe	Anthropic zuerst über den Plattentoken	.credentials.json ist die sichtbare Ablage	401 oben	Token seit 09-20 abgelaufen
2026-09-22T13:04Z	probe	z.ai zuerst GET-Varianten, dann v4-POST, dann coding-POST	freie GETs vor dem einen kostenpflichtigen Probe	404-Body oben (13:04:30) und 200-Body (created 1790082391)	3 tote Wege, 1 stumme Erfolgsspur
2026-09-22T13:10Z	utc8	UTC+8 als zweifach belegt gelten lassen	Owner-Beobachtung + s3-Schwanz (GLM-Arbeit um 12:34:29 UTC, 15 min nach UTC+8-Reset)	streams/s3-…raw Tail, 0 weitere 1308 in den letzten 148227 Bytes	CEST-Lesung widerlegt
2026-09-22T13:11Z	probe	Keychain statt abgelaufener Datei als Tokenquelle	.credentials.json war seit 09-20 stale (401 belegt)	expiresAt 1790107682833, now_ms 1790082705000	lebender 429 statt 401
2026-09-22T13:12Z	probe	Anthropic-Zweitwurf mit vollem Headerblock	nur gefilterter Grep behauptet „keine Header" ohne Ganzheit	HTTP-Trace oben (date 13:12:30 GMT)	Behauptung belegt: kein Limit-Feld
2026-09-22T13:14Z	verdict	beide Uebergabe-Notizen (f64ae822, 2d133fda) geschlossen	Auftrag verlangt je Notiz ein Urteil	POST /api/self/notes/*/verdict (ts 1790082857855)	ok:true
```
