import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  CreateClassroomDTO,
  CreateOneOffScheduleDTO,
  CreatePushSubscriptionDTO,
  CreateRequestDTO,
  CreateScheduleDTO,
  CreateUserDTO,
  LoginDTO,
  UpdateOneOffScheduleDTO,
  UpdateRequestStatusDTO,
} from '../src/schemas/index.js';

describe('DTO Schemas', () => {
  describe('CreateRequestDTO', () => {
    it('accepts minimal valid input', () => {
      assert.doesNotThrow(() => CreateRequestDTO.parse({ domain: 'example.com' }));
    });

    it('accepts full valid input', () => {
      const full = {
        domain: 'example.com',
        reason: 'Need for research',
        requesterEmail: 'user@school.edu',
        groupId: 'class-a',
      };
      assert.doesNotThrow(() => CreateRequestDTO.parse(full));
    });

    it('rejects invalid email', () => {
      assert.throws(() =>
        CreateRequestDTO.parse({
          domain: 'example.com',
          requesterEmail: 'not-an-email',
        })
      );
    });

    it('rejects invalid domain', () => {
      assert.throws(() => CreateRequestDTO.parse({ domain: 'bad' }));
    });
  });

  describe('UpdateRequestStatusDTO', () => {
    it('accepts approved status', () => {
      assert.doesNotThrow(() => UpdateRequestStatusDTO.parse({ status: 'approved' }));
    });

    it('accepts rejected status with note', () => {
      const dto = {
        status: 'rejected',
        note: 'Domain not appropriate for educational use',
      };
      assert.doesNotThrow(() => UpdateRequestStatusDTO.parse(dto));
    });

    it('rejects pending status', () => {
      assert.throws(() => UpdateRequestStatusDTO.parse({ status: 'pending' }));
    });
  });

  describe('CreateUserDTO', () => {
    it('validates password minimum length (8 chars)', () => {
      assert.throws(() =>
        CreateUserDTO.parse({
          email: 'test@example.com',
          name: 'Test User',
          password: 'short',
        })
      );
    });

    it('validates password maximum length (128 chars)', () => {
      assert.throws(() =>
        CreateUserDTO.parse({
          email: 'test@example.com',
          name: 'Test User',
          password: 'a'.repeat(129),
        })
      );
    });

    it('accepts valid user creation data', () => {
      const dto = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'Securepassword123',
      };
      assert.doesNotThrow(() => CreateUserDTO.parse(dto));
    });

    it('requires non-empty name', () => {
      assert.throws(() =>
        CreateUserDTO.parse({
          email: 'test@example.com',
          name: '',
          password: 'Securepassword123',
        })
      );
    });

    it('rejects invalid email', () => {
      assert.throws(() =>
        CreateUserDTO.parse({
          email: 'invalid',
          name: 'Test User',
          password: 'Securepassword123',
        })
      );
    });
  });

  describe('LoginDTO', () => {
    it('requires valid email and password', () => {
      assert.doesNotThrow(() =>
        LoginDTO.parse({
          email: 'user@example.com',
          password: 'password123',
        })
      );
    });

    it('rejects short password', () => {
      assert.throws(() =>
        LoginDTO.parse({
          email: 'user@example.com',
          password: 'short',
        })
      );
    });

    it('rejects invalid email', () => {
      assert.throws(() =>
        LoginDTO.parse({
          email: 'not-email',
          password: 'password123',
        })
      );
    });
  });

  describe('CreateClassroomDTO', () => {
    it('accepts minimal classroom data', () => {
      assert.doesNotThrow(() => CreateClassroomDTO.parse({ name: 'room-a' }));
    });

    it('accepts full classroom data', () => {
      assert.doesNotThrow(() =>
        CreateClassroomDTO.parse({
          name: 'room-a',
          displayName: 'Room A - Computer Lab',
        })
      );
    });

    it('requires non-empty name', () => {
      assert.throws(() => CreateClassroomDTO.parse({ name: '' }));
    });
  });

  describe('CreateScheduleDTO', () => {
    it('accepts valid schedule data', () => {
      const dto = {
        classroomId: 'classroom-123',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:30',
        groupId: 'group-1',
        teacherId: 'teacher-1',
      };
      assert.doesNotThrow(() => CreateScheduleDTO.parse(dto));
    });

    it('accepts optional recurrence', () => {
      const dto = {
        classroomId: 'classroom-123',
        dayOfWeek: 3,
        startTime: '14:00',
        endTime: '15:30',
        groupId: 'group-2',
        teacherId: 'teacher-2',
        recurrence: 'biweekly',
      };
      assert.doesNotThrow(() => CreateScheduleDTO.parse(dto));
    });

    it('validates dayOfWeek range', () => {
      assert.throws(() =>
        CreateScheduleDTO.parse({
          classroomId: 'classroom-123',
          dayOfWeek: 0,
          startTime: '09:00',
          endTime: '10:30',
          groupId: 'group-1',
          teacherId: 'teacher-1',
        })
      );
      assert.throws(() =>
        CreateScheduleDTO.parse({
          classroomId: 'classroom-123',
          dayOfWeek: 6,
          startTime: '09:00',
          endTime: '10:30',
          groupId: 'group-1',
          teacherId: 'teacher-1',
        })
      );
    });
  });

  describe('CreateOneOffScheduleDTO', () => {
    it('accepts valid one-off schedule data', () => {
      const dto = {
        classroomId: 'classroom-123',
        startAt: '2025-01-01T09:00:00Z',
        endAt: '2025-01-01T10:30:00Z',
        groupId: 'group-1',
        teacherId: 'teacher-1',
      };
      assert.doesNotThrow(() => CreateOneOffScheduleDTO.parse(dto));
    });

    it('accepts optional recurrence when set to one_off', () => {
      const dto = {
        classroomId: 'classroom-123',
        startAt: '2025-01-01T09:00:00Z',
        endAt: '2025-01-01T10:30:00Z',
        groupId: 'group-1',
        teacherId: 'teacher-1',
        recurrence: 'one_off',
      };
      assert.doesNotThrow(() => CreateOneOffScheduleDTO.parse(dto));
    });

    it('rejects invalid recurrence', () => {
      assert.throws(() =>
        CreateOneOffScheduleDTO.parse({
          classroomId: 'classroom-123',
          startAt: '2025-01-01T09:00:00Z',
          endAt: '2025-01-01T10:30:00Z',
          groupId: 'group-1',
          teacherId: 'teacher-1',
          recurrence: 'weekly',
        })
      );
    });
  });

  describe('UpdateOneOffScheduleDTO', () => {
    it('accepts minimal update payload', () => {
      assert.doesNotThrow(() => UpdateOneOffScheduleDTO.parse({ id: 'schedule-123' }));
    });

    it('rejects empty groupId', () => {
      assert.throws(() =>
        UpdateOneOffScheduleDTO.parse({
          id: 'schedule-123',
          groupId: '',
        })
      );
    });
  });

  describe('CreatePushSubscriptionDTO', () => {
    it('accepts valid push subscription data', () => {
      const dto = {
        endpoint: 'https://push.example.com/endpoint/abc123',
        keys: {
          p256dh:
            'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-T1asjH1QQiLmsIFlmTMD',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
      };
      assert.doesNotThrow(() => CreatePushSubscriptionDTO.parse(dto));
    });

    it('accepts optional userAgent', () => {
      const dto = {
        endpoint: 'https://push.example.com/endpoint/abc123',
        keys: {
          p256dh:
            'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-T1asjH1QQiLmsIFlmTMD',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/115.0',
      };
      assert.doesNotThrow(() => CreatePushSubscriptionDTO.parse(dto));
    });

    it('requires keys object', () => {
      assert.throws(() =>
        CreatePushSubscriptionDTO.parse({
          endpoint: 'https://push.example.com/endpoint/abc123',
        })
      );
    });

    it('requires p256dh and auth in keys', () => {
      assert.throws(() =>
        CreatePushSubscriptionDTO.parse({
          endpoint: 'https://push.example.com/endpoint/abc123',
          keys: {
            p256dh:
              'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-T1asjH1QQiLmsIFlmTMD',
          },
        })
      );
      assert.throws(() =>
        CreatePushSubscriptionDTO.parse({
          endpoint: 'https://push.example.com/endpoint/abc123',
          keys: {
            auth: 'tBHItJI5svbpez7KI4CCXg',
          },
        })
      );
    });
  });
});
