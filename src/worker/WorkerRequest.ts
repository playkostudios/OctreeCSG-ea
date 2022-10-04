import type { EncodedOctreeCSGObject } from './EncodedOctreeCSGObject';

type WorkerRequest = {
    type: 'operation',
    jobIndex: number,
    operation: EncodedOctreeCSGObject,
};

export default WorkerRequest;