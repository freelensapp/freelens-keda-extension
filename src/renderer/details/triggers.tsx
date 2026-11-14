import { Renderer } from "@freelensapp/extensions";
import { getAuthenticationObjectRef } from "../api/trigger-authentication";
import styles from "./triggers.module.scss";

import type { ReactNode } from "react";

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
 * The triggers of a ScaledObject or a ScaledJob: one block per scaler, with
 * its type as a badge and its name, over a table of its metric type, its
 * metadata and the authentication it refers to. A table, and not drawer items
 * nested in the item, because every level of drawer items splits the width
 * of the drawer again: on the third one the keys and the values wrapped letter
 * by letter.
 */
export function Triggers({ object, triggers }: TriggersProps) {
  return (
    <DrawerItem name="Triggers" hidden={triggers.length === 0}>
      {triggers.map((trigger, index) => {
        const fields: [string, ReactNode][] = [];

        if (trigger.metricType) {
          fields.push(["Metric Type", trigger.metricType]);
        }

        for (const [key, value] of Object.entries(trigger.metadata ?? {})) {
          fields.push([key, value]);
        }

        if (trigger.authenticationRef) {
          fields.push([
            "Authentication",
            <LinkToObject
              object={object}
              objectRef={getAuthenticationObjectRef(trigger.authenticationRef)}
              content={`${trigger.authenticationRef.kind ?? "TriggerAuthentication"}/${trigger.authenticationRef.name}`}
            />,
          ]);
        }

        return (
          <div key={`${trigger.type}-${trigger.name ?? index}`} className={styles.trigger}>
            <div className={styles.title}>
              <Badge label={trigger.type} /> {trigger.name}
            </div>
            {fields.length > 0 && (
              <table className={styles.fields}>
                <tbody>
                  {fields.map(([name, value]) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </DrawerItem>
  );
}
