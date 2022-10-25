import OctreeCSG from '../base/OctreeCSG';
import { JobError } from './JobError';

import type { EncodedOctreeCSGObject, EncodedOctreeCSGObjectArgument } from './EncodedOctreeCSGObject';
import type { OctreeCSGObject } from '../base/OctreeCSGObject';
import type WorkerRequest from './WorkerRequest';
import type { MaterialDefinitions } from '../base/MaterialDefinition';

function encodeOctreeCSGObject(obj: OctreeCSGObject, materialDefinitions: MaterialDefinitions, transferables: Array<ArrayBuffer>): EncodedOctreeCSGObject {
    switch (obj.op) {
        case 'union':
        case 'subtract':
        case 'intersect':
        {
            return <EncodedOctreeCSGObject>{
                op: obj.op,
                objA: encodeOctreeCSGObjectOrCSG(obj.objA, materialDefinitions, transferables),
                objB: encodeOctreeCSGObjectOrCSG(obj.objB, materialDefinitions, transferables),
            }
        }
        case 'unionArray':
        case 'subtractArray':
        case 'intersectArray':
        {
            const encodedObjs = new Array<EncodedOctreeCSGObjectArgument>();

            for (const octreeObj of obj.objs) {
                encodedObjs.push(encodeOctreeCSGObjectOrCSG(octreeObj, materialDefinitions, transferables));
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

function encodeOctreeCSGObjectOrCSG(obj: OctreeCSGObject | OctreeCSG, materialDefinitions: MaterialDefinitions, transferables: Array<ArrayBuffer>): EncodedOctreeCSGObjectArgument {
    if (obj instanceof OctreeCSG) {
        return obj.encode(materialDefinitions, transferables);
    } else {
        return encodeOctreeCSGObject(obj, materialDefinitions, transferables);
    }
}

export default class Job {
    private operation: EncodedOctreeCSGObject | null;
    private materialDefinitions: MaterialDefinitions | null;
    private transferables: Array<ArrayBuffer> | null;
    workerIndex: number | null = null;

    constructor(operation: OctreeCSGObject, materialDefinitions: MaterialDefinitions, private resolveCallback: (octree: OctreeCSG) => void, private rejectCallback: (error: JobError) => void) {
        // encode operation
        this.transferables = [];
        this.operation = encodeOctreeCSGObject(operation, materialDefinitions, this.transferables);
        this.materialDefinitions = materialDefinitions;
    }

    getMessage(workerIndex: number, jobIndex: number): [message: WorkerRequest, transferables: Array<ArrayBuffer>] {
        if (!(this.operation && this.transferables)) {
            throw new Error('Message already created');
        }

        const operation = this.operation;
        const materialDefinitions = this.materialDefinitions;
        const transferables = this.transferables;

        this.operation = null;
        this.materialDefinitions = null;
        this.transferables = null;
        this.workerIndex = workerIndex;

        const data: [message: WorkerRequest, transferables: Array<ArrayBuffer>] = [
            <WorkerRequest>{
                type: 'operation',
                jobIndex,
                operation,
                materialDefinitions,
            },
            transferables,
        ];

        return data;
    }

    resolve(buffer: ArrayBuffer, materialDefinitions: MaterialDefinitions | null) {
        try {
            this.resolveCallback(OctreeCSG.decode(buffer, materialDefinitions));
        } catch(e) {
            this.rejectCallback(JobError.DecodeFailure(e));
        }
    }

    reject(error: JobError) {
        this.rejectCallback(error);
    }
}
