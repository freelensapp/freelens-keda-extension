import { Renderer } from "@freelensapp/extensions";
import * as MobxReact from "mobx-react";
import { getEventLastSeen, newestEvents } from "../api/events";
import styles from "./scaling-events.module.scss";

const { observer } = MobxReact;

const {
  Component: { Badge, DrawerItem, ReactiveDuration },
} = Renderer;

export interface ScalingEventsProps {
  object: Renderer.K8sApi.KubeObject;
}

/**
 * The core Events of an object, the scaling decisions and errors the KEDA
 * controller records for it, newest first, up to 20. They come from the host's
 * event store, which the host loads and watches for the Events section it adds
 * at the end of every details drawer; the component is an observer, so it
 * renders again as events arrive.
 */
export const ScalingEvents = observer(({ object }: ScalingEventsProps) => {
  const events = newestEvents(Renderer.K8sApi.eventStore.getEventsByObject(object), 20);

  return (
    <DrawerItem name="Scaling Events">
      {events.length === 0 ? (
        "No events"
      ) : (
        <table className={styles.eventsTable}>
          <thead>
            <tr>
              <th className={styles.eventsType}>Type</th>
              <th className={styles.eventsReason}>Reason</th>
              <th className={styles.eventsMessage}>Message</th>
              <th className={styles.eventsCount}>Count</th>
              <th className={styles.eventsLastSeen}>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const lastSeen = getEventLastSeen(event);

              return (
                <tr key={event.getId()}>
                  <td>
                    <Badge label={event.type ?? "Normal"} className={event.isWarning() ? "warning" : ""} />
                  </td>
                  <td>{event.reason ?? "-"}</td>
                  <td className={styles.eventsMessage}>{event.message ?? "-"}</td>
                  {/* An event of the events.k8s.io/v1 API seen once has no count; kubectl shows 1. */}
                  <td>{event.getCount() || 1}</td>
                  <td>{lastSeen ? <ReactiveDuration timestamp={lastSeen} /> : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </DrawerItem>
  );
});
