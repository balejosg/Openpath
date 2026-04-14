import { after, before, describe, test } from 'node:test';
import assert from 'node:assert';

import {
  type ClassroomsTestHarness,
  startClassroomsTestHarness,
  uniqueClassroomName,
} from './classrooms-test-harness.js';
import { assertStatus, bearerAuth, parseTRPC } from './test-utils.js';

let harness: ClassroomsTestHarness | undefined;

function getHarness(): ClassroomsTestHarness {
  assert.ok(harness, 'Classrooms harness should be initialized');
  return harness;
}

void describe('Classroom management - CRUD', () => {
  before(async () => {
    harness = await startClassroomsTestHarness();
  });

  after(async () => {
    await harness?.close();
    harness = undefined;
  });

  void test('classrooms.create creates a new classroom', async (): Promise<void> => {
    const name = uniqueClassroomName('informatica');
    const response = await getHarness().trpcMutate(
      'classrooms.create',
      {
        name,
        displayName: 'Aula de Informatica 3',
        defaultGroupId: getHarness().cienciasGroupId,
      },
      bearerAuth(getHarness().adminToken)
    );

    assertStatus(response, 200);
    const payload = (await parseTRPC(response)) as {
      data?: { defaultGroupId?: string; displayName?: string; name?: string };
    };
    const data = payload.data;
    assert.ok(data, 'Expected classroom payload');
    assert.strictEqual(data.name, name);
    assert.strictEqual(data.displayName, 'Aula de Informatica 3');
    assert.strictEqual(data.defaultGroupId, getHarness().cienciasGroupId);
  });

  void test('classrooms.list and classrooms.get return created classrooms', async (): Promise<void> => {
    const created = await getHarness().createClassroom({
      displayName: 'Aula de Ciencias',
      name: uniqueClassroomName('ciencias'),
    });

    const classrooms = await getHarness().getClassrooms();
    assert.ok(classrooms.some((entry) => entry.id === created.id));

    const response = await getHarness().trpcQuery(
      'classrooms.get',
      { id: created.id },
      bearerAuth(getHarness().adminToken)
    );
    assertStatus(response, 200);
    const payload = (await parseTRPC(response)) as { data?: { id?: string; machines?: unknown[] } };
    const data = payload.data;
    assert.ok(data, 'Expected classroom get payload');
    assert.strictEqual(data.id, created.id);
    assert.ok(Array.isArray(data.machines));
  });

  void test('classrooms.setActiveGroup updates the active group', async (): Promise<void> => {
    const created = await getHarness().createClassroom({
      name: uniqueClassroomName('lengua-room'),
    });

    const updateResponse = await getHarness().trpcMutate(
      'classrooms.setActiveGroup',
      {
        id: created.id,
        groupId: getHarness().lenguaGroupId,
      },
      bearerAuth(getHarness().adminToken)
    );
    assertStatus(updateResponse, 200);

    const getResponse = await getHarness().trpcQuery(
      'classrooms.get',
      { id: created.id },
      bearerAuth(getHarness().adminToken)
    );
    assertStatus(getResponse, 200);
    const payload = (await parseTRPC(getResponse)) as { data?: { currentGroupId?: string } };
    assert.strictEqual(payload.data?.currentGroupId, getHarness().lenguaGroupId);
  });
});
