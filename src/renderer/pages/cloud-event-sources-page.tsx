import { Renderer } from "@freelensapp/extensions";
import * as MobxReact from "mobx-react";
import { type AnyCloudEventSource, getActive, getDestinationText } from "../api/cloud-event-source";
import { CloudEventSource, type CloudEventSourceApi } from "../api/cloudeventsource/cloudeventsource-v1alpha1";
import {
  ClusterCloudEventSource,
  type ClusterCloudEventSourceApi,
} from "../api/clustercloudeventsource/clustercloudeventsource-v1alpha1";
import styles from "./keda-pages.module.scss";

import type { JSX } from "react";

const { observer } = MobxReact;

const {
  Component: { BadgeBoolean, KubeObjectAge, KubeObjectListLayout, LinkToNamespace, WithTooltip },
} = Renderer;

const sortingCallbacks = {
  name: (object: AnyCloudEventSource) => object.getName(),
  namespace: (object: AnyCloudEventSource) => object.getNs(),
  destination: (object: AnyCloudEventSource) => getDestinationText(object),
  active: (object: AnyCloudEventSource) => String(getActive(object)),
  age: (object: AnyCloudEventSource) => object.getCreationTimestamp(),
};

type ColumnId = keyof typeof sortingCallbacks;

const headers: Record<ColumnId, { title: string; sortBy: ColumnId; className?: string }> = {
  name: { title: "Name", sortBy: "name" },
  namespace: { title: "Namespace", sortBy: "namespace" },
  destination: { title: "Destination", sortBy: "destination", className: styles.destination },
  active: { title: "Active", sortBy: "active", className: styles.active },
  age: { title: "Age", sortBy: "age", className: styles.age },
};

const header = (id: ColumnId) => ({ ...headers[id], id });

const cells = (object: AnyCloudEventSource): Record<ColumnId, JSX.Element | string> => ({
  name: <WithTooltip>{object.getName()}</WithTooltip>,
  namespace: <LinkToNamespace namespace={object.getNs()} />,
  destination: <WithTooltip>{getDestinationText(object) || "-"}</WithTooltip>,
  active: <BadgeBoolean value={getActive(object)} />,
  age: <KubeObjectAge object={object} key="age" />,
});

// The columns are those of `kubectl get cloudeventsource`, Active and Age, with the destination, which says what the
// object is for. The cluster-scoped kind has no namespace.
const cloudEventSourceColumns: ColumnId[] = ["name", "namespace", "destination", "active", "age"];

const clusterCloudEventSourceColumns: ColumnId[] = ["name", "destination", "active", "age"];

export const CloudEventSourcesPage = observer(() => (
  <KubeObjectListLayout<CloudEventSource, CloudEventSourceApi>
    tableId={`${CloudEventSource.crd.plural}Table`}
    className={styles.page}
    store={CloudEventSource.getStore<CloudEventSource>()}
    isConfigurable
    sortingCallbacks={sortingCallbacks}
    searchFilters={[(object: CloudEventSource) => object.getSearchFields()]}
    renderHeaderTitle={CloudEventSource.crd.title}
    renderTableHeader={cloudEventSourceColumns.map(header)}
    renderTableContents={(object: CloudEventSource) => {
      const cell = cells(object);
      return cloudEventSourceColumns.map((id) => cell[id]);
    }}
  />
));

export const ClusterCloudEventSourcesPage = observer(() => (
  <KubeObjectListLayout<ClusterCloudEventSource, ClusterCloudEventSourceApi>
    tableId={`${ClusterCloudEventSource.crd.plural}Table`}
    className={styles.page}
    store={ClusterCloudEventSource.getStore<ClusterCloudEventSource>()}
    isConfigurable
    sortingCallbacks={sortingCallbacks}
    searchFilters={[(object: ClusterCloudEventSource) => object.getSearchFields()]}
    renderHeaderTitle={ClusterCloudEventSource.crd.title}
    renderTableHeader={clusterCloudEventSourceColumns.map(header)}
    renderTableContents={(object: ClusterCloudEventSource) => {
      const cell = cells(object);
      return clusterCloudEventSourceColumns.map((id) => cell[id]);
    }}
  />
));
