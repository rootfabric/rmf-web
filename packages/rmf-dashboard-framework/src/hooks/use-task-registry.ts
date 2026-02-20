import { TaskDefinition } from '../components/tasks/task-form';
import { createDeferredContext } from './deferred-context';

export interface PalletPointConfig {
  approachWaypoint: string;
  retreatWaypoint?: string;
}

export interface TaskRegistry {
  /**
   * List of tasks that can be submitted.
   */
  taskDefinitions: TaskDefinition[];

  /**
   * List of available pickup zones used for delivery tasks.
   */
  pickupZones: string[];

  // FIXME(koonpeng): this is used for very specific tasks, should be removed when mission
  // system is implemented.
  cartIds: string[];

  /**
   * Optional mapping for pallet-flow tasks where users choose logical points
   * and approach/retreat waypoints are expanded automatically.
   */
  palletPoints?: Record<string, PalletPointConfig>;
}

export const [useTaskRegistry, TaskRegistryProvider] = createDeferredContext<TaskRegistry>();
