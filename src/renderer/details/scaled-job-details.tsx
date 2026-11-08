import { Renderer } from "@freelensapp/extensions";
import * as MobxReact from "mobx-react";
import { ScaledJob } from "../api/scaledjob/scaledjob-v1alpha1";
import { ScalingEvents } from "./scaling-events";
import { Triggers } from "./triggers";

const { observer } = MobxReact;

const {
  Component: { DrawerItem },
} = Renderer;

export type ScaledJobDetailsProps = Renderer.Component.KubeObjectDetailsProps<ScaledJob>;

const seconds = (value: number | undefined) => (value === undefined ? "-" : `${value}s`);

/**
 * The details of a ScaledJob that the host does not show already: the host
 * shows the printer columns of the CRD (min and max, the Ready, Active and
 * Paused conditions, the trigger and authentication types) and the
 * conditions themselves.
 */
export const ScaledJobDetails = observer(({ object }: ScaledJobDetailsProps) => {
  const { spec } = object;
  const job = spec.jobTargetRef;
  const containers = job?.template?.spec?.containers ?? [];
  const rollout = spec.rollout?.strategy ?? spec.rolloutStrategy;
  const scaling = spec.scalingStrategy;

  return (
    <>
      <DrawerItem name="Job Containers" hidden={containers.length === 0}>
        {containers.map((container) => `${container.name} (${container.image})`).join(", ")}
      </DrawerItem>
      <DrawerItem name="Job Parallelism" hidden={job?.parallelism === undefined}>
        {job?.parallelism}
      </DrawerItem>
      <DrawerItem name="Job Completions" hidden={job?.completions === undefined}>
        {job?.completions}
      </DrawerItem>
      <DrawerItem name="Job Backoff Limit" hidden={job?.backoffLimit === undefined}>
        {job?.backoffLimit}
      </DrawerItem>
      <DrawerItem name="Job Active Deadline" hidden={job?.activeDeadlineSeconds === undefined}>
        {seconds(job?.activeDeadlineSeconds)}
      </DrawerItem>
      <DrawerItem name="Polling Interval">{seconds(spec.pollingInterval)}</DrawerItem>
      <DrawerItem name="Successful Jobs History Limit">{spec.successfulJobsHistoryLimit ?? "-"}</DrawerItem>
      <DrawerItem name="Failed Jobs History Limit">{spec.failedJobsHistoryLimit ?? "-"}</DrawerItem>
      <DrawerItem name="Rollout Strategy" hidden={!rollout}>
        {rollout}
        {spec.rollout?.propagationPolicy ? ` (${spec.rollout.propagationPolicy} propagation)` : ""}
      </DrawerItem>
      <DrawerItem name="Scaling Strategy" hidden={!scaling?.strategy}>
        {scaling?.strategy}
      </DrawerItem>
      <DrawerItem name="Multiple Scalers Calculation" hidden={!scaling?.multipleScalersCalculation}>
        {scaling?.multipleScalersCalculation}
      </DrawerItem>
      <DrawerItem name="Env Source Container" hidden={!spec.envSourceContainerName}>
        {spec.envSourceContainerName}
      </DrawerItem>
      <Triggers object={object} triggers={spec.triggers ?? []} />
      <DrawerItem name="External Metric Names">{ScaledJob.getExternalMetricNames(object).join(", ") || "-"}</DrawerItem>
      <DrawerItem name="Last Active Time">{object.status?.lastActiveTime ?? "-"}</DrawerItem>
      <ScalingEvents object={object} />
    </>
  );
});
