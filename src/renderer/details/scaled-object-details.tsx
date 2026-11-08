import { Renderer } from "@freelensapp/extensions";
import * as MobxReact from "mobx-react";
import { ScaledObject } from "../api/scaledobject/scaledobject-v1alpha1";
import { ScalingEvents } from "./scaling-events";
import { Triggers } from "./triggers";

const { observer } = MobxReact;

const {
  Component: { Badge, DrawerItem, LinkToObject },
} = Renderer;

export type ScaledObjectDetailsProps = Renderer.Component.KubeObjectDetailsProps<ScaledObject>;

function conditionClass(status: string): string {
  switch (status) {
    case "True":
      return "success";
    case "False":
      return "error";
    default:
      return "warning";
  }
}

export const ScaledObjectDetails = observer(({ object }: ScaledObjectDetailsProps) => {
  const conditions = object.status?.conditions;
  const fallback = object.spec.fallback;
  const hpaRef = ScaledObject.getHpaRef(object);

  return (
    <>
      <DrawerItem name="Scale Target">
        <LinkToObject
          object={object}
          objectRef={ScaledObject.getScaleTargetRef(object)}
          content={ScaledObject.getScaleTarget(object)}
        />
      </DrawerItem>
      <DrawerItem name="Horizontal Pod Autoscaler" hidden={!hpaRef}>
        <LinkToObject object={object} objectRef={hpaRef} />
      </DrawerItem>
      <DrawerItem name="Min Replicas">{object.spec.minReplicaCount ?? "-"}</DrawerItem>
      <DrawerItem name="Max Replicas">{object.spec.maxReplicaCount ?? "-"}</DrawerItem>
      <DrawerItem name="Polling Interval">
        {object.spec.pollingInterval !== undefined ? `${object.spec.pollingInterval}s` : "-"}
      </DrawerItem>
      <DrawerItem name="Cooldown Period">
        {object.spec.cooldownPeriod !== undefined ? `${object.spec.cooldownPeriod}s` : "-"}
      </DrawerItem>
      <DrawerItem name="Idle Replica Count">{object.spec.idleReplicaCount ?? "-"}</DrawerItem>
      <DrawerItem name="Initial Cooldown Period">
        {object.spec.initialCooldownPeriod !== undefined ? `${object.spec.initialCooldownPeriod}s` : "-"}
      </DrawerItem>
      <DrawerItem name="Restore To Original">
        {object.spec.advanced?.restoreToOriginalReplicaCount !== undefined
          ? String(object.spec.advanced.restoreToOriginalReplicaCount)
          : "-"}
      </DrawerItem>
      <Triggers object={object} triggers={object.spec.triggers ?? []} />
      <DrawerItem name="Fallback">
        {fallback
          ? `enabled (failureThreshold: ${fallback.failureThreshold}, replicas: ${fallback.replicas})`
          : "Disabled"}
      </DrawerItem>
      <DrawerItem name="Conditions" labelsOnly hidden={!conditions?.length}>
        {conditions?.map((condition, index) => (
          <Badge
            key={condition.type + index}
            label={condition.reason || condition.type}
            className={conditionClass(condition.status)}
            tooltip={condition.message}
          />
        ))}
      </DrawerItem>
      <DrawerItem name="External Metric Names">
        {ScaledObject.getExternalMetricNames(object).join(", ") || "-"}
      </DrawerItem>
      <DrawerItem name="Original Replica Count">{object.status?.originalReplicaCount ?? "-"}</DrawerItem>
      <DrawerItem name="Last Active Time">{object.status?.lastActiveTime ?? "-"}</DrawerItem>
      <DrawerItem name="Paused">{ScaledObject.getPausedAnnotation(object) ? "Yes" : "No"}</DrawerItem>
      <ScalingEvents object={object} />
    </>
  );
});
