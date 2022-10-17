import getVertexPropertyTypeSize from './get-vertex-property-type-size';

import type { MaterialDefinitions } from '../base/MaterialDefinition';

export default function countExtraVertexBytes(materialDefinitions: MaterialDefinitions | null, materialID: number) {
    let extraBytes = 0;

    if (materialDefinitions) {
        const materialDefinition = materialDefinitions[materialID];
        if (materialDefinition) {
            for (const property of materialDefinition) {
                extraBytes += getVertexPropertyTypeSize(property.type);
            }
        }
    }

    return extraBytes;
}