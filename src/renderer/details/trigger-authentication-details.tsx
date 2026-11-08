import { Renderer } from "@freelensapp/extensions";
import * as MobxReact from "mobx-react";
import {
  type AnyTriggerAuthentication,
  getAuthParameters,
  getScaledJobNames,
  getScaledObjectNames,
} from "../api/trigger-authentication";
import styles from "./trigger-authentication-details.module.scss";

import type { ValueFromSecret } from "../api/types";

const { observer } = MobxReact;

const {
  Component: { DrawerItem, LinkToObject },
} = Renderer;

export type TriggerAuthenticationDetailsProps = Renderer.Component.KubeObjectDetailsProps<AnyTriggerAuthentication>;

/** A value followed by the details that are set: `aws (role ARN: arn:..., identity owner: workload)`. */
function describe(value: string | undefined, details: Record<string, string | undefined>): string {
  const set = Object.entries(details)
    .filter(([, detail]) => detail)
    .map(([name, detail]) => `${name}: ${detail}`)
    .join(", ");
  return set ? `${value ?? ""} (${set})` : (value ?? "");
}

const secretKey = (ref: ValueFromSecret | undefined) =>
  ref && `Secret ${ref.secretKeyRef.name}, key ${ref.secretKeyRef.key}`;

/**
 * The details of a TriggerAuthentication or a ClusterTriggerAuthentication
 * that the host does not show already, for both kinds, which share their spec:
 * every parameter with where its value comes from, the settings of each
 * source, and, for a TriggerAuthentication, the objects that use it, as links.
 * The host shows the printer columns of the CRD (pod identity provider, Secret
 * and variable names, Vault address, file path, and the names of the objects
 * that use it).
 */
export const TriggerAuthenticationDetails = observer(({ object }: TriggerAuthenticationDetailsProps) => {
  const { spec } = object;
  const parameters = getAuthParameters(object);

  // What a TriggerAuthentication names is in its namespace. What a ClusterTriggerAuthentication names is in the
  // namespace of the KEDA operator, which the object does not say, and the objects that use it may be in any
  // namespace, so those stay text.
  const namespaced = object.kind === "TriggerAuthentication";
  const link = (kind: string, apiVersion: string, name: string) =>
    namespaced ? <LinkToObject object={object} objectRef={{ kind, apiVersion, name }} /> : name;
  const links = (kind: string, names: string[]) =>
    names.map((name, index) => (
      <span key={name}>
        {index > 0 && ", "}
        {link(kind, "keda.sh/v1alpha1", name)}
      </span>
    ));

  const { podIdentity, hashiCorpVault, azureKeyVault, gcpSecretManager, awsSecretManager, oauth2 } = spec;
  const servicePrincipal = spec.azureServicePrincipal;
  const scaledObjects = getScaledObjectNames(object);
  const scaledJobs = getScaledJobNames(object);

  return (
    <>
      <DrawerItem name="Parameters" hidden={parameters.length === 0}>
        <table className={styles.parameters}>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Source</th>
              <th>Name</th>
              <th>Key</th>
            </tr>
          </thead>
          <tbody>
            {parameters.map((parameter) => (
              <tr key={`${parameter.source}/${parameter.parameter}/${parameter.name}`}>
                <td>{parameter.parameter}</td>
                <td>{parameter.source}</td>
                <td className={styles.name}>
                  {parameter.kind ? link(parameter.kind, "v1", parameter.name) : parameter.name}
                </td>
                <td>{parameter.key ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DrawerItem>
      <DrawerItem name="Pod Identity" hidden={!podIdentity}>
        {describe(podIdentity?.provider, {
          "identity ID": podIdentity?.identityId,
          "tenant ID": podIdentity?.identityTenantId,
          "role ARN": podIdentity?.roleArn,
          "external ID": podIdentity?.externalID,
          "identity owner": podIdentity?.identityOwner,
        })}
      </DrawerItem>
      <DrawerItem name="File Path" hidden={!spec.filePath}>
        {spec.filePath}
      </DrawerItem>
      <DrawerItem name="HashiCorp Vault" hidden={!hashiCorpVault}>
        {describe(hashiCorpVault?.address, {
          authentication: hashiCorpVault?.authentication,
          namespace: hashiCorpVault?.namespace,
          mount: hashiCorpVault?.mount,
          role: hashiCorpVault?.role,
          "service account": hashiCorpVault?.credential?.serviceAccountName,
        })}
      </DrawerItem>
      <DrawerItem name="Azure Key Vault" hidden={!azureKeyVault}>
        {describe(azureKeyVault?.vaultUri, {
          cloud: azureKeyVault?.cloud?.type,
          "pod identity": azureKeyVault?.podIdentity?.provider,
          "client ID": azureKeyVault?.credentials?.clientId,
          "tenant ID": azureKeyVault?.credentials?.tenantId,
          "client secret": secretKey(azureKeyVault?.credentials?.clientSecret.valueFrom),
        })}
      </DrawerItem>
      <DrawerItem name="GCP Secret Manager" hidden={!gcpSecretManager}>
        {describe(gcpSecretManager?.podIdentity?.provider ?? "credentials", {
          credentials: secretKey(gcpSecretManager?.credentials?.clientSecret.valueFrom),
        })}
      </DrawerItem>
      <DrawerItem name="AWS Secrets Manager" hidden={!awsSecretManager}>
        {describe(awsSecretManager?.region ?? "default region", {
          "pod identity": awsSecretManager?.podIdentity?.provider,
          "access key": secretKey(awsSecretManager?.credentials?.accessKey.valueFrom),
        })}
      </DrawerItem>
      <DrawerItem name="OAuth2" hidden={!oauth2}>
        {describe(oauth2?.tokenUrl, {
          "client ID": oauth2?.clientId,
          scopes: oauth2?.scopes?.join(" "),
          "client secret": secretKey(oauth2?.clientSecret?.valueFrom),
        })}
      </DrawerItem>
      <DrawerItem name="Azure Service Principal" hidden={!servicePrincipal}>
        {describe(servicePrincipal?.tenantId, {
          "client ID": servicePrincipal?.clientId,
          cloud: servicePrincipal?.cloud,
        })}
      </DrawerItem>
      <DrawerItem name="Used by Scaled Objects" hidden={!namespaced || scaledObjects.length === 0}>
        {links("ScaledObject", scaledObjects)}
      </DrawerItem>
      <DrawerItem name="Used by Scaled Jobs" hidden={!namespaced || scaledJobs.length === 0}>
        {links("ScaledJob", scaledJobs)}
      </DrawerItem>
    </>
  );
});
