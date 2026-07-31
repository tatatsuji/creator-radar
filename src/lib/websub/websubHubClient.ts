export interface PostWebsubHubRequestInput {
  hubUrl: string;
  mode: "subscribe" | "unsubscribe";
  topicUrl: string;
  callbackUrl: string;
  leaseSeconds?: number;
  secret?: string;
}

export interface PostWebsubHubRequestResult {
  ok: boolean;
  status: number;
  body: string;
}

export async function postWebsubHubRequest(
  input: PostWebsubHubRequestInput,
): Promise<PostWebsubHubRequestResult> {
  const body = new URLSearchParams({
    "hub.mode": input.mode,
    "hub.topic": input.topicUrl,
    "hub.callback": input.callbackUrl,
    "hub.verify": "async",
  });

  if (input.mode === "subscribe") {
    body.set(
      "hub.lease_seconds",
      String(input.leaseSeconds ?? 604800),
    );
    if (input.secret) {
      body.set("hub.secret", input.secret);
    }
  }

  const response = await fetch(input.hubUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const responseBody = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    body: responseBody,
  };
}
