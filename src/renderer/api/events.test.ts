import { describe, expect, it } from "vitest";
import { getEventLastSeen, newestEvents } from "./events";

import type { Renderer } from "@freelensapp/extensions";

type KubeEvent = Renderer.K8sApi.KubeEvent;

// The events as the API server returns them through /api/v1/events, with `null` for an empty timestamp.
const event = (fields: Record<string, unknown>) => ({ ...fields }) as unknown as KubeEvent;

// The core/v1 recorder of KEDA 2.20 and older.
const legacy = event({
  reason: "KEDAScalersStarted",
  firstTimestamp: "2026-11-07T10:00:00Z",
  lastTimestamp: "2026-11-07T10:05:00Z",
  eventTime: null,
});

// The events.k8s.io/v1 recorder of KEDA 2.21, for an event seen once and for a repeat.
const once = event({
  reason: "ScaledObjectReady",
  firstTimestamp: null,
  lastTimestamp: null,
  eventTime: "2026-11-07T10:10:00.123456Z",
});
const repeated = event({
  reason: "KEDAScaleTargetActivated",
  firstTimestamp: null,
  lastTimestamp: null,
  eventTime: "2026-11-07T09:00:00.000000Z",
  series: { count: 4, lastObservedTime: "2026-11-07T10:20:00.000000Z" },
});

describe("getEventLastSeen", () => {
  it("reads lastTimestamp, which the core/v1 recorder writes", () => {
    expect(getEventLastSeen(legacy)).toBe("2026-11-07T10:05:00Z");
  });

  it("reads eventTime for an event of the events.k8s.io/v1 recorder seen once", () => {
    expect(getEventLastSeen(once)).toBe("2026-11-07T10:10:00.123456Z");
  });

  it("reads the last observed time of the series for a repeat, as kubectl does", () => {
    expect(getEventLastSeen(repeated)).toBe("2026-11-07T10:20:00.000000Z");
  });

  it("falls back to firstTimestamp", () => {
    expect(getEventLastSeen(event({ firstTimestamp: "2026-11-07T08:00:00Z", lastTimestamp: null }))).toBe(
      "2026-11-07T08:00:00Z",
    );
  });

  it("is undefined for an event without any time", () => {
    expect(getEventLastSeen(event({ lastTimestamp: null, eventTime: null }))).toBeUndefined();
  });
});

describe("newestEvents", () => {
  it("orders the events of both recorders by when they were last seen, newest first", () => {
    expect(newestEvents([legacy, once, repeated], 20).map((e) => e.reason)).toEqual([
      "KEDAScaleTargetActivated",
      "ScaledObjectReady",
      "KEDAScalersStarted",
    ]);
  });

  it("keeps the newest events up to the limit, and leaves the given list as it was", () => {
    const events = [legacy, once, repeated];

    expect(newestEvents(events, 1)).toEqual([repeated]);
    expect(events).toEqual([legacy, once, repeated]);
  });
});
