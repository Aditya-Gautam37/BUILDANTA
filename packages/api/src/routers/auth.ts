import {
  createSessionToken,
  fakeVerifyPassword,
  hashPassword,
  hashSessionToken,
  sessionExpiry,
  verifyPassword,
} from "@buildanta/auth";
import { TRPCError } from "@trpc/server";

import { consume, reset } from "../rate-limit.js";
import { changePasswordInput, loginInput } from "../schemas.js";
import { adminProcedure, publicProcedure, router } from "../trpc.js";

/** Five attempts per email and per IP, per fifteen minutes. */
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * One message for every failure mode. "No such account" and "wrong password" must
 * be indistinguishable, or the login form becomes a way to enumerate staff email
 * addresses.
 */
const INVALID_CREDENTIALS = new TRPCError({
  code: "UNAUTHORIZED",
  message: "Incorrect email or password.",
});

export const authRouter = router({
  login: publicProcedure.input(loginInput).mutation(async ({ ctx, input }) => {
    const ip = ctx.request.ipAddress ?? "unknown";

    // Limited per IP and per email: per-IP alone lets a botnet spray one account,
    // per-email alone lets one host try every account it knows.
    for (const key of [`login:ip:${ip}`, `login:email:${input.email}`]) {
      const { allowed, retryAfterSeconds } = consume(
        key,
        LOGIN_LIMIT,
        LOGIN_WINDOW_MS,
      );
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many sign-in attempts. Try again in ${Math.ceil(
            retryAfterSeconds / 60,
          )} minute(s).`,
        });
      }
    }

    const user = await ctx.prisma.adminUser.findUnique({
      where: { email: input.email },
    });

    if (!user || !user.isActive) {
      // Spend the same time as a real verification so response latency does not
      // reveal whether the account exists.
      await fakeVerifyPassword(input.password);
      throw INVALID_CREDENTIALS;
    }

    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw INVALID_CREDENTIALS;
    }

    const token = createSessionToken();
    const expiresAt = sessionExpiry();

    await ctx.prisma.$transaction([
      ctx.prisma.adminSession.create({
        data: {
          tokenHash: hashSessionToken(token),
          adminUserId: user.id,
          expiresAt,
          ipAddress: ctx.request.ipAddress,
          userAgent: ctx.request.userAgent?.slice(0, 500) ?? null,
        },
      }),
      ctx.prisma.adminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      // Housekeeping: Release 1 has no scheduled jobs, so expired rows are cleared
      // on the one action guaranteed to happen regularly.
      ctx.prisma.adminSession.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      }),
    ]);

    ctx.cookies.set(token, expiresAt);
    reset(`login:email:${input.email}`);
    reset(`login:ip:${ip}`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    // Deleting the row is what actually ends the session; clearing the cookie is
    // cosmetic, and a stolen token must stop working server-side.
    if (ctx.admin) {
      await ctx.prisma.adminSession.delete({
        where: { id: ctx.admin.sessionId },
      });
    }
    ctx.cookies.clear();
    return { success: true };
  }),

  /** Null rather than an error when signed out, so the admin shell can branch. */
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.admin) return null;
    return {
      id: ctx.admin.id,
      email: ctx.admin.email,
      name: ctx.admin.name,
      role: ctx.admin.role,
    };
  }),

  changePassword: adminProcedure
    .input(changePasswordInput)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.adminUser.findUniqueOrThrow({
        where: { id: ctx.admin.id },
      });

      if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Your current password is incorrect.",
        });
      }

      const passwordHash = await hashPassword(input.newPassword);

      // Every other session is revoked: a password change is how someone responds
      // to a suspected compromise, so it has to log out the attacker too.
      await ctx.prisma.$transaction([
        ctx.prisma.adminUser.update({
          where: { id: user.id },
          data: { passwordHash },
        }),
        ctx.prisma.adminSession.deleteMany({
          where: { adminUserId: user.id, id: { not: ctx.admin.sessionId } },
        }),
      ]);

      return { success: true };
    }),
});
