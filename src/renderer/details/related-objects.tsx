import { Renderer } from "@freelensapp/extensions";
import { useEffect, useState } from "react";
import { getRelatedObjects } from "../api/related-objects";
import styles from "./related-objects.module.scss";

import type { RelatedObject } from "../api/related-objects";
import type { ScaledJob } from "../api/scaledjob/scaledjob-v1alpha1";
import type { ScaledObject } from "../api/scaledobject/scaledobject-v1alpha1";

const {
  Component: { DrawerTitle, Icon, LinkToObject },
} = Renderer;

export interface RelatedObjectsProps {
  object: ScaledObject | ScaledJob;
}

/**
 * What a ScaledObject or a ScaledJob ties together, in one table: each object
 * with a link to it and its state, and a mark on the ones that are missing.
 * Rows of a table under a title of their own, and not drawer items, which
 * leave a third column a few pixels of the drawer.
 */
export function RelatedObjects({ object }: RelatedObjectsProps) {
  const [rows, setRows] = useState<RelatedObject[]>([]);
  const { uid, resourceVersion } = object.metadata;

  // shortcut: read when the details open and when the object changes, which the controller does at every poll
  // of an active object; a timer of its own if the replicas of an idle one have to follow the cluster.
  useEffect(() => {
    let current = true;

    void getRelatedObjects(object).then((loaded) => {
      if (current) setRows(loaded);
    });

    return () => {
      current = false;
    };
  }, [uid, resourceVersion]);

  if (rows.length === 0) return null;

  return (
    <>
      <DrawerTitle>Related Objects</DrawerTitle>
      <table className={styles.objects}>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${index}-${row.name}`}>
              <th scope="row" className={row.level ? styles.nested : undefined}>
                {row.role}
              </th>
              <td>{row.ref ? <LinkToObject object={object} objectRef={row.ref} content={row.name} /> : row.name}</td>
              <td>
                {row.problem ? (
                  <span className={styles.problem}>
                    <Icon material="error_outline" small />
                    <span>{row.problem}</span>
                  </span>
                ) : (
                  row.state
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
