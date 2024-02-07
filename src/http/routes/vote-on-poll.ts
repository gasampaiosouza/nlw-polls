import { z } from 'zod';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { randomUUID } from 'crypto';
import { redis } from '../../lib/redis';
import { voting } from '../../utils/voting-pub-sub';

export async function voteOnPoll(server: FastifyInstance) {
  server.post('/polls/:pollId/votes', async (request, reply) => {
    const voteOnPollBody = z.object({ pollOptionId: z.string().uuid() });
    const voteOnPollParams = z.object({ pollId: z.string().uuid() });

    const { pollOptionId } = voteOnPollBody.parse(request.body);
    const { pollId } = voteOnPollParams.parse(request.params);

    let { sessionId } = request.cookies;

    if (sessionId) {
      const userPreviousVotedOnPoll = await prisma.vote.findUnique({
        where: { sessionId_pollId: { sessionId, pollId } },
      });

      if (
        userPreviousVotedOnPoll &&
        userPreviousVotedOnPoll.pollOptionId !== pollOptionId
      ) {
        // apagar voto anterior e criar um novo
        await prisma.vote.delete({
          where: { id: userPreviousVotedOnPoll.id },
        });

        const votes = await redis.zincrby(
          pollId,
          -1,
          userPreviousVotedOnPoll.pollOptionId
        );

        voting.publish(pollId, {
          pollOptionId: userPreviousVotedOnPoll.pollOptionId,
          votes: Number(votes),
        });
      } else if (userPreviousVotedOnPoll) {
        const message = 'You already voted on this poll.';

        return reply.status(400).send({ message });
      }
    }

    if (!sessionId) {
      sessionId = randomUUID();

      reply.setCookie('sessionId', sessionId, {
        path: '/',
        signed: true,
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    await prisma.vote.create({
      data: { sessionId, pollId, pollOptionId },
    });

    const votes = await redis.zincrby(pollId, 1, pollOptionId);

    voting.publish(pollId, { pollOptionId, votes: Number(votes) });

    return reply.status(201).send();
  });
}
