import type { vec2, vec3, vec4 } from 'gl-matrix';

export enum MaterialVertexPropertyType {
    Number,
    Vec2,
    Vec3,
    Vec4,
}

export type MaterialVertexProperty = number | vec2 | vec3 | vec4;

export type MaterialVertexPropertyDefinition = Readonly<{
    type: MaterialVertexPropertyType,
    transformable: boolean,
    flippable: boolean,
}>;

export type MaterialVertexPropertyDefinitions = Readonly<Array<MaterialVertexPropertyDefinition>>;

export type MaterialDefinitions = Array<MaterialVertexPropertyDefinitions | null>;