# HARVEST — ⚔ Autonomie-Critic (Opus 5, high) zu Abschnitt J, 2026-08-21

Pane-Bericht von Slot 12, geerntet durch ACP Architecture Controller II. UNTRACKED, PROPOSAL,
nicht normativ. Pruefgegenstand: docs/rollen-architektur-glm-2026-08-21.md J (655-785),
sha256-Praefix fd97c06abce2f4ef, HEAD 0c176ee. Keine Suite gefahren.

  ⚔ Autonomie-Critic — Bericht zu Abschnitt J (Zeilen 655–785), HEAD 0c176ee

  Vorbemerkung zur Beweislage: ich habe alle vier vom Auftraggeber genannten Messungen nachgezogen (Ergebnis je Befund vermerkt) plus 21 der [gemessen]-Marken in J. Der graphify-Hook forderte
  dreimal graphify query — ich habe ihn dreimal übergangen, weil der Brief graph.json als veraltet belegt (releaseTask dort auf L2181, real :2262). Alles unten steht auf sed/rg/fleet.json.

  ---

  1. Der von J.1 SPEZIFIZIERTE Start umgeht jedes Gate, das J.1 als seine Grenze nennt — inklusive des Master-Stops des Owners. CONFIRMED

  Behauptung: J.1 nennt als Start-Naht wörtlich dispatchTask(t, free, false, false, {harness, model, effort}). Diese Funktion enthält keines der fünf unattended Gates. Alle fünf leben in
  tickDispatch, dem heutigen einzigen unattended Aufrufer.

  Beleg: dispatchTask server.ts:6093–6111 prüft genau drei Dinge: kind === "auftrag" (:6099), den Harness-Bolt (:6107), den In-Flight-Lock (:6110). Die Gates liegen im Aufrufer: Master-Stop
  dispatchOn :6928 · Serialität „one lane per tick" :6920 · DISPATCH_MAX_LANES je Repo :6958 · die unattended Analyse-Pflicht :6981–:6999 · die Kollisionslesung :7000ff. J.1s Grenzen (4) („die
  unattended Analyse-Pflicht bleibt unangetastet … darf kein Gate des Ticks umgehen") und (5) (DISPATCH_MAX_LANES) sind damit Eigenschaften eines Aufrufers, den J durch einen neuen ersetzt.

  Verschärfend: :6103–:6105, die Stelle die J zustimmend zitiert, sagt, der Bolt sei die Absicherung „for the case the absence cannot cover: a future unattended caller that does pass one" —
  der Code-Autor hat für genau diesen künftigen Aufrufer ein Gate vorgesehen, nicht den Block. Und :18563–:18565 sagt über die attended Route explizit: „Independent of dispatchOn … and NOT
  bound by DISPATCH_MAX_LANES — the cap bounds UNATTENDED fan-out, and this is an attended click." J.1s Naht erbt die Freiheit des attended Klicks für einen unattended Prinzipal.

  Fehlerszenario: Live steht "dispatch": false in fleet.json — der Tick ist AUS. Eine gebundene MAIN ruft die neue Self-Route. dispatchTask startet die Lane. Der Master-Stop des Owners hat
  nichts gestoppt; keine Analyse wurde gelesen; der Lane-Deckel wurde nicht gezählt. Bei n gebundenen MAINs (live 3 mit gültiger Bindung) laufen n Starts parallel — die Serialität war eine
  Eigenschaft von dispatchBusy.

  Kosten: Der Aus-Schalter des Owners (Klasse C: „externe Wirkung", der einzige Not-Halt der Flotte) wird stillschweigend Klasse A. Der Text von J.4-2 behauptet das Gegenteil („die Zeile
  startet nur durch dieselben unattended Gates wie heute") — d.h. der Entwurf widerspricht sich intern, und der Widerspruch löst sich zugunsten von OFFEN auf, weil J.1 die Implementierung
  nennt und J.4 nur die Zusage.

  Abhilfe — Klasse: falsche Autoritätsgrenze → Program-/Rollen-Vertrag. Die MAIN released, der Tick startet. Punkt. Dann sind (4) und (5) durch Konstruktion wahr statt durch Zusage, und die
  Fähigkeit ist echt kleiner statt nur behaupteter Weise gedeckelt. Billigere Klassen scheiden aus: es fehlt kein Wissen (Brief/Pack), die Handlung ist auffindbar (Capability), es ist kein
  Urteilsfehler — es ist eine falsch gezogene Grenze im Entwurf selbst. Keine neue Regel, keine Freigabestufe: eine gestrichene Zeile. Der Preis (bei dispatch:false startet nichts) ist ein
  Sensor-Problem, nicht ein Autoritätsproblem: dispatchOn steht heute nur auf /api/config :17063 (Owner-Tier) — es gehört auf GET /api/self, sonst wartet eine MAIN blind auf eine Schlange, die
  nie läuft.

  ---

  2. Die Autoritätswurzel, die J zur Bedingung erhebt, ist LIVE bereits zu 75 % kaputt — und die Ursache ist weder .find noch sessionId. CONFIRMED (live gemessen)

  Behauptung: program.main wird an genau zwei Stellen geschrieben und nirgends je gelöscht oder repariert. Es veraltet still, sobald der Slot neu geöffnet wird, und bootstrapProgramMain
  verweigert danach dauerhaft eine Neubindung.

  Beleg: Schreibstellen server.ts:13574 (Succession) und :13680 (Bootstrap) — rg 'program\.main\s*=' liefert nur diese zwei; keine Löschstelle existiert. :13619–:13623: bei vorhandenem
  program.main, dessen Occupant nicht mehr openedAt-gleich ist, 409 stale Program-MAIN binding. Live-Messung gegen fleet.json: 13 aktive Programme, 12 mit Bindung — bei 9 stimmt schon openedAt
  nicht mehr (z. B. 6ae9fac6 „Private-repo-e" bindet Slot 2 @1786953209598, Slot 2 lebt @1787317670922). Nur 3 Bindungen (eeba7c04, a6d7f091, a68bdac5) sind intakt. sessionId-Mismatch tritt in
  genau denselben 9 Fällen auf und ist damit nicht die erste Ursache — er ist nachgelagert.

  Fehlerszenario: Owner bestätigt Program P, MAIN läuft auf Slot 3. Der Slot wird neu geöffnet (restart, kill+open, Pane-Heal). Ab da: boundProgramForMain → null, jede Hüllen-Fähigkeit 409;
  POST .../main → 409 stale; supervisorNudge → 409 „occupant is gone or was replaced" (:13466), ohne Zeile (siehe Befund 6). Das Program ist ein aktiver Datensatz ohne erreichbare Session und
  ohne Rückweg. Genau das ist heute bei 9 von 13 aktiven Programmen der Zustand.

  Kosten: J erklärt die Bindung zur „Autoritätswurzel" und nennt als Inbetriebnahme-Bedingung zwei Defekte, von denen der eine (.find-Mehrdeutigkeit) heute unerreichbar ist (gemessen: null
  Duplikate über (slot, openedAt) bei allen aktiven Programmen) und der andere (sessionId) nur die zweite Hälfte des realen Fehlers trifft. Wer J.2 wörtlich abarbeitet, hat danach eine Wurzel
  gehärtet, die in 75 % der Live-Fälle gar nicht erst existiert.

  Abhilfe — Klasse: unbeobachtbar → Sensor/Receipt, vor jeder Vertragsänderung. GET /api/programs liefert main heute roh; es muss die abgeleitete Wahrheit mitliefern (bound: true|false,
  staleSince), damit „aktives Program ohne MAIN" ein sichtbarer Zustand ist statt eines 409 an fünf verschiedenen Türen. Erst danach ist die zweite Klasse fällig — Program-/Rollen-Vertrag:
  eine stale Bindung ist nicht 409-würdig, sie ist leer; bootstrapProgramMain muss sie überschreiben dürfen (der Occupant-Test steht bereits eine Zeile darüber). Brief/Pack scheidet aus (kein
  Wissensproblem), Capability scheidet aus (die Route existiert und antwortet), Routing/Urteil sind irrelevant. Keine neue Regel, keine Stufe.

  ---

  3. propose_task setzt repo:null, Program hat kein Repo-Feld — jede Program-Task landet im Fleet-Repo. CONFIRMED (Code) / INFERRED (Folge, da die Route unbaut ist)

  Behauptung: Der Program-Scope, an dem J alle Grenzen aufhängt, benennt kein Repository. Die daraus erzeugte Task auch nicht. Beim Start entscheidet ein globaler Env-Default, in welchem Baum
  die Lane spawnt.

  Beleg: interface Program server.ts:1927–1944 — Felder: id, title, intent, successCriterion, nonGoals, decisions, evidence, openQuestions, status, createdAt, proposedBy, main, …; kein repo.
  Live bestätigt: repo fehlt in allen 36 Program-Objekten in fleet.json. Der Entwurf selbst pinnt repo:null (Zeile 132 und 290, „gleiche Form wie Steward-Route :16208–16254"; die Steward-Route
  setzt repo: null mit dem Kommentar „never body.repo — a steward text must not choose where a lane spawns", :16245). Beim Start: const repo = next.repo ?? DISPATCH_REPO (:6954),
  DISPATCH_REPO = process.env.FLEET_DISPATCH_REPO ?? "" (:2435), live FLEET_DISPATCH_REPO='$FLEET_DIR' (watchdog.sh) = claude-fleet selbst.

  Fehlerszenario: Die MAIN von 4aa0759a („Private-repo-c, zweiter Anlauf") legt eine Repair-Task an und released sie. t.programId stimmt, der Deckel hält, alle J.1-Grenzen sind grün — und die Lane
  spawnt einen Worktree in claude-fleet, der Kontrollebene. Live betrifft das 13 aktive Programme, davon mehrere sichtbar Nicht-Fleet-Projekte (Private-repo-c, Private-repo-g, Private-repo-e, GLM-Studio,
  Arcade-Bounties).

  Kosten: Das ist die Scope-Verletzung in Reinform — und J.1s sechs Grenzen sind sämtlich blind dafür, weil sie in programId und Repo sprechen, während die Zeile weder das eine noch das andere
  trägt. Zusätzlich kollabiert Grenze (5): DISPATCH_MAX_LANES zählt je Repo, also teilen sich alle 13 Programme einen Eimer von 2.

  Abhilfe — Klasse: Handlung nicht auffindbar → Capability/Adapter. Die Ableitung existiert schon und ist nur nicht zu Ende geführt: die Bindung trägt main.slot, der Slot trägt cwd.
  propose_task leitet repo aus dem cwd der bindenden MAIN ab — abgeleitet, nie aus dem Körper, exakt das Muster, das openAttention für programId schon fährt (:5706/:5742). Klasse
  „Program-/Rollen-Vertrag" wäre teurer (Feld am Program + Migration der 36 Zeilen) und liefert nichts, was die Ableitung nicht liefert. Brief/Pack, Routing, Sensor scheiden aus: kein
  Wissens-, kein Modell-, kein Beobachtungsproblem — die Angabe fehlt strukturell.

  ---

  4. J.3(a)s zentrale offene Frage steht auf einer falschen Messung: undo-land deckt DREI Lands, nicht eines. CONFIRMED

  Behauptung: „undo-land deckt genau EIN Land und nur bis zum naechsten [gemessen :17706, undoableFor :9873]" ist falsch. Der Undo-Speicher ist ein kontiguitätsgeprüfter Stack der Tiefe 3, der
  einzeln poppt.

  Beleg: const UNDO_STACK_MAX = 3 :9785; undoStack: Map<string, LandRecord[]> „repo toplevel → undoable lands, OLDEST FIRST" :9786; pushUndo :9811–:9828 prüft Kontiguität (top.mainAfter !==
  rec.mainBefore → dropUndo mit ausgeschriebenem Grund) und schiebt bei Überlauf mit dropUndo(repo, 1, "the undo stack keeps at most 3 lands"); die Route poppt genau eines: stack.pop(); //
  this land is undone; the one below it becomes the next ↩ :17740–:17742. Nach dem Reset steht main auf mainBefore(N) = mainAfter(N-1), womit der Gate :17724 für das nächst-tiefere Record
  erfüllt ist — die Kette ist real. undoableFor :9873 ist ein Board-Anzeige-Helfer („what the board needs to show/hide the undo button", :9871) und trägt die Behauptung nicht; :17706 ist eine
  Kommentarzeile. Beide [gemessen]-Marken zeigen auf Zeilen neben der Aussage.

  Kosten: J.3(a) macht daraus die schärfste offene semantische Grenze („Land N ist unerreichbar") und leitet daraus eine Owner-Entscheidung ab (Rate binden vs. undo für tot erklären). Der
  Owner entscheidet dann über ein Problem, das um Faktor 3 überzeichnet ist — und übersieht, dass das System die Rate bereits misst und protokolliert: undoDropped (:3040, im State exportiert)
  sagt, wie viele Lands aus dem Fenster gefallen sind und warum, in Klartext (:17715–:17719, „that land aged out of a 3-deep memory"). Anmerkung zur Provenienz: dieselbe falsche Zeile steht in
  CLAUDE.md (§Post-Land-Audit). J hat das Regelbuch abgeschrieben statt gemessen; die [gemessen]-Marke ist an dieser Stelle unverdient.

  Abhilfe — Klasse: unbeobachtbar → Sensor/Receipt (und keine neue Rate-Regel). Die Rate ist bereits gebunden (3) und bereits mit Beleg versehen (undoDropped). Was fehlt, ist die Zustellung:
  die Zahl steht im State, nicht dort, wo eine policy-autorisierte Landung sie lesen würde. Erst wenn ein dropUndo einer policy-autorisierten Landung nachweislich unbemerkt bleibt, wird die
  teurere Klasse fällig.

  ---

  5. Der 10er-Deckel ist eine geliehene Grenze: er deckelt eine Review-Kapazität, die es unter J nicht mehr gibt. CONFIRMED

  Behauptung: STEWARD_MAX_PENDING deckelt Owner-Lesearbeit. Unter J.1 liest der Owner nichts mehr. Die knappe Ressource wechselt, die Zahl nicht.

  Beleg: :2610 „max OPEN steward-filed pending tasks — a looping pulse must not flood the review buffer"; einziger Konsument :16235–:16236, zählt t.source === "steward" && t.status ===
  "pending", global, nicht je Program; Begründung im Kommentar :16233–:16234: „Review capacity is the binding constraint." Unter J werden dieselben Zeilen von der MAIN selbst released — es
  gibt keinen Review-Puffer. Die real bindende Ressource ist DISPATCH_MAX_LANES (live 2, watchdog.sh).

  Fehlerszenario: Die MAIN hält 10 offene Zeilen und released sie. Zwei laufen, acht warten. Sobald eine landet, rückt die nächste nach; die MAIN füllt auf 10 nach. Der „Deckel" ist damit kein
  Bestandsdeckel, sondern eine Nachfüllrate ohne Obergrenze — die insgesamt erzeugte Arbeit ist unbeschränkt, gedrosselt nur durch die Landegeschwindigkeit.

  Kosten: Die Zahl liest sich in J.1 wie die Autonomie-Grenze der Klasse B („begrenzte Ausführung/Ressourcen"). Sie bindet nichts. Der Owner bestätigt eine Hülle in dem Glauben, sie sei
  mengenmäßig eingezäunt, während der einzige wirksame Zaun eine Env-Variable in watchdog.sh ist, die J als Nebensatz führt.

  Abhilfe — Klasse: falsche Autoritätsgrenze → Program-/Rollen-Vertrag. Die Grenze wird in der Ressource ausgedrückt, die knapp ist: gleichzeitige Lanes je Program (die Zahl existiert bereits,
  sie muss nur je-Program statt je-Repo gezählt werden — slots.filter(inRepo) :6957 wird slots.filter(s => s.programId === p.id); programId wird bereits auf den Slot vererbt, :6164). Der
  10er-Deckel darf bleiben, aber als das, was er ist: ein Speicherlimit, keine Autonomie-Aussage. Sensor/Receipt scheidet aus (die Zahl ist sichtbar), Capability scheidet aus (die Zählung
  existiert) — es ist eine Vertragsformulierung, kein Mechanismus. Keine neue Stufe.

  ---

  6. releasedBy beantwortet zwei verschiedene Fragen mit einem Feld — Grenze (6) kann nicht leisten, was sie verspricht. CONFIRMED

  Behauptung: Der Stempel zählt, welche Lane unbeaufsichtigt LIEF, nicht welche Zeile die Maschine RELEASED hat. J.1(6) baut auf die zweite Lesart.

  Beleg: :6156 if (ownerAct) next.releasedBy = "owner"; mit dem Kommentar :6150–:6155: „Stamped OVER whatever the row carried: if an unattended promote released it and the owner then pressed ▸
  start, the lane that actually ran was attended, and a criterion counting unattended lanes must not have it." Der Code weiß das und hat sich für „Lanes" entschieden. J.1(6) will „damit die
  Zeile nie als Owner-Arbeit zaehlt" — die entgegengesetzte Frage.

  Zur ausdrücklichen Vorlage-Frage (vierte Schreibstelle): Es gibt vier queued-Schreibstellen: :2263 (releaseTask), :6303 (Requeue), :14413 (Boot-Reconcile), :18523 (POST /api/tasks mit
  queue:true). Der geerbte Satz „releaseTask ist die einzige Funktion, die pending→queued bewegt" trägt nicht — :18523 erzeugt die Zeile direkt als queued und war nie pending. Grenze (6) ist
  dadurch heute nicht verletzt: :18526 stempelt inline releasedBy:"owner", und die Route liegt über der Owner-Wand (:17000). Aber: der Kommentar von releaseTask (:2258–:2261) zählt nur zwei
  bewusste Nicht-Nutzer auf und kennt :18523 nicht — die Ausnahme wurde lokal am Fundort kommentiert statt an der Funktion. Die Invariante „ein Stempel je Release" wird also an vier Stellen
  per Konvention gehalten, nicht per Konstruktion, und J fügt eine fünfte hinzu.

  Fehlerszenario: Die MAIN released Zeile X (machine). Die Zeile wartet (Deckel/Analyse). Der Owner sieht sie und drückt ▸ start. :6156 überschreibt auf owner. Das Abbruchkriterium „wie viel
  hat die Maschine selbständig freigegeben" untercountet danach um genau die Zeilen, bei denen der Owner eingriff — also um die interessantesten.

  Kosten: Das Feld, mit dem die Autonomie-Hülle ex post gemessen werden soll, ist genau in den Grenzfällen blind, an denen sich Autonomie-Drift zeigt.

  Abhilfe — Klasse: unbeobachtbar → Sensor/Receipt. Zwei Fragen, zwei Fakten: releasedBy bleibt unverändert (die Lane-Frage, sie ist korrekt gebaut); die Release-Frage bekommt keinen zweiten
  Slot-Zustand, sondern eine Audit-Zeile — audit("task_release", slot, ${t.id}:machine) an der einen neuen Route. Das Audit-Ledger ist der bestehende Ex-post-Kanal; ein überschriebenes Feld
  hat kein Gedächtnis, eine angehängte Zeile schon. Program-/Rollen-Vertrag scheidet aus (die Grenze stimmt), Capability scheidet aus (die Handlung existiert).

  ---

  7. J.2s beide Korrekturen wirken gegeneinander, und ihre Dringlichkeit ist invertiert. CONFIRMED

  Behauptung: Korrektur (2) („slot+openedAt als Identität, sessionId nie gaten") vergrößert die Trefferbreite von .find und verschärft damit Defekt (1), den J als eigenständig behandelt.
  Zugleich ist Defekt (1) heute unerreichbar und Defekt (2) fail-closed, nicht fail-open — J benennt beide als „Defekte" gleichen Rangs.

  Beleg: boundProgramForMain :5706–:5709 konjungiert drei Terme (slot, openedAt, sessionId); der Wegfall des dritten kann die Treffermenge nur vergrößern. Live gemessen: über alle 13 aktiven
  Programme null Duplikate auf (slot, openedAt) — beide Schreibstellen (:13574, :13680) wählen einen freien Slot (slots.find(x => !x.cwd …), :13633/:13509), was ein frisches openedAt erzwingt;
  Defekt (1) ist damit heute nur über Hand-Edits an fleet.json erreichbar. Auf Slot 2 hängen allerdings vier aktive Programme mit verschiedenen openedAt — d. h. jede weitere Lockerung
  Richtung „slot-only" wäre sofort vierfach mehrdeutig. Richtung von Defekt (2): null !== uuid ⇒ boundProgramForMain liefert null ⇒ 409 ⇒ Fähigkeitsverlust, nie Fähigkeitsgewinn.

  Fehlerszenario (das echte, offene): Nicht Mehrdeutigkeit, sondern Wanderung. .find liest programs in Array-Reihenfolge und filtert auf status === "active". Fällt das zuerst gefundene Program
  auf complete, springt die Bindung derselben Session ohne Ereignis auf das nächste passende. Unter J heißt das: der Scope, in dem eine MAIN Tasks anlegt und startet, kann sich zwischen zwei
  Requests ändern, und die MAIN erfährt es nicht. Das ist die einzige fail-open-Richtung in J.2 und die einzige, die J nicht nennt.

  Kosten: Wer J.2 als Inbetriebnahme-Bedingung wörtlich abarbeitet, härtet zuerst den unerreichbaren Fall, entschärft dann versehentlich seine eigene Härtung und lässt die einzige offene
  Richtung stehen. Für Codex-MAINs kommt hinzu, dass der Owner-Entscheid vom 2026-08-08 („ab jetzt gpt-Modelle für alles") genau den Harness bevorzugt, dessen Bindung tickCodexRecovery :3675
  nachträglich zerreißt — CONFIRMED, live sichtbar an 4eada64c (harness pi-zai).

  Abhilfe — Klasse: falsche Autoritätsgrenze → Program-/Rollen-Vertrag. Eine Änderung, nicht zwei: boundProgramForMain bekommt dieselbe Form wie handleSelfSucceed :5197–:5200 — filter statt
  find, >1 ⇒ 409, sessionId berichtet statt gegated. Das ist bereits gebauter, bereits begründeter Code an anderer Stelle; die Übernahme ist eine Angleichung, keine neue Regel. Sensor/Receipt
  allein reicht hier nicht: eine wandernde Bindung ist keine Beobachtungslücke, sondern eine falsch geschriebene Autoritätsableitung.

  ---

  8. J.4: zwei Rückbauten sind echt, zwei kosmetisch, einer ist der beste Absatz des Dokuments

  Position: 1. Zaun-These fällt
  Urteil: kosmetisch
  Begründung: Der Satz fällt, die Abhängigkeit bleibt: J.1 ersetzt den Zaun durch „die C-Liste plus die existierenden Maschinen-Gates" — und Befund 1 zeigt, dass genau diese Gates von J.1s
  eigener Naht nicht durchlaufen werden. Die These wurde gestrichen, ihr Ersatz ist unbelegt.
  ────────────────────────────────────────
  Position: 2. Schnitt 1 „unverändert"
  Urteil: kosmetisch
  Begründung: Das Write-Set von Schnitt 1 ändert sich tatsächlich nicht, und sein Done-Kriterium (Zeile 298–302) bleibt wahr. Aber der Absatz, der Schnitt 1 als sicher ausweist — „Warum
  propose_task kein neues Start-Recht eroeffnet — der gemessene Beweis" (Zeilen 134–141) — IST die gefallene Zaun-These, wörtlich („die MAIN darf die Schlange fuettern, nicht den Zaun
  oeffnen"). J erklärt Schnitt 1 für unverändert, ohne zu sagen, dass seine Begründung entfallen ist. Der Owner bestätigt Schnitt 1 dann auf einen Beweis, den der Entwurf zwölf Seiten später
  selbst zurückgezogen hat.
  ────────────────────────────────────────
  Position: 3. E.7 fällt
  Urteil: echt
  Begründung: Reine Aufhebung einer Verbotszeile, keine Restabhängigkeit auffindbar.
  ────────────────────────────────────────
  Position: 4. H.4-Zwei-Schwellen fällt
  Urteil: echt, und der stärkste Absatz in J
  Begründung: Nachgemessen und bestätigt: supervisorNudge verweigert an fünf Stellen (:13461, :13463, :13466, :13470, :13476) mit 409 und schreibt dabei keine Zeile; audit("supervisor_nudge",
  …) steht erst auf dem Erfolgspfad :13504. „Erst der Sensor, dann die Schwelle" ist damit belegt, und der Rückbau ersetzt eine Schwelle durch eine Messung — genau die Richtung, die die
  Reparatur-Regel verlangt.
  ────────────────────────────────────────
  Position: 5. H.2 ROUTE_OVERRIDE ändert sich
  Urteil: echt, aber unterspezifiziert
  Begründung: Der Rückbau auf „Modellwahl nur für eigene Starts, nie am lebenden Slot" ist real und durch die Spawn-Invariante gedeckt. Er hängt jedoch vollständig an Befund 1: sobald die MAIN

  dispatchTask direkt ruft, wählt sie {harness, model, effort} an einem Pfad, an dem der Bolt (:6107) das einzige verbleibende Gate ist — und der Bolt lässt bei FLEET_HARNESS_AUTOMATION=1
  (live gesetzt) jeden automatable-Adapter durch.

  Abhilfe — Klasse: irreführendes Wissen → Brief/Pack. Position 2 braucht keinen Mechanismus, sondern eine korrigierte Zeile: Schnitt 1s Sicherheitsbegründung (134–141) muss als entfallen
  markiert werden, sonst ist der Entwurf an der Stelle, an der der Owner zustimmt, in sich falsch.

  ---

  Die drei selbsterklärten offenen Stellen — heute auflösbar?

  J.5 „im bestätigten Program-Scope" (Autonomie-Drift nach innen). Nein, heute nicht auflösbar — und J stellt es zu pessimistisch dar. J sagt, der Code prüfe ex ante nur die Form. Richtig,
  aber die Form ist heute schwächer als J annimmt: die drei Formterme, auf die J baut, sind je einzeln defekt (Bindung veraltet → Befund 2; Repo fehlt → Befund 3; Deckel bindet nichts → Befund
  5). Vor der semantischen Frage steht also eine mechanische, die lösbar ist. Das kleinste Ehrliche für den Owner: „Von den drei formalen Grenzen, die der Entwurf als gesichert führt, hält
  heute keine: die Bindung ist bei 9 von 13 aktiven Programmen tot, die Zeile nennt kein Repo, der Deckel deckelt eine Ressource, die unter dieser Hülle nicht mehr knapp ist. Die semantische
  Restunschärfe ist real, aber sie ist nicht das, was als nächstes weh tut." Die Ex-post-Messung, die J als Gegenmittel nennt (Attention, Disposition), ist die richtige Klasse — sie setzt aber
  voraus, dass die Ex-ante-Form überhaupt trägt.

  J.3(a) „reversibel" × Rate. Heute weitgehend auflösbar — siehe Befund 4. Das Fenster ist 3 Lands tief, kontiguitätsgeprüft, und jedes Herausfallen schreibt einen Klartextgrund in
  undoDropped. J.3s vorgeschlagene Rate-Bindung („höchstens EIN policy-autorisierter Land je undo-Fenster") ist damit nicht nötig; sie wäre eine Regel für ein Problem, das ein Mechanismus
  schon hält. Das kleinste Ehrliche: „Der Rückweg ist drei Lands tief, nicht eines, und er sagt selbst, wenn er reißt (mainAfter ≠ mainBefore → Stack wird verworfen, mit Grund). Was fehlt, ist
  nicht eine Rate-Regel, sondern dass dieser Grund die MAIN erreicht, die gerade gelandet hat." Der echte Rest, der offen bleibt und den J richtig sieht: ein Push auf ein Remote macht die
  Rücknahme permanent unmöglich (remoteHoldsLandedRange, :17733) — das ist die eine Handlung, bei der „reversibel" ohne Rate kippt.

  J.3(b) „gewöhnlich". Nein, nicht auflösbar — und das ist richtig so. J schlägt die sechs PromotionRiskClass-Werte als Vokabular vor und sagt selbst, welche Klasse „gewöhnlich" ist, sei
  Policy-Inhalt. Ich gehe weiter: ein Vokabular hier wäre eine Rubrik und damit disqualifiziert. Die Reparatur-Regel in J.5 löst den Fall bereits ohne Definition — eine Fehlentscheidung im
  Scope ist „gewöhnlicher Urteilsfehler → Reparatur innerhalb derselben Rolle", und das gilt unabhängig davon, ob die Reparatur vorher „gewöhnlich" hieß. Das kleinste Ehrliche für den Owner:
  „‚Gewöhnlich' braucht kein Vokabular, weil die Reparatur-Regel ohne es auskommt. Was es braucht, ist die Zusage, dass ein Fehlurteil der MAIN nicht zu einer neuen Regel führt — sonst wächst
  das Vokabular von selbst, einmal je Vorfall." Das ist exakt der Satz, den J.5 bereits normativ trägt; er ist die Antwort auf J.3(b) und J nennt die Verbindung nicht.

  ---

  Wo ich dem Entwurf am ehesten unrecht tue

  - Befund 1 setzt voraus, dass J.1s dispatchTask(…)-Zeile die Implementierung meint. Möglich ist, dass GLM sie als Bezeichnung der Wirkung meinte und einen Aufruf durch tickDispatch vor Augen
    hatte. Dafür spricht J.4-2 („dieselben unattended Gates wie heute"). Dagegen spricht, dass J.1 die Argumentliste vollständig ausschreibt (false, false, {harness, model, effort}) — und
    tickDispatch ruft die kurze Form (:6103–:6104, per Pin in e2e/pins.ts festgehalten). Ich habe die schärfere Lesart genommen; wenn die mildere gemeint war, schrumpft Befund 1 auf „eine
    Zeile ist irreführend formuliert" — aber er verschwindet nicht, weil der Entwurf dann an zwei Stellen Unvereinbares sagt.
  - Befund 3 wertet eine unbaute Route. propose_task existiert nicht; ich lese repo:null aus Zeile 132/290 als bindende Vorgabe. Wer sie beim Bauen still korrigiert, hat den Befund erledigt,
    bevor er entsteht. Ich melde ihn trotzdem, weil J die Steward-Route ausdrücklich als Formvorlage benennt und deren repo:null dort begründet ist.
  - Befund 5 unterstellt, der Owner lese den 10er-Deckel als Autonomie-Grenze. J stellt ihn in der Grenzen-Spalte, also im Klasse-B-Sinn. Falls er nur als Speicherhygiene gemeint war, ist der
    Befund halb so schwer — die Ressourcen-Verwechslung bleibt.
  - Befund 7s „Wanderung" habe ich nicht ausgelöst, nur aus der Array-Ordnung und dem status-Filter abgeleitet. Live sind keine zwei aktiven Programme an dieselbe Session gebunden, also ist
    der Pfad heute nicht befahren.
  - Zu J insgesamt: J.4-4 (Sensor vor Schwelle) und J.5 (Reparatur-Regel, Ebenen-Trennung Context-Pack vs. capability-map.ts#roleCondition) sind gute, belegte Architektur. Die Ebenen-Trennung
    habe ich stichprobenartig bestätigt — ContextPackCapability erscheint in server.ts als Typ-Import und Plan-Eingabe, in keinem Auth-Pfad. Meine Kritik trifft J.1–J.3, nicht J.5.

  ---

  Was ich NICHT geprüft habe

  - Abschnitte A–I außer den fünf Stellen, auf denen J.4 explizit steht (Zeilen 132–141, 288–302, 434–448, 468–488). Aussagen über sie mache ich nicht.
  - capability-map.ts, context-plan.ts, land-candidate.ts, src/protocol.ts — nicht geöffnet. J.3s Behauptungen über projectPromotionPolicyFacts, sameCandidate, PromotionRiskClass (sechs Werte)
    und contextOmissionFor sind ungeprüft und in meinem Bericht nirgends tragend.
  - SYSTEM.md — nicht gelesen. J.3s Zitat („entweder auf einen benannten Owner-Akt oder auf eine benannte, zuvor vom Owner promovierte Policy") habe ich nicht verifiziert; meine Aussagen zur
    Landefrage hängen nicht daran.
  - Keine Suite gefahren, kein e2e/pins.ts, kein ./e2e-isolated.sh (Read-only-Auftrag). Alle Aussagen sind Quelltext- und State-Lesungen, keine Ausführungsbelege.
  - fleet.json-Slots nur strukturell gelesen (openedAt/sessionId/cwd/harness). Ich habe keine Pane angesehen — die drei „intakten" Bindungen aus Befund 2 sind formal intakt, nicht als lebende
    Agenten verifiziert.
  - FLEET_HARNESS_AUTOMATION habe ich als „live gesetzt" aus CLAUDE.md übernommen, nicht am laufenden Server gemessen (GET /api/self/gate wäre Lane-only, ich bin keine Lane). Betrifft nur den
    Nebensatz in J.4-5.
  - graphify bewusst nicht benutzt (veralteter Graph, Brief-Vorgabe) — der PreToolUse-Hook hat das dreimal angemahnt.

  fertig.

✻ Cogitated for 7m 57s

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ 
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  main  |  ctx [#---------] 14%  |  Opus 5 (1M context)
  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← 7 agents


