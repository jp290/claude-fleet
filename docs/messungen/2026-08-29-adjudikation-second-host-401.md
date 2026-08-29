---
frage: Ist das rote Post-Land-Audit auf 748ec97 (remote=second-host, 9 Fails, task-spawn 401) ein Produktdefekt?
urteil: Ein rotes Remote-Audit ohne Produktdefekt: die Sonde faellt als das, was sie messen sollte
bereich: [verify, harness, queue]
belege: [e2e/programs.ts#successorToken, e2e/programs.ts#spawnFile, post-land-audits.jsonl, server.ts#writeAuditAdjudication]
nicht-gemessen: Der Lauf wurde auf dem Second-host NICHT wiederholt — welche Umgebungs-Voraussetzung dort fehlte, ist geschlossen, nicht gemessen.
stand: 2026-08-29
---

# Ist das rote Second-host-Audit auf 748ec97 ein Produktdefekt?

2026-08-29, Haupt-Checkout. Frage: **Trägt das erste Remote-Audit, das bis zu Checks kam, einen
echten Regress — oder scheitert die Sonde an ihrer eigenen Voraussetzung?**

## Ergebnis

**Kein Produktdefekt.** Adjudiziert als `stale-test`. Fünf Belege, alle am Baum geprüft:

1. **Der auditierte Land ist reine Doku.** `748ec97` ändert genau eine Datei,
   `docs/verify-tiering.md`, +44 Zeilen. Kein Code, kein Test.
2. **Der Code hinter den roten Checks ist unverändert.** Zwischen dem letzten grünen Audit
   (`050f96c`, 08-29 11:49, `ran=3133 failed=0`) und diesem Rot liegen drei Commits: `1395962`
   (Doku), `5707b76` (ausschließlich `helper-daemon/daemon.ts`, `helper-daemon/README.md`,
   `e2e/helper-daemon.ts`) und `748ec97` (Doku). Auth-Pfad, `/api/self/tasks` und
   `e2e/programs.ts` sind nicht angefasst.
3. **Die Owner-Tür fällt nicht, nur die Self-Tür.** Im Tail ist `task-spawn (1d)`
   („the owner create door persists the same validated triple") **PASS** mit vollständiger Zeile;
   rot sind ausschließlich die vier Filings über den Self-Token, jedes wörtlich mit
   `{"error":"unauthorized"}` bzw. `401 null`.
4. **Der TypeError ist Folge, nicht zweiter Defekt.** `e2e/programs.ts:2250` wertet
   `spawnOkBody.task.id` aus; ohne 200 in (1) gibt es kein `task`-Objekt.
5. **Es ist der erste Remote-Lauf, der überhaupt Checks erreichte.** Alle fünf grünen
   Vergleichsläufe liefen auf dem Mac; die zwei Remote-Läufe davor sind `unknown` am leeren Klon —
   der Fall, den ausgerechnet der auditierte Commit als §14.1 aufschreibt.

**Wahrscheinliche Wurzel, inferiert:** `e2e/programs.ts` liest
`successorToken = readState().slots?.[String(successorSlot)]?.selfToken ?? ""`. Der `?? ""`-Fallback
macht einen fehlenden Successor-Slot **ununterscheidbar von einem Produkt-401**. Ein leerer Token
erklärt alle vier roten Zeilen und den Absturz mit **einer** Wurzel.

**`ran: 12` trägt hier keine Aussage.** Die Vergleichsläufe zeigen 3133. Zwölf Check-Zeilen bei einem
Lauf, der `e2e/programs.ts:2208` erreicht, ist mit „zwölf Checks liefen" unvereinbar — es ist ein
Artefakt des byte-gedeckelten Tails (`PostLandAuditRow.out` ist ausdrücklich ein TAIL). So oder so:
über den Baum von `748ec97` wurde nichts festgestellt.

## Methode

Nur lesend: `git show --stat` auf die drei Commits seit dem letzten Grün · `post-land-audits.jsonl`
(346 Zeilen, letzte acht ausgewertet, `remote`-Feld je Zeile) · `e2e/programs.ts` um `successorToken`
und den `task-spawn`-Block · `e2e/self-token.ts` · `server.ts#writeAuditAdjudication` und
`#auditChecksOn` für den Kontrakt der Felder. Kein Suite-Lauf, kein Server gestartet.

## Was nicht gemessen wurde

- **Die Reproduktion auf dem Second-host.** Ohne sie ist die Wurzel geschlossen, nicht gemessen; welche
  Voraussetzung dort fehlte (tmux-Pane, Succession, `restartSrv`), bleibt offen.
- Ob `checks.ran` tatsächlich aus dem gedeckelten Tail gefüllt wird. Der Kontrakt sagt
  „`null` = output was incomplete/inconsistent, NEVER an invented zero"; `12` bei diesem Lauf sieht
  aus wie genau der Fall, für den `null` vorgesehen ist — geprüft habe ich den Parser nicht.
- Ob dieselbe Klasse weitere Sonden trifft. `?? ""` auf einem Credential ist ein Muster, kein
  Einzelfall; ein Sweep über die Fixtures steht aus.

## Die Klasse

Das ist die **Kehrseite der Lehre, die der auditierte Commit selbst aufschreibt**: eine Sonde, die
eine Umgebungs-Voraussetzung ihrer Maschine erbt, sieht den Fehler nicht, den genau diese
Voraussetzung verdeckt. In §14.1 war es `init.defaultBranch` auf dem Mac; hier ist es die
Verfügbarkeit des Successor-Slots. Der erste fremde Rechner legt sie offen, weil er die Erbschaft
nicht hat — und der Second-host verdient damit seinen Unterhalt schon vor dem ersten grünen Remote-Lauf.

## Zu tun (nicht hier gemacht)

1. `?? ""` bei `successorToken` durch einen eigenen `check()` auf die Voraussetzung ersetzen, damit
   ein fehlender Token als **Harness-Fehler** fällt und nicht als 401 des Produkts.
2. Den Audit auf demselben Tip auf dem Second-host wiederholen — erst dann ist die Ursache gemessen.
3. Prüfen, ob `checks.ran` aus einem gedeckelten Tail gefüllt wird; wenn ja, gehört es dort auf
   `null`.
