import { getServerSession } from "@/features/auth/actions";
import { getUserInstallationId } from "@/features/github/server/installation";
import { getInstallationReposPage } from "@/features/github/server/repos";
import { getRepoSyncStatuses } from "@/features/repo-sync/server/repo-sync";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const session = await getServerSession();

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const installationId = await getUserInstallationId(session.user.id);

    if (!installationId) {
        return NextResponse.json({ error: "GitHub App not connected" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);

    const parsedPage = Number(searchParams.get("page") ?? "1");
    const page = Number.isFinite(parsedPage) ? Math.max(1, Math.trunc(parsedPage)) : 1;

    let data;
    try {
        data = await getInstallationReposPage(installationId, page);
    } catch (error) {
        // The GitHub API can be briefly unreachable or rate-limit the
        // installation — return JSON the client can surface instead of a 500.
        console.error("[github/repos] Failed to fetch repositories:", error);
        return NextResponse.json(
            { error: "Failed to load repositories from GitHub" },
            { status: 502 }
        );
    }

    const repoFullNames = data.repos.map((repo) => repo.fullName);

    const syncStatuses = await getRepoSyncStatuses(repoFullNames);

    const repos = data.repos.map((repo) => ({
        ...repo,
        syncStatus: syncStatuses[repo.fullName] ?? null
    }));


    return NextResponse.json({ ...data, repos })
}
