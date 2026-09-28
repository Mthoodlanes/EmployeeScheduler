import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as pushSubscriptionRepo from '../../../../server/src/db/repositories/pushSubscriptionRepo.js';
import type { RequestingActor } from '../../../../server/src/db/domain-types.js';

// `pushService.notifyEmployees` talks to real push services (Chrome/FCM,
// Mozilla, etc.) over HTTP via `web-push` — unlike every other service test
// in this suite, which only ever talks to the real Neon test branch, a call
// like that has no business making a real network request in a unit test
// (it would be slow, flaky, and dependent on fake endpoints being
// reachable). `web-push` itself is mocked; `pushSubscriptionRepo` and
// `employeeRepo` still hit the real test database like every other test
// here.
const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock('web-push', () => ({
  default: {
    sendNotification: (...args: unknown[]) => sendNotification(...args),
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
  },
}));

const ORIGINAL_ENV = { ...process.env };

let employeeActor: RequestingActor;
let employeeId: number;

beforeEach(async () => {
  await truncateAllTables();
  sendNotification.mockReset();
  setVapidDetails.mockReset();
  process.env.VAPID_PUBLIC_KEY = 'test-public-key';
  process.env.VAPID_PRIVATE_KEY = 'test-private-key';
  process.env.VAPID_SUBJECT = 'mailto:test@example.com';

  const employee = await employeeRepo.create({
    name: 'Employee One',
    username: `employee-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: [],
  });
  employeeId = employee.id;
  employeeActor = { id: employeeId, role: 'employee', isSecretaryTagged: false };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('pushService', () => {
  describe('getVapidPublicKey', () => {
    it('returns the configured public key', async () => {
      const pushService = await import('../../../../server/src/services/pushService.js');
      expect(pushService.getVapidPublicKey()).toBe('test-public-key');
    });

    it('throws when VAPID_PUBLIC_KEY is not set', async () => {
      delete process.env.VAPID_PUBLIC_KEY;
      const pushService = await import('../../../../server/src/services/pushService.js');
      expect(() => pushService.getVapidPublicKey()).toThrow(
        'VAPID_PUBLIC_KEY environment variable is not set.',
      );
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('subscribe stores the subscription under the acting employee', async () => {
      const pushService = await import('../../../../server/src/services/pushService.js');
      await pushService.subscribe(employeeActor, {
        endpoint: 'https://push.example.com/device-1',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      });

      const subscriptions = await pushSubscriptionRepo.listForEmployees([employeeId]);
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].endpoint).toBe('https://push.example.com/device-1');
    });

    it('unsubscribe removes a subscription by endpoint', async () => {
      const pushService = await import('../../../../server/src/services/pushService.js');
      await pushService.subscribe(employeeActor, {
        endpoint: 'https://push.example.com/device-1',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      });

      await pushService.unsubscribe(employeeActor, 'https://push.example.com/device-1');

      expect(await pushSubscriptionRepo.listForEmployees([employeeId])).toEqual([]);
    });
  });

  describe('notifyEmployees', () => {
    it('does nothing when given no employee ids, without requiring VAPID config', async () => {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.VAPID_SUBJECT;
      const pushService = await import('../../../../server/src/services/pushService.js');

      await expect(
        pushService.notifyEmployees([], { title: 'Title', body: 'Body', url: '/my-schedule' }),
      ).resolves.toBeUndefined();
      expect(sendNotification).not.toHaveBeenCalled();
    });

    it('throws when VAPID env vars are not configured and there are employees to notify', async () => {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.VAPID_SUBJECT;
      const pushService = await import('../../../../server/src/services/pushService.js');

      await expect(
        pushService.notifyEmployees([employeeId], {
          title: 'Title',
          body: 'Body',
          url: '/my-schedule',
        }),
      ).rejects.toThrow(/VAPID_PUBLIC_KEY/);
    });

    it('sends to every subscribed device for the given employees', async () => {
      const pushService = await import('../../../../server/src/services/pushService.js');
      await pushService.subscribe(employeeActor, {
        endpoint: 'https://push.example.com/device-1',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      });
      sendNotification.mockResolvedValue(undefined);

      await pushService.notifyEmployees([employeeId], {
        title: 'Schedule published',
        body: 'Your Front Desk schedule is up',
        url: '/my-schedule',
      });

      expect(sendNotification).toHaveBeenCalledTimes(1);
      const [subscriptionArg, bodyArg] = sendNotification.mock.calls[0];
      expect(subscriptionArg).toEqual({
        endpoint: 'https://push.example.com/device-1',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      });
      expect(JSON.parse(bodyArg as string)).toEqual({
        title: 'Schedule published',
        body: 'Your Front Desk schedule is up',
        url: '/my-schedule',
      });
    });

    it('deletes the subscription when the push service reports it is permanently gone (410)', async () => {
      const pushService = await import('../../../../server/src/services/pushService.js');
      await pushService.subscribe(employeeActor, {
        endpoint: 'https://push.example.com/dead-device',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      });
      sendNotification.mockRejectedValue(Object.assign(new Error('Gone'), { statusCode: 410 }));

      await pushService.notifyEmployees([employeeId], {
        title: 'Title',
        body: 'Body',
        url: '/my-schedule',
      });

      expect(await pushSubscriptionRepo.listForEmployees([employeeId])).toEqual([]);
    });

    it('keeps the subscription and never throws on a non-permanent failure', async () => {
      const pushService = await import('../../../../server/src/services/pushService.js');
      await pushService.subscribe(employeeActor, {
        endpoint: 'https://push.example.com/flaky-device',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      });
      sendNotification.mockRejectedValue(
        Object.assign(new Error('Service unavailable'), { statusCode: 503 }),
      );
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        pushService.notifyEmployees([employeeId], {
          title: 'Title',
          body: 'Body',
          url: '/my-schedule',
        }),
      ).resolves.toBeUndefined();

      expect(await pushSubscriptionRepo.listForEmployees([employeeId])).toHaveLength(1);
    });
  });
});
