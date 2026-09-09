"use client";

import Link from "next/link";
import Icon, { type IconName } from "./Icon";

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
 * They point at pages Great Souls already has: the accounts, friends and
 * ladder are shared between the two sites, which is the whole reason the
 * standalone domain needed no migration.
 */

/** The phone bar. Three, under the thumb, and nothing that is not a place. */
const TABS: { href: string; icon: IconName; label: string }[] = [
  { href: "/friends", icon: "friends", label: "Friends" },
  { href: "/leaderboards", icon: "trophy", label: "Ladder" },
  { href: "/profile", icon: "profile", label: "You" },
];

/**
 * The desktop rail, which has room for more than the bar does.
 *
 * Support sits at the bottom, set apart, because it is the one entry that is
 * not a place in the game — it is the way out when something is wrong, and a
 * mailto is the honest version of that until there is somewhere better to
 * send people.
 */
const RAIL: { href: string; icon: IconName; label: string; foot?: boolean }[] = [
  { href: "/draftmasters", icon: "cards", label: "Draft" },
  { href: "/friends", icon: "friends", label: "Friends" },
  { href: "/leaderboards", icon: "trophy", label: "Ladder" },
  { href: "/profile", icon: "profile", label: "You" },
  {
    href: "mailto:support@draftmasters.net?subject=DraftMasters",
    icon: "mail",
    label: "Support",
    foot: true,
  },
];

export default function BottomTabs() {
  return (
    <>
      <nav className="dm-tabs" aria-label="DraftMasters sections">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="dm-tab">
            <Icon name={t.icon} size={19} />
            {t.label}
          </Link>
        ))}
      </nav>

      <nav className="dm-rail" aria-label="DraftMasters sections">
        {RAIL.filter((t) => !t.foot).map((t) => (
          <Link key={t.href} href={t.href} className="dm-rail-item" title={t.label}>
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
          </Link>
        ))}

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
