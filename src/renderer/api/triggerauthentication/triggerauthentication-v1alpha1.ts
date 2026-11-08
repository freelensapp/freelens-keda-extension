import { Renderer } from "@freelensapp/extensions";

import type { KedaKubeObjectCRD, TriggerAuthenticationSpec, TriggerAuthenticationStatus } from "../types";

export type { TriggerAuthenticationSpec, TriggerAuthenticationStatus };

/**
 * A TriggerAuthentication of `keda.sh/v1alpha1`: where the triggers that
 * refer to it, in its namespace, take their credentials from. Its logic,
 * which ClusterTriggerAuthentication shares, is in `trigger-authentication.ts`.
 */
export class TriggerAuthentication extends Renderer.K8sApi.LensExtensionKubeObject<
  Renderer.K8sApi.KubeObjectMetadata,
  TriggerAuthenticationStatus,
  TriggerAuthenticationSpec
> {
  declare kind: "TriggerAuthentication";
  declare apiVersion: "keda.sh/v1alpha1";

  static readonly kind = "TriggerAuthentication";
  static readonly namespaced = true;
  static readonly apiBase = "/apis/keda.sh/v1alpha1/triggerauthentications";

  static readonly crd: KedaKubeObjectCRD = {
    apiVersions: ["keda.sh/v1alpha1"],
    plural: "triggerauthentications",
    singular: "triggerauthentication",
    shortNames: ["ta", "triggerauth"],
    title: "Trigger Authentications",
  };
}

// The host registers an API and a store for every version of a CRD the cluster
// serves, and `TriggerAuthentication.getStore()` resolves them, so the
// extension builds neither. The class names the type of that API for the list
// layout.
export class TriggerAuthenticationApi extends Renderer.K8sApi.KubeApi<TriggerAuthentication> {}
