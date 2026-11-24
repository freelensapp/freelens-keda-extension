import { getConditionStatus } from "./status-helpers";
import { getAuthenticationObjectRef } from "./trigger-authentication";

import type { Renderer } from "@freelensapp/extensions";

import type { CloudEventSource } from "./cloudeventsource/cloudeventsource-v1alpha1";
import type { ClusterCloudEventSource } from "./clustercloudeventsource/clustercloudeventsource-v1alpha1";

// CloudEventSource and ClusterCloudEventSource share their spec and status, so
// their per-object logic is here, for either kind, and the pages and the
// details panel call it directly.

export type AnyCloudEventSource = CloudEventSource | ClusterCloudEventSource;

/** The ACTIVE column of `kubectl get cloudeventsource`, from the Active condition. */
export function getActive(object: AnyCloudEventSource): boolean | undefined {
  return getConditionStatus(object.status?.conditions, "Active");
}

/**
 * Where the object sends its events: an HTTP endpoint or an Azure Event Grid
 * topic, with its address. Undefined for an object that sets neither, which
 * the controller rejects.
 */
export function getDestination(object: AnyCloudEventSource): { type: string; address: string } | undefined {
  const { http, azureEventGridTopic } = object.spec.destination ?? {};

  if (http) return { type: "HTTP", address: http.uri };
  if (azureEventGridTopic) return { type: "Azure Event Grid", address: azureEventGridTopic.endpoint };
  return undefined;
}

/** The destination in one line, for the list: `HTTP http://receiver:8080`. */
export function getDestinationText(object: AnyCloudEventSource): string {
  const destination = getDestination(object);

  return destination ? `${destination.type} ${destination.address}` : "";
}

/**
 * The authentication of the destination, as a reference for a link to it, when
 * the link resolves: a ClusterTriggerAuthentication, or a TriggerAuthentication
 * of a CloudEventSource, which is in its namespace. A ClusterCloudEventSource
 * has no namespace to look a TriggerAuthentication up in, so there is no
 * reference for that one.
 */
export function getAuthenticationRef(object: AnyCloudEventSource): Renderer.K8sApi.ObjectReference | undefined {
  const ref = object.spec.authenticationRef;

  if (!ref) return undefined;
  if (object.kind === "ClusterCloudEventSource" && ref.kind !== "ClusterTriggerAuthentication") return undefined;
  return getAuthenticationObjectRef(ref);
}
