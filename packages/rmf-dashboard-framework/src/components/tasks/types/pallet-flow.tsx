import { Autocomplete, Grid, TextField, useTheme } from '@mui/material';
import React from 'react';

import { TaskBookingLabels } from '../booking-label';
import { TaskDefinition } from '../task-form';

const DEFAULT_LIFT_ACTION_DURATION_MS = 60000;
const DEFAULT_USE_TOOL_SINK = false;

type LiftActionName = 'lift_up' | 'lift_down';

export interface PalletPointConfig {
  approachWaypoint: string;
  retreatWaypoint?: string;
}

export type PalletPointsMap = Record<string, PalletPointConfig>;

interface GoToPlaceActivity {
  category: 'go_to_place';
  description: {
    one_of: [{ waypoint: string }];
  };
}

interface PerformActionActivity {
  category: 'perform_action';
  description: {
    unix_millis_action_duration_estimate: number;
    category: LiftActionName;
    description: Record<string, never>;
    use_tool_sink: boolean;
  };
}

type PalletFlowActivity = GoToPlaceActivity | PerformActionActivity;

interface PalletFlowSequence {
  activity: {
    category: 'sequence';
    description: {
      activities: PalletFlowActivity[];
    };
  };
}

interface PalletFlowTaskDescriptionBase {
  category: string;
  phases: [PalletFlowSequence];
}

export type MoveToWaypointTaskDescription = PalletFlowTaskDescriptionBase;
export type PalletPickTaskDescription = PalletFlowTaskDescriptionBase;
export type PalletDropTaskDescription = PalletFlowTaskDescriptionBase;
export type PalletTransferTaskDescription = PalletFlowTaskDescriptionBase;

export const MoveToWaypointTaskDefinition: TaskDefinition = {
  taskDefinitionId: 'move_to_waypoint',
  taskDisplayName: 'Move To Waypoint',
  requestCategory: 'compose',
  scheduleEventColor: undefined,
};

export const PalletPickTaskDefinition: TaskDefinition = {
  taskDefinitionId: 'pallet_pick',
  taskDisplayName: 'Pallet Pick',
  requestCategory: 'compose',
  scheduleEventColor: undefined,
};

export const PalletDropTaskDefinition: TaskDefinition = {
  taskDefinitionId: 'pallet_drop',
  taskDisplayName: 'Pallet Drop',
  requestCategory: 'compose',
  scheduleEventColor: undefined,
};

export const PalletTransferTaskDefinition: TaskDefinition = {
  taskDefinitionId: 'pallet_transfer',
  taskDisplayName: 'Pallet Transfer',
  requestCategory: 'compose',
  scheduleEventColor: undefined,
};

function makeGoToPlaceActivity(waypoint = ''): GoToPlaceActivity {
  return {
    category: 'go_to_place',
    description: {
      one_of: [{ waypoint }],
    },
  };
}

function makeLiftActivity(action: LiftActionName): PerformActionActivity {
  return {
    category: 'perform_action',
    description: {
      unix_millis_action_duration_estimate: DEFAULT_LIFT_ACTION_DURATION_MS,
      category: action,
      description: {},
      use_tool_sink: DEFAULT_USE_TOOL_SINK,
    },
  };
}

function isGoToPlaceActivity(activity: PalletFlowActivity): activity is GoToPlaceActivity {
  return activity.category === 'go_to_place';
}

function getWaypointFromActivity(activity: PalletFlowActivity | undefined): string {
  if (!activity || !isGoToPlaceActivity(activity)) {
    return '';
  }
  return activity.description.one_of[0]?.waypoint ?? '';
}

function hasWaypoint(activity: PalletFlowActivity | undefined): boolean {
  return getWaypointFromActivity(activity).trim().length > 0;
}

function setWaypointAt(
  taskDesc: PalletFlowTaskDescriptionBase,
  activityIndex: number,
  waypoint: string,
): PalletFlowTaskDescriptionBase {
  const activity = taskDesc.phases[0].activity.description.activities[activityIndex];
  if (!activity || !isGoToPlaceActivity(activity)) {
    return taskDesc;
  }
  activity.description.one_of = [{ waypoint: waypoint.trim() }];
  return taskDesc;
}

function getPalletPointNames(palletPoints: PalletPointsMap | undefined): string[] {
  if (!palletPoints) {
    return [];
  }
  return Object.keys(palletPoints).sort();
}

function resolvePalletPoint(
  palletPoints: PalletPointsMap | undefined,
  pointName: string,
): { parkingWaypoint: string; approachWaypoint: string; retreatWaypoint: string } | null {
  if (!palletPoints) {
    return null;
  }
  const normalizedPointName = pointName.trim();
  if (!normalizedPointName || !palletPoints[normalizedPointName]) {
    return null;
  }
  const cfg = palletPoints[normalizedPointName];
  const approachWaypoint = (cfg.approachWaypoint ?? '').trim();
  if (!approachWaypoint) {
    return null;
  }
  const retreatWaypoint = (cfg.retreatWaypoint ?? approachWaypoint).trim() || approachWaypoint;
  return {
    parkingWaypoint: normalizedPointName,
    approachWaypoint,
    retreatWaypoint,
  };
}

function makeDestinationLabel(taskDefinitionId: string, destination: string): TaskBookingLabels {
  return {
    task_definition_id: taskDefinitionId,
    destination,
  };
}

export function makeMoveToWaypointTaskBookingLabel(
  taskDescription: MoveToWaypointTaskDescription,
): TaskBookingLabels {
  return makeDestinationLabel(
    MoveToWaypointTaskDefinition.taskDefinitionId,
    getWaypointFromActivity(taskDescription.phases[0].activity.description.activities[0]),
  );
}

export function makePalletPickTaskBookingLabel(
  taskDescription: PalletPickTaskDescription,
): TaskBookingLabels {
  return makeDestinationLabel(
    PalletPickTaskDefinition.taskDefinitionId,
    getWaypointFromActivity(taskDescription.phases[0].activity.description.activities[2]),
  );
}

export function makePalletDropTaskBookingLabel(
  taskDescription: PalletDropTaskDescription,
): TaskBookingLabels {
  return makeDestinationLabel(
    PalletDropTaskDefinition.taskDefinitionId,
    getWaypointFromActivity(taskDescription.phases[0].activity.description.activities[3]),
  );
}

export function makePalletTransferTaskBookingLabel(
  taskDescription: PalletTransferTaskDescription,
): TaskBookingLabels {
  return makeDestinationLabel(
    PalletTransferTaskDefinition.taskDefinitionId,
    getWaypointFromActivity(taskDescription.phases[0].activity.description.activities[7]),
  );
}

export function isMoveToWaypointTaskDescriptionValid(
  taskDescription: MoveToWaypointTaskDescription,
): boolean {
  const activities = taskDescription.phases[0].activity.description.activities;
  return activities.length >= 1 && hasWaypoint(activities[0]);
}

export function isPalletPickTaskDescriptionValid(
  taskDescription: PalletPickTaskDescription,
): boolean {
  const activities = taskDescription.phases[0].activity.description.activities;
  return activities.length >= 4 && hasWaypoint(activities[0]) && hasWaypoint(activities[2]);
}

export function isPalletDropTaskDescriptionValid(
  taskDescription: PalletDropTaskDescription,
): boolean {
  const activities = taskDescription.phases[0].activity.description.activities;
  return (
    activities.length >= 4 &&
    hasWaypoint(activities[0]) &&
    hasWaypoint(activities[2]) &&
    hasWaypoint(activities[3])
  );
}

export function isPalletTransferTaskDescriptionValid(
  taskDescription: PalletTransferTaskDescription,
): boolean {
  const activities = taskDescription.phases[0].activity.description.activities;
  return (
    activities.length >= 8 &&
    hasWaypoint(activities[0]) &&
    hasWaypoint(activities[2]) &&
    hasWaypoint(activities[4]) &&
    hasWaypoint(activities[6]) &&
    hasWaypoint(activities[7])
  );
}

export function makeDefaultMoveToWaypointTaskDescription(): MoveToWaypointTaskDescription {
  return {
    category: 'move_to_waypoint',
    phases: [
      {
        activity: {
          category: 'sequence',
          description: {
            activities: [makeGoToPlaceActivity('')],
          },
        },
      },
    ],
  };
}

export function makeDefaultPalletPickTaskDescription(): PalletPickTaskDescription {
  return {
    category: 'pallet_pick',
    phases: [
      {
        activity: {
          category: 'sequence',
          description: {
            activities: [
              makeGoToPlaceActivity(''),
              makeLiftActivity('lift_down'),
              makeGoToPlaceActivity(''),
              makeLiftActivity('lift_up'),
            ],
          },
        },
      },
    ],
  };
}

export function makeDefaultPalletDropTaskDescription(): PalletDropTaskDescription {
  return {
    category: 'pallet_drop',
    phases: [
      {
        activity: {
          category: 'sequence',
          description: {
            activities: [
              makeGoToPlaceActivity(''),
              makeLiftActivity('lift_down'),
              makeGoToPlaceActivity(''),
              makeGoToPlaceActivity(''),
            ],
          },
        },
      },
    ],
  };
}

export function makeDefaultPalletTransferTaskDescription(): PalletTransferTaskDescription {
  return {
    category: 'pallet_transfer',
    phases: [
      {
        activity: {
          category: 'sequence',
          description: {
            activities: [
              makeGoToPlaceActivity(''),
              makeLiftActivity('lift_down'),
              makeGoToPlaceActivity(''),
              makeLiftActivity('lift_up'),
              makeGoToPlaceActivity(''),
              makeLiftActivity('lift_down'),
              makeGoToPlaceActivity(''),
              makeGoToPlaceActivity(''),
            ],
          },
        },
      },
    ],
  };
}

export function makeMoveToWaypointTaskShortDescription(
  taskDescription: MoveToWaypointTaskDescription,
  displayName?: string,
): string {
  const target = getWaypointFromActivity(
    taskDescription.phases[0].activity.description.activities[0],
  );
  return `[${displayName ?? MoveToWaypointTaskDefinition.taskDisplayName}] -> [${target}]`;
}

export function makePalletPickTaskShortDescription(
  taskDescription: PalletPickTaskDescription,
  displayName?: string,
): string {
  const approach = getWaypointFromActivity(
    taskDescription.phases[0].activity.description.activities[0],
  );
  const parking = getWaypointFromActivity(
    taskDescription.phases[0].activity.description.activities[2],
  );
  return `[${displayName ?? PalletPickTaskDefinition.taskDisplayName}] approach [${approach}] park [${parking}]`;
}

export function makePalletDropTaskShortDescription(
  taskDescription: PalletDropTaskDescription,
  displayName?: string,
): string {
  const approach = getWaypointFromActivity(
    taskDescription.phases[0].activity.description.activities[0],
  );
  const parking = getWaypointFromActivity(
    taskDescription.phases[0].activity.description.activities[2],
  );
  const retreat = getWaypointFromActivity(
    taskDescription.phases[0].activity.description.activities[3],
  );
  return `[${displayName ?? PalletDropTaskDefinition.taskDisplayName}] approach [${approach}] park [${parking}] retreat [${retreat}]`;
}

export function makePalletTransferTaskShortDescription(
  taskDescription: PalletTransferTaskDescription,
  displayName?: string,
): string {
  const fromApproach = getWaypointFromActivity(
    taskDescription.phases[0].activity.description.activities[0],
  );
  const toApproach = getWaypointFromActivity(
    taskDescription.phases[0].activity.description.activities[4],
  );
  const toParking = getWaypointFromActivity(
    taskDescription.phases[0].activity.description.activities[6],
  );
  return `[${displayName ?? PalletTransferTaskDefinition.taskDisplayName}] from [${fromApproach}] to [${toApproach}] park [${toParking}]`;
}

interface WaypointFieldProps {
  id: string;
  label: string;
  value: string;
  waypoints: string[];
  onChange(value: string): void;
}

function WaypointField({ id, label, value, waypoints, onChange }: WaypointFieldProps) {
  return (
    <Autocomplete
      id={id}
      freeSolo
      fullWidth
      options={waypoints}
      value={value}
      onChange={(_ev, newValue) => onChange(newValue ?? '')}
      onBlur={(ev) => onChange((ev.target as HTMLInputElement).value)}
      renderInput={(params) => <TextField {...params} label={label} required />}
    />
  );
}

interface MoveToWaypointTaskFormProps {
  taskDesc: MoveToWaypointTaskDescription;
  patrolWaypoints: string[];
  onChange(taskDesc: MoveToWaypointTaskDescription): void;
  onValidate(valid: boolean): void;
}

export function MoveToWaypointTaskForm({
  taskDesc,
  patrolWaypoints,
  onChange,
  onValidate,
}: MoveToWaypointTaskFormProps): React.JSX.Element {
  const theme = useTheme();
  const onInputChange = (desc: MoveToWaypointTaskDescription) => {
    onValidate(isMoveToWaypointTaskDescriptionValid(desc));
    onChange(desc);
  };

  React.useEffect(() => {
    onValidate(isMoveToWaypointTaskDescriptionValid(taskDesc));
  }, [onValidate, taskDesc]);

  const waypoints = [...patrolWaypoints].sort();
  const target = getWaypointFromActivity(taskDesc.phases[0].activity.description.activities[0]);

  return (
    <Grid container spacing={theme.spacing(2)}>
      <Grid item xs={12}>
        <WaypointField
          id="move-to-waypoint"
          label="Target Waypoint"
          value={target}
          waypoints={waypoints}
          onChange={(value) =>
            onInputChange({
              ...setWaypointAt(taskDesc, 0, value),
            })
          }
        />
      </Grid>
    </Grid>
  );
}

interface PalletPickTaskFormProps {
  taskDesc: PalletPickTaskDescription;
  patrolWaypoints: string[];
  palletPoints?: PalletPointsMap;
  onChange(taskDesc: PalletPickTaskDescription): void;
  onValidate(valid: boolean): void;
}

export function PalletPickTaskForm({
  taskDesc,
  patrolWaypoints: _patrolWaypoints,
  palletPoints,
  onChange,
  onValidate,
}: PalletPickTaskFormProps): React.JSX.Element {
  const theme = useTheme();
  const onInputChange = (desc: PalletPickTaskDescription) => {
    onValidate(isPalletPickTaskDescriptionValid(desc));
    onChange(desc);
  };

  React.useEffect(() => {
    onValidate(isPalletPickTaskDescriptionValid(taskDesc));
  }, [onValidate, taskDesc]);

  const pointNames = getPalletPointNames(palletPoints);

  return (
    <Grid container spacing={theme.spacing(2)}>
      <Grid item xs={12}>
        <Autocomplete
          id="pallet-pick-point"
          freeSolo
          fullWidth
          options={pointNames}
          value={getWaypointFromActivity(taskDesc.phases[0].activity.description.activities[2])}
          onChange={(_ev, newValue) => {
            const pointName = newValue ?? '';
            const resolved = resolvePalletPoint(palletPoints, pointName);
            if (!resolved) {
              let updatedDesc = setWaypointAt(taskDesc, 0, '');
              updatedDesc = setWaypointAt(updatedDesc, 2, pointName);
              onInputChange({ ...updatedDesc });
              return;
            }
            let updatedDesc = setWaypointAt(taskDesc, 0, resolved.approachWaypoint);
            updatedDesc = setWaypointAt(updatedDesc, 2, resolved.parkingWaypoint);
            onInputChange({ ...updatedDesc });
          }}
          onBlur={(ev) => {
            const pointName = (ev.target as HTMLInputElement).value;
            const resolved = resolvePalletPoint(palletPoints, pointName);
            if (!resolved) {
              let updatedDesc = setWaypointAt(taskDesc, 0, '');
              updatedDesc = setWaypointAt(updatedDesc, 2, pointName);
              onInputChange({ ...updatedDesc });
              return;
            }
            let updatedDesc = setWaypointAt(taskDesc, 0, resolved.approachWaypoint);
            updatedDesc = setWaypointAt(updatedDesc, 2, resolved.parkingWaypoint);
            onInputChange({ ...updatedDesc });
          }}
          renderInput={(params) => <TextField {...params} label="Point" required />}
        />
      </Grid>
    </Grid>
  );
}

interface PalletDropTaskFormProps {
  taskDesc: PalletDropTaskDescription;
  patrolWaypoints: string[];
  palletPoints?: PalletPointsMap;
  onChange(taskDesc: PalletDropTaskDescription): void;
  onValidate(valid: boolean): void;
}

export function PalletDropTaskForm({
  taskDesc,
  patrolWaypoints: _patrolWaypoints,
  palletPoints,
  onChange,
  onValidate,
}: PalletDropTaskFormProps): React.JSX.Element {
  const theme = useTheme();
  const onInputChange = (desc: PalletDropTaskDescription) => {
    onValidate(isPalletDropTaskDescriptionValid(desc));
    onChange(desc);
  };

  React.useEffect(() => {
    onValidate(isPalletDropTaskDescriptionValid(taskDesc));
  }, [onValidate, taskDesc]);

  const pointNames = getPalletPointNames(palletPoints);

  return (
    <Grid container spacing={theme.spacing(2)}>
      <Grid item xs={12}>
        <Autocomplete
          id="pallet-drop-point"
          freeSolo
          fullWidth
          options={pointNames}
          value={getWaypointFromActivity(taskDesc.phases[0].activity.description.activities[2])}
          onChange={(_ev, newValue) => {
            const pointName = newValue ?? '';
            const resolved = resolvePalletPoint(palletPoints, pointName);
            if (!resolved) {
              let updatedDesc = setWaypointAt(taskDesc, 0, '');
              updatedDesc = setWaypointAt(updatedDesc, 2, pointName);
              updatedDesc = setWaypointAt(updatedDesc, 3, '');
              onInputChange({ ...updatedDesc });
              return;
            }
            let updatedDesc = setWaypointAt(taskDesc, 0, resolved.approachWaypoint);
            updatedDesc = setWaypointAt(updatedDesc, 2, resolved.parkingWaypoint);
            updatedDesc = setWaypointAt(updatedDesc, 3, resolved.retreatWaypoint);
            onInputChange({ ...updatedDesc });
          }}
          onBlur={(ev) => {
            const pointName = (ev.target as HTMLInputElement).value;
            const resolved = resolvePalletPoint(palletPoints, pointName);
            if (!resolved) {
              let updatedDesc = setWaypointAt(taskDesc, 0, '');
              updatedDesc = setWaypointAt(updatedDesc, 2, pointName);
              updatedDesc = setWaypointAt(updatedDesc, 3, '');
              onInputChange({ ...updatedDesc });
              return;
            }
            let updatedDesc = setWaypointAt(taskDesc, 0, resolved.approachWaypoint);
            updatedDesc = setWaypointAt(updatedDesc, 2, resolved.parkingWaypoint);
            updatedDesc = setWaypointAt(updatedDesc, 3, resolved.retreatWaypoint);
            onInputChange({ ...updatedDesc });
          }}
          renderInput={(params) => <TextField {...params} label="Point" required />}
        />
      </Grid>
    </Grid>
  );
}

interface PalletTransferTaskFormProps {
  taskDesc: PalletTransferTaskDescription;
  patrolWaypoints: string[];
  palletPoints?: PalletPointsMap;
  onChange(taskDesc: PalletTransferTaskDescription): void;
  onValidate(valid: boolean): void;
}

export function PalletTransferTaskForm({
  taskDesc,
  patrolWaypoints: _patrolWaypoints,
  palletPoints,
  onChange,
  onValidate,
}: PalletTransferTaskFormProps): React.JSX.Element {
  const theme = useTheme();
  const onInputChange = (desc: PalletTransferTaskDescription) => {
    onValidate(isPalletTransferTaskDescriptionValid(desc));
    onChange(desc);
  };

  React.useEffect(() => {
    onValidate(isPalletTransferTaskDescriptionValid(taskDesc));
  }, [onValidate, taskDesc]);

  const pointNames = getPalletPointNames(palletPoints);

  return (
    <Grid container spacing={theme.spacing(2)}>
      <Grid item xs={6}>
        <Autocomplete
          id="pallet-transfer-from-point"
          freeSolo
          fullWidth
          options={pointNames}
          value={getWaypointFromActivity(taskDesc.phases[0].activity.description.activities[2])}
          onChange={(_ev, newValue) => {
            const pointName = newValue ?? '';
            const resolved = resolvePalletPoint(palletPoints, pointName);
            if (!resolved) {
              let updatedDesc = setWaypointAt(taskDesc, 0, '');
              updatedDesc = setWaypointAt(updatedDesc, 2, pointName);
              onInputChange({ ...updatedDesc });
              return;
            }
            let updatedDesc = setWaypointAt(taskDesc, 0, resolved.approachWaypoint);
            updatedDesc = setWaypointAt(updatedDesc, 2, resolved.parkingWaypoint);
            onInputChange({ ...updatedDesc });
          }}
          onBlur={(ev) => {
            const pointName = (ev.target as HTMLInputElement).value;
            const resolved = resolvePalletPoint(palletPoints, pointName);
            if (!resolved) {
              let updatedDesc = setWaypointAt(taskDesc, 0, '');
              updatedDesc = setWaypointAt(updatedDesc, 2, pointName);
              onInputChange({ ...updatedDesc });
              return;
            }
            let updatedDesc = setWaypointAt(taskDesc, 0, resolved.approachWaypoint);
            updatedDesc = setWaypointAt(updatedDesc, 2, resolved.parkingWaypoint);
            onInputChange({ ...updatedDesc });
          }}
          renderInput={(params) => <TextField {...params} label="From Point" required />}
        />
      </Grid>
      <Grid item xs={6}>
        <Autocomplete
          id="pallet-transfer-to-point"
          freeSolo
          fullWidth
          options={pointNames}
          value={getWaypointFromActivity(taskDesc.phases[0].activity.description.activities[6])}
          onChange={(_ev, newValue) => {
            const pointName = newValue ?? '';
            const resolved = resolvePalletPoint(palletPoints, pointName);
            if (!resolved) {
              let updatedDesc = setWaypointAt(taskDesc, 4, '');
              updatedDesc = setWaypointAt(updatedDesc, 6, pointName);
              updatedDesc = setWaypointAt(updatedDesc, 7, '');
              onInputChange({ ...updatedDesc });
              return;
            }
            let updatedDesc = setWaypointAt(taskDesc, 4, resolved.approachWaypoint);
            updatedDesc = setWaypointAt(updatedDesc, 6, resolved.parkingWaypoint);
            updatedDesc = setWaypointAt(updatedDesc, 7, resolved.retreatWaypoint);
            onInputChange({ ...updatedDesc });
          }}
          onBlur={(ev) => {
            const pointName = (ev.target as HTMLInputElement).value;
            const resolved = resolvePalletPoint(palletPoints, pointName);
            if (!resolved) {
              let updatedDesc = setWaypointAt(taskDesc, 4, '');
              updatedDesc = setWaypointAt(updatedDesc, 6, pointName);
              updatedDesc = setWaypointAt(updatedDesc, 7, '');
              onInputChange({ ...updatedDesc });
              return;
            }
            let updatedDesc = setWaypointAt(taskDesc, 4, resolved.approachWaypoint);
            updatedDesc = setWaypointAt(updatedDesc, 6, resolved.parkingWaypoint);
            updatedDesc = setWaypointAt(updatedDesc, 7, resolved.retreatWaypoint);
            onInputChange({ ...updatedDesc });
          }}
          renderInput={(params) => <TextField {...params} label="To Point" required />}
        />
      </Grid>
    </Grid>
  );
}
