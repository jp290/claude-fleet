// K15 · WAS EINE KONSTELLATION ERLAUBT, das Modell (die Ansicht steht in src/k15-erlaubt.ts): je Session, womit sie läuft und was sie darf.
import { agentVon, agentWort, standardAgent, type Katalog } from "./k15-agent";
import { alle, aspektWert, type Konst, type Profil } from "./k15-entwurf-modell";
import { modelLabel } from "./modelname";

export interface Erlaubt { pos: string; name: string; satz: string; warnung: string | null }

export function erlaubtZeilen(k: Konst, profile: readonly Profil[], katalog: Katalog | null): Erlaubt[] {
  return alle(k.wurzeln).map((q) => {
    const p = profile.find((x) => x.id === q.profil);
    if (!p) return { pos: q.id, name: q.name, satz: `Profil „${q.profil}“ fehlt hier`, warnung: "startet so nicht" };
    const agent = q.abw?.agent ?? p.agent ?? (katalog ? standardAgent(katalog) : null) ?? "claude";
    const aus = katalog ? agentVon(katalog, agent)?.aus ?? (agentVon(katalog, agent) ? null : { wort: "fehlt", grund: "hier nicht eingerichtet" }) : null;
    const modell = q.abw?.modell ?? p.modell, perm = aspektWert("permission-mode", p, q);
    const datei = q.datei ?? p.datei;
    const auto = p.autonomie?.filter((x) => x.art !== "weg") ?? null;
    const bausteine = Object.keys({ ...p.schalter, ...q.schalter }).length;
    const teile = [
      `${p.name} v${p.v}${p.autor !== "Fleet" ? ` von ${p.autor}` : ""}`,
      `${agentWort(agent)} · ${modell ? modelLabel(modell) : katalog?.standardModell && agent === "claude" ? `Standard-Modell (${modelLabel(katalog.standardModell)})` : "Standard-Modell"}`,
      agent === "claude" ? `Permission-Mode ${String(perm)}` : `Permission-Mode ${String(perm)} gilt hier nicht (nur Claude Code)`,
      datei ? `eigene Agent-MD „${datei.titel}“ (${datei.abschnitte.length} Abschnitte)` : "ohne eigene Agent-MD",
      auto ? `Autonomie eigen: ${auto.filter((x) => x.art === "selbst").length} selbst, ${auto.filter((x) => x.art === "fragt").length} fragt, ${auto.filter((x) => x.art === "nie").length} nie` : "Autonomie wie die Rollenkarte",
      ...(bausteine ? [`${bausteine} Bausteine abweichend`] : []),
    ];
    return { pos: q.id, name: q.name, satz: teile.join(" · "), warnung: aus ? `startet hier nicht: ${agentWort(agent)} ${aus.wort} (${aus.grund})` : null };
  });
}
