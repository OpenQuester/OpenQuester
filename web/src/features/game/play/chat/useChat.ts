import { useEffect, useRef, useState, type FormEvent } from "react";
import { findPlayer } from "@/game/selectors";
import { useLiveGame, useSession } from "../../GameContext";

/** Owns the message draft and scroll synchronization for one mounted chat body. */
export function useChat() {
  const session = useSession();
  const { connection, myId } = useLiveGame();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const muted = findPlayer(session, myId)?.restrictionData.muted ?? false;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [session.chat]);

  function onSend(e: FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message) return;
    connection.sendChat(message.slice(0, 255));
    setText("");
  }

  return { session, text, setText, listRef, muted, onSend };
}
