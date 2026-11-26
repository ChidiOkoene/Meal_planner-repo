import { timingSafeEqual } from 'node:crypto';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { type QueueSet, QUEUES } from '@dyjext/jobs';
import Fastify, { type FastifyInstance } from 'fastify';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Queue dashboard (Bull Board) for inspecting and retrying jobs. Protected by HTTP basic auth
 * and bound to localhost by default; in production it sits behind the platform's private
 * network. Replaced by staff sign-in once issue #8 lands.
 */
export async function startDashboard(
  queues: QueueSet,
  options: { host: string; port: number; user: string; password: string },
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const expected = `Basic ${Buffer.from(`${options.user}:${options.password}`).toString('base64')}`;
  app.addHook('onRequest', async (request, reply) => {
    if (!safeEqual(request.headers.authorization ?? '', expected)) {
      await reply
        .header('www-authenticate', 'Basic realm="queues"')
        .code(401)
        .send('Authentication required');
    }
  });

  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath('/queues');
  createBullBoard({
    queues: Object.values(QUEUES).map((name) => new BullMQAdapter(queues[name])),
    serverAdapter,
  });
  await app.register(serverAdapter.registerPlugin(), { prefix: '/queues' });
  await app.listen({ host: options.host, port: options.port });
  return app;
}
