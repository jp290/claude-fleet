# Harness-Wahl im Fleet — Doktrin (2026-08-17, auf Messdaten des Abend-Audits)

Eine Seite, wie vom Owner beauftragt. Datenbasis: der Work-Trail-Audit
(`docs/private-repo-e-worktrail-audit-2026-08-17.md`, Phasen 1-2 + Adjudikation + A/B-Arme) und drei
Grok-Runden (`briefs/grok-audit-harness*.md`). Der externe Harness-Vergleich ist NICHT Teil dieser
Doktrin und wird nicht wiederholt — Negativ-Befund samt Umstoß-Latte: Queue-Zeile `c5c34b7f`.
Ledger-Prüfbarkeit: bis `d9b9b4c4` landet (LaneOutcome ohne `harness`-Feld, 0/177 Zeilen), sind
Harness-Aussagen über vergangene Lanes nicht gegen die eigenen Ledger prüfbar — die Zeile ist
freigegeben (queued 2026-08-17).

## Die Regel

**Die Harness-Frage ist eine Formfrage der Aufgabe, keine Glaubensfrage.** Der Harness dominiert
den WEG (Ergonomie, Zustellung, Interventionsrate); Modell + Rubrik + Brief-Struktur dominieren
das ZIEL (Befund-/Ergebnisqualität). Je mehr Struktur der Brief der Aufgabe gibt, desto weniger
zählt der Harness.

1. **Strukturierte Aufgabe** (Scripts tragen die Daten, Packs kreuzen die Grenze, Output
   schema-erzwungen): billigster zuverlässiger Runner gewinnt; In-Session-Subagent ist die
   Default-Form (kein Slot, kein Spawn, keine Zustell-Naht). Über-Provisionierung ist aktiv
   schädlich (verleitet zum Roh-Daten-Peek).
2. **Unstrukturierte Aufgabe** (offenes Bauen, Polish-Iteration, Erkunden): der Harness IST die
   Methode — hier zählen Tool-Output-Fidelity, Loop-Disziplin, Retention. Bewährter Harness +
   Brief-Kompensation (Standing-Rules-Block); Wechsel nur mit benanntem Mechanismus-Vorteil.
3. **Cross-Family gezielt, nie routinemäßig:** ein Fremd-Modell (gemessen: GLM-5.3 via `pi-zai`)
   als Code-Reviewer für Claude-produzierte Bäume, wenn Familien-blinde-Flecken plausibel sind.
   Nicht als Standard — der dichtere Brief kostet mehr als die Unabhängigkeit routinemäßig bringt.
4. **Vertrauensgrenze zuerst:** was ein Agent liest, geht an seinen Provider. Fremde Harnesses
   nur auf Inhalte, für die das entschieden ist.

## Die Messungen, auf denen das steht (alle 2026-08-17, n klein — als solches führen)

- **Same-Model-A/B** (identischer Brief, Fable-Subagent vs. Fable-Lane): Befundqualität
  ununterscheidbar — beide Arme produzierten konvergierende Regeln UND fielen in dieselbe Falle
  (Pack-Truncation → falsche „stuck"-Urteile: Arm A 1, Arm B 2 harte Fehlurteile gegen Ground
  Truth). Weg-Kosten real verschieden: Subagent 93k Tokens/1 Tool-Call sofort; Lane = Spawn +
  ~120k + **eine stille Zustell-Panne** (Brief blieb ungesendet im Composer — dritte
  N2-Live-Instanz des Tages). Das IST die Achsen-Auflösung aus Grok Runde 3, am eigenen System.
- **Cross-Family-Ertrag:** der GLM-Arm lieferte 5 strukturelle Befunde mit file:line, darunter
  einen echten Gameplay-Bug (Phantom-Krater bei Off-Screen-Schüssen) und die
  Konstanten-Vervierfachung — Substanz, die die Claude-Arme (Prozess-fokussiert) nicht hatten.
  Selbstauskunft Füllstand ~50% — der Sensor, den das Board für Fremd-Slots nicht hat.
- **Der teuerste Fehlermodus war nie das Modell, zweimal nicht der Harness:** (a) Pack-Truncation
  (unser eigener Spec) erzeugte den einzigen Falschbefund des Tages; (b) der falsche
  Harness-NAME (`pi` statt `pi-zai`) kostete zwei Requeues + einen Zombie-Slot. Betriebswissen:
  GLM läuft NUR über den Adapter `pi-zai`; `pi` allein kennt kein GLM-Modell.

## Offene Enden, ehrlich

n=1 pro Zelle; der GPT-Arm des geplanten Dreier-A/B ist nicht gefahren (zwei Arme reichten für
die Weg/Ziel-Trennung, der dritte hätte nur die Cross-Family-Zelle dupliziert, die GLM schon
belegt). Wer die Doktrin schärfen will, wiederholt das A/B auf dem nächsten Audit-Batch mit
`harness`-Feld im Ledger (`d9b9b4c4`) statt neuer Diskurs-Runden.
