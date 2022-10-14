import type{ MaterialDefinitions } from '../base/MaterialDefinition';
import type { EncodedOctreeCSGObject } from './EncodedOctreeCSGObject';

type WorkerRequest = {
    type: 'operation',
    jobIndex: number,
    operation: EncodedOctreeCSGObject,
    materialDefinitions: MaterialDefinitions,
};

export default WorkerRequest;