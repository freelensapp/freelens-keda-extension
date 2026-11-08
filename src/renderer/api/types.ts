import { Renderer } from "@freelensapp/extensions";

// The types of the KEDA controller, keda.sh/v1alpha1, from the Go types of
// kedacore/keda v2.21.0 (apis/keda/v1alpha1): one interface per struct, with
// the fields under their json names, optional where the CRD does not require
// them, and a string-literal union per kubebuilder enum.

/**
 * The CRD metadata of a KEDA resource, with the human-readable title the
 * extension shows in its pages.
 */
export interface KedaKubeObjectCRD extends Renderer.K8sApi.LensExtensionKubeObjectCRD {
  title: string;
}

/**
 * A status condition, as KEDA writes it into `status.conditions`: the
 * `BaseKubeObjectCondition` of the host's kube objects, which `K8sApi`
 * re-exports.
 */
export type KedaCondition = Renderer.K8sApi.BaseKubeObjectCondition;

/**
 * `ConditionType`: the conditions the controller writes.
 */
export type ConditionType = "Ready" | "Active" | "Fallback" | "Paused" | "HPAActive";

/**
 * `autoscalingv2.MetricTargetType`.
 */
export type MetricTargetType = "Utilization" | "Value" | "AverageValue";

// scaletriggers_types.go

export interface AuthenticationRef {
  name: string;
  /** `TriggerAuthentication`, the controller's default, when omitted. */
  kind?: "TriggerAuthentication" | "ClusterTriggerAuthentication";
}

/**
 * `spec.triggers[]`: one scaler. `metadata` is an open record of strings:
 * each of the 70+ scalers has its own keys.
 */
export interface ScaleTriggers {
  type: string;
  name?: string;
  useCachedMetrics?: boolean;
  metadata: Record<string, string>;
  authenticationRef?: AuthenticationRef;
  metricType?: MetricTargetType;
}

export interface TriggerActivityStatus {
  isActive?: boolean;
}

// gvkr_types.go

export interface GroupVersionKindResource {
  group: string;
  version: string;
  kind: string;
  resource: string;
}

// scaledobject_types.go

export type HealthStatusType = "Happy" | "Failing";

export interface HealthStatus {
  numberOfFailures?: number;
  status?: HealthStatusType;
}

export type FallbackBehavior =
  | "static"
  | "currentReplicas"
  | "currentReplicasIfHigher"
  | "currentReplicasIfLower"
  | "scalingModifiers";

export interface Fallback {
  failureThreshold: number;
  replicas: number;
  /** `static` when omitted. */
  behavior?: FallbackBehavior;
}

export interface ScalingModifiers {
  formula?: string;
  target?: string;
  activationTarget?: string;
  metricType?: "AverageValue" | "Value";
}

export interface HorizontalPodAutoscalerConfig {
  behavior?: Renderer.K8sApi.HorizontalPodAutoscalerSpec["behavior"];
  name?: string;
}

export interface AdvancedConfig {
  horizontalPodAutoscalerConfig?: HorizontalPodAutoscalerConfig;
  restoreToOriginalReplicaCount?: boolean;
  scalingModifiers?: ScalingModifiers;
}

/**
 * `spec.scaleTargetRef`: the workload the controller scales, a Deployment
 * when `kind` is omitted.
 */
export interface ScaleTarget {
  name: string;
  apiVersion?: string;
  kind?: string;
  envSourceContainerName?: string;
}

export interface ScaledObjectSpec {
  scaleTargetRef: ScaleTarget;
  pollingInterval?: number;
  initialCooldownPeriod?: number;
  cooldownPeriod?: number;
  idleReplicaCount?: number;
  minReplicaCount?: number;
  maxReplicaCount?: number;
  advanced?: AdvancedConfig;
  triggers: ScaleTriggers[];
  fallback?: Fallback;
}

export interface ScaledObjectStatus {
  /** The resolved kind of the scale target, as a GVK string: `apps/v1.Deployment`. */
  scaleTargetKind?: string;
  scaleTargetGVKR?: GroupVersionKindResource;
  originalReplicaCount?: number;
  lastActiveTime?: string;
  // KEDA versions differ on the JSON shape of these lists: a comma-separated
  // string ("cpu,memory") or an array. The models' statics normalize them;
  // nothing else reads them directly.
  externalMetricNames?: string | string[];
  resourceMetricNames?: string[];
  compositeScalerName?: string;
  conditions?: KedaCondition[];
  /** Per external metric name, the failures the fallback counts. */
  health?: Record<string, HealthStatus>;
  triggersActivity?: Record<string, TriggerActivityStatus>;
  pausedReplicaCount?: number;
  /** The name of the HPA the controller created for the object. */
  hpaName?: string;
  triggersTypes?: string | string[];
  authenticationsTypes?: string | string[];
}

// scaledjob_types.go

export type RolloutStrategy = "gradual" | "immediate";

export interface Rollout {
  strategy?: RolloutStrategy;
  propagationPolicy?: "foreground" | "background";
}

export interface ScalingStrategy {
  strategy?: "default" | "custom" | "accurate" | "eager";
  customScalingQueueLengthDeduction?: number;
  customScalingRunningJobPercentage?: string;
  pendingPodConditions?: string[];
  multipleScalersCalculation?: "min" | "avg" | "sum" | "max";
}

export interface ScaledJobSpec {
  /** The spec of the Jobs the controller creates. */
  jobTargetRef: Renderer.K8sApi.JobSpec;
  pollingInterval?: number;
  successfulJobsHistoryLimit?: number;
  failedJobsHistoryLimit?: number;
  /** Deprecated in favor of `rollout.strategy`. */
  rolloutStrategy?: RolloutStrategy;
  rollout?: Rollout;
  envSourceContainerName?: string;
  minReplicaCount?: number;
  maxReplicaCount?: number;
  scalingStrategy?: ScalingStrategy;
  triggers: ScaleTriggers[];
}

export interface ScaledJobStatus {
  lastActiveTime?: string;
  conditions?: KedaCondition[];
  /** The json name is capitalized in the Go type. */
  Paused?: string;
  triggersTypes?: string | string[];
  authenticationsTypes?: string | string[];
  externalMetricNames?: string | string[];
  triggersActivity?: Record<string, TriggerActivityStatus>;
}

// triggerauthentication_types.go, the spec and status of both
// TriggerAuthentication and ClusterTriggerAuthentication

export type PodIdentityProvider = "none" | "azure-workload" | "gcp" | "aws-eks" | "aws";

export interface AuthPodIdentity {
  provider: PodIdentityProvider;
  identityId?: string;
  identityTenantId?: string;
  identityAuthorityHost?: string;
  roleArn?: string;
  externalID?: string;
  identityOwner?: "keda" | "workload";
}

export interface AuthTargetRef {
  parameter: string;
  name: string;
  key: string;
}

export type AuthSecretTargetRef = AuthTargetRef;

export type AuthConfigMapTargetRef = AuthTargetRef;

export interface AuthEnvironment {
  parameter: string;
  name: string;
  containerName?: string;
}

export type VaultAuthentication = "token" | "kubernetes";

export interface Credential {
  token?: string;
  serviceAccount?: string;
  serviceAccountName?: string;
}

/** The empty string is the generic type. */
export type VaultSecretType = "" | "secretV2" | "secret" | "pki";

export interface VaultPkiData {
  commonName?: string;
  altNames?: string;
  ipSans?: string;
  uriSans?: string;
  otherSans?: string;
  ttl?: string;
  format?: string;
}

export interface VaultSecret {
  parameter: string;
  path: string;
  key: string;
  type?: VaultSecretType;
  pkiData?: VaultPkiData;
}

export interface HashiCorpVault {
  address: string;
  authentication: VaultAuthentication;
  secrets: VaultSecret[];
  namespace?: string;
  credential?: Credential;
  role?: string;
  mount?: string;
}

export interface SecretKeyRef {
  name: string;
  key: string;
}

export interface ValueFromSecret {
  secretKeyRef: SecretKeyRef;
}

export interface AzureKeyVaultClientSecret {
  valueFrom: ValueFromSecret;
}

export interface AzureKeyVaultCredentials {
  clientId: string;
  tenantId: string;
  clientSecret: AzureKeyVaultClientSecret;
}

export interface AzureKeyVaultSecret {
  parameter: string;
  name: string;
  version?: string;
}

export interface AzureKeyVaultCloudInfo {
  type: string;
  keyVaultResourceURL?: string;
  activeDirectoryEndpoint?: string;
}

export interface AzureKeyVault {
  vaultUri: string;
  secrets: AzureKeyVaultSecret[];
  credentials?: AzureKeyVaultCredentials;
  podIdentity?: AuthPodIdentity;
  cloud?: AzureKeyVaultCloudInfo;
}

export interface GCPSecretmanagerClientSecret {
  valueFrom: ValueFromSecret;
}

export interface GCPCredentials {
  clientSecret: GCPSecretmanagerClientSecret;
}

export interface GCPSecretManagerSecret {
  parameter: string;
  id: string;
  version?: string;
}

export interface GCPSecretManager {
  secrets: GCPSecretManagerSecret[];
  credentials?: GCPCredentials;
  podIdentity?: AuthPodIdentity;
}

export interface AwsSecretManagerValue {
  valueFrom: ValueFromSecret;
}

export interface AwsSecretManagerCredentials {
  accessKey: AwsSecretManagerValue;
  accessSecretKey: AwsSecretManagerValue;
  accessToken?: AwsSecretManagerValue;
}

export interface AwsSecretManagerSecret {
  parameter: string;
  name: string;
  versionId?: string;
  versionStage?: string;
  secretKey?: string;
}

export interface AwsSecretManager {
  secrets: AwsSecretManagerSecret[];
  credentials?: AwsSecretManagerCredentials;
  podIdentity?: AuthPodIdentity;
  region?: string;
}

export interface BoundServiceAccountToken {
  parameter: string;
  serviceAccountName: string;
}

export type OAuth2GrantType = "clientCredentials";

export interface OAuth2ClientSecret {
  valueFrom: ValueFromSecret;
}

export interface OAuth2 {
  type: OAuth2GrantType;
  clientId: string;
  clientSecret?: OAuth2ClientSecret;
  tokenUrl: string;
  scopes?: string[];
  tokenUrlParams?: Record<string, string>;
}

export interface AzureServicePrincipalCredential {
  valueFrom: ValueFromSecret;
}

export interface AzureServicePrincipal {
  tenantId: string;
  clientId: string;
  cloud?: string;
  activeDirectoryEndpoint?: string;
  clientSecret?: AzureServicePrincipalCredential;
  clientCertificate?: AzureServicePrincipalCredential;
  clientCertificatePassword?: AzureServicePrincipalCredential;
}

export interface TriggerAuthenticationSpec {
  podIdentity?: AuthPodIdentity;
  secretTargetRef?: AuthSecretTargetRef[];
  configMapTargetRef?: AuthConfigMapTargetRef[];
  env?: AuthEnvironment[];
  filePath?: string;
  hashiCorpVault?: HashiCorpVault;
  azureKeyVault?: AzureKeyVault;
  gcpSecretManager?: GCPSecretManager;
  awsSecretManager?: AwsSecretManager;
  boundServiceAccountToken?: BoundServiceAccountToken[];
  oauth2?: OAuth2;
  azureServicePrincipal?: AzureServicePrincipal;
}

/**
 * The objects that use the authentication, by name, comma-separated. The
 * names carry no namespace: for a ClusterTriggerAuthentication, they may be
 * in any namespace.
 */
export interface TriggerAuthenticationStatus {
  scaledobjects?: string;
  scaledjobs?: string;
}
