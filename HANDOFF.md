# HANDOFF — Kontext-Pack-Netz (Slot 14 „openSource" → Nachfolge): Stand-Doc steht, Schritt 1 auf Branch `pack-source-hash`, Suite-Ergebnis in §2

Zustand ableiten, nicht aus dieser Prosa lesen: `./state.sh`, `./register.sh`. Hier steht nur,
was git und die Sensoren NICHT tragen.

## 0. Der Owner-Auftrag für dich, wörtlich

*„Am Ende machen wir dann eine succession in eine neue Session die die idee weiter mit mir zusammen
durchdenkt und die implementierung soweit plant und ausarbeitet."* und *„Lass uns dies jetzt alles
eins nach dem anderen aber auch mit der benötigen Sorgfalt, angehen."*

Du bist also eine DENK- und PLANUNGS-Session mit dem Owner, keine Bau-Session. Die Idee heißt
Kontext-Pack-Netz; der lesbare Stand ist `docs/ideen/2026-09-03-kontextpack-netz-stand.md` (lies
§1 und §8 zuerst, dann §2 und §5; die drei Fassungen davor nur bei Bedarf als Herleitung). Der
Owner denkt in Schritten und will je Schritt einen Beweis; die Tabelle in §8 des Stand-Docs ist die
Reihenfolge, die drei Owner-Entscheide davor sind die ersten Fragen an ihn.

## 1. Das Erste, was du tust

1. **Suite-Ergebnis lesen** (§2 unten). Liegt es nicht vor: das Log ist
   `/private/tmp/claude-501/-Users-owner-claude-fleet/f8f1d2d3-cb47-4eb7-aeb1-fd7036d10beb/scratchpad/e2e-isolated-pack-hash.log`,
   Urteil am Tail („ALL PASS" oder FAIL-Zeilen), nie an einer erinnerten Zahl.
2. **Ist der Branch gelandet?** `git branch --contains 2b4abd6 main` (leer = nicht gelandet). Der
   🎛 Fleet Controller (Slot 13, Nachfolger des S12, der mir den server.ts-Schnitt auferlegt hat) hat
   server.ts als knappste Fläche; ihm ist der Branch mit einer Nachricht gemeldet (§3). **Du landest
   nicht selbst**, es sei denn, der Controller gibt es dir. Ein ff-Merge des Branches ist ein
   main-direkter Zug: kein Land-Ledger, kein Post-Land-Audit. Der Suite-Lauf auf `2b4abd6` IST die
   Vollverifikation, die das Regelbuch dafür verlangt, und muss dann im Commit-Body/Handoff stehen.
3. **Nach dem Land:** Deploy über Verb 2 (`POST /api/deploy`), `bundleStale` prüfen, dann
   `bun briefstats.ts` im Haupt-Checkout. Die ersten Zeilen `@<hash>` statt `@unversioned` in der
   Tabelle „pack @ source version" sind der Beweis für Schritt 1. Vorher gibt es dort nur
   `@unversioned` (301 gejointe Lanes am 2026-09-03).
4. **Dann mit dem Owner Schritt 2 durchdenken** (Stand-Doc §2 und §8): `avoidWhen` mit
   Vorfall-Referenz, Act-seitiges `requires[]`, das vermittelte Wissen als Daten. Erst Kriterium
   und Beweis je Teil, dann eine Lane briefen. Bauen tut eine Lane (Opus 5, high), nicht du.

## 2. Gelandet, gebaut, verifiziert

**Auf main, direkt committet (docs-only, `bun e2e/pins.ts` ALL PASS, kein Post-Land-Audit deckt
sie):** `fcaa4a4` → `f1cc8c5` → `eac1a0f` (drei Fassungen der Analyse, jede eine korrigierte
Fehlfassung der vorigen, in §0 der jeweiligen benannt), `3f561b5` (der Stand).

**Auf Branch `pack-source-hash` (Basis `24f9cfc`), NICHT gelandet:**

- `6535f71` reine Hälfte: `context-manifest.ts#observedSourceHash` + `#stampObservedSourceHashes`,
  `context-packs.ts#CONTEXT_SEED_SOURCE_PATHS`, `briefstats.ts` Pack × Version-Tabelle; 5 + 4 neue
  Checks. Gate-tsc-Liste exit 0, pins ALL PASS, `bun e2e/context-plan.ts` ALL PASS, briefstats-Modul
  0 FAILURES, `bun run build` exit 0.
- `2b4abd6` server.ts-Hälfte: vier Stellen (Import; `repoManifestContextPlan` liefert
  `{repoPlan, sourceBytes}` und liest die Seed-Pfade mit; beide Merge-Stellen stempeln
  `base.selected`), plus zwei Pins in `e2e/programs.ts`. Gate-tsc + pins grün. Der gelieferte
  Brief bleibt byteidentisch, nur die Receipt-Zeile gewinnt `sourceHash`.
- **`./e2e-isolated.sh` auf `2b4abd6`:** SIEHE ZEILE UNTEN — sie wird vor dem Succeed
  nachgetragen. Steht hier noch „läuft", dann §1 Punkt 1.

  > Suite-Ergebnis: läuft (gestartet 2026-09-03, wartete zuerst ~3 min hinter einem fremden Lauf am Mutex).

Eine eigene Fehlfassung unterwegs, festgehalten im Body von `6535f71`: das Test-Fixture
„declared-literal" fiel am Validator (SHA-256 + `observedAt` sind ein Pflichtpaar), nicht am
Code. Und gemessen an der Naht: `gitRead` trimmt, der Server hasht also getrimmte Bytes; die
Sonde in `e2e/programs.ts` rechnet deshalb über `git show` + `trim()` nach.

## 3. Was git NICHT trägt

- **Der Worktree** liegt im Session-Scratchpad
  (`…/f8f1d2d3-cb47-4eb7-aeb1-fd7036d10beb/scratchpad/pack-hash`). Verschwindet das Verzeichnis,
  bleibt der Branch im Repo; `git worktree prune` räumt den Eintrag. Nichts Uncommittetes liegt dort.
- **Dem Controller (Slot 13) ist EINE Nachricht geschickt** (2026-09-03, nach dem Schreiben dieses
  Handoffs): Branch, die vier server.ts-Stellen, Suite läuft, Ergebnis kommt von dir. Schick ihm
  keine zweite mit demselben Inhalt; jede Nachricht kostet seinen vollen Kontext.
- **Rulebook-Nachtrag, den jemand von Hand in `CLAUDE.md` (untracked, Generat aus `rulebook/`)
  ziehen muss, sobald gelandet und deployt:** unter „Wissenspflege" eine Zeile, dass ein Receipt
  seit diesem Land die Quellversion jeder Auswahl trägt (`sourceHash`, beobachtet, nie deklariert)
  und `bun briefstats.ts` die Tabelle „pack @ source version" druckt. Ich habe `CLAUDE.md` NICHT
  angefasst; die Sanierungs-MAIN (Slot 9) hält dort eine eigene untracked Änderung (14. Flake-
  Familie), also erst deren Stand lesen, dann `rulebook/` ändern und rendern.
- **Kontextstand dieser Session beim Schreiben: 33,4 % (gemessen, `ctx.pct` am Slot 14).** Über dem
  30-%-Band; der Owner hat die Übergabe ausdrücklich angeordnet.

## 4. Die drei Owner-Entscheide, die du zuerst stellst (Stand-Doc §8)

1. Bleibt das Pack ein Zeiger-Objekt, oder trägt es das vermittelte Wissen als Daten (Claim, Scope,
   Sonde)? Empfehlung: Zeiger für Quellen PLUS ein `conveys`-Block, weil nur der über Fleets hinweg
   lesbar ist.
2. „Unbedingt" ans Pack oder an den Act? Empfehlung: an den Act (`requires[]`).
3. Welche Pools zuerst? Empfehlung: Klasse 1 (Werkzeug-Fakt, Sonde + Replikation) allein, bei einem
   Owner mit zwei Hosts; Pools 2 bis 6 erst mit dem zweiten Owner.

## 5. Was ich als Nächstes täte

Mit dem Owner das Pack-Schema aus Stand-Doc §2 Zeile für Zeile durchgehen (was steht, was fehlt),
die drei Entscheide holen, dann für Schritt 2 ein Kriterium + Verify-Weg je Teil festlegen
(`/kriterium-grill`) und EINE Lane briefen (Opus 5, high; `e2e/context-packs.ts` als Beweisort).
Nicht selbst graben.
