/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Renderer } from "@freelensapp/extensions";
import { ClusterTriggerAuthentication } from "./api/clustertriggerauthentication/clustertriggerauthentication-v1alpha1";
import { ScaledJob } from "./api/scaledjob/scaledjob-v1alpha1";
import { ScaledObject } from "./api/scaledobject/scaledobject-v1alpha1";
import { TriggerAuthentication } from "./api/triggerauthentication/triggerauthentication-v1alpha1";
import { createAvailableVersionPage } from "./components/available-version";
import {
  withDetailsErrorBoundary,
  withMenuItemErrorBoundary,
  withPageErrorBoundary,
} from "./components/error-boundary";
import { ScaledJobDetails } from "./details/scaled-job-details";
import { ScaledObjectDetails } from "./details/scaled-object-details";
import { TriggerAuthenticationDetails } from "./details/trigger-authentication-details";
import { KedaIcon } from "./icons";
import { PauseMenuItem } from "./menus/pause-menu-item";
import { ScaledJobsPage } from "./pages/scaled-jobs-page";
import { ScaledObjectsPage } from "./pages/scaled-objects-page";
import { ClusterTriggerAuthenticationsPage, TriggerAuthenticationsPage } from "./pages/trigger-authentications-page";

// Every kind serves a single API version, keda.sh/v1alpha1. The pages still go through createAvailableVersionPage so
// that each of them shows the "Not Available" page when the CRD is not installed in the cluster, and follows the
// host's API registry as it loads.
const ScaledObjectsPageAvailable = createAvailableVersionPage("Scaled Objects", [
  { kubeObjectClass: ScaledObject, PageComponent: ScaledObjectsPage, version: "v1alpha1" },
]);

const ScaledJobsPageAvailable = createAvailableVersionPage("Scaled Jobs", [
  { kubeObjectClass: ScaledJob, PageComponent: ScaledJobsPage, version: "v1alpha1" },
]);

const TriggerAuthenticationsPageAvailable = createAvailableVersionPage("Trigger Authentications", [
  { kubeObjectClass: TriggerAuthentication, PageComponent: TriggerAuthenticationsPage, version: "v1alpha1" },
]);

const ClusterTriggerAuthenticationsPageAvailable = createAvailableVersionPage("Cluster Trigger Authentications", [
  {
    kubeObjectClass: ClusterTriggerAuthentication,
    PageComponent: ClusterTriggerAuthenticationsPage,
    version: "v1alpha1",
  },
]);

// Every page, details panel and menu item renders inside an error boundary, so that an error it throws stays in its
// place: the host has none around the details drawer or a menu item, and its boundary around the cluster frame would
// replace the whole cluster view. Each registration field is mapped through its wrapper, so an entry added to it is
// wrapped too.
export default class KedaRenderer extends Renderer.LensExtension {
  clusterPages: Renderer.LensExtension["clusterPages"] = [
    {
      id: "scaled-objects",
      components: {
        Page: () => <ScaledObjectsPageAvailable extension={this} />,
      },
    },
    {
      id: "scaled-jobs",
      components: {
        Page: () => <ScaledJobsPageAvailable extension={this} />,
      },
    },
    {
      id: "trigger-authentications",
      components: {
        Page: () => <TriggerAuthenticationsPageAvailable extension={this} />,
      },
    },
    {
      id: "cluster-trigger-authentications",
      components: {
        Page: () => <ClusterTriggerAuthenticationsPageAvailable extension={this} />,
      },
    },
  ].map((registration) => withPageErrorBoundary(this, registration));

  // One KEDA group in the sidebar, which opens its first page, with an entry per kind under it.
  clusterPageMenus: Renderer.LensExtension["clusterPageMenus"] = [
    {
      id: "keda",
      title: "KEDA",
      target: { pageId: "scaled-objects" },
      components: {
        Icon: KedaIcon,
      },
    },
    {
      id: "scaled-objects",
      parentId: "keda",
      title: ScaledObject.crd.title,
      target: { pageId: "scaled-objects" },
      components: {},
    },
    {
      id: "scaled-jobs",
      parentId: "keda",
      title: ScaledJob.crd.title,
      target: { pageId: "scaled-jobs" },
      components: {},
    },
    {
      id: "trigger-authentications",
      parentId: "keda",
      title: TriggerAuthentication.crd.title,
      target: { pageId: "trigger-authentications" },
      components: {},
    },
    {
      id: "cluster-trigger-authentications",
      parentId: "keda",
      title: ClusterTriggerAuthentication.crd.title,
      target: { pageId: "cluster-trigger-authentications" },
      components: {},
    },
  ];

  // Every kind has a page of its own, so the host leaves all of them out of the Custom Resources tree of the cluster
  // sidebar, where they would otherwise be listed a second time under keda.sh.
  customResources = [ScaledObject, ScaledJob, TriggerAuthentication, ClusterTriggerAuthentication];

  // The helpers take `kind` and `apiVersions` from the model class and type the props of the panel and the item from
  // it, so a panel or an item written for another kind fails the type check. TriggerAuthenticationDetails takes the
  // union of the two authentication models and serves both registrations, as PauseMenuItem does for the two kinds
  // that take the pause annotation.
  kubeObjectDetailItems: Renderer.LensExtension["kubeObjectDetailItems"] = [
    Renderer.K8sApi.detailsFor(ScaledObject, { priority: 10, Details: ScaledObjectDetails }),
    Renderer.K8sApi.detailsFor(ScaledJob, { priority: 10, Details: ScaledJobDetails }),
    Renderer.K8sApi.detailsFor(TriggerAuthentication, { priority: 10, Details: TriggerAuthenticationDetails }),
    Renderer.K8sApi.detailsFor(ClusterTriggerAuthentication, { priority: 10, Details: TriggerAuthenticationDetails }),
  ].map((registration) => withDetailsErrorBoundary(this, registration));

  kubeObjectMenuItems: Renderer.LensExtension["kubeObjectMenuItems"] = [
    Renderer.K8sApi.menuItemFor(ScaledObject, { MenuItem: PauseMenuItem }),
    Renderer.K8sApi.menuItemFor(ScaledJob, { MenuItem: PauseMenuItem }),
  ].map((registration) => withMenuItemErrorBoundary(this, registration));
}
