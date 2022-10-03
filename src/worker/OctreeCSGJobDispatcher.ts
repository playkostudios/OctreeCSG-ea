import Job from "./Job";

declare global {
    // eslint-disable-next-line no-var
    var globalOctreeCSGJobDispatcher: OctreeCSGJobDispatcher | undefined;
}

export default class OctreeCSGJobDispatcher {
    private registration: ServiceWorkerRegistration | null = null;
    private waitingJobs: Job[] = [];

    private async init(workerPath: string) {
        this.registration = await navigator.serviceWorker.register(workerPath);
    }

    static async register(workerPath: string) {
        if (globalThis.globalOctreeCSGJobDispatcher) {
            console.warn('Skipped OctreeCSG job dispatcher registration; already registered');
            return;
        }

        if ('serviceWorker' in globalThis) {
            try {
                const jobDispatcher = new OctreeCSGJobDispatcher();
                globalThis.globalOctreeCSGJobDispatcher = jobDispatcher;
                await jobDispatcher.init(workerPath);
            } catch(e) {
                console.error('OctreeCSG job dispatcher registration failed:', e);
                // TODO reject all jobs with a special reason so that they can recover
                throw e;
            }
        } else {
            console.warn('Skipped OctreeCSG job dispatcher registration; service workers not supported (are you in HTTPS?)');
            return;
        }
    }
}