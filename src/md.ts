// minimal, XSS-safe markdown shared by the owner chat view and the guest reader:
// only ``` fences get structure, everything else stays textContent — transcript text
// is hostile input on both surfaces, so no other markdown may become markup
export function mdInto(target: HTMLElement, text: string): void {
  const parts = text.split("```");
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const nl = part.indexOf("\n");
      const code = nl >= 0 ? part.slice(nl + 1) : part;
      const wrap = document.createElement("div");
      wrap.className = "code";
      const pre = document.createElement("pre");
      pre.textContent = code.replace(/\n$/, "");
      wrap.appendChild(pre);
      target.appendChild(wrap);
    } else if (part.trim()) {
      const pre = document.createElement("pre");
      pre.textContent = part.replace(/^\n+|\n+$/g, "");
      target.appendChild(pre);
    }
  });
}
