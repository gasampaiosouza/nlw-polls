import fastify from 'fastify';

import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';

import { getPoll } from './routes/get-poll';
import { createPoll } from './routes/create-poll';
import { voteOnPoll } from './routes/vote-on-poll';
import { pollResults } from './ws/poll-results';

const server = fastify();

server.register(cookie, {
  secret: '2e47c4d467684947a7c04c5dca4c13e5',
  hook: 'onRequest',
});

server.register(websocket);

server.register(getPoll);
server.register(createPoll);
server.register(voteOnPoll);
server.register(pollResults);

server.listen({ port: 3333 }).then(() => {
  console.log('Server is running on port 3333');
});
