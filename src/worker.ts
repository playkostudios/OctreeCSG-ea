import encodeOctree from './worker/encode-octree';
import decodeOctree from './worker/decode-octree';
import OctreeCSG from './base/OctreeCSG';

import type { EncodedOctreeCSGObject, EncodedOctreeCSGObjectArgument } from './worker/EncodedOctreeCSGObject';
import type { OctreeCSGObject, OctreeCSGObjectArgument } from './base/OctreeCSGObject';
import type WorkerRequest from './worker/WorkerRequest';
import type JobResult from './worker/JobResult';
import type { MaterialDefinitions } from './base/MaterialDefinition';

function decodeOctreeCSGObject(obj: EncodedOctreeCSGObject, materialDefinitions: MaterialDefinitions): OctreeCSGObject {
    switch (obj.op) {
        case 'union':
        case 'subtract':
        case 'intersect':
        {
            return <OctreeCSGObject>{
                op: obj.op,
                objA: decodeOctreeCSGObjectOrCSG(obj.objA, materialDefinitions),
                objB: decodeOctreeCSGObjectOrCSG(obj.objB, materialDefinitions),
            }
        }
        case 'unionArray':
        case 'subtractArray':
        case 'intersectArray':
        {
            const decodedObjs = new Array<OctreeCSGObjectArgument>();

            for (const octreeObj of obj.objs) {
                decodedObjs.push(decodeOctreeCSGObjectOrCSG(octreeObj, materialDefinitions));
            }

            return <OctreeCSGObject>{
                op: obj.op,
                objs: decodedObjs,
            }
        }
        default:
            throw new Error(`Unknown operation: ${(obj as {op: unknown}).op}`);
    }
}

function decodeOctreeCSGObjectOrCSG(obj: EncodedOctreeCSGObjectArgument, materialDefinitions: MaterialDefinitions): OctreeCSGObject | OctreeCSG {
    if (obj instanceof ArrayBuffer) {
        return decodeOctree(obj, materialDefinitions);
    } else {
        return decodeOctreeCSGObject(obj, materialDefinitions);
    }
}

function logWorker(callback: (message: string) => void, message: unknown) {
    callback(`[Worker ${self.name}] ${message}`);
}

globalThis.onmessage = function(message: MessageEvent<WorkerRequest>) {
    switch(message.data.type) {
        case 'operation':
        {
            logWorker(console.debug, `Job started`);

            try {
                const materialDefinitions = message.data.materialDefinitions;
                const result = OctreeCSG.operation(
                    decodeOctreeCSGObject(message.data.operation, materialDefinitions),
                    materialDefinitions,
                    false,
                );

                const transferables = new Array<ArrayBuffer>();
                const buffer = encodeOctree(result, materialDefinitions, transferables);

                postMessage(<JobResult>{
                    success: true,
                    jobIndex: message.data.jobIndex,
                    buffer,
                    materialDefinitions,
                });
            } catch(error) {
                logWorker(console.error, error);
                postMessage(<JobResult>{
                    success: false,
                    jobIndex: message.data.jobIndex,
                    error,
                });
            }

            logWorker(console.debug, `Job finished`);

            break;
        }
        default:
            logWorker(console.error, `Unknown worker request type: ${message.data.type}`);
    }
}

postMessage('initialized');