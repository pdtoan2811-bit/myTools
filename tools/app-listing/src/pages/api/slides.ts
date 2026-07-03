import type { APIRoute } from 'astro';
import { SLIDES } from '../../lib/slides';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(JSON.stringify(SLIDES), {
    headers: { 'content-type': 'application/json' },
  });
