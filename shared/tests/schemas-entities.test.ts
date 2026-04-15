import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  Classroom,
  DomainRequest,
  HealthReport,
  Machine,
  OneOffSchedule,
  PushSubscription,
  Role,
  RoleInfo,
  SafeUser,
  Schedule,
  User,
} from '../src/schemas/index.js';

describe('Entity Schemas', () => {
  describe('DomainRequest', () => {
    it('validates complete request object', () => {
      const validRequest = {
        id: 'req-123',
        domain: 'example.com',
        reason: 'For testing',
        requesterEmail: 'test@example.com',
        groupId: 'group-1',
        status: 'pending',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        resolvedAt: null,
        resolvedBy: null,
      };
      assert.doesNotThrow(() => DomainRequest.parse(validRequest));
    });

    it('allows optional resolutionNote', () => {
      const request = {
        id: 'req-123',
        domain: 'example.com',
        reason: 'For testing',
        requesterEmail: 'test@example.com',
        groupId: 'group-1',
        status: 'approved',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        resolvedAt: '2025-01-02T00:00:00Z',
        resolvedBy: 'admin-1',
        resolutionNote: 'Approved for educational purposes',
      };
      assert.doesNotThrow(() => DomainRequest.parse(request));
    });
  });

  describe('User', () => {
    it('validates complete user object', () => {
      const validUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        passwordHash: 'hashed_password',
        isActive: true,
        emailVerified: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      assert.doesNotThrow(() => User.parse(validUser));
    });

    it('validates user without optional fields', () => {
      const minimalUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      assert.doesNotThrow(() => User.parse(minimalUser));
    });

    it('rejects invalid email', () => {
      const invalidUser = {
        id: 'user-123',
        email: 'invalid-email',
        name: 'Test User',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      assert.throws(() => User.parse(invalidUser));
    });
  });

  describe('SafeUser', () => {
    it('omits passwordHash from User', () => {
      const safeUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      const parsed = SafeUser.parse(safeUser);
      assert.strictEqual('passwordHash' in parsed, false);
    });
  });

  describe('RoleInfo', () => {
    it('validates role info', () => {
      const roleInfo = {
        role: 'teacher',
        groupIds: ['group-1', 'group-2'],
      };
      assert.doesNotThrow(() => RoleInfo.parse(roleInfo));
    });

    it('allows empty groupIds', () => {
      const roleInfo = {
        role: 'admin',
        groupIds: [],
      };
      assert.doesNotThrow(() => RoleInfo.parse(roleInfo));
    });
  });

  describe('Role', () => {
    it('validates complete role object', () => {
      const role = {
        id: 'role-123',
        userId: 'user-123',
        role: 'teacher',
        groupIds: ['group-1'],
        createdAt: '2025-01-01T00:00:00Z',
        expiresAt: '2025-12-31T23:59:59Z',
      };
      assert.doesNotThrow(() => Role.parse(role));
    });

    it('allows null expiresAt', () => {
      const role = {
        id: 'role-123',
        userId: 'user-123',
        role: 'admin',
        groupIds: [],
        createdAt: '2025-01-01T00:00:00Z',
        expiresAt: null,
      };
      assert.doesNotThrow(() => Role.parse(role));
    });
  });

  describe('Classroom', () => {
    it('validates complete classroom object', () => {
      const classroom = {
        id: 'classroom-123',
        name: 'room-a',
        displayName: 'Room A',
        defaultGroupId: 'group-default',
        activeGroupId: 'group-active',
        currentGroupId: 'group-current',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      assert.doesNotThrow(() => Classroom.parse(classroom));
    });

    it('allows null group IDs', () => {
      const classroom = {
        id: 'classroom-123',
        name: 'room-b',
        displayName: 'Room B',
        defaultGroupId: null,
        activeGroupId: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      assert.doesNotThrow(() => Classroom.parse(classroom));
    });

    it('allows optional machine count', () => {
      const classroom = {
        id: 'classroom-123',
        name: 'room-c',
        displayName: 'Room C',
        defaultGroupId: null,
        activeGroupId: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        machineCount: 25,
      };
      assert.doesNotThrow(() => Classroom.parse(classroom));
    });
  });

  describe('Machine', () => {
    it('validates complete machine object', () => {
      const machine = {
        id: 'machine-123',
        hostname: 'pc-01',
        classroomId: 'classroom-123',
        version: '4.1.0',
        lastSeen: '2025-01-01T12:00:00Z',
        status: 'online',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T12:00:00Z',
      };
      assert.doesNotThrow(() => Machine.parse(machine));
    });

    it('allows null classroomId and lastSeen', () => {
      const machine = {
        id: 'machine-123',
        hostname: 'pc-02',
        classroomId: null,
        lastSeen: null,
        status: 'unknown',
      };
      assert.doesNotThrow(() => Machine.parse(machine));
    });
  });

  describe('Schedule', () => {
    it('validates complete schedule object', () => {
      const schedule = {
        id: 'schedule-123',
        classroomId: 'classroom-123',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:30',
        groupId: 'group-1',
        teacherId: 'teacher-1',
        recurrence: 'weekly',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      assert.doesNotThrow(() => Schedule.parse(schedule));
    });

    it('validates dayOfWeek range (1-5)', () => {
      [1, 2, 3, 4, 5].forEach((day) => {
        const schedule = {
          id: 'schedule-123',
          classroomId: 'classroom-123',
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '10:30',
          groupId: 'group-1',
          teacherId: 'teacher-1',
          createdAt: '2025-01-01T00:00:00Z',
        };
        assert.doesNotThrow(
          () => Schedule.parse(schedule),
          `Should accept dayOfWeek: ${String(day)}`
        );
      });
    });

    it('rejects invalid dayOfWeek', () => {
      [0, 6, 7, -1, 100].forEach((day) => {
        const schedule = {
          id: 'schedule-123',
          classroomId: 'classroom-123',
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '10:30',
          groupId: 'group-1',
          teacherId: 'teacher-1',
          createdAt: '2025-01-01T00:00:00Z',
        };
        assert.throws(() => Schedule.parse(schedule), `Should reject dayOfWeek: ${String(day)}`);
      });
    });
  });

  describe('OneOffSchedule', () => {
    it('validates complete one-off schedule object', () => {
      const schedule = {
        id: 'schedule-123',
        classroomId: 'classroom-123',
        startAt: '2025-01-01T09:00:00Z',
        endAt: '2025-01-01T10:30:00Z',
        groupId: 'group-1',
        teacherId: 'teacher-1',
        recurrence: 'one_off',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      assert.doesNotThrow(() => OneOffSchedule.parse(schedule));
    });

    it('defaults recurrence to one_off', () => {
      const schedule = {
        id: 'schedule-123',
        classroomId: 'classroom-123',
        startAt: '2025-01-01T09:00:00Z',
        endAt: '2025-01-01T10:30:00Z',
        groupId: 'group-1',
        teacherId: 'teacher-1',
        createdAt: '2025-01-01T00:00:00Z',
      };

      const parsed = OneOffSchedule.parse(schedule);
      assert.equal(parsed.recurrence, 'one_off');
    });
  });

  describe('HealthReport', () => {
    it('validates complete health report', () => {
      const report = {
        id: 'report-123',
        hostname: 'pc-01',
        status: 'HEALTHY',
        dnsmasqRunning: 1,
        dnsResolving: 1,
        failCount: 0,
        actions: null,
        version: '4.1.0',
        reportedAt: '2025-01-01T12:00:00Z',
      };
      assert.doesNotThrow(() => HealthReport.parse(report));
    });

    it('allows minimal health report', () => {
      const report = {
        id: 'report-123',
        hostname: 'pc-01',
        status: 'DEGRADED',
        reportedAt: '2025-01-01T12:00:00Z',
      };
      assert.doesNotThrow(() => HealthReport.parse(report));
    });
  });

  describe('PushSubscription', () => {
    it('validates complete push subscription', () => {
      const subscription = {
        id: 'sub-123',
        userId: 'user-123',
        groupIds: ['group-1', 'group-2'],
        endpoint: 'https://push.example.com/endpoint',
        p256dh: 'base64encodedkey',
        auth: 'base64encodedauth',
        userAgent: 'Mozilla/5.0',
        createdAt: '2025-01-01T00:00:00Z',
      };
      assert.doesNotThrow(() => PushSubscription.parse(subscription));
    });

    it('allows null userAgent', () => {
      const subscription = {
        id: 'sub-123',
        userId: 'user-123',
        groupIds: [],
        endpoint: 'https://push.example.com/endpoint',
        p256dh: 'base64encodedkey',
        auth: 'base64encodedauth',
        userAgent: null,
        createdAt: '2025-01-01T00:00:00Z',
      };
      assert.doesNotThrow(() => PushSubscription.parse(subscription));
    });
  });
});
