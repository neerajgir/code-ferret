import {App} from "octokit";

let githubApp: App | null = null;

export function getGithubApp(){
    if(!githubApp){
        githubApp = new App({
            appId: process.env.GITHUB_APP_ID!,
            privateKey: process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, "\n"),
            webhooks: {
                secret:process.env.GITHUB_WEBHOOK_SECRET!
            }
        })
    }
    return githubApp;
}

export function getGithubInstallUrl(userId:string) {
    const appName = process.env.GITHUB_APP_NAME;
    if (!appName) {
        throw new Error(
            "GITHUB_APP_NAME is not set. It must contain the GitHub App's slug (e.g. \"my-reviewer-app\")."
        );
    }
    const url = new URL(`https://github.com/apps/${appName}/installations/new`);
    url.searchParams.set("state", userId);
    return url.toString();
}