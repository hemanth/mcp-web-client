export interface OrchestratorContext {
    callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    log: (...args: unknown[]) => void;
}

const EXECUTION_TIMEOUT_MS = 30_000;
const MAX_TOOL_CALLS = 50;

// Blocked globals that the sandboxed code must not access
const BLOCKED_GLOBALS = [
    'window', 'document', 'location', 'navigator', 'localStorage',
    'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest',
    'WebSocket', 'Worker', 'SharedWorker', 'importScripts',
    'eval', 'Function', 'opener', 'parent', 'top', 'frames',
    'crypto', 'caches', 'cookieStore',
];

/**
 * Executes orchestration code in a sandboxed environment.
 * Blocks access to browser globals and enforces execution limits.
 * The code can use `mcp.callTool(name, args)` and `mcp.log(...)`.
 */
export async function executeOrchestration(
    code: string,
    context: OrchestratorContext
): Promise<{ stdout: string; error?: string }> {
    const logs: string[] = [];
    let toolCallCount = 0;

    const mcp = {
        callTool: async (name: string, args: Record<string, unknown>) => {
            toolCallCount++;
            if (toolCallCount > MAX_TOOL_CALLS) {
                throw new Error(`Tool call limit exceeded (max ${MAX_TOOL_CALLS})`);
            }
            // Validate tool name is a simple identifier
            if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)) {
                throw new Error(`Invalid tool name: ${name}`);
            }
            return context.callTool(name, args);
        },
        log: (...args: unknown[]) => {
            const formattedLog = args.map(a =>
                typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
            ).join(' ');
            logs.push(formattedLog);
            context.log(...args);
        }
    };

    try {
        // Build shadow bindings that mask dangerous globals with undefined
        const shadowBindings = BLOCKED_GLOBALS.map(g => `${g} = undefined`).join(', ');

        // Create a sandboxed async function with blocked globals
        const fn = new Function('mcp', `
            return (async () => {
                "use strict";
                let ${shadowBindings};
                ${code}
            })();
        `);

        // Execute with a timeout
        await Promise.race([
            fn(mcp),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Execution timed out after ${EXECUTION_TIMEOUT_MS / 1000}s`)), EXECUTION_TIMEOUT_MS)
            ),
        ]);

        return {
            stdout: logs.join('\n')
        };
    } catch (err) {
        return {
            stdout: logs.join('\n'),
            error: err instanceof Error ? err.message : String(err)
        };
    }
}
