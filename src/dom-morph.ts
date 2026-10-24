// MORPH: brings a drawn element up to a freshly drawn one, in place. What is the same stays the same element (its scroll, its focus,
// no fade-in again); what differs is changed where it differs: an attribute, a text, a child. A window can go on drawing its whole
// tree from its state and still change only what a click changed (owner 24.10.: „[Zitat entfernt]“).
//
// Handlers are properties (onclick, oninput …) and move to the kept element with the fresh drawing. So a handler reads its element from
// the event (`e.currentTarget`) or by a query, never from the variable it was drawn into: that element is thrown away afterwards.
// Children match by kind: their tag and data key (data-ob, data-b …, see KEYS), or without a key their tag and first class (the base
// class; modifiers follow it). A part that comes or goes in the middle doesn't shift the ones after it into others.

const HANDLER = ["onclick", "oninput", "onchange", "onkeydown", "onkeyup", "onpointerdown", "onmousedown", "onfocus", "onblur",
  "ondragover", "ondragleave", "ondrop", "onscroll", "onsubmit"] as const;
// the data attributes a window names its parts by; the first one an element carries is its key (data-key: a part named for this alone)
const KEYS = ["key", "ob", "b", "add", "set", "agent", "repo", "feld", "scroll", "k", "dev", "effort", "only", "normal"] as const;

function key(n: Node): string | null {
  if (!(n instanceof HTMLElement || n instanceof SVGElement)) return null;
  for (const k of KEYS) { const v = n.dataset[k]; if (v !== undefined) return `${k}=${v}`; }
  return null;
}
function art(n: Node): string {
  if (!(n instanceof Element)) return n.nodeName;
  return `${n.nodeName}|${key(n) ?? "." + (n.getAttribute("class") ?? "").trim().split(/\s+/)[0]}`;
}
const gleich = (a: Node, b: Node): boolean => art(a) === art(b);

export function morph(alt: Element, neu: Element): void {
  for (const { name } of [...alt.attributes]) if (!neu.hasAttribute(name)) alt.removeAttribute(name);
  for (const { name, value } of [...neu.attributes]) if (alt.getAttribute(name) !== value) alt.setAttribute(name, value);
  const a = alt as unknown as Record<string, unknown>, n = neu as unknown as Record<string, unknown>;
  for (const h of HANDLER) if (a[h] !== n[h]) a[h] = n[h];
  kinder(alt, neu);
  // what a field holds is a property, not an attribute; set only where it differs, so the cursor of a field being typed in stays
  if (alt instanceof HTMLInputElement || alt instanceof HTMLTextAreaElement || alt instanceof HTMLSelectElement) {
    const v = (neu as HTMLInputElement).value;
    if (alt.value !== v) alt.value = v;
    if (alt instanceof HTMLInputElement && alt.checked !== (neu as HTMLInputElement).checked) alt.checked = (neu as HTMLInputElement).checked;
  }
}

function kinder(alt: Element, neu: Element): void {
  const neue = [...neu.childNodes];
  let i = 0;
  for (const [j, n] of neue.entries()) {
    let da: ChildNode | null = alt.childNodes[i] ?? null;
    // an old child that matches no new one from here on goes, when this new one stands further on: what follows keeps its place
    while (da && !gleich(da, n) && !neue.slice(j + 1).some((m) => gleich(da!, m)) && [...alt.childNodes].slice(i + 1).some((x) => gleich(x, n))) {
      da.remove();
      da = alt.childNodes[i] ?? null;
    }
    let treffer: ChildNode | null = da && gleich(da, n) ? da : null;
    // a child that moved: found further on and brought here
    if (!treffer) treffer = [...alt.childNodes].slice(i + 1).find((x) => gleich(x, n)) ?? null;
    if (!treffer) alt.insertBefore(n, da);
    else {
      if (treffer !== da) alt.insertBefore(treffer, da);
      if (treffer instanceof Element) morph(treffer, n as Element);
      else if (treffer.nodeValue !== n.nodeValue) treffer.nodeValue = n.nodeValue;
    }
    i++;
  }
  while (alt.childNodes.length > i) alt.lastChild!.remove();
}
