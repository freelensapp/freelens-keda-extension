# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

> **Tip**: If you find yourself correcting the agent during interactive work, suggest adding a new rule to this file so the lesson is captured for future sessions.

## Project Overview

A Freelens extension for KEDA (Kubernetes Event-driven Autoscaling): a list
page and a details panel for the four kinds of `keda.sh/v1alpha1` (KEDA 2.x),
ScaledObject, ScaledJob, TriggerAuthentication and
ClusterTriggerAuthentication, under a KEDA group in the sidebar. The panels of
ScaledObject and ScaledJob show their triggers and scaling events, those of
the two authentication kinds every parameter and where it comes from, and
ScaledObject and ScaledJob get the Pause Autoscaling and Resume Autoscaling
menu items, with Scale to Zero for a ScaledObject.

- **Language**: TypeScript 7.x
- **Runtime**: Freelens >= 2.0.0 (extension API v2, `engines.freelens: ^2.0.0`).
  The host provides React 19, mobx 7 and mobx-react 10 at runtime.
- **Toolchain**: Node.js 24 (`mise.toml`, `.nvmrc`) and pnpm 12 through
  corepack (`packageManager`)
- **Build**: Vite 8 (Rolldown), ES module bundles in `dist/`, with the layout
  of freelensapp/freelens-example-extension, the reference template of a v2
  extension
- **License**: MIT

Library and tool versions follow the Freelens stack exactly: the catalog in
Freelens's `pnpm-workspace.yaml` for libraries, the root `package.json` scripts
of Freelens for tools run with `pnpm dlx` (Biome, knip, Trunk launcher), and
Freelens's `mise.toml` and `.nvmrc` for Node and the other mise tools.
Renovate keeps them there, through the custom datasources in
`.renovaterc.json`, in one `Freelens dependencies` group PR together with a
release of `@freelensapp/extensions`. `@freelensapp/extensions` is pinned to
one exact version. The libraries the host provides at runtime (`react`,
`react-dom`, `mobx`, `mobx-react`) and their types are devDependencies only,
for compiling and testing; the build maps the imports onto the host's copies
("Build"). `electron` is a devDependency for its types only. Freelens installs
no dependency of an extension: whatever the code needs at runtime and the host
does not provide has to be in the bundle.

pnpm settings live in `pnpm-workspace.yaml`: `allowBuilds` for the
dependencies with install scripts (a new one must be listed there with `true`
or `false`, or `pnpm install` fails), the default `minimumReleaseAge` of one
day, with `@freelensapp/extensions` and the exact Electron version Freelens
let in early excluded, and `strictPeerDependencies`, which fails the install
when a copy of a shared library is outside the peer range that
`@freelensapp/extensions` declares for it.

## Common Commands

```bash
# Type checking
pnpm type:check                # All of the programs below, in this order
pnpm type:check:sources        # main and renderer, each with src/common/
pnpm type:check:tests          # Tests and test support
pnpm type:check:tooling        # Vite and Vitest configs, build plugins
pnpm type:check:integration    # Integration tests
pnpm type:check:environments   # Environment tests

# Linting & formatting
pnpm biome:check          # TypeScript/TSX, JS, JSON, CSS, SCSS, HTML, YAML, Markdown (biome)
pnpm biome:fix            # Auto-fix the formats above
pnpm trunk:check          # TOML, shell, workflows, yamllint, and Biome again (changed files)
pnpm trunk:fix            # Auto-fix TOML, shell, and the Biome formats
pnpm lint:check           # Alias for biome:check
pnpm lint:fix             # Alias for biome:fix
pnpm knip:check           # Unused files, unused and unlisted dependencies (knip)

# Tests
pnpm test:unit            # vitest
pnpm test:integration     # vitest, against Freelens dev with a kind cluster

# Build
pnpm build                # Both Vite runs, without the type check
pnpm dev                  # Both Vite runs in watch mode, for a directory install

# Pack for testing
pnpm pack:dev             # Bump prerelease version, build, and create .tgz for install in Freelens app

# Clean
pnpm clean                # Clean dist/
pnpm clean:dts            # Remove generated *.d.scss.ts files
pnpm clean:all            # Clean everything (dist, dts, node_modules, tgz)
```

## Architecture

```text
src/
  main/index.ts                      # Main entry (Main.LensExtension), stateless
  renderer/index.tsx                 # Renderer entry: pages, sidebar group, details panels, menu items, customResources
  renderer/api/types.ts              # KEDA spec and status types
  renderer/api/status-helpers.ts     # Conditions, status lists and the pause annotation, for ScaledObject and ScaledJob
  renderer/api/trigger-authentication.ts # The logic of both trigger authentication kinds, and their parameters
  renderer/api/events.ts             # When an event was last seen, and the newest events, for both event APIs
  renderer/api/<kind>/<kind>-<version>.ts # Model and KubeApi of a kind, with its tests
  renderer/pages/                    # One list page per kind, both authentication kinds in one file, and their CSS module
  renderer/details/                  # One panel per kind, one for both authentication kinds, Triggers, ScalingEvents
  renderer/menus/                    # PauseMenuItem: Pause, Scale to Zero and Resume, for ScaledObject and ScaledJob
  renderer/components/               # createAvailableVersionPage, ErrorBoundary and its wrappers, ErrorPage
  renderer/icons/                    # The SVG icon, imported with ?raw, and its component
  renderer/vars.scss                 # SCSS variables
  common/                            # Code both entries would import; empty today, its tsconfig.json stays
test/freelens-extensions.ts          # Runtime stub of @freelensapp/extensions for Vitest
environment-tests/                   # Probes for the per-environment programs
build/                               # Vite plugins: host modules, standard decorators, CSS module declarations
integration/__tests__/               # Integration tests, run against Freelens dev over CDP, and their shared module
integration/fixtures/                # Test objects of the integration tests, one of each kind
vite.config.mjs                      # The build, renderer and main
examples/keda/                       # Test objects of the four kinds, and the Deployments they scale (kubectl apply -f)
```

Build output goes to `dist/`: `main.js`, `renderer.js` and `renderer.css`, with
source maps. `main` and `renderer` in `package.json` point at the two entries.

## CRD KubeObject Pattern

A model is a subclass of `Renderer.K8sApi.LensExtensionKubeObject`, one file
per kind and version: `src/renderer/api/scaledobject/scaledobject-v1alpha1.ts`,
`scaledjob/scaledjob-v1alpha1.ts`,
`triggerauthentication/triggerauthentication-v1alpha1.ts` and
`clustertriggerauthentication/clustertriggerauthentication-v1alpha1.ts`.

The host reads the model's metadata from the class, through `static readonly`
properties. The objects it hands to the extension, in a list, a details panel
or a menu item, come from the host's store for the resource: they are
instances of the host's `KubeObject`, not of the subclass. The methods of
`KubeObject` itself are there (`getName()`, `getNs()`,
`getCreationTimestamp()`, `getSearchFields()`), a method the subclass defines
is not, and calling it throws. So:

- **Metadata**: `static readonly` `kind`, `namespaced`, `apiBase` and `crd`,
  a `KedaKubeObjectCRD`: the host's `LensExtensionKubeObjectCRD` plus the
  `title` of the page.
- **Instance type**: `declare kind` and `declare apiVersion`, with the kind and
  the version as literals. Two versions of a kind usually differ only in
  optional fields, so without the literals their classes are assignable to
  each other, and `detailsFor` and `menuItemFor` accept a component written
  for the other version ("Renderer Components"). `declare` emits nothing, so
  the runtime object is the host's as before.
- **Per-object logic**: a `static` method that takes the object, such as
  `ScaledObject.getStatusText(object)`. The statics of ScaledObject and
  ScaledJob delegate to `status-helpers.ts`, which reads the conditions the
  controller writes (`Ready`, `Active`, `Fallback`, `Paused`) and sums them
  up in the Status column with the controller's precedence: an error of Ready,
  then Paused, Fallback, Active and Ready; a ScaledJob has no Fallback. `getScaleTargetKind` takes the kind
  out of the GVK string the controller resolves into the status
  (`apps/v1.Deployment`), and falls back to the kind of the spec for an object
  the controller has not resolved, or rejected. `getTriggerTypes` and
  `getExternalMetricNames` normalize the status list fields that KEDA versions
  write either as an array or as a comma-separated string. TriggerAuthentication
  and ClusterTriggerAuthentication share their spec and status, so their logic
  is in `trigger-authentication.ts`, functions that take either kind, which the
  pages and the panel call directly; the two models carry their metadata only.
- **Constants**: the annotations the controller reads are `static readonly`
  on the model (`pausedAnnotation`, `pausedReplicasAnnotation`); the menu
  items and `getPausedAnnotation` use them, never the literal.
- **Fields**: `object.spec` and `object.status`, typed by the kind's spec and
  status interfaces in `types.ts`.
- **Forbidden**: instance methods on the subclass; a fallback such as
  `typeof (object as any).getReady === "function" ? ...`, which always takes
  the fallback; `as any`.

```typescript
export class ScaledObject extends Renderer.K8sApi.LensExtensionKubeObject<
  Renderer.K8sApi.KubeObjectMetadata,
  ScaledObjectStatus,
  ScaledObjectSpec
> {
  declare kind: "ScaledObject";
  declare apiVersion: "keda.sh/v1alpha1";

  static readonly kind = "ScaledObject";
  static readonly namespaced = true;
  static readonly apiBase = "/apis/keda.sh/v1alpha1/scaledobjects";

  static readonly crd: KedaKubeObjectCRD = {
    apiVersions: ["keda.sh/v1alpha1"],
    plural: "scaledobjects",
    singular: "scaledobject",
    shortNames: ["so"],
    title: "Scaled Objects",
  };

  static getReady(object: ScaledObject): boolean | undefined {
    return getConditionStatus(object.status?.conditions, "Ready");
  }
}

export class ScaledObjectApi extends Renderer.K8sApi.KubeApi<ScaledObject> {}
```

The file also exports a `KubeApi` subclass, which the list page uses as the
type of `KubeObjectListLayout`; it is not instantiated, because the store comes
from the host. The host registers an API, and with it a store, for every
version of a CRD the cluster serves, and `ScaledObject.getStore<ScaledObject>()`
returns the one for the first entry of `crd.apiVersions` that is served; it
throws when none is. The page calls it while it renders and the menu item when
it is clicked, both in a cluster frame only. Nothing is built when the module
loads: the root frame loads the renderer entry too, and the host refuses to
build a `KubeApi` outside a cluster frame ("request MUST be provided if not in
a cluster page frame context"), which the 1.x releases logged at every start.

`createAvailableVersionPage` decides whether a kind is served with
`kubeObjectClass.getStore()` and renders a "Not Available" page otherwise.
The page it returns is an `observer`: `getStore()` reads the host's observable
API registry, and the host registers a CRD's APIs after the cluster frame has
loaded the CRDs, so a page opened before that renders again when the kind is
served. Freelens restores the last page when a cluster is opened, so this
happens often. `src/renderer/components/available-version.test.tsx` checks it
with a spy on `getStore` that reads an observable.

`customResources` in `src/renderer/index.tsx` lists the four model classes.
The host reads the group and plural from each class's `crd`, and while the
extension is enabled it leaves the resources out of the Custom Resources tree
of the cluster sidebar, where they would otherwise be listed a second time
under `keda.sh`. Their definitions stay in the Definitions list, and the
host's own list and details stay reachable by URL and from the command
palette. A model the extension only
decorates, with a details panel or a menu item and no page of its own, stays
out of the field: registered, it would leave the tree with nothing in its
place.

### Types

The types in `src/renderer/api/types.ts` follow the KEDA controller's Go types,
read from its sources at the release that serves the version
(`apis/keda/v1alpha1/*_types.go` of kedacore/keda, v2.21.0 today), not from
memory:

- Every Go struct has a TypeScript interface of the same name, with the same
  fields under their `json` names.
- A field is optional when the CRD does not require it. `controller-gen`
  decides that from the `+required` and `+optional` markers, not from the
  `json` tag; the generated CRD settles any doubt.
- Every `+kubebuilder:validation:Enum` is a string-literal union type alias.
- `spec.triggers[].metadata` is an open record of strings: each of the 70+
  scalers has its own keys.
- `status.triggersTypes`, `status.authenticationsTypes` and
  `status.externalMetricNames` are typed `string | string[]`: KEDA 2.21 writes
  the types as one comma-separated string and the metric names as an array,
  and the shapes have changed between releases. The models' statics normalize
  them; nothing else reads them directly.
- A type of Kubernetes itself comes from `K8sApi`: `jobTargetRef` of a
  ScaledJob is the host's `JobSpec`, and the HPA behavior of a ScaledObject
  is `HorizontalPodAutoscalerSpec["behavior"]`.
- TriggerAuthentication and ClusterTriggerAuthentication share
  `TriggerAuthenticationSpec` and `TriggerAuthenticationStatus`, as their Go
  types do.
- A condition is `Renderer.K8sApi.BaseKubeObjectCondition`, aliased as
  `KedaCondition`. The whole of the host's kube-object package is re-exported
  from `K8sApi`; nothing is imported from another `@freelensapp/*` package,
  which are private in v2.

### Adding a kind or a version

1. **The types** in `types.ts`, as above. A new version of a kind starts as a
   copy of the newest version's files; the diff of the Go types between the two
   releases says what changes.
2. **The model**, `src/renderer/api/<kind>/<kind>-<version>.ts`, with the
   `declare kind` and `declare apiVersion` literals and its `KubeApi`.
3. **The list page** in `src/renderer/pages/`, passed through
   `createAvailableVersionPage` (newest version first when a kind has more than
   one) and registered in `clusterPages` and in `clusterPageMenus`, under the
   KEDA group (`parentId: "keda"`).
4. **The details panel** in `src/renderer/details/`, registered in
   `kubeObjectDetailItems` with `Renderer.K8sApi.detailsFor` and the model
   class, with only what the host does not show already ("Renderer
   Components").
5. **Menu items** in `src/renderer/menus/`, registered in `kubeObjectMenuItems`
   with `Renderer.K8sApi.menuItemFor` and the model class, only for what the
   resource supports: `PauseMenuItem` writes the `autoscaling.keda.sh/paused`
   annotation, which the KEDA controller reads for ScaledObject and ScaledJob,
   and `autoscaling.keda.sh/paused-replicas`, which it reads for a ScaledObject
   only, and removes both to resume. An action that changes the
   workload, such as Scale to Zero, asks first with
   `Renderer.Component.ConfirmDialog.open`, as the host does before deleting an
   object.
6. **`customResources`**: the model class of every version that has a page.
7. **Tests** for the static helpers, next to the model, and for a menu item,
   next to it; a member of the host that a test reaches goes into the stub, as
   small as the test needs.
8. **A test object** in `examples/keda/`, and its row in `README.md`. KEDA
   accepts one ScaledObject per workload, so each test object scales a workload
   of its own.
9. **The integration tests**: the kind's entry in `kindViews` of
   `integration/__tests__/keda.tests.ts`, its plural in `crdPlurals` of
   `extension-helpers.ts`, and a test object named `test` in
   `integration/fixtures/` ("Workflows").

Then check the result in Freelens with the checkout installed from its
directory ("Checking the Extension in Freelens Dev"): the page lists the test
object, the details show every field, the menu items work, and the resource is
gone from the Custom Resources tree.

## Renderer Components

- Pages and details panels are `observer` components from `mobx-react`, which
  the build maps to the host's copy.
- Every page, details panel and menu item renders inside an `ErrorBoundary`
  from `src/renderer/components/error-boundary.tsx`, a class component of the
  host's React. It logs what its children throw with `extension.name` and the
  component stack, and renders `ErrorPage` in place of a page or a details
  panel, and nothing in place of a menu item. A details panel or menu item
  renders again when the host passes a new `object`, the boundary's reset key.
  - The boundary is applied where the registrations are made: `clusterPages`,
    `kubeObjectDetailItems` and `kubeObjectMenuItems` are mapped through
    `withPageErrorBoundary`, `withDetailsErrorBoundary` and
    `withMenuItemErrorBoundary`, each taking `this` and a registration, so an
    entry added to a field is wrapped too. Each field is annotated with its type
    from `Renderer.LensExtension`, because the mapping refers to `this`, and
    its type would otherwise depend on itself.
  - The wrappers take the registration that `Renderer.K8sApi.detailsFor` and
    `menuItemFor` built, so the helpers check each component against its model
    first, with no cast.
  - A `try`/`catch` around the call of a component is not enough: a child
    throws when React renders it, and a callback such as `renderTableContents`
    of `KubeObjectListLayout` throws from the host's render. Such an error goes
    up to the host's boundary, which replaces the main area for a page and the
    whole cluster frame for a details panel or a menu item.
- The `kubeObjectDetailItems` and `kubeObjectMenuItems` registrations are made
  by `Renderer.K8sApi.detailsFor(ScaledObject, { priority: 10, Details })` and
  `Renderer.K8sApi.menuItemFor(ScaledObject, { MenuItem })`, not written out
  with `kind` and `apiVersions`. The helper takes both from the model class and
  types the props of `Details` and `MenuItem` from it, so a component written
  for another model fails the type check. The check is structural: it tells
  two kinds or versions apart by the `declare kind` and `declare apiVersion`
  literals of each model ("CRD KubeObject Pattern").
- The components are registered as they are, `Details: ScaledObjectDetails`
  and `MenuItem: PauseMenuItem`. Their props are
  `Renderer.Component.KubeObjectDetailsProps<Model>` and
  `Common.Types.KubeObjectMenuItemProps<Model>`: the concrete model class, never
  `any`, and only what the host passes. A menu item does not extend
  `Renderer.Component.KubeObjectMenuProps`, the props of the host's whole
  `KubeObjectMenu`. A component may take the union of the models it serves:
  `TriggerAuthenticationDetails` serves both authentication kinds, and
  `PauseMenuItem` serves ScaledObject and ScaledJob, picking the store to patch
  by the `kind` of the object, a literal on each model. It renders the items
  that apply to the object's kind and state, in a fragment: Pause Autoscaling,
  and Scale to Zero for a ScaledObject, while it is not paused, Resume
  Autoscaling while it is.
- A details panel shows only what the host does not. For any custom resource
  the host renders `CustomResourceDetails` in the same drawer, with every
  printer column of the CRD and the conditions, reasons and messages
  included, and its Events section at the end. A field of a printer column
  comes back in a panel only as more than its value, such as the scale target
  as a link to the workload.
- The list pages are configurable, as the host's own lists: every column has
  an `id`, `isConfigurable` turns on the column menu of the table, which hides
  and shows columns, and the host keeps the choice per `tableId`.
  `defaultHiddenTableColumns` hides the columns that another one sums up
  (Ready, Active and Fallback, which Status sums up) or that `kubectl get`
  shows with `-o wide` only, so that a list fits a narrow window.
- `clusterPageMenus` has one KEDA group, with the KEDA icon, which opens the
  Scaled Objects page, and one entry per kind under it, by `parentId`.
- The panels of ScaledObject and ScaledJob share `Triggers`, the list of their
  scalers, each a badge with its type and its name over a table of its fields,
  and list the object's core Events, the scaling decisions and errors
  the controller records, with `ScalingEvents`
  (`src/renderer/details/scaling-events.tsx`). It reads
  `Renderer.K8sApi.eventStore.getEventsByObject(object)`, which matches the
  events by the object's uid; the host loads and watches that store for the
  Events section it adds at the end of every drawer. When an event was last
  seen comes from `getEventLastSeen` in `src/renderer/api/events.ts`, as
  `kubectl get events` reads it: KEDA 2.21 records events through the
  events.k8s.io/v1 API, which writes `eventTime` and `series` and leaves
  `lastTimestamp` empty, and older releases through core/v1.
- A link to another object is `Renderer.Component.LinkToObject`, with an
  `objectRef` of its kind, name and apiVersion and the object of the panel,
  whose namespace it takes: the host finds the API of the kind, one of its own
  or one it registered for a CRD, and links to the details of the object.
  Nothing loads another store for a link. The ScaledObject panel links its
  scale target (`getScaleTargetRef`, with the group and version the controller
  resolves into `status.scaleTargetGVKR`) and its HPA (`getHpaRef`, from
  `status.hpaName`), and `Triggers` links the authentication of each trigger
  (`getAuthenticationObjectRef`). A ClusterTriggerAuthentication names
  Secrets in the namespace of the operator, which the object does not say, and
  is used by objects in any namespace, so its panel shows those names as text.
- `Renderer.Component.ConfirmDialog` lays its content out as flex items, so its
  `message` is one element, `<p>...</p>` ("Rules That Fail Silently").
- The host renders a cluster page with `params` only. A page that needs the
  extension gets it from the registration
  (`Page: () => <ScaledObjectsPageAvailable extension={this} />`), with the
  page component created once, outside the registration. `PageComponents.Page`
  is typed with the props the host passes, so the type check rejects a page
  that requires another prop; it does not reject one that declares another
  prop as optional, which is then `undefined`.
- **CSS**: a component imports its CSS module for the class names only, with no
  `?inline` import and no `<style>` tag; the rules reach the page through
  `dist/renderer.css`, which the host links next to the renderer entry ("CSS"
  under "Build"). CSS modules use `camelCaseOnly` class names; SCSS variables
  are in `src/renderer/vars.scss`, used with `@use "../vars"`.
- SCSS modules get TypeScript declarations (`*.module.d.scss.ts`), written by
  `build/vite-plugin-css-module-declarations.mjs` during the renderer build,
  without a key for a class inside `:global(...)`. They are committed, because
  `pnpm type:check` and `type-check.yaml` run without a build, and
  `allowArbitraryExtensions` in the renderer's `tsconfig.json` makes the import
  resolve to them, so a class name the stylesheet lacks fails the check. Commit
  the regenerated file with a change to its SCSS module; `pnpm clean:dts`
  removes them.
- Icons are SVG files imported with `?raw` and rendered by
  `Renderer.Component.Icon` through its `svg` prop, on the 24x24 grid of the
  other sidebar icons with a margin of 2: the KEDA icon is the heptagon and the
  lightning bolt of the KEDA logo, whose lettering does not survive 20 pixels.
  An icon is made of filled shapes only ("Rules That Fail Silently").

## Rules That Fail Silently

Each of these compiles when it is broken, and breaks the extension at runtime
or not visibly at all.

- **The host's React and mobx, one copy each.** Import `react`, `react-dom`,
  `mobx` and `mobx-react` by their bare module ids;
  `build/vite-plugin-host-modules.mjs` maps them onto
  `globalThis.FreelensExtensionApi`. A second React throws
  `invalid hook call`; a second mobx throws nothing, and the host never reacts
  to its observables. The build fails on the ways a second copy gets in
  ("Modules provided by the host").
- **Standard decorators.** The code has none today. One that is added is a
  standard decorator: an observable field is `@observable accessor`, and the
  class does not call `makeObservable(this)`. Without `accessor` the
  production build of mobx leaves the field unobservable ("Decorators").
- **No Node or Electron in renderer and common code.** They are `undefined` in
  the renderer. The build fails on an import, `pnpm type:check` on a global
  such as `process` or `Buffer` ("Process-specific settings").
- **One CSS asset, `dist/renderer.css`.** Any other name, or a second asset,
  leaves the extension unstyled. Nothing checks it; look at `dist/` after a
  change to the CSS setup ("CSS").
- **One tsconfig per environment.** Each program has only its runtime's `lib`
  and `types`, and no declaration may load Node into the renderer or the DOM
  into main; otherwise a wrong API type-checks and is `undefined` at runtime.
  The environment tests fail on a leak ("TypeScript").
- **No instance method on a KubeObject subclass.** The objects from the host do
  not have it, and the call throws. Nothing checks it ("CRD KubeObject
  Pattern").
- **Nothing built when a module loads.** A `KubeApi` or a store built at the
  top of a module throws in the root frame, which loads the renderer entry
  too, and the host logs "can't load renderer" for the extension. The stores
  come from `getStore()` of the model, called while rendering ("CRD
  KubeObject Pattern").
- **A component that chooses what to render through `getStore()` is an
  `observer`.** Otherwise a page opened before the cluster frame has loaded
  the CRDs shows the kind as not installed until the user navigates away and
  back. Only a test whose `getStore` reads an observable shows it ("CRD
  KubeObject Pattern").
- **Function components, or `this.props` only in `render()`.** Under
  mobx-react 10, the props of an `@observer` class component are not
  observable, and a `@computed` getter or a `KubeObjectListLayout` callback
  that reads them throws
  `[mobx-react] Cannot read "X.props" in a reactive context` when the page
  renders, and the host shows its "App crash" page. The pages and panels here
  are function components; keep it that way, or read the props in `render()`
  and hand them to the callbacks.
- **A memo over a store's items is keyed on something that changes with
  them.** The host keeps one observable array per store and updates it in
  place, so `store.items` stays the same array while the objects change. An
  `observer` that reads the items while it renders follows them; a `useMemo`
  keyed on the array is computed once. A list built from them for display is
  a sorted copy (`toSorted`), never the store's array sorted in place.
- **A merge patch removes an annotation with `null`.** The host's patch type
  admits `string | undefined` only, and `undefined` drops the key from the
  JSON, so the annotation stays. The menu items cast the annotations once, in
  one place; keep the cast there.
- **A `ConfirmDialog` message is one element.** The dialog lays out its icon
  and its message as flex items, so text beside an inline element such as
  `<b>` becomes flex items of its own, which lose the spaces at their edges.
  Wrap the message in a `<p>`; the menu item test checks it.
- **An icon of filled shapes.** The host fills every element of an inline SVG
  icon with `currentColor` (`.Icon.svg svg * { fill: currentColor }`), which
  overrides `fill="none"`: an outline drawn with a stroke renders as a solid
  shape, and the black and white of a mask both turn into the icon's color:
  the icon of 2.0.0 rendered as a solid heptagon. An outline is a ring of two paths with
  `fill-rule="evenodd"`; `keda.test.ts` rejects a stroke, `fill="none"` and
  a mask.
- **No drawer item three levels deep.** Each level of `DrawerItem` gives its
  name a column and its value what is left of the width, so at the third level
  the value is a few pixels wide and its text wraps letter by letter, which the
  triggers did until 2.0.1. Fields inside an item are rows of a table, as in
  `Triggers`, the parameters of the authentication kinds and `ScalingEvents`;
  `triggers.test.tsx` checks the table.
- **Every page, details panel and menu item inside an error boundary**
  ("Renderer Components").
- **A cluster page gets the extension from its registration.** The host passes
  `params` only ("Renderer Components").
- **An ESM `main`, and the entries in `package.json` unchanged while
  `pnpm dev` runs.** The host refuses to reload a CommonJS main and logs why,
  and it watches only the entries it started with, so a manifest change needs
  Freelens restarted.
- **The testing helpers of React stay out of the extension's code.** `act`,
  `react-dom/test-utils` and `@testing-library/*` work in the unit tests, which
  run the development build of React, and throw in the host, which runs the
  production build. Biome's `noRestrictedImports` rejects them outside the
  tests.

Neither `pnpm build` nor `pnpm dev` runs the type check, so a Node global in
renderer code passes them; `pnpm type:check` and `type-check.yaml` catch it.

## Build

`vite.config.mjs` builds one entry point per run, in library mode, as ESM:
`vite build` builds the renderer and empties `dist/`, and `vite build --mode
main` builds main next to it. The two runs share no chunk; each bundle carries
its own copy of the `src/common/` code it imports. Nothing is minified.

`pnpm dev` runs the same two builds in watch mode, side by side, for a
directory install: the host reloads the extension when either entry is
rewritten. Its renderer run passes `--no-emptyOutDir`, because in watch mode
Vite empties the output directory again before every rebuild, which would
delete `dist/main.js`.

### Modules provided by the host

The host publishes its singletons on `globalThis.FreelensExtensionApi`, and
each process publishes only the ones it has (contract C3 of the Freelens
extension API, `docs/extensions/api.md` in freelensapp/freelens):

| Module id           | Global            | Published in |
| ------------------- | ----------------- | ------------ |
| `react`             | `React`           | renderer     |
| `react-dom`         | `ReactDom`        | renderer     |
| `react/jsx-runtime` | `ReactJsxRuntime` | renderer     |
| `mobx`              | `Mobx`            | both         |
| `mobx-react`        | `MobxReact`       | renderer     |
| `monaco-editor`     | `MonacoEditor`    | renderer     |

`build/vite-plugin-host-modules.mjs` replaces a bare import of one of these
with a module that reads the global, in the extension's code and in every
library it bundles. Its named exports are the members of the copy installed as
a devDependency, which is pinned to the host's version, so an import of a name
the host's version lacks fails the build. The plugin also fails the build on an
import of a host module that the process does not publish (`react` in main),
and on a subpath of a host package that the host does not publish
(`react-dom/client`).

Everything else is bundled. That includes `@freelensapp/extensions`, a shim of
three lines that reads `Common`, `Main` and `Renderer` off the same global; it
must not be mapped.

### Process-specific settings

- **Renderer**: nothing is external. An import of a Node builtin or of
  `electron` fails the build (Vite would otherwise replace it with an empty
  module and only warn). `process.env.NODE_ENV` is replaced at build time,
  because library mode leaves it for a consumer's bundler and the page has no
  `process`.
- **Main**: Node builtins (`node:*` and bare) and `electron` stay external.
  Bundled packages resolve with Vite's server conditions, so main gets their
  Node builds. Main is built for Rolldown's `node` platform, so that a bundled
  CommonJS package can `require()` the builtins, and `__dirname` and
  `__filename` are defined as `import.meta.dirname` and `import.meta.filename`.
  The main entry here bundles nothing of the kind, so it is the same on both
  platforms; the settings stay for whatever is added.

### Decorators

MobX 7 supports standard decorators only, and Oxc, which transpiles TypeScript
for Vite, passes them through unlowered, while neither Node nor Chromium runs
them yet. `build/vite-plugin-standard-decorators.mjs`, copied from Freelens,
hands every module with a decorator to esbuild first, which lowers the
decorators and their `accessor` fields. Both `vite.config.mjs` and
`vitest.config.ts` use it. The code has no decorator today; the plugin stays
so that one that is added works.

### CSS

The host links the stylesheet named after the renderer entry, `renderer.css`
next to `renderer.js`. Library mode extracts the CSS of the whole bundle into
that one file (`build.lib.cssFileName`). A build that emits more than one CSS
asset, or a differently named one, leaves the extension unstyled. A component
imports its CSS module for the class names only and renders no `<style>` tag.

### CSS module declarations

`build/vite-plugin-css-module-declarations.mjs` writes `x.module.d.scss.ts`
next to every `x.module.scss` the renderer build imports, in `vite build` and
in watch mode. It takes the class names from Vite's own `preprocessCSS`, with
the build's resolved config, so they are the names the bundle exports, after
`localsConvention`; a class inside `:global(...)` is not one of them. It
writes a declaration only when the content changed, through a temporary file
renamed over the declaration, so a failed or interrupted build cannot leave a
committed declaration truncated.

## TypeScript

Main code runs in Node, renderer code in a browser page, and common code in
both. Each is type-checked in a program of its own, so that an API the runtime
does not have fails `pnpm type:check` rather than the extension:

| Config                       | lib                       | types                 | Files                                                              |
| ---------------------------- | ------------------------- | --------------------- | ------------------------------------------------------------------ |
| `src/main/tsconfig.json`     | ES2024                    | `node`                | `src/main/`, `src/common/`                                         |
| `src/renderer/tsconfig.json` | ES2024, DOM, DOM.Iterable | `vite/client`         | `src/renderer/`, `src/common/`                                     |
| `src/common/tsconfig.json`   | ES2024, WebWorker         | none                  | `src/common/`                                                      |
| `src/tsconfig.json`          | ES2024, DOM, DOM.Iterable | `node`, `vite/client` | `*.test.ts(x)` under `src/`, and `test/`                           |
| `tsconfig.json`              | ES2024                    | `node`                | `vite.config.mjs`, `vitest.config.ts`, `svgo.config.mjs`, `build/` |

All of them extend `tsconfig.base.json`: `strict`, `moduleResolution: Bundler`,
`useDefineForClassFields`, `noUncheckedSideEffectImports` and `skipLibCheck`
among them. `skipLibCheck` is required: `extension-api.d.ts` is one declaration
for both processes and names DOM types and the `Electron` namespace, which no
single program has. Write `types` in every config; it decides which `@types`
packages a program sees.

The main and renderer configs both include `src/common/`. Compiled as main,
common code fails on the DOM; compiled as renderer, it fails on Node. What
passes both is valid in both. `src/common/` is empty today; its
`tsconfig.json` stays, because the editor uses it and the environment tests
extend it, and `tsc -p environment-tests` always has its probes to compile.

The split does not cover the API namespaces: `Main` and `Renderer` compile in
every program, and the one the process does not have is `undefined` at runtime.

The renderer program has `vite/client`, which declares the `*?raw` imports and
the CSS modules and brings no Node into the program. With
`allowArbitraryExtensions`, `import styles from "./x.module.scss"` resolves to
the generated `x.module.d.scss.ts` ("Renderer Components").

### Environment tests

`types` and `lib` alone do not keep an environment pure: a declaration file
with `/// <reference types="node" />` loads all of `@types/node` into any
program that reaches it. `environment-tests/` proves the split holds:

| File             | Compiled with          | Must                      |
| ---------------- | ---------------------- | ------------------------- |
| `node-apis.ts`   | renderer, common       | fail on every marked line |
| `dom-apis.ts`    | main, common           | fail on every marked line |
| `worker-apis.ts` | main                   | fail on every marked line |
| `shared-apis.ts` | main, renderer, common | pass                      |

Each line that must fail carries `// @ts-expect-error`, so a program that
starts accepting it fails with an unused directive. The configs there extend
the source configs and keep their `include`, so the probes are compiled
together with the sources and every declaration the sources reach. When a
declaration leaks, keep the leak out rather than relax a probe.

## Tests

Vitest (`vitest.config.ts`) runs the `*.test.ts(x)` files under `src/` in
Node, with jsdom for a file that starts with `// @vitest-environment jsdom`.
Its plugins are the ones of the build that the tests need: the standard
decorators and the React plugin for JSX. `src/tsconfig.json` type-checks the
tests with the DOM and Node; it sits in `src/` so that an editor finds it for a
test file, which the environment config next to the test excludes.

`@freelensapp/extensions` is aliased to `test/freelens-extensions.ts`: the
real package is a shim that reads `Common`, `Main` and `Renderer` off
`globalThis.FreelensExtensionApi`, which only the host sets, so it throws in a
test. The stub covers only what the tests use, at runtime; the type check uses
the real declaration. So a test that reaches a member the stub lacks compiles
and fails on `undefined`: add the member to the stub, as small as the test
needs (`ConfirmDialog.open` is a `vi.fn()`, for example, and a test runs the
`ok` callback it receives). Its `LensExtensionKubeObject.getStore()` throws, as
the host's does for a version that is not served; a test that needs a store
spies on `getStore` of its class. The other host modules are not stubbed:
`react`, `mobx` and `mobx-react` resolve to the devDependencies, the host's
versions.

Tests import what they use from `vitest`
(`import { describe, expect, it, vi } from "vitest"`); no tsconfig declares
the globals. `globals: true` stays on at runtime only, because React Testing
Library registers its automatic cleanup only when `afterEach` is a global.

The integration tests are apart: `vitest.integration.config.ts` runs the
`*.tests.ts` files in `integration/__tests__/` against Freelens dev, and
`integration/tsconfig.json` type-checks them ("Workflows").

## Lint and CI

### Biome

`biome.jsonc` has the formatter, import groups and rules of Freelens. Two
overrides are specific to how the extension is laid out:

- `style/noRestrictedImports` keeps `vitest` and the testing helpers of React
  out of the extension's code (see "Tests").
- `correctness/noNodejsModules` rejects a Node builtin import in
  `src/renderer/` and `src/common/`, tests left out. It flags the import in the
  editor, before `pnpm type:check` does; it does not see Node globals such as
  `Buffer` or `process`, which only the type check catches.

Every path in an override starts with `**/`. Trunk runs Biome on a copy of the
files in a sandbox outside the repository, and there a path anchored at the
repository root matches no file, so the override silently does nothing. A
plain `biome check` matches both forms, so only `trunk check` shows the
difference.

The Biome commands in `.trunk/trunk.yaml` let Biome find the copy of
`biome.jsonc` in the sandbox rather than pass `--config-path`. Biome 2.6.4
ignores every parser option when the config is given explicitly, with
`--config-path` or `BIOME_CONFIG_PATH`.

In that sandbox, Biome also cannot apply `vcs.useIgnoreFile`: since 2.5.15 it
matches every target against the repository's `.gitignore` and panics on a
path outside the repository root, so every file fails. The Biome commands in
`.trunk/trunk.yaml` pass `--vcs-use-ignore-file=false`, because Trunk applies
`.gitignore` itself before it picks the targets; `biome.jsonc` keeps the
setting on for `pnpm biome` and editors.

Renovate updates Biome, in the `biome` script and in `.trunk/trunk.yaml`, but
cannot run `biome migrate`. `biome-migrate.yaml` runs it on the Renovate
branch, then `biome format --write` with the migrated config, and commits the
migrated `biome.jsonc` and the reformatted files there, so that the update, its
migration and the formatting the new version changes are one pull request.
`--update` stages only tracked files, which are all the formatter touches. The
commit is by `github-actions[bot]`, which
`gitIgnoredAuthors` in `.renovaterc.json` lists, so that Renovate does not take
it for a manual edit and stop updating the branch.

Biome formats SCSS, YAML, Markdown and the SVG icon too, as in Freelens, so
Trunk runs no Prettier or markdownlint; yamllint still checks YAML. The
Kubernetes manifests in `examples/` and `integration/fixtures/` are the
exception: their sequences stay unindented, as kubectl writes them, which Biome
cannot do, so yamlfmt formats them with the `.yamlfmt.yaml` of each directory,
and the ignore rules of `.trunk/trunk.yaml` give them to yamlfmt only.
`biome.jsonc` leaves them out, together with `pnpm-lock.yaml` and
`pnpm-workspace.yaml`, which pnpm writes, and `.trunk/`, whose `trunk.yaml`
`trunk upgrade` rewrites.

The Markdown rules are in `nursery`.

### Knip

`pnpm knip:check` runs knip twice, for unused files and for dependencies: a
development pass over everything, and a `--production --strict` pass over the
code that reaches the bundles, which are the entries marked with `!` in
`knip.jsonc`. In the production pass only `dependencies` count, so a bundled
library that the extension's code imports belongs there. The host-provided
modules are devDependencies, for their types, and are ignored.

A file is unused when no entry reaches it: a leftover module, a barrel that
nothing imports. The production pass starts from the `!` entries only, so it
also reports a module that only tests import. The fix is to remove the file,
not to ignore it. The check does not include unused exports and types: on this
tree they are mostly the exported spec and status types of the models.

`knip.jsonc` lists the entries knip cannot find: the two source entries, the
Vitest alias target `test/freelens-extensions.ts`, the integration tests and
the probes in `environment-tests/`. Its Vite plugin is off: it adds the
renderer entry of `vite.config.mjs` as a development entry, which displaces
`src/renderer/index.tsx!`, and the production pass then skips the renderer.
`--no-config-hints` is set because one config serves both passes, and an entry
that only the production pass needs is reported as redundant by the other.
`kubectl`, which the integration tests call, comes from the system, or from
helm/kind-action in CI, and `yq` from mise, so both are in `ignoreBinaries`.

Two more settings keep the file check to real findings. `project` leaves out
the CSS module declarations with `!src/**/*.d.scss.ts`: TypeScript reaches them
through `allowArbitraryExtensions`, while knip resolves
`import styles from "./x.module.scss"` to the stylesheet, so nothing would
import them. The negation has no trailing `!`, which would apply it to the
production pass only. And the SVGO plugin is on (`"svgo": true`), so that
`svgo.config.mjs` is an entry: Trunk runs SVGO, and no dependency turns the
plugin on.

`ignore` leaves out `dist/**`. The `main` field of `package.json` makes
`dist/main.js` an entry once it exists, and the `knip` script runs with
`--no-gitignore`, so after `pnpm build`, which `check.yaml` runs first, knip
would analyse the bundle and report what it inlines from the libraries it
bundles. Run `pnpm knip:check` after a build when changing `knip.jsonc`, as
`check.yaml` does; without `dist/` the problem does not show.

### Workflows

| Workflow                                       | Runs                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `type-check.yaml`                              | `pnpm type:check`                                                                                                                     |
| `check.yaml`                                   | `pnpm build`, `pnpm lint:check`, `pnpm knip:check`                                                                                    |
| `unit-tests.yaml`                              | `pnpm test:unit`                                                                                                                      |
| `trunk-check.yaml`                             | `trunk check --all`                                                                                                                   |
| `integration-tests.yaml`                       | the integration tests in `integration/`, against Freelens dev                                                                         |
| `mise-lock-check.yaml`                         | on a change to `mise.lock`: no checksum changed for an unchanged tool version                                                         |
| `cleanup-cache.yaml`                           | on a closed pull request: deletes the caches of its merge ref                                                                         |
| `biome-migrate.yaml`                           | `biome migrate` on a Renovate branch                                                                                                  |
| `npm-dedupe.yaml`, `trunk-upgrade.yaml`        | scheduled maintenance, each in an `automated/*` pull request; `/rerun` by a collaborator reruns one                                   |
| `npm-version.yaml`, `tag.yaml`, `release.yaml` | the version bump pull request, the tag when it merges (or `/tag` by a collaborator), the npm publish and GitHub release of a `v*` tag |
| `claude.yaml`, `claude-task.yaml`              | Claude Code on `@claude` and on dispatch ("GitHub Actions (Claude Code Action) Rules")                                                |

The workflows are those of freelensapp/freelens-example-extension, byte for
byte; a change to one of them starts there.

The type check has a workflow of its own, on pull requests and on pushes to
`main`, as in Freelens. It runs every program, tests, tooling and environment
tests included, which no build reaches, and a type error shows as its own
failed check rather than as a failed build. `check.yaml` builds without the
type check for the same reason, so it does not run twice.

The integration tests follow the pattern of the template. They run under their
own Vitest (`vitest.integration.config.ts`, `pnpm test:integration`), against
Freelens started with `pnpm dev` from a freelensapp/freelens checkout. They
attach to it with Playwright's `chromium.connectOverCDP` on the port that
script opens (see "Checking the Extension in Freelens Dev"), so they need no
package of Freelens and no file of its checkout; Freelens dev is the only
dependency, and it is not in `package.json`. `playwright` is a devDependency at
the version of Freelens's catalog. The workflow builds the extension, checks
out Freelens at each release tag of its matrix (`v2.0.0`), starts `pnpm dev`
there in the background under `xvfb-run`, with its output in a file and a
fresh profile in `FREELENS_INTEGRATION_TESTING_DIR`, waits until the CDP
endpoint answers, and runs `pnpm test:integration` here. The job
`integration tests` waits for every job of the matrix and fails when one of
them did not succeed; the branch rules require it rather than the jobs of the
matrix, whose names change with the matrix. A profile of Freelens dev syncs no
kubeconfig by default, so the workflow seeds the fresh one with a single sync
entry, a file with the kind cluster alone, and the catalog lists that cluster
and nothing else. Every test file is a session of its own on the one app, and
fails on any error logged by either process:

- `extensions.tests.ts` uninstalls whatever installation of the extension the
  app has and installs this checkout in place from the Extensions page. The
  extension has no preferences to open. It needs no cluster.
- `keda.tests.ts` opens the kind cluster with the CRDs of the four kinds and a
  test object of each, and clicks through the extension's views: each list
  page shows a row for its object; its details show the extension's panel, in
  `keda.sh/v1alpha1`, with no error page of the error boundary; and each row
  menu lists the extension's items that apply to an object that is not paused,
  Pause Autoscaling and Scale to Zero for the ScaledObject, Pause Autoscaling
  for the ScaledJob, none for the two authentication kinds. Then it writes:
  Scale to Zero, once its confirmation is accepted, sets
  `autoscaling.keda.sh/paused-replicas` to `0` on the ScaledObject, and Pause
  Autoscaling sets `autoscaling.keda.sh/paused` to `true` on the ScaledJob,
  both read back with kubectl. Last, the trigger of the ScaledObject shows its
  fields in a table and links to the details of its TriggerAuthentication.
  Each view opens its page itself;
  the two writes come after the menu checks, which expect the objects not
  paused. They do not check the columns, every field, Resume Autoscaling or the
  Custom Resources tree. They keep an in-place installation of this checkout
  that is enabled, and install it otherwise.

The tests are deterministic, so nothing retries them: the config sets no
`retry`, and the workflow runs the step once, under `timeout 600`. A retry
repeats the same failure, and every view of a session waits its full timeout
before it fails. The one exception is the cluster frame, which `openKindCluster`
loads a second time when it did not render and the dev file route of Freelens
failed a request meanwhile (see below); that failure is of Freelens dev, not of
a test.

The sessions reach the app through its renderer only; the main process, and
with it the application menu, is out of reach of CDP. They navigate the root
frame with `Renderer.Navigation.navigate` of the extension API, find the kind
cluster with `Renderer.Catalog.catalogEntities` by its name, `kind-<name>`,
and connect it by navigating to `/cluster/<id>` and disconnect it with the
entity's `disconnect()`. The pages of the extension are nested under the KEDA
group of the sidebar, which renders collapsed, so the cluster frame is
navigated with `Renderer.Navigation.navigate` too. `browser.close()` of a
browser connected over CDP closes only the connection, so a session ends with
it and the app keeps running. The renderer's console carries the errors of the
root frame and of every cluster frame; the main log is read from the file that
`FREELENS_MAIN_LOG` names, from its size when the session started, and every
line that starts with `error:` counts, also after a task prefix that turbo may
add, such as `freelens:dev:`, except
`proxy_server.go:… Error while proxying request: context canceled`, which the
Kubernetes proxy of Freelens logs for a request that the renderer aborts.
Freelens dev renders in `React.StrictMode`, which mounts every view twice and
aborts the requests of the first mount, so the line comes and goes with the
timing of a run; it names no request and says nothing about the extension.
Without the variable only the renderer is checked. A renderer error carries its
location, line and column included, and the worker that logged it. Its text is
the preview of its arguments, which is empty for some objects and only the
class name for others, such as `ErrorEvent`; such an error is described from
its arguments, read from the page, and an empty one without arguments, which
the browser itself logs, gets its time, to find it in the main log. An uncaught
value that is not an `Error` reaches the session as a page error with an empty
stack, and is described by its name and message, with its time.

The dev file route of Freelens dev, which serves the renderer's modules from
the Vite dev server, logs a request that fails as a warning
(`[DEV-FILE-ROUTE]: request for … failed`): its keep-alive agent at times
reuses a socket that the dev server is closing, and the request fails with
`ECONNRESET`. The route answers such a request with a 502, and Chromium logs
`Failed to load resource: the server responded with a status of 502`; that
error is left out when the main log has the failed request for its URL. When
the module belongs to Monaco's editor worker, which a YAML view starts, the
worker does not load, and Monaco rethrows its `error` event, an `Event` with
no name, which is left out when the main log has a failed request. When the
module belongs to the cluster frame, such as one of Freelens's own
stylesheets, the frame does not render its sidebar, and `openKindCluster`,
after its timeout, loads the frame again once, only if the main log has a
failed request since the cluster was opened.

The workflow sets `TURBO_LOG_ORDER=stream` for `pnpm dev`: in GitHub Actions
turbo otherwise groups the output of a task until it ends, and the persistent
`dev` task never ends, so the log would stay empty.

The cluster session applies the CRDs of one KEDA release, `TEST_KEDA_VERSION`
or `v2.21.0`, the release the types follow ("Types"), from the sources of the
release (`config/crd/bases/` of kedacore/keda at its tag). It applies them
server-side, because the CRDs of ScaledObject and ScaledJob are larger than the
annotation of a client-side apply, and runs no controller: the views read the
API, and the test objects need no reconciliation, so they have no status.
Vitest runs the files one at a time (`fileParallelism: false`), in no set
order, and none depends on another having run: the session disconnects the
kind cluster, removes the leftovers of an earlier run (the namespace
`integration-tests` and the CRDs), applies the CRDs, waits until they are
established, creates the namespace `integration-tests`, applies
`integration/fixtures/cluster-objects.yaml` and, in that namespace,
`integration/fixtures/objects.yaml`, and only then connects the cluster. The
session then selects `integration-tests` in the namespace filter of the
extension's Scaled Objects page, which its `KubeObjectListLayout` renders for a
namespaced resource, unless the filter already shows it: a new cluster shows
only `default`, and the app keeps the selection for every namespaced list of
the cluster. Without it the namespaced pages list nothing, and their views fail
on their timeout. The session opens no page of the host, whose requests can log
errors of their own: the Pods page asks for pod metrics, and kind has no
metrics server. The session's teardown stops collecting the errors first, then
disconnects the cluster, so that the app logs no watch error for a CRD deleted
under it, then deletes the namespace and the CRDs with `--wait`, also when a
test failed, and then checks the errors. The app refreshes the cluster's
permissions while it disconnects it, and when the refresh loses the race, its
requests fail on its own proxy (`[AUTHORIZATION-REVIEW]`,
`[AUTHORIZATION-NAMESPACE-REVIEW]`, `[FREELENS-PROXY]` with
`Cluster <id> is not connected` or `The client is destroyed`); those errors
come and go with the timing of a run and say nothing about the extension, and
the session no longer collects them.

The code the sessions share is in `integration/__tests__/extension-helpers.ts`:
connecting to the app with the error collector, installing the extension,
connecting and disconnecting the kind cluster, kubectl, and the selectors of
the list pages, the details drawer, the row menus and the confirmation dialog.
Its name does not match `*.tests.ts`, so Vitest does not collect it.
`integration/tsconfig.json` compiles the directory with Node and the DOM,
because the callbacks of `page.evaluate` run in the page, and with the types
of `@freelensapp/extensions`, which declare `globalThis.FreelensExtensionApi`
for them.

Four variables configure the sessions. `FREELENS_CDP_URL` is the CDP endpoint
(`http://127.0.0.1:9223` by default), `FREELENS_MAIN_LOG` the main log,
`TEST_KIND_CLUSTER_NAME` names the kind cluster (`kind` by default, `freelens`
in the workflow), and `TEST_KEDA_VERSION` the KEDA release of the CRDs. Every
kubectl call names its context, `kind-<name>`, so a run never acts on the
current context. The checkout to install, and the fixtures, are found from the
location of the helpers. Outside CI a session skips with a warning when
Freelens dev does not answer or the cluster is not reachable; in CI (`CI` set)
the run fails instead, so that a mistake in the workflow does not turn into a
silent skip.

Run locally, the tests act on the profile of Freelens dev, `FreelensDev`,
which is apart from that of an installed Freelens: they navigate its window,
leave this checkout installed in place, uninstalling another installation of
the extension, and leave the kind cluster disconnected, with the namespace
filter set to `integration-tests`. They touch no other cluster of the
catalog. The profile lists the kind cluster only once its kubeconfig is in
"Kubeconfig Syncs" (see "Checking the Extension in Freelens Dev"); without it
the cluster session fails on the timeout of finding the cluster. A run deletes
the CRDs of the four kinds, and with them every KEDA object on the cluster:
run it only against a kind cluster with nothing worth keeping.

The workflows that act on a comment (`/tag`, `/rerun`) require the comment's
author to be OWNER, MEMBER or COLLABORATOR; `claude.yaml` goes further and
checks write access through the API, because MEMBER and COLLABORATOR do not
imply it. They commit and push with the `GH_TOKEN` secret, and `release.yaml`
publishes with `NPM_TOKEN` or, without it, with npm provenance over OIDC.

## Checking the Extension in Freelens Dev

The functional checks of a change run against Freelens started with
`pnpm dev` from a freelensapp/freelens checkout. That script starts Electron
with `--remoteDebuggingPort 9223`, so an agent can drive the app over the
Chrome DevTools Protocol. How to attach Playwright MCP to it is in Freelens's
`DEVELOPMENT.md`, "Inspecting the running dev app from an AI agent"; start
Freelens before the session connects. Playwright MCP writes its snapshots to
`.playwright-mcp/`, which is git-ignored. Added to a Claude Code session that
is already running, the server is listed as connected, but its tools appear
only in a new session.

Without the MCP server, or until that new session, a script with
`chromium.connectOverCDP("http://127.0.0.1:9223")` of `playwright`, a
devDependency, does the same, as the integration tests do. `browser.close()`
of such a browser closes only the connection; the app belongs to Freelens and
keeps running.

A profile of Freelens dev syncs no kubeconfig until one is added in
"Kubeconfig Syncs" of the Kubernetes preferences, so its catalog lists none of
the developer's clusters; `KUBECONFIG` does not change that. For the checks,
add a kubeconfig with the test cluster alone, such as the output of
`kubectl config view --minify --flatten --context kind-kind`. A fresh profile,
in a `FREELENS_INTEGRATION_TESTING_DIR` under the system's temporary
directory, can start with it already in place: the integration tests seed
`FreelensDev/lens-user-store.json` there with
`preferences.syncKubeconfigEntries`, whose `filePath` is absolute ("Kubeconfig
syncs of the dev profile" in Freelens's `DEVELOPMENT.md`).

### Installing the checkout

1. `pnpm install`, then `pnpm build`. After a branch switch, `node_modules`
   can still hold another stack, and Freelens loads the extension from
   `dist/`.
2. On the Extensions page, enter the checkout's directory and press
   "Install". Freelens then asks whether to load the extension in place;
   confirm that too. The table lists the extension as enabled, with
   "development" in the version column and `Loaded from <directory>` in its
   title.
3. A rebuild, by `pnpm build` or by `pnpm dev` of the extension, reloads it
   once in the root frame and once in each cluster frame.

### Driving the UI

- Every cluster renders in a cross-origin `<clusterId>.renderer.freelens.app`
  iframe. Pages, menus and details of the extension live in that frame, not
  in the main page.
- Pages of the extension have URLs like `/extension/<name>/<pageId>`, with the
  package name's `@` dropped and `/` turned into `--`, for example
  `/extension/freelensapp--keda-extension/scaled-objects`. The sidebar entries
  navigate in `onClick`; their `href` is not the page URL. A click on an
  entry's `[data-testid="sidebar-item-…"]` element does not navigate; a DOM
  `click()` on the link inside it, `[data-testid="link-for-sidebar-item-…"]`,
  does. Neither does `history.pushState` in the cluster frame.
- The root frame navigates with `Renderer.Navigation.navigate(url)` of the
  extension API, run in its page: `/extensions`, `/catalog`,
  `/preferences/extension/<name>`, `/cluster/<id>`. The application menu
  belongs to the main process, which CDP does not reach.
- Playwright's actionability checks can fail on the hotbar, where
  `#ScrollSpyRoot` intercepts pointer events; a DOM `click()` on the element
  works.
- Views fill in once the host's stores have loaded. Wait for the expected
  content, not a fixed time, before deciding that a page is empty.

### Reading the console

The renderer console also carries the output of Freelens's terminal dock
(`%cMESSAGE` lines), which can include the user's shell prompt, account names
and paths. Keep only warnings, errors, page errors and the extension's own
lines, and never paste the full console into a PR, an issue or a report.
React reports key problems as console errors ("Each child in a list should
have a unique key", "Encountered two children with the same key"); they count
as failures of the "no error in DevTools" check.

The renderer's requests to Kubernetes go through Chromium, which logs every
response that is not a success as a console error,
`Failed to load resource: the server responded with a status of N`, also one
that the code that sent it handles. The text names no URL; the location of the
message does, and the error collector of the integration tests appends it. An
extension whose tests expect such a response on purpose, a 404 or a 409, leaves
out that one error by its status and URL, not every "Failed to load resource".

The main process logs to the terminal running Freelens, and to a file. On
macOS it is `~/Library/Logs/Freelens/lens.log`, with the renderer's
`lens-renderer-*.log` next to it; when the terminal is not at hand, it shows
the extension's activation, its reloads and its own lines. Filter it as the
console.

## Code Style

- **Biome** formats **TypeScript/TSX, JS, JSON, CSS, SCSS, HTML, YAML, Markdown**: double quotes, semicolons, trailing commas, 2-space indent, 120 char line width — use `pnpm biome:fix`
- **Trunk** formats **TOML and shell scripts**, and runs the linters for formats not covered by Biome (yamllint, actionlint, shellcheck) — use `pnpm trunk:fix`
- Import order (enforced by biome organizeImports): built-in modules → `@freelensapp/**` → packages → relative paths
- React 19; JSX compiles to `react/jsx-runtime` imports, which the build maps to the host's React
- **No emoji** in Markdown files (`.md`), comments, or any source code

## Security

Never read, display, reference, or include the contents of the following files in any response or context, even if they are open in the editor:

- `.env`
- `.env.*`
- `.envrc`
- `.npmrc`
- `*.jks`
- `*.keystore`
- `*.p12`
- `*.pfx`
- `*.pem`
- `*.key`

The same list is git-ignored in `.gitignore` and enforced for Claude Code by
the `permissions.deny` rules in `.claude/settings.json`, which block reading
and editing these files. Change all three together. The rules are native
permissions rather than a hook on purpose: a hook runs a process in the
working tree, which may be an untrusted pull request, and an interpreter such
as `python3 -c` imports modules from that tree before the hook's own code.

## Electron Multi-Process

Extensions run in the same multi-process model as the Freelens host:

- **Main process** (`src/main/`) — Node.js environment, extension lifecycle
- **Renderer process** (`src/renderer/`) — Chromium browser, UI components

Code in `src/common/` would be shared between both processes.

## Troubleshooting

### Changes Not Appearing

1. Check that files are not in ignored output directories (`dist/`, `node_modules/`)
2. Full clean and rebuild: `pnpm clean:all && pnpm install && pnpm build`
3. With a directory install and `pnpm dev` running, look for a refused reload in the Freelens log, and restart
   Freelens after a change to `main` or `renderer` in `package.json`; reinstall an extension installed from a tarball

### Build Failures

1. Check for TypeScript errors: `pnpm type:check`
2. Check for linting errors: `pnpm lint:check`
3. Verify dependencies: `pnpm install`
4. Check Node.js version matches the `engines` field in `package.json`

### Runtime Errors

1. Open Freelens DevTools and check the Console tab for renderer errors
2. Check the terminal where Freelens was launched for main process errors
3. Look for stack traces with file:line numbers
4. Verify all CRD objects have proper `static readonly` properties (kind, apiBase, crd)
5. Validate both with `pnpm type:check` **and** `pnpm build` — runtime failures can appear only in bundled `dist/` code

## Best Practices

1. **Use semantic search** to find examples and patterns in the codebase
2. **Follow existing patterns** — grep for similar implementations before creating new ones
3. **Test changes** before committing
4. **Run validation before committing:** `pnpm lint:fix && pnpm type:check && pnpm test:unit`
5. **For TypeScript/TSX, JS, JSON, CSS, SCSS, HTML, YAML and Markdown files:** run `pnpm biome:fix` (or `biome check` directly if `biome` is installed locally)
6. **For other formats:** run `pnpm trunk:fix` (or `trunk check` directly if `trunk` is installed locally)
7. **Full build** when in doubt about cached state: `pnpm clean:all && pnpm install && pnpm build`

## GitHub Actions (Claude Code Action) Rules

This project has a Claude Code workflow (`.github/workflows/claude.yaml`) triggered
via `@claude` comments on issues, PR comments, and reviews. When operating via that
workflow, follow these rules:

### Code Review

When reviewing code and proposing fixes:

1. **Show the diff first** — present every proposed change as a unified diff
   block using the `diff` language tag:

   ```diff
   --- a/path/to/file.ts
   +++ b/path/to/file.ts
   @@ -10,7 +10,7 @@
    const oldLine = "before";
   -const changedLine = "after";
   +const changedLine = "the fix";
    const unchangedLine = "same";
   ```

   You can generate this from the terminal with:

   ```bash
   git diff -u -- path/to/file
   ```

   If the change spans multiple files, group them under a single commit
   subject and show each file's diff sequentially.

2. **Propose a commit subject first** — before any code change, output a
   single line with the proposed commit subject:

   ```text
   **Proposed commit:** <short description>
   ```

   Do **not** use Conventional Commits prefixes (e.g. `fix:`, `feat:`,
   `chore:`, `refactor:`, `docs:`, `test:`, `ci:`). This project prefers
   plain, descriptive commit messages and PR titles without any prefix.

   Wait for the user to confirm (or adjust) the subject before applying the
   change.

3. **Comment style:**
   - Keep review comments concise and actionable
   - Reference specific lines (file + line number) when pointing out issues
   - Offer a concrete fix suggestion rather than just flagging a problem
   - Do **not** use emoji in any Markdown, comments, commit messages, or
     PR descriptions. The only exception is emoji that already appears
     inside code strings (e.g. application logs, user-facing messages).
   - Use GitHub's `suggestion` block for small targeted fixes so the PR
     author can accept the change with a single click:

     ```suggestion
     <same unified-diff format as shown above>
     ```

   - For larger multi-file changes, use `diff -u` blocks in a regular
     comment instead, with the proposed commit subject shown first

### Making Changes to a PR

When asked to implement a change on a PR:

1. Propose the commit subject (as above)
2. Describe what will change and why
3. After confirmation, apply the changes with commits on the PR branch
4. **One commit per fix** — when a review surfaces more than one issue or
   the plan includes more than one fix, apply and commit each fix
   separately. Do not batch multiple independent fixes into a single
   commit. This keeps the history bisectable and makes each change easy
   to revert individually.

### Force-Pushing a Rewritten Branch

When you are asked to rebase a pull request branch, or to rewrite its
history in another way (amend, squash, drop a commit), push the result with:

```bash
git push --force-with-lease origin HEAD
```

The push wrapper the action names in its instructions, `git-push.sh`, accepts
no flags, so it cannot do this; `git` itself is allowed in this workflow.
Do not fall back to merging `main` into the branch instead: a merge commit is
not what was asked for.

Force-push only the pull request branch the run was invoked on, and only when
the request calls for a rewrite. Never force-push `main` or any other branch,
and never rewrite a history you were not asked to.

### Modifying GitHub Actions Workflows

Claude cannot push changes to files under `.github/workflows/` directly,
because the GitHub token used by the action lacks the `workflows` permission.
Any patch to a workflow file MUST therefore be delivered as a new, complete
file under the `github-workflow-fix/` directory in the repository root instead
of editing the file in place:

1. Write the full, final contents of the workflow to
   `github-workflow-fix/<workflow-file-name>`, with the same file name as in
   `.github/workflows/` (e.g. `github-workflow-fix/check.yaml`). Do **not**
   edit the original file under `.github/workflows/`.
2. Make it a **complete** file — the entire workflow as it should look after
   the change, not just a diff or fragment — so it can be copied verbatim.
3. Commit it with the change that needs it, and list it in the report. In the
   PR description, note it as a proposed workflow change that a maintainer
   must move from `github-workflow-fix/` to `.github/workflows/`.

A maintainer moves the file into `.github/workflows/` in a separate commit and
removes `github-workflow-fix/`. Pull before continuing on the branch, as it may
have gained such a commit.

### Branch Naming Conventions

When creating a branch from an issue, use a human-readable name that includes
the issue number and a short slug derived from the issue title:

```text
claude/issue-<number>-<short-slug>
```

- `<number>` is the GitHub issue number
- `<short-slug>` is a kebab-case summary of the issue title, kept short
  (3–6 words maximum, omit articles and filler words)

Do **not** use auto-generated timestamp suffixes (e.g.
`claude/issue-1957-20260612-2108`) — these are not human-readable and make
branch lists hard to scan.

### Fork PRs: Review Only

A PR from a fork (different owner than `freelensapp`) gets a review and
nothing else: no commits, no pushes, no branches. Its code is untrusted, and
the head of a fork PR can change between the moment a maintainer looks at it
and the moment the workflow checks it out, so nothing taken from the checkout
may reach `freelensapp/freelens-keda-extension`.

When a fork PR needs changes, a maintainer first copies the exact commit they
reviewed to a branch in this repository. From then on it is a
same-repository PR, which gets the full setup and the normal workflow. The
copy is made either locally (`gh pr checkout <N>`, then push the branch) or
by the Claude Task workflow, following "Copying a Fork PR" below.

### Copying a Fork PR

This applies to a Claude Task run whose prompt asks to copy a fork PR and
names the PR number and the full commit SHA to copy. It is a git-only task:
do not check out, read, build or run any of the PR's files, and do not
describe its changes, because they are untrusted input.

1. `git fetch origin refs/pull/<N>/head`.
2. Verify that `FETCH_HEAD` equals the given SHA. If it does not, or no full
   SHA was given, stop and report the actual head without pushing anything.
3. `git push origin <sha>:refs/heads/claude/pr-<N>`.
4. Open a PR from `claude/pr-<N>` to `main`. It MUST use the **exact same
   title** as the original PR, copied verbatim with no prefix, and its body
   is `Copy of #<N> at <sha>.` followed by the usual footer.
5. Comment on the original PR with a link to the new one.
