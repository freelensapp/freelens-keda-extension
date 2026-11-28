import { useEffect, useState } from "react";
import { getTriggerValues } from "../api/external-metrics";
import { ScaledObject } from "../api/scaledobject/scaledobject-v1alpha1";

/** The polling interval of the controller when the object sets none, in seconds. */
const defaultPollingInterval = 30;

/** The shortest refresh, in seconds, whatever the polling interval of the object. */
const minRefreshInterval = 5;

/**
 * The current value of the triggers of a ScaledObject, by the index of the
 * trigger, read when the panel opens and again at the polling interval of the
 * object while it stays open: the controller reads the scalers no more often,
 * and every read reaches the system behind the scaler. Empty until the first
 * read, and for an object with no external metric, which makes no request.
 */
export function useTriggerValues(object: ScaledObject): ReadonlyMap<number, string> {
  const [values, setValues] = useState<ReadonlyMap<number, string>>(new Map());
  // The store of the host replaces the object when it changes, so the effect follows what the requests depend on,
  // which stand for the object in its dependencies.
  const id = object.getId();
  const names = ScaledObject.getExternalMetricNames(object).join(",");
  const interval = Math.max(object.spec.pollingInterval ?? defaultPollingInterval, minRefreshInterval) * 1000;

  useEffect(() => {
    if (!names) {
      setValues(new Map());

      return;
    }

    let closed = false;
    const read = async () => {
      const next = await getTriggerValues(object);

      if (!closed) setValues(next);
    };

    read();

    const timer = setInterval(read, interval);

    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, [id, names, interval]);

  return values;
}
