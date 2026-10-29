import { serve } from "inngest/next";
import { inngest } from "@/features/inngest/clients";
import { processTask } from "./function";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processTask],
});