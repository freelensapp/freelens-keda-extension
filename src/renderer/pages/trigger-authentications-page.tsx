import { Renderer } from "@freelensapp/extensions";
import * as MobxReact from "mobx-react";
import {
  ClusterTriggerAuthentication,
  type ClusterTriggerAuthenticationApi,
} from "../api/clustertriggerauthentication/clustertriggerauthentication-v1alpha1";
import {
  type AnyTriggerAuthentication,
  getEnvNames,
  getPodIdentityProvider,
  getScaledJobNames,
  getScaledObjectNames,
  getSecretNames,
  getVaultAddress,
} from "../api/trigger-authentication";
import {
  TriggerAuthentication,
  type TriggerAuthenticationApi,
} from "../api/triggerauthentication/triggerauthentication-v1alpha1";
import styles from "./keda-pages.module.scss";

import type { JSX } from "react";

const { observer } = MobxReact;

const {
  Component: { KubeObjectAge, KubeObjectListLayout, LinkToNamespace, WithTooltip },
} = Renderer;

const list = (values: string[]) => values.join(", ");

const sortingCallbacks = {
  name: (object: AnyTriggerAuthentication) => object.getName(),
  namespace: (object: AnyTriggerAuthentication) => object.getNs(),
  podIdentity: (object: AnyTriggerAuthentication) => getPodIdentityProvider(object) ?? "",
  secret: (object: AnyTriggerAuthentication) => list(getSecretNames(object)),
  env: (object: AnyTriggerAuthentication) => list(getEnvNames(object)),
  filePath: (object: AnyTriggerAuthentication) => object.spec.filePath ?? "",
  vaultAddress: (object: AnyTriggerAuthentication) => getVaultAddress(object) ?? "",
  scaledObjects: (object: AnyTriggerAuthentication) => list(getScaledObjectNames(object)),
  scaledJobs: (object: AnyTriggerAuthentication) => list(getScaledJobNames(object)),
  age: (object: AnyTriggerAuthentication) => object.getCreationTimestamp(),
};

type ColumnId = keyof typeof sortingCallbacks;

const headers: Record<ColumnId, { title: string; sortBy: ColumnId; className?: string }> = {
  name: { title: "Name", sortBy: "name" },
  namespace: { title: "Namespace", sortBy: "namespace" },
  podIdentity: { title: "Pod Identity", sortBy: "podIdentity", className: styles.podIdentity },
  secret: { title: "Secret", sortBy: "secret", className: styles.secret },
  env: { title: "Env", sortBy: "env", className: styles.env },
  filePath: { title: "File Path", sortBy: "filePath", className: styles.filePath },
  vaultAddress: { title: "Vault Address", sortBy: "vaultAddress", className: styles.vaultAddress },
  scaledObjects: { title: "Scaled Objects", sortBy: "scaledObjects", className: styles.scaledObjects },
  scaledJobs: { title: "Scaled Jobs", sortBy: "scaledJobs", className: styles.scaledJobs },
  age: { title: "Age", sortBy: "age", className: styles.age },
};

const cells = (object: AnyTriggerAuthentication): Record<ColumnId, JSX.Element | string> => ({
  name: <WithTooltip>{object.getName()}</WithTooltip>,
  namespace: <LinkToNamespace namespace={object.getNs()} />,
  podIdentity: getPodIdentityProvider(object) ?? "-",
  secret: <WithTooltip>{list(getSecretNames(object)) || "-"}</WithTooltip>,
  env: <WithTooltip>{list(getEnvNames(object)) || "-"}</WithTooltip>,
  filePath: <WithTooltip>{object.spec.filePath ?? "-"}</WithTooltip>,
  vaultAddress: <WithTooltip>{getVaultAddress(object) ?? "-"}</WithTooltip>,
  scaledObjects: <WithTooltip>{list(getScaledObjectNames(object)) || "-"}</WithTooltip>,
  scaledJobs: <WithTooltip>{list(getScaledJobNames(object)) || "-"}</WithTooltip>,
  age: <KubeObjectAge object={object} key="age" />,
});

// The columns mirror `kubectl get ta -o wide` and `kubectl get cta -o wide`: the cluster-scoped kind has no namespace,
// and has the file path the operator reads the credentials from.
const triggerAuthenticationColumns: ColumnId[] = [
  "name",
  "namespace",
  "podIdentity",
  "secret",
  "env",
  "vaultAddress",
  "scaledObjects",
  "scaledJobs",
  "age",
];

const clusterTriggerAuthenticationColumns: ColumnId[] = [
  "name",
  "podIdentity",
  "secret",
  "env",
  "filePath",
  "vaultAddress",
  "scaledObjects",
  "scaledJobs",
  "age",
];

export const TriggerAuthenticationsPage = observer(() => (
  <KubeObjectListLayout<TriggerAuthentication, TriggerAuthenticationApi>
    tableId={`${TriggerAuthentication.crd.plural}Table`}
    className={styles.page}
    store={TriggerAuthentication.getStore<TriggerAuthentication>()}
    sortingCallbacks={sortingCallbacks}
    searchFilters={[(object: TriggerAuthentication) => object.getSearchFields()]}
    renderHeaderTitle={TriggerAuthentication.crd.title}
    renderTableHeader={triggerAuthenticationColumns.map((id) => headers[id])}
    renderTableContents={(object: TriggerAuthentication) => {
      const cell = cells(object);
      return triggerAuthenticationColumns.map((id) => cell[id]);
    }}
  />
));

export const ClusterTriggerAuthenticationsPage = observer(() => (
  <KubeObjectListLayout<ClusterTriggerAuthentication, ClusterTriggerAuthenticationApi>
    tableId={`${ClusterTriggerAuthentication.crd.plural}Table`}
    className={styles.page}
    store={ClusterTriggerAuthentication.getStore<ClusterTriggerAuthentication>()}
    sortingCallbacks={sortingCallbacks}
    searchFilters={[(object: ClusterTriggerAuthentication) => object.getSearchFields()]}
    renderHeaderTitle={ClusterTriggerAuthentication.crd.title}
    renderTableHeader={clusterTriggerAuthenticationColumns.map((id) => headers[id])}
    renderTableContents={(object: ClusterTriggerAuthentication) => {
      const cell = cells(object);
      return clusterTriggerAuthenticationColumns.map((id) => cell[id]);
    }}
  />
));
