import type { vec2, vec3, vec4 } from 'gl-matrix';

export enum MaterialAttributeType {
    Number,
    Vec2,
    Vec3,
    Vec4,
}

export type MaterialAttributeValue = number | vec2 | vec3 | vec4;

export enum MaterialAttributeTransform {
    Model,
    Normal,
}

export type MaterialAttribute = Readonly<{
    type: MaterialAttributeType,
    transformable: null | MaterialAttributeTransform,
    flippable: boolean,
}>;

export type MaterialAttributes = Readonly<Array<MaterialAttribute>>;

export type MaterialDefinitions = Array<MaterialAttributes | null>;