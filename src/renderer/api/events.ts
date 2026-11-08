import type { Renderer } from "@freelensapp/extensions";

type KubeEvent = Renderer.K8sApi.KubeEvent;

/**
 * When an event was last seen, as the LAST SEEN column of `kubectl get events`
 * reads it: the `series.lastObservedTime` of a repeated event, else
 * `lastTimestamp`, else `firstTimestamp`, else `eventTime`.
 *
 * The recorder decides which of them an event has. The core/v1 recorder of
 * KEDA 2.20 and older writes the legacy timestamps; the events.k8s.io/v1
 * recorder of KEDA 2.21 (`mgr.GetEventRecorder`) writes `eventTime`, and
 * `series` for a repeat, and leaves the legacy ones empty, which the API
 * server returns as `null`.
 */
export function getEventLastSeen(event: KubeEvent): string | undefined {
  return event.series?.lastObservedTime ?? event.lastTimestamp ?? event.firstTimestamp ?? event.eventTime ?? undefined;
}

function lastSeenTime(event: KubeEvent): number {
  const time = Date.parse(getEventLastSeen(event) ?? "");
  return Number.isNaN(time) ? 0 : time;
}

/**
 * The newest `limit` events, by when they were last seen. The events of the
 * host's store stay in their order: the list is a sorted copy.
 */
export function newestEvents(events: readonly KubeEvent[], limit: number): KubeEvent[] {
  return events.toSorted((a, b) => lastSeenTime(b) - lastSeenTime(a)).slice(0, limit);
}
