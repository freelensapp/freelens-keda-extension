// @vitest-environment jsdom

import { Renderer } from "@freelensapp/extensions";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScaledJob } from "../api/scaledjob/scaledjob-v1alpha1";
import { ScaledObject } from "../api/scaledobject/scaledobject-v1alpha1";
import { PauseMenuItem } from "./pause-menu-item";

const PAUSED = "autoscaling.keda.sh/paused";
const PAUSED_REPLICAS = "autoscaling.keda.sh/paused-replicas";

const buildScaledObject = (annotations?: Record<string, string>) =>
  new ScaledObject({
    apiVersion: "keda.sh/v1alpha1",
    kind: "ScaledObject",
    metadata: {
      name: "example-app",
      namespace: "default",
      selfLink: "/apis/keda.sh/v1alpha1/namespaces/default/scaledobjects/example-app",
      annotations,
    },
    spec: { scaleTargetRef: { name: "example-app" }, triggers: [{ type: "cpu", metadata: {} }] },
  });

const buildScaledJob = (annotations?: Record<string, string>) =>
  new ScaledJob({
    apiVersion: "keda.sh/v1alpha1",
    kind: "ScaledJob",
    metadata: {
      name: "example-job",
      namespace: "default",
      selfLink: "/apis/keda.sh/v1alpha1/namespaces/default/scaledjobs/example-job",
      annotations,
    },
    spec: { jobTargetRef: { template: { metadata: {}, spec: {} } }, triggers: [{ type: "cron", metadata: {} }] },
  });

// The store the host registers for a kind, reduced to the patch the component calls.
const stubStore = (kubeObjectClass: typeof Renderer.K8sApi.LensExtensionKubeObject<any, any, any> = ScaledObject) => {
  const patch = vi.fn(async (_object: ScaledObject | ScaledJob, _patch: unknown, _strategy: string) => undefined);
  vi.spyOn(kubeObjectClass, "getStore").mockReturnValue({ patch } as unknown as Renderer.K8sApi.KubeObjectStore<
    any,
    any,
    any
  >);
  return patch;
};

// The annotations the component sends to the store in its merge patch.
const patchedAnnotations = (patch: ReturnType<typeof stubStore>) => {
  expect(patch).toHaveBeenCalledTimes(1);
  const [, body, strategy] = patch.mock.calls[0];
  expect(strategy).toBe("merge");
  return (body as { metadata: { annotations: Record<string, string | null> } }).metadata.annotations;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PauseMenuItem", () => {
  describe("for an object that is not paused", () => {
    it("offers to pause and to scale to zero, not to resume", () => {
      render(<PauseMenuItem object={buildScaledObject()} />);

      expect(screen.getByText("Pause Autoscaling")).toBeDefined();
      expect(screen.getByText("Scale to Zero")).toBeDefined();
      expect(screen.queryByText("Resume Autoscaling")).toBeNull();
    });

    it("pauses at the current replica count with the paused annotation", () => {
      const patch = stubStore();
      const object = buildScaledObject();
      render(<PauseMenuItem object={object} />);

      fireEvent.click(screen.getByText("Pause Autoscaling"));

      expect(patch.mock.calls[0][0]).toBe(object);
      expect(patchedAnnotations(patch)).toEqual({ [PAUSED]: "true" });
    });

    it("asks for confirmation before scaling to zero, and writes paused-replicas 0 on ok", () => {
      const patch = stubStore();
      const open = vi.spyOn(Renderer.Component.ConfirmDialog, "open");
      render(<PauseMenuItem object={buildScaledObject()} />);

      fireEvent.click(screen.getByText("Scale to Zero"));

      expect(patch).not.toHaveBeenCalled();
      expect(open).toHaveBeenCalledTimes(1);

      open.mock.calls[0][0].ok?.();

      expect(patchedAnnotations(patch)).toEqual({ [PAUSED_REPLICAS]: "0" });
    });

    // The dialog lays its content out as flex items: text beside the target name would be items of its own and lose
    // the spaces at its edges, so the question is one paragraph.
    it("asks to scale the target to zero in one paragraph", () => {
      const open = vi.spyOn(Renderer.Component.ConfirmDialog, "open");
      render(<PauseMenuItem object={buildScaledObject()} />);

      fireEvent.click(screen.getByText("Scale to Zero"));
      const { container } = render(<>{open.mock.calls[0][0].message}</>);

      expect(container.children).toHaveLength(1);
      expect(container.firstElementChild?.tagName).toBe("P");
      expect(container.textContent).toBe(
        "Scale Deployment/example-app to zero replicas and keep it there until autoscaling is resumed?",
      );
    });
  });

  describe("for a paused object", () => {
    it("offers only to resume when paused at the current replica count", () => {
      render(<PauseMenuItem object={buildScaledObject({ [PAUSED]: "true" })} />);

      expect(screen.getByText("Resume Autoscaling")).toBeDefined();
      expect(screen.queryByText("Pause Autoscaling")).toBeNull();
      expect(screen.queryByText("Scale to Zero")).toBeNull();
    });

    it("offers only to resume when scaled to zero", () => {
      render(<PauseMenuItem object={buildScaledObject({ [PAUSED_REPLICAS]: "0" })} />);

      expect(screen.getByText("Resume Autoscaling")).toBeDefined();
      expect(screen.queryByText("Pause Autoscaling")).toBeNull();
      expect(screen.queryByText("Scale to Zero")).toBeNull();
    });

    it("resumes by removing both annotations in the merge patch", () => {
      const patch = stubStore();
      render(<PauseMenuItem object={buildScaledObject({ [PAUSED_REPLICAS]: "0" })} />);

      fireEvent.click(screen.getByText("Resume Autoscaling"));

      expect(patchedAnnotations(patch)).toEqual({ [PAUSED]: null, [PAUSED_REPLICAS]: null });
    });
  });

  describe("for a ScaledJob", () => {
    it("offers to pause, and not to scale to zero, which a ScaledJob does not have", () => {
      render(<PauseMenuItem object={buildScaledJob()} />);

      expect(screen.getByText("Pause Autoscaling")).toBeDefined();
      expect(screen.queryByText("Scale to Zero")).toBeNull();
      expect(screen.queryByText("Resume Autoscaling")).toBeNull();
    });

    it("pauses through the store of the ScaledJob kind", () => {
      const scaledObjectPatch = stubStore(ScaledObject);
      const patch = stubStore(ScaledJob);
      const object = buildScaledJob();
      render(<PauseMenuItem object={object} />);

      fireEvent.click(screen.getByText("Pause Autoscaling"));

      expect(scaledObjectPatch).not.toHaveBeenCalled();
      expect(patch.mock.calls[0][0]).toBe(object);
      expect(patchedAnnotations(patch)).toEqual({ [PAUSED]: "true" });
    });

    it("offers only to resume when paused, and resumes by removing the annotation", () => {
      const patch = stubStore(ScaledJob);
      render(<PauseMenuItem object={buildScaledJob({ [PAUSED]: "true" })} />);

      expect(screen.queryByText("Pause Autoscaling")).toBeNull();
      fireEvent.click(screen.getByText("Resume Autoscaling"));

      expect(patchedAnnotations(patch)).toEqual({ [PAUSED]: null, [PAUSED_REPLICAS]: null });
    });
  });

  it("renders nothing without an object", () => {
    const { container } = render(<PauseMenuItem object={undefined as unknown as ScaledObject} />);

    expect(container.textContent).toBe("");
  });
});
