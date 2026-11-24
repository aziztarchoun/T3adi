// @vitest-environment jsdom
import type { CreateReportInput } from "@road-safety-map/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearQueue,
  enqueueReport,
  flushQueue,
  hasQueuedReports,
  registerOnlineFlush,
} from "./offlineQueue";

const sampleReport: CreateReportInput = {
  lat: 36.8,
  lng: 10.1,
  type: "pothole",
  severity: "caution",
  description: "Deep pothole",
};

afterEach(() => {
  clearQueue();
  vi.restoreAllMocks();
});

describe("offline report queue", () => {
  it("queues a report and flushes it successfully", async () => {
    enqueueReport(sampleReport);
    expect(hasQueuedReports()).toBe(true);

    const submitFn = vi.fn().mockResolvedValue(undefined);
    const sent = await flushQueue(submitFn);

    expect(sent).toBe(1);
    expect(submitFn).toHaveBeenCalledTimes(1);
    expect(submitFn).toHaveBeenCalledWith(sampleReport);
    expect(hasQueuedReports()).toBe(false);
  });

  it("keeps failed reports queued for a later retry", async () => {
    enqueueReport(sampleReport);

    const submitFn = vi.fn().mockRejectedValue(new Error("still offline"));
    const sent = await flushQueue(submitFn);

    expect(sent).toBe(0);
    expect(submitFn).toHaveBeenCalledTimes(1);
    expect(hasQueuedReports()).toBe(true);
  });

  it("flushes queued reports when the browser comes back online", async () => {
    enqueueReport(sampleReport);
    const submitFn = vi.fn().mockResolvedValue(undefined);
    const onFlush = vi.fn();

    const stop = registerOnlineFlush(onFlush, submitFn);
    window.dispatchEvent(new Event("online"));

    await vi.waitFor(() => {
      expect(onFlush).toHaveBeenCalledWith(1);
    });
    expect(submitFn).toHaveBeenCalledTimes(1);
    expect(hasQueuedReports()).toBe(false);

    stop();
    enqueueReport(sampleReport);
    window.dispatchEvent(new Event("online"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(submitFn).toHaveBeenCalledTimes(1);
  });
});
