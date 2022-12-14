import { JobError } from './JobError';
import Job from './Job';

import type { OctreeCSGObject } from '../base/OctreeCSGObject';
import type OctreeCSG from '../base/OctreeCSG';
import type JobResult from './JobResult';
import type { MaterialDefinitions } from '../base/MaterialDefinition';
import { OctreeCSGOptions } from '../base/OctreeCSG';

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

    private initWorker(workers: Array<Worker>, workerPath: string, timeoutMS: number, name: string) {
        return new Promise((resolve: (value: undefined) => void, reject: (reason: Error) => void) => {
            const timeout = setTimeout(() => {
                worker.terminate();
                reject(new Error('Timed out'));
            }, timeoutMS);

            const worker = new Worker(workerPath, { type: 'classic', name });
            worker.onmessage = (message: MessageEvent<string>) => {
                clearTimeout(timeout);

                if (message.data === 'initialized') {
                    const workerIndex = workers.length;
                    workers.push(worker);

                    worker.onmessage = this.makeMessageHandler(workerIndex);
                    resolve(undefined); // XXX undefined so typescript shuts up
                } else {
                    worker.terminate();
                    reject(new Error('Unexpected initialization message'));
                }
            }
        });
    }

    private init(workerPath: string, workerCount: number, timeoutMS: number) {
        return new Promise((resolve: (value: undefined) => void, reject: (reason: Error) => void) => {
            const workers = new Array<Worker>();
            let workersDone = 0;

            for (let i = 0; i < workerCount; i++) {
                this.initWorker(workers, workerPath, timeoutMS, `octreecsg-ea-${i}`).catch((reason: Error) => {
                    console.error('Failed to create OctreeCSG worker:', reason.message);
                }).finally(() => {
                    if (++workersDone === workerCount) {
                        const actualWorkerCount = workers.length;

                        if (actualWorkerCount === 0) {
                            reject(new Error('All OctreeCSG workers failed to be created'));
                            return;
                        } else if (actualWorkerCount !== workerCount) {
                            console.warn(`Some OctreeCSG workers failed to be created. Created ${actualWorkerCount} workers instead of ${workerCount}`);
                        } else {
                            console.info(`Created ${actualWorkerCount} OctreeCSG workers`);
                        }

                        this.workers = workers;
                        this.jobCounts = new Array(actualWorkerCount);
                        this.jobCounts.fill(0);

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
            job.resolve(event.data.buffer, event.data.materials);
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

        // add job to worker job count
        this.jobCounts[minWorkerIndex]++;

        // dispatch to chosen worker
        const worker = (this.workers as Array<Worker>)[minWorkerIndex];
        worker.postMessage(...job.getMessage(minWorkerIndex, jobIndex));
    }

    dispatch(operation: OctreeCSGObject, materials: MaterialDefinitions, options?: OctreeCSGOptions) {
        return new Promise((resolve: (octree: OctreeCSG) => void, reject: (error: JobError) => void) => {
            // create job
            const job = new Job(operation, materials, options, resolve, reject)
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