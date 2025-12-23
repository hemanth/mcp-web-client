'use client';

import { useSession, signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import Image from "next/image";

export function UserMenu() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <div className="w-8 h-8 rounded-full bg-[var(--background-tertiary)] animate-pulse" />
        );
    }

    if (!session?.user) {
        return null;
    }

    return (
        <div className="flex items-center gap-2">
            {session.user.image ? (
                <Image
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    width={32}
                    height={32}
                    className="rounded-full"
                />
            ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                </div>
            )}
            <button
                onClick={() => signOut()}
                className="p-2 rounded-lg hover:bg-[var(--background-tertiary)] transition-colors"
                title="Sign out"
            >
                <LogOut className="w-4 h-4 text-[var(--foreground-muted)]" />
            </button>
        </div>
    );
}
