import encodeOctree from './encode-octree';
import decodeOctree from './decode-octree';
import OctreeCSG from '../base/OctreeCSG';
import { JobError } from './JobError';

import type { EncodedOctreeCSGObject, EncodedOctreeCSGObjectArgument } from './EncodedOctreeCSGObject';
import type { OctreeCSGObject } from '../base/OctreeCSGObject';
import type WorkerRequest from './WorkerRequest';

function encodeOctreeCSGObject(obj: OctreeCSGObject, transferables: Array<ArrayBuffer>): EncodedOctreeCSGObject {
    switch (obj.op) {
        case 'union':
        case 'subtract':
        case 'intersect':
        {
            return <EncodedOctreeCSGObject>{
                op: obj.op,
                objA: encodeOctreeCSGObjectOrCSG(obj.objA, transferables),
                objB: encodeOctreeCSGObjectOrCSG(obj.objB, transferables),
            }
        }
        case 'unionArray':
        case 'subtractArray':
        case 'intersectArray':
        {
            const encodedObjs = new Array<EncodedOctreeCSGObjectArgument>();

            for (const octreeObj of obj.objs) {
                encodedObjs.push(encodeOctreeCSGObjectOrCSG(octreeObj, transferables));
            }

            return <EncodedOctreeCSGObject>{
                op: obj.op,
                objs: encodedObjs,
            }
        }
        default:
            throw new Error(`Unknown operation: ${(obj as {op: unknown}).op}`);
    }
}

function encodeOctreeCSGObjectOrCSG(obj: OctreeCSGObject | OctreeCSG, transferables: Array<ArrayBuffer>): EncodedOctreeCSGObjectArgument {
    if (obj instanceof OctreeCSG) {
        return encodeOctree(obj, transferables);
    } else {
        return encodeOctreeCSGObject(obj, transferables);
    }
}

export default class Job {
    private operation: EncodedOctreeCSGObject | null;
    private transferables: Array<ArrayBuffer> | null;
    workerIndex: number | null = null;

    constructor(operation: OctreeCSGObject, private resolveCallback: (octree: OctreeCSG) => void, private rejectCallback: (error: JobError) => void) {
        // encode operation
        this.transferables = [];
        this.operation = encodeOctreeCSGObject(operation, this.transferables);
    }

    getMessage(workerIndex: number, jobIndex: number): [message: WorkerRequest, transferables: Array<ArrayBuffer>] {
        if (!(this.operation && this.transferables)) {
            throw new Error('Message already created');
        }

        const operation = this.operation;
        const transferables = this.transferables;

        this.operation = null;
        this.transferables = null;
        this.workerIndex = workerIndex;

        const data: [message: WorkerRequest, transferables: Array<ArrayBuffer>] = [
            <WorkerRequest>{
                type: 'operation',
                jobIndex,
                operation,
            },
            transferables,
        ];

        console.debug(data);

        return data;
    }

    resolve(vertexBuffer: Float32Array, normalBuffer: Float32Array) {
        try {
            this.resolveCallback(decodeOctree(vertexBuffer, normalBuffer));
        } catch(e) {
            this.rejectCallback(JobError.DecodeFailure(e));
        }
    }

    reject(error: JobError) {
        console.debug('JOB REJECTED');
        this.rejectCallback(error);
    }
}
