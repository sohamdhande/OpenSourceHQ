/**
 * Job Scheduler & Background Worker Adapter
 * Provides local immediate execution in development and standard job runner interface
 * Extensible for Inngest or other job workers
 */

export type JobName =
  | "github.process_webhook"
  | "github.reconcile_repo"
  | "notification.send_email"
  | "analytics.aggregate_cohort";

export interface JobPayload<T = unknown> {
  id: string;
  name: JobName;
  data: T;
  timestamp: string;
}

type JobHandler<T = unknown> = (payload: JobPayload<T>) => Promise<void>;

class JobRegistry {
  private handlers = new Map<JobName, JobHandler>();

  register<T>(name: JobName, handler: JobHandler<T>) {
    this.handlers.set(name, handler as JobHandler);
  }

  async enqueue<T>(name: JobName, data: T): Promise<{ success: boolean; jobId: string }> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const payload: JobPayload<T> = {
      id: jobId,
      name,
      data,
      timestamp: new Date().toISOString(),
    };

    const handler = this.handlers.get(name);
    if (!handler) {
      console.warn(`[JobRunner] No registered handler for job: ${name}`);
      return { success: false, jobId };
    }

    // In local dev, run asynchronously in the microtask/tick without blocking caller
    setImmediate(async () => {
      try {
        await handler(payload);
      } catch (err) {
        console.error(`[JobRunner] Job ${name} failed:`, err);
      }
    });

    return { success: true, jobId };
  }
}

export const jobRunner = new JobRegistry();

