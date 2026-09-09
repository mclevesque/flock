"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "../Shell";
import Icon from "../Icon";
import type { PlayerRecord } from "../types";

/**
 * Who you play against.
 *
 * Deliberately not the hub's friends page, which is a messaging client with a
 * roster attached. Here a friend is somebody you can start a draft with, and
 * the only three things worth knowing are whether they are online, how they
 * have been doing, and how to get them into a room.
 *
 * The mini chat is one line per friend and lives on the invite, not on a
 * separate screen: "come and play" is the whole conversation this page needs
 * to support, and anything more belongs in the room where the draft is.
 */

interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  online: boolean;
  record: PlayerRecord | null;
}

interface Pending {
  id: string;
  username: string;
  display_name?: string | null;
}

export default function FriendsClient({ myName }: { myName: string }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [add, setAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/draftmasters/social");
      const d = await r.json();
      setFriends(d.friends ?? []);
      setPending(d.pending ?? []);
    } catch { /* offline; the page still renders */ }
    setLoaded(true);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (body: Record<string, string>) => {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/draftmasters/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      setNote(r.ok ? "Done." : d.error ?? "That did not work.");
      if (r.ok) { setAdd(""); void load(); }
    } catch {
      setNote("That did not work.");
    }
    setBusy(false);
  };

  /**
   * Open a room and put the link on the clipboard in one go.
   *
   * The room code IS the invite, so there is nothing to send from here that
   * the room cannot send better — this just gets you both to the same place
   * with one click instead of three.
   */
  const invite = async (f: Friend) => {
    const url = `${window.location.origin}/draftmasters?invite=${encodeURIComponent(f.username)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNote(`Link copied — send it to ${f.displayName}.`);
    } catch {
      setNote(url);
    }
  };

  return (
    <Shell title="Friends" lead="The people you draft against.">
      <div className="dm-add-row">
        <input
          className="dm-input"
          placeholder="Add someone by name"
          value={add}
          onChange={(e) => setAdd(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && add.trim()) void act({ action: "add", username: add }); }}
          aria-label="Add a friend by username"
        />
        <button
          type="button"
          className="dm-btn dm-btn-primary"
          disabled={busy || !add.trim()}
          onClick={() => void act({ action: "add", username: add })}
        >
          Add
        </button>
      </div>
      {note && <p className="dm-note dm-add-note">{note}</p>}

      {pending.length > 0 && (
        <>
          <p className="dm-eyebrow dm-sub">Waiting on you</p>
          {pending.map((p) => (
            <div key={p.id} className="dm-friend">
              <span className="dm-friend-face">{(p.display_name ?? p.username).charAt(0).toUpperCase()}</span>
              <span className="dm-friend-who"><b>{p.display_name ?? p.username}</b><em>wants to play</em></span>
              <button className="dm-btn dm-btn-primary" onClick={() => void act({ action: "accept", userId: p.id })}>
                Accept
              </button>
              <button className="dm-btn dm-btn-ghost" onClick={() => void act({ action: "decline", userId: p.id })}>
                No
              </button>
            </div>
          ))}
        </>
      )}

      {loaded && !friends.length && (
        <p className="dm-note dm-empty">
          Nobody yet. Add someone by name above — they need an account on this site,
          and {myName} is the name they will be looking for.
        </p>
      )}

      {friends.map((f) => (
        <div key={f.id} className="dm-friend">
          <span className="dm-friend-face" data-online={f.online ? "1" : "0"}>
            {f.avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={f.avatar} alt="" />
              : f.displayName.charAt(0).toUpperCase()}
          </span>
          <span className="dm-friend-who">
            <b>{f.displayName}</b>
            <em>
              {f.record
                ? `${f.record.rating} · ${f.record.pvpWins}W ${f.record.pvpLosses}L`
                : "no drafts yet"}
              {f.online ? " · online" : ""}
            </em>
          </span>
          <button type="button" className="dm-btn dm-btn-primary" onClick={() => void invite(f)}>
            <Icon name="link" size={15} /> Invite
          </button>
        </div>
      ))}
    </Shell>
  );
}
