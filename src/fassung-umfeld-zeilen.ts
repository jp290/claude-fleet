// WAS DEN SITZ AUSSER FLEETS ZEILE FORMT, im Setup-Block des Boards: je Abschnitt der Fassung (server/fassung-umfeld.ts) eine Zeile mit
// kurzem Wert; der ganze Text und seine Quelle stehen im Tooltip. Was dem Owner gehört, sagt es: es zählt im Hash, reist aber nicht mit.
// Kein DOM; src/board.ts zeichnet die Zeilen.
export interface UmfeldAbschnitt {
  readonly id: string; readonly quelle: string | null; readonly text: string | null; readonly bytes: number | "unknown";
  readonly grund?: string; readonly eigentum?: "owner";
  readonly dateien?: readonly { readonly pfad: string; readonly bytes: number; readonly eigentum?: "owner" }[];
}
export interface UmfeldTeil { readonly id: string; readonly abschnitte: readonly UmfeldAbschnitt[] }
export interface UmfeldZeile { readonly label: string; readonly wert: string; readonly titel: string; readonly eigen: boolean }

export const EIGEN_WORT = "deins, reist nicht mit";
// der Lader der Projektregeln nennt absolute Pfade; gezeigt wird das Home als ~, wie in den übrigen Zeilen
const kurz = (pfad: string): string => pfad.replace(/^\/(?:Users|home)\/[^/]+\//, "~/");
const kB = (b: number): string => b < 1000 ? `${b} B` : `${(b / 1000).toFixed(1).replace(".", ",")} kB`;
// eine Hook-Zeile beginnt am Rand; ihre Skript- und Quellzeilen sind eingerückt
const hookZahl = (a: UmfeldAbschnitt | undefined): number =>
  a?.text && a.text !== "(keine Hooks)" ? a.text.split("\n").filter((z) => z && !z.startsWith(" ") && !z.startsWith("(")).length : 0;
const titel = (a: UmfeldAbschnitt): string => [a.text ?? a.grund ?? "", a.quelle ? `Quelle: ${a.quelle}` : ""].filter(Boolean).join("\n\n");

export function umfeldZeilen(teile: readonly UmfeldTeil[]): UmfeldZeile[] {
  const alle = new Map(teile.flatMap((t) => t.abschnitte.map((a) => [a.id, a] as const)));
  const zeilen: UmfeldZeile[] = [];
  const schwelle = alle.get("schwelle"), warm = alle.get("warmhalten");
  if (schwelle) zeilen.push({ label: "Übergabe", wert: schwelle.text ?? schwelle.grund ?? "unbekannt", titel: titel(schwelle), eigen: false });
  if (warm) zeilen.push({ label: "Warmhalten", wert: (warm.text ?? warm.grund ?? "unbekannt").split("\n")[0]!.replace(/^Cache warmhalten /, ""),
    titel: titel(warm), eigen: false });
  const repo = alle.get("hooks"), eigene = alle.get("hooks-eigene");
  if (repo || eigene) zeilen.push({ label: "Hooks", wert: `${hookZahl(repo)} vom Repo · ${hookZahl(eigene)} eigene`,
    titel: [repo, eigene].flatMap((a) => a ? [titel(a)] : []).join("\n\n———\n\n"), eigen: hookZahl(eigene) > 0 });
  const plugins = alle.get("plugins");
  if (plugins) {
    const an = (plugins.text ?? "").split("\n").filter((z) => / · an /.test(z)).map((z) => z.split(" ")[0]!.split("@")[0]!);
    zeilen.push({ label: "Plugins", wert: plugins.text === null ? plugins.grund ?? "unbekannt" : an.length ? an.join(", ") : "keine",
      titel: titel(plugins), eigen: plugins.eigentum === "owner" && an.length > 0 });
  }
  const einst = alle.get("cc-einstellungen-eigene");
  if (einst) zeilen.push({ label: "Einstellungen", wert: einst.dateien?.length ? einst.dateien.map((d) => `${d.pfad} ${kB(d.bytes)}`).join(" · ") : "keine eigene Datei",
    titel: titel(einst), eigen: !!einst.dateien?.length });
  // das übrige Eigene in ~/.claude: je Art die Zahl, wie die erste Zeile jeder Art sie nennt („Agenten 13: …“)
  const eigenes = alle.get("claude-eigenes");
  if (eigenes?.text) {
    const zahlen = eigenes.text.split("\n").flatMap((z) => { const m = /^(Agenten|Skills|Befehle|Ausgabestile|Regeln|MCP-Server)[^\d]*(\d+)/.exec(z); return m && m[2] !== "0" ? [`${m[2]} ${m[1] === "MCP-Server" ? "MCP" : m[1]}`] : []; });
    zeilen.push({ label: "Eigenes", wert: zahlen.length ? zahlen.join(" · ") : "nichts", titel: titel(eigenes), eigen: zahlen.length > 0 });
  }
  const regeln = [...alle.values()].flatMap((a) => (a.dateien ?? []).filter((d) => d.eigentum === "owner" && !a.id.startsWith("cc-") && a.id !== "claude-eigenes"));
  if (regeln.length) zeilen.push({ label: "Eigene Regeln", wert: regeln.map((d) => `${kurz(d.pfad)} ${kB(d.bytes)}`).join(" · "),
    titel: "Deine Claude-Code-Dateien, die dieser Sitz unter „Liest“ lädt", eigen: true });
  return zeilen;
}
