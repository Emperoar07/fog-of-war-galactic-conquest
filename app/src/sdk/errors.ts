export type ArciumErrorCategory =
  | "user"
  | "network"
  | "arcium"
  | "program"
  | "unknown";

export type ArciumErrorInfo = {
  message: string;
  isRetryable: boolean;
  errorCode?: number;
  category: ArciumErrorCategory;
};

type RetryOptions = {
  maxRetries?: number;
  retryDelayMs?: number;
  label?: string;
};

const ANCHOR_ERROR_OFFSET = 6000;

export function messageFromError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

function extractErrorCode(err: unknown): number | null {
  if (!err || typeof err !== "object") {
    const match = messageFromError(err).match(/\b(6\d{3}|102|6603)\b/);
    return match ? Number.parseInt(match[1], 10) : null;
  }

  const anyErr = err as Record<string, unknown>;
  const directCandidates = [
    anyErr.errorCode,
    anyErr.code,
    (anyErr.error as Record<string, unknown> | undefined)?.errorCode,
    (anyErr.error as Record<string, unknown> | undefined)?.code,
    (anyErr.AnchorError as Record<string, unknown> | undefined)
      ?.errorCodeNumber,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "number") return candidate;
    if (typeof candidate === "string" && /^\d+$/.test(candidate)) {
      return Number.parseInt(candidate, 10);
    }
  }

  const message = messageFromError(err);
  const match = message.match(/\b(6\d{3}|102|6603)\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function classifyArciumError(err: unknown): ArciumErrorInfo {
  const message = messageFromError(err);
  const code = extractErrorCode(err);

  if (
    /User rejected|user rejected|Transaction cancelled|Transaction rejected|User denied/i.test(
      message
    )
  ) {
    return {
      message: "Transaction cancelled.",
      isRetryable: false,
      category: "user",
    };
  }

  if (
    /Insufficient funds|insufficient funds for rent|insufficient lamports|0x1/i.test(
      message
    )
  ) {
    return {
      message: "Not enough SOL for transaction fees.",
      isRetryable: false,
      category: "user",
    };
  }

  if (
    code === ANCHOR_ERROR_OFFSET ||
    /6000|abortedcomputation|computation was aborted/i.test(message)
  ) {
    return {
      message:
        "Arcium computation was aborted. The cluster may accept the same action on retry if load or timing caused the failure.",
      isRetryable: true,
      errorCode: 6000,
      category: "arcium",
    };
  }

  if (code === ANCHOR_ERROR_OFFSET + 4 || /6004|stale pda/i.test(message)) {
    return {
      message:
        "Arcium returned a stale computation account. Retrying with a fresh slot usually resolves this.",
      isRetryable: true,
      errorCode: 6004,
      category: "arcium",
    };
  }

  if (code === 6603 || /6603|invalid slot/i.test(message)) {
    return {
      message:
        "Arcium rejected the current slot context. Retry after the cluster advances.",
      isRetryable: true,
      errorCode: 6603,
      category: "arcium",
    };
  }

  if (
    /Blockhash not found|block height exceeded|blockhash not found|BlockhashNotFound/i.test(
      message
    )
  ) {
    return {
      message: "Transaction expired before confirmation. Retrying...",
      isRetryable: true,
      category: "network",
    };
  }

  if (
    /fetch failed|socket|tls|ssl|bad record mac|decrypt error|closed|timeout|timed out|429|502|503|ECONNREFUSED|NetworkError/i.test(
      message
    )
  ) {
    return {
      message: "Network or RPC transport failed while waiting for Arcium.",
      isRetryable: true,
      category: "network",
    };
  }

  if (/MXE cluster keys not set|MXE public key not available/i.test(message)) {
    return {
      message:
        "MXE keys are not ready yet. Wait for key exchange to complete, then retry.",
      isRetryable: false,
      category: "arcium",
    };
  }

  return {
    message: message || "Arcium operation failed.",
    isRetryable: false,
    errorCode: code ?? undefined,
    category: code !== null ? "program" : "unknown",
  };
}

export function isRetriableArciumError(err: unknown): boolean {
  return classifyArciumError(err).isRetryable;
}

export function describeArciumError(
  err: unknown,
  fallback = "Arcium operation failed."
): string {
  return classifyArciumError(err).message || fallback;
}

export async function retryArciumOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 4;
  const retryDelayMs = options.retryDelayMs ?? 1500;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const info = classifyArciumError(err);
      if (!info.isRetryable || attempt >= maxRetries) {
        throw new Error(
          info.message || options.label || "Arcium operation failed."
        );
      }
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw new Error(describeArciumError(lastError, options.label));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
