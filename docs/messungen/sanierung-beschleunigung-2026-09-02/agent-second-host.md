# Second-host-Split: was verlagert wirklich Durchsatz? (read-only Analyse, 2026-09-02)

Baum: `main` @ `5964513` (Arbeitsstand des Haupt-Checkouts). Alle Zahlen unten sind aus
`post-land-audits.jsonl`, `audit.jsonl`, `lane-outcomes.jsonl` und den `fleet/land`-Notes GEMESSEN;
jede Strukturaussage traegt `datei:zeile`. Nichts ausgefuehrt, nichts geaendert, kein ssh.

---

## 0. Die Messbasis (Herleitung, damit die Tabelle nachrechenbar ist)

**(a) Post-Land-Audits, heute (2026-09-02), 16 Ledger-Zeilen:**

| Klasse | n | Summe `ms` |
|---|---|---|
| lokal green | 5 | 153,8 min |
| lokal red | 2 | 66,0 min |
| lokal unknown, **Timeout 30 min** | 2 | 60,0 min |
| lokal unknown, **exit 42** (`private-repo-p`, Repo-Guard, nie im Lock) | 4 | 0,0 min |
| **remote** red | 2 | 46,6 min |
| **remote** unknown (exit 127, `private-repo-p`) | 1 | 0,0 min |

**Lokal gehaltener Suite-Mutex durch Audits = 279,8 min (4,7 h)**, nicht 326 min.
→ **Doc-vs-Daten-Widerspruch, benannt:** `HANDOFF.md:104` sagt „16 Audits, ALLE lokal, 326 min
Mutex = 5,4 h". Drei der 16 waren remote (07:36 `7006696`, 09:43 `e03d44c`, 12:14 `466f318`), und
vier lokale kosteten 0 ms (exit 42, der Guard laeuft VOR `e2e-stage.sh`, nimmt also keinen Lock).
Die belastbare Zahl ist **279,8 min/Tag**. Vergleich: 09-01 = 187 min lokal, 08-30 = 280,8 min.

**(b) Land-Gates, heute, 11 Lands mit `fleet/land`-Note** (`verify.ms` / `verify.waitMs`):

| | Summe |
|---|---|
| Gate-**Arbeit** (`ms − waitMs`) | **1247 s ≈ 21 min** |
| Gate-**Warten** in der Mutex-Schlange (`waitMs`) | **12 013 s ≈ 200 min** |

Einzelwerte: `79acd2e` 141 s Arbeit / 2313 s Warten · `c09d5f1` 35 s / 2669 s (`ok:null`,
ausgewartet) · `8990fcb` 186 s / 1784 s · `87c5be6` 109 s / 1838 s · `7006696` 105 s / 1848 s ·
`cc391b7` 107 s / 1439 s · `5c9f661` 110 s / 122 s · vier weitere mit `waitMs 0`.
**Das ist die eigentliche Zahl des Tages:** der Gate ist billig (~2 min), er WARTET nur — und er
wartet auf genau die 279,8 min Audit plus die lokalen Lane-Vorschauen.

**(c) Der Helfer, gemessen an echten Laeufen:** eine Remote-Suite dauert 1274–1449 s (21–24 min)
gegen lokal 1546–2425 s (26–40 min) — das Geraet ist unter heutiger Mac-Last **schneller**.
**Aber es ist EIN Slot:** `helper-daemon/daemon.ts:306 (`suiteBusy`)` + README §„One suite at a
time". Live belegt am 09-02: Audit-Claim 07:13, Lane-Angebot 07:29 → **07:33 zurueckgezogen**
(180 s Leerlauf), Audit gemeldet 07:36, im selben Moment Lane-Angebot geclaimt 07:36 → 07:59.

---

## 1. Die Tabelle

Spalten: **verlagert** = lokale Suite-Mutex-Minuten/Tag, die der Schritt vom Mac nimmt ·
**Kosten** · **server.ts?** (= Freeze-Konflikt P1) · **Vorbedingung** · **Rang**.

| # | Schritt | verlagert (Min/Tag lokaler Mutex) | Kosten | server.ts | Vorbedingung | Rang |
|---|---|---|---|---|---|---|
| 1 | **A1: Grace zurueck auf 60000** nach `3bb5a5c9` | **bis 279,8** (die 13 lokalen Audit-Zeilen von heute; realistisch 230–280, weil ein Claim am belegten Geraet zurueckfaellt — `drainPostLandAudits`, server.ts:12692–12707) — **plus** indirekt der groesste Teil der **200 min Gate-Warten** | `3bb5a5c9`: EINE Zeile + Pin (fleet.json: `status:"done"`, Slot 1). Grace-Flip = `.env`-Zeile + Verb 2. ~0,3 Lane-Tage | **ja** (1 Zeile, `server.ts:15320 processBirthFingerprint`) | A1 gelandet + deployed; Geraet `desiredMode active` + frischer Heartbeat (`helperClaimCandidateExists`, server.ts:12469) | **1** |
| 2 | **Lane-Vorschau via `suite-offer`** | **0 neu — IST GEBAUT UND LIEF HEUTE.** 1 Vorschau remote (07:36–07:59, 23 min); 4 Angebote nach 180 s zurueckgezogen, weil das Geraet belegt war | **0 Lane-Tage** (Routen `server.ts:21680/21720`, Claim `claimLaneSuite` :13412, Regelbuch-Zeile seit 2026-09-01) | nein | nur: der Helfer muss FREI sein — konkurriert mit (1) um denselben einen Slot | **1 (gratis)** |
| 3 | **Zweites Helfergeraet** (nicht in S2–S4, hier benannt) | verdoppelt die Remote-Kapazitaet → entkoppelt (1) von (2) | 0 Code (`helperDevices` ist eine Map, server.ts:12441, `HELPER_DEVICE_KEEP=20` :12326; Claim ist first-come). Owner-Akt: ein Daemon-Deploy | nein | ein zweites Geraet; `audit.jsonl` zeigt am 09-01 23:17 bereits `mainMacbook -> active` (und sofort `-> off`) | **2** |
| 4 | **S4 `c3f91ce1` — R3 Presence** (Haelfte A) | **0 Mutex-Minuten.** Spart Lane-**Latenz**: 4 × 180 s Leerlauf heute = 12 min | ~0,5 Lane-Tage; `server.ts:22915/23017`, `src/client.ts`, `e2e/lane-suite.ts` | **ja** | Freeze-Ende | 3 |
| 5 | **S4 `c3f91ce1` — R2-Rest** (Haelfte B: volles `suite.log` als Artefakt, `reason:"timeout"`) | **0** | ~0,5–1 Lane-Tag; `helperResult` :13625–13690, neue Route, `STREAM_DIR`, Retention, `e2e/helper-portal.ts` | **ja** | Freeze-Ende; Daemon-Update (Board-Route) | 3 |
| 6 | **S2 `8228ae65` — Job v1 `command`** | **0 heute.** Oeffnet erst die Tuer, Nicht-Suite-Arbeit (`bun run build`, fremde Repos) zu verlagern; die Sanierung selbst hat solche Jobs heute nicht | ~1–2 Lane-Tage (7 benannte `server.ts`-Regionen + Daemon + 3 e2e-Module + Allowlist-Pin). Laeuft gerade in Slot 10 | **ja** | S1 gelandet + Daemon versteht `command` (Brief: Server bietet `command` nur Geraeten mit `daemonSha` an) | 4 |
| 7 | **S3 `60d07416` — Wake-on-LAN** | **0** | ~0,5–1 Lane-Tag; Route + Tick + Board + Pin. Bricht als benannte Ausnahme die Pull-Doktrin | **ja** | **ungeprueft:** Mac und Geraet im selben L2-Segment (der Brief fuehrt das selbst als „Vorbedingung ungeprueft"). Nur wertvoll, wenn das Geraet ueberhaupt schlaeft — heute `lastSeen` live | 5 |
| 8 | **Land-Gate remote** | bis 21 min Arbeit/Tag — **die falsche Groesse**: der Gate kostet Warten, nicht Arbeit | **existiert nicht.** `runVerify` (server.ts:11604) spawnt `Bun.spawn(["sh","-c",cmd],{cwd})`, kein Helfer-Zweig. Waere ein neuer Netz-Abhaengigkeitspfad IM Land-Pfad | **ja, gross** | Owner-Entscheid ueber den Mutex (im Ideen-Doc als R8 unter der Schnittlinie) | — (nicht empfohlen) |
| 9 | **Lanes selbst remote** (Phase-0 Option A + B1) | verlagert Agenten, **nicht Suiten** | XL. Phase-0-Doc M7: zweite Instanz = Deploy-/Konfig-Frage, aber M3/M5 bleiben offen (zwei Namensraeume, kein hostuebergreifender Occupant-Begriff, `succeedSupervisor` reicht cwd woertlich durch) | teils | Owner-Entscheid; Digest-Breaker-Vorbedingung aus der Canary-Notiz | — (nicht fuer Durchsatz) |

**Reihenfolge, empfohlen:** 1 → (messen, ein Tag) → 2 ist schon da → 3 (Owner-Akt, 0 Code) →
4 → 5 → 6 → 7. **8 und 9 loesen das gemessene Problem nicht.**

---

## 2. H1-Urteil

**H1 („Der Second-host-Split ist der groesste Hebel") ist HALB WAHR — und der wahre Teil ist
vollstaendig durch A1 + das bereits gebaute `suite-offer` abgedeckt. S2–S4 verlagern NULL
Suite-Minuten.**

Belege, code-seitig:

1. **Genau drei Job-Arten koennen heute an den Helfer**, und zwei davon sind Suiten:
   `helperResult` (server.ts:13625) verzweigt in `reportDaemonUpdate` (`daemon-update`),
   `reportLaneSuite` (`lane-suite`, :13558) und den Audit-Zweig. Der Claim-Pfad ebenso:
   `claimLaneSuite` :13412, `claimDaemonUpdate` :13466, Audit-Claim :13534.
   **Der Land-Gate ist nicht dabei** — `runVerify` :11604 spawnt lokal, ohne jeden Helfer-Zweig.
   Also: die einzigen zwei Dinge, die heute ueberhaupt remote laufen KOENNEN, sind Post-Land-Audit
   und Lane-Vorschau, und beide brauchen **keinen** neuen Code.
2. **Das Vorkaufsrecht ist der einzige Schalter, der die Audits verschiebt:**
   `AUDIT_HELPER_GRACE_MS` (server.ts:12317, Default 0) und die Skip-Bedingung in
   `drainPostLandAudits` (:12692 `graceOn`, :12702 `readyAt`). `.env:15` steht heute auf `'0'` —
   das ist das ganze „Audits liefen lokal". Kein S2/S3/S4 beruehrt diese Zeile.
3. **Die Vorschau ist bereits live gemessen** (`audit.jsonl`, 09-02 07:36 `helper_claim`
   „second-host claimed the preview suite of claude-fleet fleet/260902051642-e0e3", 07:59
   `helper_result` „red preview … from second-host"). S4/R3 macht sie nicht moeglich, sondern
   **hoeflicher** (kein 180-s-Leerlauf).
4. **Was S2–S4 wirklich tun:** S2 = neue Job-KLASSE (Nicht-Suite-Kommandos) — Zukunftsflaeche, nicht
   Durchsatz. S3 = Verfuegbarkeit einer Maschine, die heute nicht schlaeft. S4 = Praezision
   (Presence, Artefakt, Timeout-Grund) — davon ist nur R2 fuer die **Adjudizierbarkeit** wichtig,
   nicht fuer die Geschwindigkeit.

**Die Gegenrechnung, die H1 relativiert:** der Helfer ist EIN serieller Slot
(`helper-daemon/daemon.ts:306`). 279,8 min Audit + N × ~23 min Vorschau muessen durch dieselbe
Nadel. Heute waeren das ~280–350 min auf einem 1440-min-Tag: es passt, aber ohne Reserve, und jeder
Konflikt faellt per Design lokal zurueck (`drainPostLandAudits`, „a claim that lapses … calls
kickAuditDrain"). **Darum ist Schritt 3 (zweites Geraet, 0 Code) sachlich hoeher zu bewerten als
jedes von S2–S4.**

**Der quantifizierte Erfolgstest fuer A1 (falsifizierbar, morgen ablesbar):**
in den `fleet/land`-Notes des naechsten vollen Tages faellt `verify.waitMs` von heute 12 013 s auf
nahe 0 fuer die Mehrzahl der Lands. Faellt es nicht, war der Mutex nicht der Engpass und H1 ist
widerlegt.

---

## 3. Die Blindstelle der Remote-Audits — genauer als bisher notiert

### 3.1 Was fehlt, mechanisch

Auf JEDER der acht Remote-Zeilen im Ledger steht `checks: null` und **kein** `fails`-Feld
(gemessen ueber `post-land-audits.jsonl`: 08-30 08:49 · 09-01 08:22/09:50/12:11/18:14/22:09 ·
09-02 07:36/09:43 — `nfails 0` durchgaengig; die `helper_result`-Zeilen sagen zusaetzlich jedes Mal
„the helper named no clone sha").

Der Pfad ist genau einer:
`server.ts:13666` `checks: measured ? postLandAuditChecks(tail, exitCode, fails) : null` →
`postLandAuditChecks` (server.ts:12826) → **Zeile 12841**:

```
if (fails === undefined || fails.length !== summarizedFailures || failed > summarizedFailures) return null;
```

Der 40-Zeilen-Tail enthaelt die Summenzeile („13 FAILURES"), aber nicht 13 `FAIL `-Zeilen. Ohne
`fails[]` kann die Funktion die Diskrepanz nicht aufloesen und gibt **korrekt** `null` zurueck.

### 3.2 Der kleinste Schnitt — er ist KEIN Code, er ist ein Deploy (und er ist schon getan)

**Server und Daemon koennen es beide bereits:**
- Feld: `PostLandAuditRow.fails?: string[]` (server.ts:12234), Validierung `helperFailNames`
  (:12451–12455), Deckel `HELPER_FAILS_KEEP = 50` (:12328) / `HELPER_FAIL_NAME_MAX = 300` (:12329),
  Persistenz `...(fails !== undefined ? { fails } : {})` (:13665).
- Daemon: `report()` sendet `fails` (`helper-daemon/daemon.ts:410`), berechnet aus
  `failNamesOf(logPath, trail)` (:405).

Also: **der Grund fuer die leeren Zeilen war ein Daemon, der aelter als `3974883` war** — genau die
Diagnose in `docs/ideen/2026-09-01-…:§1.6`. Der Bootstrap heute 12:57 (`daemonSha f62b1f5`,
`HANDOFF.md:22-30`) hat sie behoben. **Ungeprueft:** seit dem Bootstrap ist KEIN Remote-Audit
gelaufen (letzte Remote-Zeile 12:14, exit 127, `private-repo-p`). Der Beweis ist die erste Remote-Zeile
nach dem Grace-Flip.
→ **Antwort auf „beruehrt der Schnitt server.ts?": NEIN.** Er ist bereits gelandet und deployed;
was fehlt, ist die Messung.

### 3.3 Die RESIDUAL-Blindstelle, die kein Deploy schliesst — und die gefaehrlicher ist

`checks.ran` einer Remote-Zeile wird aus dem **Tail** berechnet, nie aus dem Lauf:
Daemon `tailOf(end, 40)` (`helper-daemon/daemon.ts:398`), Server kappt nochmal auf
`HELPER_TAIL_CAP = 4096` (server.ts:12327, benutzt :13646). `postLandAuditChecks` zaehlt
`PASS `/`FAIL `-Zeilen **dieses Tails**.

**Der Beleg liegt im Ledger:** die einzige Remote-**GRUEN**-Zeile (08-30 08:49, `088d3a8`,
`ms 1 274 049`) traegt `checks {ran: 23, failed: 0}` — waehrend lokale Gruen-Zeilen derselben Woche
`ran: 3133…3443` tragen. Ein Remote-`ran` ist mit einem lokalen `ran` **nicht vergleichbar**, und
`ran:23` bei 21 min Laufzeit ist exakt die Falle, vor der das Regelbuch warnt („Ein Audit-Gruen
prueft man an `ms` und an den PASS-Zeilen, nicht am Wort green").

→ **Doc-vs-Daten-Widerspruch, benannt:** `docs/ideen/2026-09-01-…` §5 R4 setzt als Done
„ein Remote-GRUEN existiert (bisher nie)". Es existiert seit 08-30 — aber es beweist wenig. Das
Done-Kriterium gehoert geschaerft auf „ein Remote-Gruen mit `checks.ran` in der Groessenordnung des
lokalen Laufs".

**Kleinster Schnitt fuer 3.3:** der Daemon zaehlt `ran`/`failed` ueber das VOLLE `suite.log` auf dem
Geraet und sendet sie als eigene Felder; `helperResult` speichert sie, statt sie aus dem Tail
abzuleiten. **Das beruehrt `server.ts`** (`PostLandAuditRow` :12222–12247 und `helperResult` :13666)
und `helper-daemon/daemon.ts` — also Freeze-Konflikt, und es ist NICHT Teil von S2/S3/S4.

---

## 4. Risiken — was A1 allein NICHT loest

1. **Lane-Vorschauen bleiben lokal, sobald der Helfer belegt ist.** Ein Slot, seriell
   (`daemon.ts:306`). Heute vier Angebote nach 180 s zurueckgezogen
   (`SUITE_OFFER_WAIT_FREE_MS = 180_000`, server.ts:12569) — jede Ruecknahme ist ein
   ~28-min-Lauf, der doch lokal faellt. **A1 verschaerft das**, weil die Audits die Nadel zuerst
   belegen.
2. **Der Land-Gate kann strukturell nie remote** (`runVerify` :11604). Seine 200 min Wartezeit sind
   ein FOLGE-Effekt der Mutex-Belegung; sie verschwinden nur, wenn wirklich fast alles Andere weg
   ist. Bleibt eine lokale Vorschau uebrig, wartet der Gate weiter.
3. **Zwei Geraete = zwei Flake-Profile, und das ist gemessen, nicht befuerchtet:**
   die Debian-Baseline (`docs/messungen/second-host-baseline-2026-08-29.md`: 67 deterministische
   FAILs, Wurzeln `node` fehlt / dash forkt / fehlende Fixture — repariert), die Locale-Familie
   (5 Checks, A1), und `T14`-Trace-Digest im Spiel-Repo
   (`docs/messungen/2026-08-31-second-host-session-canary-private-repo-o.md`: derselbe Commit auf dem Mac
   ALL PASS, auf Linux rot). **Solange die Familien Prosa und keine Daten sind, ist jedes Remote-Rot
   Handarbeit.** Das ist H3 aus dem Auftrag und die Vorbedingung dafuer, dass A1 Zeit spart statt
   Zeit zu verschieben.
4. **Das Audit-Budget ist einteilig** (`POSTLAND_AUDIT_TIMEOUT_MS = 1_800_000`, server.ts:12200,
   Zeile `0ac22a00`): zwei Zeilen heute starben an dieser Wand (`67b2265`, `8990fcb`, je 30 min).
   Remote-Claims haben ein anderes Budget (`HELPER_CLAIM_TIMEOUT_MS = 2_700_000`, :12306). A1
   umgeht die Wand also fuer die verlagerten Laeufe, **repariert sie aber nicht** — jeder lokal
   zurueckgefallene Lauf trifft sie weiter.
5. **Ein neuer, milder Fehlermodus:** der Helfer claimt JEDES Repo in der Queue, auch
   `private-repo-p` — gemessen 12:14, exit 127, `unknown`, ms 0. Lokal waere dieselbe Zeile exit 42
   (`unknown`). Kein Zeitverlust, aber der `reason`-Text wechselt von „declined to run" zu
   „could not be started"; wer nach Signaturen adjudiziert, muss beide kennen.
6. **A1 ist der einzige Schritt in der Tabelle, der `server.ts` waehrend des Freeze anfasst.**
   Er ist als Freeze-Ausnahme gerechtfertigt (er DIENT dem Freeze: ohne ihn misst Stufe 2 remote
   nichts), aber das ist ein Owner-Akt, kein Lane-Entscheid — so steht es auch in `HANDOFF.md:20`.

**Doc-Pfad-Drift, im Vorbeigehen:** `HANDOFF.md:1852/1899` und
`docs/messungen/2026-08-31-second-host-session-canary-private-repo-o.md` zitieren
`docs/dual-host-session-runtime-phase0-2026-08-30.md`; die Datei liegt heute unter
`docs/attic/`.

---

## 5. Was ich NICHT geprueft habe (woertlich)

- **Das Geraet selbst.** Kein ssh, kein Request an den Daemon, kein Blick in
  `/var/lib/fleet-helper/work/run-*/suite.log`. Alle Geraete-Aussagen sind aus Ledger, Code und den
  zitierten Notizen ABGELEITET.
- **Ob `3bb5a5c9` wirklich gelandet und deployed ist.** `fleet.json` sagt `status: "done"`,
  Slot 1; ich habe weder `git log` auf die Zeile noch `deployGap`/`bootHead` geprueft, und kein
  `state.sh` gefahren.
- **Ob der neue Daemon `fails[]` tatsaechlich liefert.** Seit dem Bootstrap 12:57 gibt es keine
  Remote-Audit-Zeile; die Aussage in 3.2 ist eine Code-Lesung von `daemon.ts:405/410` plus die
  Server-Akzeptanz, **keine Messung an einer Zeile**.
- **Wie viele Lane-Vorschauen heute LOKAL liefen.** Es gibt dafuer kein Ledger — ich kann nur die
  fuenf `suite-offer`-Ereignisse aus `audit.jsonl` zaehlen (1 remote gelaufen, 4 zurueckgezogen);
  wie viele Lanes gar nicht erst angeboten haben, ist unbekannt. Die Vorschau-Minuten fehlen
  deshalb in der Mutex-Rechnung von §0(a) vollstaendig — **279,8 min ist eine UNTERGRENZE**.
- **`e2e/helper-portal.ts`, `e2e/helper-daemon.ts`, `e2e/lane-suite.ts`, `public/helper.html`,
  `src/helper.ts`, `src/client.ts#devicesSection`** — nicht gelesen. Aussagen ueber Board-Flaechen
  stammen aus den Briefs und aus `server.ts`.
- **`helper-daemon/daemon.ts` vollstaendig** — gelesen wurden Struktur-Grep plus die Bereiche
  225–260, 300–360 (via Grep-Kontext), 395–420.
- **Der Slice-Plan der Sanierung** (`docs/sanierung-2026-09/plan-2026-08-31.md`) — nicht geoeffnet;
  H2/H4 sind nicht mein Auftrag und ich habe sie nicht bewertet.
- **Ob S2 (Slot 10) schon Ergebnisse hat** — `lane-outcomes.jsonl` traegt dafuer nichts; ich habe
  nur den Brief gelesen, wie beauftragt.
- **Ob ein zweites Helfergeraet real verfuegbar ist** (Schritt 3). `audit.jsonl` zeigt am 09-01
  23:17 eine `mainMacbook`-Registrierung, die sofort auf `off` ging — mehr weiss ich nicht.
