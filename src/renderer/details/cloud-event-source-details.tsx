import { Renderer } from "@freelensapp/extensions";
import * as MobxReact from "mobx-react";
import { type AnyCloudEventSource, getAuthenticationRef, getDestination } from "../api/cloud-event-source";

import type { CloudEventType } from "../api/types";

const { observer } = MobxReact;

const {
  Component: { Badge, DrawerItem, LinkToObject },
} = Renderer;

export type CloudEventSourceDetailsProps = Renderer.Component.KubeObjectDetailsProps<AnyCloudEventSource>;

const badges = (types: CloudEventType[]) => types.map((type) => <Badge key={type} label={type} />);

/**
 * The details of a CloudEventSource or a ClusterCloudEventSource that the host
 * does not show already, for both kinds, which share their spec: where the
 * events go, the authentication of the destination and the event types that
 * are sent. The host shows the printer column of the CRD, Active, and the
 * conditions, with their reasons and messages.
 */
export const CloudEventSourceDetails = observer(({ object }: CloudEventSourceDetailsProps) => {
  const { spec } = object;
  const destination = getDestination(object);
  const authentication = spec.authenticationRef;
  const authenticationRef = getAuthenticationRef(object);
  const authenticationName =
    authentication && `${authentication.kind ?? "TriggerAuthentication"}/${authentication.name}`;
  const included = spec.eventSubscription?.includedEventTypes ?? [];
  const excluded = spec.eventSubscription?.excludedEventTypes ?? [];

  return (
    <>
      <DrawerItem name="Destination">
        {destination ? (
          <>
            <Badge label={destination.type} /> {destination.address}
          </>
        ) : (
          "-"
        )}
      </DrawerItem>
      <DrawerItem name="Authentication" hidden={!authentication}>
        {/* A TriggerAuthentication of a ClusterCloudEventSource has no namespace to link to. */}
        {authenticationRef ? (
          <LinkToObject object={object} objectRef={authenticationRef} content={authenticationName} />
        ) : (
          authenticationName
        )}
      </DrawerItem>
      <DrawerItem name="Cluster Name" hidden={!spec.clusterName}>
        {spec.clusterName}
      </DrawerItem>
      {/* No included type means every type, as the controller reads it. */}
      <DrawerItem name="Included Event Types" labelsOnly={included.length > 0}>
        {included.length > 0 ? badges(included) : "All"}
      </DrawerItem>
      <DrawerItem name="Excluded Event Types" hidden={excluded.length === 0} labelsOnly>
        {badges(excluded)}
      </DrawerItem>
    </>
  );
});
