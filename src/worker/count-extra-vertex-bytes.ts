import getVertexPropertyTypeSize from './get-vertex-property-type-size';

import type { MaterialDefinitions } from '../base/MaterialDefinition';

export default function countExtraVertexBytes(materials: MaterialDefinitions | null, materialID: number) {
    let extraBytes = 0;

    if (materials) {
        const attributes = materials.get(materialID);
        if (attributes) {
            for (const attribute of attributes) {
                extraBytes += getVertexPropertyTypeSize(attribute.valueType);
            }
        }
    }

    return extraBytes;
}