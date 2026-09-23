// Fills every .term with the same made-up transcript (no real session content), so both
// directions show the same text and the row counts in the pictures are comparable.
const LINES = [
  ["u", "> Warum faellt der Land-Gate auf Stufe 1?"], "",
  "⏺ Stufe 1 ist bun e2e/pins.ts. Der Lauf von 21:14 bricht an genau einem Pin ab:", "",
  ["d", "  FAIL  rulebook: CLAUDE.md gleicht dem Render aus rulebook/"],
  ["d", "        erwartet Quell-Hash 7d6aa311, gefunden 3b90c2e4"], "",
  "  Das heisst: jemand hat CLAUDE.md von Hand editiert statt das Fragment.",
  "  Die drei geaenderten Zeilen stehen in rulebook/lane.md nicht.", "",
  "⏺ Bash(git diff --stat main -- rulebook/)",
  ["d", "  ⎿  (keine Ausgabe — das Fragment ist unveraendert)"], "",
  "⏺ Also ist die Quelle sauber und nur das Generat weicht ab. Zwei Wege:", "",
  "  1. CLAUDE.md neu rendern — die Handedits gehen verloren, der Pin wird gruen.",
  "  2. Die drei Zeilen erst ins Fragment tragen, dann rendern.", "",
  "  Ich empfehle 2: die Zeilen sind eine echte Regel, nur am falschen Ort.", "",
  "⏺ Bash(bun rulebook.ts --write && bun e2e/pins.ts)",
  ["d", "  ⎿  pins: 212 PASS · 0 FAIL · 4 SKIP"], "",
  "⏺ Gruen. Der naechste Land sollte Stufe 1 in unter einer Sekunde passieren.",
  "  Offen bleibt, warum rulebookDrifted den Handedit nicht gemeldet hat.", "",
  ["u", "> ok, file das"],
];
for (const t of document.querySelectorAll(".term")) {
  for (const l of LINES) {
    const d = document.createElement("div");
    if (Array.isArray(l)) { d.className = l[0]; d.textContent = l[1]; } else d.textContent = l || " ";
    t.appendChild(d);
  }
}
