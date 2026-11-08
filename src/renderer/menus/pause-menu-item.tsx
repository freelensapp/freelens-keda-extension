import { Common, Renderer } from "@freelensapp/extensions";
import { ScaledJob } from "../api/scaledjob/scaledjob-v1alpha1";
import { ScaledObject } from "../api/scaledobject/scaledobject-v1alpha1";

const {
  Component: { ConfirmDialog, Icon, MenuItem },
} = Renderer;

export type PauseMenuItemProps = Common.Types.KubeObjectMenuItemProps<ScaledObject | ScaledJob>;

/**
 * Pauses, scales to zero or resumes the autoscaling of a ScaledObject or a
 * ScaledJob through the annotations the controller reads:
 *
 * - "Pause Autoscaling" writes `autoscaling.keda.sh/paused: "true"`, which
 *   freezes a ScaledObject's target at its current replica count (KEDA 2.12
 *   or newer) and stops a ScaledJob from creating Jobs.
 * - "Scale to Zero", for a ScaledObject only, writes
 *   `autoscaling.keda.sh/paused-replicas: "0"`, which scales the target to zero
 *   replicas and keeps it there. It asks for confirmation first, as the host
 *   does before deleting an object.
 * - "Resume Autoscaling" removes both annotations, as `kubectl annotate so
 *   <name> autoscaling.keda.sh/paused- autoscaling.keda.sh/paused-replicas-`
 *   does.
 *
 * One component serves both registrations; the `kind` of the object, a
 * literal on each model, picks the store to patch and the items that apply.
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

  return (
    <>
      <MenuItem onClick={() => annotate({ [ScaledObject.pausedAnnotation]: "true" })}>
        <Icon material="pause_circle_outline" interactive={toolbar} title="Pause Autoscaling" />
        <span className="title">Pause Autoscaling</span>
      </MenuItem>
      {object.kind === "ScaledObject" && (
        <MenuItem
          onClick={() =>
            ConfirmDialog.open({
              // One element: the dialog lays its content out as flex items, and the text around the target name
              // would otherwise be items of their own, which lose the spaces at their edges.
              message: (
                <p>
                  Scale <b>{ScaledObject.getScaleTarget(object)}</b> to zero replicas and keep it there until
                  autoscaling is resumed?
                </p>
              ),
              labelOk: "Scale to Zero",
              ok: () => annotate({ [ScaledObject.pausedReplicasAnnotation]: "0" }),
            })
          }
        >
          <Icon material="exposure_zero" interactive={toolbar} title="Scale to Zero" />
          <span className="title">Scale to Zero</span>
        </MenuItem>
      )}
    </>
  );
};
