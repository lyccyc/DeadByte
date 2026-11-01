/**
 * Cache lifetime for failed backend reads: refreshed in the background after
 * 15 s, while staying prerenderable (Cache Components treats `expire` < 5 min
 * or `stale` < 30 s as request-time "dynamic holes").
 */
export const RETRY_SOON = { stale: 30, revalidate: 15, expire: 300 } as const;
