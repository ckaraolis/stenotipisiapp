/**
 * Vercel serverless entry — wraps the Express app and surfaces boot errors.
 */
export default async function handler(req, res) {
  try {
    const mod = await import('../server/index.js');
    const app = mod.default;
    return app(req, res);
  } catch (error) {
    console.error('[api] Fatal handler error:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'API failed to start.',
          detail: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
