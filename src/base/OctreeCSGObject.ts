import type OctreeCSG from './OctreeCSG';

export type OctreeCSGObjectArgument = OctreeCSG | OctreeCSGObject;

export interface OctreeCSGBinaryObject {
    op: 'union' | 'subtract' | 'intersect',
    objA: OctreeCSGObjectArgument,
    objB: OctreeCSGObjectArgument,
}

export interface OctreeCSGArrayObject {
    op: 'unionArray' | 'subtractArray' | 'intersectArray',
    objs: Array<OctreeCSGObjectArgument>,
}

export type OctreeCSGObject = OctreeCSGBinaryObject | OctreeCSGArrayObject;