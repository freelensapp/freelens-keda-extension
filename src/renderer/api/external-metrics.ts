import { Renderer } from "@freelensapp/extensions";
import { ScaledObject } from "./scaledobject/scaledobject-v1alpha1";

// The current value of the triggers of a ScaledObject, from the external
// metrics API, `external.metrics.k8s.io`, which the metrics server of KEDA
// serves in every installation and the HPA reads. A ScaledJob has no HPA, and
// its triggers are not served there.

/** `ExternalMetricValueList` of `external.metrics.k8s.io/v1beta1`, reduced to what is read. */
interface ExternalMetricValueList {
  items?: { metricName?: string; value?: string }[];
}

/**
 * The index, in `spec.triggers`, of the trigger an external metric belongs to:
 * the controller names the metric `s<index>-<scaler>-...`. The cpu and memory
 * triggers are resource metrics of the HPA and have no external metric, so the
 * indexes of the names can skip.
 */
export function getTriggerIndex(metricName: string): number | undefined {
  const index = /^s(\d+)-/.exec(metricName)?.[1];

  return index === undefined ? undefined : Number(index);
}

/**
 * A quantity of the API as a plain number: `1500m` is 1.5.
 */
export function formatQuantity(quantity: string): string {
  // shortcut: only the milli suffix is converted, the one the metrics server writes for a fraction; a quantity with
  // another suffix is shown as the API writes it. Upgrade to a full parser if a scaler reports one.
  const milli = /^(-?\d+)m$/.exec(quantity)?.[1];

  return milli === undefined ? quantity : String(Number(milli) / 1000);
}

/**
 * The current value of each trigger of the object that has an external metric,
 * by the index of the trigger. A trigger whose metric cannot be read is left
 * out: the API is not served, or the user may not read it. Each request makes
 * the metrics server of KEDA ask the scaler, as a poll of the controller does.
 * Outside a cluster frame there is no cluster to ask, and no value.
 */
export async function getTriggerValues(object: ScaledObject): Promise<Map<number, string>> {
  const values = new Map<number, string>();
  const names = ScaledObject.getExternalMetricNames(object);

  if (names.length === 0) return values;

  // The host's client for a cluster, which knows how its proxy addresses one. A panel renders in a cluster frame,
  // where the active cluster of the catalog is the cluster of the frame. Asked for here, when a panel reads, never
  // when the module loads.
  const clusterId = Renderer.Catalog.getActiveCluster()?.id;

  if (!clusterId) return values;

  const api = Renderer.K8sApi.KubeJsonApi.forCluster(clusterId);
  const path = `/apis/external.metrics.k8s.io/v1beta1/namespaces/${object.getNs()}`;
  const query = { labelSelector: `scaledobject.keda.sh/name=${object.getName()}` };

  await Promise.all(
    names.map(async (name) => {
      const index = getTriggerIndex(name);

      if (index === undefined) return;

      try {
        const list = await api.get<ExternalMetricValueList>(`${path}/${name}`, { query });
        const value = list.items?.[0]?.value;

        if (value !== undefined) values.set(index, formatQuantity(value));
      } catch {
        // Left out, as documented above.
      }
    }),
  );

  return values;
}
