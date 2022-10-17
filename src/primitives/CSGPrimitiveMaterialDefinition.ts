import { MaterialAttribute, MaterialAttributes, MaterialAttributeType, MaterialAttributeTransform } from '../base/MaterialDefinition';

const vertexNormal = <MaterialAttribute>{
    type: MaterialAttributeType.Vec3,
    transformable: MaterialAttributeTransform.Normal,
    flippable: true,
}

const CSGPrimitiveMaterialDefinition: MaterialAttributes = [vertexNormal];

export default CSGPrimitiveMaterialDefinition;