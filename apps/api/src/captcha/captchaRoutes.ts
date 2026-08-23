import { captchaAnswerInputSchema } from "@canmedseg/shared";
import type { FastifyPluginAsync } from "fastify";

import { pool } from "../database/pool";
import {
  CaptchaError,
  createChallenge,
  purgeExpiredChallenges,
  solveChallenge,
} from "./captchaRepository";

/**
 * CAPTCHA del envío sin sesión (RF-3.6). Las rutas son públicas por definición:
 * quien las usa todavía no tiene sesión. Los usuarios logueados no lo necesitan.
 */
export const captchaRoutes: FastifyPluginAsync = async (app) => {
  app.post("/captcha/challenge", async (request, reply) => {
    await purgeExpiredChallenges(pool);
    const challenge = await createChallenge(pool, { ipAddress: request.ip });
    return reply.code(201).send(challenge);
  });

  app.post("/captcha/verify", async (request, reply) => {
    const input = captchaAnswerInputSchema.parse(request.body);
    try {
      return reply.send(await solveChallenge(pool, input.challengeId, input.answer));
    } catch (error) {
      if (error instanceof CaptchaError) {
        return reply.code(400).send({ message: error.message, reason: error.reason });
      }
      throw error;
    }
  });
};
