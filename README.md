# freelens-keda-extension

A Freelens extension for [KEDA](https://keda.sh/) (Kubernetes Event-driven Autoscaling):
browse ScaledObjects with the columns of `kubectl get so`, inspect every trigger in the
details panel, watch the object's scaling events, and pause or resume autoscaling from the
object menu.

Built for the Freelens **extension API v2** (Freelens 2.x, `engines.freelens: ^2.0.0`), with
the build, type-check, test and lint layout of the reference template
[`freelensapp/freelens-example-extension`](https://github.com/freelensapp/freelens-example-extension)
(Vite 8, ES module bundles in `dist/`).

Repository: <https://github.com/nidiodolfini/freelens-keda-extension> ·
npm package: [`freelens-keda-extension`](https://www.npmjs.com/package/freelens-keda-extension) ·
Proposed in [freelensapp/freelens discussion #2840](https://github.com/freelensapp/freelens/discussions/2840).

## What the extension does

A **Scaled Objects** page (`so`), under its own sidebar entry:

- Columns from `kubectl get so`: Name, Namespace, Scale Target, Min, Max, Triggers, Status,
  Ready, Active, Fallback and Age.
- Status sums up the object's conditions as a colored badge (`success` / `error` /
  `warning` / `info`) with the controller's reason (`ScaledObjectReady`,
  `ScaledObjectCheckFailed`, `Paused`, `Fallback`, `Active`, ...).
- When the CRD is not installed in the cluster, the page shows a friendly
  "Not Available" message.

Each ScaledObject also gets a details panel in the drawer:

- Scale target (`kind/name` + apiVersion), min/max replicas, polling interval, cooldown
  period, idle replica count, initial cooldown period, `advanced` options and fallback.
- **Triggers**: one section per scaler, with its type as a badge, its name, its metadata
  as key/value sub-items and its authentication ref.
- **Scaling Events**: the events the cluster records for the object (KEDA writes one per
  scaling decision), read from the host's core event store and shown as a table — Type,
  Reason, Message, Count and Last Seen — newest first, up to 20. The section is omitted
  when the event store is unavailable and shows "No events" when the object has none.
- Conditions with their messages as tooltips, external metric names, original replica
  count, last active time and the pause state.

While the extension is enabled, ScaledObjects are left out of the Custom Resources tree of
the cluster sidebar, so they are listed once, under "Scaled Objects".

**Pause / Scale to Zero / Resume Autoscaling**: the ScaledObject menu writes the pause
annotations the controller reads, the same as `kubectl annotate so <name> ...`:

- **Pause Autoscaling** sets `autoscaling.keda.sh/paused=true`, which freezes the target at
  its current replica count (KEDA 2.12 or newer).
- **Scale to Zero** sets `autoscaling.keda.sh/paused-replicas=0`, which scales the target
  down to zero replicas and keeps it there. It asks for confirmation first.
- **Resume Autoscaling** removes both annotations (a `null` in the merge patch) so the
  controller scales normally again. It is the only item shown while the object is paused.

## Requirements

- Freelens 2.0 or newer (extension API v2). Freelens 1.x needs a 1.x release of the
  extension, such as 1.0.3.
- A cluster with KEDA installed (`keda.sh/v1alpha1`, KEDA 2.x).

## Installation

Open Freelens and go to Extensions (`ctrl`+`shift`+`E` or `cmd`+`shift`+`E`). The field at
the top takes a package name, the URL of a tarball, or the path to a tarball or a directory.

### From the registry

Enter `freelens-keda-extension` and press Install. Freelens resolves the package from the
npm registry, exactly like the official extensions. Enable it, and the "Scaled Objects"
sidebar entry appears on every cluster.

### From a release tarball

Each [release](https://github.com/nidiodolfini/freelens-keda-extension/releases) has the
extension as `freelens-keda-extension-<version>.tgz`. Use a release whose major version
matches your Freelens version. Enter the URL of the `.tgz` asset and press Install, or
download it and enter its path.

### From a directory

Build the extension (see below), then enter the path to your checkout, the directory with
`package.json`, and press Install. Freelens runs the extension from that directory, from the
files in `dist/`, and lists it as unverified. This is how you work on the extension: see
[Development loop](#development-loop).

## Usage

1. Apply the example objects to a cluster with KEDA installed:

   ```powershell
   kubectl apply -f examples/keda/scaledobject-cron.yaml
   kubectl apply -f examples/keda/scaledobject-cpu.yaml
   ```

   Both scale the Deployment `example-app`: the cron ScaledObject wakes one replica
   between 00:30 and 00:45 (America/Sao_Paulo) and scales back to zero, and the CPU
   ScaledObject keeps between 1 and 5 replicas following CPU utilization at 50%.

2. Open the cluster in Freelens. The page lists `example-app-cron` and `example-app-cpu`; each
   details panel shows its triggers, and the "Scaling Events" section fills in as the
   controller reconciles.

3. Open the menu of a ScaledObject and click **Pause Autoscaling** (keeps the current
   replicas) or **Scale to Zero** (confirms, then scales to zero); the Status column
   switches to `Paused` once the controller applies the annotation, and
   **Resume Autoscaling** restores normal scaling.

## Development

Node.js 24 (`.nvmrc`, `mise.toml`) and pnpm 12 through corepack (`packageManager` in
`package.json`) are required.

```powershell
pnpm install
pnpm type:check     # main, renderer, tests, tooling and environment tests, one program each
pnpm test:unit      # vitest
pnpm build          # vite build (renderer) and vite build --mode main -> dist/
pnpm dev            # both builds in watch mode, for a directory install
pnpm biome:fix      # formatting/lint (TypeScript, TSX, JSON, CSS, SCSS, HTML, YAML, Markdown)
pnpm biome:check
pnpm knip:check     # unused files and dependencies (downloads knip via pnpm dlx)
pnpm trunk:check    # TOML, shell, workflows, yamllint, and Biome again
pnpm pack:dev       # bump prerelease + build + .tgz to install in Freelens
pnpm clean          # remove dist/
```

Neither `pnpm build` nor `pnpm dev` type-checks; run `pnpm type:check` for that.

### Development loop

Install the extension from your checkout once, as described in
[From a directory](#from-a-directory), then run:

```powershell
pnpm dev
```

It rebuilds the extension whenever a source file changes, and Freelens reloads the
extension after each rebuild, without a restart and without packing. Stop it with
`ctrl`+`C`. A change to `main` or `renderer` in `package.json` needs Freelens restarted once.

## Project structure

```text
vite.config.mjs                                  # Vite config: renderer (vite build) and main (--mode main)
build/vite-plugin-host-modules.mjs               # plugin: react/mobx/... -> globalThis.FreelensExtensionApi
build/vite-plugin-standard-decorators.mjs        # plugin: lowers standard decorators with esbuild
build/vite-plugin-css-module-declarations.mjs    # plugin: writes the *.module.d.scss.ts declarations
tsconfig.base.json                               # compiler options shared by every program
environment-tests/                               # probes that keep Node out of the renderer and the DOM out of main
src/
  main/index.ts                                  # main entry (stateless)
  renderer/index.tsx                             # registrations: page, details, menu, customResources
  renderer/api/types.ts                          # KEDA spec/status types
  renderer/api/scaledobject/scaledobject-v1.ts   # ScaledObject model (+ Api, test)
  renderer/pages/                                # Scaled Objects page + CSS module
  renderer/details/                              # ScaledObject details panel (incl. Scaling Events)
  renderer/menus/                                # Pause/Scale to Zero/Resume Autoscaling (ScaledObject)
  renderer/icons/                                # KEDA logo (currentColor)
  renderer/components/                           # createAvailableVersionPage, error boundaries
  common/                                        # code both entries would share (none today; its tsconfig stays)
test/freelens-extensions.ts                      # runtime stub of @freelensapp/extensions for Vitest
examples/keda/                                   # test objects (kubectl apply -f)
AGENTS.md                                        # guide for coding agents
```

Build output goes to `dist/main.js`, `dist/renderer.js` and `dist/renderer.css`, with source
maps; `package.json` points `main`/`renderer` at the two entries, and Freelens links the
stylesheet next to the renderer entry.

## Supported API versions

The extension supports **`keda.sh/v1alpha1` only**, the version KEDA 2.x serves (one version
per kind, with the "Not Available" page when the CRD is missing). To add another version
later, follow the same per-version model/page/details pattern and list both versions in
`createAvailableVersionPage`, newest first.

## Publishing a release

```powershell
pnpm bump-version patch        # or minor/major/prerelease
pnpm build
pnpm publish                   # requires npmjs.com authentication (NODE_AUTH_TOKEN)
```

The `.github/workflows/release.yaml` workflow also publishes automatically when a `v*` tag
is pushed (it needs the npm registry `NPM_TOKEN` secret in the GitHub repository, or npm
Trusted Publishing / provenance).

## License

MIT. The sidebar icon is the official KEDA logo (Kubernetes-style heptagon with the KEDA
lettering, Apache-2.0), recolored with `currentColor` and with the white knockout converted
to an SVG mask so it follows the Freelens theme.
