import { battle } from './battle.js';
import { rulesPage } from './rules-page.js';
import { admin } from './admin.js';
import { testPage } from './test-page.js';
import { onRequestPost } from './functions/api/results.js';
import { onRequestGet } from './functions/api/health.js';

const html = {'Content-Type': 'text/html; charset=utf-8'};
const missing = () => new Response('Not found', {status: 404});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const {pathname: path} = url;
    const read = request.method === 'GET' || request.method === 'HEAD';
    const practice = env.ENABLE_PRACTICE === 'true';
    if (read && (path === '/rules' || path === '/rules/')) {
      return new Response(request.method === 'HEAD' ? null : rulesPage, {headers: html});
    }
    if (path === '/api/battle') return battle(request, env);
    if (path === '/admin' || path.startsWith('/admin/')) return admin(request, env);
    if (path === '/api/health' && request.method === 'GET') return onRequestGet({request, env});
    if (practice && path === '/api/results' && request.method === 'POST') return onRequestPost({request, env});
    if (practice && path === '/test' && request.method === 'GET') {
      return new Response(testPage, {headers: {...html, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex'}});
    }
    if (practice && path === '/api/test-count' && request.method === 'GET') {
      const code = url.searchParams.get('code') || '';
      if (!/^TEST-[0-9a-f-]{36}$/i.test(code)) return new Response('Invalid code', {status: 400});
      try {
        const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM fight_results WHERE competition='pie' AND fight_code=? AND red_fighter='TEST Red' AND white_fighter='TEST White'").bind(code).first();
        return Response.json({count: row.count}, {headers: {'Cache-Control': 'no-store'}});
      } catch {
        return Response.json({error: 'Database unavailable'}, {status: 503});
      }
    }
    if (read && (path === '/' || path === '/arena')) {
      return Response.redirect(new URL('/arena/' + url.search, url), 302);
    }
    if (read && (path === '/arena/' || path.startsWith('/arena/') || path.startsWith('/images/'))) {
      if (path === '/arena/') {
        const response = await env.ASSETS.fetch(request);
        const headers = new Headers(response.headers);
        headers.set('Referrer-Policy', 'no-referrer');
        headers.set('X-Robots-Tag', 'noindex');
        return new Response(response.body, {status: response.status, headers});
      }
      return env.ASSETS.fetch(request);
    }
    return missing();
  }
};
