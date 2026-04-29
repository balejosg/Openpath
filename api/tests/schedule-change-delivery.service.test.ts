import { describe, test } from 'node:test';
import assert from 'node:assert';

import {
  emitScheduleChangeDelivery,
  resolveScheduleChangeDelivery,
} from '../src/services/schedule-change-delivery.service.js';

await describe('Schedule Change Delivery service', async () => {
  await test('returns no classroom IDs when no boundary and no expired exemptions exist', async () => {
    const delivery = await resolveScheduleChangeDelivery(
      { now: new Date('2026-02-23T09:00:00Z') },
      {
        getClassroomIdsWithBoundaryAt: () => Promise.resolve([]),
        deleteExpiredMachineExemptions: () => Promise.resolve([]),
      }
    );

    assert.deepStrictEqual(delivery, {
      classroomIds: [],
      boundaryClassroomIds: [],
      expiredExemptionClassroomIds: [],
    });
  });

  await test('deduplicates classroom IDs present in schedule boundary and expired exemptions', async () => {
    const delivery = await resolveScheduleChangeDelivery(
      { now: new Date('2026-02-23T09:00:00Z') },
      {
        getClassroomIdsWithBoundaryAt: () => Promise.resolve(['classroom-a', 'classroom-b']),
        deleteExpiredMachineExemptions: () =>
          Promise.resolve(['classroom-b', 'classroom-c', 'classroom-c']),
      }
    );

    assert.deepStrictEqual(delivery.classroomIds, ['classroom-a', 'classroom-b', 'classroom-c']);
    assert.deepStrictEqual(delivery.boundaryClassroomIds, ['classroom-a', 'classroom-b']);
    assert.deepStrictEqual(delivery.expiredExemptionClassroomIds, ['classroom-b', 'classroom-c']);
  });

  await test('keeps separate counts for boundary and expired exemption sources', async () => {
    const delivery = await resolveScheduleChangeDelivery(
      { now: new Date('2026-02-23T09:00:00Z') },
      {
        getClassroomIdsWithBoundaryAt: () => Promise.resolve(['classroom-a', 'classroom-b']),
        deleteExpiredMachineExemptions: () => Promise.resolve(['classroom-b']),
      }
    );

    assert.strictEqual(delivery.classroomIds.length, 2);
    assert.strictEqual(delivery.boundaryClassroomIds.length, 2);
    assert.strictEqual(delivery.expiredExemptionClassroomIds.length, 1);
  });

  await test('emits each classroom once with the same now', () => {
    const now = new Date('2026-02-23T09:00:00Z');
    const emitted: { classroomId: string; now: Date }[] = [];

    emitScheduleChangeDelivery(
      {
        classroomIds: ['classroom-a', 'classroom-b', 'classroom-a'],
        boundaryClassroomIds: [],
        expiredExemptionClassroomIds: [],
      },
      (classroomId, emittedNow) => {
        emitted.push({ classroomId, now: emittedNow });
      },
      now
    );

    assert.deepStrictEqual(emitted, [
      { classroomId: 'classroom-a', now },
      { classroomId: 'classroom-b', now },
    ]);
  });

  await test('logs and continues when expired exemption cleanup fails', async () => {
    const warnings: { message: string; meta?: unknown }[] = [];

    const delivery = await resolveScheduleChangeDelivery(
      { now: new Date('2026-02-23T09:00:00Z') },
      {
        getClassroomIdsWithBoundaryAt: () => Promise.resolve(['classroom-a']),
        deleteExpiredMachineExemptions: () => Promise.reject(new Error('cleanup failed')),
        logger: {
          warn: (message, meta) => warnings.push({ message, meta }),
        },
      }
    );

    assert.deepStrictEqual(delivery, {
      classroomIds: ['classroom-a'],
      boundaryClassroomIds: ['classroom-a'],
      expiredExemptionClassroomIds: [],
    });
    assert.strictEqual(warnings.length, 1);
    assert.strictEqual(warnings[0]?.message, 'Failed to cleanup expired machine exemptions');
  });
});
