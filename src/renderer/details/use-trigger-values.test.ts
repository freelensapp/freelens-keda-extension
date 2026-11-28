// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as externalMetrics from "../api/external-metrics";
import { ScaledObject } from "../api/scaledobject/scaledobject-v1alpha1";
import { useTriggerValues } from "./use-trigger-values";

const buildScaledObject = (pollingInterval?: number, externalMetricNames: string[] = ["s0-prometheus"]) =>
  new ScaledObject({
    apiVersion: "keda.sh/v1alpha1",
    kind: "ScaledObject",
    metadata: {
      name: "checkout-api",
      namespace: "storefront",
      uid: "checkout-api-uid",
      selfLink: "/apis/keda.sh/v1alpha1/namespaces/storefront/scaledobjects/checkout-api",
    },
    spec: { scaleTargetRef: { name: "checkout-api" }, pollingInterval, triggers: [] },
    status: { externalMetricNames },
  });

// The value of the one trigger grows by one at every read.
const stubValues = () => {
  let reads = 0;

  return vi.spyOn(externalMetrics, "getTriggerValues").mockImplementation(async () => {
    reads += 1;

    return new Map([[0, String(reads)]]);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useTriggerValues", () => {
  it("reads the values when the panel opens, and again at the polling interval of the object", async () => {
    const read = stubValues();
    const { result } = renderHook(() => useTriggerValues(buildScaledObject(10)));

    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.get(0)).toBe("1");

    await act(() => vi.advanceTimersByTimeAsync(9_000));
    expect(read).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(result.current.get(0)).toBe("2");
  });

  it("refreshes every 30 seconds, the default of the controller, for an object with no polling interval", async () => {
    const read = stubValues();
    renderHook(() => useTriggerValues(buildScaledObject()));

    await act(() => vi.advanceTimersByTimeAsync(29_000));
    expect(read).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("refreshes no more often than every 5 seconds", async () => {
    const read = stubValues();
    renderHook(() => useTriggerValues(buildScaledObject(1)));

    await act(() => vi.advanceTimersByTimeAsync(4_000));
    expect(read).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("stops reading when the panel closes", async () => {
    const read = stubValues();
    const { unmount } = renderHook(() => useTriggerValues(buildScaledObject(10)));

    await act(() => vi.advanceTimersByTimeAsync(0));
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(read).toHaveBeenCalledTimes(1);
  });

  it("reads nothing for an object with no external metric", async () => {
    const read = stubValues();
    const { result } = renderHook(() => useTriggerValues(buildScaledObject(10, [])));

    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(read).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });
});
