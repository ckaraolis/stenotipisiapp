/**
 * Vercel serverless entry — wraps the Express app and surfaces boot errors.
 * Awaits pending Supabase writes after the response so deletes/creates are not lost
 * when the isolate freezes.
 */
export default async function handler(req, res) {
  try {
    const mod = await import('../server/index.js');
    const app = mod.default;
    const { flushPendingWrites } = await import('../server/collectionStore.js');

    await new Promise((resolve, reject) => {
      const onDone = () => resolve();
      res.on('finish', onDone);
      res.on('close', onDone);
      try {
        app(req, res);
      } catch (error) {
        reject(error);
      }
    });

    try {
      await flushPendingWrites();
    } catch (error) {
      console.error('[api] Failed to flush pending writes:', error);
    }
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
