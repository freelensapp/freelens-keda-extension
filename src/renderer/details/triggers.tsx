import { Renderer } from "@freelensapp/extensions";
import { getAuthenticationObjectRef } from "../api/trigger-authentication";

import type { ScaleTriggers } from "../api/types";

const {
  Component: { Badge, DrawerItem, LinkToObject },
} = Renderer;

export interface TriggersProps {
  /** The ScaledObject or ScaledJob, whose namespace the link to a TriggerAuthentication takes. */
  object: Renderer.K8sApi.KubeObject;
  triggers: ScaleTriggers[];
}

/**
 * The triggers of a ScaledObject or a ScaledJob: one section per scaler, with
 * its type as a badge, its name, its metric type, its metadata as key/value
 * items and a link to the authentication it refers to.
 */
export function Triggers({ object, triggers }: TriggersProps) {
  return (
    <DrawerItem name="Triggers" labelsOnly hidden={triggers.length === 0}>
      {triggers.map((trigger, index) => (
        <DrawerItem
          key={`${trigger.type}-${trigger.name ?? index}`}
          name={
            <>
              <Badge label={trigger.type} /> {trigger.name}
            </>
          }
        >
          {trigger.metricType && <DrawerItem name="Metric Type">{trigger.metricType}</DrawerItem>}
          {Object.entries(trigger.metadata ?? {}).map(([key, value]) => (
            <DrawerItem key={key} name={key}>
              {value}
            </DrawerItem>
          ))}
          {trigger.authenticationRef && (
            <DrawerItem name="Authentication">
              <LinkToObject
                object={object}
                objectRef={getAuthenticationObjectRef(trigger.authenticationRef)}
                content={`${trigger.authenticationRef.kind ?? "TriggerAuthentication"}/${trigger.authenticationRef.name}`}
              />
            </DrawerItem>
          )}
        </DrawerItem>
      ))}
    </DrawerItem>
  );
}
