'use client';

import { signIn } from "next-auth/react";
import { Github } from "lucide-react";

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
            <div className="max-w-md w-full p-8 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                        MCPHost
                    </h1>
                    <p className="text-[var(--foreground-muted)]">
                        Sign in to sync your MCP servers across devices
                    </p>
                </div>

                <button
                    onClick={() => signIn("github", { callbackUrl: "/" })}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-[#24292e] text-white font-medium hover:bg-[#2f363d] transition-colors"
                >
                    <Github className="w-5 h-5" />
                    Continue with GitHub
                </button>

                <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">
                    Your server configurations will be saved securely
                </p>
            </div>
        </div>
    );
}
