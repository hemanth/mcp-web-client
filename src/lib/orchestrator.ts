import { ToolCall } from './llm-types';

export interface OrchestratorContext {
    callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    log: (...args: unknown[]) => void;
}

/**
 * Executes orchestration code in a controlled environment.
 * The code can use `mcp.callTool(name, args)` and `mcp.log(...)`.
 */
export async function executeOrchestration(
    code: string,
    context: OrchestratorContext
): Promise<{ stdout: string; error?: string }> {
    const logs: string[] = [];

    const mcp = {
        callTool: context.callTool,
        log: (...args: unknown[]) => {
            const formattedLog = args.map(a =>
                typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
            ).join(' ');
            logs.push(formattedLog);
            context.log(...args);
        }
    };

    try {
        // Create an async function from the code
        // We wrap it to provide the 'mcp' object
        const fn = new Function('mcp', `
      return (async () => {
        ${code}
      })();
    `);

        await fn(mcp);

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
