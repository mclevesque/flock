"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./Icon";
import { useSocial } from "./social-context";

/**
 * The three places the game cannot take you on its own.
 *
 * Deliberately three, not four. A "Packs" tab was in the design and is wrong
 * in the app: the deck IS this screen, so a tab pointing at where you already
 * are is a button that does nothing.
 *
 * Both shapes are rendered and CSS picks one, rather than measuring the
 * viewport in JavaScript — a width test in React gets the first paint wrong on
 * every server-rendered page, and this one is above the fold.
 *
 *   PHONE   a bar across the bottom, under the thumb.
 *   DESKTOP a rail down the left, because a wide screen has room going spare
 *           there and the middle needs to stay clear for the case.
 *
 * Friends is not a page change any more. It opens the friends sheet over
 * whatever you were looking at, so checking who is around or answering a
 * message does not cost you your place on the shelf. The unread count rides
 * on the icon. The /friends page still exists for links and bookmarks.
 */

type Entry = { href: string; icon: IconName; label: string; foot?: boolean; friends?: boolean };

/** The phone bar. Three, under the thumb, and nothing that is not a place. */
const TABS: Entry[] = [
  { href: "/draftmasters/friends", icon: "friends", label: "Friends", friends: true },
  { href: "/draftmasters/ladder", icon: "trophy", label: "Ladder" },
  { href: "/draftmasters/you", icon: "profile", label: "You" },
];

/**
 * The desktop rail, which has room for more than the bar does.
 *
 * Support sits at the bottom, set apart, because it is the one entry that is
 * not a place in the game — it is the way out when something is wrong, and a
 * mailto is the honest version of that until there is somewhere better to
 * send people.
 */
const RAIL: Entry[] = [
  { href: "/draftmasters", icon: "cards", label: "Draft" },
  { href: "/draftmasters/friends", icon: "friends", label: "Friends", friends: true },
  { href: "/draftmasters/ladder", icon: "trophy", label: "Ladder" },
  { href: "/draftmasters/you", icon: "profile", label: "You" },
  {
    href: "mailto:support@draftmasters.net?subject=DraftMasters",
    icon: "mail",
    label: "Support",
    foot: true,
  },
];

export default function BottomTabs() {
  const s = useSocial();
  const path = usePathname() ?? "";

  // On draftmasters.net the address bar drops the prefix, so match both forms.
  const here = (href: string) => {
    const short = href.replace(/^\/draftmasters/, "") || "/";
    return path === href || path === short;
  };

  const badge =
    s.unreadTotal > 0 ? (
      <span className="dm-tab-badge" aria-label={`${s.unreadTotal} unread`}>
        {s.unreadTotal > 9 ? "9+" : s.unreadTotal}
      </span>
    ) : null;

  const item = (t: Entry, cls: string, size: number, labelled: boolean) => {
    const inner = (
      <>
        <span className="dm-tab-icon">
          <Icon name={t.icon} size={size} />
          {t.friends && badge}
        </span>
        {labelled ? <span>{t.label}</span> : t.label}
      </>
    );
    if (t.friends && s.ready) {
      return (
        <button
          key={t.href}
          type="button"
          className={cls}
          title={t.label}
          data-on={s.isOpen ? "1" : "0"}
          aria-haspopup="dialog"
          onClick={() => s.open()}
        >
          {inner}
        </button>
      );
    }
    return (
      <Link key={t.href} href={t.href} className={cls} title={t.label} data-on={here(t.href) ? "1" : "0"}>
        {inner}
      </Link>
    );
  };

  return (
    <>
      <nav className="dm-tabs" aria-label="DraftMasters sections">
        {TABS.map((t) => item(t, "dm-tab", 19, false))}
      </nav>

      <nav className="dm-rail" aria-label="DraftMasters sections">
        {RAIL.filter((t) => !t.foot).map((t) => item(t, "dm-rail-item", 20, true))}

        <span className="dm-rail-gap" aria-hidden="true" />

        {RAIL.filter((t) => t.foot).map((t) => (
          <a key={t.href} href={t.href} className="dm-rail-item" title={t.label}>
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
