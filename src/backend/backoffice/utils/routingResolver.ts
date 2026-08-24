import { HistoryHandler } from '../../db/historyHandler';

const hostRoutingCache = new Map<string, { projectId: string; serviceId: string; expires: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

export const getIdsByHost = async (host: string): Promise<{ projectId: string; serviceId: string } | null> => {
    if (!host) return null;
    const cleanHost = host.split(':')[0].toLowerCase();
    
    // Skip localhost/127.0.0.1 to avoid breaking local dev
    if (cleanHost.includes('localhost') || cleanHost.includes('127.0.0.1')) {
        return null;
    }

    const now = Date.now();
    const cached = hostRoutingCache.get(cleanHost);
    if (cached && cached.expires > now) {
        return { projectId: cached.projectId, serviceId: cached.serviceId };
    }

    try {
        const { data, error } = await HistoryHandler.getSupabase()
            .from('routing_table')
            .select('project_id, service_id')
            .ilike('project_url', `%${cleanHost}%`)
            .maybeSingle();

        if (!error && data) {
            const result = {
                projectId: data.project_id,
                serviceId: data.service_id,
                expires: now + CACHE_TTL_MS
            };
            hostRoutingCache.set(cleanHost, result);
            return { projectId: result.projectId, serviceId: result.serviceId };
        }
    } catch (e: any) {
        console.error('[HostRouting] Error resolving host:', cleanHost, e?.message || e);
    }

    return null;
};
