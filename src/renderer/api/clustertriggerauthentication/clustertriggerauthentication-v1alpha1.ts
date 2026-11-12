import { Renderer } from "@freelensapp/extensions";

import type { KedaKubeObjectCRD, TriggerAuthenticationSpec, TriggerAuthenticationStatus } from "../types";

/**
 * A ClusterTriggerAuthentication of `keda.sh/v1alpha1`: a TriggerAuthentication
 * that triggers in any namespace may refer to. The Secrets and ConfigMaps it
 * names live in the namespace of the KEDA operator. Its logic is shared with
 * TriggerAuthentication, in `trigger-authentication.ts`.
 */
export class ClusterTriggerAuthentication extends Renderer.K8sApi.LensExtensionKubeObject<
  Renderer.K8sApi.KubeObjectMetadata,
  TriggerAuthenticationStatus,
  TriggerAuthenticationSpec
> {
  declare kind: "ClusterTriggerAuthentication";
  declare apiVersion: "keda.sh/v1alpha1";

  static readonly kind = "ClusterTriggerAuthentication";
  static readonly namespaced = false;
  static readonly apiBase = "/apis/keda.sh/v1alpha1/clustertriggerauthentications";

  static readonly crd: KedaKubeObjectCRD = {
    apiVersions: ["keda.sh/v1alpha1"],
    plural: "clustertriggerauthentications",
    singular: "clustertriggerauthentication",
    shortNames: ["cta", "clustertriggerauth"],
    title: "Cluster Trigger Authentications",
  };
}

// The host registers an API and a store for every version of a CRD the cluster
// serves, and `ClusterTriggerAuthentication.getStore()` resolves them, so the
// extension builds neither. The class names the type of that API for the list
// layout.
export class ClusterTriggerAuthenticationApi extends Renderer.K8sApi.KubeApi<ClusterTriggerAuthentication> {}
