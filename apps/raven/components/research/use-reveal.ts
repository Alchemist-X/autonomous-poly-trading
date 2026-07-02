"use client";

// Staggered reveal for the research feed (Manus-style progressive
// disclosure): items that arrive after the first snapshot enter one at a
// time instead of a whole round popping in at once. While not streaming
// (demo replay, terminal runs) everything is visible immediately.

import { useEffect, useMemo, useRef, useState } from "react";

const STEP_MS = 460;
const SEED_ANIMATE_MAX = 6; // animate the initial snapshot only when it's small

const SEP = "\n"; // ids never contain newlines (ledger ids / "itNN" keys)

export interface RevealState {
  visible: ReadonlySet<string>;
  animated: ReadonlySet<string>;
}

export function useStaggeredReveal(ids: readonly string[], streaming: boolean): RevealState {
  const idsKey = useMemo(() => ids.join(SEP), [ids]);
  const [visible, setVisible] = useState<ReadonlySet<string>>(() => new Set());
  const [animated, setAnimated] = useState<ReadonlySet<string>>(() => new Set());
  const queue = useRef<readonly string[]>([]);
  const known = useRef<ReadonlySet<string>>(new Set());
  const seeded = useRef(false);

  useEffect(() => {
    const list = idsKey.length === 0 ? [] : idsKey.split(SEP);
    if (!streaming) {
      // Terminal or replay: flush everything, no queue.
      queue.current = [];
      known.current = new Set(list);
      seeded.current = true;
      setVisible((prev) => (prev.size === list.length ? prev : new Set(list)));
      return;
    }
    if (!seeded.current) {
      // First snapshot after mount: render instantly when joining a run that
      // already has lots of evidence, otherwise let it stream in.
      seeded.current = true;
      known.current = new Set(list);
      if (list.length > SEED_ANIMATE_MAX) {
        setVisible(new Set(list));
      } else {
        queue.current = [...list];
      }
      return;
    }
    const fresh = list.filter((id) => !known.current.has(id));
    if (fresh.length === 0) return;
    known.current = new Set([...known.current, ...fresh]);
    queue.current = [...queue.current, ...fresh];
  }, [idsKey, streaming]);

  useEffect(() => {
    if (!streaming) return;
    const timer = setInterval(() => {
      const next = queue.current[0];
      if (!next) return;
      queue.current = queue.current.slice(1);
      setAnimated((prev) => new Set([...prev, next]));
      setVisible((prev) => new Set([...prev, next]));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [streaming]);

  return { visible, animated };
}
