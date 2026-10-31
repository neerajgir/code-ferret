import { getGithubApp } from "../utils/github-app";
import { savePullRequest } from "@/features/reviews/server/save-pull-request";
import { inngest } from "@/features/inngest/clients";

const REVIEWABLE_ACTIONS = ["opened", "synchronize", "reopened"];

export type PullRequestWebhookPayload = {
    /** Webhook action, e.g. `opened`, `synchronize`, `reopened` */
    action: string;
    /** GitHub App installation that received the event */
    installation: { id: number };
    repository: { full_name: string };
    pull_request: {
      number: number;
      title: string;
      user: { login: string } | null;
      head: { sha: string };
      base: { ref: string };
    };
  };

async function isSignatureValid(payload: string, signature:string | null) {
    if(!signature) return false

    const app = getGithubApp();
    return app.webhooks.verify(payload, signature)
}

export async function handleGithubWebhook(request: Request){
    const payload = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const eventName = request.headers.get("x-github-event")

    const isValid = await isSignatureValid(payload, signature);

    if(!isValid){
        return Response.json({error: "Invalid Signature"}, {status: 401})
    }
    if(eventName !== "pull_request"){
        return Response.json({received: true})
    }

    const event = JSON.parse(payload) as PullRequestWebhookPayload;

    console.log(
        "[webhook] pull_request",
        event.action,
        event.repository.full_name,
        `#${event.pull_request.number}`
    );

    if(!REVIEWABLE_ACTIONS.includes(event.action)){
    return Response.json({ received: true });
    }

    const pullRequest = await savePullRequest(event);

    // Dispatch the review. Without this the review function never runs —
    // the webhook just persisted the row and nothing else sent the event.
    await inngest.send({
        name: "github/pr.received",
        data: { pullRequestId: pullRequest.id },
    });

    return Response.json({ received: true})
}