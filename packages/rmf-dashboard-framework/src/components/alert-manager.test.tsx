import { AlertRequest, ApiServerModelsAlertsAlertRequestTier } from 'api-client';
import React from 'react';
import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RmfApiProvider } from '../hooks';
import { MockRmfApi, render, TestProviders } from '../utils/test-utils.test';
import { AlertDialog, AlertManager } from './alert-manager';

afterEach(() => {
  vi.useRealTimers();
});

describe('Alert dialog', () => {
  const rmfApi = new MockRmfApi();
  rmfApi.alertsApi.getAlertResponseAlertsRequestAlertIdResponseGet = vi
    .fn()
    .mockResolvedValue({ data: [] });
  const getTaskLog = vi.fn().mockResolvedValue({ data: { task_id: 'test-task', phases: {} } });
  rmfApi.tasksApi.getTaskLogTasksTaskIdLogGet = getTaskLog;

  const Base = (props: React.PropsWithChildren<{}>) => {
    return (
      <TestProviders>
        <RmfApiProvider value={rmfApi}>{props.children}</RmfApiProvider>
      </TestProviders>
    );
  };

  it('renders without crashing', async () => {
    const alertRequest: AlertRequest = {
      id: 'test-alert',
      unix_millis_alert_time: 0,
      title: 'Test Alert',
      subtitle: 'Test subtitle',
      message: 'This is a test alert',
      tier: ApiServerModelsAlertsAlertRequestTier.Error,
      responses_available: ['ok'],
      display: true,
      task_id: 'test-task',
      alert_parameters: [],
    };
    const onDismiss = vi.fn();

    const root = render(
      <Base>
        <AlertDialog alertRequest={alertRequest} onDismiss={onDismiss} />
      </Base>,
    );
    expect(root.getByText('Test Alert')).toBeTruthy();
    expect(root.getByText('This is a test alert')).toBeTruthy();
    expect(root.getByTestId('test-alert-ok-button')).toBeTruthy();
    expect(root.getByTestId('task-cancel-button')).toBeTruthy();
    expect(root.getByTestId('dismiss-button')).toBeTruthy();
    await waitFor(() => expect(getTaskLog).toHaveBeenCalled());
    const between = String(getTaskLog.mock.calls[0][1]);
    expect(between).toMatch(/^0,\d+$/);
    expect(between).not.toContain(String(Number.MAX_SAFE_INTEGER));
  });

  it('auto-dismisses task result alerts after 5 seconds', async () => {
    vi.useFakeTimers();
    const alertRequest: AlertRequest = {
      id: 'task-completed-alert',
      unix_millis_alert_time: 0,
      title: 'Task completed',
      subtitle: 'ID: test-task',
      message: '',
      tier: ApiServerModelsAlertsAlertRequestTier.Info,
      responses_available: ['Acknowledge'],
      display: true,
      task_id: 'test-task',
      alert_parameters: [],
    };
    const onDismiss = vi.fn();

    render(
      <Base>
        <AlertDialog alertRequest={alertRequest} onDismiss={onDismiss} />
      </Base>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('keeps actionable alerts open without auto-dismiss', async () => {
    vi.useFakeTimers();
    const alertRequest: AlertRequest = {
      id: 'action-required-alert',
      unix_millis_alert_time: 0,
      title: 'Delivery alert',
      subtitle: 'ID: test-task',
      message: 'Operator intervention required',
      tier: ApiServerModelsAlertsAlertRequestTier.Warning,
      responses_available: ['Override', 'Cancel'],
      display: true,
      task_id: 'test-task',
      alert_parameters: [],
    };
    const onDismiss = vi.fn();

    const root = render(
      <Base>
        <AlertDialog alertRequest={alertRequest} onDismiss={onDismiss} />
      </Base>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(root.getByText('Delivery alert')).toBeTruthy();
  });

  it('cleans up auto-dismiss timer on unmount', async () => {
    vi.useFakeTimers();
    const alertRequest: AlertRequest = {
      id: 'task-failed-alert',
      unix_millis_alert_time: 0,
      title: 'Task failed',
      subtitle: 'ID: test-task',
      message: '',
      tier: ApiServerModelsAlertsAlertRequestTier.Error,
      responses_available: ['Acknowledge'],
      display: true,
      task_id: 'test-task',
      alert_parameters: [],
    };
    const onDismiss = vi.fn();

    const root = render(
      <Base>
        <AlertDialog alertRequest={alertRequest} onDismiss={onDismiss} />
      </Base>,
    );

    act(() => {
      root.unmount();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('Alert manager', () => {
  const rmfApi = new MockRmfApi();
  rmfApi.alertsApi.getAlertResponseAlertsRequestAlertIdResponseGet = vi
    .fn()
    .mockResolvedValue({ data: [] });
  rmfApi.tasksApi.getTaskLogTasksTaskIdLogGet = () => new Promise(() => {});

  const Base = (props: React.PropsWithChildren<{}>) => {
    return (
      <TestProviders>
        <RmfApiProvider value={rmfApi}>{props.children}</RmfApiProvider>
      </TestProviders>
    );
  };

  it('starts without crashing', () => {
    render(
      <Base>
        <AlertManager />
      </Base>,
    );
  });
});
