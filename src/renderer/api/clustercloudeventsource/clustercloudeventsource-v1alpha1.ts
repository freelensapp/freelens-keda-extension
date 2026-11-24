import { Renderer } from "@freelensapp/extensions";

import type { CloudEventSourceSpec, CloudEventSourceStatus, KedaKubeObjectCRD } from "../types";

/**
 * A ClusterCloudEventSource of `eventing.keda.sh/v1alpha1`: a cluster-scoped
 * CloudEventSource. Its logic is shared with CloudEventSource, in
 * `cloud-event-source.ts`.
 */
export class ClusterCloudEventSource extends Renderer.K8sApi.LensExtensionKubeObject<
  Renderer.K8sApi.KubeObjectMetadata,
  CloudEventSourceStatus,
  CloudEventSourceSpec
> {
  declare kind: "ClusterCloudEventSource";
  declare apiVersion: "eventing.keda.sh/v1alpha1";

  static readonly kind = "ClusterCloudEventSource";
  static readonly namespaced = false;
  static readonly apiBase = "/apis/eventing.keda.sh/v1alpha1/clustercloudeventsources";

  // The CRD has no short names.
  static readonly crd: KedaKubeObjectCRD = {
    apiVersions: ["eventing.keda.sh/v1alpha1"],
    plural: "clustercloudeventsources",
    singular: "clustercloudeventsource",
    title: "Cluster Cloud Event Sources",
  };
}

// The host registers an API and a store for every version of a CRD the cluster
// serves, and `ClusterCloudEventSource.getStore()` resolves them, so the
// extension builds neither. The class names the type of that API for the list
// layout.
export class ClusterCloudEventSourceApi extends Renderer.K8sApi.KubeApi<ClusterCloudEventSource> {}
