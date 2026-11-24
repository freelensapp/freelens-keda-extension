// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClusterTriggerAuthentication } from "../api/clustertriggerauthentication/clustertriggerauthentication-v1alpha1";
import { TriggerAuthentication } from "../api/triggerauthentication/triggerauthentication-v1alpha1";
import { TriggerAuthenticationDetails } from "./trigger-authentication-details";

import type { TriggerAuthenticationSpec, TriggerAuthenticationStatus } from "../api/types";

afterEach(cleanup);

const namespaced = (spec: TriggerAuthenticationSpec, status?: TriggerAuthenticationStatus) =>
  new TriggerAuthentication({
    apiVersion: "keda.sh/v1alpha1",
    kind: "TriggerAuthentication",
    metadata: {
      name: "example-auth",
      namespace: "default",
      selfLink: "/apis/keda.sh/v1alpha1/namespaces/default/triggerauthentications/example-auth",
    },
    spec,
    status,
  });

const cluster = (spec: TriggerAuthenticationSpec) =>
  new ClusterTriggerAuthentication({
    apiVersion: "keda.sh/v1alpha1",
    kind: "ClusterTriggerAuthentication",
    metadata: {
      name: "example-auth",
      selfLink: "/apis/keda.sh/v1alpha1/clustertriggerauthentications/example-auth",
    },
    spec,
  });

// The host shows the printer columns of the CRD in the same drawer; the panel does not repeat them.
describe("TriggerAuthenticationDetails", () => {
  it("leaves out a pod identity that is its provider alone, which is the PodIdentity column", () => {
    const { container } = render(
      <TriggerAuthenticationDetails object={cluster({ podIdentity: { provider: "azure-workload" } })} />,
    );

    expect(container.textContent).toBe("");
  });

  it("shows the settings of a pod identity without its provider", () => {
    render(
      <TriggerAuthenticationDetails
        object={cluster({ podIdentity: { provider: "aws", roleArn: "arn:aws:iam::1:role/keda" } })}
      />,
    );

    expect(screen.getByText("Pod Identity Settings").parentElement?.textContent).toBe(
      "Pod Identity Settingsrole ARN: arn:aws:iam::1:role/keda",
    );
  });

  it("leaves out the file path of a ClusterTriggerAuthentication, which is the FilePath column", () => {
    const { container } = render(<TriggerAuthenticationDetails object={cluster({ filePath: "/mnt/creds" })} />);

    expect(container.textContent).toBe("");
  });

  it("links the ScaledObjects and ScaledJobs that use a TriggerAuthentication in one item", () => {
    const { container } = render(
      <TriggerAuthenticationDetails
        object={namespaced({}, { scaledobjects: "orders,payments", scaledjobs: "report" })}
      />,
    );

    expect(screen.getByText("Used By").parentElement?.textContent).toBe(
      "Used ByScaledObject/orders, ScaledObject/payments, ScaledJob/report",
    );
    // The stub of LinkToObject renders an anchor without href, which has no link role.
    expect(container.querySelectorAll("a")).toHaveLength(3);
  });
});
