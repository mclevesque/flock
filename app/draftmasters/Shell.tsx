"use client";

import Link from "next/link";
import BottomTabs from "./BottomTabs";
import Motes from "./Motes";
import Wordmark from "./Wordmark";

/**
 * The frame the small pages sit in.
 *
 * Friends, the ladder and your profile are the three places the game cannot
 * take you on its own, and they were pointing at the hub's versions — a chat
 * client, a nine-game leaderboard and a profile editor, none of which have
 * anything to do with drafting. These are DraftMasters' own, and this is the
 * chrome they share: the wordmark, the rail, the field of light, and nothing
 * else.
 */
export default function Shell({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    /* data-standalone for the same reason the game root has it: the hub's
       floating chat bubble and voice pill were sitting on these pages next to
       the game's own friends sheet — two chat systems for the same friends,
       one of which could not invite anybody to a draft. */
    <div className="dm" data-standalone="1">
      <Motes />
      <BottomTabs />

      <div className="dm-shell">
        <header className="dm-head">
          <div>
            <h1 className="dm-wordmark">
              <Link href="/draftmasters" aria-label="DraftMasters"><Wordmark /></Link>
            </h1>
            {lead && <p className="dm-tagline">{lead}</p>}
          </div>
        </header>

        <section className="dm-section dm-small-page">
          <p className="dm-eyebrow">{title}</p>
          {children}
        </section>
      </div>
    </div>
  );
}
