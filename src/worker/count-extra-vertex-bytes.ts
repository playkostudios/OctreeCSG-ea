import getVertexPropertyTypeSize from './get-vertex-property-type-size';

import type { MaterialDefinitions } from '../base/MaterialDefinition';

export default function countExtraVertexBytes(materialDefinitions: MaterialDefinitions | null, materialID: number) {
    let extraBytes = 0;

    if (materialDefinitions) {
        const attributes = materialDefinitions.get(materialID);
        if (attributes) {
            for (const attribute of attributes) {
                extraBytes += getVertexPropertyTypeSize(attribute.valueType);
            }
        }
    }

    return extraBytes;
}