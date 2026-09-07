# P3 Landepfad adversarial — ENTWURFSSTAND, NICHT ABGENOMMEN (2026-09-07)

Program `6360c36105e50a705db275c1` (Astra-Tagesmandat P3). Dieses Verzeichnis ist die
**Verstetigung** des Arbeitsstands aus dem Scratch-Verzeichnis der P3-MAINs — auf Anweisung des
Controllers (Slot 1, 2026-09-07 ~14:0x), damit die fuenf Review-Runden nach einem Reboot noch
existieren. Es ist KEINE Publikation und kein Vorgriff auf die Abnahme: das Zieldokument
`docs/messungen/2026-09-07-landepfad-adversarial.md` entsteht erst nach einem ACCEPT der zweiten
Astra durch die serielle Opus-Publikationslane (Zeile `6b61a7bf`).

| Datei | Was | Stand |
|---|---|---|
| `entwurf5-6b931dc3.md` | 5. Entwurf, sha256 `6b931dc39c0a92d1c866bf96501a0ed5e38b79601c4088257f48c994a850460e`, 910 Zeilen, Quell-Pin `c7184f8` | Runde 5 NICHT eingearbeitet |
| `entwurf4-eb9adb85.md` · `entwurf3-027deaa5.md` | Vorgaenger (Diff = Einarbeitung von Runde 4 bzw. 3) | historisch |
| `review-round1-REJECT.md` … `review-round5-REJECT.md` | Astra-Abnahmen per `codex exec`, Punkte 19 / 13 / 14 / 12 / 10 (Runde 5: 2 schwer) | alle REJECT |
| `review-prompt-r5.txt` | der Review-Prompt (Runde 5; Runden 1–5 identisch bis auf den Draft-Hash) | — |
| `index-line.txt` · `publication-brief.txt` | Indexzeile fuer `docs/messungen/INDEX.md` und Brief-Vorlage (`__HASH__`) fuer die Publikationslane | Vorlagen |

Runde-5-Blocker (nicht eingearbeitet): (1) §3.4(c) Adjudikations-Join gibt auch `verdict:"real"` frei —
richtig: blocken, wenn keine Adjudikation ODER `real` (`ADJUDICATION_VERDICTS`); (2) §1.6 Repro-Skript
schuetzt `rm -rf "$DIR"` nur mit `[ "$DIR" = "$SRC" ]`.

Verlauf und Entscheidungen: `HANDOFF.md`, Abschnitt „Program-MAIN P3 Landepfad adversarial".
