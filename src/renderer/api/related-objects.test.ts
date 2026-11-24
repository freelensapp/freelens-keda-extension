import { Renderer } from "@freelensapp/extensions";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRelatedObjects } from "./related-objects";
import { ScaledJob } from "./scaledjob/scaledjob-v1alpha1";
import { ScaledObject } from "./scaledobject/scaledobject-v1alpha1";

import type { RelatedObject } from "./related-objects";
import type { ScaledObjectSpec, ScaledObjectStatus } from "./scaledobject/scaledobject-v1alpha1";
import type { ScaleTriggers } from "./types";

interface ClusterObject {
  kind: string;
  apiVersion: string;
  metadata: { name: string; namespace?: string; labels?: Record<string, string>; creationTimestamp?: string };
  [field: string]: unknown;
}

const namespace = "storefront";

const object = (kind: string, apiVersion: string, name: string, fields: object = {}): ClusterObject => ({
  kind,
  apiVersion,
  metadata: { name, namespace },
  ...fields,
});

const deployment = object("Deployment", "apps/v1", "checkout-api", {
  spec: {
    replicas: 3,
    template: { spec: { containers: [{ name: "api", env: [{ name: "RABBITMQ_HOST" }] }, { name: "proxy" }] } },
  },
  status: { readyReplicas: 2 },
});

const hpa = object("HorizontalPodAutoscaler", "autoscaling/v2", "keda-hpa-checkout-api", {
  status: { currentReplicas: 2, desiredReplicas: 3 },
});

const authentication = object("TriggerAuthentication", "keda.sh/v1alpha1", "rabbitmq-connection", {
  spec: {
    secretTargetRef: [{ parameter: "password", name: "rabbitmq", key: "password" }],
    configMapTargetRef: [{ parameter: "vhost", name: "rabbitmq-settings", key: "vhost" }],
    env: [{ parameter: "user", name: "RABBITMQ_USER" }],
    hashiCorpVault: {
      address: "https://vault",
      secrets: [{ parameter: "token", path: "secret/rabbitmq", key: "token" }],
    },
  },
});

const secret = object("Secret", "v1", "rabbitmq", { data: { password: "c2VjcmV0" } });

const configMap = object("ConfigMap", "v1", "rabbitmq-settings", { data: { vhost: "/" } });

const rabbitmq: ScaleTriggers = {
  type: "rabbitmq",
  name: "orders",
  metadata: { queueName: "orders", hostFromEnv: "RABBITMQ_HOST" },
  authenticationRef: { name: "rabbitmq-connection" },
};

const buildScaledObject = (
  spec: Partial<ScaledObjectSpec> = {},
  status: ScaledObjectStatus = { hpaName: "keda-hpa-checkout-api" },
  annotations: Record<string, string> = {},
) =>
  new ScaledObject({
    apiVersion: "keda.sh/v1alpha1",
    kind: "ScaledObject",
    metadata: {
      name: "checkout-api",
      namespace,
      annotations,
      selfLink: "/apis/keda.sh/v1alpha1/namespaces/storefront/scaledobjects/checkout-api",
    },
    spec: { scaleTargetRef: { name: "checkout-api" }, triggers: [rabbitmq], ...spec },
    status,
  });

/**
 * A cluster with the given objects, which refuses to list the kinds of
 * `forbidden`. Returns the lists it was asked for, as `Kind namespace selector`.
 */
const stubCluster = (objects: ClusterObject[], forbidden: string[] = []) => {
  const requests: string[] = [];

  vi.spyOn(Renderer.K8sApi.apiManager, "getApiByKind").mockImplementation((kind, apiVersion) => {
    const api = {
      list: async (options: { namespace?: string }, query: { fieldSelector?: string; labelSelector?: string }) => {
        const selector = query.fieldSelector ?? query.labelSelector ?? "";
        const [field = "", value] = selector.split("=");

        requests.push(`${kind} ${options.namespace ?? "-"} ${selector}`);

        if (forbidden.includes(kind)) throw new Error("forbidden");

        return objects
          .filter(
            (item) =>
              item.kind === kind &&
              item.apiVersion === apiVersion &&
              item.metadata.namespace === options.namespace &&
              (field === "metadata.name" ? item.metadata.name : item.metadata.labels?.[field]) === value,
          )
          .map((item) => ({ ...item, getName: () => item.metadata.name }));
      },
    };

    return api as unknown as ReturnType<typeof Renderer.K8sApi.apiManager.getApiByKind>;
  });

  return requests;
};

/** The rows as lines of text: nested rows indented, a link marked with `->`, a problem with `!`. */
const lines = (rows: RelatedObject[]) =>
  rows.map((row) =>
    [
      `${"  ".repeat(row.level)}${row.role}`,
      `${row.ref ? "-> " : ""}${row.name}`,
      row.problem ? `! ${row.problem}` : (row.state ?? ""),
    ].join(" | "),
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getRelatedObjects", () => {
  it("shows what a ScaledObject ties together, each with a link and its state", async () => {
    stubCluster([deployment, hpa, authentication, secret, configMap]);

    const rows = await getRelatedObjects(
      buildScaledObject({ triggers: [rabbitmq, { type: "cpu", metadata: { value: "80" } }] }),
    );

    expect(lines(rows)).toEqual([
      "Scale Target | -> Deployment/checkout-api | 2 of 3 replicas ready",
      "Autoscaler | -> HorizontalPodAutoscaler/keda-hpa-checkout-api | 2 current, 3 desired replicas",
      "Trigger orders | -> TriggerAuthentication/rabbitmq-connection | ",
      "  host | Env RABBITMQ_HOST | ",
      "  password | -> Secret/rabbitmq, key password | ",
      "  vhost | -> ConfigMap/rabbitmq-settings, key vhost | ",
      "  token | HashiCorp Vault secret/rabbitmq, key token | ",
      "  user | Env RABBITMQ_USER | ! Not found",
      // The cpu trigger refers to nothing, so it has no row.
    ]);
    expect(rows[0]?.ref).toEqual({ kind: "Deployment", apiVersion: "apps/v1", name: "checkout-api" });
    expect(rows[4]?.ref).toEqual({ kind: "Secret", apiVersion: "v1", name: "rabbitmq" });
  });

  it("marks the objects that do not exist, and the key a Secret does not have", async () => {
    stubCluster([authentication, object("Secret", "v1", "rabbitmq", { data: { username: "dXNlcg==" } })]);

    const rows = await getRelatedObjects(
      buildScaledObject({
        triggers: [rabbitmq, { type: "kafka", metadata: {}, authenticationRef: { name: "kafka-connection" } }],
      }),
    );

    expect(lines(rows)).toEqual([
      "Scale Target | Deployment/checkout-api | ! Not found",
      "Autoscaler | HorizontalPodAutoscaler/keda-hpa-checkout-api | ! Not found",
      "Trigger orders | -> TriggerAuthentication/rabbitmq-connection | ",
      // Without the workload, nothing says which variables its containers define.
      "  host | Env RABBITMQ_HOST | ",
      "  password | -> Secret/rabbitmq, key password | ! Key not found",
      "  vhost | ConfigMap/rabbitmq-settings, key vhost | ! Not found",
      "  token | HashiCorp Vault secret/rabbitmq, key token | ",
      "  user | Env RABBITMQ_USER | ",
      "Trigger kafka | TriggerAuthentication/kafka-connection | ! Not found",
    ]);
  });

  it("does not mark the HorizontalPodAutoscaler the controller removed or did not create", async () => {
    stubCluster([deployment]);

    const paused = await getRelatedObjects(
      buildScaledObject({ triggers: [] }, undefined, { [ScaledObject.pausedReplicasAnnotation]: "0" }),
    );
    const rejected = await getRelatedObjects(buildScaledObject({ triggers: [] }, {}));

    expect(lines(paused)[1]).toBe("Autoscaler | HorizontalPodAutoscaler/keda-hpa-checkout-api | Removed while paused");
    expect(lines(rejected)[1]).toBe("Autoscaler | HorizontalPodAutoscaler | Not created");
  });

  it("keeps the row of an object the user may not list, with no state and no mark", async () => {
    stubCluster([deployment, hpa, authentication, secret, configMap], ["Deployment", "Secret"]);

    expect(lines(await getRelatedObjects(buildScaledObject())).slice(0, 5)).toEqual([
      "Scale Target | -> Deployment/checkout-api | ",
      "Autoscaler | -> HorizontalPodAutoscaler/keda-hpa-checkout-api | 2 current, 3 desired replicas",
      "Trigger orders | -> TriggerAuthentication/rabbitmq-connection | ",
      "  host | Env RABBITMQ_HOST | ",
      "  password | -> Secret/rabbitmq, key password | ",
    ]);
  });

  it("reads a variable from the container the object names, and says nothing of one that takes them from elsewhere", async () => {
    const trigger: ScaleTriggers = { type: "rabbitmq", metadata: { hostFromEnv: "RABBITMQ_HOST" } };
    const target = (envSourceContainerName: string): Partial<ScaledObjectSpec> => ({
      scaleTargetRef: { name: "checkout-api", envSourceContainerName },
      triggers: [trigger],
    });

    stubCluster([
      object("Deployment", "apps/v1", "checkout-api", {
        spec: { template: { spec: { containers: [{ name: "api" }, { name: "proxy", envFrom: [{}] }] } } },
      }),
    ]);

    expect(lines(await getRelatedObjects(buildScaledObject(target("api")))).at(-1)).toBe(
      "  host | Env RABBITMQ_HOST | ! Not found",
    );
    expect(lines(await getRelatedObjects(buildScaledObject(target("proxy")))).at(-1)).toBe(
      "  host | Env RABBITMQ_HOST | ",
    );
    expect(lines(await getRelatedObjects(buildScaledObject(target("worker")))).at(-1)).toBe(
      "  host | Env RABBITMQ_HOST | ! Container not found",
    );
  });

  it("names what a ClusterTriggerAuthentication reads, in the namespace of the operator, without a lookup", async () => {
    const requests = stubCluster([
      deployment,
      hpa,
      { ...authentication, kind: "ClusterTriggerAuthentication", metadata: { name: "rabbitmq-connection" } },
    ]);

    const rows = await getRelatedObjects(
      buildScaledObject({
        triggers: [
          { ...rabbitmq, authenticationRef: { name: "rabbitmq-connection", kind: "ClusterTriggerAuthentication" } },
        ],
      }),
    );

    expect(lines(rows).slice(2, 6)).toEqual([
      "Trigger orders | -> ClusterTriggerAuthentication/rabbitmq-connection | ",
      "  host | Env RABBITMQ_HOST | ",
      "  password | Secret/rabbitmq, key password | In the namespace of the operator",
      "  vhost | ConfigMap/rabbitmq-settings, key vhost | In the namespace of the operator",
    ]);
    expect(requests).toEqual([
      "Deployment storefront metadata.name=checkout-api",
      "HorizontalPodAutoscaler storefront metadata.name=keda-hpa-checkout-api",
      "ClusterTriggerAuthentication - metadata.name=rabbitmq-connection",
    ]);
  });

  it("looks an object up once, however many triggers refer to it", async () => {
    const requests = stubCluster([deployment, hpa, authentication, secret, configMap]);

    await getRelatedObjects(buildScaledObject({ triggers: [rabbitmq, { ...rabbitmq, name: "payments" }] }));

    expect(requests.filter((request) => request.startsWith("TriggerAuthentication"))).toHaveLength(1);
    expect(requests.filter((request) => request.startsWith("Secret"))).toHaveLength(1);
  });

  it("shows the Jobs of a ScaledJob, counted by state and newest first, with the failed ones marked", async () => {
    const job = (name: string, creationTimestamp: string, status: object, scaledJob = "report") => ({
      ...object("Job", "batch/v1", name, { status }),
      metadata: { name, namespace, creationTimestamp, labels: { "scaledjob.keda.sh/name": scaledJob } },
    });
    const ended = (type: string) => ({ conditions: [{ type, status: "True" }] });

    stubCluster([
      job("report-a", "2026-11-17T08:00:00Z", ended("Complete")),
      job("report-b", "2026-11-17T09:00:00Z", { conditions: [{ type: "FailureTarget", status: "True" }] }),
      job("report-c", "2026-11-17T10:00:00Z", { active: 1 }),
      job("other", "2026-11-17T11:00:00Z", { active: 1 }, "other"),
    ]);

    const rows = await getRelatedObjects(
      new ScaledJob({
        apiVersion: "keda.sh/v1alpha1",
        kind: "ScaledJob",
        metadata: {
          name: "report",
          namespace,
          selfLink: "/apis/keda.sh/v1alpha1/namespaces/storefront/scaledjobs/report",
        },
        spec: {
          jobTargetRef: { template: { metadata: {}, spec: { containers: [{ name: "report", image: "report" }] } } },
          triggers: [{ type: "rabbitmq", metadata: { hostFromEnv: "RABBITMQ_HOST" } }],
        },
      }),
    );

    expect(lines(rows)).toEqual([
      "Trigger rabbitmq | - | ",
      // The variables of a ScaledJob come from the containers of its own template.
      "  host | Env RABBITMQ_HOST | ! Not found",
      "Jobs | 3 | 1 running, 1 succeeded, 1 failed",
      "  Job | -> Job/report-c | Running",
      "  Job | -> Job/report-b | ! Failed",
      "  Job | -> Job/report-a | Succeeded",
    ]);
  });
});
