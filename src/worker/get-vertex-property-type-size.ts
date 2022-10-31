import { MaterialAttributeValueType } from '../base/MaterialDefinition';

export default function getVertexPropertyTypeSize(propertyType: MaterialAttributeValueType) {
    switch (propertyType) {
        case MaterialAttributeValueType.Number:
            return 4;
        case MaterialAttributeValueType.Vec2:
            return 8;
        case MaterialAttributeValueType.Vec3:
            return 12;
        case MaterialAttributeValueType.Vec4:
            return 16;
    }

    throw new Error(`Unknown vertex property type ID (${propertyType})`);
}