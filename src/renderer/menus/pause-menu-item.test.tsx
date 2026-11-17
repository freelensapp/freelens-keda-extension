// @vitest-environment jsdom

import { Renderer } from "@freelensapp/extensions";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScaledJob } from "../api/scaledjob/scaledjob-v1alpha1";
import { ScaledObject } from "../api/scaledobject/scaledobject-v1alpha1";
import { PauseMenuItem } from "./pause-menu-item";

import type { ScaledObjectStatus } from "../api/types";

const PAUSED = "autoscaling.keda.sh/paused";
const PAUSED_REPLICAS = "autoscaling.keda.sh/paused-replicas";

const buildScaledObject = (annotations?: Record<string, string>, status?: ScaledObjectStatus) =>
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
    status,
  });

// A ScaledObject the controller has created an HPA for.
const buildReconciledScaledObject = () => buildScaledObject(undefined, { hpaName: "keda-hpa-example-app" });

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

// The HPA the controller created for a ScaledObject, reduced to the replicas the dialog fills in.
const stubHpa = (currentReplicas: number) =>
  vi
    .spyOn(Renderer.K8sApi.hpaApi, "get")
    .mockResolvedValue({ status: { currentReplicas } } as Renderer.K8sApi.HorizontalPodAutoscaler);

// The annotations the component sends to the store in its merge patch.
const patchedAnnotations = (patch: ReturnType<typeof stubStore>) => {
  expect(patch).toHaveBeenCalledTimes(1);
  const [, body, strategy] = patch.mock.calls[0];
  expect(strategy).toBe("merge");
  return (body as { metadata: { annotations: Record<string, string | null> } }).metadata.annotations;
};

// Clicks Pause Autoscaling and returns what the menu item opened the dialog with, once it has: for a ScaledObject it
// reads the HPA first.
const openPauseDialog = async () => {
  const open = vi.spyOn(Renderer.Component.ConfirmDialog, "open");

  fireEvent.click(screen.getByText("Pause Autoscaling"));
  await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));

  return open.mock.calls[0][0];
};

const replicasInput = () => screen.getByLabelText<HTMLInputElement>("Replicas");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PauseMenuItem", () => {
  describe("for a ScaledObject that is not paused", () => {
    it("offers to pause, in one item, and not to resume", () => {
      render(<PauseMenuItem object={buildScaledObject()} />);

      expect(screen.getByText("Pause Autoscaling")).toBeDefined();
      expect(screen.queryByText("Scale to Zero")).toBeNull();
      expect(screen.queryByText("Resume Autoscaling")).toBeNull();
    });

    it("asks first, and writes nothing until the dialog is confirmed", async () => {
      const patch = stubStore();
      render(<PauseMenuItem object={buildScaledObject()} />);

      const dialog = await openPauseDialog();

      expect(dialog.labelOk).toBe("Pause");
      expect(patch).not.toHaveBeenCalled();
    });

    it("fills in the current replicas, from the HPA of the object, and pauses at them", async () => {
      const patch = stubStore();
      const get = stubHpa(3);
      const object = buildReconciledScaledObject();
      render(<PauseMenuItem object={object} />);

      const dialog = await openPauseDialog();
      render(<>{dialog.message}</>);

      expect(get).toHaveBeenCalledWith({ name: "keda-hpa-example-app", namespace: "default" });
      expect(replicasInput().value).toBe("3");

      dialog.ok?.();

      expect(patch.mock.calls[0][0]).toBe(object);
      expect(patchedAnnotations(patch)).toEqual({ [PAUSED_REPLICAS]: "3" });
    });

    it.each([
      ["0", "0"],
      ["12", "12"],
      ["007", "7"],
      ["-5 replicas", "5"],
    ])("pauses at the whole number typed in the dialog: %s", async (typed, written) => {
      const patch = stubStore();
      stubHpa(3);
      render(<PauseMenuItem object={buildReconciledScaledObject()} />);

      const dialog = await openPauseDialog();
      render(<>{dialog.message}</>);
      fireEvent.change(replicasInput(), { target: { value: typed } });
      dialog.ok?.();

      expect(patchedAnnotations(patch)).toEqual({ [PAUSED_REPLICAS]: written });
    });

    // The API leaves `currentReplicas` out of the status of an HPA whose target has no replicas.
    it("fills in 0 for a target scaled to zero, whose HPA has no current replicas in its status", async () => {
      vi.spyOn(Renderer.K8sApi.hpaApi, "get").mockResolvedValue({
        status: { desiredReplicas: 0 },
      } as Renderer.K8sApi.HorizontalPodAutoscaler);
      render(<PauseMenuItem object={buildReconciledScaledObject()} />);

      const dialog = await openPauseDialog();
      render(<>{dialog.message}</>);

      expect(replicasInput().value).toBe("0");
    });

    it("starts empty for an object with no HPA yet, without asking for one", async () => {
      const get = vi.spyOn(Renderer.K8sApi.hpaApi, "get");
      render(<PauseMenuItem object={buildScaledObject()} />);

      const dialog = await openPauseDialog();
      render(<>{dialog.message}</>);

      expect(get).not.toHaveBeenCalled();
      expect(replicasInput().value).toBe("");
    });

    it("starts empty when the HPA cannot be read", async () => {
      vi.spyOn(Renderer.K8sApi.hpaApi, "get").mockRejectedValue(new Error("forbidden"));
      render(<PauseMenuItem object={buildReconciledScaledObject()} />);

      const dialog = await openPauseDialog();
      render(<>{dialog.message}</>);

      expect(replicasInput().value).toBe("");
    });

    it("pauses at the current replicas, with the paused annotation, when the number is left empty", async () => {
      const patch = stubStore();
      stubHpa(3);
      render(<PauseMenuItem object={buildReconciledScaledObject()} />);

      const dialog = await openPauseDialog();
      render(<>{dialog.message}</>);
      fireEvent.change(replicasInput(), { target: { value: "" } });
      dialog.ok?.();

      expect(patchedAnnotations(patch)).toEqual({ [PAUSED]: "true" });
    });

    // The dialog lays its content out as flex items: text beside the target name would be items of its own and lose
    // the spaces at its edges, so the message is one element, and its question one paragraph.
    it("asks in one element, with the question in one paragraph", async () => {
      render(<PauseMenuItem object={buildScaledObject()} />);

      const dialog = await openPauseDialog();
      const { container } = render(<>{dialog.message}</>);

      expect(container.children).toHaveLength(1);
      expect(container.querySelectorAll("p")).toHaveLength(1);
      expect(container.querySelector("p")?.textContent).toBe(
        "Pause the autoscaling of Deployment/example-app and keep it at this number of replicas until autoscaling is resumed?",
      );
    });
  });

  describe("for a paused object", () => {
    it("offers only to resume when paused at the current replica count", () => {
      render(<PauseMenuItem object={buildScaledObject({ [PAUSED]: "true" })} />);

      expect(screen.getByText("Resume Autoscaling")).toBeDefined();
      expect(screen.queryByText("Pause Autoscaling")).toBeNull();
    });

    it("offers only to resume when paused at a number of replicas", () => {
      render(<PauseMenuItem object={buildScaledObject({ [PAUSED_REPLICAS]: "0" })} />);

      expect(screen.getByText("Resume Autoscaling")).toBeDefined();
      expect(screen.queryByText("Pause Autoscaling")).toBeNull();
    });

    it("resumes by removing both annotations in the merge patch", () => {
      const patch = stubStore();
      render(<PauseMenuItem object={buildScaledObject({ [PAUSED_REPLICAS]: "0" })} />);

      fireEvent.click(screen.getByText("Resume Autoscaling"));

      expect(patchedAnnotations(patch)).toEqual({ [PAUSED]: null, [PAUSED_REPLICAS]: null });
    });
  });

  describe("for a ScaledJob", () => {
    it("offers to pause, not to resume", () => {
      render(<PauseMenuItem object={buildScaledJob()} />);

      expect(screen.getByText("Pause Autoscaling")).toBeDefined();
      expect(screen.queryByText("Resume Autoscaling")).toBeNull();
    });

    it("asks first, in one paragraph and with no number of replicas, which a ScaledJob does not have", async () => {
      const patch = stubStore(ScaledJob);
      const get = vi.spyOn(Renderer.K8sApi.hpaApi, "get");
      render(<PauseMenuItem object={buildScaledJob()} />);

      const dialog = await openPauseDialog();
      const { container } = render(<>{dialog.message}</>);

      expect(patch).not.toHaveBeenCalled();
      expect(get).not.toHaveBeenCalled();
      expect(dialog.labelOk).toBe("Pause");
      expect(container.children).toHaveLength(1);
      expect(container.firstElementChild?.tagName).toBe("P");
      expect(container.querySelector("input")).toBeNull();
      expect(container.textContent).toBe(
        "Pause the autoscaling of example-job? It creates no Jobs until autoscaling is resumed.",
      );
    });

    it("pauses through the store of the ScaledJob kind, once confirmed", async () => {
      const scaledObjectPatch = stubStore(ScaledObject);
      const patch = stubStore(ScaledJob);
      const object = buildScaledJob();
      render(<PauseMenuItem object={object} />);

      (await openPauseDialog()).ok?.();

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
