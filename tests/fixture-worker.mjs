import app from '../worker.js';

export default {
  async fetch(request, env) {
    // This admin binding exists only in the test runtime, never in worker.js or Wrangler.
    if (new URL(request.url).pathname !== '/__local-test-sql') return app.fetch(request, env);
    if (request.method !== 'POST' || request.headers.get('X-Test-Token') !== env.LOCAL_TEST_TOKEN) {
      return new Response('Not found', {status: 404});
    }
    try {
      const queries = await request.json();
      return Response.json(await env.DB.batch(queries.map(({sql, args}) => env.DB.prepare(sql).bind(...args))));
    } catch (error) {
      return Response.json({error: error.message}, {status: 400});
    }
  }
};
