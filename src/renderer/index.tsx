/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Renderer } from "@freelensapp/extensions";
import { ScaledObject } from "./api/scaledobject/scaledobject-v1alpha1";
import { createAvailableVersionPage } from "./components/available-version";
import {
  withDetailsErrorBoundary,
  withMenuItemErrorBoundary,
  withPageErrorBoundary,
} from "./components/error-boundary";
import { ScaledObjectDetails } from "./details/scaled-object-details";
import { KedaIcon } from "./icons";
import { ScaledObjectPauseMenuItem } from "./menus/scaled-object-pause-menu-item";
import { ScaledObjectsPage } from "./pages/scaled-objects-page";

// The kind serves a single API version, keda.sh/v1alpha1. The page still goes through
// createAvailableVersionPage so that it shows the "Not Available" page when the CRD is
// not installed in the cluster, and follows the host's API registry as it loads.
const ScaledObjectsPageAvailable = createAvailableVersionPage("Scaled Objects", [
  { kubeObjectClass: ScaledObject, PageComponent: ScaledObjectsPage, version: "v1alpha1" },
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
  ].map((registration) => withPageErrorBoundary(this, registration));

  clusterPageMenus: Renderer.LensExtension["clusterPageMenus"] = [
    {
      id: "scaled-objects",
      title: ScaledObject.crd.title,
      target: { pageId: "scaled-objects" },
      components: {
        Icon: KedaIcon,
      },
    },
  ];

  // The kind has a page of its own, so the host leaves it out of the Custom Resources tree of the cluster sidebar,
  // where it would otherwise be listed a second time under keda.sh.
  customResources = [ScaledObject];

  // The helpers take `kind` and `apiVersions` from the model class and type the props of the panel and the item from
  // it, so a panel or an item written for another kind fails the type check.
  kubeObjectDetailItems: Renderer.LensExtension["kubeObjectDetailItems"] = [
    Renderer.K8sApi.detailsFor(ScaledObject, { priority: 10, Details: ScaledObjectDetails }),
  ].map((registration) => withDetailsErrorBoundary(this, registration));

  kubeObjectMenuItems: Renderer.LensExtension["kubeObjectMenuItems"] = [
    Renderer.K8sApi.menuItemFor(ScaledObject, { MenuItem: ScaledObjectPauseMenuItem }),
  ].map((registration) => withMenuItemErrorBoundary(this, registration));
}
