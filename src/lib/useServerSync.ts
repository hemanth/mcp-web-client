'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface SyncedServer {
    id: string;
    name: string;
    url: string;
    authType?: string;
    authConfig?: Record<string, unknown>;
}

interface UseServerSyncOptions {
    onServersLoaded?: (servers: SyncedServer[]) => void;
}

export function useServerSync(options: UseServerSyncOptions = {}) {
    const { data: session, status } = useSession();
    const hasSyncedRef = useRef(false);

    // Fetch servers from D1 when user logs in
    const fetchServers = useCallback(async (): Promise<SyncedServer[]> => {
        if (status !== 'authenticated' || !session?.user) {
            return [];
        }

        try {
            const response = await fetch('/api/servers');
            if (!response.ok) {
                console.error('Failed to fetch servers:', response.statusText);
                return [];
            }
            const data = await response.json();
            return data.servers || [];
        } catch (error) {
            console.error('Error fetching servers:', error);
            return [];
        }
    }, [session, status]);

    // Save a server to D1
    const saveServer = useCallback(async (server: SyncedServer): Promise<boolean> => {
        if (status !== 'authenticated' || !session?.user) {
            return false;
        }

        try {
            const response = await fetch('/api/servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: server.id,
                    name: server.name,
                    url: server.url,
                    authType: server.authType || 'none',
                    authConfig: server.authConfig || {},
                }),
            });
            return response.ok;
        } catch (error) {
            console.error('Error saving server:', error);
            return false;
        }
    }, [session, status]);

    // Delete a server from D1
    const deleteServer = useCallback(async (serverId: string): Promise<boolean> => {
        if (status !== 'authenticated' || !session?.user) {
            return false;
        }

        try {
            const response = await fetch(`/api/servers?id=${serverId}`, {
                method: 'DELETE',
            });
            return response.ok;
        } catch (error) {
            console.error('Error deleting server:', error);
            return false;
        }
    }, [session, status]);

    // Sync all servers (save multiple)
    const syncServers = useCallback(async (servers: SyncedServer[]): Promise<boolean> => {
        if (status !== 'authenticated' || !session?.user) {
            return false;
        }

        try {
            // Save each server
            await Promise.all(servers.map(server => saveServer(server)));
            return true;
        } catch (error) {
            console.error('Error syncing servers:', error);
            return false;
        }
    }, [session, status, saveServer]);

    // Load servers when authenticated
    useEffect(() => {
        if (status === 'authenticated' && !hasSyncedRef.current) {
            hasSyncedRef.current = true;
            fetchServers().then(servers => {
                if (servers.length > 0) {
                    options.onServersLoaded?.(servers);
                }
            });
        }

        // Reset when logged out
        if (status === 'unauthenticated') {
            hasSyncedRef.current = false;
        }
    }, [status, fetchServers, options]);

    return {
        isAuthenticated: status === 'authenticated',
        isLoading: status === 'loading',
        fetchServers,
        saveServer,
        deleteServer,
        syncServers,
    };
}
