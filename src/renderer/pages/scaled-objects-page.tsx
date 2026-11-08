import { Renderer } from "@freelensapp/extensions";
import * as MobxReact from "mobx-react";
import { ScaledObject, type ScaledObjectApi } from "../api/scaledobject/scaledobject-v1alpha1";
import styles from "./keda-pages.module.scss";

const { observer } = MobxReact;

const {
  Component: { Badge, BadgeBoolean, KubeObjectAge, KubeObjectListLayout, LinkToNamespace, WithTooltip },
} = Renderer;

const KubeObject = ScaledObject;
type KubeObject = ScaledObject;
type KubeObjectApi = ScaledObjectApi;

const sortingCallbacks = {
  name: (object: KubeObject) => object.getName(),
  namespace: (object: KubeObject) => object.getNs(),
  scaleTarget: (object: KubeObject) => KubeObject.getScaleTarget(object),
  min: (object: KubeObject) => KubeObject.getMin(object) ?? Number.POSITIVE_INFINITY,
  max: (object: KubeObject) => KubeObject.getMax(object) ?? Number.POSITIVE_INFINITY,
  triggers: (object: KubeObject) => KubeObject.getTriggerSummary(object),
  status: (object: KubeObject) => KubeObject.getStatusText(object),
  ready: (object: KubeObject) => String(KubeObject.getReady(object)),
  active: (object: KubeObject) => String(KubeObject.getActive(object)),
  fallback: (object: KubeObject) => String(KubeObject.getFallback(object)),
  age: (object: KubeObject) => object.getCreationTimestamp(),
};

const renderTableHeader = (
  [
    { title: "Name", sortBy: "name" },
    { title: "Namespace", sortBy: "namespace" },
    { title: "Scale Target", sortBy: "scaleTarget", className: styles.scaleTarget },
    { title: "Min", sortBy: "min", className: styles.min },
    { title: "Max", sortBy: "max", className: styles.max },
    { title: "Triggers", sortBy: "triggers", className: styles.triggers },
    { title: "Status", sortBy: "status", className: styles.status },
    { title: "Ready", sortBy: "ready", className: styles.ready },
    { title: "Active", sortBy: "active", className: styles.active },
    { title: "Fallback", sortBy: "fallback", className: styles.fallback },
    { title: "Age", sortBy: "age", className: styles.age },
  ] satisfies { title: string; sortBy: keyof typeof sortingCallbacks; className?: string }[]
).map((header) => ({ ...header, id: header.sortBy }));

// The column menu of the table hides and shows the columns, by their ids, and the host keeps the choice per table.
// Ready, Active and Fallback start hidden, as the Status column sums them up, so the list fits a narrow window.
const defaultHiddenTableColumns: (keyof typeof sortingCallbacks)[] = ["ready", "active", "fallback"];

// The columns follow `kubectl get so`: the scale target as kind/name, MIN, MAX, TRIGGERS, READY, ACTIVE and FALLBACK,
// with the conditions summed up in Status.
export const ScaledObjectsPage = observer(() => {
  const store = KubeObject.getStore<KubeObject>();

  return (
    <KubeObjectListLayout<KubeObject, KubeObjectApi>
      tableId={`${KubeObject.crd.plural}Table`}
      className={styles.page}
      store={store}
      isConfigurable
      defaultHiddenTableColumns={defaultHiddenTableColumns}
      sortingCallbacks={sortingCallbacks}
      searchFilters={[(object: KubeObject) => object.getSearchFields()]}
      renderHeaderTitle={KubeObject.crd.title}
      renderTableHeader={renderTableHeader}
      renderTableContents={(object: KubeObject) => [
        <WithTooltip>{object.getName()}</WithTooltip>,
        <LinkToNamespace namespace={object.getNs()} />,
        <WithTooltip>{KubeObject.getScaleTarget(object)}</WithTooltip>,
        KubeObject.getMin(object) ?? "-",
        KubeObject.getMax(object) ?? "-",
        <WithTooltip>{KubeObject.getTriggerSummary(object)}</WithTooltip>,
        <Badge label={KubeObject.getStatusText(object)} className={KubeObject.getStatusClass(object)} />,
        <BadgeBoolean value={KubeObject.getReady(object)} />,
        <BadgeBoolean value={KubeObject.getActive(object)} />,
        <BadgeBoolean value={KubeObject.getFallback(object)} />,
        <KubeObjectAge object={object} key="age" />,
      ]}
    />
  );
});
