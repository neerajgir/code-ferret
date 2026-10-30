import { serve } from "inngest/next";
import {reviewPullRequest} from "@/features/reviews/server/review-pr-function";
import { inngest } from "@/features/inngest/clients";
import { processTask } from "./function";
import { syncRepoCodebaseFunction } from "@/features/repo-sync/server/repo-sync-function";


export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processTask, reviewPullRequest, syncRepoCodebaseFunction],
});