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

// ---------------------------------------------------------------------------
// Simulation retry (pre-flight check with retry on transient Arcium errors)
// ---------------------------------------------------------------------------

export interface SimulateWithRetryOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  /** Called before each retry so the caller can refresh blockhash on the tx. */
  refreshBlockhash?: () => Promise<void>;
}

/**
 * Simulate a transaction, retrying on transient Arcium/network errors.
 * Useful for catching AbortedComputation (6000) or stale PDA (6004) before
 * actually sending.
 */
export async function simulateWithRetry(
  connection: import("@solana/web3.js").Connection,
  tx:
    | import("@solana/web3.js").VersionedTransaction
    | import("@solana/web3.js").Transaction,
  options: SimulateWithRetryOptions = {}
): Promise<import("@solana/web3.js").SimulatedTransactionResponse> {
  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0 && options.refreshBlockhash) {
      await options.refreshBlockhash();
    }

    const result =
      "version" in tx
        ? await connection.simulateTransaction(tx)
        : await connection.simulateTransaction(tx);

    const simErr = result.value.err;
    if (!simErr) return result.value;

    const errInfo = classifyArciumError(simErr);
    if (!errInfo.isRetryable || attempt >= maxRetries) {
      throw new Error(
        `Simulation failed: ${errInfo.message} (code ${
          errInfo.errorCode ?? "unknown"
        })`
      );
    }

    await sleep(retryDelayMs * (attempt + 1));
  }

  throw new Error("simulateWithRetry: exhausted retries");
}

// ---------------------------------------------------------------------------
// Polling-based confirmation (for MPC callback delivery)
// ---------------------------------------------------------------------------

export interface ConfirmWithPollingOptions {
  /** Maximum time to wait for confirmation (ms). Default 120_000. */
  timeoutMs?: number;
  /** Polling interval (ms). Default 3_000. */
  pollMs?: number;
  /** Maximum number of re-send attempts when confirmation times out. Default 2. */
  maxResendAttempts?: number;
  /** Re-send callback. Return the new signature. */
  resend?: () => Promise<string>;
}

/**
 * Poll for transaction confirmation with timeout and optional re-send.
 * More resilient than `confirmTransaction` for MPC callbacks that may
 * take a variable amount of time.
 */
export async function confirmWithPolling(
  connection: import("@solana/web3.js").Connection,
  signature: string,
  options: ConfirmWithPollingOptions = {}
): Promise<{ confirmed: boolean; slot: number | null; err: unknown }> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const pollMs = options.pollMs ?? 3_000;
  const maxResendAttempts = options.maxResendAttempts ?? 2;

  let currentSig = signature;
  let resendCount = 0;

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await connection.getSignatureStatus(currentSig, {
      searchTransactionHistory: true,
    });

    if (status.value) {
      if (status.value.err) {
        return {
          confirmed: false,
          slot: status.value.slot,
          err: status.value.err,
        };
      }
      if (
        status.value.confirmationStatus === "confirmed" ||
        status.value.confirmationStatus === "finalized"
      ) {
        return { confirmed: true, slot: status.value.slot, err: null };
      }
    }

    // If past half the timeout and still not confirmed, try re-send
    if (
      Date.now() > deadline - timeoutMs / 2 &&
      resendCount < maxResendAttempts &&
      options.resend
    ) {
      try {
        currentSig = await options.resend();
        resendCount++;
      } catch {
        // resend failed, continue polling
      }
    }

    await sleep(pollMs);
  }

  return { confirmed: false, slot: null, err: "timeout" };
}

// ---------------------------------------------------------------------------
// Match state polling (detect stuck computations)
// ---------------------------------------------------------------------------

export interface WaitForCallbackOptions {
  /** Max time to wait (ms). Default 120_000. */
  timeoutMs?: number;
  /** Polling interval (ms). Default 3_000. */
  pollMs?: number;
}

/**
 * Poll a match account until a condition is met (e.g., status change, turn advance).
 * Returns the final match state or throws on timeout.
 */
export async function waitForMatchCondition<T>(
  fetchState: () => Promise<T>,
  predicate: (state: T) => boolean,
  options: WaitForCallbackOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const pollMs = options.pollMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await fetchState();
    if (predicate(state)) return state;
    await sleep(pollMs);
  }

  throw new Error("waitForMatchCondition: timed out waiting for state change");
}
