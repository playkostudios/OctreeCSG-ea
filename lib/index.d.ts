declare module 'octreecsg-ea/base/CSGRule' {
  import { PolygonState } from 'octreecsg-ea/math/Polygon';
  type CSGRule = {
      array: true;
      rule: PolygonState[];
  } | {
      array: false;
      rule: PolygonState;
  };
  export type CSGRulesArray = CSGRule[];
  export const CSG_Rules: {
      union: {
          a: CSGRulesArray;
          b: CSGRulesArray;
      };
      subtract: {
          a: CSGRulesArray;
          b: CSGRulesArray;
      };
      intersect: {
          a: CSGRulesArray;
          b: CSGRulesArray;
      };
  };
  export {};

}
declare module 'octreecsg-ea/base/OctreeCSG' {
  import Box3 from 'octreecsg-ea/math/Box3';
  import Ray from 'octreecsg-ea/math/Ray';
  import type { Polygon } from 'octreecsg-ea/math/Polygon';
  import type Triangle from 'octreecsg-ea/math/Triangle';
  import TriangleHasher from 'octreecsg-ea/base/TriangleHasher';
  import type { OctreeCSGObject } from 'octreecsg-ea/base/OctreeCSGObject';
  import type { CSGRulesArray } from 'octreecsg-ea/base/CSGRule';
  import { mat3, mat4, vec3 } from 'gl-matrix';
  interface RayIntersect {
      distance: number;
      polygon: Polygon;
      position: vec3;
  }
  export default class OctreeCSG {
      protected polygons: Polygon[];
      protected replacedPolygons: Polygon[];
      protected box?: Box3;
      protected subTrees: OctreeCSG[];
      protected parent: OctreeCSG | null;
      protected level: number;
      protected polygonArrays: Polygon[][];
      static disposeOctree: boolean;
      static useWindingNumber: boolean;
      static maxLevel: number;
      static polygonsPerTree: number;
      constructor(box?: Box3, parent?: OctreeCSG | null);
      clone(): OctreeCSG;
      copy(source: OctreeCSG): this;
      protected addPolygonsArrayToRoot(array: Polygon[]): void;
      protected deletePolygonsArrayFromRoot(array: Polygon[]): void;
      isEmpty(): boolean;
      addPolygon(polygon: Polygon, triangleHasher?: TriangleHasher): this;
      protected split(level: number): this;
      buildTree(): this;
      protected processTree(): void;
      protected expandParentBox(): void;
      getPolygonsIntersectingPolygon(targetPolygon: Polygon, polygons?: Polygon[]): Polygon[];
      getRayPolygons(ray: Ray, polygons?: Set<Polygon>): Set<Polygon>;
      rayIntersect(ray: Ray, intersects?: RayIntersect[]): RayIntersect[];
      getIntersectingPolygons(polygons?: Polygon[]): Polygon[];
      getPolygons(polygons?: Polygon[]): Polygon[];
      invert(): void;
      protected replacePolygon(polygon: Polygon, newPolygons: Polygon[] | Polygon): void;
      protected deletePolygonsByStateRules(rulesArr: CSGRulesArray, firstRun?: boolean): void;
      protected deletePolygonsByIntersection(intersects: boolean, firstRun?: boolean): void;
      isPolygonIntersecting(polygon: Polygon): boolean;
      protected markIntersectingPolygons(targetOctree: OctreeCSG): void;
      protected resetPolygons(resetOriginal?: boolean): void;
      protected handleIntersectingPolygons(targetOctree: OctreeCSG, targetOctreeBuffer?: Float32Array): void;
      delete(deletePolygons?: boolean): void;
      dispose(deletePolygons?: boolean): void;
      protected getPolygonCloneCallback(cbFunc: (polygon: Polygon, triangleHasher: TriangleHasher) => unknown, triangleHasher: TriangleHasher): void;
      protected deleteReplacedPolygons(): void;
      protected markPolygonsAsOriginal(): void;
      applyMatrix(matrix: mat4, normalMatrix?: mat3, firstRun?: boolean): void;
      setPolygonIndex(index: number): void;
      getTriangles(triangles?: Triangle[]): Triangle[];
      getRayTriangles(ray: Ray, triangles?: Triangle[]): Triangle[];
      static union(octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree?: boolean): OctreeCSG;
      static subtract(octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree?: boolean): OctreeCSG;
      static intersect(octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree?: boolean): OctreeCSG;
      static unionArray(objArr: OctreeCSG[], materialIndexMax?: number): OctreeCSG;
      static subtractArray(objArr: OctreeCSG[], materialIndexMax?: number): OctreeCSG;
      static intersectArray(objArr: OctreeCSG[], materialIndexMax?: number): OctreeCSG;
      static operation(obj: OctreeCSGObject, buildTargetOctree?: boolean): OctreeCSG;
      static async: {
          batchSize: number;
          union(octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree?: boolean): Promise<OctreeCSG>;
          subtract(octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree?: boolean): Promise<OctreeCSG>;
          intersect(octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree?: boolean): Promise<OctreeCSG>;
          unionArray(objArr: OctreeCSG[], materialIndexMax?: number): Promise<OctreeCSG>;
          subtractArray(objArr: OctreeCSG[], materialIndexMax?: number): Promise<OctreeCSG>;
          intersectArray(objArr: OctreeCSG[], materialIndexMax?: number): Promise<OctreeCSG>;
          operation(obj: OctreeCSGObject, buildTargetOctree?: boolean): Promise<OctreeCSG>;
      };
      protected static handleIntersectingOctrees(octreeA: OctreeCSG, octreeB: OctreeCSG, bothOctrees?: boolean, octreeA_buffer?: Float32Array, octreeB_buffer?: Float32Array): void;
  }
  export {};

}
declare module 'octreecsg-ea/base/OctreeCSGObject' {
  import type OctreeCSG from 'octreecsg-ea/base/OctreeCSG';
  export type OctreeCSGObjectArgument = OctreeCSG | OctreeCSGObject;
  export interface OctreeCSGBinaryObject {
      op: 'union' | 'subtract' | 'intersect';
      objA: OctreeCSGObjectArgument;
      objB: OctreeCSGObjectArgument;
  }
  export interface OctreeCSGArrayObject {
      op: 'unionArray' | 'subtractArray' | 'intersectArray';
      objs: Array<OctreeCSGObjectArgument>;
  }
  export type OctreeCSGObject = OctreeCSGBinaryObject | OctreeCSGArrayObject;

}
declare module 'octreecsg-ea/base/TriangleHasher' {
  import type Triangle from 'octreecsg-ea/math/Triangle';
  export default class TriangleHasher {
      buckets: Map<number, Triangle[]>;
      isUnique(triangle: Triangle): boolean;
      clear(): void;
  }

}
declare module 'octreecsg-ea/helpers/curve-extrusion-helper' {
  import { vec2, vec3 } from 'gl-matrix';
  import OctreeCSG from 'octreecsg-ea/base/OctreeCSG';
  export interface CurveExtrusionOptions {
      includeBases?: boolean;
      smoothNormals?: boolean;
  }
  export function curveExtrude(polyline: Array<vec2>, positions: Array<vec3>, frames: Array<[r: vec3, s: vec3, t: vec3]>, options?: CurveExtrusionOptions): OctreeCSG;

}
declare module 'octreecsg-ea/helpers/is-clockwise-2d-polygon' {
  import type { vec2 } from 'gl-matrix';
  export default function isClockwise2DPolygon(polyline: Array<vec2>): boolean;

}
declare module 'octreecsg-ea/helpers/is-clockwise-2d-triangle' {
  import type { vec2 } from 'gl-matrix';
  export default function isClockwise2DTriangle(a: vec2, b: vec2, c: vec2): boolean;

}
declare module 'octreecsg-ea/helpers/linear-extrusion-helper' {
  import { vec2 } from 'gl-matrix';
  import OctreeCSG from 'octreecsg-ea/base/OctreeCSG';
  export default function linearExtrude(polyline: Array<vec2>, depth: number, includeBases?: boolean): OctreeCSG;

}
declare module 'octreecsg-ea/helpers/partition-2d-polygon' {
  import { vec2 } from 'gl-matrix';
  export default function partition2DPolygon(polyline: Array<vec2>, output?: Array<Array<vec2>>, isClockwiseHint?: boolean): vec2[][];

}
declare module 'octreecsg-ea/helpers/rmf-extrusion-helper' {
  import { vec3 } from 'gl-matrix';
  import { CurveExtrusionOptions } from 'octreecsg-ea/helpers/curve-extrusion-helper';
  import type { vec2 } from 'gl-matrix';
  export interface RMFCurveExtrusionOptions extends CurveExtrusionOptions {
      endNormal?: vec3;
      twists?: number;
  }
  export function rotationMinimizingCurveExtrude(polyline: Array<vec2>, positions: Array<vec3>, tangents: Array<vec3>, startNormal: vec3, options?: RMFCurveExtrusionOptions): import("octreecsg-ea/index").OctreeCSG;

}
declare module 'octreecsg-ea/helpers/sort-2d-indices' {
  import type { vec2 } from 'gl-matrix';
  export default function sort2DIndices(polyline: Array<vec2>): Array<number>;

}
declare module 'octreecsg-ea/helpers/split-2d-polygon' {
  import { vec2 } from 'gl-matrix';
  export default function split2DPolygon(polyline: Array<vec2>, diagonals: Array<[number, number]>, output?: Array<Array<vec2>>, flip?: boolean): Array<Array<vec2>>;

}
declare module 'octreecsg-ea/helpers/triangulate-2d-polygon' {
  import { vec2 } from 'gl-matrix';
  export default function triangulate2DPolygon(polyline: Array<vec2>, output?: Array<vec2>): Array<vec2>;

}
declare module 'octreecsg-ea/helpers/triangulate-convex-polygon' {
  import Vertex from 'octreecsg-ea/math/Vertex';
  export default function triangulateConvexPolygon(vertices: Array<Vertex>, flip?: boolean, output?: Array<Vertex>, startIndex?: number): [Array<Vertex>, number];

}
declare module 'octreecsg-ea/helpers/triangulate-monotone-2d-polygon' {
  import { vec2 } from 'gl-matrix';
  export default function triangulateMonotone2DPolygon(polyline: Array<vec2>, output?: Array<vec2>, index?: number, isClockwiseHint?: boolean): [triangles: Array<vec2>, lastIndex: number];

}
declare module 'octreecsg-ea/index' {
  export { default as OctreeCSGJobDispatcher } from 'octreecsg-ea/worker/OctreeCSGJobDispatcher';
  export * from 'octreecsg-ea/worker/JobError';
  export { default as OctreeCSG } from 'octreecsg-ea/base/OctreeCSG';
  export { Polygon } from 'octreecsg-ea/math/Polygon';
  export { default as Plane } from 'octreecsg-ea/math/Plane';
  export { default as Vertex } from 'octreecsg-ea/math/Vertex';
  export { Cuboid } from 'octreecsg-ea/primitives/Cuboid';
  export { Cube } from 'octreecsg-ea/primitives/Cube';
  export { CubeSphere, SpherifyPointFunction } from 'octreecsg-ea/primitives/CubeSphere';
  export { Sphere } from 'octreecsg-ea/primitives/Sphere';
  export { UVSphere } from 'octreecsg-ea/primitives/UVSphere';
  export { Cylinder } from 'octreecsg-ea/primitives/Cylinder';
  export { CSGPrimitive, CSGPrimitiveOptions } from 'octreecsg-ea/primitives/CSGPrimitive';
  export { Cone } from 'octreecsg-ea/primitives/Cone';
  export { Pyramid } from 'octreecsg-ea/primitives/Pyramid';
  export { Icosahedron } from 'octreecsg-ea/primitives/Icosahedron';
  export { Icosphere } from 'octreecsg-ea/primitives/Icosphere';
  export { Torus } from 'octreecsg-ea/primitives/Torus';
  export { default as CircularBaseCSGPrimitiveOptions } from 'octreecsg-ea/primitives/CircularBaseCSGPrimitiveOptions';
  export { default as triangulateConvexPolygon } from 'octreecsg-ea/helpers/triangulate-convex-polygon';
  export { default as linearExtrude } from 'octreecsg-ea/helpers/linear-extrusion-helper';
  export { default as isClockwise2DPolygon } from 'octreecsg-ea/helpers/is-clockwise-2d-polygon';
  export { default as partition2DPolygon } from 'octreecsg-ea/helpers/partition-2d-polygon';
  export { default as split2DPolygon } from 'octreecsg-ea/helpers/split-2d-polygon';
  export { default as triangulate2DPolygon } from 'octreecsg-ea/helpers/triangulate-2d-polygon';
  export { default as triangulateMonotone2DPolygon } from 'octreecsg-ea/helpers/triangulate-monotone-2d-polygon';
  export { curveExtrude, CurveExtrusionOptions } from 'octreecsg-ea/helpers/curve-extrusion-helper';
  export { rotationMinimizingCurveExtrude, RMFCurveExtrusionOptions } from 'octreecsg-ea/helpers/rmf-extrusion-helper';
  export { default as makeCirclePolyline } from 'octreecsg-ea/polylines/circle-polyline';
  export { default as makeCubePolyline } from 'octreecsg-ea/polylines/cube-polyline';
  export { default as makeRectanglePolyline } from 'octreecsg-ea/polylines/rectangle-polyline';
  export { default as makeRegularPolyline } from 'octreecsg-ea/polylines/regular-polyline';
  export { default as makeStarPolyline } from 'octreecsg-ea/polylines/star-polyline';

}
declare module 'octreecsg-ea/math/Box3' {
  import type Triangle from 'octreecsg-ea/math/Triangle';
  import type Ray from 'octreecsg-ea/math/Ray';
  import { vec3 } from 'gl-matrix';
  export default class Box3 {
      min: vec3;
      max: vec3;
      constructor(min?: vec3, max?: vec3);
      clone(): Box3;
      expandByPoint(point: Readonly<vec3>): void;
      expandByScalar(scalar: number): void;
      private _project;
      private _testNormal;
      private _testECP;
      intersectsTriangle(triangle: Triangle): boolean;
      intersectsBox(box: Box3): boolean;
      intersectsRay(ray: Ray): boolean;
      containsPoint(point: Readonly<vec3>): boolean;
      makeEmpty(): void;
  }

}
declare module 'octreecsg-ea/math/Line' {
  import type { vec3 } from 'gl-matrix';
  export default interface Line {
      start: vec3;
      end: vec3;
  }

}
declare module 'octreecsg-ea/math/Plane' {
  import { vec3, vec4 } from 'gl-matrix';
  export default class Plane {
      buffer: vec4;
      constructor(buffer: vec4);
      static fromNormal(normal: vec3, w: number): Plane;
      get w(): number;
      set w(w: number);
      get unsafeNormal(): vec3;
      clone(): Plane;
      flip(): void;
      delete(): void;
      equals(p: Plane): boolean;
      static calculateNormal(a: Readonly<vec3>, b: Readonly<vec3>, c: Readonly<vec3>): vec3;
      static fromPoints(a: vec3, b: vec3, c: vec3): Plane;
  }

}
declare module 'octreecsg-ea/math/Polygon' {
  import Triangle from 'octreecsg-ea/math/Triangle';
  import Plane from 'octreecsg-ea/math/Plane';
  import type Vertex from 'octreecsg-ea/math/Vertex';
  import { mat3, mat4, vec3 } from 'gl-matrix';
  export enum PolygonState {
      Undecided = 0,
      Inside = 1,
      Outside = 2,
      CoplanarBack = 3,
      CoplanarFront = 4
  }
  export class Polygon {
      id: number;
      vertices: Vertex[];
      shared?: number;
      plane: Plane;
      triangle: Triangle;
      intersects: boolean;
      state: PolygonState;
      previousState: PolygonState;
      previousStates: PolygonState[];
      valid: boolean;
      coplanar: boolean;
      originalValid: boolean;
      newPolygon: boolean;
      constructor(vertices: Vertex[], shared?: number);
      get midpoint(): Readonly<vec3>;
      applyMatrix(matrix: mat4, normalMatrixIn?: mat3): void;
      reset(resetOriginal?: boolean): void;
      setState(state: PolygonState, keepState?: PolygonState): void;
      checkAllStates(state: PolygonState): boolean;
      setInvalid(): void;
      setValid(): void;
      clone(): Polygon;
      flip(): void;
      delete(): void;
  }

}
declare module 'octreecsg-ea/math/Ray' {
  import { vec3 } from 'gl-matrix';
  export default class Ray {
      origin: vec3;
      direction: vec3;
  }

}
declare module 'octreecsg-ea/math/Triangle' {
  import { vec3 } from 'gl-matrix';
  export default class Triangle {
      a: Readonly<vec3>;
      b: Readonly<vec3>;
      c: Readonly<vec3>;
      private _midpoint?;
      private _hash?;
      constructor(a: Readonly<vec3>, b: Readonly<vec3>, c: Readonly<vec3>);
      static copyAuxValues(source: Triangle, destination: Triangle): void;
      set(a: Readonly<vec3>, b: Readonly<vec3>, c: Readonly<vec3>): void;
      get midpoint(): Readonly<vec3>;
      equals(other: Triangle): boolean;
      private murmur_32_scramble;
      private murmur3_32;
      get hash(): number;
  }

}
declare module 'octreecsg-ea/math/Vertex' {
  import { vec3 } from 'gl-matrix';
  export default class Vertex {
      pos: vec3;
      normal: vec3;
      constructor(pos: vec3, normal: vec3);
      clone(): Vertex;
      flip(): void;
      delete(): void;
      interpolate(other: Vertex, t: number): Vertex;
  }

}
declare module 'octreecsg-ea/math/const-numbers' {
  export const EPSILON = 0.00001;
  export const INV_EPSILON = 100000;
  export const THIRD: number;
  export const TAU: number;
  export const HALF_PI: number;

}
declare module 'octreecsg-ea/math/pointRounding' {
  import type { vec3 } from 'gl-matrix';
  export default function pointRounding(point: vec3, num?: number): vec3;

}
declare module 'octreecsg-ea/math/ray-intersects-triangle' {
  import type Triangle from 'octreecsg-ea/math/Triangle';
  import type Ray from 'octreecsg-ea/math/Ray';
  import { vec3 } from 'gl-matrix';
  export default function rayIntersectsTriangle(ray: Ray, triangle: Triangle, target?: vec3): vec3 | null;

}
declare module 'octreecsg-ea/math/split-polygon' {
  import { Polygon } from 'octreecsg-ea/math/Polygon';
  import type Plane from 'octreecsg-ea/math/Plane';
  export enum ReturnPolygonType {
      Undecided = 0,
      Back = 1,
      Front = 2,
      CoplanarBack = 3,
      CoplanarFront = 4
  }
  interface ReturnPolygon {
      polygon: Polygon;
      type: ReturnPolygonType;
  }
  export function splitPolygonByPlane(polygon: Polygon, plane: Plane, result?: ReturnPolygon[]): ReturnPolygon[];
  export {};

}
declare module 'octreecsg-ea/math/temp' {
  import { mat3, mat4, quat, vec2, vec3 } from 'gl-matrix';
  export const tv0: vec3;
  export const tv1: vec3;
  export const tv2: vec3;
  export const tmpm3: mat3;
  export const tmpm4_0: mat4;
  export const tmpm4_1: mat4;
  export const tv0_2: vec2;
  export const tv1_2: vec2;
  export const tq0: quat;

}
declare module 'octreecsg-ea/math/three-triangle-intersection' {
  import type Triangle from 'octreecsg-ea/math/Triangle';
  import type Line from 'octreecsg-ea/math/Line';
  import { vec3 } from 'gl-matrix';
  interface Additions {
      coplanar: boolean;
      source: vec3;
      target: vec3;
  }
  function triangleIntersectsTriangle(triangleA: Triangle, triangleB: Triangle, additionsIn?: Additions): boolean;
  function lineIntersects(line1: Line, line2: Line, points?: vec3[]): boolean;
  function getLines(triangle: Triangle): Line[];
  function checkTrianglesIntersection(triangle1: Triangle, triangle2: Triangle, additions?: Additions): boolean;
  export { triangleIntersectsTriangle, checkTrianglesIntersection, getLines, lineIntersects };

}
declare module 'octreecsg-ea/math/winding-number' {
  import type { Polygon } from 'octreecsg-ea/math/Polygon';
  import { vec3 } from 'gl-matrix';
  export const _wP_EPS_ARR: vec3[];
  export function polyInside_WindingNumber_buffer(trianglesArr: Float32Array, point: Readonly<vec3>, coplanar: boolean): boolean;
  export function prepareTriangleBuffer(polygons: Polygon[]): Float32Array;

}
declare module 'octreecsg-ea/polylines/circle-polyline' {
  import type { vec2 } from 'gl-matrix';
  export default function makeCirclePolyline(radius: number, clockwise?: boolean, subDivisions?: number): Array<vec2>;

}
declare module 'octreecsg-ea/polylines/cube-polyline' {
  import { vec2 } from 'gl-matrix';
  export default function makeCubePolyline(length: number, clockwise?: boolean): Array<vec2>;

}
declare module 'octreecsg-ea/polylines/rectangle-polyline' {
  import { vec2 } from 'gl-matrix';
  export default function makeRectanglePolyline(width: number, height: number, clockwise?: boolean): Array<vec2>;

}
declare module 'octreecsg-ea/polylines/regular-polyline' {
  import { vec2 } from 'gl-matrix';
  export default function makeRegularPolyline(radius: number, sides: number, clockwise?: boolean): Array<vec2>;

}
declare module 'octreecsg-ea/polylines/star-polyline' {
  import { vec2 } from 'gl-matrix';
  export default function makeStarPolyline(outerRadius: number, innerRadius: number, sides: number, clockwise?: boolean): Array<vec2>;

}
declare module 'octreecsg-ea/primitives/BaseCone' {
  import { CSGPrimitive } from 'octreecsg-ea/primitives/CSGPrimitive';
  import type { CSGPrimitiveOptions } from 'octreecsg-ea/primitives/CSGPrimitive';
  export class BaseCone extends CSGPrimitive {
      constructor(baseVertices: number, smoothNormals: boolean, diameter: number, length: number, options?: CSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/CSGPrimitive' {
  import { mat4, quat, vec3 } from 'gl-matrix';
  import OctreeCSG from 'octreecsg-ea/base/OctreeCSG';
  import type { mat3 } from 'gl-matrix';
  import type Vertex from 'octreecsg-ea/math/Vertex';
  import type Box3 from 'octreecsg-ea/math/Box3';
  export type CSGPrimitiveOptions = {
      matrix: mat4;
      normalMatrix?: mat3;
  } | {
      rotation?: quat;
      translation?: vec3;
      scale?: vec3;
  };
  export class CSGPrimitive extends OctreeCSG {
      constructor(box: Box3, triangleVertices: Array<Vertex>, options?: CSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/CircularBaseCSGPrimitiveOptions' {
  import type { CSGPrimitiveOptions } from 'octreecsg-ea/primitives/CSGPrimitive';
  type CircularBaseCSGPrimitiveOptions = CSGPrimitiveOptions & {
      subDivisions?: number;
  };
  export default CircularBaseCSGPrimitiveOptions;

}
declare module 'octreecsg-ea/primitives/Cone' {
  import { BaseCone } from 'octreecsg-ea/primitives/BaseCone';
  import type CircularBaseCSGPrimitiveOptions from 'octreecsg-ea/primitives/CircularBaseCSGPrimitiveOptions';
  export class Cone extends BaseCone {
      constructor(diameter?: number, length?: number, options?: CircularBaseCSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/Cube' {
  import { Cuboid } from 'octreecsg-ea/primitives/Cuboid';
  import type { CSGPrimitiveOptions } from 'octreecsg-ea/primitives/CSGPrimitive';
  export class Cube extends Cuboid {
      constructor(length?: number, options?: CSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/CubeSphere' {
  import { vec3 } from 'gl-matrix';
  import { CSGPrimitive } from 'octreecsg-ea/primitives/CSGPrimitive';
  import type { CSGPrimitiveOptions } from 'octreecsg-ea/primitives/CSGPrimitive';
  export type SphereCSGPrimitiveOptions = CSGPrimitiveOptions & {
      subDivisions?: number;
  };
  export type SpherifyPointFunction = (ip: number, jp: number, radius: number, origin: vec3, right: vec3, up: vec3) => [pos: vec3, normal: vec3];
  export class CubeSphere extends CSGPrimitive {
      constructor(spherifyPoint: SpherifyPointFunction, diameter?: number, options?: SphereCSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/Cuboid' {
  import { CSGPrimitive } from 'octreecsg-ea/primitives/CSGPrimitive';
  import type { CSGPrimitiveOptions } from 'octreecsg-ea/primitives/CSGPrimitive';
  export class Cuboid extends CSGPrimitive {
      constructor(xLength: number, yLength: number, zLength: number, options?: CSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/Cylinder' {
  import { CSGPrimitive } from 'octreecsg-ea/primitives/CSGPrimitive';
  import type CircularBaseCSGPrimitiveOptions from 'octreecsg-ea/primitives/CircularBaseCSGPrimitiveOptions';
  export class Cylinder extends CSGPrimitive {
      constructor(diameter?: number, length?: number, options?: CircularBaseCSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/Icosahedron' {
  import { CSGPrimitive } from 'octreecsg-ea/primitives/CSGPrimitive';
  import type { CSGPrimitiveOptions } from 'octreecsg-ea/primitives/CSGPrimitive';
  export class Icosahedron extends CSGPrimitive {
      constructor(diameter?: number, options?: CSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/Icosphere' {
  import { CSGPrimitive } from 'octreecsg-ea/primitives/CSGPrimitive';
  import type { CSGPrimitiveOptions } from 'octreecsg-ea/primitives/CSGPrimitive';
  export type IcosphereCSGPrimitiveOptions = CSGPrimitiveOptions & {
      subDivisions?: number;
  };
  export class Icosphere extends CSGPrimitive {
      constructor(diameter?: number, options?: IcosphereCSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/Pyramid' {
  import { BaseCone } from 'octreecsg-ea/primitives/BaseCone';
  import type { CSGPrimitiveOptions } from 'octreecsg-ea/primitives/CSGPrimitive';
  export class Pyramid extends BaseCone {
      constructor(sides: number, diameter?: number, length?: number, options?: CSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/Sphere' {
  import { CubeSphere } from 'octreecsg-ea/primitives/CubeSphere';
  import type { SphereCSGPrimitiveOptions } from 'octreecsg-ea/primitives/CubeSphere';
  export class Sphere extends CubeSphere {
      constructor(diameter?: number, options?: SphereCSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/Torus' {
  import { CSGPrimitive } from 'octreecsg-ea/primitives/CSGPrimitive';
  import type { CSGPrimitiveOptions } from 'octreecsg-ea/primitives/CSGPrimitive';
  export type TorusCSGPrimitiveOptions = CSGPrimitiveOptions & {
      radialSubDivisions?: number;
      tubularSubDivisions?: number;
  };
  export class Torus extends CSGPrimitive {
      constructor(outerDiameter?: number, innerDiameter?: number, options?: TorusCSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/UVSphere' {
  import { CubeSphere } from 'octreecsg-ea/primitives/CubeSphere';
  import type { SphereCSGPrimitiveOptions } from 'octreecsg-ea/primitives/CubeSphere';
  export class UVSphere extends CubeSphere {
      constructor(diameter?: number, options?: SphereCSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/icosahedron-make-triangles' {
  import { vec3 } from 'gl-matrix';
  import Vertex from 'octreecsg-ea/math/Vertex';
  export default function makeIcosahedronTriangles(addTriangle: (vertices: Array<Vertex>, index: number, radius: number, a: Readonly<vec3>, b: Readonly<vec3>, c: Readonly<vec3>) => number, vertices: Array<Vertex>, radius: number): void;

}
declare module 'octreecsg-ea/primitives/make-circular-base' {
  import { vec3 } from 'gl-matrix';
  import Vertex from 'octreecsg-ea/math/Vertex';
  export type CircularPrecalcArr = Array<[x: number, z: number, normal?: vec3]>;
  export type CircularPrecalcArrNoNormal = Array<[x: number, z: number]>;
  export type CircularPrecalcArrNormal = Array<[x: number, z: number, normal: vec3]>;
  export function makeCircularBase(vertices: Array<Vertex>, xzn: CircularPrecalcArr, y: number, normal: vec3, index: number, flip: boolean): number;
  export function precalcCircularBase(subDivs: number, radius: number, generateNormals: false): CircularPrecalcArrNoNormal;
  export function precalcCircularBase(subDivs: number, radius: number, generateNormals: true): CircularPrecalcArrNormal;
  export function precalcCircularBase(subDivs: number, radius: number, generateNormals: boolean): CircularPrecalcArr;

}
declare module 'octreecsg-ea/worker/EncodedOctreeCSGObject' {
  export type EncodedOctreeCSG = [vertexBuffer: Float32Array, normalBuffer: Float32Array];
  export type EncodedOctreeCSGObjectArgument = EncodedOctreeCSG | EncodedOctreeCSGObject;
  export interface EncodedOctreeCSGBinaryObject {
      op: 'union' | 'subtract' | 'intersect';
      objA: EncodedOctreeCSGObjectArgument;
      objB: EncodedOctreeCSGObjectArgument;
  }
  export interface EncodedOctreeCSGArrayObject {
      op: 'unionArray' | 'subtractArray' | 'intersectArray';
      objs: Array<EncodedOctreeCSGObjectArgument>;
  }
  export type EncodedOctreeCSGObject = EncodedOctreeCSGBinaryObject | EncodedOctreeCSGArrayObject;

}
declare module 'octreecsg-ea/worker/Job' {
  import OctreeCSG from 'octreecsg-ea/base/OctreeCSG';
  import { JobError } from 'octreecsg-ea/worker/JobError';
  import type { OctreeCSGObject } from 'octreecsg-ea/base/OctreeCSGObject';
  import type WorkerRequest from 'octreecsg-ea/worker/WorkerRequest';
  export default class Job {
      private resolveCallback;
      private rejectCallback;
      private operation;
      private transferables;
      workerIndex: number | null;
      constructor(operation: OctreeCSGObject, resolveCallback: (octree: OctreeCSG) => void, rejectCallback: (error: JobError) => void);
      getMessage(workerIndex: number, jobIndex: number): [message: WorkerRequest, transferables: Array<ArrayBuffer>];
      resolve(vertexBuffer: Float32Array, normalBuffer: Float32Array): void;
      reject(error: JobError): void;
  }

}
declare module 'octreecsg-ea/worker/JobError' {
  export enum JobFailReason {
      WorkerCreationFailure = 0,
      OperationFailure = 1,
      DecodeFailure = 2
  }
  export class JobError extends Error {
      failReason: JobFailReason;
      originalError: string;
      constructor(failReason: JobFailReason, originalError: string);
      static WorkerCreationFailure(originalError: unknown): JobError;
      static OperationFailure(originalError: unknown): JobError;
      static DecodeFailure(originalError: unknown): JobError;
  }

}
declare module 'octreecsg-ea/worker/JobResult' {
  type JobResult = {
      success: true;
      jobIndex: number;
      vertices: Float32Array;
      normals: Float32Array;
  } | {
      success: false;
      jobIndex: number;
      error: unknown;
  };
  export default JobResult;

}
declare module 'octreecsg-ea/worker/OctreeCSGJobDispatcher' {
  import type { OctreeCSGObject } from 'octreecsg-ea/base/OctreeCSGObject';
  import type OctreeCSG from 'octreecsg-ea/base/OctreeCSG';
  global {
      var globalOctreeCSGJobDispatcher: OctreeCSGJobDispatcher | null | undefined;
  }
  export default class OctreeCSGJobDispatcher {
      private workers;
      private nextJobIndex;
      private waitingJobs;
      private jobCounts;
      private initWorker;
      private init;
      private makeMessageHandler;
      private handleMessage;
      private doDispatch;
      dispatch(operation: OctreeCSGObject): Promise<OctreeCSG>;
      static create(workerPath: string, workerCount: number, timeoutMS: number): Promise<void>;
  }

}
declare module 'octreecsg-ea/worker/WorkerRequest' {
  import type { EncodedOctreeCSGObject } from 'octreecsg-ea/worker/EncodedOctreeCSGObject';
  type WorkerRequest = {
      type: 'operation';
      jobIndex: number;
      operation: EncodedOctreeCSGObject;
  };
  export default WorkerRequest;

}
declare module 'octreecsg-ea/worker/decode-octree' {
  import OctreeCSG from 'octreecsg-ea/base/OctreeCSG';
  export default function decodeOctree(vertexBuffer: Float32Array, normalBuffer: Float32Array): OctreeCSG;

}
declare module 'octreecsg-ea/worker/encode-octree' {
  import type { EncodedOctreeCSG } from 'octreecsg-ea/worker/EncodedOctreeCSGObject';
  import type OctreeCSG from 'octreecsg-ea/base/OctreeCSG';
  export default function encodeOctree(obj: OctreeCSG, transferables: Array<ArrayBuffer>): EncodedOctreeCSG;

}
declare module 'octreecsg-ea/worker' {
  export {};

}
declare module 'octreecsg-ea' {
  import main = require('octreecsg-ea/index');
  export = main;
}