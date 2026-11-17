// @vitest-environment jsdom

import { Renderer } from "@freelensapp/extensions";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatQuantity, getTriggerIndex, getTriggerValues } from "./external-metrics";
import { ScaledObject } from "./scaledobject/scaledobject-v1alpha1";

const buildScaledObject = (externalMetricNames?: string[]) =>
  new ScaledObject({
    apiVersion: "keda.sh/v1alpha1",
    kind: "ScaledObject",
    metadata: {
      name: "checkout-api",
      namespace: "storefront",
      selfLink: "/apis/keda.sh/v1alpha1/namespaces/storefront/scaledobjects/checkout-api",
    },
    spec: { scaleTargetRef: { name: "checkout-api" }, triggers: [] },
    status: externalMetricNames && { externalMetricNames },
  });

// The external metrics API, reduced to the value it serves per metric name; a missing name fails, as a 404 does.
const stubMetrics = (values: Record<string, string>) =>
  vi.spyOn(Renderer.K8sApi.KubeJsonApi.prototype, "get").mockImplementation(async (...args: unknown[]) => {
    const name = String(args[0]).split("/").at(-1) ?? "";

    if (!(name in values)) throw new Error("not found");

    return { items: [{ metricName: name, value: values[name] }] };
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getTriggerIndex", () => {
  it("is the index the controller puts at the start of the metric name", () => {
    expect(getTriggerIndex("s0-cron-Europe-Rome-08xx1-5-020xx1-5")).toBe(0);
    expect(getTriggerIndex("s2-prometheus")).toBe(2);
    expect(getTriggerIndex("s12-rabbitmq-orders")).toBe(12);
  });

  it("is undefined for a name of another form", () => {
    expect(getTriggerIndex("prometheus")).toBe(undefined);
    expect(getTriggerIndex("sx-prometheus")).toBe(undefined);
  });
});

describe("formatQuantity", () => {
  it("leaves a whole number as it is", () => {
    expect(formatQuantity("0")).toBe("0");
    expect(formatQuantity("42")).toBe("42");
  });

  it("turns thousandths into a decimal number", () => {
    expect(formatQuantity("1500m")).toBe("1.5");
    expect(formatQuantity("250m")).toBe("0.25");
    expect(formatQuantity("-500m")).toBe("-0.5");
  });

  it("leaves a quantity with another suffix as the API writes it", () => {
    expect(formatQuantity("2k")).toBe("2k");
  });
});

describe("getTriggerValues", () => {
  it("reads each external metric of the object, in its namespace and by its name", async () => {
    const get = stubMetrics({ "s2-prometheus": "1500m", "s3-cron-Europe-Rome-08xx1-5-020xx1-5": "1" });
    const object = buildScaledObject(["s2-prometheus", "s3-cron-Europe-Rome-08xx1-5-020xx1-5"]);

    expect(await getTriggerValues(object)).toEqual(
      new Map([
        [2, "1.5"],
        [3, "1"],
      ]),
    );
    expect(get).toHaveBeenCalledWith("/apis/external.metrics.k8s.io/v1beta1/namespaces/storefront/s2-prometheus", {
      query: { labelSelector: "scaledobject.keda.sh/name=checkout-api" },
    });
  });

  it("leaves out a metric that cannot be read, and keeps the others", async () => {
    stubMetrics({ "s1-prometheus": "7" });

    expect(await getTriggerValues(buildScaledObject(["s0-kafka-orders", "s1-prometheus"]))).toEqual(
      new Map([[1, "7"]]),
    );
  });

  it("makes no request for an object with no external metric", async () => {
    const get = stubMetrics({});

    expect(await getTriggerValues(buildScaledObject())).toEqual(new Map());
    expect(await getTriggerValues(buildScaledObject([]))).toEqual(new Map());
    expect(get).not.toHaveBeenCalled();
  });
});
