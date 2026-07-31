import { runWebsubNotificationWorker } from "@/lib/websub/websubNotificationWorker";
import type { WebsubNotificationWorkerResult } from "@/lib/websub/websubNotificationWorker";

export interface WebsubNotificationWorkerCronResult
  extends WebsubNotificationWorkerResult {
  collectedAt: string;
}

export async function runWebsubNotificationWorkerCron(): Promise<WebsubNotificationWorkerCronResult> {
  const result = await runWebsubNotificationWorker();

  return {
    ...result,
    collectedAt: new Date().toISOString(),
  };
}
