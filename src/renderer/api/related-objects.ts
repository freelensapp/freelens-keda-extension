import { Renderer } from "@freelensapp/extensions";
import { ScaledObject } from "./scaledobject/scaledobject-v1alpha1";
import { getAuthenticationObjectRef, getAuthParameters } from "./trigger-authentication";

import type { ScaledJob } from "./scaledjob/scaledjob-v1alpha1";
import type { AnyTriggerAuthentication } from "./trigger-authentication";
import type { ScaleTriggers } from "./types";

type KubeObject = Renderer.K8sApi.KubeObject;
type ObjectReference = Renderer.K8sApi.ObjectReference;

/** A row of the view of what a ScaledObject or a ScaledJob ties together. */
export interface RelatedObject {
  /** What it is to the row above it: Scale Target, a trigger, the parameter an authentication resolves. */
  role: string;
  /** 0 for what the object itself refers to, 1 for what a trigger and its authentication read. */
  level: 0 | 1;
  /** The object, as `Kind/name`, or what stands for it: a variable, a path in a vault. */
  name: string;
  /** The reference for a link, for an object the cluster has in the namespace of the object. */
  ref?: ObjectReference;
  /** The state of the object: its replicas, how a Job ended. */
  state?: string;
  /** What is wrong with it: the object, or the key in it, does not exist. */
  problem?: string;
}

/** The part of a container that says which variables it defines. */
interface EnvContainer {
  name: string;
  env?: { name: string }[];
  envFrom?: unknown[];
}

/** An object that was looked up: undefined when it does not exist, null when it cannot be read. */
type Found = KubeObject | undefined | null;

type Find = (ref: ObjectReference, namespaced?: boolean) => Promise<Found>;

/** The objects of a kind, null when the kind is not served or the user may not list it. */
async function list(
  ref: Pick<ObjectReference, "kind" | "apiVersion">,
  namespace: string | undefined,
  query: Renderer.K8sApi.KubeApiQueryParams,
): Promise<KubeObject[] | null> {
  try {
    const api = Renderer.K8sApi.apiManager.getApiByKind(ref.kind ?? "", ref.apiVersion ?? "");

    return (await api?.list({ namespace }, query)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Looks objects up by their reference, each one once. A list by name and not a
 * get: for an object that does not exist the list is empty, while a get fails
 * with a 404, which Chromium logs as an error of the page.
 */
function createFind(namespace: string | undefined): Find {
  const lookups = new Map<string, Promise<Found>>();

  return (ref, namespaced = true) => {
    const key = `${ref.apiVersion}/${ref.kind}/${ref.name}`;
    const lookup =
      lookups.get(key) ??
      list(ref, namespaced ? namespace : undefined, { fieldSelector: `metadata.name=${ref.name}` }).then((items) =>
        items ? items[0] : null,
      );

    lookups.set(key, lookup);

    return lookup;
  };
}

/** The row of an object that was looked up: a link and its state, or the mark of an object that is not there. */
function objectRow(
  role: string,
  level: RelatedObject["level"],
  ref: ObjectReference,
  found: Found,
  describe?: (object: KubeObject) => Pick<RelatedObject, "state" | "problem">,
): RelatedObject {
  const name = `${ref.kind}/${ref.name}`;

  if (found === undefined) return { role, level, name, problem: "Not found" };

  return { role, level, name, ref, ...(found && describe?.(found)) };
}

function describeScaleTarget(target: KubeObject): Pick<RelatedObject, "state"> {
  const replicas = (target.spec as { replicas?: number } | undefined)?.replicas ?? 0;
  const ready = (target.status as { readyReplicas?: number } | undefined)?.readyReplicas;

  // A workload at zero, and a custom resource, may have no count of ready replicas.
  return { state: ready === undefined ? `${replicas} replicas` : `${ready} of ${replicas} replicas ready` };
}

function describeHpa(hpa: KubeObject): Pick<RelatedObject, "state"> {
  const status = hpa.status as { currentReplicas?: number; desiredReplicas?: number } | undefined;

  // The API omits a count of zero.
  return { state: `${status?.currentReplicas ?? 0} current, ${status?.desiredReplicas ?? 0} desired replicas` };
}

/**
 * What is wrong with a variable the controller reads from a container of the
 * workload: the one that is named, or the first. Nothing is said when the
 * workload is not known, or when the container takes variables from a
 * ConfigMap or a Secret (`envFrom`), which are not read here.
 */
function getEnvProblem(
  containers: EnvContainer[] | undefined,
  containerName: string | undefined,
  variable: string,
): string | undefined {
  if (!containers) return undefined;

  const container = containerName ? containers.find(({ name }) => name === containerName) : containers[0];

  if (!container) return "Container not found";
  if (container.env?.some(({ name }) => name === variable) || container.envFrom?.length) return undefined;

  return "Not found";
}

/**
 * A trigger that refers to something, with its authentication, and under it where its parameters come
 * from: the variables its metadata names (`hostFromEnv`), and what the
 * authentication reads. A ClusterTriggerAuthentication reads its Secrets and
 * ConfigMaps in the namespace of the operator, which the object does not say,
 * so they are named and not looked up.
 */
async function getTriggerRows(
  trigger: ScaleTriggers,
  find: Find,
  getVariableProblem: (variable: string, containerName?: string) => string | undefined,
): Promise<RelatedObject[]> {
  const role = `Trigger ${trigger.name ?? trigger.type}`;
  const ref = trigger.authenticationRef && getAuthenticationObjectRef(trigger.authenticationRef);
  const namespaced = ref?.kind === "TriggerAuthentication";
  const authentication = ref && (await find(ref, namespaced));
  const rows: RelatedObject[] = [ref ? objectRow(role, 0, ref, authentication) : { role, level: 0, name: "-" }];

  for (const [key, variable] of Object.entries(trigger.metadata ?? {})) {
    if (key.endsWith("FromEnv")) {
      rows.push({
        role: key.slice(0, -"FromEnv".length),
        level: 1,
        name: `Env ${variable}`,
        problem: getVariableProblem(variable),
      });
    }
  }

  // A trigger that refers to nothing has no row: the Triggers of the panel list it already.
  if (!ref && rows.length === 1) return [];
  if (!authentication) return rows;

  const { spec } = authentication as AnyTriggerAuthentication;

  for (const { parameter, source, name, key, kind } of getAuthParameters(authentication as AnyTriggerAuthentication)) {
    // Below, with the container the variable is read from.
    if (source === "Env") continue;

    const text = `${kind ?? source}${kind ? "/" : " "}${name}${key ? `, key ${key}` : ""}`;

    if (kind && namespaced) {
      const sourceRef = { kind, apiVersion: "v1", name };
      const row = objectRow(parameter, 1, sourceRef, await find(sourceRef), (object) => {
        const keys = { ...Reflect.get(object, "data"), ...Reflect.get(object, "binaryData") };

        return key && !(key in keys) ? { problem: "Key not found" } : {};
      });

      rows.push({ ...row, name: text });
    } else {
      rows.push({ role: parameter, level: 1, name: text, state: kind && "In the namespace of the operator" });
    }
  }

  for (const { parameter, name, containerName } of spec.env ?? []) {
    rows.push({
      role: parameter,
      level: 1,
      name: `Env ${containerName ? `${containerName}/` : ""}${name}`,
      problem: getVariableProblem(name, containerName),
    });
  }

  return rows;
}

const jobStates = ["Running", "Pending", "Succeeded", "Failed"] as const;

function getJobState(job: KubeObject): (typeof jobStates)[number] {
  const status = job.status as { active?: number; conditions?: { type: string; status: string }[] } | undefined;
  const has = (...types: string[]) =>
    status?.conditions?.some(({ type, status: value }) => value === "True" && types.includes(type));

  if (has("Failed", "FailureTarget")) return "Failed";
  if (has("Complete", "SuccessCriteriaMet")) return "Succeeded";

  return status?.active ? "Running" : "Pending";
}

/** The Jobs the controller created for a ScaledJob, which it labels with the name of the object: a count, and the newest ten. */
async function getJobRows(object: ScaledJob): Promise<RelatedObject[]> {
  const ref = { kind: "Job", apiVersion: "batch/v1" };
  const jobs = await list(ref, object.getNs(), { labelSelector: `scaledjob.keda.sh/name=${object.getName()}` });

  if (!jobs) return [];

  const states = new Map(jobs.map((job) => [job, getJobState(job)]));
  const counts = jobStates
    .map((state) => [jobs.filter((job) => states.get(job) === state).length, state.toLowerCase()] as const)
    .filter(([count]) => count > 0)
    .map((count) => count.join(" "));

  return [
    { role: "Jobs", level: 0, name: String(jobs.length), state: counts.join(", ") },
    ...jobs
      .toSorted((a, b) => (b.metadata.creationTimestamp ?? "").localeCompare(a.metadata.creationTimestamp ?? ""))
      .slice(0, 10)
      .map((job): RelatedObject => {
        const state = states.get(job);

        return {
          role: "Job",
          level: 1,
          name: `Job/${job.getName()}`,
          ref: { ...ref, name: job.getName() },
          ...(state === "Failed" ? { problem: state } : { state }),
        };
      }),
  ];
}

/**
 * What a ScaledObject or a ScaledJob ties together, with the state of each and
 * a mark on what is missing: the scale target and the HorizontalPodAutoscaler
 * of a ScaledObject, the Jobs of a ScaledJob, and each trigger with its
 * authentication and where its parameters come from. An object that cannot
 * be read, for a user who may not list its kind, keeps its row, without a
 * state and without a mark.
 */
export async function getRelatedObjects(object: ScaledObject | ScaledJob): Promise<RelatedObject[]> {
  const find = createFind(object.getNs());
  const rows: RelatedObject[] = [];
  let containers: EnvContainer[] | undefined;
  let envContainer: string | undefined;

  if (object.kind === "ScaledObject") {
    const targetRef = ScaledObject.getScaleTargetRef(object);
    const hpaRef = ScaledObject.getHpaRef(object);
    const [target, hpa] = await Promise.all([find(targetRef), hpaRef && find(hpaRef)]);
    const paused = ScaledObject.getPausedAnnotation(object);

    rows.push(objectRow("Scale Target", 0, targetRef, target, describeScaleTarget));

    // The controller removes the HorizontalPodAutoscaler of a paused object, and creates none for one it rejects.
    rows.push(
      hpaRef && !(hpa === undefined && paused)
        ? objectRow("Autoscaler", 0, hpaRef, hpa, describeHpa)
        : {
            role: "Autoscaler",
            level: 0,
            name: hpaRef ? `${hpaRef.kind}/${hpaRef.name}` : "HorizontalPodAutoscaler",
            state: paused ? "Removed while paused" : "Not created",
          },
    );

    containers = (target?.spec as { template?: { spec?: { containers?: EnvContainer[] } } } | undefined)?.template?.spec
      ?.containers;
    envContainer = object.spec.scaleTargetRef.envSourceContainerName;
  } else {
    containers = object.spec.jobTargetRef.template?.spec?.containers;
    envContainer = object.spec.envSourceContainerName;
  }

  const triggerRows = await Promise.all(
    (object.spec.triggers ?? []).map((trigger) =>
      getTriggerRows(trigger, find, (variable, containerName) =>
        getEnvProblem(containers, containerName ?? envContainer, variable),
      ),
    ),
  );

  rows.push(...triggerRows.flat());

  if (object.kind === "ScaledJob") rows.push(...(await getJobRows(object)));

  return rows;
}
