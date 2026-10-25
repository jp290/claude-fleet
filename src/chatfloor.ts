// THE CHAT VIEW'S FLOOR (owner 25.10.): the conversation view reaches the bottom edge of the window.
// - The flakes fall all the way down: a second sky (src/flakes.ts) behind the composer band (#bar), from the
//   pane's lower edge to the window's, while the focused pane shows the chat view. The band itself turns
//   transparent there; the composer's own surface stays as it is.
// - A click on the band beside the composer, unless it lands on something you can press, puts you in the
//   input field, as a click in the chat view's lower half does (owner: „[Zitat entfernt]“
//   ).
import { $, ta, panes, focused } from "./client";
import { Flakes } from "./flakes";

let sky: Flakes | null = null;
let main: HTMLElement;
let bar: HTMLElement;

// what you can press: the board's controls are real elements with a pointer cursor; text and its ground are not
const PRESSABLE = "button, a, input, textarea, select, summary, label, video, audio, [role=button], [role=link], [contenteditable=true], [tabindex]:not([tabindex='-1'])";
function pressable(from: Element, stop: Element): boolean {
  for (let n: Element | null = from; n && n !== stop; n = n.parentElement) {
    if (n.matches(PRESSABLE) || getComputedStyle(n).cursor === "pointer") return true;
  }
  return false;
}

export function initChatFloor(): void {
  main = $("main");
  bar = $("bar");
  sky = new Flakes();
  sky.canvas.className = "barflakes";
  main.insertBefore(sky.canvas, bar);
  // the sky starts where the panes end: the band's margin box (on the phone the island stands 18 px clear)
  const place = () => {
    const panesEl = $("panes");
    const top = panesEl.offsetTop + panesEl.offsetHeight;
    main.style.setProperty("--floor-h", `${Math.max(0, main.clientHeight - top)}px`);
  };
  new ResizeObserver(place).observe(bar);
  new ResizeObserver(place).observe(main);

  // the band: a click beside the composer surface (not on a control) is a click into the field. The chat
  // view itself does the same in its lower half (src/client.ts#chatClickToComposer)
  // (and on the phone the margin around the island, where the click lands on the column itself)
  main.addEventListener("click", (e) => {
    if (e.button !== 0 || e.detail > 1 || ta.disabled || !panes[focused]?.isChat || !(e.target instanceof Element)) return;
    if (e.target !== main && !bar.contains(e.target)) return;
    if (pressable(e.target, bar)) return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed) return;
    if (document.activeElement !== ta) ta.focus({ preventScroll: true });
  });
}

// the composer follows the focused pane (src/composer.ts#mountComposer), and so does the floor
export function syncChatFloor(): void {
  if (!sky) return;
  const on = !!panes[focused]?.isChat;
  main.classList.toggle("chatfloor", on);
  sky.setActive(on);
}
