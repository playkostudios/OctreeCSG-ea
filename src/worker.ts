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
    if (Array.isArray(obj)) {
        return decodeOctree(...obj);
    } else {
        return decodeOctreeCSGObject(obj);
    }
}

globalThis.onmessage = function(message: MessageEvent<WorkerRequest>) {
    switch(message.data.type) {
        case 'operation':
        {
            console.log('GOT REQUEST', message.data);
            try {
                const result = OctreeCSG.operation(
                    decodeOctreeCSGObject(message.data.operation),
                    false,
                );

                const transferables = new Array<ArrayBuffer>();
                const [vertices, normals] = encodeOctree(result, transferables);

                postMessage(<JobResult>{
                    success: true,
                    jobIndex: message.data.jobIndex,
                    vertices,
                    normals,
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

console.debug('Worker started');
postMessage('initialized');