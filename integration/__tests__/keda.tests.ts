/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// One session with the CRDs of the four kinds of one KEDA release,
// TEST_KEDA_VERSION or the one the types follow, and a test object of each
// kind, without the controller. The session disconnects the kind cluster, sets
// up the CRDs, connects the cluster again, so that the app reads the CRDs anew,
// and leaves the cluster disconnected; it does not depend on another test file
// having run.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  appReady,
  clickMenuItem,
  confirmDialog,
  connectApp,
  detailsObjectLink,
  disconnectKindCluster,
  eventingApiVersion,
  expectDetailsApiVersion,
  fillDialogInput,
  installExtension,
  kedaApiVersion,
  kedaVersion,
  menuItemTitles,
  openDetails,
  openKindCluster,
  openListPage,
  openRowMenu,
  relatedObjectRow,
  setUpCluster,
  tearDownCluster,
  testNamespace,
  testObjectName,
  triggerFieldValue,
  waitForAnnotation,
  waitForDetailsItem,
  waitForMenuItem,
} from "./extension-helpers";

import type { Frame } from "playwright";

import type { AppSession } from "./extension-helpers";

interface KindView {
  kind: string;
  /** The group and version the details show the test object in. */
  apiVersion: string;
  /** The `id` of the kind's `clusterPages` registration. */
  pageId: string;
  /** An item that the extension's details panel shows for the test object. */
  detailsItem: string;
  /** The extension's items in the row menu of the test object, which is not paused. */
  menuItems: string[];
  /** The kubectl resource of the kind, to read the test object back. */
  resource: string;
  namespaced: boolean;
}

const kindViews: KindView[] = [
  {
    kind: "ScaledObject",
    apiVersion: kedaApiVersion,
    pageId: "scaled-objects",
    detailsItem: "Polling Interval",
    menuItems: ["Pause Autoscaling"],
    resource: "scaledobject",
    namespaced: true,
  },
  {
    kind: "ScaledJob",
    apiVersion: kedaApiVersion,
    pageId: "scaled-jobs",
    detailsItem: "Job Containers",
    menuItems: ["Pause Autoscaling"],
    resource: "scaledjob",
    namespaced: true,
  },
  {
    kind: "TriggerAuthentication",
    apiVersion: kedaApiVersion,
    pageId: "trigger-authentications",
    detailsItem: "Parameters",
    menuItems: [],
    resource: "triggerauthentication",
    namespaced: true,
  },
  {
    kind: "ClusterTriggerAuthentication",
    apiVersion: kedaApiVersion,
    pageId: "cluster-trigger-authentications",
    detailsItem: "Parameters",
    menuItems: [],
    resource: "clustertriggerauthentication",
    namespaced: false,
  },
  {
    kind: "CloudEventSource",
    apiVersion: eventingApiVersion,
    pageId: "cloud-event-sources",
    detailsItem: "Destination",
    menuItems: [],
    resource: "cloudeventsource",
    namespaced: true,
  },
  {
    kind: "ClusterCloudEventSource",
    apiVersion: eventingApiVersion,
    pageId: "cluster-cloud-event-sources",
    detailsItem: "Destination",
    menuItems: [],
    resource: "clustercloudeventsource",
    namespaced: false,
  },
];

// The titles of every menu item of the extension, to tell them from the host's.
const extensionMenuItems = ["Pause Autoscaling", "Resume Autoscaling"];

describe.skipIf(!(await appReady({ cluster: true })))(`KEDA views with KEDA ${kedaVersion}`, () => {
  let session: AppSession | undefined;
  let frame: Frame;

  beforeAll(
    async () => {
      session = await connectApp();
      await disconnectKindCluster(session);
      setUpCluster();
      await installExtension(session);
      frame = await openKindCluster(session);
    },
    10 * 60 * 1000,
  );

  afterAll(
    async () => {
      let errors: string[] = [];

      try {
        // The errors first: the app refreshes the cluster while it disconnects,
        // and logs errors of its own when the refresh loses the race.
        errors = (await session?.stopCollecting()) ?? [];

        // The cluster then: the app watches the CRDs, and would log errors for
        // CRDs deleted under it.
        if (session) {
          await disconnectKindCluster(session);
        }

        await session?.close();
      } finally {
        tearDownCluster();
      }

      expect(errors).toEqual([]);
    },
    10 * 60 * 1000,
  );

  it.each(kindViews)("lists the $kind test object", async ({ pageId }) => {
    await openListPage(frame, pageId);
  });

  it.each(kindViews)("shows the details of the $kind test object", async ({ apiVersion, pageId, detailsItem }) => {
    const row = await openListPage(frame, pageId);

    await openDetails(frame, row, detailsItem);
    await expectDetailsApiVersion(frame, apiVersion);
  });

  it.each(kindViews)("shows the extension's menu items for the $kind test object", async ({ pageId, menuItems }) => {
    const row = await openListPage(frame, pageId);
    const menu = await openRowMenu(frame, row);

    for (const title of menuItems) {
      await waitForMenuItem(menu, title);
    }

    const titles = await menuItemTitles(menu);

    expect(titles.filter((title) => extensionMenuItems.includes(title))).toEqual(menuItems);
  });

  it("pauses the ScaledObject test object at the replicas typed in the dialog, after asking", async () => {
    const row = await openListPage(frame, "scaled-objects");
    const menu = await openRowMenu(frame, row);

    await clickMenuItem(frame, menu, "Pause Autoscaling");
    await fillDialogInput(frame, "0");
    await confirmDialog(frame, "Pause");

    expect(await waitForAnnotation("scaledobject", true, "autoscaling.keda.sh/paused-replicas")).toBe("0");
  });

  it("pauses the autoscaling of the ScaledJob test object, after asking", async () => {
    const row = await openListPage(frame, "scaled-jobs");
    const menu = await openRowMenu(frame, row);

    await clickMenuItem(frame, menu, "Pause Autoscaling");
    await confirmDialog(frame, "Pause");

    expect(await waitForAnnotation("scaledjob", true, "autoscaling.keda.sh/paused")).toBe("true");
  });

  it("shows the fields of the trigger of the ScaledObject in a table", async () => {
    const row = await openListPage(frame, "scaled-objects");

    await openDetails(frame, row, "Trigger Details");

    expect(await triggerFieldValue(frame, "threshold").textContent()).toBe("10");
    expect(await triggerFieldValue(frame, "serverAddress").textContent()).toBe("http://prometheus.monitoring:9090");
  });

  it("links the trigger of the ScaledObject to its TriggerAuthentication", async () => {
    const row = await openListPage(frame, "scaled-objects");

    await openDetails(frame, row, "Trigger Details");
    await triggerFieldValue(frame, "Authentication").locator("a").click();
    await waitForDetailsItem(frame, "Parameters");

    expect(await detailsObjectLink(frame)).toBe(
      `/apis/${kedaApiVersion}/namespaces/${testNamespace}/triggerauthentications/${testObjectName}`,
    );
  });

  it("shows what the ScaledObject ties together, with a mark on the Deployment that does not exist", async () => {
    const row = await openListPage(frame, "scaled-objects");

    await openDetails(frame, row, "Triggers");

    const target = relatedObjectRow(frame, "Scale Target").locator("td");

    expect(await target.first().textContent()).toBe(`Deployment/${testObjectName}`);
    expect(await target.last().textContent()).toContain("Not found");
    // A link: the Secret of the TriggerAuthentication exists, and has the key.
    expect(await relatedObjectRow(frame, "connection").locator("a").textContent()).toBe(
      `Secret/${testObjectName}, key connection`,
    );
  });
});
