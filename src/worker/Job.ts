import OctreeCSG from '../base/OctreeCSG';
import { JobError } from './JobError';

import type { OctreeCSGOptions } from '../base/OctreeCSG';
import type { EncodedOctreeCSGObject, EncodedOctreeCSGObjectArgument } from './EncodedOctreeCSGObject';
import type { OctreeCSGObject } from '../base/OctreeCSGObject';
import type WorkerRequest from './WorkerRequest';
import type { MaterialDefinitions } from '../base/MaterialDefinition';

function encodeOctreeCSGObject(obj: OctreeCSGObject, materials: MaterialDefinitions, transferables: Array<ArrayBuffer>): EncodedOctreeCSGObject {
    switch (obj.op) {
        case 'union':
        case 'subtract':
        case 'intersect':
        {
            return <EncodedOctreeCSGObject>{
                op: obj.op,
                objA: encodeOctreeCSGObjectOrCSG(obj.objA, materials, transferables),
                objB: encodeOctreeCSGObjectOrCSG(obj.objB, materials, transferables),
            }
        }
        case 'unionArray':
        case 'subtractArray':
        case 'intersectArray':
        {
            const encodedObjs = new Array<EncodedOctreeCSGObjectArgument>();

            for (const octreeObj of obj.objs) {
                encodedObjs.push(encodeOctreeCSGObjectOrCSG(octreeObj, materials, transferables));
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

function encodeOctreeCSGObjectOrCSG(obj: OctreeCSGObject | OctreeCSG, materials: MaterialDefinitions, transferables: Array<ArrayBuffer>): EncodedOctreeCSGObjectArgument {
    if (obj instanceof OctreeCSG) {
        return obj.encode(materials, transferables);
    } else {
        return encodeOctreeCSGObject(obj, materials, transferables);
    }
}

export default class Job {
    private operation: EncodedOctreeCSGObject | null;
    private materials: MaterialDefinitions | null;
    private options?: OctreeCSGOptions;
    private transferables: Array<ArrayBuffer> | null;
    workerIndex: number | null = null;

    constructor(operation: OctreeCSGObject, materials: MaterialDefinitions, options: OctreeCSGOptions | undefined, private resolveCallback: (octree: OctreeCSG) => void, private rejectCallback: (error: JobError) => void) {
        // encode operation
        this.transferables = [];
        this.operation = encodeOctreeCSGObject(operation, materials, this.transferables);
        this.materials = materials;
        this.options = options;
    }

    getMessage(workerIndex: number, jobIndex: number): [message: WorkerRequest, transferables: Array<ArrayBuffer>] {
        if (!(this.operation && this.transferables)) {
            throw new Error('Message already created');
        }

        const operation = this.operation;
        const materials = this.materials;
        const options = this.options;
        const transferables = this.transferables;

        this.operation = null;
        this.materials = null;
        this.options = undefined;
        this.transferables = null;
        this.workerIndex = workerIndex;

        const data: [message: WorkerRequest, transferables: Array<ArrayBuffer>] = [
            <WorkerRequest>{
                type: 'operation',
                jobIndex,
                operation,
                materials,
                options,
            },
            transferables,
        ];

        return data;
    }

    resolve(buffer: ArrayBuffer, materials: MaterialDefinitions) {
        try {
            this.resolveCallback(OctreeCSG.decode(buffer, materials));
        } catch(e) {
            this.rejectCallback(JobError.DecodeFailure(e));
        }
    }

    reject(error: JobError) {
        this.rejectCallback(error);
    }
}
