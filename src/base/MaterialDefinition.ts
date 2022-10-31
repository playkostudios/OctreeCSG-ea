import type { vec2, vec3, vec4 } from 'gl-matrix';

export enum MaterialAttributeValueType {
    Number,
    Vec2,
    Vec3,
    Vec4,
}

export type MaterialAttributeValue = number | vec2 | vec3 | vec4;

export enum MaterialAttributeTransform {
    Model = 0,
    Normal = 1,
}

// XXX standard vertex attribute types grow down so that attribute IDs can be
// assigned from 0 onwards
export enum MaterialAttributeStandardType {
    TextureCoordinate = -1,
    Color = -2,
    Normal = -3,
    Tangent = -4,
}

export type MaterialAttribute = Readonly<{
    type: MaterialAttributeStandardType | number,
    valueType: MaterialAttributeValueType,
    transformable: null | MaterialAttributeTransform,
    flippable: boolean,
}>;

export type MaterialAttributes = Readonly<Array<MaterialAttribute>>;

// XXX it's valid for a material to have no assigned material attributes. if
// this is the case, then a vertex will only have a position
export type MaterialDefinitions = Map<number, MaterialAttributes>;