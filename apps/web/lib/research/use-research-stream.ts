"use client";

// Client hook: open the SSE stream, parse frames, fold them through the same
// pure reducer the server uses. Uses fetch + ReadableStream (not EventSource)
// because the request carries a POST body. Returns the live ResearchState plus
// start/reset controls.

import { useCallback, useReducer, useRef } from "react";
import type { NornTier } from "@autopoly/norns";
import { parseResearchEvent } from "./events";
import {
  initialResearchState,
  researchReducer,
  type ResearchState
} from "./state-machine";
import type { ResearchEvent } from "./events";

export interface StartResearchInput {
  eventText: string;
  marketPrice?: number | null;
  tier?: NornTier;
}

const RESET = { type: "__reset__" } as const;

type InternalAction = ResearchEvent | typeof RESET;

function reducer(state: ResearchState, action: InternalAction): ResearchState {
  if (action.type === "__reset__") {
    return initialResearchState();
  }
  return researchReducer(state, action);
}

export interface UseResearchStream {
  state: ResearchState;
  start: (input: StartResearchInput) => Promise<void>;
  reset: () => void;
  abort: () => void;
}

export function useResearchStream(): UseResearchStream {
  const [state, dispatch] = useReducer(reducer, undefined, initialResearchState);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abort();
    dispatch(RESET);
  }, [abort]);

  const start = useCallback(
    async (input: StartResearchInput) => {
      abort();
      dispatch(RESET);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/research/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
          signal: controller.signal
        });

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => ({}));
          dispatch({
            type: "run.error",
            message: (detail as { error?: string }).error ?? `请求失败（${response.status}）`
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            for (const line of frame.split("\n")) {
              if (!line.startsWith("data:")) {
                continue;
              }
              const event = parseResearchEvent(line.slice(5).trim());
              if (event) {
                dispatch(event);
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        dispatch({
          type: "run.error",
          message: error instanceof Error ? error.message : String(error)
        });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [abort]
  );

  return { state, start, reset, abort };
}
