import { Queue, Worker } from 'bullmq'
import { redisConnection, redisSubscriber } from '../../lib/redis.js'
import { prisma } from '../../lib/db.js'
import { runSimulationProcessor } from './processor.js'

// ============================================================================
// BULLMQ QUEUE
// ============================================================================

export const simulationQueue = new Queue('simulation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 500, age: 24 * 3600 }, // Keep 24h
    removeOnFail: { count: 500, age: 7 * 24 * 3600 },  // Keep 7d
    backoff: { type: 'fixed', delay: 5000 },
  },
})

// ============================================================================
// JOB ENQUEUE HELPER
// ============================================================================

export async function enqueueSimulation(jobData) {
  const job = await simulationQueue.add('run-simulation', jobData, {
    jobId: `sim-${jobData.simId}`,
    priority: jobData.priority || 5,
  })
  return job
}

export async function getJobState(jobId) {
  const job = await simulationQueue.getJob(jobId)
  if (!job) return null
  return {
    id: job.id,
    state: await job.getState(),
    progress: job.progress,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  }
}

export async function removeJob(jobId) {
  const job = await simulationQueue.getJob(jobId)
  if (job) {
    // Signal the running processor to stop gracefully
    const simId = jobId.replace('sim-', '')
    await redisConnection.setex(`sim:${simId}:stop`, 60, '1')
    await job.remove()
  }
}

// ============================================================================
// WORKER FACTORY (for use in worker.js entry point)
// ============================================================================

export function createSimulationWorker(concurrency = 2) {
  const worker = new Worker(
    'simulation',
    async (job) => runSimulationProcessor(job),
    {
      connection: redisConnection,
      concurrency,
      limiter: {
        max: 10,
        duration: 1000,
      },
      stalledInterval: 30000,
      maxStalledCount: 1,
    }
  )

  // FIX 2: Log actual processing time, not queue wait + processing
  worker.on('completed', (job) => {
    const processingMs = job.finishedOn && job.processedOn
      ? job.finishedOn - job.processedOn
      : Date.now() - (job.processedOn || job.timestamp)
    console.log(`[WORKER] Job ${job.id} completed in ${processingMs}ms`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[WORKER] Job ${job?.id} failed:`, err.message)
    // Ensure DB is updated even if processor didn't catch it
    if (job?.data?.simId) {
      prisma.simulation.update({
        where: { id: job.data.simId },
        data: {
          status: 'failed',
          errorMessage: err.message,
          errorStack: err.stack,
          progress: 100,
        },
      }).catch(console.error)
    }
  })

  worker.on('stalled', (jobId) => {
    console.warn(`[WORKER] Job ${jobId} stalled`)
  })

  worker.on('error', (err) => {
    console.error('[WORKER] Worker error:', err)
  })

  return worker
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export async function closeQueueConnections() {
  await simulationQueue.close()
  await redisConnection.quit()
  await redisSubscriber.quit()
}