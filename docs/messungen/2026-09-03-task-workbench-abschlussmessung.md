---
frage: Halten die drei vom unabhaengigen Review als ungeprueft markierten Erfolgskriterien (a), (f), (g) einer Browsermessung stand — und ist der eine offene P1 des Reviews ein Produktdefekt?
urteil: "(f) und (g) sind jetzt im Browser belegt: Suche diskriminiert alle fuenf Dimensionen, der Fokus steht beim Oeffnen auf dem Suchfeld, und ein begonnener Entwurf ueberlebt VIER gemessene 2-s-Polls unveraendert (Wert, Caret, Fokus, Knotenidentitaet) bei null DOM-Mutationen; server.ts ist in allen vier Lands leer. (a) bleibt ungeprueft und braucht eine Scratch-Instanz. Der P1 ist KEIN Produktdefekt, sondern ein falsch formuliertes Kriterium im Review-Brief."
bereich: [task-workbench, ux, verify]
belege: [a58e9c11629650cb911a79186d6b3077d123046e, 71361fa9e3fd59df1789f19ccc71a27964b78754, src/client.ts#qTaskMatches, src/client.ts#openQueue, src/client.ts#renderQueueDetail, docs/messungen/2026-09-03-task-workbench-review.md, docs/messungen/2026-09-02-task-workbench-head-fold.md]
nicht-gemessen: Kriterium (a) — Leerzustand bei 0 offenen und 16 geschlossenen Tasks; die Live-Queue trug 89 offene Zeilen, der Zustand ist nur auf einer Scratch-Instanz herstellbar (Rezept unten)
stand: 2026-09-03
---

# Abschlussmessung der Task Workbench: was der Review offen liess

3. September 2026, 08:31–08:40, Program-MAIN Slot 8, Playwright gegen den LIVE-Server
(Bundle aus `71361fa`). Der unabhaengige Codex-Review (`a58e9c1`) hat (b)–(e) belegt und
(a), (f), (g) ausdruecklich als **ungeprueft** stehen lassen, weil er keinen Browser fuhr. Diese
Notiz schliesst zwei der drei Luecken und benennt die dritte samt Rezept.

## (f) Suche, Fokus, Mobile — ERFUELLT

Suche live gefahren, Zeilen nach jeder Eingabe gezaehlt (Basis: 89 sichtbare Zeilen):

| Eingabe | Dimension | Treffer |
| --- | --- | --- |
| `2d0e73fa` | ID | **1** (genau die gemeinte Zeile) |
| `queued` | Status | 22 |
| `claude-fleet` | Repo | 81 |
| `Workbench` | Program | 15 |
| `Wake-on-LAN` | Text | 1 |
| `zzz-no-such-thing` | Negativprobe | **0** |

Jede Dimension diskriminiert, und die Negativprobe zeigt, dass nicht einfach alles matcht.
**Tastaturfokus:** unmittelbar nach dem Oeffnen ist `document.activeElement` das Suchfeld
(`.pkfilterin`, Platzhalter „search tasks — text, ID, status, repo or program"), identisch mit dem
Knoten selbst. **Mobile 390x844:** in `docs/messungen/2026-09-02-task-workbench-head-fold.md`
gemessen — Hauptaktion 44 px hoch, 362 px breit, `scrollWidth <= innerWidth`.

## (g) Entwurf ueber den 2-s-Refresh — ERFUELLT, mit gemessener Vorbedingung

Der erste Versuch bewies NICHTS und wird hier als Fehlversuch protokolliert: 5,3 s gewartet,
Entwurf ueberlebte — aber `MutationObserver` zaehlte **0** Mutationen, also war gar kein Refresh
zu ueberleben. Eine Sonde, deren Vorbedingung nicht gilt, ist kein Beleg.

Zweiter Aufbau, mit Messung der Vorbedingung: `window.fetch` fuer 7,1 s umhuellt.
**Ergebnis: 4 Aufrufe von `/api/sessions`** (≈ alle 2 s — der Refresh LAEUFT), und ueber diese
vier Polls hinweg: Wert `DRAFT-PROBE refresh test 2026-09-03` unveraendert, **Caret bei 6**,
Fokus auf dem Textfeld, **derselbe DOM-Knoten** (`sameTextareaNode: true`), und **0 Mutationen**
in Liste und Detail. Der Entwurf ueberlebt nicht, weil er wiederhergestellt wird, sondern weil
die Queue-Schale waehrend des Polls gar nicht neu gemalt wird — das ist die staerkere Form.

Zweite Haelfte von (g), mechanisch: `server.ts` kommt in **keinem** der vier Lands vor
(`01459c9`, `8990fcb`, `497873f`, `71361fa` — je `git show --name-only | grep -c '^server\.ts$'` = 0).
Die Autoritaetssemantik ist damit unangetastet.

Der Entwurf und der Suchtext wurden nach der Messung wieder geleert.

## (a) Leerzustand — bleibt UNGEPRUEFT, mit Rezept

Die Live-Queue trug 89 offene Zeilen; 0 offen / 16 geschlossen ist dort nicht herstellbar, und
etwas anderes zu messen und (a) zu nennen waere eine Falschaussage. Der Weg fuer die naechste
Session: Scratch-Instanz nach dem Muster in `CLAUDE.md` (Kopie von `server.ts` + `public/` in ein
Scratch-Verzeichnis, `FLEET_HOST=127.0.0.1 FLEET_PORT=88NN FLEET_SOCK=fleetlaneNN FLEET_CMD=true`),
16 Tasks per API anlegen und schliessen, dann dieselbe Playwright-Strecke. **Nie** aus dem
Haupt-Checkout starten.

## Der offene P1 des Reviews — kein Produktdefekt

Der Review nennt Kriterium (h) nicht erfuellt: „clarify-first startet keine Lane". Drei Fakten
dazu, und sie zeigen alle in dieselbe Richtung:

1. **(h) steht nicht im owner-bestaetigten Erfolgskriterium des Programs.** Dessen acht Saetze
   decken (a)–(g) plus die Beweislage ab; der Satz ueber clarify-first stammt aus dem
   Review-BRIEF, den eine Vorgaenger-Session geschrieben hat.
2. **Clarify-first oeffnet eine Lane by design**, seit langem und dokumentiert
   (`CLAUDE.md` §Lane discipline: „eine Lane, die das Done-Kriterium MIT dir klaert und wartet";
   `src/client.ts#qDispatchBody` baut `{clarify:true}`, `e2e/tasks.ts` schuetzt es).
   Dieses Program hat daran nichts geaendert — es hat den Knopf nur platziert.
3. **Es lane-frei zu machen, wuerde Kriterium (g) verletzen** („bestehende API-/Autoritaets-
   semantik bleibt unveraendert") und das Non-Goal „keine Aenderung an Autoritaetsgrenzen".

Urteil: das Kriterium ist falsch formuliert, nicht der Code. Zu reparieren ist der Brief-Satz,
nicht das Verhalten. Der Owner kann das ueberstimmen — dann waere es eine NEUE Programmzeile mit
eigenem Kriterium, kein Nachtrag zu diesem hier.
