import { MaterialAttribute, MaterialAttributes, MaterialAttributeValueType, MaterialAttributeTransform, MaterialAttributeStandardType } from '../base/MaterialDefinition';

const vertexNormal = <MaterialAttribute>{
    type: MaterialAttributeStandardType.Normal,
    valueType: MaterialAttributeValueType.Vec3,
    transformable: MaterialAttributeTransform.Normal,
    flippable: true,
}

const CSGPrimitiveMaterialAttributes: MaterialAttributes = [vertexNormal];

export default CSGPrimitiveMaterialAttributes;