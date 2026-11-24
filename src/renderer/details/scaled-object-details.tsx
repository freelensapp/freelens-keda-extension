import { Renderer } from "@freelensapp/extensions";
import * as MobxReact from "mobx-react";
import { ScaledObject } from "../api/scaledobject/scaledobject-v1alpha1";
import { RelatedObjects } from "./related-objects";
import { Triggers } from "./triggers";

const { observer } = MobxReact;

const {
  Component: { DrawerItem },
} = Renderer;

export type ScaledObjectDetailsProps = Renderer.Component.KubeObjectDetailsProps<ScaledObject>;

const seconds = (value: number | undefined) => (value === undefined ? "-" : `${value}s`);

/**
 * The details of a ScaledObject that the host does not show already: the host
 * shows the printer columns of the CRD (the kind and name of the scale target,
 * min and max, the Ready, Active, Fallback and Paused conditions, the trigger
 * and authentication types) and the conditions themselves, with their reasons
 * and messages, and its events. The Fallback column is the condition, so the
 * settings of the fallback have a name of their own. The scale target and the
 * HorizontalPodAutoscaler are rows of `RelatedObjects`, with their state.
 */
export const ScaledObjectDetails = observer(({ object }: ScaledObjectDetailsProps) => {
  const { spec, status } = object;
  const { fallback } = spec;
  const modifiers = spec.advanced?.scalingModifiers;
  const health = Object.entries(status?.health ?? {});

  return (
    <>
      <DrawerItem name="Polling Interval">{seconds(spec.pollingInterval)}</DrawerItem>
      <DrawerItem name="Cooldown Period">{seconds(spec.cooldownPeriod)}</DrawerItem>
      <DrawerItem name="Idle Replica Count">{spec.idleReplicaCount ?? "-"}</DrawerItem>
      <DrawerItem name="Initial Cooldown Period">{seconds(spec.initialCooldownPeriod)}</DrawerItem>
      <DrawerItem name="Restore To Original">
        {spec.advanced?.restoreToOriginalReplicaCount !== undefined
          ? String(spec.advanced.restoreToOriginalReplicaCount)
          : "-"}
      </DrawerItem>
      <DrawerItem name="Scaling Modifiers" hidden={!modifiers?.formula}>
        {modifiers?.formula}
        {modifiers?.target ? `, target ${modifiers.target}` : ""}
        {modifiers?.activationTarget ? `, activation target ${modifiers.activationTarget}` : ""}
        {modifiers?.metricType ? ` (${modifiers.metricType})` : ""}
      </DrawerItem>
      <Triggers object={object} triggers={spec.triggers ?? []} />
      <DrawerItem name="Fallback Replicas" hidden={!fallback}>
        {fallback &&
          `${fallback.replicas} after ${fallback.failureThreshold} failures (${fallback.behavior ?? "static"})`}
      </DrawerItem>
      <DrawerItem name="Health" hidden={health.length === 0}>
        {health
          .map(
            ([metric, { status: state, numberOfFailures }]) =>
              `${metric}: ${state ?? "-"}, ${numberOfFailures ?? 0} failures`,
          )
          .join("; ")}
      </DrawerItem>
      <DrawerItem name="External Metric Names">
        {ScaledObject.getExternalMetricNames(object).join(", ") || "-"}
      </DrawerItem>
      <DrawerItem name="Original Replica Count">{status?.originalReplicaCount ?? "-"}</DrawerItem>
      <DrawerItem name="Last Active Time">{status?.lastActiveTime ?? "-"}</DrawerItem>
      <RelatedObjects object={object} />
    </>
  );
});
