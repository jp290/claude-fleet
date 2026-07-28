# Mechanismen-Register — Snapshot 2026-07-28, HEAD 479f78c

Ein Snapshot mit Datum, kein gepflegtes Dokument. Jede Zeile ist eine Behauptung aus der
9-Mechanismen-Aufstellung, mit **Belegart** und offenem **Verdikt**.

## Belegarten

| Kürzel | Bedeutung |
|---|---|
| `R` | **read-code** — ich habe die Anweisungen gelesen, die es wahr machen |
| `K` | **code-comment** — Substanz stammt aus einem Kommentar; Code war da, Behauptung ungeprüft |
| `D` | **derived** — von mir aus Ledgern / git / state.sh gerechnet |
| `U` | **unverified** — aus CLAUDE.md / HANDOFF weitergereicht, nicht geprüft |

Verdikt-Spalte: leer = offen; `HOLDS` / `CAVEAT` / `FAILS` / `UNCHECKABLE` nach dem Durchgang.

---

## M1 — Pane-Substrat + Slot-Zustand

| # | Behauptung | Beleg | Anker | Prüfer | Verdikt |
|---|---|---|---|---|---|
| 1.1 | 16 feste Slots, tmux-Session `s<N>` pro Slot, eigener Socket | R | server.ts:195, :19 | — | |
| 1.2 | `openSlot` probet tmux statt `s.cwd` zu glauben, vor dem Recycle | R | server.ts:1283 | — | |
| 1.3 | Board/Pane drifteten live auseinander am 2026-07-25 (Vorfallsbericht) | K | server.ts:1278 | — | |
| 1.4 | Env ist nur zur Spawn-Zeit injizierbar; Relabel wirkt erst beim Respawn | K | server.ts:1206-1212 | A4/C4 | |
| 1.5 | Self-Heal `--resume`t die claude-Session, wenn das Transcript existiert | R | server.ts:1199-1200 | — | |
| 1.6 | Stream-Datei erzwungen 0600 bei jedem ensure | R | server.ts:1239, :1245 | — | |
| 1.7 | Truncation → synthetischer CLEAR mit `from = -1`, von `afterSeed` erkannt | R | server.ts:1719, :1694 | — | |
| 1.8 | `saveState` = unique tmp + O_EXCL 0600 + fsync Datei **und** Verzeichnis + .bak beim Rename | R | server.ts:516-528 | — | |
| 1.9 | fleet.json ist der Credential-Store (Owner-, Steward-, self-Token, Share-Secrets) | R | server.ts:491 | — | |
| 1.10 | `claimInstanceLock` verweigert nur bei sichtbar lebendem `server.ts`; 5 s Grace | R | server.ts:4567-4594 | — | |
| 1.11 | Slot-Recycle muss ~10 Nebenkarten leeren, sonst liest eine frische Lane `done-looking` | K | server.ts:1300-1315 | A3 | |

## M2 — Lane-Lebenszyklus

| # | Behauptung | Beleg | Anker | Prüfer | Verdikt |
|---|---|---|---|---|---|
| 2.1 | Lane forkt von `integrationBranch`, nicht vom HEAD des Primary | R | server.ts:977-980 | — | |
| 2.2 | Nur gitignorierte Dateien werden kopiert (`check-ignore`-Gate) | R | server.ts:986-988 | — | |
| 2.3 | Kopien 0600 bei Erzeugung, weil die Quelle selbst 0644 ist | R+K | server.ts:990-997 | — | |
| 2.4 | `worktreeRisk` speist Vorschau **und** Durchsetzung — eine Rechnung, zwei Konsumenten | R | server.ts:1027, :1069 | — | |
| 2.5 | „safe to drop" kennt drei Bewahrungswege (`@{push}`, irgendein Remote, gemergt) | R | server.ts:1031-1053 | — | |
| 2.6 | `landLane` baut Outcome vor Teardown, emittiert erst danach | R | server.ts:1088-1091 | — | |
| 2.7 | `advanceIntegration` zweimodig; ff im Holder-Worktree, sonst `branch -f` nach Ancestry-Gate | R | server.ts:1110-1120 | — | |
| 2.8 | `laneSpawn`/`attachBusy` müssen SYNCHRON vor dem ersten await reservieren | R+K | server.ts:1144-1150 | — | |

## M3 — Land-Pfad (`mergeJob`)

| # | Behauptung | Beleg | Anker | Prüfer | Verdikt |
|---|---|---|---|---|---|
| 3.1 | Kein Tick ruft `mergeJob` — nur die Route. Das IST die Autonomiegrenze | R | server.ts:4909-4919 vs :3956 | A3 | |
| 3.2 | git ist Autorität, Agent ist Narrativ: unabhängige `status` + `is-ancestor`-Prüfung | R | server.ts:3992-3994 | — | |
| 3.3 | Konfliktpfad stoppt IMMER, unabhängig von verify | R | server.ts:4038-4053 | — | |
| 3.4 | Clean+grün/unkonfiguriert ist die einzige unbeaufsichtigte Landung | R | server.ts:4073-4128 | A4/C2 | |
| 3.5 | Shadow-Modus: Gate-Zweig durch Modus-Prüfung unerreichbar, nicht durch Verdikt-Wert | K | server.ts:4082-4088 | **A4/C2** | |
| 3.6 | `landed:true` nur über explizites `"ok"` erreichbar | K | server.ts:4079-4081 | **A4/C2** | |
| 3.7 | `runCleanReview` fällt geschlossen aus (Timeout/unparsebar/keine Basis → Stop) | K | server.ts:4080 | **A4/C2** | |
| 3.8 | Repair-Loop nur auf Konfliktpfad; ändert nie WAS landet | R | server.ts:4017-4037 | — | |
| 3.9 | `verify.ok === false` explizit statt `!ok`, damit ein Skip nicht als Defekt gefüttert wird | R | server.ts:4013-4017 | — | |
| 3.10 | Repair mit uncommitteten Edits → `reset --hard HEAD`, Runde wird No-op | R | server.ts:4021-4028 | — | |
| 3.11 | Drei Durability-Marker je VOR dem riskanten Schritt (`saveStateNow`, `markLandIntent`) | R | server.ts:3966-3968, :2983-2987, :4100 | — | |
| 3.12 | `finishLandsInFlight` erfindet nie einen `mainAfter` | R | server.ts:3042-3049 | — | |
| 3.13 | `recordLand` räumt den Marker ZULETZT auf, weil jeder Schritt idempotent ist | K | server.ts:3010-3015 | **A4/C8** | |
| 3.14 | Provenienz-Note vom SERVER, nicht vom Agenten; Note-Fehler kippt nie ein Land | R | server.ts:2961-2977 | — | |
| 3.15 | **`rebase --abort` Exit-Code wird verworfen** | R | server.ts:3769 | A4/C7 | |
| 3.16 | `tickGit` läuft `git status` in jedem Slot-cwd ohne Merge-Guard → der Kollidierer | R | server.ts:824 | A4/C7 | |
| 3.17 | Reversibilität ist genau EIN Land tief (Map pro Repo) | R | server.ts:2924, :2937 | — | |

## M4 — Verify-Tiering

| # | Behauptung | Beleg | Anker | Prüfer | Verdikt |
|---|---|---|---|---|---|
| 4.1 | `runVerify` vierwertig: absent / true / false / null | R | server.ts:2830-2851, :2880-2889 | — | |
| 4.2 | Skip ≠ unkonfiguriert, weil sich WER und AUF WELCHER GRUNDLAGE unterscheiden | K | server.ts:2796-2808 | — | |
| 4.3 | Historisch: `exit 0` beim Deklinieren ließ eine Lane mit `ok:true` landen | K | server.ts:2791-2794 | — | |
| 4.4 | Skip-Test läuft über die VOLLE Ausgabe, nicht das gekappte Fenster | K | server.ts:2842-2844 | **A4/C1** | |
| 4.5 | Legacy-Marker `/^verify skipped:/m` schließt das Loch vor dem nächsten kickstart | K | server.ts:2810-2815 | A2 | |
| 4.6 | `mainSha` bindet das Verdikt; ungültig sobald main vorbeizieht | R | server.ts:2828, :2846 | — | |
| 4.7 | Stufe 2 gated nicht, undoed nicht, blockiert nicht | R+K | server.ts:3063-3070 | A2 | |
| 4.8 | Tri-State: `unknown` ≠ grün ≠ rot | R | server.ts:3094-3104 | — | |
| 4.9 | Coalescing verliert kein Land | K | server.ts:3148-3154 | **A4/C3** | |
| 4.10 | Durable Queue synchron, weil ein Kill Millisekunden nach der Mutation kommt | R+K | server.ts:3127-3141 | A4/C3 | |
| 4.11 | 19 Audits, 11 grün / 8 rot, die letzten SECHS in Folge rot | D | post-land-audits.jsonl | — | |
| 4.12 | Jüngster roter Lauf hat genau 1 Fail: `trail: rows name the tree ... (tree=null dirty=null)` | D | post-land-audits.jsonl letzte Zeile | — | |
| 4.13 | `808fd6e` (9 min danach) adressiert plausibel genau diesen Check — UNBEWIESEN | D | git log 808fd6e | A2 | |

## M5 — Wegwerf-Agenten + Tool-Scoping

| # | Behauptung | Beleg | Anker | Prüfer | Verdikt |
|---|---|---|---|---|---|
| 5.1 | `summaryViaSession` = eigene tmux-Session, gepinnte UUID, Antwort aus dem JSONL gepollt | R | server.ts:2071-2130 | — | |
| 5.2 | `finally` killt Session UND löscht Transcript, sonst kapert es die mtime-Fallback-Ansicht | R+K | server.ts:2122-2128 | — | |
| 5.3 | `--allowedTools` ist ADDITIV zu settings.json; Anker allein wirkungslos (empirisch) | K | server.ts:2852-2857 | **A4/C5** | |
| 5.4 | `--tools ""` ist ein Fähigkeitsschnitt, den settings.json nicht aufweiten kann | K | server.ts:2057-2065 | A4/C5 | |
| 5.5 | `REVIEW_TOOLS` entzieht `git rebase`, weil `-x` unumkehrbare Ausführung ist | K | server.ts:2861-2869 | **A4/C5** | |
| 5.6 | Jeder Spawn-Callsite passt eine der drei Scoping-Konstanten | U | — | **A4/C5** | |
| 5.7 | `mergeStart` verhindert zwei gleichzeitige `git rebase` auf einem Worktree | R+K | server.ts:2902-2905 | — | |
| 5.8 | `needsMergeReview` hält Badge und Verweigerung an einer Stelle | R | server.ts:2911-2915 | — | |

## M6 — Unbeaufsichtigte Ticks

| # | Behauptung | Beleg | Anker | Prüfer | Verdikt |
|---|---|---|---|---|---|
| 6.1 | Sieben Timer; `poll` 100 ms, `tickGit` 10 s, `tickDispatch` 8 s, auto-③ 15 s | R | server.ts:4909-4919 | — | |
| 6.2 | `canDeliver` ist der EINZIGE Choke-Point für unbeaufsichtigte Prompts | K | server.ts:1500-1526 | A3 | |
| 6.3 | `alive` muss frisch sein; 10-s-Cache könnte in eine tote Pane feuern | K | server.ts:1510, :803-808 | — | |
| 6.4 | Gescheiterte claude hinterlässt nackte Shell, die Task-Text als Kommandos ausführt | K | server.ts:1650-1653 | **A2/A5** | |
| 6.5 | Doppeltes `canDeliver` (vor Spawn, nach 4 s Boot) | R | server.ts:1624, :1654 | — | |
| 6.6 | Identitäts-Recheck nach dem Sleep verhindert Prompt an fremde Session | R | server.ts:1644-1649 | — | |
| 6.7 | Fertige, nicht abgeräumte Lanes zählen gegen `DISPATCH_MAX_LANES` | R | server.ts:1614-1615 | — | |
| 6.8 | auto-③ „removes a WAIT, never a CHECK" | K | server.ts:2464-2467 | A3/A5 | |
| 6.9 | Level-getriggert → Decke in beide Richtungen (`reviewAutoTried` vor dem Spawn) | R | server.ts:2479-2505 | — | |

## M7 — Evidenz-Schicht

| # | Behauptung | Beleg | Anker | Prüfer | Verdikt |
|---|---|---|---|---|---|
| 7.1 | `appendEvent`: eine JSON-Zeile, eigene Chain, 0600, Rotation bei 5 MB | R | server.ts:418-431 | — | |
| 7.2 | Bewusst nicht über console.log, weil watchdog.sh mit Default-umask nach server.log leitet | K | server.ts:383-388 | A2 | |
| 7.3 | Inhaltsregel: keine Passwörter/Secrets/Token/Prompt-Text im Audit | K | server.ts:386-388 | A5 | |
| 7.4 | `readLedger` liest beide Generationen; `.1` zuerst = chronologisch | R | server.ts:445-459 | — | |
| 7.5 | „Bounded by construction: exactly two files" — was passiert bei der ZWEITEN Rotation? | K | server.ts:443 | **A4/C6** | |
| 7.6 | Torn line wird gezählt (`malformed`), nicht geschluckt | R | server.ts:454-456 | — | |
| 7.7 | 38 Shadow-Zeilen: 30 `pass`, 8 `null`, 0 `would_stop` | D | lane-outcomes.jsonl | — | |
| 7.8 | Die Notizen der letzten 6 lauten „Main gained no commits since the lane forked" | D | lane-outcomes.jsonl | — | |
| 7.9 | Neue ②-Serie hat NULL Zeilen (seit dem Fix 07-28 08:49 landete nichts) | D | state.sh + Zeitstempel | — | |
| 7.10 | Rotation hat nie gefeuert (72 KB gegen 5 MB) | D | ls -la audit.jsonl | — | |

## M8 — Trust-Perimeter

| # | Behauptung | Beleg | Anker | Prüfer | Verdikt |
|---|---|---|---|---|---|
| 8.1 | Vier Prinzipale: Owner, Steward, Session(self), Gast | R+U | server.ts:275-293, :1204-1212 | A1 | |
| 8.2 | `/api/self/autos` hart an den Slot des Tokens gebunden; `slot`-Feld ignoriert | U | server.ts:5811 | **A3** | |
| 8.3 | selfToken rotiert bei JEDER Aktivierung | K | server.ts:1295 | **A4/C4** | |
| 8.4 | Steward-Token keyt auf Label, nicht auf Worktree | R | server.ts:1211 | — | |
| 8.5 | `guard` = Host-Allowlist + Origin/Host-Prüfung; Strict-Cookie als Gegenstück | U | server.ts:4231-4262 | A1/A3 | |
| 8.6 | Share-Auth brute-force-gedrosselt (`failStrike`) | U | server.ts:4192-4218 | **A1** | |

## M9 — Wahrnehmungs-Schicht

| # | Behauptung | Beleg | Anker | Prüfer | Verdikt |
|---|---|---|---|---|---|
| 9.1 | „LANDING IS NOT DEPLOYING" — `deployGap` vergleicht bootHead gegen head | R+K | server.ts:5240-5279 | A1 | |
| 9.2 | „LANDING IS NOT BUILDING" — `bundleStale`; beide gehen unabhängig live | R+K | server.ts:5280-5338 | **A1** | |
| 9.3 | Fakten geteilt, Cursor pro Konsument (git-Remote-Modell) | K | server.ts:5339-5420 | A1 | |
| 9.4 | `ledgersView` mit hartem Cap und ehrlichem Kaltstart (`LEDGER_COLD_ROWS`) | R | server.ts:5546-5548 | — | |

---

## Bilanz der Belegarten (vor dem Durchgang)

86 Zeilen insgesamt, 34 davon einem Agenten adressiert.

- `R` **42** + `R+K` **8** + `R+U` **1** — gelesener Code
- `K` **24** — Kommentar-Substanz, ungeprüft ← das ist die Angriffsfläche
- `D` **7** — von mir gerechnet
- `U` **4** — weitergereicht, nie geöffnet (v.a. M8 — der Trust-Perimeter ist mein
  schwächster Abschnitt: ich habe `guard`, `shareGate`, `failStrike` und die self-Route
  NICHT gelesen und trotzdem eine Tabelle mit vier Prinzipalen gebaut)

---

## Nachtrag A1 — Client/Share (blinder Nominator, `src/client.ts` 1-3969 + `share.ts` vollständig gelesen)

Sein eigenes Kriterium, notiert weil es von meinem abweicht und für diese Fläche besser ist:
> „load-bearing, wenn die Handlungsfähigkeit des Owners von einer Invariante abhängt, **die
> sonst nichts nachprüft**. Features verliert man und merkt es; Mechanismen verliert man und
> merkt es nicht."

| # | Befund | Anker | Trifft |
|---|---|---|---|
| A1.1 | **Stated invariant ist falsch**: der Kommentar bei `client.ts:1178` behauptet „one outline row per user text block — exactly mirrors the `.msg.user` elements". `appendEntry:388` zweigt bei `e.meta` nach `addNotif` ab (kein `.msg.user`), `pollOutline:1177` filtert NUR auf `role` und liest `e.meta` nie. Serverseitig verifiziert: Task-Notifications kommen als `role:"user", meta:true` (`server.ts:1851-1855`). → Outline-Index verschiebt sich, Klick auf Prompt N springt woandershin | client.ts:388 / :1177 | neue Zeile |
| A1.2 | `verifyBadge(undefined)` behauptet eine Ursache, die es nicht wissen kann („no FLEET_VERIFY_CMD result on record"). Ein weggefallener Fetch (`.catch(()=>null)`, `:809-813`) rendert als positive Aussage. Die fail-closed-Haltung direkt daneben (`:1067-1073`, Land-Button disabled) wird hier NICHT angewandt | client.ts:1013-1015 | **§4.1 / Querschnitt 3** |
| A1.3 | `/api/sessions.postLandAudit` trägt **nur die neueste Zeile**; nichts auf dieser Fläche liest `/api/post-land-audits`. Ein rotes Audit, dem ein grünes folgt, verschwindet dauerhaft vom Board. Ack liegt in localStorage → pro Gerät | client.ts:2517-2566 | **§4.11** |
| A1.4 | Render-Key `lastRender` ist ein handgepflegter Spiegel von `renderSlots` und lässt `git.behind` aus, das bei `:2386` gerendert wird | client.ts:2604-2607 | neue Klasse |
| A1.5 | `MAX_CHUNK = 1000` ist ein handkopierter Spiegel des Server-Caps (`server.ts:7094`), wo ein zu großer Frame mit blankem `return` **verworfen** wird — keine Close, kein Fehler | client.ts:17 | neue Zeile |
| A1.6 | Land-Pfad browserseitig hängt daran, dass `POST /land` Ablehnung als **non-2xx** signalisiert; `doLand:816` verzweigt nur auf `direct.ok`. Heute erfüllt (`server.ts:6913-6917`) — gehalten von genau dieser einen Zeile | client.ts:786-839 | §3, neue Kante |
| A1.7 | Disposition-Rail: erste-gewinnt heißt „neuestes Verdikt gewinnt" **nur weil** der Server absteigend sortiert (`server.ts:3727`). Fiele der Sort weg, liefert `readLedger` chronologisch → still das ÄLTESTE Label als aktuell | client.ts:2993-2999 | §7.4 Kante |
| A1.8 | Join-Key `landRef` = `<branch>@<ts>` wird im **Browser** konstruiert; Server nimmt jeden nicht-leeren String ≤200 Zeichen (`server.ts:3744-3745`) | client.ts:2983 | §7 |

**Browser-only Entscheidungen ohne Server-Gegenstück** (Auswahl): `RECENT_MS = 5000` definiert „arbeitet vs. idle" allein im Client (`:16`) und wird gegen `serverNow` gemessen, das nur beim Poll vorrückt — im Data-Saver also 5-s-Schwelle gegen bis zu 10 s alte Daten; nichts auf dem Schirm nennt das **Alter des Bildes**; `K1_ANCHOR_BRANCH = "f9-verify-deps"` hartkodiert (`:3131`), scrollt aus dem 1000er-Fenster; `DISCARD_READ_MS` existiert nur im DOM.

**Deckung A1:** `client.ts` und `share.ts` vollständig; `server.ts` nur ~15 gezielte Bereiche; **nicht gelesen**: `index.html`/CSS (alle `display:none`-Aussagen sind dort inferiert), `e2e/` — er weiß also **nicht**, ob A1.1 getestet ist.

---

## Nachtrag A3 — `server.ts` (blinder Kontroll-Nominator, ~1.950 Zeilen voll gelesen)

Sein Kriterium, enger als meins: *sole enforcement point für eine Invariante, deren Verletzung
den Prozess verlässt* — nach `main`, in den tmux-Socket, in einen Credential-Store oder in ein
durables Ledger, auf dem später entschieden wird. „Routes fail visibly and are retryable; ein
load-bearing mechanism fällt einmal und der Schaden ist schon außerhalb des Requests."

Er nominiert 8 statt 9 und in anderer Reihenfolge. Überlappung mit mir: Land-Pfad, saveState,
canDeliver, Auth, claimInstanceLock, Wegwerf-Agenten, Ledger. **Nicht in meiner Liste: der
⏸-Gate als eigener Mechanismus.** Er setzt ihn auf Platz 2 und als gefährlichste stille Degradation.

| # | Befund | Anker | Trifft |
|---|---|---|---|
| A3.1 | **⏸-Fall-Through.** Der Re-Run-Guard feuert nur solange `main` Ancestor der Lane ist (`:6620-6629`). Ist `main` weitergezogen → `mergeLast.delete` (`:6630`) → frischer `mergeJob`. Die Lane trägt aber die Resolution-Commits des Agenten noch; ein konfliktfreier Replay setzt `pre.clean=true` → **clean auto-land**. Ergebnis: `landed:true`, `resolvedConflict:false`, `confirmedByHuman:false`, Provenienz-Note mit `conflicted: undefined`. Braucht einen Owner-⏫-Klick, keinen Tick | server.ts:6620-6630 → :3972 → :4094 | **§3.3 braucht CAVEAT** |
| A3.2 | **Doppelter Drain beim Boot.** `finishLandsInFlight` (`:4784`) → `recordLand` → `schedulePostLandAudit` setzt `auditDraining=true` und startet Drain. Der Boot-Block bei `:4875-4903` ersetzt danach das `auditQueue`-Objekt, setzt `auditDraining=true` **erneut** (gesetzt, nicht geprüft) und startet einen ZWEITEN Drain. Der Kommentar bei `:4901` („nothing can be draining yet — this is boot") ist falsch, sobald ein Land recovered wurde | server.ts:4875-4903 vs :3162 | **§4.9/4.10** |
| A3.2-E | **Empirisch geprüft (JP, 2026-07-28):** `grep -c land_recover audit.jsonl` = **0**, `audit.jsonl.1` existiert nicht, `post-land-audit-queue.json` fehlt. Der Doppel-Drain hat **nie gefeuert** — er erklärt **keines** der 8 roten Audits. Latenter Defekt, kein historischer | audit.jsonl | korrigiert A3.2 |
| A3.3 | `landPending` ist pro **Repo** (`:2937`), die Merge-Guards sind pro **Slot** (`:6476`). Zwei Lanes desselben Repos erreichen beide `markLandIntent`; das zweite `set` überschreibt still. Stirbt der Prozess dort, verliert ein echtes Land Undo **und** Note dauerhaft (`land_recover_fail`). Der Kommentar bei `:2981` nennt „one land per repo at a time" als **Annahme** — nichts erzwingt sie | server.ts:2937 vs :6476 | **§3.17 erweitert** |
| A3.4 | `runVerify` awaitet `new Response(p.stdout).text()` **vor** `p.exited`; der Timer ruft nur `p.kill()` auf die Shell. Überlebt ein Prozessbaum die Shell mit offenem stdout, EOFt die Pipe nie → hängt unbegrenzt, und nichts begrenzt `mergeJob` (Route feuert und kehrt zurück, `:6632`). Der Tier-2-Code benennt genau diese Gefahr und begründet den Nicht-Fix mit „something upstream always notices" (`:3278-3283`) — eine Aussage über **menschliche Aufmerksamkeit**, kein Bound | server.ts:2832-2838 | **§4.1 Kante** |
| A3.4-E | **Empirisch geprüft (JP):** der Agent hielt das für latent („verify ist eine tsc-Zeile"). Falsch. `watchdog.sh:71`: `tsc … && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh` — **drei Wrapper, die je einen Server und tmux-Server booten**, Timeout 300 s. Die Vorbedingung ist damit plausibel statt hypothetisch. *Nicht* gemessen, dass der Hang je eintrat | watchdog.sh:71,101 | verschärft A3.4 |
| A3.5 | `claudeAlive` hat eine dokumentierte Generalabschaltung: `if (!/^claude(\s\|$)/.test(BASE_CMD)) return true` (`:1402`) — ein eigenes `FLEET_CMD` deaktiviert das Liveness-Gate vollständig | server.ts:1402 | §6.3 Kante |
| A3.6 | **Bestätigt, was bei mir `U` war:** `/api/self/autos` leitet den Ziel-Slot aus dem *matchenden Token* ab und liest nie ein `slot`-Feld (`:5811-5815`, `createAutoForSlot` nimmt `s` direkt). Und die Platzierung IST der Vertrag: self- und Steward-Gate stehen **nach** dem `SHARE_HOSTS`-Check (`:5793-5802` vor `:5811`) → aus dem öffentlichen Tunnel strukturell unerreichbar | server.ts:5789-5844 | **§8.2/8.5 → HOLDS** |
| A3.7 | `advanceIntegration` hat exakt zwei Aufrufer, `:4101` und `:6571`, beide serverseitig | server.ts | **§3.1 HOLDS** |
| A3.8 | `tokenGate` hat bewusst **kein** Lockout (flache 400 ms), Share-Cookies dagegen 50 Strikes — begründete Asymmetrie: ein Lockout ließe einen Fremden den Owner aussperren | server.ts:4162-4172, :4202-4226 | §8 ergänzt |
| A3.9 | Korrupter State wird beim Restore **verschoben**, nicht kopiert, damit das gute `.bak` nicht vom nächsten Save überschrieben wird | server.ts:4775 | §1.8 ergänzt |

**Live-Konfiguration verifiziert** (`watchdog.sh:101`): `FLEET_CLEAN_REVIEW=shadow`, `FLEET_DISPATCH_MAX_LANES=2`, `FLEET_VERIFY_TIMEOUT_MS=300000`, Post-Land-Audit gesetzt. Damit sind mehrere `U`-Zeilen aus CLAUDE.md jetzt belegt.

**Deckung A3:** ~1.950 Zeilen voll; Skelett über den Rest. **Nicht gelesen:** die gesamte Steward-Region `:4923-5765` (also meine §9 hat er nicht geprüft), Transport `:4274-4533`, `:5881-6399`, `:6721-7109` (WebSocket-Handler), `runReview`, `tickAutoReview`, `commitLane`. Außerhalb `server.ts`: **nichts** — `lane-signals.ts` ungeöffnet, also ist die auto-③-Auslösebedingung von ihm nicht verifiziert.

---

## Nachtrag A4 — Kommentar-vs-Code, acht benannte Claims

| Claim | Verdikt | Konsequenz für das Register |
|---|---|---|
| **C3** Coalescing „nothing is silently dropped" | **FAILS** | **§4.9 zurückziehen** — für die *durable* Hälfte. Die In-Prozess-Verschmelzung ist korrekt und darf zitiert werden |
| **C2 (i)** Shadow-Unerreichbarkeit per Modus-Prüfung | HOLDS | §3.5 bleibt |
| **C2 (ii)** „`landed:true` nur über explizites ok" | **FAILS unter Live-Konfig** | **§3.6 umschreiben**: gilt in `gate`. Live läuft `shadow` — dort landet `review`/`raw` mit |
| **C1** Skip-Test über die volle Ausgabe | HOLDS + CAVEAT | §4.4 bleibt, aber mit Anhang (s.u.) |
| **C8** „every step idempotent" | HOLDS + CAVEAT | §3.13 abschwächen auf *at-least-once* |
| **C4** selfToken-Rotation | HOLDS + CAVEAT | §8.3 umformulieren |
| **C7** `rebase --abort` verworfen | **HOLDS**, Folge **begrenzt** | §3.15 präzisieren — s.u. |
| **C6** „bounded by construction: two files" | HOLDS | §7.5 bleibt; neuer Nebenbefund |
| **C5** Tool-Scoping | HOLDS | §5.3/5.5/5.6 bleiben, mit einer Bedingung |

**C3 im Detail — schwerer als A3.2, und derselbe Auslöser.** Nicht nur der Doppel-Drain:
`finishLandsInFlight` (`:4784`) läuft **vor** der Queue-Rehydrierung (`:4875`). Sein
`recordLand` → `schedulePostLandAudit` findet `auditQueue` leer, baut eine Ein-Eintrags-Map und
ruft `savePostLandAuditQueue()` (`:3161`), das `Object.fromEntries(auditQueue)` schreibt und damit
**die Queue-Datei des toten Prozesses überschreibt** — jedes pending `cover` weg, ohne Zeile, ohne
Log, ohne `unknown`. Genau der Ausfall, gegen den die Datei laut `:3120-3126` gebaut wurde.
Dazu die stale `q`-Referenz (`:3171`), deren `auditQueue.delete` (`:3186`) das *rehydrierte*
Objekt löscht.

**Empirisch (JP):** Auslöser ist ausschließlich der `recordLand`-Zweig von `finishLandsInFlight`
(`:3052`) — der „main hat sich nie bewegt"-Zweig (`:3036-3040`) ruft `recordLand` NICHT und
schreibt nur auf die Konsole. Der `recordLand`-Zweig auditiert immer `land_recovered` (`:3051`).
Gemessen: **0 solche Zeilen** in `audit.jsonl`, keine Rotationsgeneration. ⇒ C3 hat **nie
gefeuert**; die 8 roten Audits sind davon unberührt. Latenter Defekt, live scharf gestellt.

**C1-Anhang mit Verhaltensfolge:** `skipped = !timedOut && (…)` (`:2844`). Ein Kommando, das sich
selbst überspringt und beim Deadline noch lief, wird `ok:false` — und tritt auf dem Konfliktpfad
in den Repair-Loop ein (`:4017`), also genau das, was `:4013-4015` ausdrücklich verhindern will
(„would spend agent rounds editing a tree against a phantom defect"). Zweiter, engerer Fall: endet
stdout ohne Newline und steht die Deklaration auf stderr, verschweißt `${out}${err}` beide zu
einer Zeile und `/^verify skipped:/m` matcht nie — nur falsch-negativ, Richtung bleibt sicher.

**C7-Präzisierung — gute Nachricht:** die Folge eines fehlgeschlagenen Aborts ist **begrenzt**.
`pre.clean` ist `false`, also ist jeder Weg ab `:4038` `landed:false` und `advanceIntegration`
unerreichbar — **es kann nichts landen**. Ein zweites ⏫ wird bei `:6485`/`:6487` abgewiesen,
auto-③ überspringt (`:2500`), Boot loggt (`:4789`). Die Wiederherstellung ist von Hand, absichtlich.
`gitRetry` ist nachweislich **nur** an die Commit-Route gebunden (`:2584`, `:2597`).
⇒ §3.15 ist kein „bad code landet"-Risiko, sondern ein Lane-Wedge + mehrdeutige rote Audits.

**C4-Umformulierung:** rotiert wird auf jedem Pfad, der einem Slot einen **neuen Bewohner** gibt
(`openSlot` ist der einzige `cwd`-Schreiber außer `killSlot`-null, Boot-Restore, Boot-Adoption).
Das Re-Baking desselben Tokens im Self-Heal (`:1204`) ist **Absicht** — es ist der Mechanismus,
über den die Rotation die Pane erreicht (`:1276` sagt das). Nebenbefund: eine bei Boot **adoptierte**
Pane bekommt weder Rotation noch Re-Bake → Self-Scheduling von dort 401t, fail-safe aber stumm.

**C6-Nebenbefund:** vier Routen liefern ein `total`, das nach der zweiten Rotation unvollständig
wäre, und der Client rendert es als „latest N of M" (`client.ts:2932`, `:3195`). `PROMPT_LOG`
umgeht `appendEvent` und rotiert nie, ist also ehrlich. **Latent: Rotation hat nie gefeuert.**

**C5-Bedingung:** `summaryViaSubprocess` (`:2045`) skopiert **gar nichts** und **prä-emptet** den
skopierten Pfad (`:3791`, `:3821`, `:3907`). Die Tool-Scoping-Garantie hängt also daran, dass
`FLEET_MERGE_CMD`/`FLEET_CLEAN_REVIEW_CMD`/… ungesetzt sind — in `watchdog.sh:101` sind sie es.

---

## Nachtrag A2 — e2e + Deploy (blinder Nominator; alle Wrapper + `watchdog.sh` voll gelesen)

Sein Kriterium: *load-bearing, wenn eine autonome Entscheidung an seiner Ausgabe hängt und diese
Ausgabe ein **Wert** ist, keine Exception.* „Eine Exception hält die Maschine an; ein falscher
Wert wird als Tatsache konsumiert." Rangfolge daher nach **Plausibilität des falschen Werts**.

| # | Befund | Anker | Status |
|---|---|---|---|
| **A2.1** | **`FLEET_CMD` steht in keiner Datei.** Die Live-Fleet läuft `claude --dangerously-skip-permissions`, und der Wert kommt aus der **globalen tmux-Server-Umgebung** — gepflanzt bei Erzeugung des tmux-Servers. `watchdog.sh` setzt `FLEET_CMD` **null Mal**. Überlebt jedes `kill-session -t srv` und jedes `launchctl kickstart`. Stirbt bei Reboot oder `tmux kill-server` → `server.ts:59` fällt still auf `"claude"` mit Permission-Prompts zurück; jede Pane bleibt stehen, nichts loggt es | tmux -L claudefleet show-environment -g | **von JP verifiziert** |
| A2.1-E | **JP-Messung:** tmux-Server ist **pid 4277, Sun Jul 12 19:54:00 2026** — Kommandozeile `tmux -L claudefleet new-session -d -s s1 …`, also von einem Slot-1-Spawn aus einer interaktiven Shell erzeugt. `grep -c FLEET_CMD watchdog.sh` = **0**. `server.ts:59` = `process.env.FLEET_CMD ?? "claude"` | ps / grep | verifiziert |
| **A2.2** | **`deployGap` wird grün über eine `watchdog.sh`-Änderung, die nicht live ist.** `BOOT_HEAD` wird beim Modulladen gestempelt (`server.ts:5255`); `watchdog.sh` endet nicht auf `.md`, also `codeBehind:true`. Der Owner macht das Ritual (`kill-session -t srv`), der Server bootet, `BOOT_HEAD` stempelt neu → `{behindCount:0, codeBehind:false}`. Die laufende `sh`-Schleife hält aber weiter die **alten** Strings. Betroffen ist alles auf `watchdog.sh:100-101`; nur zwei Werte tragen einen „needs kickstart"-Kommentar | server.ts:5260-5277 | **§9.1 CAVEAT** |
| **A2.3** | **Port-Band-Überlappung.** postland `15000 + $$%2000` → 15000-16999; security `15200 + $$%2000` → 15200-17199. **1800 Ports überlappen.** Sockets unterscheiden sich, nur der HTTP-Port kollidiert. Verschärfend: `./e2e-security.sh` ist seit `58203f2` **im Land-Gate**, läuft also bei jedem Lane-Verify | e2e-postland-audit.sh:13 vs e2e-security.sh:17 | **von JP nachgerechnet** |
| **A2.4** | **Der Produktions-Agenten-Spawn-Pfad hat NULL Testabdeckung.** `grep -rn "setting-sources\|summaryViaSession\|allowedTools\|REVIEW_TOOLS\|MERGE_TOOLS\|TEXT_ONLY_TOOLS" e2e/*.ts fleet-e2e*.ts` → **keine Treffer**. Jeder Konsument ist ein Ternary `FLEET_*_CMD ? summaryViaSubprocess : summaryViaSession`; jeder Wrapper setzt die Stand-ins, `watchdog.sh:101` setzt **keinen**. ⇒ 100 % der unbeaufsichtigten Agenten-Spawns in Produktion nehmen den Zweig, den keine Suite fährt | e2e-isolated.sh:244 vs watchdog.sh:101 | **§5 Deckungslücke** |
| **A2.5** | `watchdog.sh:69-70` sagt, `./e2e-security.sh` sei **nicht** im Gate; `:71` fährt es. Hinzugefügt in `58203f2` (2026-07-26), Kommentar nicht mitgezogen | watchdog.sh:69-71 | **von JP verifiziert** |
| A2.6 | `fleet-e2e-postland-audit.ts` (430 Z., 51 Checks) steht **nicht** in der tsc-Liste von `watchdog.sh:71` und hat **keinen automatischen Aufrufer**. Der Kommentar bei `:61-63` feiert das Schließen genau dieser Lücke — für drei von vier | watchdog.sh:71 | neue Zeile |
| A2.7 | `tickHarvest` (einziger Schreiber von `source:"terminal"` in die Prompt-Journal) — **null Testtreffer**; in 4 von 5 Wrappern kann es wegen `FLEET_CMD=true` gar nicht laufen | server.ts:1918 | neue Zeile |
| A2.8 | `runCleanReview`s `reset --hard` (`server.ts:3911`) — die Durchsetzungshälfte des ②-Perimeters — ist in 33 Checks **unbehauptet** | fleet-e2e-clean-review.ts | §5 Kante |
| A2.9 | `mergeJob`s advance→record-Fenster ist **gut getestet**: `e2e/land-durability.ts`, 26 Checks, killt den Server in beiden Hälften und prüft beide Negativfälle | e2e/land-durability.ts | **§3.11 HOLDS** |
| A2.10 | `check()` ist solide; `e2e/trail.ts:41` prüft `rows.length === results.length`. **Aber:** der Trail behauptet *eine Zeile pro Aufruf*, nicht *die erwartete Anzahl Aufrufe* — eine ganze Familie, die stumm no-opt, tailt weiter „ALL PASS" mit kleinerer Zahl | e2e/harness.ts:27, e2e/trail.ts:41 | neue Zeile |

**Deckungs-Selbstauskunft A2, wichtig:** er hat ~1.115 `check()`-**Namen** extrahiert, aber die
**Assertion-Rümpfe** der meisten Familien nicht gelesen. Sein Satz: *„a check whose name claims
something its body does not assert would not appear in this report."* Seine Tautologie-Bewertung
ruht auf 9 selbstdeklarierten Kontroll-Checks, nicht auf gelesenen Assertions.

---

## Nachtrag A5 — Angriff auf das Auswahlkriterium

**Das strukturelle Argument (angenommen).** Alle drei Achsen — Übereinstimmung, Irreversibilität,
Unbeaufsichtigtheit — sind Eigenschaften eines Mechanismus, **der handelt**. Daraus folgen drei
Blindheiten, die keine Sorgfalt beim Anwenden behebt:

1. **Auslassungen.** Was nie läuft, stimmt mit nichts überein, bewegt nichts und läuft nicht
   unbeaufsichtigt — Score 0 auf allen drei Achsen bei unbegrenzten Kosten. „Eine Taschenlampe,
   die nur Gegenstände beleuchtet, in einem Raum, dessen Problem ein Loch im Boden ist."
2. **Integrale.** Alle drei Prädikate sind *pro Einzelakt*. Ein geleaktes Scratch-Verzeichnis ist
   perfekt reversibel; zehntausend sind es nicht. **Rate hat in diesem Kriterium keine Darstellung.**
3. **Alles außerhalb der Repo-Grenze.** „Reversibel" setzt einen Rahmen voraus, in dem Umkehr
   bedeutsam ist — hier git + `fleet.json`. Der tmux-Socket, TMPDIR, die Prozesstabelle, das
   Rate-Limit des Abos haben darin keine Koordinate. Das Kriterium **erbt** den blinden Fleck der
   Worktree-Isolation, statt ihn zu korrigieren.
4. **Der Owner selbst.** Achse (c) unterstellt, „beaufsichtigt" sei der sichere Fall. Aufmerksamkeit
   ist aber keine Eigenschaft des Codes. Das Kriterium macht den Owner zur tragenden Komponente
   und weigert sich dann, ihn zu untersuchen.

| # | Befund | Anker | Status |
|---|---|---|---|
| **A5.1** | **Der `interact`-Share ist ein unbeaufsichtigter Schreibpfad ohne den einen Guard, den der Code überall sonst anlegt.** `server.ts:5965-5975` prüft Modus, `s.cwd`, Textlänge — dann `sendText`. **Kein `claudeAlive`.** Der WS-Zwilling `:7086-7097` prüft Modus (live nachgeschlagen, sauber) und Bytelänge 1–1024 — dann `send-keys -H` verbatim. **Kein `claudeAlive`, und keine einzige Log-Zeile.** Der Code benennt bei `:1396-1400` selbst, warum das nötig ist („a dead claude leaves its pane at a plain shell … would execute as shell commands") und wendet es bei `:1522` auf Autos an | server.ts:5965, :7086 | **von JP verifiziert** |
| A5.2 | Kein Benachrichtigungspfad **überhaupt**: `grep notify\|webhook\|ntfy\|osascript\|terminal-notifier` über `server.ts` → nichts. Jedes Signal erreicht den Owner nur, wenn das Dashboard offen ist. Komponiert mit §3.17 (Undo eine Landung tief): rotes Audit auf Land N → niemand erfährt es → Land N+1 überschreibt `undoLast` → beim nächsten Blick ist der Alarm sichtbar und sein Rollback weg | server.ts:2924, :2998 | neue Klasse |
| A5.3 | **773 MB / 672 Socket-Einträge, per Design geleakt.** Alle fünf Wrapper: `rm -rf` bei Erfolg, **behalten bei Fehler** — und nichts räumt Behaltenes je ab. `e2e-isolated.sh:206-230` hat einen sorgfältig begründeten Reaper für *Sockets* und **keinen** für die Verzeichnisse, die drei Größenordnungen größer sind. Kopplung: Stufe 2 fährt die als nichtdeterministisch dokumentierte Suite unbeaufsichtigt → erzeugt die Fehlschläge → erzeugt die Retention. **Der Mechanismus wächst am schnellsten, wenn er am meisten versagt** | e2e-*.sh (je letzte Zeile) | neue Klasse |
| A5.4 | `streams/` ist unbegrenzt: `server.ts:363` sagt „never capped, never rotated" für den Prompt-Log; die `.raw`-Datei wird von tmux angehängt (`:1246`) und die einzige Kürzung (`:1244`) ist bei offener Pipe unerreichbar (Guard `:1240`) — ein Server-Neustart kürzt sie nicht. Gemessen: `s10.raw` 6,2 MB, 26 MB gesamt | server.ts:363, :1240-1246 | neue Zeile |
| A5.5 | Das Abo-Rate-Limit ist eine geteilte erschöpfbare Ressource ohne jede Buchführung. `summaryViaSession:2118-2121` gibt nach Timeout **jeden** Assistant-Text als Antwort zurück; `runSummary` speichert ihn mit `raw:true` als Summary. Ob eine Usage-Limit-Meldung genau diesen Weg nimmt: **inferiert, nicht beobachtet** | server.ts:2118-2121 | plausibel, unbewiesen |
| A5.6 | Ein Gast kann per `POST /s/<id>/summary` eine echte Modell-Session starten; der Cache-Key (`${head}:${hash(status)}`) ändert sich auf einem lebenden Baum ständig, die Kostenbremse greift also für Gäste nicht | server.ts:5942-5948, :2142 | neue Zeile |
| **A5.7** | ~~Fehlzitat des Agenten~~ — **MEIN Fehler, zurückgezogen.** Agent 5 zitierte `.env:1` korrekt. `.env` enthält `FLEET_CMD=claude --dangerously-skip-permissions` (48 B, mtime 2026-07-12, Modus 0644). Mein Prüfbefehl war `cat -A .env 2>/dev/null` — stderr unterdrückt, und ich las das Schweigen als „leer". **Dieselbe Fehlerklasse, die dieser ganze Durchgang untersucht: Abwesenheit von Ausgabe als Beweis für Abwesenheit.** | .env | **korrigiert 2× ** |
| **A2.1-K** | **Folge für A2.1:** die tmux-Server-Umgebung *gewinnt* (echte Env schlägt `.env`, von Agent A empirisch geprüft), aber `.env` liegt mit identischem Wert darunter. Ein Reboot fällt also **nicht** auf permission-promptendes `claude` zurück. Was bleibt: derselbe Wert an zwei Orten mit verschiedener Lebensdauer, `.env` gitignored (im frischen Clone weg) und von `createWorktree` in **jede Lane** kopiert | server.ts:986, .env | Schwere **herabgestuft** |

**Urteil über meine zwei Ausschlüsse:**
- **Client-Rendering: im Ergebnis richtig ausgeschlossen, in der Begründung falsch.** Der Client ist
  epistemisch diszipliniert (`verifyBadge` unterscheidet vier Zustände, `showLandReview` fällt
  geschlossen aus und disabled den Knopf). **Aber:** `client.ts:1007` — ein rotes/skipped/stale
  Badge **disabled Land nie**. Der Entwurf delegiert die Entscheidung bewusst an die Augen des
  Owners. Damit **ist** der Render das Gate an der manuellen Land-Grenze. Er hält, weil er sorgfältig
  gebaut wurde, nicht weil er eine Oberfläche ist — und „Oberfläche" nimmt ihn aus der Klasse der
  Dinge heraus, die geprüft werden.
- **Sharing: falsch ausgeschlossen — der folgenreichste Fehler meiner Auswahl.** `view` **ist**
  eine Oberfläche (Gast-Input wird bei `:7091` serverseitig verworfen, Gast-Upgrade hartkodiert
  `cols:0, rows:0`). `interact` ist ein anderes Objekt mit demselben Namen und erfüllt Achse (c)
  vollständiger als mehrere meiner Nominierungen.

---

**Fettgedruckte Prüfer-Zellen** = die Zeile ist explizit an einen Agenten adressiert.
Alles ohne Prüfer bleibt nach diesem Durchgang so belegt, wie es hier steht — das ist
Absicht und muss in der Synthese so stehen, nicht als stille Vollständigkeit.
