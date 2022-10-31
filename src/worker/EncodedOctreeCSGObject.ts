export type EncodedOctreeCSG = ArrayBuffer;

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