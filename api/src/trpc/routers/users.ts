import { z } from 'zod';
import { router, adminProcedure } from '../trpc.js';
import { UserRoleSchema, CreateUserDTOSchema } from '../../types/index.js';
import { TRPCError } from '@trpc/server';
import UserService from '../../services/user.service.js';

export const usersRouter = router({
  list: adminProcedure.query(async () => {
    return await UserService.listUsers();
  }),

  get: adminProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const result = await UserService.getUser(input.id);
    if (!result.ok) {
      throw new TRPCError({ code: result.error.code, message: result.error.message });
    }
    return result.data;
  }),

  create: adminProcedure
    .input(
      CreateUserDTOSchema.extend({
        role: UserRoleSchema.optional(),
        groupIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await UserService.createManagedUser(input, input.role, input.groupIds ?? []);
      if (!result.ok) {
        throw new TRPCError({ code: result.error.code, message: result.error.message });
      }
      return result.data;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        email: z.email().optional(),
        active: z.boolean().optional(),
        password: z.string().min(8).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const result = await UserService.updateManagedUser(id, updates);
      if (!result.ok) {
        throw new TRPCError({ code: result.error.code, message: result.error.message });
      }
      return result.data;
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const result = await UserService.deleteManagedUser(ctx.user.sub, input.id);
    if (!result.ok) {
      throw new TRPCError({ code: result.error.code, message: result.error.message });
    }
    return result.data;
  }),

  // Role management
  assignRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: UserRoleSchema,
        groupIds: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ input }) => {
      const result = await UserService.assignRole(input.userId, input.role, input.groupIds);
      if (!result.ok) {
        throw new TRPCError({ code: result.error.code, message: result.error.message });
      }
      return result.data;
    }),

  revokeRole: adminProcedure
    .input(z.object({ userId: z.string(), roleId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await UserService.revokeRole(input.roleId);
      if (!result.ok) {
        throw new TRPCError({ code: result.error.code, message: result.error.message });
      }
      return result.data;
    }),

  listTeachers: adminProcedure.query(async () => await UserService.listTeachers()),
});
