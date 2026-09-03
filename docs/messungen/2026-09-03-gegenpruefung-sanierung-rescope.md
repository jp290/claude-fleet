# Gegenprüfung der Generalsanierung — zwei unabhängige Urteile, beide RESCOPE (2026-09-03)

Anlass: der Owner ließ das Lagebild von sol 5.6 (Slot 15, codex) von GLM-5.3 (Slot 6, pi-zai) gegenprüfen.
Beide lasen Baum `8dffa85` read-only, keine Suite, keine Repo-Änderung. Der Fleet Controller (Slot 8)
hat beide Berichte am 2026-09-03 ~21:30 geerntet und den RESCOPE unter Owner-Delegation an die
Sanierungs-MAIN (Slot 4) als Entscheid weitergegeben. Rückfalltür: dieser Abschnitt + die Send-Zeile
im Controller-Handoff.

## 1. sol 5.6 (Slot 15), wörtlich

Die Sanierung sollte jetzt umgeschnitten werden. Nicht abbrechen und nichts zurückbauen – aber die Vollsplit-Kampagne mit starren Zeilenzielen beenden. GLM-5.3 kommt unabhängig ebenfalls zu RESCOPE.

Warum:

1. Das Ziel server.ts ≤ 8.000 ist praktisch widerlegt. Der Plan lässt Fetch-Kette und Lifecycle ausdrücklich im Kern (docs/sanierung-2026-09/plan-2026-08-31.md:116); die Slice-7-Messung sagt selbst, dass die verbleibenden Bereiche keine Blätter mehr sind (docs/sanierung-2026-09/p4-slice7-vorbereitung.md:170).
2. Die bisherigen Extraktionen sind sinnvoll, aber keine Vereinfachung im engeren Sinn: Fünf P4-Moves verlagerten rund 2.062 Zeilen und erzeugten netto 131 zusätzliche Zeilen. Dafür entstanden brauchbare kleine Module – gut für Reviews und kleinere Modelle –, die Kernkopplung bleibt aber.
3. Der systemweite Freeze existiert faktisch nicht. Der Plan verlangt stille Fenster (docs/sanierung-2026-09/plan-2026-08-31.md:40), während seit dem Anker 194 Commits und zahlreiche Feature-/Fix-Änderungen landeten. Sinnvoll sind daher kurze pfadbezogene Ruhefenster, kein monatelanger Architektur-Freeze.
4. Die Stückkosten sind unverhältnismäßig: gemessen etwa 56 Minuten Suite-Mutex pro Slice statt geplanter 15–25 Minuten (docs/messungen/sanierung-beschleunigung-2026-09-02.md:67).
5. Die Reihenfolge ist verkehrt: Funktions- und Landpfadfehler werden bis P6 aufgeschoben (docs/sanierung-2026-09/plan-2026-08-31.md:153), obwohl gerade diese Fehler die Sanierung verlangsamen und ihre Beweise entwerten.

Meine empfohlene Reihenfolge:

1. Keine neuen P4/P5-Vollsplit-Slices starten.
2. Bereits gelandete Module behalten; nichts zurückbauen.
3. Zuerst Audit-Sensoren, Merge-/Landpfad und verlorene Owner-Tore reparieren.
4. Danach unmittelbar mit Collaboration B beginnen – nicht auf einen vollständigen Server-/Client-Split warten.
5. Weitere Modularisierung nur noch opportunistisch: ein echtes Blatt, ein konkreter Nutzen, höchstens ein Vorschnitt.
6. Stop-Regel von GLM übernehmen: Brauchen zwei aufeinanderfolgende Extraktionen jeweils einen Vorschnitt, endet die Kampagnenform endgültig.

Einzige kleine Abweichung zwischen GLM und mir: GLM würde proc.ts und eventuell noch den Audit-Queue-Schnitt zulassen. Ich würde das nur tun, wenn derselbe Schnitt unmittelbar einen priorisierten Sensor- oder Landpfadfix ermöglicht.

Der gute Zeitpunkt für den Kurswechsel ist jetzt. Nach Abschluss bereits laufender Arbeit könnte die operative Reparaturphase grob 1–2 konzentrierte Tage dauern; anschließend kann Collaboration B starten. Dafür sollte kein globaler Architektur-Freeze mehr nötig sein.

Verifikation: Quellen, aktuelle Dateigrößen und Commit-Differenzen wurden gelesen beziehungsweise nachgemessen; GLM prüfte den Baum 8dffa85 separat. Keine Suite wurde gefahren und keine Repository-Datei verändert.

## 2. GLM-5.3 (Slot 6), wörtlich (lag nur unter /tmp, hier gesichert)

### GLM-5.3-Gegenprüfung — Generalsanierung claude-fleet, Soll die Kampagne weiterlaufen?

Unabhängiger Gegenprüfer (GLM-5.3 via pi, Slot 15), 2026-09-03, Baum `8dffa85` (19:54).
Read-only im Haupt-Checkout; keine Repo-Änderung, kein Commit, kein Send, kein Land, kein Deploy.

**GLM_REVIEW_COMPLETE**

### Verdict: **RESCOPE**

Die Modularisierung als **Fähigkeit** hat sich bewährt und soll bleiben: neun Blatt-Module unter
`server/` (2.505 Z.), eine geteilte Typnaht (`server/types.ts`, 1.582 Z.), Pin-Span-Maschinerie,
`SERVER_RULE` in verify-proportion — alles nachweislich live und grün. Die Modularisierung als
**Kampagne** (Kern ≤ 8.000, P4/P5-Vollsplit bis Tier 4, systemweiter Freeze, Ziel-Zahlen) ist an
drei gemessenen Wänden angelangt: unerreichbare Zielzahl, Fiktion eines Freezes, erschöpftes
Blatt-Angebot. Gleichzeitig liegen gemessene Funktionsfehler genau an den Sensoren und am
Land-Pfad, von denen der Rest der Kampagne abhängt, und werden auf P6 verschoben. Neither
CONTINUE (Ziele tot, Beweiskanäle blind) noch STOP (Blatt-Disziplin ist etabliert und billig
fortzuführen; Abbruch lässt die Land-Pfad-Fehler genauso liegen wie Weiterlaufen).

---

### Anker, selbst nachgemessen (alle VERIFIED)

| Fakt | Behauptet | Gemessen | Kommando |
|---|---|---|---|
| Tag | 49038af | `49038af 2026-08-31` ✓ | `git log -1 49038af` |
| server.ts | ~24k | **23.966** | `wc -l server.ts` |
| server/*.ts | ~2.5k | **2.505** (9 Module) | `wc -l server/*.ts` |
| main-Bewegung seit Anker | „stark" | **194 Commits, 310 Dateien, +28.442/−4.402**; 32 Commits touchen server.ts, davon ~18 Feature-/Fix- (inkl. `feat(studio)` 07f891a, `feat(context)` 87e3ce2, `feat(helper)` 1748417) | `git log 49038af..HEAD` |
| server.ts seit Anker | — | **+2.166/−3.722 = netto −1.556** | `git diff --stat 49038af..HEAD -- server.ts` |
| Kern-Schrumpfung in 3 Tagen | — | **−6,1 %** gegen Ziel-Rest −66 % | abgeleitet |
| Slice 7 braucht Vor-Slice | ja | ja: `server/proc.ts`-Mini-Slice, danach bleiben 4 echte Kern-Bindungen offen | p4-slice7-vorbereitung.md §6/§7 |
| Blatt-Invariante | — | **hält**: kein `server/*.ts` importiert aus server.ts | `rg -n '^import' server/*.ts` |
| pins.ts | — | 5.021 Z., 357 `pin(`, erste Import-Prüfung aus `../server/types` | `wc -l`, `grep -c` |

### Fünf Befunde, nach Wirkung gerankt

**F1 — Erfolgsmaß 1 und 2 sind gemessen unerreichbar, und der Plan widerspricht sich selbst.**
`docs/sanierung-2026-09/plan-2026-08-31.md:60` setzt Kern ≤ ~8.000; `:121` erklärt die
fetch-Kette (2.843 Z., 74 von 91 `url.pathname`-Vergleichen) gleichzeitig zum permanenten Kern.
Projektion der Sanierungs-MAIN: 14 verbliebene Subsysteme × gemessene 275 Z./Schnitt → Kern
**~19.930** (HANDOFF.md:1617); Kommentaranteil heute **7.979/23.966 = 33,3 %** gegen Ziel < 20 %
(`grep -cE '^\s*(//|\*|\*)'`). VERIFIED (alle Zahlen selbst gemessen bzw. an HANDOFF:1017-1020,
1617-1626 gegengeprüft). **Kosten:** jeder weitere Slice wird auf eine unerreichbare Zahl
hingeschoben; der dafür nötige Owner-Entscheid steht seit Tagen aus und stirbt mit jeder
Attention (B-12) — das Programm arbeitet ohne gültiges Zielsystem.

**F2 — Der systemweite Freeze ist Fiktion; die Kampagne fährt gegen ein wanderndes Ziel.**
Seit Anker 49038af: 194 Commits, davon 144 docs, 12 feat, 21 fix; ~18 der 32 server.ts-Commits
sind Feature-/Fix-Arbeit — `feat(studio) S1` (07f891a) und `feat(context)` (87e3ce2) stammen aus
der Sanierungs-MAIN selbst (HANDOFF.md:6-41). `src/client.ts`: +689/−261 = **netto +428 in 3
Tagen**; Fremdarbeit wächst 3,3:1 gegen Sanierungsarbeit (HANDOFF.md:1625-1626) — bei einem
P5-Ziel von ≤ 2.000 gegen 11.006 Ist-Zeilen. VERIFIED (git log/diff am Baum). **Kosten:** P4
verliert netto nur 6 % in 3 Tagen, P5 wäre eine Kampagne gegen 3,3:1 Gegenwind; die einzige
reale Freeze-Form sind die stillgelegten Fenster je Slice — die reichen und sollten genügen.

**F3 — Die bisherigen Moves sind echte Blätter, aber das Blatt-Angebot ist erschöpft; die
Grenzkosten steigen genau jetzt.** Alle 9 Module importieren nur node/bun, untereinander und
Top-Level-Blätter — keine Rückimporte (VERIFIED, Import-Scan). Aber ab Slice 7 gibt es „kein
nächstes BLATT mehr" (HANDOFF.md:86): 530-Z.-Kandidat mit 7 echten Kern-Bindungen in den zwei
größten Funktionen; Form (2) verlangt einen vorgelagerten proc.ts-Mini-Slice, und ob die
verbleibenden 4 Bindungen (helper-Portal, Event-System, Repo-Worker) überhaupt schneidbar sind,
**ist offen** (p4-slice7-vorbereitung.md §6). Ausbeute fällt messbar (Slice 4: −186, Slice 5+6:
−92 gegen ~275/Schnitt). VERIFIED. **Kosten:** Tier 2–4 sind unberührt; jede weitere Einheit
kostet entweder Signaturänderungen (bricht das Review-Muster aller Slices) oder Vor-Slices —
Kampagnenform wird teuer, JIT-Form bliebe billig.

**F4 — Die auf P6 verschobenen Funktionsfehler treffen die Sensoren und den Land-Pfad, von denen
die Kampagne selbst lebt.** Gemessen am Ledger: **0 von 84 roten Audit-Zeilen tragen
Fehlernamen** (p6-befundregister.md B-01/B-02, docs/sanierung-2026-09/p6-befundregister.md:29 ff.);
das Rotationsfenster fraß während der Slice-5+6-Adjudikation selbst Beweis (B-11,
HANDOFF.md:119-125); Attentionen sterben mit der stellenden Session und haben bereits drei
Owner-Tore getötet (B-12, HANDOFF.md:43-48); ein Deploy tötet einen laufenden LAND (B-06);
vor-Fix-Merge-Records sperren Lanes dauerhaft (B-09). VERIFIED (Register-Einträge mit
Ableitungskommandos; B-11/B-12 am eigenen Erlebten der MAIN dokumentiert). **Kosten:** jedes
rote Suite-Ergebnis im Restprogramm bleibt Handarbeit plus 26-min-Rerun; der sicherheitskritischste
Pfad des Produkts (architecture-review.md §1: „risk concentrates at the land gate") bleibt
unrepariert, während die Kapazität in Zeilenzahlen fließt. Das Aufschieben ist als
Reinheitsgebot verständlich („Verhaltens-Delta?"-Checkliste), aber für die Sensor-Fehler (B-01/
B-02/B-11) genau falsch herum: ihr Fix **beschleunigt** die Sanierung.

**F5 — Der Kampagnen-Overhead frisst den Ertrag.** Seit Anker +18.297 Zeilen Docs/HANDOFF
(142 Dateien) gegen 2.505 Zeilen Modul-Code und −1.556 netto im Kern — grob 7 Doku-Zeilen je
Modul-Zeile; HANDOFF.md allein 5.203 Z. Suite-Mutex am 09-02 zu 98,9 % belegt, real ~56 min
Mutex je Slice gegen 15–25 budgetiert (sanierung-beschleunigung-2026-09-02.md:52,68). VERIFIED
(Zähler); INFERRED: Der Dok-Anteil ist teilweise hausübliche Messkultur und wäre auch ohne
Sanierung gefallen — der Zähler ist eine Obergrenze für den Kampagnen-Overhead. **Kosten:** die
knappste Ressource (Programm-Kapazität, Mutex, Owner-Tokenrahmen 80 %/14 h) geht in Prozess und
Beweisform, nicht in Struktur. Entlastung wirkt bereits (A1 `01ccfb3` gelandet, bedingte
Vorschau, letzter Gate-Lauf 103 s mit 0 s Warten — HANDOFF.md:12-14), aber nur auf den
Mutex-Anteil, nicht auf den Doku-Anteil.

### Die gestellten Fragen, kurz

- **Sollte die Modularisierung existieren?** Ja — als Disziplin (Blätter, Typnaht,
  Pfad-Klassifikation). Sie ist die einzige messbare Antwort auf die Diagnose „alles Neue landet
  in zwei Riesen-Dateien" und passt zur Prior Art (simplification-plan-2026-07-28.md:
  „Ableitungen hinaus, niemals Zustand" — die 6 damaligen und die 9 heutigen Extraktionen sind
  dieselbe, funktionierende Form). Nein — als Kampagne mit Zeilenziel.
- **Reduzieren die Moves Kopplung/Arbeitskosten oder nur Zeilen?** Beides, aber begrenzt: echte
  Abhängigkeitsreduktion für die 9 Subsysteme (Import-Scan), Model-Ökonomie für bounded Lanes,
  und die Pin-Span-Maschinerie macht Modul-Checks statt Text-Nadeln. Die Kern-Kopplung der
  verbleibenden 19,9k ist unangetastet (Aufrufstellen bleiben Kern, F3).
- **Kern ≤ 8.000 / P4/P5-Vollsplit / Freeze / dreifache Suite-Kette?** Kern-Ziel: ersetzen
  (F1). P4-Vollsplit: beenden nach proc.ts (F3). P5 als Kampagne: streichen, JIT (F2). Freeze:
  durch Fenster je Slice ersetzen — die Praxis ist längst so (F2). Suite-Kette: die
  Check-Ebene-Regel + bedingte Vorschau + Remote-Audits sind richtig und bleiben; die dreifache
  serielle Lokal-Kette als P7-Beweis ist vertretbar (einmalig, ~90 min), sollte aber remote
  vorlokalisiert werden, sobald `fails[]`-Qualität bewiesen ist.
- **Ist es falsch, Funktionsfehler und Zusammenarbeit bis P6 aufzuschieben?** Für die
  Sensor-Fehler (B-01/B-02/B-11) und B-12: **ja, falsch** — sie sind Voraussetzung der eigenen
  Beweiskette (F4). Für Land-Pfad-Korrektheit (B-06/B-07/B-09): falsch, sie priorisiert zu
  gehören, nicht aufgeschoben — der Architektur-Review hatte die Land-Spine als den Ort benannt,
  an dem Risiko konzentriert werden darf; dort stehen jetzt gemessene Defekte. Für den Rest des
  B-Programms (Zusammenarbeit, Welle 1 zuerst) gilt die Denksession-Ordnung weiter — aber sie
  sollte nicht hinter P7 zurückfallen, sondern mit dem Rest der Sanierung um die knappe
  Kapazität konkurrieren dürfen.

### Gegenposition — Risiken beim Abbruch (geprüft)

1. **Model-Ökonomie bleibt kaputt**: server.ts ≈ 24k Z. braucht weiter claude-1M-Lanes; sol/
   glm bekommen nur Randarbeit. Realer, laufender Kostentreiber. **Milderung:** types.ts +
  Blatt-Muster erlauben JIT-Extraktion je Feature — die Fähigkeit bleibt, nur der Rhythmus
  wechselt.
2. **11 geshelvte Code-Lanes sind nach dem Split unrebasebar** (plan P0-Ernteprotokoll) — ihr
   Wert ist P6-Reimplementierungs-Referenz. Abbruch ändert daran nichts (schon eingetreten);
   Weiterlaufen verschiebt die Referenzen nur weiter von main weg.
3. **Halber Zustand als Dauerzustand**: kein Risiko im Eigenbau — die Module sind additive
   Blätter, letzte volle Kette + Audit + Deploy + Health grün (HANDOFF.md §2); jeder
   Stopp-Punkt ist konsistent. Das ist die stärkste Abbruch-Reserve: der Plan ist von Anfang an
   rückrollbar und slicing-förmig gebaut; RESCOPE kostet keine Aufräum-Lane.
4. **Owner-Auftrag war „komplett aufräumen"**: Der Vollsplit war Plan-Konstruktion, nicht
   Owner-Wortlaut („jede Datei gesäubert, Funktionen erhalten"). Ein neu verhandeltes Ziel braucht
   den Owner — aber genau dieses Tor steht ohnehin offen (F1) und ist schon dreimal gestorben
   (B-12).

### Minimaler Ersatzplan (mit Stop-Regeln)

- **E1 — zuerst die Sensoren:** B-01/B-02 (Fail-Namen auf beiden Pfaden) + B-11
  (Rotationsfenster) als EINE benannte Freeze-Ausnahme-Lane, Falsifier: die nächste rote
  Audit-Zeile trägt Namen. B-12-Mitigation: Owner-Tore zusätzlich als getrackte Doc-Zeile +
  Queue-Zeile, nie nur als Attention.
- **E2 — P4 geordnet beenden:** proc.ts-Mini-Slice (~100 Z., zahlt doppelt: Verify-Gate
  mitbenutzt `retainRunOutput`), danach Queue-Slice nur in Form (2) und nur wenn der Owner
  Erfolgsmaß 1 neu verhandelt hat. Tier 3/4 als Kampagne streichen → JIT-Blattschnitt bei
  nächster Berührung des jeweiligen Subsystems.
- **E3 — P5 streichen als Kampagne**; client.ts nur opportunistisch modularisieren, solange
  Fremdarbeit 3,3:1 wächst. (Alternativ: erst Welle 1 des B-Programms — B2/B3 — dann
  client-berührende Arbeit wird ohnehin billiger.)
- **E4 — Freeze durch Fenster ersetzen**: Dispatcher-Master-Stop bleibt bis zum
  B10-Wächter-Fakt; Feature-Lands laufen weiter, Split-Slices bekommen ihre stillen Fenster wie
  gehabt.
- **E5 — P6-Register triagieren, nicht verschieben**: Land-Pfad-Fehler (B-06/B-07/B-09) werden
  produkt-prioritäre Zeilen mit eigenem Kriterium; der Rest bleibt Register mit Disposition am
  Schluss.
- **E6 — P7 mit neuem Zielbild schließen**: „Kern stabil < ~20k, kein Modul > 2.000,
  Blatt-Invariante für alle server/*, Kommentaranteil trendfallend" — messbar, erreichbar;
  Abschlussmessung Check-Ebene-Regel, Remote vorlokal.
- **Stop-Regeln:** (i) Zwei aufeinanderfolgende Slices brauchen je einen Vor-Slice → Splitting
  ganz stoppen (Blatt-Wand bestätigt). (ii) server.ts wächst über ein 7-Tage-Fenster netto,
  obwohl ein Split-Slice landete → Kampagnenform gescheitert, nur noch JIT. (iii) Nach E1 fällt
  eine rote Suite ohne Namen → erst Sensor reparieren, keine weitere Struktur-Lane. (iv) Owner
  antwortet auf das Ziel-Tor zweimal nicht → Programm mit Ist-Stand und neuem Vorschlag
  schließen statt weiterlaufen lassen.

### Nicht geprüfte Flächen

- Live-Zustand des Servers, Slots, Queue-Zeilen, Attention-Status (kein API-Agriff; nur git,
  docs, Ledger-Zitate).
- Keine Suite gefahren, kein tsc/build-Rerun (letzter voller Beweis: Land `f606e75`,
  `verify.ok true`, 103 s — HANDOFF.md:12-14; HEAD `8dffa85` liegt darüber mit docs-only
  Commits, ungeprüft von mir).
- Modul-Inhalte zeilenweise nur an Importen/Commits geprüft, nicht vollständig gelesen.
- Flake-Register/verify-tiering nur aus zitierten Dokumenten, nicht am Trail verifiziert.
- Die Doku-Zeilen-Zähler enthalten Fremdprogramme (Studio, Denksession) — als Obergrenze
  benannt, nicht als reine Sanierungskosten.
- Owner-Erwartungen jenseits der zitierten Dokumente sind für mich nicht zugänglich.
