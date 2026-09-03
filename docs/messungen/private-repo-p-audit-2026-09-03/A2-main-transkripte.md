# Strang A2 — Was die MAIN tat, womit sie ihren Kontext füllte, was sie durchwinkte

Quellen: Turn-Index über die drei MAIN-Transkripte (`work-A2/det-*.tsv`, aus `message.content[]`;
Zeiten CEST), `ios-tasks.md`, `ios-programs.json`, `founding-brief-program-main.txt`,
`/Users/owner/private-repo-p/{AGENTS.md,docs/PRODUCT.md,HANDOFF.md}`, `ios-attention.json`.

## Was der Lauf geleistet hat

Die MAIN war kein Durchwinker. Sie hat **vor jedem einzelnen Land den echten Lane-Diff gelesen**
(N1 00:17/04:08/06:24, N1.5 10:01/12:07/13:54, N2 15:28) und **den Gate-String `sh scripts/verify.sh`
in 19 Fällen selbst gefahren**, statt dem Worker-Report zu glauben — genau die Rail-Vorgabe „treat an
arriving report as a CLAIM". Sie hat drei Gate-Löcher selbst repariert (bash-Re-Exec unter `sh`
`ebcea19`, Lease-Queue statt Gate-Fail, Toggle-Race `b5c62cd`), einen unabhängigen Codex-Review
beauftragt, dessen vier Befunde reparieren lassen und den FAIL-Receipt trotzdem gelandet. Die acht
Briefs (`ios-tasks.md`) sind ungewöhnlich gut: jeder nennt Repo+main-SHA, Lesepflicht mit
Abschnittsnamen, nummerierte Dateiliste, Testliste, den wörtlichen Gate-String mit Zeitbudget und
eine Report-Form („Report only: …"). Der Selbstbefund `9f65abf1` (12:38) ist eine ehrliche
Eigenmessung mit genau EINEM vorgeschlagenen Schnitt. Das ist deutlich über dem Private-repo-o-Niveau.

---

## 1. Kontext-Anatomie

| | Dauer | Tool-Result-Bytes | kB/h | Tool-Calls/h | Anteil PNG |
|---|---|---|---|---|---|
| N1 `0def056c` | 11,3 h | 1,79 MB | 159 | 12,2 | **72 %** |
| N1.5 `f18befeb` | 5,4 h | 3,29 MB | **606** | 25,8 | **89 %** |
| N2 `08d0bfa4` | 21,4 h | 1,19 MB | 56 | 6,4 | **79 %** |

**Befund: 13 Screenshot-Reads tragen ~5,2 MB = ~80 % aller Tool-Result-Bytes der drei Sessions.**
Ein Simulator-Screenshot kostet 0,3–0,68 MB als base64-Block; die drei teuersten Einzelposten sind
`brief-3-privacy-block.png` 677 kB (N1.5 10:01), `frame.png` 664 kB (N2 17:27) und ein
xcresult-Attachment 668 kB (N1.5 14:17).

Verteilung nach Tool-Call-Kategorie (Anteil der Calls):

| | fleet-api | hostload | lane-diff | verify | repo-read | write | wait |
|---|---|---|---|---|---|---|---|
| N1 | 28 % | 6 % | 10 % | 7 % | 10 % | 7 % | 2 % |
| N1.5 | 32 % | 14 % | 6 % | 5 % | 17 % | 6 % | 1 % |
| N2 | 30 % | 18 % | 5 % | 0 % | 8 % | 15 % | 0 % |

Bestellt vs. selbst gewählt: `fleet-api` (30 %) ist Rail-Pflicht (Projektion, release, land, watch,
ack). `hostload` (6 → 18 %) ist **komplett selbst gewählt** — `uptime`/`pgrep`/Lease-Check als
Ersatz für einen fehlenden Sensor. Die Rail sagt „wait WITHOUT WATCHING … do not loop on the
projection" (`founding-brief-program-main.txt:90-93`); die MAIN hat trotzdem State-Waiter gebaut
(`for i in $(seq 1 60)` auf main-sha + lane `latest.log`), und zwar **begründet**: der Merge-Watch
lieferte nach einem verbrauchten Feuern ein zweites Verdikt still (HANDOFF.md §Succession). Das ist
kein Rail-Bruch aus Ungeduld, sondern ein dokumentierter Workaround gegen einen kaputten Rückkanal.

## 2. Zerlegung Product Card → Briefs 1–7, 9

Was ankam: Golden Cases 1–5 sind **namentlich** in Brief 1 (Fixtures GC2/GC3), Brief 2 (GC1 vier
Felder), Brief 3a (GC2/GC3), Brief 3b (GC4/GC5) und Brief 4 (Report über alle fünf) verteilt; die
Renderer-Regel steht wörtlich in Brief 2 Punkt 2; die Datenschutzgrenze in Brief 3b Punkt 7; die vier
ALL-PASS-Tails aus `docs/PRODUCT.md:340-352` in Brief 4 und Brief 7. Jeder Brief trägt ein hartes
Done-Kriterium (exakter Tail + exit 0 + Zeitbudget) und einen Beweisweg (benannte Log-/PNG-/JSON-Pfade
unter `artifacts/`). Das ist sauber.

**K2 (Vertrag existiert, kommt im Brief nicht an), gemessen:** In allen acht Auftrags-Briefs kommen
die Wörter *visual, coherence, design, typography, Dynamic Type, dark mode, spacing, layout,
Bedienung, polish* **null Mal** vor (`grep` über `ios-tasks.md`, pro Task-Block gezählt).
`AGENTS.md:5` verlangt aber wörtlich „Product quality, interaction, accessibility, and visual
coherence are part of the slice; a green compile alone is never a usable-app claim." Von diesem Satz
überlebt in den Briefs genau eine Hälfte einer Hälfte: `performAccessibilityAudit` (4×) und
„accessibility identifier" (1×) — Accessibility ist als **Test-API** angekommen, nicht als
Anspruch; Qualität, Interaktion und visuelle Kohärenz sind **gar nicht** angekommen.

Zweites K2: `docs/PRODUCT.md:353-355` sagt selbst „Simulator-Playability braucht zusätzlich den
frischen beobachteten Lauf …; die vier Tails allein beweisen keine Nutzbarkeit." Der einzige Brief,
der das eingelöst hätte — Brief 8, die Computer-Use-Fahrt — wurde am 17:06 als Notiz `f39265ee`
**ausformuliert und bewusst NICHT gefilet**: „File it only after Brief 7 returns ALL-PASS". Brief 7
kam RED zurück. Damit ist der einzige Nutzbarkeitsbeweis hinter eine Review-Kette serialisiert
worden, die scheiterte — und ist bis heute nicht gelaufen.

## 3. Annahme-Entscheide

Jeder Land war belegt: Diff gelesen + Gate-Log der Lane gegen die Datei-mtimes geprüft (N2 15:28:
„File mtimes prove the gate ran on exactly the committed tree"). **Eine Ausnahme, selbst genannt:**
bei Brief 6 (15:28) „**I skipped my own pre-land gate run** to use the quiet window" — genau der Land,
der dann RED zurückkam und eine MAIN-Reparatur brauchte.

**Die Codex-Feststellung ist am Transkript belegt.** N2, 09-02 15:28, Thinking-Block direkt vor dem
Land-POST: *„All four findings are genuinely fixed … worth flagging that the one-demand-per-kind rule
**intentionally** rejects duplicate constraint types even when both are satisfiable."* Die MAIN hat
die Semantik also GESEHEN, sie als Absicht gedeutet (die Begründung steht als Kommentar im Code) und
gelandet. Brief 7 nennt exakt das als HIGH-Finding: `min 80, min 120, max 160` ist erfüllbar und wird
abgelehnt. Kette: Kommentar behauptet Prämisse → MAIN liest Kommentar statt Erfüllbarkeitsprobe → 1
Regression auf main + 1 Reparaturrunde (Brief 9, bis heute nicht dispatcht).

**Die akzeptierte Brief-6-Abweichung (`validationRefs`)** wurde am **09-02 15:28** angenommen, im
selben Turn wie das Land, mit der Begründung „I accept it as the only consistent reading" — das
geschlossene Schema verbietet ein leeres `validationRefs`-Array, die wörtliche Brief-Vorgabe wäre
unerfüllbar. Dokumentiert in `docs/PROOF.md` und an den Owner weitergegeben (17:39, „bewusste
Abweichung … genau die Art Entscheidung, die du im Review sehen solltest"). Brief 7 hält sie
trotzdem für falsch: die Abweichung schließt Finding 2 nicht, weil `DemoRun.runCase` für stop/escalate
auf den deklarierten Status schaltet und `statusMatches` damit nicht fallen kann. HANDOFF.md notiert
selbst: „The reviewer's judgement was better."

## 4. Hat die MAIN die App je gesehen oder bedient?

**Bedient: nie.** Kein einziger Tap, kein `simctl io … tap`. Die MAIN hat den Simulator ausschließlich
verwaltet (`shutdown`, `list devices`, Lease-Lock) und Tests gefahren.

**Gesehen: 13 Bilder, keines zur Produktbeurteilung.**
- 09-02 04:11 `brief-2-orientation.png` — Prüfzweck: „the screenshot confirms the four-part unsuitable
  answer with no project" (Existenzprüfung gegen den Brief).
- 09-02 04:21 `review/launch.png`, 06:24 `brief-3a-demo.png`, 10:01 `brief-3-privacy-block.png`,
  12:07 `brief-4-export.png` — dieselbe Rolle.
- 09-02 14:08 und 14:17 sechs xcresult-Attachments (~1,75 MB, der teuerste Block des ganzen Laufs) —
  Zweck war **Flake-Diagnose an einem Contrast-Audit**, Ergebnis: „I'll revert my restoration to keep
  the gate deterministic". Der teuerste Kontextposten des Laufs wurde ausgegeben, um eine
  Accessibility-Prüfung wieder zu entfernen.
- 09-02 17:27 `frame.png` (t=95 s) und `frame2.png` (t=150 s) aus dem Video — Zweck wörtlich: „Ich
  prüfe kurz, ob wirklich Bild drauf ist." / „Echtes Bild, echter Screen." Also Integritätsprüfung der
  Datei, keine Produktbeurteilung.

**Der Video-Auftrag (17:21).** Die MAIN antwortete in 60 s mit „Ich baue die App und nehme die
UI-Tests als Videotour auf", schrieb `record.sh` (`build-for-testing` + `test-without-building` über
`Private-repo-yUITests` unter `xcrun simctl io <udid> recordVideo`), lieferte 134 s Aufnahme um 17:29
über einen selbstgeschriebenen range-fähigen Server (Python-Standardserver sendet kein
`Accept-Ranges`, Safari spielt dann nicht). Die Begründung steht in HANDOFF.md wörtlich: **„Recording
the existing UI suite is the cheapest honest product tour: no new test code, and every frame is a
screen the gate already asserts."** Das ist konsistent und ehrlich — und genau deshalb sieht der Owner
im Video die *Testabdeckung*, nicht die *Bedienbarkeit*: eine XCUITest-Fahrt tippt in Maschinentempo
durch Pfade, die das Gate ohnehin behauptet, und zeigt per Konstruktion keinen Screen, der nicht
schon assertiert ist. Das freie Bedienen wäre Brief 8 gewesen (siehe §2).

## 5. Umgang mit dem Program-Vertrag

Der `successCriterion` (`ios-programs.json`) ist ein Absatz mit ~15 UND-verknüpften Bedingungen, von
denen mindestens vier strukturell unerfüllbar sind:

| Widerspruch | Gegenbeleg im selben Record | MAIN-Reaktion |
|---|---|---|
| „Tokenverbrauch und Kosten … Erst diese Messung entscheidet, ob 2,99 Euro drei oder fünf" | `openQuestions`: „Credential, Live-Kosten und externer Providerlauf bleiben Owner-Akte" | **umgangen, aber sauber**: Brief 4 macht `undecidable` zum erstklassigen Report-Wert („refuses to invent zeros"). An den Owner erst 17:39 als „ehrlich unentscheidbar". |
| „Ein Fleet-Codex-Worker bedient den Build per Computer Use" | `openQuestions`: „**Kann** eine Fleet-Codex-Lane … per Computer Use zuverlässig bedienen? **Vor Produktimplementation messen**" | als Auftrag gelesen (Brief 8 gebaut), nie gemessen, nie gefilet |
| „Land-Gate und Post-Land-Audit sind grün" | Audit für private-repo-p ist 9/9 `unknown` (exit 42/127) | **erkannt und still abgehakt**: HANDOFF.md „always reports `unknown` here … acknowledge and move on" |
| „kein Build-Task startet, solange der rote Audit auf MAIN `bc9e7de` ungeklärt ist" | betrifft das Fleet-Repo, nicht private-repo-p | ignoriert (korrekt, aber unkommentiert) |

**Keiner dieser vier Widersprüche ging als Frage an den Owner.** Von 10 Attention-Requests
(`ios-attention.json`) sind **9 reine Fleet-Mechanik** (Hand-Dispatch 5×, Verify-Budget, Hostlast,
Succession 2×) und einer ein Audit-Urteil. **Produkt- oder Vertragsfragen: null.**

## 6. Fleet-Mechanik-Anteil

`fleet-api` + `hostload` = **34 % / 46 % / 48 %** der Tool-Calls (N1/N1.5/N2) — der Anteil wächst
monoton über die drei Sessions. Bytemäßig ist es billig (~70–90 kB/Session), turn-mäßig teuer.
Konkrete Posten: 5 Hand-Dispatch-Attentions für 5 Lanes (jede Lane brauchte einen Owner-Round-Trip,
Brief 7 lag dadurch 2,5 h), 26 `program-execution`-Abrufe (58 kB), 16 `self/watch`-POSTs plus
selbstgebaute State-Waiter, weil ein gefeuerter Watch nicht re-armbar ist.

Gegenprobe der Notiz `9f65abf1` („53 Turns, 14 entscheiden"): plausibel und eher zu günstig gerechnet.
Sie zählt Turns der letzten 20, nicht der Session; über N1.5 gemessen sind 45 von 140 Tool-Calls
(32 %) fleet-api und 20 (14 %) hostload — der von ihr genannte Schnitt (`GET /api/self/tasks/<id>`)
adressiert nur die 5 unauthorized-Probes, **nicht** die 20 Hostlast-Calls und nicht die
5 Dispatch-Round-Trips, die zusammen deutlich teurer waren.

## 7. Nachfolgen N1 → N1.5 → N2

Gut: die Erdung ist billig und kurz (N1.5 13 Calls / 70 s, N2 10 Calls / 90 s bis zur ersten Handlung;
beide `cat AGENTS.md` → git → HANDOFF → `program-execution`). Die Handoffs transportieren echte
Mechanik-Lehren, und N2 wiederholt die 5 unauthorized-Routen-Probes von N1.5 **nicht** — die Lehre kam
an.

Verloren/dupliziert: (a) N1 hatte 04:12 nach `brief-2-orientation.png` eine ausformulierte
„Product fidelity"-Beurteilung geschrieben; ab N1.5 taucht diese Kategorie in keinem Land-Bericht mehr
auf — die Nachfolgerin erbte den Gate-Zustand, nicht den Produktblick. (b) `scripts/verify.sh` wurde
in jeder Session neu und ganz gelesen (N1 21:47, N1.5 09:04 + 10:14 + 12:15, N2 über die Lane-Logs).
(c) Der Widerspruchs-Befund aus §5 steht in KEINEM der drei Handoffs als offene Frage — nur die
Preisfrage schaffte es, und die erst nach der Owner-Berührung.

---

## Gerankte Befunde

**A2-1 — Der Gründungsvertrag der MAIN ist ein Landing-Pipeline-Vertrag ohne Produktseite.**
`founding-brief-program-main.txt` hat 105 Zeilen: file → release → wait → verify claim → land → watch
→ ack. Produktqualität kommt darin nicht vor; sie hängt an einer einzigen Nebensatzklausel
(`AGENTS.md:5`). Mechanismus: was der Vertrag nicht als Loop-Schritt führt, wird nicht zerlegt →
kommt nicht in den Brief → hat kein Done-Kriterium → wird nie geprüft. Kosten gemessen: 0 von 8
Briefs mit einem Interaktions- oder Kohärenz-Kriterium; 48 % der Turns der letzten Session in
Fleet-Mechanik. Das ist die Wurzel der Owner-Wahrnehmung „weit unter dem was möglich wäre".

**A2-2 — Der einzige Nutzbarkeitsbeweis war hinter eine Review-Kette serialisiert.** Die Card sagt
selbst, dass die vier Tails keine Nutzbarkeit beweisen; Brief 8 (Computer-Use-Fahrt) war fertig
formuliert, aber an „nach ALL-PASS von Brief 7" gebunden. Brief 7 kam RED → Brief 9 nötig → nicht
dispatcht → Brief 8 nie. Kosten: der Owner sah eine Testaufzeichnung statt einer Bedienung, und die
Nutzbarkeit ist bis heute ungemessen. Ein Nutzbarkeitsbeweis muss **parallel** laufen, nicht am Ende
einer Kette.

**A2-3 — ~80 % des MAIN-Kontexts sind Screenshot-Bytes, und keiner davon wurde für Produkturteil
ausgegeben.** 13 Reads = ~5,2 MB. N1.5 verbrannte 606 kB/h und musste nach 5,4 h bei 32 % ctx
nachfolgen; der teuerste Block (1,75 MB, 14:08–14:17) diente dazu, ein flakendes Contrast-Audit zu
ENTFERNEN. Mechanismus: `Read` auf ein PNG legt das volle base64-Bild in den Kontext, dauerhaft.
Kosten je Bild: ~0,5 MB ≈ mehrere Kontextprozente, wiederkehrend bei jedem Folge-Turn.

**A2-4 — Der `successCriterion` ist ein unerfüllbares Konjunkt, und niemand hat das als Vertragsfehler
zurückgemeldet.** Vier strukturell unerreichbare Bedingungen (Kostenmessung ohne erlaubten
Provider-Aufruf · Computer-Use als Kriterium UND als offene Frage · „Post-Land-Audit grün" in einem
Repo, wo er per Konstruktion `unknown` ist · ein Fleet-Repo-Gate im ios-Vertrag). Die MAIN hat drei
davon still umgangen und einen still abgehakt. Kosten beim nächsten Lauf: ein Program, dessen
Erfolgskriterium nie „erfüllt" sagen kann, hat keinen definierten Endpunkt — der Lauf endet, wenn der
Owner hinsieht, nicht wenn er fertig ist.

**A2-5 — Der Prämissen-Kommentar als Beweisersatz.** N2 15:28 wörtlich im Thinking: die Regel lehne
„intentionally" auch erfüllbare Paare ab. Der Kommentar im Code behauptete das, eine
Erfüllbarkeitsprobe hätte es widerlegt. Kosten: eine Regression auf main, ein RED-Re-Review, eine
offene Reparatur (Brief 9). Mechanismus verallgemeinert: die MAIN prüft Diff und Gate-Ausgabe
(mechanisch), aber Semantik prüft sie durch Lesen — und Lesen glaubt Kommentaren.

--- Schnittlinie ---

Darunter, nicht ausgeführt: der übersprungene Pre-Land-Gate-Lauf bei Brief 6 (kostete eine
Reparaturrunde, war aber ein bewusster, benannter Trade gegen ein Hostlast-Fenster); die 26
`program-execution`-Abrufe (58 kB, billig); die dreifache `verify.sh`-Volllektüre pro Session.

## Verifiziert / Abgeleitet / Nicht geprüft

**Verifiziert** (aus Werkzeugausgabe): alle Byte-/Call-/Prozentzahlen der §1-Tabellen
(`work-A2/det-*.tsv`, `idx.py`/`det.py`); Null-Treffer für Design-/Visual-Vokabular in allen
Auftrags-Briefs; 13 PNG-Reads mit Pfad und Zeitstempel; die zitierten Transkript-Passagen (15:28
Thinking, 17:21–17:29 Videokette, 14:09 Revert, 04:12 Product-fidelity); 10 Attentions mit Kind und
Inhalt; `AGENTS.md:5`, `docs/PRODUCT.md:340-355`, `successCriterion` und `openQuestions` wörtlich;
HANDOFF.md-Aussagen zu Brief 6/7.

**Abgeleitet**: dass die Screenshot-Bytes ≈ Kontextprozente sind (die ctx-Werte 43/32 % stammen aus
dem gemeinsamen Brief, nicht aus meiner Messung); die Zuordnung „hostload = selbst gewählt" (aus dem
Fehlen einer Rail-Zeile dazu); die Kausalkette A2-1 (Vertrag → Brief → fehlendes Kriterium).

**Nicht geprüft**: die sechs Lane-Transkripte (was die Worker aus den Briefs machten — Strang A3);
die zwei Codex-Rollouts im Original; das Video selbst über die zwei Frames hinaus; ob die
Screenshot-Reads technisch vermeidbar gewesen wären (z. B. verkleinert); der Product-Card-Akt
`b0ad8a79` (MAIN N0, anderes Transkript).
