import type { Renderer } from "@freelensapp/extensions";

import type { ClusterTriggerAuthentication } from "./clustertriggerauthentication/clustertriggerauthentication-v1alpha1";
import type { TriggerAuthentication } from "./triggerauthentication/triggerauthentication-v1alpha1";
import type { AuthenticationRef } from "./types";

// TriggerAuthentication and ClusterTriggerAuthentication share their spec and
// status, so their per-object logic is here, for either kind, and the pages and
// the details panel call it directly.

export type AnyTriggerAuthentication = TriggerAuthentication | ClusterTriggerAuthentication;

const unique = (values: string[]) => [...new Set(values)];

const splitNames = (value: string | undefined) =>
  value
    ?.split(",")
    .map((name) => name.trim())
    .filter(Boolean) ?? [];

/**
 * The authentication a trigger refers to, as a reference for a link to it: a
 * TriggerAuthentication in the namespace of the trigger, the controller's
 * default, or a ClusterTriggerAuthentication.
 */
export function getAuthenticationObjectRef(ref: AuthenticationRef): Renderer.K8sApi.ObjectReference {
  return { kind: ref.kind ?? "TriggerAuthentication", apiVersion: "keda.sh/v1alpha1", name: ref.name };
}

/** The PODIDENTITY column of `kubectl get ta`. */
export function getPodIdentityProvider(object: AnyTriggerAuthentication): string | undefined {
  return object.spec.podIdentity?.provider;
}

/** The SECRET column of `kubectl get ta`: the Secrets the parameters come from. */
export function getSecretNames(object: AnyTriggerAuthentication): string[] {
  return unique(object.spec.secretTargetRef?.map((ref) => ref.name) ?? []);
}

/** The ENV column of `kubectl get ta`: the variables of the scale target the parameters come from. */
export function getEnvNames(object: AnyTriggerAuthentication): string[] {
  return unique(object.spec.env?.map((env) => env.name) ?? []);
}

/** The VAULTADDRESS column of `kubectl get ta`. */
export function getVaultAddress(object: AnyTriggerAuthentication): string | undefined {
  return object.spec.hashiCorpVault?.address;
}

/**
 * The SCALEDOBJECTS column of `kubectl get ta -o wide`: the ScaledObjects
 * that use the authentication, by name. For a ClusterTriggerAuthentication
 * the names carry no namespace.
 */
export function getScaledObjectNames(object: AnyTriggerAuthentication): string[] {
  return splitNames(object.status?.scaledobjects);
}

/** The SCALEDJOBS column of `kubectl get ta -o wide`, as `getScaledObjectNames`. */
export function getScaledJobNames(object: AnyTriggerAuthentication): string[] {
  return splitNames(object.status?.scaledjobs);
}

/**
 * A parameter the authentication passes to the scalers, and where its value
 * comes from.
 */
export interface AuthParameter {
  /** The parameter of the scaler, such as `password` or `host`. */
  parameter: string;
  /** Secret, ConfigMap, Env, HashiCorp Vault, Azure Key Vault, ... */
  source: string;
  /** What the value is read from: a Secret, a variable, a Vault path. */
  name: string;
  /** The key of the value in it, for the sources that have keys. */
  key?: string;
  /** The kind of the Kubernetes object `name` names, which a panel can link to. */
  kind?: "Secret" | "ConfigMap" | "ServiceAccount";
}

/**
 * Every parameter the authentication passes to the scalers, source by source,
 * in the order of the spec. A variable of a named container reads
 * `container/VARIABLE`. Pod identity, a file path and OAuth2 resolve no
 * parameter of their own, so they are not among them.
 */
export function getAuthParameters(object: AnyTriggerAuthentication): AuthParameter[] {
  const { spec } = object;

  return [
    ...(spec.secretTargetRef ?? []).map(({ parameter, name, key }) => ({
      parameter,
      source: "Secret",
      name,
      key,
      kind: "Secret" as const,
    })),
    ...(spec.configMapTargetRef ?? []).map(({ parameter, name, key }) => ({
      parameter,
      source: "ConfigMap",
      name,
      key,
      kind: "ConfigMap" as const,
    })),
    ...(spec.env ?? []).map(({ parameter, name, containerName }) => ({
      parameter,
      source: "Env",
      name: containerName ? `${containerName}/${name}` : name,
    })),
    ...(spec.hashiCorpVault?.secrets ?? []).map(({ parameter, path, key }) => ({
      parameter,
      source: "HashiCorp Vault",
      name: path,
      key,
    })),
    ...(spec.azureKeyVault?.secrets ?? []).map(({ parameter, name }) => ({
      parameter,
      source: "Azure Key Vault",
      name,
    })),
    ...(spec.gcpSecretManager?.secrets ?? []).map(({ parameter, id }) => ({
      parameter,
      source: "GCP Secret Manager",
      name: id,
    })),
    ...(spec.awsSecretManager?.secrets ?? []).map(({ parameter, name, secretKey }) => ({
      parameter,
      source: "AWS Secrets Manager",
      name,
      key: secretKey,
    })),
    ...(spec.boundServiceAccountToken ?? []).map(({ parameter, serviceAccountName }) => ({
      parameter,
      source: "Service Account Token",
      name: serviceAccountName,
      kind: "ServiceAccount" as const,
    })),
  ];
}
