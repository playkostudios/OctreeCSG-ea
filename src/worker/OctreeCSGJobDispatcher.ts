import { JobError } from './JobError';
import Job from './Job';

import type { OctreeCSGObject } from '../base/OctreeCSGObject';
import type OctreeCSG from '../base/OctreeCSG';
import type JobResult from './JobResult';

declare global {
    // eslint-disable-next-line no-var
    var globalOctreeCSGJobDispatcher: OctreeCSGJobDispatcher | null | undefined;
}

const JOB_REG_MSG = 'OctreeCSG job dispatcher worker creation';
const WARN_START = `Skipped ${JOB_REG_MSG}; `;

export default class OctreeCSGJobDispatcher {
    private workers: Array<Worker> | null = null;
    private nextJobIndex = 0;
    private waitingJobs = new Map<number, Job>();
    private jobCounts = new Array<number>();

    private initWorker(workers: Array<Worker>, workerPath: string, timeoutMS: number) {
        return new Promise((resolve: (value: undefined) => void, reject: (reason: Error) => void) => {
            const timeout = setTimeout(() => {
                worker.terminate();
                reject(new Error('Worker creation timed out'));
            }, timeoutMS);

            const worker = new Worker(workerPath, { type: 'classic' });
            worker.onmessage = (message: MessageEvent<string>) => {
                clearTimeout(timeout);

                if (message.data === 'initialized') {
                    const workerIndex = workers.length;
                    workers.push(worker);

                    worker.onmessage = this.makeMessageHandler(workerIndex);
                    resolve(undefined); // XXX undefined so typescript shuts up
                } else {
                    worker.terminate();
                    reject(new Error('Unexpected worker initialization message'));
                }
            }
        });
    }

    private init(workerPath: string, workerCount: number, timeoutMS: number) {
        return new Promise((resolve: (value: undefined) => void, reject: (reason: Error) => void) => {
            const workers = new Array<Worker>();
            let workersDone = 0;

            for (let i = 0; i < workerCount; i++) {
                this.initWorker(workers, workerPath, timeoutMS).catch((reason: Error) => {
                    console.error('Failed to initialize worker:', reason.message);
                }).finally(() => {
                    if (++workersDone === workerCount) {
                        const actualWorkerCount = workers.length;

                        if (actualWorkerCount === 0) {
                            reject(new Error('All workers failed to be created'));
                            return;
                        } else if (actualWorkerCount !== workerCount) {
                            console.warn(`Some workers failed to be created. Got ${actualWorkerCount} workers instead of ${workerCount}`);
                        } else {
                            console.info(`Created ${actualWorkerCount} workers`);
                        }

                        this.workers = workers;
                        resolve(undefined); // XXX undefined so typescript shuts up
                    }
                });
            }
        });
    }

    private makeMessageHandler(workerIndex: number) {
        // XXX this aliasing is OK here because this changes in the callback
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const dispatcher = this;

        return function(this: Worker, event: MessageEvent<JobResult>) {
            dispatcher.handleMessage(workerIndex, event);
        }
    }

    private handleMessage(workerIndex: number, event: MessageEvent<JobResult>) {
        // remove job from worker job count
        this.jobCounts[workerIndex]--;

        // delete from waiting jobs
        const jobIndex = event.data.jobIndex;
        const job = this.waitingJobs.get(jobIndex) as Job;
        this.waitingJobs.delete(jobIndex);

        // finalize promise
        if (event.data.success) {
            job.resolve(event.data.vertices, event.data.normals);
        } else {
            job.reject(JobError.OperationFailure(event.data.error));
        }
    }

    private doDispatch(jobIndex: number, job: Job) {
        // get worker with least workers (prefer workers with lower indices)
        let minWorkerIndex = 0;
        let minJobCount = this.jobCounts[0];

        const workerCount = this.jobCounts.length;
        for (let workerIndex = 1; workerIndex < workerCount; workerIndex++) {
            const jobCount = this.jobCounts[workerIndex];
            if (jobCount < minJobCount) {
                minWorkerIndex = workerIndex;
                minJobCount = jobCount;
            }
        }

        // dispatch to chosen worker
        const worker = (this.workers as Array<Worker>)[minWorkerIndex];
        worker.postMessage(...job.getMessage(minWorkerIndex, jobIndex));
    }

    dispatch(operation: OctreeCSGObject) {
        return new Promise((resolve: (octree: OctreeCSG) => void, reject: (error: JobError) => void) => {
            // create job
            const job = new Job(operation, resolve, reject)
            const jobIndex = this.nextJobIndex++;
            this.waitingJobs.set(jobIndex, job);

            // dispatch to worker if workers are registered
            if (this.workers) {
                this.doDispatch(jobIndex, job);
            }
        })
    }

    static async create(workerPath: string, workerCount: number, timeoutMS: number) {
        if (globalThis.globalOctreeCSGJobDispatcher) {
            console.warn(`${WARN_START}already created`);
            return;
        } else if (globalThis.globalOctreeCSGJobDispatcher === null) {
            console.warn(`${WARN_START}previous creation failed`);
            return;
        }

        let jobDispatcher;

        if (globalThis.Worker) {
            try {
                jobDispatcher = new OctreeCSGJobDispatcher();
                globalThis.globalOctreeCSGJobDispatcher = jobDispatcher;
                await jobDispatcher.init(workerPath, workerCount, timeoutMS);
            } catch(e) {
                console.error(`${JOB_REG_MSG} failed:`, e);

                // reject all jobs with a special reason so that they can recover
                globalThis.globalOctreeCSGJobDispatcher = null;

                if (jobDispatcher) {
                    for (const job of jobDispatcher.waitingJobs.values()) {
                        job.reject(JobError.WorkerCreationFailure(e));
                    }

                    jobDispatcher.waitingJobs.clear();
                }

                throw e;
            }

            for (const [jobIndex, job] of jobDispatcher.waitingJobs) {
                jobDispatcher.doDispatch(jobIndex, job);
            }
        } else {
            console.warn(`${WARN_START}Worker API not supported`);
            return;
        }
    }
}