import type{ MaterialDefinitions } from '../base/MaterialDefinition';
import type { OctreeCSGOptions } from '../base/OctreeCSG';
import type { EncodedOctreeCSGObject } from './EncodedOctreeCSGObject';

type WorkerRequest = {
    type: 'operation',
    jobIndex: number,
    operation: EncodedOctreeCSGObject,
    materials: MaterialDefinitions,
    options: OctreeCSGOptions | undefined,
};

export default WorkerRequest;