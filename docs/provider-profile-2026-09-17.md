# Provider-/Anschluss-Profile — Cache-Zeiten, Limits, Resets (Zielbild, 2026-09-17)

**Denksession, kein Code.** Auftrag des Owners (2026-09-06 12:0x, woertlich): „Es sollte spaeter
einstellbar sein wie lange die cache zeiten je nach provider und anschluss gelten so das darauf und
genauso auf limits und resets, reagiert werden kann. Das richtig zu implementieren ohne das die
Agenten bloat mitkriegen usw, braucht aber sicherlich noch einiges an Gehirnschmalz + saubere
Denksession".

**Gemessener Baum:** `f3b625d2`. Zeilennummern unten zeigen auf DIESEN Baum (datierter Snapshot);
Symbole bleiben gueltig, wenn die Zeilen wandern. Alle Messungen dieser Notiz sind auf dem mac
gelaufen, zwei zusaetzlich read-only auf dem Second-host; keine davon hat etwas geschrieben.

---

## 0. Das Ergebnis in fuenf Saetzen

1. **Die Zahlen sind DA, sie werden nur weggeworfen.** Codex schreibt `rate_limits`
   (`used_percent`, `window_minutes`, `resets_at`) auf **dieselbe Zeile**, die
   `server.ts#readCodexContext` (30079) heute schon vom Datei-Ende her liest — der Parser laeuft an
   ihr vorbei. Claude schreibt `cache_read_input_tokens` und `cache_creation_input_tokens` in jede
   `message.usage`, die `server.ts#readUsedTokens` (29870) liest — und **addiert beide weg**
   (Zeile 29898: `input + cache_creation + cache_read`).
2. **Kontostand und Reset sind beim einen Provider frisch, beim anderen strukturell alt.** Codex'
   `resets_at` entsteht pro Turn im Rollout. Claudes Pendant liegt in `~/.claude.json` unter
   `cachedUsageUtilization` — ein CACHE mit eigenem `fetchedAtMs`, und der war bei der Messung
   **14 408 s alt (4 h)**, waehrend die Datei selbst in derselben Minute geschrieben wurde. Das
   `five_hour`-Fenster, das er beschrieb, war zum Lesezeitpunkt bereits abgelaufen.
3. **Die Cache-TTL ist NICHT messbar, die Cache-WAERME schon.** In sechs frischen Transkripten war
   jede Pause bis **1625 s (27 min)** noch warm (`cache_read` ≥ 4× `cache_creation`), kein einziger
   kalter Turn. Die Stichprobe erreicht die 1-h-Grenze also gar nicht — TTL bleibt
   KONFIGURIERBAR, Waerme wird MESSBAR.
4. **Die Empfaengerwahl waehlt heute strukturell den kaeltesten Cache.** `server.ts` 15250–15252
   sortiert die Kandidaten fuer den audit-ping nach `a.lastOutput - b.lastOutput` — laengste Idle
   gewinnt. Genau diese Session hat am ehesten einen abgelaufenen Prompt-Cache; der Ping zahlt dann
   eine volle `cache_creation` statt eines `cache_read`.
5. **Die Bloat-Regel kostet heute nichts, weil der Pfad noch gar nicht existiert** — aber sie
   verlangt ein Feld MEHR, nicht weniger: `GET /api/self` (31479–31496) traegt heute **keinen
   `ctx`** fuer die Session selbst. „Agenten sehen nur ihren eigenen `ctx`" ist also eine
   Hinzufuegung, keine Beschneidung.

---

## 1. Zielbild

Ein **Profil** ist ein Datensatz je Paar (Provider, Anschluss/Konto) — nicht je Modell und nicht je
Slot:

    { id, provider: "anthropic"|"openai"|…, account,       // Anschluss-Identitaet, NIE ein Token
      cacheTtlMs,                                          // konfiguriert, nicht gemessen
      windowTokens,                                        // heute: src/protocol.ts#contextWindowFor
      quotaWindows: [{ name, pct, resetAt, source, ageMs }],// gelesen, je Fenster
      softLimitPct }                                       // Owner-Politik

Vier Eigenschaften, die den Entwurf tragen:

- **Gelesen, nie geraten.** Jedes Feld hat entweder eine Quelle auf Platte oder es ist `null`, und
  `null` ist eine Antwort — dieselbe Regel, die `contextFill` (29825) schon fuehrt: „ein Zaehler,
  dessen Nenner dieser Server nicht NENNEN kann, ist kein Prozentsatz, also faellt die ganze
  Tatsache". Ein Profil ohne lesbaren Kontostand liefert `quotaWindows: []`, nie `pct: 0`.
- **Jede gelesene Zahl traegt ihr ALTER.** `ageMs` ist kein Schmuck, sondern der Unterschied
  zwischen den beiden Providern (siehe §2): eine 4 h alte `five_hour`-Zahl ist keine Zahl.
- **Der Konsument ist der Server, nie die Pane.** Das Profil steht in `.env`/`fleet.json`, wird
  vom Server gelesen und in KEINEN Brief, kein Nudge und keine Pane-Zeile geschrieben (§3).
- **Ein Profil ist Konfiguration PLUS Messung, in dieser Richtung.** `cacheTtlMs` und
  `softLimitPct` setzt der Owner; `pct`/`resetAt` ueberschreibt die Messung, wenn es eine gibt.
  Umgekehrt nie: ein gemessener Reset darf keine Owner-Zeile ueberschreiben, weil sonst ein
  stiller Provider-Wechsel die Politik aendert.

**Konsumenten in der Reihenfolge, in der sie etwas wert sind:** (1) jede Empfaengerwahl (audit-ping,
inbox-nudge, backlog-nudge, Autos) meidet Konten ueber `softLimitPct` und bevorzugt bei Gleichstand
den waermeren Cache; (2) Modellpolitik je Program wird ein Datensatz statt einer Regelbuch-Zeile;
(3) das Board zeigt je Slot Reset-Countdown und Kontostand; (4) ein Spawn auf ein Konto nahe Limit
wird abgelehnt oder umgelenkt. **(1) traegt die Owner-Zeile, (2)–(4) sind Komfort** — deshalb endet
die Schnittliste in §4 nach (1).

---

## 2. Messbarkeits-Tabelle je Provider

Legende: **M** = heute aus einer Datei lesbar, die dieser Server ohnehin liest · **M+** = lesbar,
aber aus einer Datei, die der Server noch nicht anfasst · **K** = nur konfigurierbar · **—** = auf
diesem Host nicht vorhanden.

| Fakt | Codex / OpenAI | Claude / Anthropic | Pi, pi-zai, pi-ox | Container |
|---|---|---|---|---|
| Fenstergroesse (Tokens) | **M** — `model_context_window` in der `token_count`-Zeile, `258400` gemessen; `windowFromFile: true` (server.ts 1242) | **K** — Modell-Tabelle `CLAUDE_CONTEXT_WINDOWS` (src/protocol.ts 278) | **K** — dieselbe Tabelle bzw. `CONTEXT_WINDOW_GLM_5_3` | — (`context: null`, 1082) |
| Kontext-Fuellstand | **M** — `last_token_usage.total_tokens` | **M** — Summe dreier Input-Felder (29898) | **M** — derselbe Pi-JSONL-Parser | — |
| **Kontostand (Quota %)** | **M** — `rate_limits.primary.used_percent`, **auf derselben Zeile**, die der Parser schon liest | **M+** — `~/.claude.json` → `cachedUsageUtilization.utilization.{five_hour,seven_day}.utilization` | **—** nicht gemessen; kein Feld gefunden | — |
| **Reset-Zeitpunkt** | **M** — `rate_limits.primary.resets_at` (unix s) + `window_minutes` (`10080` = 7 Tage, gemessen) | **M+** — `…{five_hour,seven_day}.resets_at` (ISO 8601) | **—** | — |
| Alter dieser Zahl | **~0** — pro Turn neu geschrieben | **explizit** — `fetchedAtMs`; **gemessen 14 408 s** bei einer Datei-mtime von 0 min | — | — |
| Plan / Tier | **M** — `rate_limits.plan_type` | **M+** — `oauthAccount.organizationRateLimitTier` | — | — |
| **Cache-TTL** | **K** — kein Feld | **K** — 1 h, im Overage 5 min; kein Feld in Transkript oder State | **K** | **K** |
| **Cache-WAERME je Turn** | **M** — `cached_input_tokens` / `cache_write_input_tokens` im selben Objekt | **M** — `cache_read_input_tokens` vs. `cache_creation_input_tokens`, heute **wegaddiert** | **M** (derselbe Parser) | — |
| Modellwahl je Session | **M** — `Slot.model`, sonst `ambient` (29814 `receiptModel`) | **M** — `Slot.model` bzw. `DEFAULT_MODEL` | **M** — fester Default je Profil | — |

**Was daraus folgt, in einem Satz je Provider.** Codex: Kontostand und Reset sind ein
Parser-Zweig von zehn Zeilen in einer Datei, die schon offen ist — der billigste Gewinn im ganzen
Entwurf. Claude: der Kontostand ist da, aber nur mit `fetchedAtMs` daneben; ohne Alter ist er
gefaehrlicher als keiner, weil er wie eine Messung aussieht. Pi/GLM: kein Kontostand, und das ist
eine Abwesenheit, kein `0` — ein Profil fuer diese Anschluesse ist reine Konfiguration.

### 2.1 Belege

- **Codex, eine echte Zeile** (aus `~/.codex/sessions/2026/09/17/rollout-…jsonl`, gekuerzt):
  `"model_context_window":258400},"rate_limits":{"limit_id":"codex","primary":{"used_percent":42.0,
  "window_minutes":10080,"resets_at":1790101219},"credits":{…},"plan_type":"prolite",
  "rate_limit_reached_type":null}`. Der Parser (30095) springt auf `"last_token_usage"` und liest
  `total_tokens` + `model_context_window`; `rate_limits` steht **im selben JSON-Objekt** und wird
  nicht angefasst. 19 solcher Zeilen in dieser einen Datei.
- **Claude, gemessen 2026-09-17 ~11:20 lokal:** `fetchedAtMs` → Alter **14 408 s**;
  `five_hour.utilization = 7`, `resets_at = 2026-09-17T07:10:00Z` (**bereits vergangen**);
  `seven_day.utilization = 9`, `resets_at = 2026-09-23T18:00:00Z`. `seven_day_opus` und
  `seven_day_sonnet` existieren als Schluessel, standen aber auf `null` — **eine Aufschluesselung
  je Modell gibt es heute also nicht**, auch wenn die Namen das versprechen.
- **Cache-Waerme, 6 Transkripte unter `~/.claude/projects/-Users-owner-claude-fleet/`:** 20
  Turn-Paare mit Pause > 60 s und > 20 k Tokens; **20 warm, 0 kalt**; groesste noch warme Pause
  **1625 s** (`cache_read 149 576` gegen `cache_creation 140`). Die Stichprobe **widerlegt nichts
  und bestaetigt nichts** ueber die TTL — sie enthaelt keine Pause, die lang genug waere.
- **Empfaengerwahl:** `server.ts` 15250–15252, `.filter(… s.worktree === null && s.label !==
  STEWARD_LABEL && s.awaiting !== "owner").sort((a, b) => a.lastOutput - b.lastOutput || a.id -
  b.id)`. Kein Bezug auf Konto, Modell oder Cache.
- **Zwei Hosts, read-only geprobt:** der Second-host hat ein `~/.claude.json` (mtime 15.09. 19:02),
  aber **kein `cachedUsageUtilization`** — dort laeuft keine claude-Session, die je einen
  Kontostand geholt haette. Ein `~/.codex/sessions/` existiert dort mit **genau einer** Rollout-
  Datei (15.09.).

---

## 3. Die Bloat-Regel als pruefbarer Satz

> **Kein Provider-, Konto-, Quota-, Reset- oder Cache-Feld erreicht jemals eine Pane. Die einzige
> Ausnahme ist der eigene `ctx` der Session, und der erreicht sie nur ueber `GET /api/self` —
> niemals ueber `sendText`.**

Das ist absichtlich an den einen Engpass geknuepft, den dieses Repo schon besitzt: **jeder Byte, den
Fleet in eine Pane tippt, geht durch `sendText`**, und seit `d9fbefc2` schreibt jeder dieser Pfade
eine `send`-Zeile mit `path` (16 Kanalnamen, `SendPath`, 6082–6098). Ein Feld kann also nur auf
zwei Wegen zum Agenten gelangen: im Text eines `sendText`-Aufrufs oder in der Antwort einer
`/api/self*`-Route. Beides ist mechanisch pruefbar:

- **Pin A (Text):** kein Payload-Bauer eines `sendText`-Pfades liest eine Profil-Funktion. Als Pin
  in `e2e/pins.ts` formulierbar: die Quelle jeder Funktion, die einen `sendText`-Text baut
  (`auditPingMessage`, `briefAndSend`, die Nudge-Bauer), enthaelt keinen Aufruf des
  Profil-Lesers. Ein `ast-grep`-Muster genuegt; die Pin-Datei macht genau solche Ordnungs-Aussagen
  bereits (vgl. `RULE_VERIFY`).
- **Pin B (Route):** die Feldliste von `GET /api/self` ist gepinnt und waechst nur um `ctx`. Heute
  sind es 12 Felder (31480–31495) und `ctx` ist **nicht** darunter — der Pin faengt also sowohl das
  Vergessen als auch das Ueberschiessen.
- **Was die Regel NICHT ist:** keine Isolation. Ein Agent mit Shell liest `~/.codex` und
  `~/.claude.json` selbst. Die Regel verhindert, dass Fleet ihm die Zahl **aufdraengt** und dafuer
  seinen Kontext bezahlt — dieselbe Unterscheidung, die das Regelbuch bei der Token-Hygiene in `ps`
  schon trifft („eine Regel gegen versehentliche Ausgabe, keine Isolation").

Eine zweite Zeile derselben Art, aus §2.1 heraus zwingend:

> **`accountUuid` und die unveroeffentlichten Fenster-Codenamen aus `cachedUsageUtilization`
> verlassen den Leser nicht** — weder in eine Antwort, noch in ein Ledger, noch in ein Doc. Das
> Profil traegt einen vom Owner vergebenen `account`-Namen, gebildet wie `FLEET_INSTANCE`
> (`src/protocol.ts#INSTANCE_NAME_RE`): ein Wort des Operators, nie aus der Maschine abgeleitet.
> Dieses Repo ist oeffentlich.

---

## 4. Schnittliste

**Schnittlinie nach S2.** Die Owner-Zeile verlangt, dass „auf limits und resets **reagiert** werden
kann" — S1 macht die Zahlen zu Fakten, S2 ist die erste Reaktion. S3 ist schon Komfort und steht
unter der Linie.

### S1 — Der Profil-Datensatz und seine zwei Leser

Ein `providerFacts(slot)` im Server, das je Slot `{ pct, resetAt, source, ageMs } | null` liefert,
aus zwei Quellen: Codex aus der Zeile, die `readCodexContext` ohnehin liest; Claude aus
`~/.claude.json` mit `fetchedAtMs` als `ageMs`. Plus die Profil-Konfiguration
(`cacheTtlMs`, `softLimitPct`, `account`) in `.env`/`fleet.json`. **Noch kein Konsument** — diese
Runde macht nur aus einer weggeworfenen Zahl eine benannte.

- **Done:** `providerFacts` liefert fuer einen Codex-Slot `pct`/`resetAt` aus der Fixture-Zeile;
  fuer einen Claude-Slot dieselben Felder samt `ageMs`; fuer einen Pi-/Container-Slot `null`
  (nicht `0`). Keine bestehende Route traegt ein neues Feld. Ein Stand, der aelter ist als das
  Fenster, das er beschreibt, kommt als `null` mit `source` zurueck, nie als Zahl.
- **Verify:** neuer Check in `e2e/` bei seiner Familie (Kontext/Harness, **nicht** in
  `fleet-e2e.ts` — `AGENTS.md` §Where a test goes), mit Fixture-Rollout und Fixture-`.claude.json`
  je Fall; `bun e2e/pins.ts`; `bunx tsc`; `./e2e-isolated.sh` als Vorschau, weil ein
  `supports.*`-naher Kontrakt beruehrt wird.

### S2 — Die Empfaengerwahl liest `resetAt` und `pct`

`server.ts` 15250 f. und die gleich gebauten Nudge-Sortierungen bekommen **vor** dem
`lastOutput`-Vergleich einen Filter: ein Slot, dessen Konto ueber `softLimitPct` steht, wird
uebersprungen und der Grund landet im `held`-Set, das es schon gibt (`held.add("unobserved")`,
15266) — also im `lastResult`, das der Owner ohnehin liest. Bei Gleichstand gewinnt der waermere
Cache, nicht die laengere Idle.

- **Done:** ein Slot auf einem Konto ≥ `softLimitPct` wird nicht Empfaenger, und `lastResult` nennt
  den Grund mit Namen (`held — over soft limit`), nicht schweigend. Ein Slot **ohne** lesbaren
  Kontostand wird **nicht** uebersprungen — Abwesenheit einer Zahl darf niemanden ausschliessen,
  sonst sperrt ein fehlendes Profil den halben Fleet aus.
- **Verify:** Check in der Familie des audit-pings, der beide Richtungen beweist (uebersprungen mit
  Grund / **nicht** uebersprungen bei `null`); `./e2e-isolated.sh` (Empfaengerwahl ist
  Aussage-tragend); Gegenprobe an der `send`-Zeile: der Ping erreicht den anderen Slot.

---
**— Schnittlinie: bis hier ist die Owner-Zeile erfuellt. —**

### S3 — Cache-Waerme im Send-Ledger

Die `send`-Zeile traegt neben `ctxPct` ein `cacheWarm` (Verhaeltnis `cache_read` zu
`cache_creation` beim letzten Turn des Empfaengers, `null` wenn nicht lesbar). Reine Messung, keine
Entscheidung — sie liefert die Datenbasis, um `cacheTtlMs` spaeter **zu messen statt zu setzen**,
und sie beantwortet die Frage, die §2.1 offen lassen musste.

- **Done:** jede `send`-Zeile eines claude-/codex-Empfaengers traegt `cacheWarm`; ein Empfaenger
  ohne lesbare Waerme laesst das Feld **weg** (dieselbe Regel wie `ctxPct`, 6079–6081).
- **Verify:** Ledger-Check in der Familie von `auditSend` (`d6e2dd3d` hat die Ordnungsbedingung
  dort schon notiert); `bun e2e/pins.ts`.

---

## 5. Die drei Fragen des Auftrags, beantwortet

**(1) Messbar vs. nur konfigurierbar** — §2. Kurz: Kontostand und Reset sind bei **beiden** grossen
Providern messbar, bei Codex frisch und bei Claude nur mit Altersangabe. Die **Cache-TTL** ist bei
keinem messbar und bleibt der eine Wert, den der Owner wirklich setzen muss; die Cache-**Waerme**
ist bei beiden messbar und wird heute weggeworfen.

**(2) Wo liegt die Wahrheit bei einem Konto auf zwei Hosts** — die Wahrheit liegt beim Provider,
und die beiden Hosts sehen sie verschieden gut:

- **Codex:** jeder Rollout auf jedem Host traegt `resets_at` + `used_percent` fuer **dasselbe
  Konto**; die Zahl datiert sich selbst ueber den Zeilen-Zeitstempel. Ein host-uebergreifendes
  `max(timestamp)` ist damit wohldefiniert — **die juengste Rollout-Zeile gewinnt, egal auf welchem
  Host sie steht**. Praktisch gemessen: der Second-host hat **eine** Rollout-Datei vom 15.09., der
  mac hat heutige — heute gewinnt immer der mac, aber die Regel darf nicht daraus gebaut werden.
- **Claude:** `cachedUsageUtilization` ist ein Cache **je Host**, nicht je Konto, und auf dem
  Second-host existiert er gar nicht. Es gibt heute also **keine** zwei Sichten, die man
  zusammenfuehren muesste — und wenn es sie gaebe, waere die juengere `fetchedAtMs` die Antwort.
- **Konsequenz fuer den Entwurf:** das Profil haengt am **Konto**, nicht am Host, und jede gelesene
  Zahl traegt `source` (welcher Host/welche Datei) **und** `ageMs`. Ein Fleet, der nur seinen
  eigenen Host liest, ist korrekt — er meldet dann eben Abwesenheit fuer den anderen. Ein Fleet,
  der beide liest, braucht kein Protokoll, nur `max` ueber den Zeitstempel.
- **Was hier NICHT hingehoert:** Fleet darf sich diese Zahl nicht per Netz vom anderen Host holen.
  `server.ts` hat genau ein `fetch(` (den `Bun.serve`-Handler, siehe `docs/harness-adapter.md`
  §Instanz-Identitaet) — das ist eine Eigenschaft, keine Luecke, und ein Provider-Profil ist kein
  Grund, sie aufzugeben. Wenn der Folger-Host seinen Kontostand beitragen soll, dann ueber
  denselben Weg wie sein Heartbeat, nicht ueber einen neuen Ausgang.

**(3) Kleinster erster Schnitt** — S1. Der Vorschlag des Controllers (Profil-Datensatz +
Empfaengerwahl liest `quotaResetAt`) ist richtig, aber **zwei** Schnitte, und die Reihenfolge ist
nicht beliebig: die Empfaengerwahl darf erst lesen, wenn `null` sauber von `0` getrennt ist. Sonst
sperrt der erste fehlende Kontostand den ersten Empfaenger aus — derselbe Fehler, den
`contextFill` mit „Absence 5" vermeidet und den `BACKLOG_IDLE_MS > 0 && s.lastOutput === 0` an
genau dieser Stelle schon einmal vermeidet.

---

## 6. Was diese Notiz NICHT geprueft hat

- **Kein Code, kein Schnitt gebaut** — Auftragsgrenze.
- **Die 1-h-TTL selbst ist unbewiesen.** Die Stichprobe (§2.1) reicht bis 27 min. Wer sie beweisen
  will, braucht Turn-Paare mit Pausen ueber 60 min — S3 wuerde sie automatisch sammeln.
- **Overage (5 min TTL) nicht beobachtet.** `cachedExtraUsageDisabledReason` stand bei der Messung
  auf `out_of_credits`; wie sich die Waerme im Overage verhaelt, ist damit ungemessen, nicht
  widerlegt.
- **Pi/GLM/x-preview:** nur die Abwesenheit eines Quota-Feldes im Adapter geprueft, **nicht** die
  Session-Dateien dieser Harnesses auf ein Kontostand-Feld durchsucht.
- **Kein Konsument ausser der Empfaengerwahl durchdacht.** Modellpolitik als Datensatz (Konsument 2)
  beruehrt `docs/program-lebenszyklus-*.md` und ist eine eigene Sitzung wert.
- **Second-host:** zwei read-only `ls`/`python3 -c`-Proben ueber ssh, nichts geschrieben, kein
  Prozess angefasst.
