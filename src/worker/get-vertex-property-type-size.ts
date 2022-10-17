import { MaterialAttributeType } from '../base/MaterialDefinition';

export default function getVertexPropertyTypeSize(propertyType: MaterialAttributeType) {
    switch (propertyType) {
        case MaterialAttributeType.Number:
            return 4;
        case MaterialAttributeType.Vec2:
            return 8;
        case MaterialAttributeType.Vec3:
            return 12;
        case MaterialAttributeType.Vec4:
            return 16;
    }

    throw new Error(`Unknown vertex property type ID (${propertyType})`);
}