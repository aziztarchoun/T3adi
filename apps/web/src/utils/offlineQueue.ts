import type { CreateReportInput } from "@road-safety-map/shared";

const QUEUE_KEY = "t3adi-offline-queue";

export interface QueuedReport {
  id: string;
  input: CreateReportInput;
  queuedAt: string;
}

function readQueue(): QueuedReport[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedReport[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedReport[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore storage errors
  }
}

export function enqueueReport(input: CreateReportInput): void {
  const queue = readQueue();
  queue.push({
    id: crypto.randomUUID(),
    input,
    queuedAt: new Date().toISOString(),
  });
  writeQueue(queue);
}

export function hasQueuedReports(): boolean {
  return readQueue().length > 0;
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

/**
 * Flush queued reports when the device comes back online.
 * Returns the number of reports that were successfully submitted.
 * Failed reports are left in the queue for retry.
 */
export async function flushQueue(
  submitFn: (input: CreateReportInput) => Promise<unknown>,
): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  let sent = 0;
  const remaining: QueuedReport[] = [];

  for (const item of queue) {
    try {
      await submitFn(item.input);
      sent++;
    } catch {
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  return sent;
}

/**
 * Register an online listener that calls the provided flush function when the
 * device reconnects. Call the returned function to remove the listener.
 */
export function registerOnlineFlush(
  onFlush: (count: number) => void,
  submitFn: (input: CreateReportInput) => Promise<unknown>,
): () => void {
  const handler = async () => {
    const count = await flushQueue(submitFn);
    if (count > 0) onFlush(count);
  };

  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
