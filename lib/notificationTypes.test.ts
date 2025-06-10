import { CancelledNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect,it } from 'vitest';

import { NotificationSchema,StdErrNotificationSchema } from './notificationTypes';

describe('notification schemas', () => {
  it('parses StdErrNotification', () => {
    const data = { method: 'notifications/stderr', params: { content: 'oops' } };
    expect(StdErrNotificationSchema.parse(data)).toEqual(data);
  });

  it('accepts CancelledNotification as Notification', () => {
    const cancelled = { method: 'notifications/cancelled', params: { requestId: '1' } };
    expect(NotificationSchema.parse(cancelled)).toEqual(
      CancelledNotificationSchema.parse(cancelled)
    );
  });
});
