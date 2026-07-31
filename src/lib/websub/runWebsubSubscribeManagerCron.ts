import {
  runWebsubReconcile,
  runWebsubRenewDaily,
  runWebsubRenewUrgent,
  runWebsubSubscribeNew,
  type WebsubSubscribeManagerResult,
} from "@/lib/websub/websubSubscribeManager";

export interface WebsubSubscribeManagerCronResult
  extends WebsubSubscribeManagerResult {
  collectedAt: string;
}

function wrapCronResult(
  result: WebsubSubscribeManagerResult,
): WebsubSubscribeManagerCronResult {
  return {
    ...result,
    collectedAt: new Date().toISOString(),
  };
}

export async function runWebsubSubscribeNewCron(): Promise<WebsubSubscribeManagerCronResult> {
  return wrapCronResult(await runWebsubSubscribeNew());
}

export async function runWebsubRenewUrgentCron(): Promise<WebsubSubscribeManagerCronResult> {
  return wrapCronResult(await runWebsubRenewUrgent());
}

export async function runWebsubRenewDailyCron(): Promise<WebsubSubscribeManagerCronResult> {
  return wrapCronResult(await runWebsubRenewDaily());
}

export async function runWebsubReconcileCron(): Promise<WebsubSubscribeManagerCronResult> {
  return wrapCronResult(await runWebsubReconcile());
}
