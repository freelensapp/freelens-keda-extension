import { Common, Renderer } from "@freelensapp/extensions";
import { useState } from "react";
import { ScaledJob } from "../api/scaledjob/scaledjob-v1alpha1";
import { ScaledObject } from "../api/scaledobject/scaledobject-v1alpha1";

const {
  Component: { ConfirmDialog, Icon, Input, MenuItem },
} = Renderer;

export type PauseMenuItemProps = Common.Types.KubeObjectMenuItemProps<ScaledObject | ScaledJob>;

/**
 * The replicas of the scale target now, from the HPA the controller created
 * for the ScaledObject. Empty when the object has no HPA yet, or it cannot be
 * read: the dialog then starts empty, which keeps the replicas as they are.
 */
async function getCurrentReplicas(object: ScaledObject): Promise<string> {
  const name = object.status?.hpaName;

  if (!name) return "";

  try {
    const hpa = await Renderer.K8sApi.hpaApi.get({ name, namespace: object.getNs() });

    // The API leaves `currentReplicas` out of the status when it is 0.
    return hpa?.status ? String(hpa.status.currentReplicas ?? 0) : "";
  } catch {
    return "";
  }
}

interface PauseReplicasProps {
  target: string;
  replicas: string;
  onChange: (replicas: string) => void;
}

/**
 * The message of the dialog that pauses a ScaledObject: the question, and the
 * number of replicas to keep. The input takes digits only, so its value is
 * always empty or a whole number. One element, as the dialog lays its content
 * out as flex items.
 */
function PauseReplicas({ target, replicas, onChange }: PauseReplicasProps) {
  const [value, setValue] = useState(replicas);

  return (
    <div>
      <p>
        Pause the autoscaling of <b>{target}</b> and keep it at this number of replicas until autoscaling is resumed?
      </p>
      <Input
        autoFocus
        aria-label="Replicas"
        placeholder="Replicas (empty keeps the current ones)"
        value={value}
        onChange={(text) => {
          const digits = text.replace(/\D/g, "");

          setValue(digits);
          onChange(digits);
        }}
      />
    </div>
  );
}

/**
 * Pauses or resumes the autoscaling of a ScaledObject or a ScaledJob through
 * the annotations the controller reads:
 *
 * - "Pause Autoscaling" asks first, as the host does before deleting an
 *   object. For a ScaledObject it asks for the replicas to keep, with the
 *   current ones filled in, and writes `autoscaling.keda.sh/paused-replicas`,
 *   which scales the target to that number and keeps it there; 0 scales it to
 *   zero. Left empty, it writes `autoscaling.keda.sh/paused: "true"`, which
 *   freezes the target at its current replica count (KEDA 2.12 or newer). A
 *   ScaledJob has no replicas to keep: the same annotation stops it from
 *   creating Jobs.
 * - "Resume Autoscaling" removes both annotations, as `kubectl annotate so
 *   <name> autoscaling.keda.sh/paused- autoscaling.keda.sh/paused-replicas-`
 *   does.
 *
 * One component serves both registrations; the `kind` of the object, a
 * literal on each model, picks the store to patch and the dialog.
 */
export const PauseMenuItem = ({ object, toolbar }: PauseMenuItemProps) => {
  if (!object) return <></>;

  // A null value removes an annotation in a merge patch, which KEDA documents
  // for resuming; the host's patch type (string | undefined) does not admit
  // null, hence the cast.
  const annotate = (annotations: Record<string, string | null>) => {
    const patch = { metadata: { annotations: annotations as unknown as Record<string, string | undefined> } };

    return object.kind === "ScaledJob"
      ? ScaledJob.getStore<ScaledJob>().patch(object, patch, "merge")
      : ScaledObject.getStore<ScaledObject>().patch(object, patch, "merge");
  };

  const paused =
    object.kind === "ScaledJob" ? ScaledJob.getPausedAnnotation(object) : ScaledObject.getPausedAnnotation(object);

  if (paused) {
    // Both annotations, for either kind: a null for an annotation the object does not have changes nothing.
    return (
      <MenuItem
        onClick={() =>
          annotate({ [ScaledObject.pausedAnnotation]: null, [ScaledObject.pausedReplicasAnnotation]: null })
        }
      >
        <Icon material="play_circle_outline" interactive={toolbar} title="Resume Autoscaling" />
        <span className="title">Resume Autoscaling</span>
      </MenuItem>
    );
  }

  const pause = async () => {
    if (object.kind === "ScaledJob") {
      ConfirmDialog.open({
        // One element: the dialog lays its content out as flex items, and the text around the name would otherwise
        // be items of their own, which lose the spaces at their edges.
        message: (
          <p>
            Pause the autoscaling of <b>{object.getName()}</b>? It creates no Jobs until autoscaling is resumed.
          </p>
        ),
        labelOk: "Pause",
        ok: () => annotate({ [ScaledObject.pausedAnnotation]: "true" }),
      });

      return;
    }

    let replicas = await getCurrentReplicas(object);

    ConfirmDialog.open({
      message: (
        <PauseReplicas
          target={ScaledObject.getScaleTarget(object)}
          replicas={replicas}
          onChange={(value) => {
            replicas = value;
          }}
        />
      ),
      labelOk: "Pause",
      ok: () =>
        annotate(
          replicas === ""
            ? { [ScaledObject.pausedAnnotation]: "true" }
            : // Number, so that 007 is written as 7.
              { [ScaledObject.pausedReplicasAnnotation]: String(Number(replicas)) },
        ),
    });
  };

  return (
    <MenuItem onClick={pause}>
      <Icon material="pause_circle_outline" interactive={toolbar} title="Pause Autoscaling" />
      <span className="title">Pause Autoscaling</span>
    </MenuItem>
  );
};
