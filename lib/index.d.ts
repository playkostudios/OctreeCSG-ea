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
declare module 'octreecsg-ea/base/MaterialDefinition' {
  import type { vec2, vec3, vec4 } from 'gl-matrix';
  export enum MaterialAttributeValueType {
      Number = 0,
      Vec2 = 1,
      Vec3 = 2,
      Vec4 = 3
  }
  export type MaterialAttributeValue = number | vec2 | vec3 | vec4;
  export enum MaterialAttributeTransform {
      Model = 0,
      Normal = 1
  }
  export enum MaterialAttributeStandardType {
      TextureCoordinate = -1,
      Color = -2,
      Normal = -3,
      Tangent = -4
  }
  export type MaterialAttribute = Readonly<{
      type: MaterialAttributeStandardType | number;
      valueType: MaterialAttributeValueType;
      transformable: null | MaterialAttributeTransform;
      flippable: boolean;
  }>;
  export type MaterialAttributes = Readonly<Array<MaterialAttribute>>;
  export type MaterialDefinitions = Map<number, MaterialAttributes>;

}
declare module 'octreecsg-ea/base/OctreeCSG' {
  import Box3 from 'octreecsg-ea/math/Box3';
  import Ray from 'octreecsg-ea/math/Ray';
  import { mat3, mat4, vec3 } from 'gl-matrix';
  import { MaterialDefinitions } from 'octreecsg-ea/base/MaterialDefinition';
  import TriangleHasher from 'octreecsg-ea/base/TriangleHasher';
  import { Polygon } from 'octreecsg-ea/math/Polygon';
  import type Triangle from 'octreecsg-ea/math/Triangle';
  import type { OctreeCSGObject } from 'octreecsg-ea/base/OctreeCSGObject';
  import type { CSGRulesArray } from 'octreecsg-ea/base/CSGRule';
  import type { EncodedOctreeCSG } from 'octreecsg-ea/worker/EncodedOctreeCSGObject';
  interface RayIntersect {
      distance: number;
      polygon: Polygon;
      position: vec3;
  }
  export interface OctreeCSGOptions {
      useWindingNumber?: boolean;
      maxLevel?: number;
      polygonsPerTree?: number;
  }
  export interface AsyncOctreeCSGOptions extends OctreeCSGOptions {
      batchSize?: number;
  }
  export default class OctreeCSG {
      materials: Readonly<MaterialDefinitions>;
      protected polygons: Polygon[];
      protected replacedPolygons: Polygon[];
      protected box?: Box3;
      protected subTrees: OctreeCSG[];
      protected parent: OctreeCSG | null;
      protected level: number;
      protected polygonArrays: Polygon[][];
      protected needsRebuild: boolean;
      static readonly maxSectionID: number;
      static readonly maxMaterialID: number;
      constructor(materials: Readonly<MaterialDefinitions>, box?: Box3, parent?: OctreeCSG | null);
      clone(): OctreeCSG;
      copy(source: OctreeCSG): this;
      protected addPolygonsArrayToRoot(array: Polygon[]): void;
      protected deletePolygonsArrayFromRoot(array: Polygon[]): void;
      isEmpty(): boolean;
      addPolygon(polygon: Polygon, triangleHasher?: TriangleHasher): this;
      private getSubtreeIdx;
      protected split(level: number, maxLevel: number, polygonsPerTree: number): this | undefined;
      buildTree(maxLevel?: number, polygonsPerTree?: number): this;
      protected processTree(): void;
      protected expandParentBox(): void;
      getPolygonsIntersectingPolygon(targetPolygon: Polygon, polygons?: Polygon[]): Polygon[];
      getRayPolygons(ray: Ray, polygons?: Set<Polygon>): Set<Polygon>;
      rayIntersect(ray: Ray, intersects?: RayIntersect[]): RayIntersect[];
      private handlePolyIntersection;
      private marchingClosestRayIntersection;
      closestRayIntersection(ray: Ray): RayIntersect | null;
      getIntersectingPolygons(polygons?: Polygon[]): Polygon[];
      getPolygons(polygons?: Polygon[]): Polygon[];
      private levelPolygonsGen;
      get levelPolygons(): Generator<Polygon, any, unknown>;
      private treePolygonsGen;
      get treePolygons(): Generator<Polygon, any, unknown>;
      private lowerLevelsGen;
      get lowerLevels(): Generator<OctreeCSG, any, unknown>;
      invert(): void;
      protected replacePolygon(polygon: Polygon, newPolygons: Polygon[] | Polygon): void;
      protected deletePolygonsByStateRules(rulesArr: CSGRulesArray, firstRun?: boolean): void;
      protected deletePolygonsByIntersection(intersects: boolean, firstRun?: boolean): void;
      isPolygonIntersecting(polygon: Polygon): boolean;
      protected markIntersectingPolygons(targetOctree: OctreeCSG): void;
      protected resetPolygons(resetOriginal?: boolean): void;
      protected handleIntersectingPolygons(targetOctree: OctreeCSG, useWindingNumber: boolean, targetOctreeBuffer?: Float32Array): void;
      delete(deletePolygons?: boolean): void;
      dispose(deletePolygons?: boolean): void;
      private countEncodingBytes;
      private encodeBytes;
      encode(materials: MaterialDefinitions, transferables: Array<ArrayBuffer>): EncodedOctreeCSG;
      private static decodeBytes;
      static decode(buffer: ArrayBuffer, materials: MaterialDefinitions): OctreeCSG;
      protected getPolygonCloneCallback(cbFunc: (polygon: Polygon, triangleHasher: TriangleHasher) => unknown, triangleHasher: TriangleHasher): void;
      protected deleteReplacedPolygons(): void;
      protected markPolygonsAsOriginal(): void;
      applyMatrix(matrix: mat4, normalMatrix?: mat3, firstRun?: boolean, needsNormalMatrix?: boolean): void;
      setPolygonIndex(index: number): void;
      getTriangles(triangles?: Triangle[]): Triangle[];
      getRayTriangles(ray: Ray, triangles?: Triangle[]): Triangle[];
      static union(octreeA: OctreeCSG, octreeB: OctreeCSG, options?: OctreeCSGOptions): OctreeCSG;
      static subtract(octreeA: OctreeCSG, octreeB: OctreeCSG, options?: OctreeCSGOptions): OctreeCSG;
      static intersect(octreeA: OctreeCSG, octreeB: OctreeCSG, options?: OctreeCSGOptions): OctreeCSG;
      static unionArray(objArr: OctreeCSG[], options?: OctreeCSGOptions): OctreeCSG;
      static subtractArray(objArr: OctreeCSG[], options?: OctreeCSGOptions): OctreeCSG;
      static intersectArray(objArr: OctreeCSG[], options?: OctreeCSGOptions): OctreeCSG;
      static operation(obj: OctreeCSGObject, options?: OctreeCSGOptions): OctreeCSG;
      static async: {
          union(octreeA: OctreeCSG, octreeB: OctreeCSG, options?: AsyncOctreeCSGOptions): Promise<OctreeCSG>;
          subtract(octreeA: OctreeCSG, octreeB: OctreeCSG, options?: AsyncOctreeCSGOptions): Promise<OctreeCSG>;
          intersect(octreeA: OctreeCSG, octreeB: OctreeCSG, options?: AsyncOctreeCSGOptions): Promise<OctreeCSG>;
          unionArray(objArr: OctreeCSG[], options?: AsyncOctreeCSGOptions): Promise<OctreeCSG>;
          subtractArray(objArr: OctreeCSG[], options?: AsyncOctreeCSGOptions): Promise<OctreeCSG>;
          intersectArray(objArr: OctreeCSG[], options?: AsyncOctreeCSGOptions): Promise<OctreeCSG>;
          operation(obj: OctreeCSGObject, options?: AsyncOctreeCSGOptions): Promise<OctreeCSG>;
      };
      protected static handleIntersectingOctrees(octreeA: OctreeCSG, octreeB: OctreeCSG, useWindingNumber: boolean, bothOctrees?: boolean, octreeA_buffer?: Float32Array, octreeB_buffer?: Float32Array): void;
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
declare module 'octreecsg-ea/base/merge-materials' {
  import OctreeCSG from 'octreecsg-ea/base/OctreeCSG';
  import type { MaterialDefinitions } from 'octreecsg-ea/base/MaterialDefinition';
  export function mergeTwoMaterials(first: Readonly<MaterialDefinitions>, second: Readonly<MaterialDefinitions>): MaterialDefinitions;
  export function mergeMaterials(materialsOrOctrees: Array<Readonly<MaterialDefinitions> | Readonly<OctreeCSG>>): MaterialDefinitions;

}
declare module 'octreecsg-ea/helpers/curve-extrusion-helper' {
  import { vec2, vec3 } from 'gl-matrix';
  import OctreeCSG from 'octreecsg-ea/base/OctreeCSG';
  import type { CurveFrames } from 'octreecsg-ea/helpers/curve-frame';
  export interface CurveExtrusionOptions {
      includeBases?: boolean;
      smoothNormals?: boolean;
      materialID?: number;
  }
  export function curveExtrude(polyline: Array<vec2>, positions: Array<vec3>, frames: CurveFrames, options?: CurveExtrusionOptions): OctreeCSG;

}
declare module 'octreecsg-ea/helpers/curve-frame' {
  import type { vec3 } from 'gl-matrix';
  /**
   * A frame (point directions) of a curve.
   * r: normal
   * s: binormal
   * t: tangent
   */
  export type CurveFrame = [r: vec3, s: vec3, t: vec3];
  export type CurveFrames = Array<CurveFrame>;

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
  import type { CurveExtrusionOptions } from 'octreecsg-ea/helpers/curve-extrusion-helper';
  import type { vec2 } from 'gl-matrix';
  export default function linearExtrude(polyline: Array<vec2>, depth: number, options?: CurveExtrusionOptions): import("octreecsg-ea/index").OctreeCSG;

}
declare module 'octreecsg-ea/helpers/make-rotation-minimizing-frames' {
  import { vec3 } from 'gl-matrix';
  import type { CurveFrames } from 'octreecsg-ea/helpers/curve-frame';
  export interface RMFOptions {
      endNormal?: vec3;
      twists?: number;
  }
  export function makeRotationMinimizingFrames(positions: Array<vec3>, tangents: Array<vec3>, startNormal: vec3, options?: RMFOptions): CurveFrames;

}
declare module 'octreecsg-ea/helpers/partition-2d-polygon' {
  import { vec2 } from 'gl-matrix';
  export default function partition2DPolygon(polyline: Array<vec2>, output?: Array<Array<vec2>>, isClockwiseHint?: boolean): vec2[][];

}
declare module 'octreecsg-ea/helpers/rmf-extrusion-helper' {
  import type { CurveExtrusionOptions } from 'octreecsg-ea/helpers/curve-extrusion-helper';
  import type { vec2, vec3 } from 'gl-matrix';
  import type { RMFOptions } from 'octreecsg-ea/helpers/make-rotation-minimizing-frames';
  export type RMFCurveExtrusionOptions = CurveExtrusionOptions & RMFOptions;
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
  export { makeRotationMinimizingFrames } from 'octreecsg-ea/helpers/make-rotation-minimizing-frames';
  export * from 'octreecsg-ea/helpers/curve-frame';
  export { default as makeCirclePolyline } from 'octreecsg-ea/polylines/circle-polyline';
  export { default as makeCubePolyline } from 'octreecsg-ea/polylines/cube-polyline';
  export { default as makeRectanglePolyline } from 'octreecsg-ea/polylines/rectangle-polyline';
  export { default as makeRegularPolyline } from 'octreecsg-ea/polylines/regular-polyline';
  export { default as makeStarPolyline } from 'octreecsg-ea/polylines/star-polyline';
  export { default as CSGPrimitiveMaterialAttributes } from 'octreecsg-ea/primitives/CSGPrimitiveMaterialAttributes';
  export * from 'octreecsg-ea/base/MaterialDefinition';
  export * from 'octreecsg-ea/projectors/Projector';
  export * from 'octreecsg-ea/projectors/FlatProjector';
  export * from 'octreecsg-ea/projectors/TubeProjector';
  export * from 'octreecsg-ea/projectors/SphereProjector';
  export * from 'octreecsg-ea/projectors/CurveTubeProjector';

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
      rayIntersection(ray: Ray, output: vec3): boolean;
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
  import { MaterialDefinitions, MaterialAttributes } from 'octreecsg-ea/base/MaterialDefinition';
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
      shared: number;
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
      applyMatrixNoAuto(attributes: MaterialAttributes | undefined, matrix: mat4, normalMatrix: mat3 | undefined): void;
      applyMatrix(materials: MaterialDefinitions, matrix: mat4, normalMatrixIn?: mat3): void;
      reset(resetOriginal?: boolean): void;
      setState(state: PolygonState, keepState?: PolygonState): void;
      checkAllStates(state: PolygonState): boolean;
      setInvalid(): void;
      setValid(): void;
      clone(): Polygon;
      flip(materials: MaterialDefinitions): void;
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
  import { mat3, mat4, vec3 } from 'gl-matrix';
  import { MaterialAttributes, MaterialAttributeValue } from 'octreecsg-ea/base/MaterialDefinition';
  export default class Vertex {
      pos: vec3;
      extra?: MaterialAttributeValue[] | undefined;
      constructor(pos: vec3, extra?: MaterialAttributeValue[] | undefined);
      clone(): Vertex;
      flip(attributes: MaterialAttributes | undefined): void;
      applyMatrix(matrix: mat4, normalMatrix: mat3 | undefined, attributes: MaterialAttributes | undefined): void;
      delete(): void;
      interpolate(other: Vertex, t: number, attributes: MaterialAttributes | undefined): Vertex;
  }

}
declare module 'octreecsg-ea/math/const-numbers' {
  export const EPSILON = 0.00001;
  export const INV_EPSILON = 100000;
  export const THIRD: number;
  export const TAU: number;
  export const HALF_PI: number;

}
declare module 'octreecsg-ea/math/lerp' {
  export default function lerp(a: number, b: number, t: number): number;

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
  import { MaterialDefinitions } from 'octreecsg-ea/base/MaterialDefinition';
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
  export function splitPolygonByPlane(polygon: Polygon, plane: Plane, materials: MaterialDefinitions, result?: ReturnPolygon[]): ReturnPolygon[];
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
      materialID?: number;
      outputMatrix?: mat4;
      inverted?: boolean;
  } & ({
      matrix: mat4;
      normalMatrix?: mat3;
  } | {
      rotation?: quat | vec3;
      translation?: vec3;
      scale?: vec3;
  } | {});
  export class CSGPrimitive extends OctreeCSG {
      constructor(box: Box3, triangleVertices: Array<Vertex>, options?: CSGPrimitiveOptions);
  }

}
declare module 'octreecsg-ea/primitives/CSGPrimitiveMaterialAttributes' {
  import { MaterialAttributes } from 'octreecsg-ea/base/MaterialDefinition';
  const CSGPrimitiveMaterialAttributes: MaterialAttributes;
  export default CSGPrimitiveMaterialAttributes;

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
declare module 'octreecsg-ea/projectors/CurveTubeProjector' {
  import { DirectionalProjector } from 'octreecsg-ea/projectors/DirectionalProjector';
  import { vec2, vec3 } from 'gl-matrix';
  import type { AttributesMap } from 'octreecsg-ea/projectors/Projector';
  import type { MaterialAttributes } from 'octreecsg-ea/base/MaterialDefinition';
  import type { Polygon } from 'octreecsg-ea/math/Polygon';
  import type { mat4 } from 'gl-matrix';
  import type { TubeProjectorOptions } from 'octreecsg-ea/projectors/TubeProjector';
  import type { CurveFrames } from 'octreecsg-ea/helpers/curve-frame';
  type CurveTubeExtraData = [nearestPolygonSegmentIdx: number, uWrapsAround: boolean];
  export interface CurveTubeProjectorOptions extends TubeProjectorOptions {
      /**
       * The segment index radius when re-checking the nearest segment to a point.
       * If too large, then the projection will run very slowly and will have
       * artifacts when the radii of the curve intersect. If 0, then there will be
       * no artifacts because of curve radii, but the projection will be incorrect
       * as the polygon midpoint will be used for the segment UV, instead of a
       * vertex position. The sweet spot is a small value around 2-3. Defaults to
       * 2.
       */
      checkRadius?: number;
  }
  export class CurveTubeProjector extends DirectionalProjector<CurveTubeExtraData> {
      protected positions: Readonly<Array<vec3>>;
      protected curveFrames: Readonly<CurveFrames>;
      protected length: number;
      protected wrapAngle: number;
      useInnerFaces: boolean;
      invertTexCoords: boolean;
      protected segmentLengthSums: Array<number>;
      protected uMul: number;
      checkRadius: number;
      constructor(positions: Readonly<Array<vec3>>, curveFrames: Readonly<CurveFrames>, options?: CurveTubeProjectorOptions);
      clone(): CurveTubeProjector;
      get needsInvertedTexCoords(): boolean;
      protected projectUV(position: vec3, extraData: CurveTubeExtraData): vec2;
      private getUNorm;
      protected projectSingle(polygon: Polygon, newMaterialID: number, attributeMaps: AttributesMap, newUVsIdx: number | null, attributes: MaterialAttributes | null): void;
      applyMatrix(matrix: mat4): void;
  }
  export {};

}
declare module 'octreecsg-ea/projectors/DirectionalProjector' {
  import { Projector } from 'octreecsg-ea/projectors/Projector';
  import type { ProjectorOptions } from 'octreecsg-ea/projectors/Projector';
  import type { mat4 } from 'gl-matrix';
  export interface DirectionalProjectorOptions extends ProjectorOptions {
      /**
       * If true, then the back faces will not be reassigned a material. A back
       * face is a face with a normal in the same direction as the projection, NOT
       * a back face in the context of a mesh. Defaults to true.
       */
      ignoreBackFaces?: boolean;
      /**
       * Threshold, from 0 to 1, for a projection to be valid. If the threshold is
       * 1, then the direction of a projection must be exactly parallel to the
       * surface's normal. If the threshold is 0, then the projection will still
       * be valid if the projection is perpendicular to the surface's normal.
       * Essentially, this threshold is a check on the dot product between the
       * projection and the surface's normal; if the threshold is 0.5, then the
       * threshold represents a 45 degree angle between the surface normal and the
       * projection. Defaults to 0.
       */
      threshold?: number;
  }
  export abstract class DirectionalProjector<ExtraPolygonDataType = undefined> extends Projector<ExtraPolygonDataType> {
      ignoreBackFaces: boolean;
      threshold: number;
      constructor(options?: DirectionalProjectorOptions);
      abstract applyMatrix(matrix: mat4): void;
  }

}
declare module 'octreecsg-ea/projectors/FlatProjector' {
  import { DirectionalProjector } from 'octreecsg-ea/projectors/DirectionalProjector';
  import { vec2, vec3 } from 'gl-matrix';
  import type { Polygon } from 'octreecsg-ea/math/Polygon';
  import type { AttributesMap } from 'octreecsg-ea/projectors/Projector';
  import type { MaterialAttributes } from 'octreecsg-ea/base/MaterialDefinition';
  import type { DirectionalProjectorOptions } from 'octreecsg-ea/projectors/DirectionalProjector';
  import type { mat4 } from 'gl-matrix';
  export interface FlatProjectorOptions extends DirectionalProjectorOptions {
      /** The width of a repeating tile in the flat projection. Defaults to 1. */
      width?: number;
      /** The height of a repeating tile in the flat projection. Defaults to 1. */
      height?: number;
  }
  export class FlatProjector extends DirectionalProjector {
      protected origin: vec3;
      protected normal: vec3;
      protected rightTangent: vec3;
      protected upTangent: vec3;
      protected invWidth: number;
      protected invHeight: number;
      protected uOffset: number;
      protected vOffset: number;
      protected width: number;
      protected height: number;
      constructor(origin: vec3, normal: vec3, rightTangent: vec3, options?: FlatProjectorOptions);
      clone(): FlatProjector;
      protected projectUV(position: vec3): vec2;
      protected projectSingle(polygon: Polygon, newMaterialID: number, attributeMaps: AttributesMap, newUVsIdx: number | null, attributes: MaterialAttributes | null): void;
      applyMatrix(matrix: mat4): void;
  }

}
declare module 'octreecsg-ea/projectors/Projector' {
  import { vec2 } from 'gl-matrix';
  import type { vec3 } from 'gl-matrix';
  import type { Polygon } from 'octreecsg-ea/math/Polygon';
  import type Vertex from 'octreecsg-ea/math/Vertex';
  import type { MaterialAttributes, MaterialDefinitions } from 'octreecsg-ea/base/MaterialDefinition';
  import type OctreeCSG from 'octreecsg-ea/base/OctreeCSG';
  export type ProjectorCondition = (polygon: Polygon) => boolean;
  export type AttributesMap = Map<number, Array<number | null>>;
  export type NewUVsMap = Map<number, number>;
  export interface ProjectorOptions {
      /**
       * If true, then the projector will assign a material and generate new UVs
       * for the material, otherwise, only the material assignment will be done.
       * Defaults to true.
       */
      generatesUVs?: boolean;
  }
  export abstract class Projector<ExtraPolygonDataType = undefined> {
      readonly conditions: ProjectorCondition[];
      generatesUVs: boolean;
      constructor(options?: ProjectorOptions);
      protected canProjectToPolygon(polygon: Polygon): boolean;
      abstract clone(): Projector<ExtraPolygonDataType>;
      protected abstract projectUV(position: vec3, extraPolygonData: ExtraPolygonDataType): vec2;
      protected abstract projectSingle(polygon: Polygon, newMaterialID: number, attributeMaps: AttributesMap, newUVsIdx: number | null, attributes: MaterialAttributes | null): void;
      protected projectVertex(vertex: Vertex, attributeMap: Array<number | null>, newUVsIdx: number | null, attributes: MaterialAttributes | null, extraPolygonData: ExtraPolygonDataType): void;
      protected projectSingleWithExtraData(polygon: Polygon, newMaterialID: number, attributeMaps: AttributesMap, newUVsIdx: number | null, attributes: MaterialAttributes | null, extraPolygonData: ExtraPolygonDataType): void;
      private handlePolygon;
      private makeAttributesMap;
      private projectSubtree;
      projectOctree(octree: OctreeCSG, materialMap: Map<number, number>, extraMaterials?: MaterialDefinitions | null): void;
      project(polygons: Polygon | Iterable<Polygon>, materialMap: Map<number, number>, materials?: MaterialDefinitions | null): void;
  }

}
declare module 'octreecsg-ea/projectors/SphereProjector' {
  import { mat4, vec2, vec3 } from 'gl-matrix';
  import { DirectionalProjector } from 'octreecsg-ea/projectors/DirectionalProjector';
  import type { DirectionalProjectorOptions } from 'octreecsg-ea/projectors/DirectionalProjector';
  import { Polygon } from 'octreecsg-ea/math/Polygon';
  import { AttributesMap } from 'octreecsg-ea/projectors/Projector';
  import { MaterialAttributes } from 'octreecsg-ea/base/MaterialDefinition';
  export interface SphereProjectorOptions extends DirectionalProjectorOptions {
      /**
       * The yaw angle at which the projection repeats. Defaults to 360 deg
       * (2Pi).
       */
      uWrapAngle?: number;
      /**
       * The pitch angle at which the projection repeats. Defaults to 180 deg
       * (Pi).
       */
      vWrapAngle?: number;
      /**
       * Should the projection be done on the inside of the tube? Defaults to
       * false.
       */
      useInnerFaces?: boolean;
  }
  export class SphereProjector extends DirectionalProjector<boolean> {
      protected origin: vec3;
      protected up: vec3;
      protected right: vec3;
      protected front: vec3;
      protected uWrapAngle: number;
      protected vWrapAngle: number;
      protected uMul: number;
      protected vMul: number;
      useInnerFaces: boolean;
      constructor(origin: vec3, up: vec3, right: vec3, options?: SphereProjectorOptions);
      clone(): SphereProjector;
      protected projectUV(position: vec3, uWrapsAround: boolean): vec2;
      protected projectSingle(polygon: Polygon, newMaterialID: number, attributeMaps: AttributesMap, newUVsIdx: number | null, attributes: MaterialAttributes | null): void;
      private getNormalisedAngle;
      private getLatAngle;
      applyMatrix(matrix: mat4): void;
  }

}
declare module 'octreecsg-ea/projectors/TubeProjector' {
  import { DirectionalProjector } from 'octreecsg-ea/projectors/DirectionalProjector';
  import { vec2, vec3 } from 'gl-matrix';
  import type { DirectionalProjectorOptions } from 'octreecsg-ea/projectors/DirectionalProjector';
  import type { AttributesMap } from 'octreecsg-ea/projectors/Projector';
  import type { MaterialAttributes } from 'octreecsg-ea/base/MaterialDefinition';
  import type { Polygon } from 'octreecsg-ea/math/Polygon';
  import type { mat4 } from 'gl-matrix';
  export interface TubeProjectorOptions extends DirectionalProjectorOptions {
      /** The length of a repeating tile along the tube. Defaults to 1. */
      length?: number;
      /** The angle at which the projection repeats. Defaults to 360 deg (2Pi). */
      wrapAngle?: number;
      /**
       * Should the projection be done on the inside of the tube? Defaults to
       * false.
       */
      useInnerFaces?: boolean;
      /**
       * Should the UVs be inverted? Note that this is different than
       * useInnerFaces; useInnerFaces inverts the projection direction which also
       * inverts the UVs, but this only inverts the UVs while keeping the same
       * projection direction, which is useful when, for example, projecting to a
       * solid that will subtract another. Defaults to false.
       */
      invertTexCoords?: boolean;
  }
  export class TubeProjector extends DirectionalProjector<boolean> {
      protected origin: vec3;
      protected direction: vec3;
      protected normal: vec3;
      protected binormal: vec3;
      protected length: number;
      protected wrapAngle: number;
      protected invLength: number;
      protected uMul: number;
      useInnerFaces: boolean;
      invertTexCoords: boolean;
      constructor(origin: vec3, direction: vec3, normal: vec3, options?: TubeProjectorOptions);
      clone(): TubeProjector;
      get needsInvertedTexCoords(): boolean;
      protected projectUV(position: vec3, uWrapsAround: boolean): vec2;
      protected projectSingle(polygon: Polygon, newMaterialID: number, attributeMaps: AttributesMap, newUVsIdx: number | null, attributes: MaterialAttributes | null): void;
      applyMatrix(matrix: mat4): void;
  }

}
declare module 'octreecsg-ea/worker/EncodedOctreeCSGObject' {
  export type EncodedOctreeCSG = ArrayBuffer;
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
  import type { OctreeCSGOptions } from 'octreecsg-ea/base/OctreeCSG';
  import type { OctreeCSGObject } from 'octreecsg-ea/base/OctreeCSGObject';
  import type WorkerRequest from 'octreecsg-ea/worker/WorkerRequest';
  import type { MaterialDefinitions } from 'octreecsg-ea/base/MaterialDefinition';
  export default class Job {
      private resolveCallback;
      private rejectCallback;
      private operation;
      private materials;
      private options?;
      private transferables;
      workerIndex: number | null;
      constructor(operation: OctreeCSGObject, materials: MaterialDefinitions, options: OctreeCSGOptions | undefined, resolveCallback: (octree: OctreeCSG) => void, rejectCallback: (error: JobError) => void);
      getMessage(workerIndex: number, jobIndex: number): [message: WorkerRequest, transferables: Array<ArrayBuffer>];
      resolve(buffer: ArrayBuffer, materials: MaterialDefinitions): void;
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
  import { MaterialDefinitions } from "octreecsg-ea/base/MaterialDefinition";
  type JobResult = {
      success: true;
      jobIndex: number;
      buffer: ArrayBuffer;
      materials: MaterialDefinitions;
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
  import type { MaterialDefinitions } from 'octreecsg-ea/base/MaterialDefinition';
  import { OctreeCSGOptions } from 'octreecsg-ea/base/OctreeCSG';
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
      dispatch(operation: OctreeCSGObject, materials: MaterialDefinitions, options?: OctreeCSGOptions): Promise<OctreeCSG>;
      static create(workerPath: string, workerCount: number, timeoutMS: number): Promise<void>;
  }

}
declare module 'octreecsg-ea/worker/WorkerRequest' {
  import type { MaterialDefinitions } from 'octreecsg-ea/base/MaterialDefinition';
  import type { OctreeCSGOptions } from 'octreecsg-ea/base/OctreeCSG';
  import type { EncodedOctreeCSGObject } from 'octreecsg-ea/worker/EncodedOctreeCSGObject';
  type WorkerRequest = {
      type: 'operation';
      jobIndex: number;
      operation: EncodedOctreeCSGObject;
      materials: MaterialDefinitions;
      options: OctreeCSGOptions | undefined;
  };
  export default WorkerRequest;

}
declare module 'octreecsg-ea/worker/count-extra-vertex-bytes' {
  import type { MaterialDefinitions } from 'octreecsg-ea/base/MaterialDefinition';
  export default function countExtraVertexBytes(materials: MaterialDefinitions | null, materialID: number): number;

}
declare module 'octreecsg-ea/worker/decode-point' {
  import { MaterialAttributeValueType } from 'octreecsg-ea/base/MaterialDefinition';
  import Vertex from 'octreecsg-ea/math/Vertex';
  import { vec2, vec3, vec4 } from 'gl-matrix';
  import type { MaterialAttributes } from 'octreecsg-ea/base/MaterialDefinition';
  export function decodePointDatum(datumType: MaterialAttributeValueType, view: DataView, idx: number): number | vec2 | vec3 | vec4;
  export function decodePoint(attributes: MaterialAttributes | undefined, view: DataView, idx: number): Vertex;

}
declare module 'octreecsg-ea/worker/encode-point' {
  import { MaterialAttributes, MaterialAttributeValueType } from 'octreecsg-ea/base/MaterialDefinition';
  import type Vertex from 'octreecsg-ea/math/Vertex';
  export function encodePointDatum(datum: number[] | Float32Array | number, datumType: MaterialAttributeValueType, view: DataView, idx: number): void;
  export function encodePoint(point: Vertex, attributes: MaterialAttributes | undefined, view: DataView, idx: number): number;

}
declare module 'octreecsg-ea/worker/get-vertex-property-type-size' {
  import { MaterialAttributeValueType } from 'octreecsg-ea/base/MaterialDefinition';
  export default function getVertexPropertyTypeSize(propertyType: MaterialAttributeValueType): 16 | 4 | 8 | 12;

}
declare module 'octreecsg-ea/worker' {
  export {};

}
declare module 'octreecsg-ea' {
  import main = require('octreecsg-ea/index');
  export = main;
}