"use client";

import Shell from "../Shell";
import { FriendsPanel } from "../FriendsDrawer";
import { useSocial } from "../social-context";

/**
 * Friends, as a page — for the /friends link, bookmarks and anyone arriving
 * from outside. In the game itself the same list opens as a sheet over the
 * shelf (see FriendsDrawer), and tapping a friend here opens that chat on top
 * of this page rather than navigating away from it.
 *
 * There is no invite button on a friend. An invite is a room you are hosting;
 * it is sent from inside that room and arrives in their chat as a card.
 */
export default function FriendsClient() {
  const s = useSocial();
  return (
    <Shell title="Friends" lead="The people you draft against — and talk to.">
      {s.ready ? <FriendsPanel page /> : <p className="dm-note dm-empty">Loading your friends…</p>}
    </Shell>
  );
}
