import { Router } from "express";
import {
  cancelJob,
  createJob,
  emptyDLQ,
  getAllDLQJobs,
  getAllJobs,
  getJobAttempts,
  getJobStats,
  getSingleJob,
  manualRetryJob,
  purgeJob,
} from "../controllers";

export const router = Router();

/**
 * @swagger
 * tags:
 *   name: Jobs
 *   description: Job scheduling and management
 */

/**
 * @swagger
 * /jobs:
 *   post:
 *     summary: Create a new job
 *     tags: [Jobs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - payload
 *               - priority
 *             properties:
 *               type:
 *                 type: string
 *                 description: Job handler type
 *                 example: send_email
 *               payload:
 *                 type: object
 *                 description: Structured data the handler needs to execute the job
 *                 example:
 *                   to: user@example.com
 *                   subject: Welcome
 *               priority:
 *                 type: integer
 *                 enum: [1, 2, 3]
 *                 description: "1 = high, 2 = medium, 3 = low"
 *                 example: 1
 *               scheduled_at:
 *                 type: number
 *                 description: Unix ms timestamp. Omit to run as soon as possible.
 *                 example: 1749600000000
 *               recur_interval:
 *                 type: string
 *                 enum: [every_1_minute, every_5_minutes, every_1_hour]
 *                 description: When set, a new job is automatically scheduled after each successful run.
 *     responses:
 *       201:
 *         description: Job created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Job'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/jobs", createJob);

/**
 * @swagger
 * /jobs:
 *   get:
 *     summary: List jobs with optional filters and pagination
 *     tags: [Jobs]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: recur_interval
 *         schema:
 *           type: string
 *           enum: [every_1_minute, every_5_minutes, every_1_hour]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [attempt_count, max_retries, priority]
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: scheduled_after
 *         description: Unix ms timestamp — include jobs scheduled at or after this time
 *         schema:
 *           type: number
 *       - in: query
 *         name: scheduled_before
 *         schema:
 *           type: number
 *       - in: query
 *         name: created_after
 *         schema:
 *           type: number
 *       - in: query
 *         name: created_before
 *         schema:
 *           type: number
 *       - in: query
 *         name: started_after
 *         schema:
 *           type: number
 *       - in: query
 *         name: started_before
 *         schema:
 *           type: number
 *       - in: query
 *         name: completed_after
 *         schema:
 *           type: number
 *       - in: query
 *         name: completed_before
 *         schema:
 *           type: number
 *       - in: query
 *         name: cancelled_after
 *         schema:
 *           type: number
 *       - in: query
 *         name: cancelled_before
 *         schema:
 *           type: number
 *       - in: query
 *         name: next_retry_after
 *         schema:
 *           type: number
 *       - in: query
 *         name: next_retry_before
 *         schema:
 *           type: number
 *       - in: query
 *         name: updated_after
 *         schema:
 *           type: number
 *       - in: query
 *         name: updated_before
 *         schema:
 *           type: number
 *       - in: query
 *         name: min_attempt_count
 *         schema:
 *           type: integer
 *           minimum: 0
 *       - in: query
 *         name: max_attempt_count
 *         schema:
 *           type: integer
 *           minimum: 0
 *     responses:
 *       200:
 *         description: Paginated list of jobs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedJobs'
 *       400:
 *         description: Invalid query parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/jobs", getAllJobs);

/**
 * @swagger
 * /jobs/dlq:
 *   get:
 *     summary: List dead-letter queue jobs
 *     description: Returns jobs that have status=failed and have exhausted all retries (attempt_count >= max_retries).
 *     tags: [Jobs]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated list of DLQ jobs with error details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedJobs'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/jobs/dlq", getAllDLQJobs);

/**
 * @swagger
 * /jobs/dlq:
 *   delete:
 *     summary: Empty the dead-letter queue
 *     description: >
 *       Permanently deletes ALL jobs in the dead-letter queue
 *       (status=failed AND attempt_count >= max_retries).
 *       All associated job_attempts and job_logs are CASCADE deleted.
 *       This is irreversible — use only when you are certain no DLQ jobs
 *       require further investigation or retry.
 *     tags: [Jobs]
 *     responses:
 *       200:
 *         description: DLQ cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted:
 *                       type: integer
 *                       description: Number of jobs permanently removed
 *                       example: 14
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/jobs/dlq", emptyDLQ);

/**
 * @swagger
 * /jobs/stats:
 *   get:
 *     summary: Get job counts by status
 *     description: Returns a count for each status and a total. Also includes a dedicated DLQ count (failed + exhausted retries).
 *     tags: [Jobs]
 *     responses:
 *       200:
 *         description: Job statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/JobStats'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/jobs/stats", getJobStats);

/**
 * @swagger
 * /jobs/{id}:
 *   get:
 *     summary: Get a single job by ID
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job UUID
 *     responses:
 *       200:
 *         description: Job found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/jobs/:id", getSingleJob);

/**
 * @swagger
 * /jobs/{id}/cancel:
 *   post:
 *     summary: Cancel a job
 *     description: >
 *       If the job is pending, it is cancelled immediately.
 *       If it is already processing, it is set to `cancelling` and the worker
 *       will transition it to `cancelled` after its current operation finishes.
 *       Jobs that are completed, failed, or already cancelled cannot be cancelled.
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Job cancelled or cancellation queued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Job cannot be cancelled in its current state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/jobs/:id/cancel", cancelJob);

/**
 * @swagger
 * /jobs/{id}/retry:
 *   post:
 *     summary: Manually retry a DLQ job
 *     description: >
 *       Re-queues a job that is in the dead-letter queue (failed + exhausted retries).
 *       Resets attempt_count to 0 and sets status back to pending.
 *       If it fails again after retrying, it returns to the DLQ.
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Job re-queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Job is not in the DLQ — cannot retry
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/jobs/:id/retry", manualRetryJob);

/**
 * @swagger
 * /jobs/{id}/purge:
 *   delete:
 *     summary: Purge a DLQ job
 *     description: >
 *       Permanently deletes a job that is in the dead-letter queue
 *       (status=failed AND attempt_count >= max_retries).
 *       All associated job_attempts and job_logs are CASCADE deleted.
 *       This is irreversible — use only after investigation is complete.
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Job purged successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Job is not in the DLQ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/jobs/:id/purge", purgeJob);

/**
 * @swagger
 * /jobs/{id}/attempts:
 *   get:
 *     summary: Get attempt history for a job
 *     description: >
 *       Returns all recorded attempt entries for the given job, ordered by
 *       attempt number ascending. Each entry includes the attempt number,
 *       error message (if failed), duration in milliseconds, and timestamp.
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Attempt history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       job_id:
 *                         type: string
 *                         format: uuid
 *                       attempt_num:
 *                         type: integer
 *                       error:
 *                         type: string
 *                         nullable: true
 *                       duration_ms:
 *                         type: integer
 *                         nullable: true
 *                       attempted_at:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/jobs/:id/attempts", getJobAttempts);
