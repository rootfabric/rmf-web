import { MenuItem, TextField } from '@mui/material';
import React from 'react';

import { TaskBookingLabels } from '../booking-label';
import { TaskDefinition } from '../task-form';

const DEFAULT_ACTION_DURATION_MS = 60000;
const DEFAULT_USE_TOOL_SINK = false;

type LiftActionName = 'lift_up' | 'lift_down';

interface LiftCommandActivity {
  category: 'perform_action';
  description: {
    unix_millis_action_duration_estimate: number;
    category: LiftActionName;
    description: Record<string, never>;
    use_tool_sink: boolean;
  };
}

export interface LiftCommandTaskDescription {
  category: 'lift_command';
  phases: [
    {
      activity: {
        category: 'sequence';
        description: {
          activities: [LiftCommandActivity];
        };
      };
    },
  ];
}

export const LiftCommandTaskDefinition: TaskDefinition = {
  taskDefinitionId: 'lift_command',
  taskDisplayName: 'Lift Command',
  requestCategory: 'compose',
  scheduleEventColor: undefined,
};

function getLiftAction(desc: LiftCommandTaskDescription): LiftActionName {
  return desc.phases[0].activity.description.activities[0].description.category;
}

function setLiftAction(
  taskDesc: LiftCommandTaskDescription,
  action: LiftActionName,
): LiftCommandTaskDescription {
  taskDesc.phases[0].activity.description.activities[0].description.category = action;
  return taskDesc;
}

export function makeDefaultLiftCommandTaskDescription(): LiftCommandTaskDescription {
  return {
    category: 'lift_command',
    phases: [
      {
        activity: {
          category: 'sequence',
          description: {
            activities: [
              {
                category: 'perform_action',
                description: {
                  unix_millis_action_duration_estimate: DEFAULT_ACTION_DURATION_MS,
                  category: 'lift_down',
                  description: {},
                  use_tool_sink: DEFAULT_USE_TOOL_SINK,
                },
              },
            ],
          },
        },
      },
    ],
  };
}

export function isLiftCommandTaskDescriptionValid(desc: LiftCommandTaskDescription): boolean {
  const action = getLiftAction(desc);
  return action === 'lift_up' || action === 'lift_down';
}

export function makeLiftCommandTaskBookingLabel(
  taskDescription: LiftCommandTaskDescription,
): TaskBookingLabels {
  return {
    task_definition_id: LiftCommandTaskDefinition.taskDefinitionId,
    action: getLiftAction(taskDescription),
  };
}

export function makeLiftCommandTaskShortDescription(
  taskDescription: LiftCommandTaskDescription,
  displayName?: string,
): string {
  return `[${displayName ?? LiftCommandTaskDefinition.taskDisplayName}] [${getLiftAction(
    taskDescription,
  )}]`;
}

interface LiftCommandTaskFormProps {
  taskDesc: LiftCommandTaskDescription;
  onChange(taskDesc: LiftCommandTaskDescription): void;
  onValidate(valid: boolean): void;
}

export function LiftCommandTaskForm({
  taskDesc,
  onChange,
  onValidate,
}: LiftCommandTaskFormProps): React.JSX.Element {
  React.useEffect(() => {
    onValidate(isLiftCommandTaskDescriptionValid(taskDesc));
  }, [onValidate, taskDesc]);

  const onInputChange = (desc: LiftCommandTaskDescription) => {
    onValidate(isLiftCommandTaskDescriptionValid(desc));
    onChange(desc);
  };

  return (
    <TextField
      select
      fullWidth
      id="lift-command-action"
      label="Lift Action"
      value={getLiftAction(taskDesc)}
      onChange={(ev) => {
        const action = ev.target.value === 'lift_up' ? 'lift_up' : 'lift_down';
        onInputChange({
          ...setLiftAction(taskDesc, action),
        });
      }}
    >
      <MenuItem value="lift_up">Lift Up</MenuItem>
      <MenuItem value="lift_down">Lift Down</MenuItem>
    </TextField>
  );
}
