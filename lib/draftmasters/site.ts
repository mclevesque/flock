import { headers } from "next/headers";

/**
 * Which site is this request for?
 *
 * One deployment answers on both greatsouls.net and draftmasters.net. Nothing
 * about the game changes between them — same database, same accounts, same R2
 * bucket, same code — but the wording around it does: on its own domain the
 * game is the whole site, so it should not offer a way "back" to a hub the
 * visitor has never heard of.
 *
 * Kept here rather than inlined so the host list exists once. middleware.ts
 * has its own copy by necessity (it runs on the edge before this module is
 * reachable); these two lists are the only place the domain is named.
 */
const DRAFTMASTERS_HOSTS = new Set(["draftmasters.net", "www.draftmasters.net"]);

export async function isStandaloneSite(): Promise<boolean> {
  try {
    const host = (await headers()).get("host") ?? "";
    return DRAFTMASTERS_HOSTS.has(host.split(":")[0].toLowerCase());
  } catch {
    // Rendered without a request context — assume the hub.
    return false;
  }
}

export const BRAND = "DraftMasters";
