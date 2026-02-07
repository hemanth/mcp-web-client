export const runtime = "edge";

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// D1 REST API for server configs
const D1_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const D1_DATABASE_ID = process.env.CF_D1_DATABASE_ID;
const D1_API_TOKEN = process.env.CF_API_TOKEN;

async function queryD1(sql: string, params: unknown[] = []) {
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${D1_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ sql, params }),
        }
    );
    return response.json();
}

// GET user's servers
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await queryD1(
        "SELECT * FROM mcp_servers WHERE userId = ? ORDER BY createdAt DESC",
        [session.user.id]
    );

    return NextResponse.json({ servers: result.result?.[0]?.results || [] });
}

// POST - save a server
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, url, authType, authConfig } = body;

    const result = await queryD1(
        `INSERT INTO mcp_servers (id, userId, name, url, authType, authConfig, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET name=?, url=?, authType=?, authConfig=?, updatedAt=datetime('now')`,
        [id, session.user.id, name, url, authType, JSON.stringify(authConfig), name, url, authType, JSON.stringify(authConfig)]
    );

    return NextResponse.json({ success: true, result });
}

// DELETE - remove a server
export async function DELETE(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Server ID required" }, { status: 400 });
    }

    console.log("[DELETE /api/servers] serverId:", id, "userId:", session.user.id);

    const result = await queryD1(
        "DELETE FROM mcp_servers WHERE id = ? AND userId = ?",
        [id, session.user.id]
    );

    console.log("[DELETE /api/servers] result:", JSON.stringify(result));

    return NextResponse.json({ success: true, deleted: result });
}
