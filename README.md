# freelens-keda-extension

A Freelens extension for [KEDA](https://keda.sh/) (Kubernetes Event-driven Autoscaling):
browse ScaledObjects, ScaledJobs, TriggerAuthentications and ClusterTriggerAuthentications
with the columns of `kubectl get`, inspect every trigger and every authentication parameter
in the details panels, watch the scaling events, and pause or resume autoscaling from the
object menu.

Built for the Freelens **extension API v2** (Freelens 2.x, `engines.freelens: ^2.0.0`), with
the build, type-check, test and lint layout of the reference template
[`freelensapp/freelens-example-extension`](https://github.com/freelensapp/freelens-example-extension)
(Vite 8, ES module bundles in `dist/`).

Repository: <https://github.com/nidiodolfini/freelens-keda-extension> ·
npm package: [`freelens-keda-extension`](https://www.npmjs.com/package/freelens-keda-extension) ·
Proposed in [freelensapp/freelens discussion #2840](https://github.com/freelensapp/freelens/discussions/2840).

## What the extension does

Four cluster pages, one per KEDA resource, grouped under a **KEDA** sidebar entry:

- **Scaled Objects** (`so`) — Name, Namespace, Scale Target, Min, Max, Triggers, Status,
  Ready, Active, Fallback and Age, from the columns of `kubectl get so`. The scale target
  reads `kind/name`, such as `Deployment/example-app`, before and after the controller has
  resolved it.
- **Scaled Jobs** (`sj`) — Name, Namespace, Min, Max, Triggers, Status, Ready, Active and Age,
  from `kubectl get sj`.
- **Trigger Authentications** (`ta`) — Name, Namespace, Pod Identity, Secret, Env, Vault
  Address, the Scaled Objects and Scaled Jobs that use it, and Age, from
  `kubectl get ta -o wide`.
- **Cluster Trigger Authentications** (`cta`) — the same without Namespace, with the File
  Path, from `kubectl get cta -o wide`.

Every list has a column menu, which hides and shows columns and keeps the choice per list.
So that a list fits a narrow window, some columns start hidden: Ready, Active and Fallback,
which Status sums up, and the objects that use an authentication, which `kubectl get` shows
with `-o wide` only.

Status sums up the conditions of a ScaledObject or a ScaledJob as a colored badge
(`success` / `error` / `warning` / `info`) with the controller's reason
(`ScaledObjectReady`, `ScaledObjectCheckFailed`, `Paused`, `Fallback`, `Active`, ...).
When a CRD is not installed in the cluster, its page shows a friendly "Not Available"
message.

Each resource also gets a details panel in the drawer, next to what the host shows for any
custom resource (the printer columns of its CRD, its conditions and its events):

- **ScaledObject**: links to the workload it scales and to the HorizontalPodAutoscaler the
  controller created for it, polling interval, cooldown period, idle replica count, initial
  cooldown period, the `advanced` options (restore to original, scaling modifiers), the
  fallback and the health of each metric it counts, external metric names, original replica
  count and last active time.
- **ScaledJob**: the containers and the limits of the Jobs it creates, polling interval, the
  history limits, the rollout and scaling strategies, external metric names and last active
  time.
- **Triggers**, for both: one section per scaler, with its type as a badge, its name, its
  metric type, its metadata as key/value sub-items and a link to its TriggerAuthentication or
  ClusterTriggerAuthentication.
- **Scaling Events**, for both: the events the cluster records for the object (KEDA writes one
  per scaling decision), read from the host's event store and shown as a table — Type,
  Reason, Message, Count and Last Seen — newest first, up to 20. Last Seen and Count read
  both event APIs: the `lastTimestamp` and `count` of KEDA 2.20 and older, and the
  `eventTime` and `series` of the `events.k8s.io/v1` API that KEDA 2.21 records through.
- **TriggerAuthentication** and **ClusterTriggerAuthentication**: every parameter the scalers
  get, with where its value comes from (Secret, ConfigMap, Env, HashiCorp Vault, Azure Key
  Vault, GCP Secret Manager, AWS Secrets Manager or a service account token), the settings of
  pod identity, Vault, the cloud secret managers, OAuth2 and Azure service principals, and,
  for a TriggerAuthentication, links to the Secrets, ConfigMaps and service accounts it names
  and to the ScaledObjects and ScaledJobs that use it.

While the extension is enabled, the four kinds are left out of the Custom Resources tree of
the cluster sidebar, so each of them is listed once, under "KEDA".

**Pause / Scale to Zero / Resume Autoscaling**: the ScaledObject and ScaledJob menus write
the pause annotations the controller reads, the same as `kubectl annotate so <name> ...`:

- **Pause Autoscaling** sets `autoscaling.keda.sh/paused=true`, which freezes a ScaledObject's
  target at its current replica count (KEDA 2.12 or newer) and stops a ScaledJob from
  creating Jobs.
- **Scale to Zero**, for a ScaledObject, sets `autoscaling.keda.sh/paused-replicas=0`, which
  scales the target down to zero replicas and keeps it there. It asks for confirmation
  first.
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
npm registry, exactly like the official extensions. Enable it, and the "KEDA" sidebar group
appears on every cluster.

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
   kubectl apply -f examples/keda/deployments.yaml
   kubectl apply -f examples/keda/triggerauthentication.yaml
   kubectl apply -f examples/keda/clustertriggerauthentication.yaml
   kubectl apply -f examples/keda/scaledobject-cpu.yaml
   kubectl apply -f examples/keda/scaledobject-cron.yaml
   kubectl apply -f examples/keda/scaledjob.yaml
   ```

   | File                                | Objects                                                                                                                                                      |
   | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | `deployments.yaml`                  | the Deployments `example-app` and `example-cron`, of the pause image; KEDA accepts one ScaledObject per workload, so each ScaledObject scales one of its own |
   | `triggerauthentication.yaml`        | the Secret `example-credentials` and the TriggerAuthentication `example-auth`, which passes its `token`                                                      |
   | `clustertriggerauthentication.yaml` | the ClusterTriggerAuthentication `example-cluster-auth`, which passes the variable `TZ` of the scale target's container                                      |
   | `scaledobject-cpu.yaml`             | `example-app-cpu`, which keeps `example-app` between 1 and 5 replicas following CPU utilization at 50% (the HPA reads the CPU from metrics-server)           |
   | `scaledobject-cron.yaml`            | `example-cron`, which wakes one replica of `example-cron` between 00:30 and 00:45 (America/Sao_Paulo), with `example-cluster-auth`                           |
   | `scaledjob.yaml`                    | `example-job`, which runs one Job at a time in the first ten minutes of every hour, with `example-auth`                                                      |

   The cron scaler takes no credentials: the authentication refs of the cron triggers are
   there for the links between the objects, and resolve without any outside system.

2. Open the cluster in Freelens. The KEDA pages list the objects; each details panel of a
   ScaledObject or a ScaledJob shows its triggers, and the "Scaling Events" section fills in
   as the controller reconciles. The details of `example-auth` link to its Secret and to
   `example-job`.

3. Open the menu of a ScaledObject and click **Pause Autoscaling** (keeps the current
   replicas) or **Scale to Zero** (confirms, then scales to zero); the Status column
   switches to `Paused` once the controller applies the annotation, and
   **Resume Autoscaling** restores normal scaling. A ScaledJob pauses and resumes the same
   way.

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
  renderer/index.tsx                             # registrations: 4 pages, KEDA group, details, menus, customResources
  renderer/api/types.ts                          # KEDA spec/status types, from the Go types of KEDA 2.21
  renderer/api/status-helpers.ts                 # conditions, status lists and pause annotation (ScaledObject, ScaledJob)
  renderer/api/trigger-authentication.ts         # logic and parameters of both authentication kinds
  renderer/api/events.ts                         # last seen time and order of the events, for both event APIs
  renderer/api/scaledobject/scaledobject-v1alpha1.ts   # ScaledObject model (+ Api, test)
  renderer/api/scaledjob/scaledjob-v1alpha1.ts         # ScaledJob model (+ Api, test)
  renderer/api/triggerauthentication/triggerauthentication-v1alpha1.ts               # TriggerAuthentication model (+ Api)
  renderer/api/clustertriggerauthentication/clustertriggerauthentication-v1alpha1.ts # ClusterTriggerAuthentication model (+ Api)
  renderer/pages/                                # 4 pages + CSS module
  renderer/details/                              # one panel per kind (one for both authentications), Triggers, Scaling Events
  renderer/menus/                                # Pause/Scale to Zero/Resume Autoscaling (ScaledObject, ScaledJob)
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

The extension supports **`keda.sh/v1alpha1` only**, the version KEDA 2.x serves for its four
kinds (one version per kind, with the "Not Available" page when a CRD is missing). To add another version
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

MIT. The sidebar icon is drawn from the KEDA logo (Apache-2.0), its Kubernetes-style heptagon
and the lightning bolt of its lettering, as filled shapes in `currentColor`, so it follows the
Freelens theme.
