import { describe, expect, it } from "vitest";
import { ScaledJob } from "./scaledjob-v1alpha1";

const buildScaledJob = (
  status?: ScaledJob["status"],
  annotations?: Record<string, string>,
  triggers: ScaledJob["spec"]["triggers"] = [{ type: "cron", metadata: {} }],
) =>
  new ScaledJob({
    apiVersion: "keda.sh/v1alpha1",
    kind: "ScaledJob",
    metadata: {
      name: "example-job",
      namespace: "default",
      selfLink: "/apis/keda.sh/v1alpha1/namespaces/default/scaledjobs/example-job",
      annotations,
    },
    spec: { jobTargetRef: { template: { metadata: {}, spec: {} } }, triggers },
    status,
  });

describe("ScaledJob (v1alpha1)", () => {
  it("is namespaced and serves keda.sh/v1alpha1", () => {
    expect(ScaledJob.kind).toBe("ScaledJob");
    expect(ScaledJob.namespaced).toBe(true);
    expect(ScaledJob.apiBase).toBe("/apis/keda.sh/v1alpha1/scaledjobs");
    expect(ScaledJob.crd.apiVersions).toEqual(["keda.sh/v1alpha1"]);
    expect(ScaledJob.crd.shortNames).toEqual(["sj"]);
  });

  describe("getStatusText", () => {
    it("returns the reason of a Ready condition with status False", () => {
      const object = buildScaledJob({
        conditions: [{ type: "Ready", status: "False", reason: "ScaledJobCheckFailed" }],
      });
      expect(ScaledJob.getStatusText(object)).toBe("ScaledJobCheckFailed");
      expect(ScaledJob.getStatusClass(object)).toBe("error");
    });

    it("returns Paused over Active for a paused ScaledJob", () => {
      const object = buildScaledJob({
        conditions: [
          { type: "Ready", status: "True" },
          { type: "Active", status: "True" },
          { type: "Paused", status: "True" },
        ],
      });
      expect(ScaledJob.getStatusText(object)).toBe("Paused");
      expect(ScaledJob.getStatusClass(object)).toBe("info");
    });

    it("returns Active for an Active condition with status True", () => {
      const object = buildScaledJob({
        conditions: [
          { type: "Ready", status: "True" },
          { type: "Active", status: "True" },
        ],
      });
      expect(ScaledJob.getStatusText(object)).toBe("Active");
      expect(ScaledJob.getReady(object)).toBe(true);
      expect(ScaledJob.getActive(object)).toBe(true);
    });

    it("returns Unknown without conditions", () => {
      expect(ScaledJob.getStatusText(buildScaledJob())).toBe("Unknown");
      expect(ScaledJob.getReady(buildScaledJob())).toBeUndefined();
    });
  });

  describe("getTriggerSummary", () => {
    it("splits the comma-separated string the controller writes into the status", () => {
      expect(ScaledJob.getTriggerSummary(buildScaledJob({ triggersTypes: "cron,rabbitmq" }))).toBe("cron, rabbitmq");
    });

    it("falls back to the triggers of the spec", () => {
      const object = buildScaledJob(undefined, undefined, [
        { type: "cron", metadata: {} },
        { type: "prometheus", metadata: {} },
      ]);
      expect(ScaledJob.getTriggerSummary(object)).toBe("cron, prometheus");
    });
  });

  describe("getPausedAnnotation", () => {
    it("is true when the paused annotation is true", () => {
      expect(ScaledJob.getPausedAnnotation(buildScaledJob(undefined, { [ScaledJob.pausedAnnotation]: "true" }))).toBe(
        true,
      );
    });

    it("is true for a value the controller cannot parse, which it reads as paused", () => {
      expect(ScaledJob.getPausedAnnotation(buildScaledJob(undefined, { [ScaledJob.pausedAnnotation]: "yes" }))).toBe(
        true,
      );
    });

    it("is false when the paused annotation is false or absent", () => {
      expect(ScaledJob.getPausedAnnotation(buildScaledJob(undefined, { [ScaledJob.pausedAnnotation]: "False" }))).toBe(
        false,
      );
      expect(ScaledJob.getPausedAnnotation(buildScaledJob())).toBe(false);
    });

    // paused-replicas pauses a ScaledObject only; the ScaledJob controller does not read it.
    it("ignores paused-replicas", () => {
      expect(
        ScaledJob.getPausedAnnotation(buildScaledJob(undefined, { "autoscaling.keda.sh/paused-replicas": "0" })),
      ).toBe(false);
    });
  });
});
