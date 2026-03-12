function messageFromError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

const RETRIABLE_PATTERNS = [
  /fetch failed/i,
  /socket/i,
  /tls/i,
  /ssl/i,
  /bad record mac/i,
  /decrypt error/i,
  /closed/i,
  /timeout/i,
  /timed out/i,
  /429/i,
  /503/i,
  /stale pda/i,
  /invalid slot/i,
  /6004/i,
  /6603/i,
];

export function isRetriableArciumError(err: unknown): boolean {
  const message = messageFromError(err);
  return RETRIABLE_PATTERNS.some((pattern) => pattern.test(message));
}

export function describeArciumError(
  err: unknown,
  fallback = "Arcium operation failed.",
): string {
  const message = messageFromError(err);

  if (/6000|abortedcomputation|computation was aborted/i.test(message)) {
    return "Arcium computation aborted. Refresh state and verify the deployed computation definitions and circuits match the current program build.";
  }
  if (/6004|stale pda/i.test(message)) {
    return "Arcium returned a stale computation account. Retry the action in a few seconds.";
  }
  if (/6603|invalid slot/i.test(message)) {
    return "Arcium rejected the current slot context. Retry after the cluster advances.";
  }
  if (/MXE cluster keys not set|MXE public key not available/i.test(message)) {
    return "MXE keys are not ready yet. Wait for key exchange to complete, then retry.";
  }
  if (isRetriableArciumError(message)) {
    return "RPC transport failed while waiting for the Arcium callback. Refresh state and retry if the action did not settle.";
  }
  return message || fallback;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
