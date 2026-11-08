import { describe, expect, it } from "vitest";
import { ClusterTriggerAuthentication } from "./clustertriggerauthentication/clustertriggerauthentication-v1alpha1";
import {
  getAuthenticationObjectRef,
  getAuthParameters,
  getEnvNames,
  getPodIdentityProvider,
  getScaledJobNames,
  getScaledObjectNames,
  getSecretNames,
  getVaultAddress,
} from "./trigger-authentication";
import { TriggerAuthentication } from "./triggerauthentication/triggerauthentication-v1alpha1";

import type { TriggerAuthenticationSpec, TriggerAuthenticationStatus } from "./types";

const buildTriggerAuthentication = (spec: TriggerAuthenticationSpec, status?: TriggerAuthenticationStatus) =>
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

describe("the trigger authentication kinds", () => {
  it("are namespaced and cluster-scoped versions of one kind, both served as keda.sh/v1alpha1", () => {
    expect(TriggerAuthentication.namespaced).toBe(true);
    expect(TriggerAuthentication.crd.shortNames).toEqual(["ta", "triggerauth"]);
    expect(ClusterTriggerAuthentication.namespaced).toBe(false);
    expect(ClusterTriggerAuthentication.apiBase).toBe("/apis/keda.sh/v1alpha1/clustertriggerauthentications");
    expect(ClusterTriggerAuthentication.crd.shortNames).toEqual(["cta", "clustertriggerauth"]);
  });
});

describe("the columns of kubectl get ta", () => {
  const object = buildTriggerAuthentication(
    {
      podIdentity: { provider: "aws", roleArn: "arn:aws:iam::123456789012:role/keda" },
      secretTargetRef: [
        { parameter: "username", name: "rabbitmq", key: "user" },
        { parameter: "password", name: "rabbitmq", key: "password" },
      ],
      env: [{ parameter: "host", name: "RABBITMQ_HOST" }],
      hashiCorpVault: {
        address: "https://vault:8200",
        authentication: "kubernetes",
        secrets: [{ parameter: "token", path: "secret/data/keda", key: "token" }],
      },
    },
    { scaledobjects: "orders,payments", scaledjobs: "" },
  );

  it("reads the pod identity provider, the Secret and variable names once each, and the Vault address", () => {
    expect(getPodIdentityProvider(object)).toBe("aws");
    expect(getSecretNames(object)).toEqual(["rabbitmq"]);
    expect(getEnvNames(object)).toEqual(["RABBITMQ_HOST"]);
    expect(getVaultAddress(object)).toBe("https://vault:8200");
  });

  it("splits the names of the objects that use the authentication, which the controller writes comma-separated", () => {
    expect(getScaledObjectNames(object)).toEqual(["orders", "payments"]);
    expect(getScaledJobNames(object)).toEqual([]);
  });
});

describe("getAuthParameters", () => {
  it("lists every parameter with its source, in the order of the spec", () => {
    const object = buildTriggerAuthentication({
      secretTargetRef: [{ parameter: "password", name: "rabbitmq", key: "password" }],
      configMapTargetRef: [{ parameter: "host", name: "rabbitmq-config", key: "host" }],
      env: [
        { parameter: "queue", name: "QUEUE" },
        { parameter: "vhost", name: "VHOST", containerName: "worker" },
      ],
      hashiCorpVault: {
        address: "https://vault:8200",
        authentication: "token",
        secrets: [{ parameter: "token", path: "secret/data/keda", key: "token" }],
      },
      azureKeyVault: {
        vaultUri: "https://example.vault.azure.net",
        secrets: [{ parameter: "connection", name: "servicebus-connection", version: "1" }],
      },
      gcpSecretManager: { secrets: [{ parameter: "credentials", id: "pubsub-credentials" }] },
      awsSecretManager: { secrets: [{ parameter: "awsSecretAccessKey", name: "keda", secretKey: "secret" }] },
      boundServiceAccountToken: [{ parameter: "bearerToken", serviceAccountName: "keda-metrics" }],
    });

    expect(getAuthParameters(object)).toEqual([
      { parameter: "password", source: "Secret", name: "rabbitmq", key: "password", kind: "Secret" },
      { parameter: "host", source: "ConfigMap", name: "rabbitmq-config", key: "host", kind: "ConfigMap" },
      { parameter: "queue", source: "Env", name: "QUEUE" },
      { parameter: "vhost", source: "Env", name: "worker/VHOST" },
      { parameter: "token", source: "HashiCorp Vault", name: "secret/data/keda", key: "token" },
      { parameter: "connection", source: "Azure Key Vault", name: "servicebus-connection" },
      { parameter: "credentials", source: "GCP Secret Manager", name: "pubsub-credentials" },
      { parameter: "awsSecretAccessKey", source: "AWS Secrets Manager", name: "keda", key: "secret" },
      { parameter: "bearerToken", source: "Service Account Token", name: "keda-metrics", kind: "ServiceAccount" },
    ]);
  });

  it("is empty for an authentication through pod identity alone", () => {
    expect(getAuthParameters(buildTriggerAuthentication({ podIdentity: { provider: "azure-workload" } }))).toEqual([]);
  });
});

describe("getAuthenticationObjectRef", () => {
  it("refers to a TriggerAuthentication when the trigger names no kind, as the controller does", () => {
    expect(getAuthenticationObjectRef({ name: "example-auth" })).toEqual({
      kind: "TriggerAuthentication",
      apiVersion: "keda.sh/v1alpha1",
      name: "example-auth",
    });
  });

  it("refers to a ClusterTriggerAuthentication by its kind", () => {
    expect(getAuthenticationObjectRef({ name: "example-cluster-auth", kind: "ClusterTriggerAuthentication" })).toEqual({
      kind: "ClusterTriggerAuthentication",
      apiVersion: "keda.sh/v1alpha1",
      name: "example-cluster-auth",
    });
  });
});
