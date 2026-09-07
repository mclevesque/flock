import { PACKS } from "@/lib/draftmasters/packs";
import PortraitStudio from "./PortraitStudio";

export const metadata = {
  title: "Portrait studio — DraftMasters",
  description: "Fix every character portrait on a board in one sitting.",
};

/**
 * Only the board list is sent from the server. Entries and their resolved
 * pictures are fetched per board on the client, because loading all fourteen
 * boards' portraits up front would be a very slow page for a tool where you
 * only ever work on one board at a time.
 */
export default function PortraitStudioPage() {
  const packs = PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    blurb: p.blurb,
    imgContext: p.imgContext,
    scenario: p.scenario,
    criteria: p.criteria,
    entries: [],
  }));
  return <PortraitStudio packs={packs} />;
}
