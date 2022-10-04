export type EncodedOctreeCSG = [vertexBuffer: Float32Array, normalBuffer: Float32Array];

export type EncodedOctreeCSGObjectArgument = EncodedOctreeCSG | EncodedOctreeCSGObject;

export interface EncodedOctreeCSGBinaryObject {
    op: 'union' | 'subtract' | 'intersect',
    objA: EncodedOctreeCSGObjectArgument,
    objB: EncodedOctreeCSGObjectArgument,
}

export interface EncodedOctreeCSGArrayObject {
    op: 'unionArray' | 'subtractArray' | 'intersectArray',
    objs: Array<EncodedOctreeCSGObjectArgument>,
}

export type EncodedOctreeCSGObject = EncodedOctreeCSGBinaryObject | EncodedOctreeCSGArrayObject;