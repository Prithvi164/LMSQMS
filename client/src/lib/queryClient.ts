import { QueryClient, QueryFunction, QueryKey } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage: string;
    try {
      const data = await res.json();
      errorMessage = data.message || res.statusText;
    } catch {
      errorMessage = await res.text() || res.statusText;
    }
    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

// Exponential backoff retry delay calculator
function getRetryDelay(attemptIndex: number) {
  return Math.min(1000 * Math.pow(2, attemptIndex), 30000); // Max 30 seconds
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: data instanceof FormData ? {} : { "Content-Type": "application/json" },
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return apiRequest(method, url, data); // Retry after waiting
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unexpected error occurred");
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn = <T>({ on401 }: { on401: UnauthorizedBehavior }): QueryFunction<T, QueryKey> =>
  async ({ queryKey, signal, meta }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
        signal,
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return getQueryFn({ on401 })({ queryKey, signal, meta });
      }

      if (on401 === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("An unexpected error occurred");
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000, // Consider data fresh for 30 seconds
      gcTime: 300000, // Keep unused data in cache for 5 minutes
      retry: (failureCount, error) => {
        if (error instanceof Error) {
          // Don't retry auth errors
          if (error.message.includes("401")) return false;
          // Don't retry if explicitly told not to
          if (error.message.includes("do-not-retry")) return false;
        }
        return failureCount < 3;
      },
      retryDelay: getRetryDelay,
    },
    mutations: {
      retry: false,
    },
  },
});