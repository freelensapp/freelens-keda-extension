// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRelatedObjects } from "../api/related-objects";
import { ScaledObject } from "../api/scaledobject/scaledobject-v1alpha1";
import { RelatedObjects } from "./related-objects";

vi.mock("../api/related-objects", () => ({ getRelatedObjects: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.mocked(getRelatedObjects).mockReset();
});

const buildScaledObject = (resourceVersion: string) =>
  new ScaledObject({
    apiVersion: "keda.sh/v1alpha1",
    kind: "ScaledObject",
    metadata: {
      name: "checkout-api",
      namespace: "storefront",
      uid: "7d0c2f6e",
      resourceVersion,
      selfLink: "/apis/keda.sh/v1alpha1/namespaces/storefront/scaledobjects/checkout-api",
    },
    spec: { scaleTargetRef: { name: "checkout-api" }, triggers: [] },
  });

/** The cells of the rows of the table, as text. */
const rowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) => [...row.children].map((cell) => cell.textContent));

describe("RelatedObjects", () => {
  it("shows each object in a row of one table, with a link to the ones that exist and a mark on the others", async () => {
    vi.mocked(getRelatedObjects).mockResolvedValue([
      {
        role: "Scale Target",
        level: 0,
        name: "Deployment/checkout-api",
        ref: { kind: "Deployment", apiVersion: "apps/v1", name: "checkout-api" },
        state: "2 of 3 replicas ready",
      },
      { role: "password", level: 1, name: "Secret/rabbitmq, key password", problem: "Not found" },
    ]);

    render(<RelatedObjects object={buildScaledObject("1")} />);

    const table = await screen.findByRole("table");

    expect(screen.getByRole("heading").textContent).toBe("Related Objects");
    expect(rowsOf(table)).toEqual([
      ["Scale Target", "Deployment/checkout-api", "2 of 3 replicas ready"],
      ["password", "Secret/rabbitmq, key password", "error_outlineNot found"],
    ]);
    expect([...table.querySelectorAll("a")].map((link) => link.textContent)).toEqual(["Deployment/checkout-api"]);
  });

  it("renders nothing while there is no row", async () => {
    vi.mocked(getRelatedObjects).mockResolvedValue([]);

    const { container } = render(<RelatedObjects object={buildScaledObject("1")} />);

    await waitFor(() => expect(getRelatedObjects).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("reads the objects again when the object changes, and not when it renders again", async () => {
    vi.mocked(getRelatedObjects).mockResolvedValue([]);

    const { rerender } = render(<RelatedObjects object={buildScaledObject("1")} />);

    rerender(<RelatedObjects object={buildScaledObject("1")} />);
    expect(getRelatedObjects).toHaveBeenCalledTimes(1);

    rerender(<RelatedObjects object={buildScaledObject("2")} />);
    await waitFor(() => expect(getRelatedObjects).toHaveBeenCalledTimes(2));
  });
});
