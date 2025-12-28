import * as cron from "node-cron";

import {
  REDIS_LOCK_CRON_JOB,
  REDIS_LOCK_CRON_JOB_TTL_DEFAULT,
} from "domain/constants/redis";
import { ICronJob } from "domain/types/cron/ICronJob";
import { ILogger } from "infrastructure/logger/ILogger";
import { RedisService } from "infrastructure/services/redis/RedisService";

/**
 * Service for managing and scheduling cron jobs
 * Handles job registration, scheduling, and lifecycle management
 * Uses distributed Redis locks to prevent concurrent execution across multiple instances
 */
export class CronSchedulerService {
  private readonly scheduledTasks = new Map<string, cron.ScheduledTask>();
  private isInitialized = false;

  constructor(
    private readonly jobs: ICronJob[],
    private readonly redisService: RedisService,
    private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Initialize and start all enabled cron jobs
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn("CronSchedulerService already initialized", {
        prefix: "[CRON_SCHEDULER]: ",
      });
      return;
    }

    this.logger.info("Initializing cron scheduler", {
      prefix: "[CRON_SCHEDULER]: ",
      totalJobs: this.jobs.length,
    });

    for (const job of this.jobs) {
      if (!job.enabled) {
        this.logger.info(`Skipping disabled cron job: ${job.name}`, {
          prefix: "[CRON_SCHEDULER]: ",
          job: job.name,
        });
        continue;
      }

      try {
        this.scheduleJob(job);
      } catch (error) {
        this.logger.error(`Failed to schedule cron job: ${job.name}`, {
          prefix: "[CRON_SCHEDULER]: ",
          job: job.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.isInitialized = true;

    this.logger.info("Cron scheduler initialized successfully", {
      prefix: "[CRON_SCHEDULER]: ",
      scheduledJobs: this.scheduledTasks.size,
    });
  }

  /**
   * Schedule a single cron job
   */
  private scheduleJob(job: ICronJob): void {
    if (this.scheduledTasks.has(job.name)) {
      this.logger.warn(`Cron job already scheduled: ${job.name}`, {
        prefix: "[CRON_SCHEDULER]: ",
        job: job.name,
      });
      return;
    }

    // Validate cron expression
    if (!cron.validate(job.cronExpression)) {
      throw new Error(
        `Invalid cron expression for job ${job.name}: ${job.cronExpression}`
      );
    }

    const task = cron.schedule(
      job.cronExpression,
      async () => {
        // Execute job in a separate async context to avoid blocking
        setImmediate(async () => {
          await this.executeWithLock(job);
        });
      },
      {
        timezone: "UTC", // Ensure all jobs run in UTC
      }
    );

    this.scheduledTasks.set(job.name, task);
    void task.start();

    this.logger.info(`Scheduled cron job: ${job.name}`, {
      prefix: "[CRON_SCHEDULER]: ",
      job: job.name,
      cronExpression: job.cronExpression,
      timezone: "UTC",
    });
  }

  /**
   * Execute a cron job with distributed lock to prevent concurrent execution
   * Lock is not released after execution - it expires after TTL to handle clock drift
   */
  private async executeWithLock(job: ICronJob): Promise<void> {
    const lockKey = `${REDIS_LOCK_CRON_JOB}:${job.name}`;
    const lockTtl = job.lockTtlSeconds ?? REDIS_LOCK_CRON_JOB_TTL_DEFAULT;

    try {
      const acquired = await this.redisService.setLockKey(lockKey, lockTtl);

      if (acquired !== "OK") {
        this.logger.debug(
          `Cron job skipped (lock held by another instance): ${job.name}`,
          {
            prefix: "[CRON_SCHEDULER]: ",
            job: job.name,
            lockKey,
          }
        );
        return;
      }

      this.logger.info(`Executing cron job: ${job.name}`, {
        prefix: "[CRON_SCHEDULER]: ",
        job: job.name,
        lockTtl,
      });

      await job.execute();

      this.logger.info(`Cron job completed: ${job.name}`, {
        prefix: "[CRON_SCHEDULER]: ",
        job: job.name,
      });
    } catch (error) {
      this.logger.error(`Cron job execution failed: ${job.name}`, {
        prefix: "[CRON_SCHEDULER]: ",
        job: job.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Stop all cron jobs
   */
  public async stopAll(): Promise<void> {
    this.logger.info("Stopping all cron jobs", {
      prefix: "[CRON_SCHEDULER]: ",
      totalJobs: this.scheduledTasks.size,
    });

    for (const [jobName, task] of this.scheduledTasks.entries()) {
      await task.stop();
      this.logger.debug(`Stopped cron job: ${jobName}`, {
        prefix: "[CRON_SCHEDULER]: ",
        job: jobName,
      });
    }

    this.scheduledTasks.clear();
    this.isInitialized = false;

    this.logger.info("All cron jobs stopped", {
      prefix: "[CRON_SCHEDULER]: ",
    });
  }
}
