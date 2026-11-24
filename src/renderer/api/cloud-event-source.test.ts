import { describe, expect, it } from "vitest";
import { getActive, getAuthenticationRef, getDestination, getDestinationText } from "./cloud-event-source";
import { CloudEventSource } from "./cloudeventsource/cloudeventsource-v1alpha1";
import { ClusterCloudEventSource } from "./clustercloudeventsource/clustercloudeventsource-v1alpha1";

import type { CloudEventSourceSpec, CloudEventSourceStatus } from "./types";

const http: CloudEventSourceSpec = { destination: { http: { uri: "http://receiver.default:8080" } } };

const buildCloudEventSource = (spec: CloudEventSourceSpec = http, status?: CloudEventSourceStatus) =>
  new CloudEventSource({
    apiVersion: "eventing.keda.sh/v1alpha1",
    kind: "CloudEventSource",
    metadata: {
      name: "example-events",
      namespace: "default",
      selfLink: "/apis/eventing.keda.sh/v1alpha1/namespaces/default/cloudeventsources/example-events",
    },
    spec,
    status,
  });

const buildClusterCloudEventSource = (spec: CloudEventSourceSpec = http) =>
  new ClusterCloudEventSource({
    apiVersion: "eventing.keda.sh/v1alpha1",
    kind: "ClusterCloudEventSource",
    metadata: {
      name: "example-events",
      selfLink: "/apis/eventing.keda.sh/v1alpha1/clustercloudeventsources/example-events",
    },
    spec,
  });

describe("the cloud event source kinds", () => {
  it("are namespaced and cluster-scoped versions of one kind, both served as eventing.keda.sh/v1alpha1", () => {
    expect(CloudEventSource.namespaced).toBe(true);
    expect(CloudEventSource.apiBase).toBe("/apis/eventing.keda.sh/v1alpha1/cloudeventsources");
    expect(CloudEventSource.crd.apiVersions).toEqual(["eventing.keda.sh/v1alpha1"]);
    expect(ClusterCloudEventSource.namespaced).toBe(false);
    expect(ClusterCloudEventSource.apiBase).toBe("/apis/eventing.keda.sh/v1alpha1/clustercloudeventsources");
    expect(ClusterCloudEventSource.crd.apiVersions).toEqual(["eventing.keda.sh/v1alpha1"]);
  });
});

describe("getActive", () => {
  it("is the status of the Active condition", () => {
    expect(getActive(buildCloudEventSource(http, { conditions: [{ type: "Active", status: "True" }] }))).toBe(true);
    expect(getActive(buildCloudEventSource(http, { conditions: [{ type: "Active", status: "False" }] }))).toBe(false);
  });

  it("is undefined while the condition is Unknown, and for an object the controller has not seen", () => {
    expect(getActive(buildCloudEventSource(http, { conditions: [{ type: "Active", status: "Unknown" }] }))).toBe(
      undefined,
    );
    expect(getActive(buildCloudEventSource())).toBe(undefined);
  });
});

describe("getDestination", () => {
  it("is the HTTP endpoint, next to the null the API stores for the Azure Event Grid topic", () => {
    const object = buildCloudEventSource({
      destination: { http: { uri: "http://receiver.default:8080" }, azureEventGridTopic: null },
    });

    expect(getDestination(object)).toEqual({ type: "HTTP", address: "http://receiver.default:8080" });
    expect(getDestinationText(object)).toBe("HTTP http://receiver.default:8080");
  });

  it("is the Azure Event Grid topic, for either kind", () => {
    const object = buildClusterCloudEventSource({
      destination: { http: null, azureEventGridTopic: { endpoint: "https://topic.westeurope-1.eventgrid.azure.net" } },
    });

    expect(getDestination(object)).toEqual({
      type: "Azure Event Grid",
      address: "https://topic.westeurope-1.eventgrid.azure.net",
    });
  });

  it("is undefined for an object with no destination, which the controller rejects", () => {
    const object = buildCloudEventSource({ destination: {} });

    expect(getDestination(object)).toBe(undefined);
    expect(getDestinationText(object)).toBe("");
  });
});

describe("getAuthenticationRef", () => {
  it("is undefined without an authentication", () => {
    expect(getAuthenticationRef(buildCloudEventSource())).toBe(undefined);
  });

  it("refers to a TriggerAuthentication, the default kind, of a CloudEventSource", () => {
    const object = buildCloudEventSource({ ...http, authenticationRef: { name: "example-auth" } });

    expect(getAuthenticationRef(object)).toEqual({
      kind: "TriggerAuthentication",
      apiVersion: "keda.sh/v1alpha1",
      name: "example-auth",
    });
  });

  it("refers to a ClusterTriggerAuthentication, for either kind", () => {
    const authenticationRef = { name: "example-cluster-auth", kind: "ClusterTriggerAuthentication" } as const;
    const expected = {
      kind: "ClusterTriggerAuthentication",
      apiVersion: "keda.sh/v1alpha1",
      name: "example-cluster-auth",
    };

    expect(getAuthenticationRef(buildCloudEventSource({ ...http, authenticationRef }))).toEqual(expected);
    expect(getAuthenticationRef(buildClusterCloudEventSource({ ...http, authenticationRef }))).toEqual(expected);
  });

  // A link takes its namespace from the object of the panel, and a ClusterCloudEventSource has none.
  it("is undefined for a TriggerAuthentication of a ClusterCloudEventSource, which has no namespace", () => {
    const object = buildClusterCloudEventSource({ ...http, authenticationRef: { name: "example-auth" } });

    expect(getAuthenticationRef(object)).toBe(undefined);
  });
});
