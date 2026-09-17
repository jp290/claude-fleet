---
frage: Wie entsteht ein Warten, das kein Code herstellt und keine Sonde sieht — und warum laeuft der naheliegende Rat, eine blockierte Karten-Zeile per Brief zu schaerfen, in genau den Schaden hinein, den die Nachbarzeile reparieren soll?
urteil: Zwei Befunde aus einer Schicht, beide an der Freigabe-Hand und nicht im Code. (1) DER FREIGABE-DEADLOCK: `c2904891` (queued) trug woertlich "collides with row 53daa39c ahead in the plan on server.ts#cardDue", waehrend `53daa39c` PENDING war. Die Kollisionslesung ordnet gegen Zeilen, die die Freigabe-Hand nie freigegeben hat; eine queued Zeile kann damit auf eine Zeile warten, die strukturell nie startet. Kein Code stellt das her, `tickDispatch` verhaelt sich korrekt, und keine Sonde sieht es: aus Sicht der Queue ist beides ein legitimer Zustand. Sichtbar ist es nur in der Differenz zweier Felder, die niemand zusammen liest — `status` der wartenden Zeile gegen `status` ihres Kollisionsziels. (2) DIE REIHENFOLGE-FALLE: der Rat "erweitere die blockierte Zeile" verlangt einen Brief; ein Brief triggert den Karten-Re-Read (`server.ts#cardDue`, letzter Zweig `(t.brief?.at ?? 0) > t.card.at`); und genau dieser Re-Read verliert `VERBOTEN`, weil `card-extract.ts#FORMAT_KEYS` es nicht kennt — das ist der Schaden, den `53daa39c` repariert. Die beiden Zeilen sind also nicht bloss kollidierend (gleiche Datei, benachbarte Regionen), die eine laeuft in die andere hinein. Wer den Rat vor der Reparatur befolgt, fuehrt eine stille Datenverlust-Kampagne auf genau dem Feld, das einer Lane sagt, was sie NICHT darf.
bereich: [queue, release, karten, briefs, start-plan, kollision]
belege: [start-plan.ts:92 HARD_GAP, start-plan.ts:110 `!c.cardFiles`, card-extract.ts:52 CARD_VALIDATOR_VERSION=5, card-extract.ts:171 FULL_CHAIN_ALIAS, card-extract.ts:389 FORMAT_KEYS, server.ts#cardDue (Re-Read-Bedingung `< CARD_VALIDATOR_VERSION` und `(t.brief?.at ?? 0) > t.card.at`), GET /api/self/program-execution note-Feld der Zeilen c2904891/53daa39c, Queue-Zeilen 53daa39c c2904891 ee47b0f8 1832c7eb e4409bf2 3f79ff74 2630483e]
nicht-gemessen: wie viele der 1056 Ledger-Lanes historisch in einem Freigabe-Deadlock standen (die Notiz belegt EINE Instanz, gefunden von Hand, nicht eine Rate); ob die Kollisionslesung pending-Ziele absichtlich mitordnet oder es ein Nebeneffekt ist (der Code wurde fuer diese Notiz nicht gelesen, nur sein Ausgang); ob eine Sonde das Paar (wartende Zeile queued, Ziel pending) billig sehen koennte; die Wirkung des Re-Reads auf andere Nicht-FORMAT_KEY-Felder ausser `VERBOTEN` und dem mehrzeiligen `ziel`
stand: 2026-09-17
---

# Zwei Wartezustaende, die in der Freigabe-Hand entstehen

Program `Fleet-Betrieb 2026-09`, MAIN Slot 8, im Austausch mit Orchestratorin Slot 6 am
2026-09-17. Keine Code-Aenderung. Alle Code-Zitate sind an `d8ece3a0` gegengelesen, nicht
uebernommen.

## 1. Der Freigabe-Deadlock

`GET /api/self/program-execution` gab fuer `c2904891` (Status **queued**) als Grund:

    waiting: collides with row 53daa39c ahead in the plan on server.ts#cardDue

`53daa39c` stand zu diesem Zeitpunkt auf **pending** — also unfreigegeben, und damit fuer
`tickDispatch` (der woertlich `t.status === "queued"` waehlt) unsichtbar. Die wartende Zeile war
freigegeben, ihr Kollisionsziel nicht. Ohne Eingriff wartet `c2904891` unbegrenzt.

**Warum das keine Sonde findet.** Beide Zustaende sind je fuer sich legitim: eine pending Zeile
ist eine normale, noch nicht freigegebene Zeile; eine queued Zeile hinter einer Kollision ist der
Normalfall an einem vollen Lane-Deckel. Der Defekt ist die RELATION, und die wird nirgends
gelesen. Die Projektion nennt den Grund praezise und vollstaendig — sie sagt nur nicht, dass das
genannte Ziel nie starten wird.

**Warum es keine Code-Aenderung braucht, um heute zu passieren.** Es genuegt eine Freigabe in der
falschen Reihenfolge. Genau das war hier der Fall: die Reihenfolge `c2904891` vor `53daa39c` war
eine Entscheidung der MAIN, getroffen ohne den Zusammenhang aus §2, und sie war falsch.

Abhilfe heute: beim Freigeben einer Zeile das `note`-Feld lesen und, wenn es ein anderes Zeilen-Id
nennt, dessen `status` pruefen. Billiger waere ein Feld, das die Projektion selbst fuellt.

## 2. Der Rat, der in den Schaden laeuft

Die naheliegende Reparatur einer blockierten Karten-Zeile ist, ihren Brief zu schaerfen. Die
Re-Read-Bedingung in `server.ts#cardDue` endet auf

    return (t.brief?.at ?? 0) > t.card.at;

Ein Brief ist also der AUSLOESER des Karten-Re-Reads. Und `card-extract.ts#FORMAT_KEYS` ist

    ["ROLLE", "GROESSE", "FLAECHE", "NEU", "NACH", "VERIFY", "DONE"]

— `VERBOTEN` steht nicht darin. Ein Re-Read schreibt die Karte bedingungslos neu und verliert das
Feld, das der Lane sagt, was sie nicht anfassen darf; dasselbe gilt fuer ein mehrzeiliges `ziel`,
das auf seine erste Zeile schrumpft. Das ist der Schaden, den Queue-Zeile `53daa39c` repariert.

Der Rat "erweitere `c2904891` um den Validator-Bump" ist sachlich richtig — ohne Bump erreicht
kein Validator-Fix je eine gespeicherte Karte, weil der Re-Read nur bei
`(t.card.validatorVersion ?? 1) < CARD_VALIDATOR_VERSION` greift und beide Werte auf 5 stehen.
Aber er laesst sich nicht ausfuehren, bevor `53daa39c` gelandet ist, ohne den Verlust aus §2
auszuloesen.

**Die einzige Reihenfolge, die beide Befunde respektiert:** `53daa39c` landet, danach wird
`c2904891` erweitert. Bis dahin wird in diesem Program KEIN Brief angefasst.

## 3. Was daraus keine Regel wird

Beides sind Befunde, keine promovierten Regeln. Die Abhilfe aus §1 (Status des Kollisionsziels
mitlesen) ist eine Handreichung an die naechste MAIN, kein Gate; ob die Projektion das Paar selbst
tragen soll, ist offen und in `nicht-gemessen` als unbeantwortet gefuehrt.
