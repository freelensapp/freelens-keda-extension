import { Renderer } from "@freelensapp/extensions";
import {
  getConditionStatus,
  getStatusClass,
  getStatusText,
  isPausedValue,
  normalizeList,
  pausedAnnotation,
  pausedReplicasAnnotation,
} from "../status-helpers";

import type { KedaKubeObjectCRD, ScaledObjectSpec, ScaledObjectStatus } from "../types";

export type { ScaledObjectSpec, ScaledObjectStatus };

/**
 * A ScaledObject of `keda.sh/v1alpha1` (KEDA v2): declares how the KEDA
 * operator scales the referenced workload, and which scalers (triggers)
 * produce the metric values.
 */
export class ScaledObject extends Renderer.K8sApi.LensExtensionKubeObject<
  Renderer.K8sApi.KubeObjectMetadata,
  ScaledObjectStatus,
  ScaledObjectSpec
> {
  declare kind: "ScaledObject";
  declare apiVersion: "keda.sh/v1alpha1";

  static readonly kind = "ScaledObject";
  static readonly namespaced = true;
  static readonly apiBase = "/apis/keda.sh/v1alpha1/scaledobjects";

  static readonly crd: KedaKubeObjectCRD = {
    apiVersions: ["keda.sh/v1alpha1"],
    plural: "scaledobjects",
    singular: "scaledobject",
    shortNames: ["so"],
    title: "Scaled Objects",
  };

  /**
   * The READY column of `kubectl get so`, from the Ready condition.
   */
  static getReady(object: ScaledObject): boolean | undefined {
    return getConditionStatus(object.status?.conditions, "Ready");
  }

  /**
   * From the Active condition: whether a trigger currently reports activity.
   */
  static getActive(object: ScaledObject): boolean | undefined {
    return getConditionStatus(object.status?.conditions, "Active");
  }

  /**
   * From the Fallback condition: whether the fallback replicas are in use.
   */
  static getFallback(object: ScaledObject): boolean | undefined {
    return getConditionStatus(object.status?.conditions, "Fallback");
  }

  /**
   * The Status column: the conditions summed up with the controller's
   * precedence (`getStatusText` of the status helpers).
   */
  static getStatusText(object: ScaledObject): string {
    return getStatusText(object.status?.conditions);
  }

  static getStatusClass(object: ScaledObject): string {
    return getStatusClass(object.status?.conditions);
  }

  /**
   * The kind of the scale target. The controller resolves it into the status
   * as a GVK string, `<group>/<version>.<kind>` (`apps/v1.Deployment`), so the
   * kind is what follows the last dot. Until the controller has resolved it,
   * and for an object it rejects, such as a second ScaledObject on the same
   * workload, it is the kind of the spec, or Deployment, the controller's
   * default.
   */
  static getScaleTargetKind(object: ScaledObject): string {
    const resolved = object.status?.scaleTargetKind;
    if (resolved) return resolved.slice(resolved.lastIndexOf(".") + 1);
    return object.spec.scaleTargetRef.kind ?? "Deployment";
  }

  /**
   * The SCALETARGETKIND and SCALETARGETNAME columns of `kubectl get so` as one
   * `kind/name`, with the kind alone, so that the target reads the same
   * before and after the controller has resolved it.
   */
  static getScaleTarget(object: ScaledObject): string {
    return `${ScaledObject.getScaleTargetKind(object)}/${object.spec.scaleTargetRef.name}`;
  }

  static getMin(object: ScaledObject): number | undefined {
    return object.spec.minReplicaCount;
  }

  static getMax(object: ScaledObject): number | undefined {
    return object.spec.maxReplicaCount;
  }

  /**
   * The TRIGGERS column of `kubectl get so`: the scaler types, preferring the
   * list the controller wrote into the status over the one in the spec.
   */
  static getTriggerTypes(object: ScaledObject): string[] {
    return normalizeList(
      object.status?.triggersTypes,
      object.spec.triggers.map((trigger) => trigger.type),
    );
  }

  static getTriggerSummary(object: ScaledObject): string {
    return ScaledObject.getTriggerTypes(object).join(", ");
  }

  static getAuthenticationTypes(object: ScaledObject): string[] {
    return normalizeList(object.status?.authenticationsTypes, []);
  }

  static getExternalMetricNames(object: ScaledObject): string[] {
    return normalizeList(object.status?.externalMetricNames, []);
  }

  /** Pauses the target at its current replica count when "true" (KEDA 2.12 or newer). */
  static readonly pausedAnnotation = pausedAnnotation;

  /** Pauses the target at the given replica count; wins over `pausedAnnotation` when both are set. */
  static readonly pausedReplicasAnnotation = pausedReplicasAnnotation;

  /**
   * Whether one of the pause annotations is in effect on the object, which is
   * what the menu items write: `paused-replicas` with any value, or `paused`
   * with a value the controller reads as true (`isPausedValue`).
   */
  static getPausedAnnotation(object: ScaledObject): boolean {
    const annotations = object.metadata.annotations ?? {};
    if (ScaledObject.pausedReplicasAnnotation in annotations) return true;
    return isPausedValue(annotations[ScaledObject.pausedAnnotation]);
  }
}

// The host registers an API and a store for every version of a CRD the cluster
// serves, and `ScaledObject.getStore()` resolves them, so the extension builds
// neither. The class names the type of that API for the list layout.
export class ScaledObjectApi extends Renderer.K8sApi.KubeApi<ScaledObject> {}
