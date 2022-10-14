import encodeOctree from './worker/encode-octree';
import decodeOctree from './worker/decode-octree';
import OctreeCSG from './base/OctreeCSG';

import type { EncodedOctreeCSGObject, EncodedOctreeCSGObjectArgument } from './worker/EncodedOctreeCSGObject';
import type { OctreeCSGObject, OctreeCSGObjectArgument } from './base/OctreeCSGObject';
import type WorkerRequest from './worker/WorkerRequest';
import type JobResult from './worker/JobResult';

function decodeOctreeCSGObject(obj: EncodedOctreeCSGObject): OctreeCSGObject {
    switch (obj.op) {
        case 'union':
        case 'subtract':
        case 'intersect':
        {
            return <OctreeCSGObject>{
                op: obj.op,
                objA: decodeOctreeCSGObjectOrCSG(obj.objA),
                objB: decodeOctreeCSGObjectOrCSG(obj.objB),
            }
        }
        case 'unionArray':
        case 'subtractArray':
        case 'intersectArray':
        {
            const decodedObjs = new Array<OctreeCSGObjectArgument>();

            for (const octreeObj of obj.objs) {
                decodedObjs.push(decodeOctreeCSGObjectOrCSG(octreeObj));
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

function decodeOctreeCSGObjectOrCSG(obj: EncodedOctreeCSGObjectArgument): OctreeCSGObject | OctreeCSG {
    if (obj instanceof ArrayBuffer) {
        return decodeOctree(obj);
    } else {
        return decodeOctreeCSGObject(obj);
    }
}

globalThis.onmessage = function(message: MessageEvent<WorkerRequest>) {
    switch(message.data.type) {
        case 'operation':
        {
            try {
                const materialDefinitions = message.data.materialDefinitions;
                const result = OctreeCSG.operation(
                    decodeOctreeCSGObject(message.data.operation),
                    materialDefinitions,
                    false,
                );

                const transferables = new Array<ArrayBuffer>();
                const buffer = encodeOctree(result, materialDefinitions, transferables);

                postMessage(<JobResult>{
                    success: true,
                    jobIndex: message.data.jobIndex,
                    buffer,
                });
            } catch(error) {
                postMessage(<JobResult>{
                    success: false,
                    jobIndex: message.data.jobIndex,
                    error,
                });
            }
            break;
        }
        default:
            console.error(`Unknown worker request type: ${message.data.type}`);
    }
}

postMessage('initialized');