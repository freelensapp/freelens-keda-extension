// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CloudEventSource } from "../api/cloudeventsource/cloudeventsource-v1alpha1";
import { ClusterCloudEventSource } from "../api/clustercloudeventsource/clustercloudeventsource-v1alpha1";
import { CloudEventSourceDetails } from "./cloud-event-source-details";

import type { CloudEventSourceSpec } from "../api/types";

afterEach(cleanup);

const http = { destination: { http: { uri: "http://receiver.default:8080" } } } satisfies CloudEventSourceSpec;

const namespaced = (spec: CloudEventSourceSpec) =>
  new CloudEventSource({
    apiVersion: "eventing.keda.sh/v1alpha1",
    kind: "CloudEventSource",
    metadata: {
      name: "example-events",
      namespace: "default",
      selfLink: "/apis/eventing.keda.sh/v1alpha1/namespaces/default/cloudeventsources/example-events",
    },
    spec,
  });

const cluster = (spec: CloudEventSourceSpec) =>
  new ClusterCloudEventSource({
    apiVersion: "eventing.keda.sh/v1alpha1",
    kind: "ClusterCloudEventSource",
    metadata: {
      name: "example-events",
      selfLink: "/apis/eventing.keda.sh/v1alpha1/clustercloudeventsources/example-events",
    },
    spec,
  });

/** The text of the item with the name, without the name. */
const item = (name: string) => screen.getByText(name).parentElement?.textContent?.slice(name.length);

describe("CloudEventSourceDetails", () => {
  it("shows the destination with its type, and every event type as included by default", () => {
    render(<CloudEventSourceDetails object={namespaced(http)} />);

    expect(item("Destination")).toBe("HTTP http://receiver.default:8080");
    expect(item("Included Event Types")).toBe("All");
    expect(screen.queryByText("Excluded Event Types")).toBeNull();
    expect(screen.queryByText("Authentication")).toBeNull();
    expect(screen.queryByText("Cluster Name")).toBeNull();
  });

  it("shows the event types that are included and excluded, and the cluster name", () => {
    render(
      <CloudEventSourceDetails
        object={namespaced({
          ...http,
          clusterName: "staging",
          eventSubscription: {
            includedEventTypes: ["keda.scaledobject.ready.v1", "keda.scaledobject.failed.v1"],
            excludedEventTypes: ["keda.scaledjob.failed.v1"],
          },
        })}
      />,
    );

    expect(item("Included Event Types")).toBe("keda.scaledobject.ready.v1keda.scaledobject.failed.v1");
    expect(item("Excluded Event Types")).toBe("keda.scaledjob.failed.v1");
    expect(item("Cluster Name")).toBe("staging");
  });

  it("links the authentication of a CloudEventSource", () => {
    const { container } = render(
      <CloudEventSourceDetails object={namespaced({ ...http, authenticationRef: { name: "example-auth" } })} />,
    );

    expect(container.querySelector("a")?.textContent).toBe("TriggerAuthentication/example-auth");
  });

  // A link takes its namespace from the object of the panel, and a ClusterCloudEventSource has none.
  it("names the TriggerAuthentication of a ClusterCloudEventSource as text, and links its cluster-scoped one", () => {
    const first = render(
      <CloudEventSourceDetails object={cluster({ ...http, authenticationRef: { name: "example-auth" } })} />,
    );

    expect(item("Authentication")).toBe("TriggerAuthentication/example-auth");
    expect(first.container.querySelector("a")).toBeNull();
    first.unmount();

    const second = render(
      <CloudEventSourceDetails
        object={cluster({
          ...http,
          authenticationRef: { name: "example-cluster-auth", kind: "ClusterTriggerAuthentication" },
        })}
      />,
    );

    expect(second.container.querySelector("a")?.textContent).toBe("ClusterTriggerAuthentication/example-cluster-auth");
  });
});
