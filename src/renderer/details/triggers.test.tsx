// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScaledObject } from "../api/scaledobject/scaledobject-v1alpha1";
import { Triggers } from "./triggers";

import type { ScaleTriggers } from "../api/types";

afterEach(cleanup);

const object = new ScaledObject({
  apiVersion: "keda.sh/v1alpha1",
  kind: "ScaledObject",
  metadata: {
    name: "checkout-api",
    namespace: "storefront",
    selfLink: "/apis/keda.sh/v1alpha1/namespaces/storefront/scaledobjects/checkout-api",
  },
  spec: { scaleTargetRef: { name: "checkout-api" }, triggers: [] },
});

const rabbitmq: ScaleTriggers = {
  type: "rabbitmq",
  name: "orders-queue",
  metricType: "AverageValue",
  metadata: { queueName: "orders", desiredReplicas: "3" },
  authenticationRef: { name: "rabbitmq-connection" },
};

/** The rows of a table, as the text of their header cell and of their value cell. */
const rowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) => [within(row).getByRole("rowheader").textContent, within(row).getByRole("cell").textContent]);

describe("Triggers", () => {
  it("shows the metric type, the metadata and the authentication of a trigger as rows of one table", () => {
    render(<Triggers object={object} triggers={[rabbitmq]} />);

    expect(rowsOf(screen.getByRole("table"))).toEqual([
      ["Metric Type", "AverageValue"],
      ["queueName", "orders"],
      ["desiredReplicas", "3"],
      ["Authentication", "TriggerAuthentication/rabbitmq-connection"],
    ]);
  });

  it("shows each trigger with its type and name over a table of its own", () => {
    const cron: ScaleTriggers = { type: "cron", name: "business-hours", metadata: { timezone: "Europe/Rome" } };

    render(<Triggers object={object} triggers={[rabbitmq, cron]} />);

    const tables = screen.getAllByRole("table");

    expect(tables).toHaveLength(2);
    expect(screen.getByText("business-hours")).toBeTruthy();
    expect(rowsOf(tables[1] as HTMLElement)).toEqual([["timezone", "Europe/Rome"]]);
  });

  it("leaves out the table of a trigger that has no fields", () => {
    render(<Triggers object={object} triggers={[{ type: "cpu", metadata: {} }]} />);

    expect(screen.getByText("cpu")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders nothing without triggers", () => {
    const { container } = render(<Triggers object={object} triggers={[]} />);

    expect(container.textContent).toBe("");
  });
});
