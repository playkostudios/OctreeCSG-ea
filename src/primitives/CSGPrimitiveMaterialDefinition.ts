import { MaterialVertexPropertyDefinition, MaterialVertexPropertyDefinitions, MaterialVertexPropertyType } from '../base/MaterialDefinition';

const vertexNormal = <MaterialVertexPropertyDefinition>{
    type: MaterialVertexPropertyType.Vec3,
    transformable: true,
    flippable: true,
}

const CSGPrimitiveMaterialDefinition: MaterialVertexPropertyDefinitions = [vertexNormal];

export default CSGPrimitiveMaterialDefinition;