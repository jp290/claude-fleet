// WHAT A ROW OF THE BAR SPENDS ITS AREA ON. The owner's question ("die slotansicht soll den platz
// effektiv nutzen") measured the way the tree already measures it: area in px², per row and for the
// whole bar (docs/messungen/INDEX.md:200 reads "45 von 9120 Pixeln einer Zeile" — 228x40).
//
// THREE BUCKETS, and the classification is stated here rather than inferred, so a disagreement
// lands on one line instead of on the number:
//   FACT   — ink that says something about the session: address, label, state glyph, lane
//            lifecycle dot, the readings (ctx/inbound/parked), repo, age, lane count, ⏱, badges.
//            Measured as the TEXT's own box (Range over the text node), not the element's box —
//            a chip that is mostly padding must not count its padding as fact.
//   CHROME — everything drawn that carries no fact: chip padding and rings, fold arrow, the ⎇+
//            and ± affordances, the row border, and RESERVED EMPTY SPACE (the mark's gutter).
//   EMPTY  — row area minus the two above.
// Hover-only layers (.slotact, .rowacts) are excluded: they are not on screen at rest.
const dbg = "http://127.0.0.1:9222";
const t = (await fetch(`${dbg}/json`).then((r) => r.json())).find((x) => x.type === "page");
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const ev = (x) => new Promise((res) => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression: x, returnByValue: true, awaitPromise: true } })); });

const script = `(() => {
  const FACT = ["n","laneref","lbl","act","lcdot","ctxfill","repo","when","stackn","autobadge","cmtb","revb"];
  const CHROME_EL = ["mark","stackfold","quicklane","lanediff","diff","lanesep"];
  const inkOf = (el) => {
    let w = 0, h = 0;
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(node);
      const b = r.getBoundingClientRect(); w = Math.max(w, b.width); h = Math.max(h, b.height);
    }
    if (!w) { const b = el.getBoundingClientRect(); return b.width * b.height; } // glyph, not text
    return w * h;
  };
  const rows = [...document.querySelectorAll("#slots > .slot")];
  let area = 0, fact = 0, chrome = 0, mark = 0, n = 0, occupied = 0;
  const per = [];
  for (const row of rows) {
    const rb = row.getBoundingClientRect();
    if (!rb.height) continue;
    const a = rb.width * rb.height;
    let f = 0, c = 0, mk = 0;
    for (const el of row.querySelectorAll("*")) {
      if (el.closest(".slotact") || el.closest(".rowacts")) continue;
      const cls = [...el.classList];
      const eb = el.getBoundingClientRect();
      if (!eb.width || !eb.height) continue;
      if (cls.some((k) => FACT.includes(k))) { const ink = inkOf(el); f += ink; c += Math.max(0, eb.width * eb.height - ink); }
      else if (cls.some((k) => CHROME_EL.includes(k))) {
        c += eb.width * eb.height;
        // The mark's gutter is priced SEPARATELY as well as inside chrome: it is the one reserved
        // area the owner asked for a number on before anyone is allowed to touch it.
        if (cls.includes("mark")) mk += eb.width * eb.height;
      }
    }
    const bw = parseFloat(getComputedStyle(row).borderTopWidth) || 0;
    c += bw * 2 * (rb.width + rb.height);
    area += a; fact += f; chrome += c; mark += mk; n++;
    if (!row.classList.contains("empty")) occupied++;
    // Lever 4 ("the won space goes to the label") is only provable if the label's SHORTFALL is a
    // number: how many px the label would need beyond the width it was given before the ellipsis
    // stops appearing. 0 = the name is on screen in full.
    const lblEl = row.querySelector(".lbl");
    const lblShort = lblEl ? Math.max(0, Math.round(lblEl.scrollWidth - lblEl.clientWidth)) : 0;
    per.push({ lblW: lblEl ? Math.round(lblEl.clientWidth) : 0, lblShort, kind: row.classList.contains("empty") ? "free" : row.classList.contains("lane") ? "lane" : "session",
      h: Math.round(rb.height), w: Math.round(rb.width),
      a: Math.round(a), f: Math.round(f), c: Math.round(c), mark: Math.round(mk) });
  }
  const bar = document.getElementById("slots").getBoundingClientRect();
  return JSON.stringify({
    rows: n, occupied, barW: Math.round(bar.width), barH: Math.round(bar.height),
    rowsVisibleInBar: rows.filter(r => { const b = r.getBoundingClientRect();
      return b.top >= bar.top - 1 && b.bottom <= bar.bottom + 1; }).length,
    area: Math.round(area), fact: Math.round(fact), chrome: Math.round(chrome), mark: Math.round(mark),
    markPct: +(100 * mark / area).toFixed(2),
    empty: Math.round(area - fact - chrome),
    factPct: +(100 * fact / area).toFixed(2), chromePct: +(100 * chrome / area).toFixed(2),
    emptyPct: +(100 * (area - fact - chrome) / area).toFixed(2),
    lblClipped: per.filter(p => p.lblShort > 0).length,
    lblShortTotal: per.reduce((t, p) => t + p.lblShort, 0),
    medianRowH: per.map(p => p.h).sort((x, y) => x - y)[Math.floor(per.length / 2)],
    per });
})()`;
const r = await ev(script);
console.log(r.result.value);
ws.close();
