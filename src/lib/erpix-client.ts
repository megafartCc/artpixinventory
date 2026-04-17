import { NextResponse } from "next/server";

type RetryOptions = {
  retries?: number;
  delayMs?: number;
  onFinalFailure?: (error: unknown) => Promise<void> | void;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateErpixApiKey(request: Request) {
  const expectedKey = process.env.ERPIX_API_KEY?.trim();

  if (!expectedKey) {
    return NextResponse.json({ error: "ERPIX API key is not configured." }, { status: 500 });
  }

  const incoming = request.headers.get("ERPIX_API_KEY")?.trim();
  if (!incoming || incoming !== expectedKey) {
    return NextResponse.json({ error: "Invalid ERPIX API key." }, { status: 401 });
  }

  return null;
}

export async function withErpixRetry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const retries = options?.retries ?? 3;
  const delayMs = options?.delayMs ?? 10_000;

  let attempt = 0;
  let latestError: unknown;

  while (attempt < retries) {
    try {
      return await operation();
    } catch (error) {
      latestError = error;
      attempt += 1;

      if (attempt >= retries) {
        if (options?.onFinalFailure) {
          await options.onFinalFailure(error);
        }
        break;
      }

      await sleep(delayMs);
    }
  }

  throw latestError instanceof Error ? latestError : new Error("ERPIX operation failed.");
}
