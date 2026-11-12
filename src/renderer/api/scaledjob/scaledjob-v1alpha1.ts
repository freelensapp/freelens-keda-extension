import { Renderer } from "@freelensapp/extensions";
import {
  getConditionStatus,
  getStatusClass,
  getStatusText,
  isPausedValue,
  normalizeList,
  pausedAnnotation,
} from "../status-helpers";

import type { KedaKubeObjectCRD, ScaledJobSpec, ScaledJobStatus } from "../types";

export type { ScaledJobSpec, ScaledJobStatus };

/**
 * A ScaledJob of `keda.sh/v1alpha1` (KEDA v2): the KEDA operator creates a
 * Job from `jobTargetRef` for each event its scalers (triggers) report,
 * instead of scaling a long-running workload.
 */
export class ScaledJob extends Renderer.K8sApi.LensExtensionKubeObject<
  Renderer.K8sApi.KubeObjectMetadata,
  ScaledJobStatus,
  ScaledJobSpec
> {
  declare kind: "ScaledJob";
  declare apiVersion: "keda.sh/v1alpha1";

  static readonly kind = "ScaledJob";
  static readonly namespaced = true;
  static readonly apiBase = "/apis/keda.sh/v1alpha1/scaledjobs";

  static readonly crd: KedaKubeObjectCRD = {
    apiVersions: ["keda.sh/v1alpha1"],
    plural: "scaledjobs",
    singular: "scaledjob",
    shortNames: ["sj"],
    title: "Scaled Jobs",
  };

  /**
   * The READY column of `kubectl get sj`, from the Ready condition.
   */
  static getReady(object: ScaledJob): boolean | undefined {
    return getConditionStatus(object.status?.conditions, "Ready");
  }

  /**
   * The ACTIVE column of `kubectl get sj`: whether a trigger currently reports
   * activity.
   */
  static getActive(object: ScaledJob): boolean | undefined {
    return getConditionStatus(object.status?.conditions, "Active");
  }

  /**
   * The Status column: the conditions summed up with the controller's
   * precedence (`getStatusText` of the status helpers).
   */
  static getStatusText(object: ScaledJob): string {
    return getStatusText(object.status?.conditions);
  }

  static getStatusClass(object: ScaledJob): string {
    return getStatusClass(object.status?.conditions);
  }

  static getMin(object: ScaledJob): number | undefined {
    return object.spec.minReplicaCount;
  }

  static getMax(object: ScaledJob): number | undefined {
    return object.spec.maxReplicaCount;
  }

  /**
   * The TRIGGERS column of `kubectl get sj`: the scaler types, preferring the
   * list the controller wrote into the status over the one in the spec.
   */
  static getTriggerTypes(object: ScaledJob): string[] {
    return normalizeList(
      object.status?.triggersTypes,
      object.spec.triggers.map((trigger) => trigger.type),
    );
  }

  static getTriggerSummary(object: ScaledJob): string {
    return ScaledJob.getTriggerTypes(object).join(", ");
  }

  static getExternalMetricNames(object: ScaledJob): string[] {
    return normalizeList(object.status?.externalMetricNames, []);
  }

  /** Pauses the ScaledJob, which then creates no Jobs, when "true". It has no `paused-replicas`. */
  static readonly pausedAnnotation = pausedAnnotation;

  /**
   * Whether the pause annotation is in effect on the object, with a value
   * the controller reads as true (`isPausedValue`).
   */
  static getPausedAnnotation(object: ScaledJob): boolean {
    return isPausedValue(object.metadata.annotations?.[ScaledJob.pausedAnnotation]);
  }
}

// The host registers an API and a store for every version of a CRD the cluster
// serves, and `ScaledJob.getStore()` resolves them, so the extension builds
// neither. The class names the type of that API for the list layout.
export class ScaledJobApi extends Renderer.K8sApi.KubeApi<ScaledJob> {}
