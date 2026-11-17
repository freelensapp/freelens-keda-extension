import { Renderer } from "@freelensapp/extensions";

import type { CloudEventSourceSpec, CloudEventSourceStatus, KedaKubeObjectCRD } from "../types";

export type { CloudEventSourceSpec, CloudEventSourceStatus };

/**
 * A CloudEventSource of `eventing.keda.sh/v1alpha1`: where KEDA sends its
 * events, as CloudEvents. The controller of KEDA 2.21 does not pick the events
 * by the namespace of the object: every active source gets the events of the
 * objects of every namespace. Its logic, which ClusterCloudEventSource shares,
 * is in `cloud-event-source.ts`.
 */
export class CloudEventSource extends Renderer.K8sApi.LensExtensionKubeObject<
  Renderer.K8sApi.KubeObjectMetadata,
  CloudEventSourceStatus,
  CloudEventSourceSpec
> {
  declare kind: "CloudEventSource";
  declare apiVersion: "eventing.keda.sh/v1alpha1";

  static readonly kind = "CloudEventSource";
  static readonly namespaced = true;
  static readonly apiBase = "/apis/eventing.keda.sh/v1alpha1/cloudeventsources";

  // The CRD has no short names.
  static readonly crd: KedaKubeObjectCRD = {
    apiVersions: ["eventing.keda.sh/v1alpha1"],
    plural: "cloudeventsources",
    singular: "cloudeventsource",
    title: "Cloud Event Sources",
  };
}

// The host registers an API and a store for every version of a CRD the cluster
// serves, and `CloudEventSource.getStore()` resolves them, so the extension
// builds neither. The class names the type of that API for the list layout.
export class CloudEventSourceApi extends Renderer.K8sApi.KubeApi<CloudEventSource> {}
