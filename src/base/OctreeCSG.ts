import { polyInside_WindingNumber_buffer, _wP_EPS_ARR, prepareTriangleBuffer } from '../math/winding-number';
import { checkTrianglesIntersection } from '../math/three-triangle-intersection';
import { ReturnPolygonType, splitPolygonByPlane } from '../math/split-polygon';
import rayIntersectsTriangle from '../math/ray-intersects-triangle';
import { PolygonState } from '../math/Polygon';
import { tmpm3, tv0 } from '../math/temp';
import Box3 from '../math/Box3';
import Ray from '../math/Ray';
import { mat3, mat4, vec3 } from 'gl-matrix';
import { MaterialDefinitions, MaterialAttributeTransform, MaterialAttributeValueType } from './MaterialDefinition';
import { encodePoint, encodePointDatum } from '../worker/encode-point';
import { JobError, JobFailReason } from '../worker/JobError';
import TriangleHasher from './TriangleHasher';
import { CSG_Rules } from './CSGRule';
import countExtraVertexBytes from '../worker/count-extra-vertex-bytes';
import { decodePoint, decodePointDatum } from '../worker/decode-point';
import { Polygon } from '../math/Polygon';
import { mergeTwoMaterials } from './merge-materials';

import type Triangle from '../math/Triangle';
import type { OctreeCSGObject } from './OctreeCSGObject';
import type { CSGRulesArray } from './CSGRule';
import type { EncodedOctreeCSG } from '../worker/EncodedOctreeCSGObject';

const _v1 = vec3.create();
const _v2 = vec3.create();
const _v3 = vec3.create();

const _ray = new Ray();
const _rayDirection = vec3.fromValues(0, 0, 1);

interface RayIntersect {
    distance: number,
    polygon: Polygon,
    position: vec3
}

type PolygonCounts = Map<number, number>;
type SectionOffsets = Map<number, number>;

const uint32Max = 2 ** 32 - 1;

export default class OctreeCSG {
    protected polygons: Polygon[];
    protected replacedPolygons: Polygon[];
    protected box?: Box3;
    protected subTrees: OctreeCSG[];
    protected parent: OctreeCSG | null;
    protected level: number;
    protected polygonArrays: Polygon[][];
    protected needsRebuild = true;

    static disposeOctree = true;
    static useWindingNumber = false;
    static maxLevel = 16;
    static polygonsPerTree = 100;
    static readonly maxSectionID = uint32Max;
    static readonly maxMaterialID = uint32Max;

    constructor(public materials: Readonly<MaterialDefinitions>, box?: Box3, parent: OctreeCSG | null = null) {
        this.polygons = [];
        this.replacedPolygons = [];
        this.box = box;
        this.subTrees = [];
        this.parent = parent;
        this.level = 0;
        this.polygonArrays = [];
        this.addPolygonsArrayToRoot(this.polygons);
    }

    clone() {
        return new OctreeCSG(this.materials).copy(this);
    }

    copy(source: OctreeCSG) {
        this.deletePolygonsArrayFromRoot(this.polygons);
        this.polygons = source.polygons.map(p => p.clone());
        this.addPolygonsArrayToRoot(this.polygons);

        this.replacedPolygons = source.replacedPolygons.map(p => p.clone());
        this.box = source.box?.clone();
        this.level = source.level;
        this.needsRebuild = source.needsRebuild;

        for (const subTree of source.subTrees) {
            this.subTrees.push(new OctreeCSG(this.materials, undefined, this).copy(subTree));
        }

        return this;
    }

    protected addPolygonsArrayToRoot(array: Polygon[]) {
        if (this.parent) {
            this.parent.addPolygonsArrayToRoot(array);
        } else {
            this.polygonArrays.push(array);
        }
    }

    protected deletePolygonsArrayFromRoot(array: Polygon[]) {
        if (this.parent) {
            this.parent.deletePolygonsArrayFromRoot(array);
        } else {
            const index = this.polygonArrays.indexOf(array);

            if (index > -1) {
                this.polygonArrays.splice(index, 1);
            }
        }
    }

    isEmpty() {
        return this.polygons.length === 0;
    }

    addPolygon(polygon: Polygon, triangleHasher?: TriangleHasher) {
        const triangle = polygon.triangle;

        if (triangleHasher && !triangleHasher.isUnique(triangle)) {
            return this;
        }

        if (this.box) {
            this.box.min[0] = Math.min(this.box.min[0], triangle.a[0], triangle.b[0], triangle.c[0]);
            this.box.min[1] = Math.min(this.box.min[1], triangle.a[1], triangle.b[1], triangle.c[1]);
            this.box.min[2] = Math.min(this.box.min[2], triangle.a[2], triangle.b[2], triangle.c[2]);
            this.box.max[0] = Math.max(this.box.max[0], triangle.a[0], triangle.b[0], triangle.c[0]);
            this.box.max[1] = Math.max(this.box.max[1], triangle.a[1], triangle.b[1], triangle.c[1]);
            this.box.max[2] = Math.max(this.box.max[2], triangle.a[2], triangle.b[2], triangle.c[2]);
        } else {
            this.box = new Box3();
            this.box.min[0] = Math.min(triangle.a[0], triangle.b[0], triangle.c[0]);
            this.box.min[1] = Math.min(triangle.a[1], triangle.b[1], triangle.c[1]);
            this.box.min[2] = Math.min(triangle.a[2], triangle.b[2], triangle.c[2]);
            this.box.max[0] = Math.max(triangle.a[0], triangle.b[0], triangle.c[0]);
            this.box.max[1] = Math.max(triangle.a[1], triangle.b[1], triangle.c[1]);
            this.box.max[2] = Math.max(triangle.a[2], triangle.b[2], triangle.c[2]);
        }

        this.polygons.push(polygon);
        return this;
    }

    private getSubtreeIdx(treeMid: Readonly<vec3>, point: Readonly<vec3>): number {
        return ((point[0] >= treeMid[0]) ? 0b100 : 0) |
               ((point[1] >= treeMid[1]) ? 0b010 : 0) |
               ((point[2] >= treeMid[2]) ? 0b001 : 0);
    }

    protected split(level: number) {
        if (this.polygons.length <= OctreeCSG.polygonsPerTree || level >= OctreeCSG.maxLevel) {
            return;
        }

        if (!this.box) {
            throw new Error('Octree has no box');
        }

        const subTrees = [];
        vec3.sub(_v2, this.box.max, this.box.min);
        const halfsize = vec3.scale(_v2, _v2, 0.5);

        // subTrees array content:
        // -x-y-z; -x-y+z; -x+y-z; -x+y+z; +x-y-z; +x-y+z; +x+y-z; +x+y+z
        for (let x = 0; x < 2; x++) {
            for (let y = 0; y < 2; y++) {
                for (let z = 0; z < 2; z++) {
                    const box = new Box3();
                    const v = vec3.set(_v1, x, y, z);

                    vec3.multiply(_v3, v, halfsize);
                    vec3.add(box.min, this.box.min, _v3);
                    vec3.add(box.max, box.min, halfsize);
                    subTrees.push(new OctreeCSG(this.materials, box, this));
                }
            }
        }

        const treeMid = vec3.add(_v2, this.box.max, this.box.min);
        vec3.scale(treeMid, treeMid, 0.5);

        const kept = [];
        for (const polygon of this.polygons) {
            const origIdx = this.getSubtreeIdx(treeMid, polygon.midpoint);
            const candidSubTree = subTrees[origIdx];
            const candidBox = candidSubTree.box as Box3;
            const [a, b, c] = polygon.vertices;

            if (candidBox.containsPoint(a.pos) && candidBox.containsPoint(b.pos) && candidBox.containsPoint(c.pos)) {
                candidSubTree.polygons.push(polygon);
            } else {
                // XXX at some point it was decided to split polygons that were
                // in the boundaries of octrees in the hope that it would be
                // faster than having polygons in stem nodes of the octree, but
                // it's actually slower, so it was removed
                kept.push(polygon);
            }
        }

        this.polygons.splice(0, this.polygons.length, ...kept);

        for (const subTree of subTrees) {
            const nextLevel = level + 1;
            subTree.level = nextLevel;
            subTree.split(nextLevel);
            this.subTrees.push(subTree);
        }

        return this;
    }

    buildTree() {
        if (this.subTrees.length > 0) {
            console.warn('Octree is already built, but buildTree was called. A rebuild will occur');
            const polygons = this.getPolygons();

            for (const subTree of this.subTrees) {
                subTree.delete(false);
            }

            this.subTrees.length = 0;
            this.polygons.splice(0, this.polygons.length, ...polygons);
        }

        this.split(0);
        this.processTree();
        this.needsRebuild = false;

        return this;
    }

    protected processTree() {
        if (!this.isEmpty()) {
            if (!this.box) {
                this.box = new Box3();
            }

            const firstPolygon = this.polygons[0];
            const firstVertex = firstPolygon.triangle.a;
            vec3.copy(this.box.min, firstVertex);
            vec3.copy(this.box.max, firstVertex);

            for (const polygon of this.polygons) {
                this.box.expandByPoint(polygon.triangle.a);
                this.box.expandByPoint(polygon.triangle.b);
                this.box.expandByPoint(polygon.triangle.c);
            }

            this.expandParentBox();
        }

        for (const subTree of this.subTrees) {
            subTree.processTree();
        }
    }

    protected expandParentBox() {
        if (this.parent) {
            if (!this.box) {
                throw new Error('Octree has no box');
            }

            if (!this.parent.box) {
                throw new Error('Octree\'s parent has no box');
            }

            this.parent.box.expandByPoint(this.box.min);
            this.parent.box.expandByPoint(this.box.max);
            this.parent.expandParentBox();
        }
    }

    getPolygonsIntersectingPolygon(targetPolygon: Polygon, polygons: Polygon[] = []) {
        if (!this.box) {
            throw new Error('Octree has no box');
        }

        if (this.polygons.length > 0 && this.box.intersectsTriangle(targetPolygon.triangle)) {
            handlePolygonArrayIntersections(targetPolygon, polygons, this.polygons);
            handlePolygonArrayIntersections(targetPolygon, polygons, this.replacedPolygons);
        }

        for (const subTree of this.subTrees) {
            subTree.getPolygonsIntersectingPolygon(targetPolygon, polygons);
        }

        return polygons;
    }

    getRayPolygons(ray: Ray, polygons?: Set<Polygon>) {
        // XXX if the replaced polygons array are not creating a new set, then
        // using a set is actually slower than using an array and calling
        // indexOf. when an API such as Set.addAll is added, then using a set
        // will always be faster than an array. the average case

        if (polygons) {
            for (const replacedPolygon of this.replacedPolygons) {
                polygons.add(replacedPolygon);
            }
        } else {
            polygons = new Set(this.replacedPolygons);
        }

        for (const polygon of this.polygons) {
            if (polygon.valid && polygon.originalValid) {
                polygons.add(polygon);
            }
        }

        for (const subTree of this.subTrees) {
            if ((subTree.box as Box3).intersectsRay(ray)) {
                subTree.getRayPolygons(ray, polygons);
            }
        }

        return polygons;
    }

    rayIntersect(ray: Ray, intersects: RayIntersect[] = []) {
        if (vec3.squaredLength(ray.direction) === 0) return [];

        for (const polygon of this.getRayPolygons(ray)) {
            // MollerTrumbore
            const result = rayIntersectsTriangle(ray, polygon.triangle, _v1);
            if (result) {
                const distance = vec3.distance(result, ray.origin);
                intersects.push({ distance, polygon, position: vec3.add(vec3.create(), result, ray.origin) });
            }
        }

        intersects.length && intersects.sort(raycastIntersectAscSort);
        return intersects;
    }

    private handlePolyIntersection(ray: Ray, polygon: Polygon, curInt: RayIntersect | null): RayIntersect | null {
        const result = rayIntersectsTriangle(ray, polygon.triangle, _v1);
        if (result) {
            const distance = vec3.distance(result, ray.origin);

            if (!curInt || distance < curInt.distance) {
                curInt = { distance, polygon, position: vec3.add(vec3.create(), result, ray.origin) };
            }
        }

        return curInt;
    }

    private marchingClosestRayIntersection(ray: Ray): RayIntersect | null {
        // get closest intersection in current level
        let thisIntersection: RayIntersect | null = null;

        for (const polygon of this.replacedPolygons) {
            thisIntersection = this.handlePolyIntersection(ray, polygon, thisIntersection);
        }

        for (const polygon of this.polygons) {
            if (polygon.valid && polygon.originalValid) {
                thisIntersection = this.handlePolyIntersection(ray, polygon, thisIntersection);
            }
        }

        // march lower levels
        if (this.subTrees.length > 0) {
            // this isn't a leaf node. get lower-level intersections
            const intSubTrees = new Array<[octree: OctreeCSG, distance: number]>();
            let intCount = 0;

            for (const subTree of this.subTrees) {
                // check if subtree intersects ray and get distance
                let distance = null;
                if ((subTree.box as Box3).rayIntersection(ray, tv0)) {
                    distance = vec3.squaredDistance(ray.origin, tv0);

                    // do insertion sort for subtree
                    let i = 0;
                    for (; i < intCount && distance >= intSubTrees[i][1]; i++);

                    intSubTrees.splice(i, 0, [subTree, distance]);
                    intCount++;
                }
            }

            // do ray-marching on intersecting subtrees
            for (const [subTree, _distance] of intSubTrees) {
                const intersection = subTree.marchingClosestRayIntersection(ray);
                if (intersection) {
                    if (!thisIntersection || thisIntersection.distance > intersection.distance) {
                        thisIntersection = intersection;
                    }
                }
            }
        }

        return thisIntersection;
    }

    closestRayIntersection(ray: Ray): RayIntersect | null {
        if (this.parent === null) {
            return this.marchingClosestRayIntersection(ray);
        } else {
            return this.parent.closestRayIntersection(ray);
        }
    }

    getIntersectingPolygons(polygons: Polygon[] = []) {
        for(const polygonsArray of this.polygonArrays) {
            for (const polygon of polygonsArray) {
                if (polygon.valid && polygon.intersects) {
                    polygons.push(polygon);
                }
            }
        }

        return polygons;
    }

    getPolygons(polygons: Polygon[] = []) {
        for(const polygonsArray of this.polygonArrays) {
            for (const polygon of polygonsArray) {
                if (polygon.valid && polygons.indexOf(polygon) === -1) {
                    polygons.push(polygon);
                }
            }
        }

        return polygons;
    }

    private *levelPolygonsGen(): Generator<Polygon> {
        for (const polygon of this.polygons) {
            if (polygon.valid) {
                yield polygon;
            }
        }
    }

    get levelPolygons() {
        return this.levelPolygonsGen();
    }

    private *treePolygonsGen(): Generator<Polygon> {
        for (const polygon of this.levelPolygons) {
            yield polygon;
        }

        for (const subTree of this.subTrees) {
            for (const polygon of subTree.treePolygons) {
                yield polygon;
            }
        }
    }

    get treePolygons() {
        return this.treePolygonsGen();
    }

    private *lowerLevelsGen(): Generator<OctreeCSG> {
        for (const subTree of this.subTrees) {
            yield subTree;
        }
    }

    get lowerLevels() {
        return this.lowerLevelsGen();
    }

    invert() {
        for(const polygonsArray of this.polygonArrays) {
            for(const polygon of polygonsArray) {
                if (polygon.valid) {
                    polygon.flip(this.materials);
                }
            }
        }
    }

    protected replacePolygon(polygon: Polygon, newPolygons: Polygon[] | Polygon) {
        if (!Array.isArray(newPolygons)) {
            newPolygons = [newPolygons];
        }

        if (this.polygons.length > 0) {
            const polygonIndex = this.polygons.indexOf(polygon);
            if (polygonIndex > -1) {
                if (polygon.originalValid) {
                    this.replacedPolygons.push(polygon);
                } else {
                    polygon.setInvalid();
                }

                this.polygons.splice(polygonIndex, 1, ...newPolygons);
            }
        }

        for (const subTree of this.subTrees) {
            subTree.replacePolygon(polygon, newPolygons);
        }
    }

    protected deletePolygonsByStateRules(rulesArr: CSGRulesArray, firstRun = true) {
        for(const polygonsArray of this.polygonArrays) {
            if (polygonsArray.length === 0) {
                continue;
            }

            for(const polygon of polygonsArray.slice()) {
                if (!polygon.valid || !polygon.intersects) {
                    continue;
                }

                let found = false;
                for (const rule of rulesArr) {
                    if (rule.array) {
                        const states = rule.rule;
                        if (states.includes(polygon.state) && (((polygon.previousState !== PolygonState.Undecided) && (states.includes(polygon.previousState))) || polygon.previousState === PolygonState.Undecided)) {
                            found = true;
                            const missingStates = new Set<PolygonState>();

                            for(const state of states) {
                                missingStates.add(state);
                            }

                            missingStates.delete(polygon.state);

                            for (const previousState of polygon.previousStates) {
                                if (!states.includes(previousState)) { // if previous state not one of provided states (not included in states array), break
                                    found = false;
                                    break;
                                } else {
                                    missingStates.delete(previousState);
                                }
                            }

                            if (found) {
                                if (missingStates.size > 0) {
                                    found = false;
                                } else {
                                    break;
                                }
                            }
                        }
                    } else if (polygon.checkAllStates(rule.rule)) {
                        found = true;
                        break;
                    }
                }

                if (found) {
                    const polygonIndex = polygonsArray.indexOf(polygon);
                    if (polygonIndex > -1) {
                        polygon.setInvalid();
                        polygonsArray.splice(polygonIndex, 1);
                    }

                    if (firstRun) {
                        polygon.delete();
                    }
                }
            }
        }
    }

    protected deletePolygonsByIntersection(intersects: boolean, firstRun = true) {
        for(const polygonsArray of this.polygonArrays) {
            if (polygonsArray.length === 0) {
                continue;
            }

            for(const polygon of polygonsArray.slice()) {
                if (polygon.valid && polygon.intersects === intersects) {
                    const polygonIndex = polygonsArray.indexOf(polygon);
                    if (polygonIndex > -1) {
                        polygon.setInvalid();
                        polygonsArray.splice(polygonIndex, 1);
                    }

                    if (firstRun) {
                        polygon.delete();
                    }
                }
            }
        }
    }

    isPolygonIntersecting(polygon: Polygon) {
        if (!this.box) {
            throw new Error('Octree has no box');
        }

        return this.box.intersectsTriangle(polygon.triangle);
    }

    protected markIntersectingPolygons(targetOctree: OctreeCSG) {
        for(const polygonsArray of this.polygonArrays) {
            for (const polygon of polygonsArray) {
                polygon.intersects = targetOctree.isPolygonIntersecting(polygon);
            }
        }
    }

    protected resetPolygons(resetOriginal = true) {
        for(const polygonsArray of this.polygonArrays) {
            for (const polygon of polygonsArray) {
                polygon.reset(resetOriginal);
            }
        }
    }

    protected handleIntersectingPolygons(targetOctree: OctreeCSG, targetOctreeBuffer?: Float32Array) {
        if (OctreeCSG.useWindingNumber && !targetOctreeBuffer) {
            throw new Error('targetOctreeBuffer must be set if using winding number');
        }

        if (this.polygons.length > 0) {
            let polygonStack = this.polygons.filter(polygon => polygon.valid && polygon.intersects && polygon.state === PolygonState.Undecided);

            let currentPolygon;
            while ((currentPolygon = polygonStack.pop())) { // XXX assignment is on purpose
                if (currentPolygon.state !== PolygonState.Undecided || !currentPolygon.valid) {
                    continue;
                }

                const targetPolygons = targetOctree.getPolygonsIntersectingPolygon(currentPolygon);
                for (const target of targetPolygons) {
                    const splitResults = splitPolygonByPlane(currentPolygon, target.plane, this.materials);

                    if (splitResults.length > 1) {
                        for (const result of splitResults) {
                            const polygon = result.polygon;
                            polygon.intersects = currentPolygon.intersects;
                            polygon.newPolygon = true;
                            polygonStack.push(polygon);
                        }

                        this.replacePolygon(currentPolygon, splitResults.map(result => result.polygon));
                        break;
                    } else {
                        const singleResult = splitResults[0];

                        if (currentPolygon.id !== singleResult.polygon.id) {
                            singleResult.polygon.intersects = currentPolygon.intersects;
                            singleResult.polygon.newPolygon = true;
                            polygonStack.push(singleResult.polygon);
                            this.replacePolygon(currentPolygon, singleResult.polygon);
                            break;
                        } else if (singleResult.type === ReturnPolygonType.CoplanarFront || singleResult.type === ReturnPolygonType.CoplanarBack) {
                            // XXX conversion from ReturnPolygonType to PolygonState is intentional
                            // the values of CoplanarFront and CoplanarBack match by definition for both enums
                            currentPolygon.setState(singleResult.type as unknown as PolygonState);
                            currentPolygon.coplanar = true;
                        }
                    }
                }
            }

            polygonStack = this.polygons.filter(polygon => polygon.valid && polygon.intersects);
            let inside = false;

            while ((currentPolygon = polygonStack.pop())) { // XXX assignment is on purpose
                if (!currentPolygon.valid) {
                    continue;
                }

                if (!targetOctree.box) {
                    throw new Error('Octree has no box');
                }

                inside = false;
                if (targetOctree.box.containsPoint(currentPolygon.midpoint)) {
                    if (OctreeCSG.useWindingNumber) {
                        inside = polyInside_WindingNumber_buffer(targetOctreeBuffer as Float32Array, currentPolygon.midpoint, currentPolygon.coplanar);
                    } else {
                        const point = vec3.copy(_v2, currentPolygon.midpoint);

                        vec3.copy(_ray.origin, point);
                        vec3.copy(_rayDirection, currentPolygon.plane.unsafeNormal);
                        vec3.copy(_ray.direction, currentPolygon.plane.unsafeNormal);

                        let closestInt = targetOctree.closestRayIntersection(_ray);
                        if (closestInt && vec3.dot(_rayDirection, closestInt.polygon.plane.unsafeNormal) > 0) {
                            inside = true;
                        } else if (currentPolygon.coplanar) {
                            for (const _wP_EPS of _wP_EPS_ARR) {
                                vec3.add(_ray.origin, point, _wP_EPS);
                                vec3.copy(_rayDirection, currentPolygon.plane.unsafeNormal);
                                vec3.copy(_ray.direction, currentPolygon.plane.unsafeNormal);

                                closestInt = targetOctree.closestRayIntersection(_ray);
                                if (closestInt && vec3.dot(_rayDirection, closestInt.polygon.plane.unsafeNormal) > 0) {
                                    inside = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                currentPolygon.setState(inside ? PolygonState.Inside : PolygonState.Outside);
            }
        }

        for (const subTree of this.subTrees) {
            subTree.handleIntersectingPolygons(targetOctree, targetOctreeBuffer);
        }
    }

    delete(deletePolygons = true) {
        if (this.polygons.length > 0 && deletePolygons) {
            for (const polygon of this.polygons) {
                polygon.delete();
            }

            this.polygons.length = 0;
        }

        if (this.replacedPolygons.length > 0 && deletePolygons) {
            for (const polygon of this.replacedPolygons) {
                polygon.delete();
            }

            this.replacedPolygons.length = 0;
        }

        if (this.polygonArrays) {
            this.polygonArrays.length = 0;
        }

        if (this.subTrees.length) {
            for (const subTree of this.subTrees) {
                subTree.delete(deletePolygons);
            }

            this.subTrees.length = 0;
        }

        this.box = undefined;
        this.parent = null;
        this.level = 0;
    }

    dispose(deletePolygons = true) {
        this.delete(deletePolygons);
    }

    private countEncodingBytes(materials: MaterialDefinitions, octreeOffsets: Map<OctreeCSG, number>, octreePolygonCounts: Map<OctreeCSG, PolygonCounts>, octreeSectionOffsets: Map<OctreeCSG, SectionOffsets>, bytesCount = 0) {
        octreeOffsets.set(this, bytesCount);

        // count space for octree header (box + flags)
        // flags and section count
        bytesCount += 5;

        // box min+max
        if (this.box) {
            bytesCount += 24;
        }

        // count polygons for each material
        const polygonCounts = new Map<number, number>();

        for (const polygon of this.polygons) {
            if (!polygon.valid || !polygon.originalValid) {
                continue;
            }

            const materialID = polygon.shared;

            if (materialID < 0 || materialID > OctreeCSG.maxMaterialID) {
                throw new Error(`Invalid material ID (${materialID}) for polygon. Valid range: 0-${OctreeCSG.maxMaterialID}`);
            }

            const polygonCount = (polygonCounts.get(materialID) ?? 0) + 1;
            polygonCounts.set(materialID, polygonCount);
        }

        // allocate buffer and get section offsets
        const sectionOffsets = new Map<number, number>();

        for (const [materialID, polygonCount] of polygonCounts) {
            sectionOffsets.set(materialID, bytesCount);
            const extraBytes = countExtraVertexBytes(materials, materialID);
            bytesCount += 8 + polygonCount * (12 + extraBytes) * 3;
        }

        octreePolygonCounts.set(this, polygonCounts);
        octreeSectionOffsets.set(this, sectionOffsets);

        // count space for subtrees
        const subTreeCount = this.subTrees.length;
        if (subTreeCount > 0) {
            if (subTreeCount !== 8) {
                throw new Error(`Unexpected sub-tree count. Expected 8, got ${subTreeCount}`);
            }

            for (const subTree of this.subTrees) {
                bytesCount = subTree.countEncodingBytes(materials, octreeOffsets, octreePolygonCounts, octreeSectionOffsets, bytesCount);
            }
        }

        return bytesCount;
    }

    private encodeBytes(view: DataView, materials: MaterialDefinitions, octreeOffsets: Map<OctreeCSG, number>, octreePolygonCounts: Map<OctreeCSG, PolygonCounts>, octreeSectionOffsets: Map<OctreeCSG, SectionOffsets>) {
        let octreeOffset = octreeOffsets.get(this) as number;
        const polygonCounts = octreePolygonCounts.get(this) as PolygonCounts;
        const sectionOffsets = octreeSectionOffsets.get(this) as SectionOffsets;

        // populate octree header
        // flags
        const sectionCount = polygonCounts.size;
        view.setUint32(octreeOffset, sectionCount);
        octreeOffset += 4;

        const hasBox = this.box !== undefined;
        const flags = (hasBox ? 0b00000001 : 0)
                    | ((this.subTrees.length > 0) ? 0b00000010 : 0)
                    | (this.needsRebuild ? 0b00000100 : 0);

        view.setUint8(octreeOffset, flags);
        octreeOffset++;

        if (hasBox) {
            const box = this.box as Box3;
            encodePointDatum(box.min, MaterialAttributeValueType.Vec3, view, octreeOffset);
            octreeOffset += 12;
            encodePointDatum(box.max, MaterialAttributeValueType.Vec3, view, octreeOffset);
        }

        // populate section headers
        for (const [materialID, polygonCount] of polygonCounts) {
            let sectionStart = sectionOffsets.get(materialID) as number;

            // material ID uint32
            view.setUint32(sectionStart, materialID);
            sectionStart += 4;

            // polygon count uint32
            view.setUint32(sectionStart, polygonCount);
            sectionStart += 4;

            sectionOffsets.set(materialID, sectionStart);
        }

        // encode polygons
        for (const polygon of this.polygons) {
            // get material ID of polygon and current offset for section
            const materialID = polygon.shared;
            let offset = sectionOffsets.get(materialID) as number;

            // encode position and extra data
            const attributes = materials.get(materialID);
            offset = encodePoint(polygon.vertices[0], attributes, view, offset);
            offset = encodePoint(polygon.vertices[1], attributes, view, offset);
            offset = encodePoint(polygon.vertices[2], attributes, view, offset);
            sectionOffsets.set(materialID, offset);
        }

        // encode subtrees
        for (const subTree of this.subTrees) {
            subTree.encodeBytes(view, materials, octreeOffsets, octreePolygonCounts, octreeSectionOffsets);
        }
    }

    encode(materials: MaterialDefinitions, transferables: Array<ArrayBuffer>): EncodedOctreeCSG {
        // XXX: this format is streamable; you don't need the entire encoded data to
        // start adding polygons, they can be added as they are received, as long as
        // the messages are received sequentially. this could lead to some
        // interesting memory optimisations in the future if we ever decide to split
        // the buffer into smaller ones and essentially stream polygons to the
        // octree on the worker

        // buffer with all polygon data. polygons are grouped in sections, where one
        // section contains all polygons for a particular material ID. octree packed
        // format. octree packed format:
        //     [bytes] : [value]
        // 4           : sections count (uint32)
        // 1           : flags
        // ; flag bits:
        // ; - bit 0: has box
        // ; - bit 1: has subtrees
        // ; - bit 2: needs rebuild
        // ; - bit 3-7: unused
        // 12          : box min (only included if box flag is set) (v3_f32)
        // 12          : box max (only included if box flag is set) (v3_f32)
        // (see below) : sections
        // ?*8         : 8 subtrees' data (only included if subtrees flag is set)

        // section packed format:
        // ; let N be the polygon count
        // ; let M be the total extra property bytes per vertex for this material
        //    [bytes] : [value]
        // 4          : material ID (uint32)
        // 4          : polygon count (uint32)
        // N*(12+M)*3 : polygon data
        //
        // material sections are included one after the other, in continuous memory,
        // but not in a specific order. for example:
        // [material 0 section data][material 2 section data][material 1 section data]...
        //
        // polygon data packed format:
        // ; let X be the number of extra vertex properties
        // [bytes] : [value]
        // 12      : vertex A position (v3_f32)
        // ??      : vertex A extra attribute 0 (??)
        // ??      : vertex A extra attribute 1 (??)
        // ...
        // ??      : vertex A extra attribute X-1 (??)
        // 12      : vertex B position (v3_f32)
        // ??      : vertex B extra attribute 0 (??)
        // ??      : vertex B extra attribute 1 (??)
        // ...
        // ??      : vertex B extra attribute X-1 (??)
        // 12      : vertex C position (v3_f32)
        // ??      : vertex C extra attribute 0 (??)
        // ??      : vertex C extra attribute 1 (??)
        // ...
        // ??      : vertex C extra attribute X-1 (??)
        //
        // example polygon data format if the extra vertex properties were:
        // ; attribute 0: vec3 float32 normals
        // ; attribute 1: vec4 float32 tangents
        // ; attribute 2: vec2 float32 uvs
        // ; attribute 3: vec3 float32 colors
        // [bytes] : [value]
        // 12      : vertex A position (v3_f32)
        // 12      : vertex A normal (extra attribute 0) (v3_f32)
        // 16      : vertex A tangent (extra attribute 1) (v4_f32)
        // 8       : vertex A uv (extra attribute 2) (v2_f32)
        // 12      : vertex A color (extra attribute 3) (v3_f32)
        // 12      : vertex B position (v3_f32)
        // 12      : vertex B normal (extra attribute 0) (v3_f32)
        // 16      : vertex B tangent (extra attribute 1) (v4_f32)
        // 8       : vertex B uv (extra attribute 2) (v2_f32)
        // 12      : vertex B color (extra attribute 3) (v3_f32)
        // 12      : vertex C position (v3_f32)
        // 12      : vertex C normal (extra attribute 0) (v3_f32)
        // 16      : vertex C tangent (extra attribute 1) (v4_f32)
        // 8       : vertex C uv (extra attribute 2) (v2_f32)
        // 12      : vertex C color (extra attribute 3) (v3_f32)

        const octreeOffsets = new Map<OctreeCSG, number>();
        const octreePolygonCounts = new Map<OctreeCSG, PolygonCounts>();
        const octreeSectionOffsets = new Map<OctreeCSG, SectionOffsets>();

        const bytesCount = this.countEncodingBytes(materials, octreeOffsets, octreePolygonCounts, octreeSectionOffsets)

        const buffer = new ArrayBuffer(bytesCount);
        const view = new DataView(buffer);

        this.encodeBytes(view, materials, octreeOffsets, octreePolygonCounts, octreeSectionOffsets);

        transferables.push(buffer);
        return buffer;
    }

    private static decodeBytes(view: DataView, byteOffset: number, byteLength: number, parent: OctreeCSG | null, materials: MaterialDefinitions): [octree: OctreeCSG, byteOffset: number] {
        // validate remaining space for octree header
        if (byteOffset + 5 > byteLength) {
            throw new Error(`Invalid octree; expected octree header, but there are not enough bytes left for it`);
        }

        // make output octree
        const octree = new OctreeCSG(materials, undefined, parent);

        // decode octree header
        const sectionsCount = view.getUint32(byteOffset);
        byteOffset += 4;

        const flags = view.getUint8(byteOffset);
        byteOffset++;

        const hasBox = (flags & 0b00000001) > 0;
        const hasSubTrees = (flags & 0b00000010) > 0;
        octree.needsRebuild = (flags & 0b00000100) > 0;

        if (hasBox) {
            if (byteOffset + 24 > byteLength) {
                throw new Error(`Invalid octree; expected octree bounding box in header, but there are not enough bytes left for it`);
            }

            const min = decodePointDatum(MaterialAttributeValueType.Vec3, view, byteOffset) as vec3;
            byteOffset += 12;
            const max = decodePointDatum(MaterialAttributeValueType.Vec3, view, byteOffset) as vec3;
            byteOffset += 12;
            octree.box = new Box3(min, max);
        }

        // decode material sections
        for (let i = 0; i < sectionsCount; i++) {
            // check if there's space for the header
            if (byteOffset + 6 > byteLength) {
                throw new Error(`Invalid material section; expected material section header, but there are not enough bytes left for it`);
            }

            // parse header
            const materialID = view.getUint32(byteOffset);
            byteOffset += 4;
            const polygonCount = view.getUint32(byteOffset);
            byteOffset += 4;

            // calculate polygon size for this material
            const extraBytes = countExtraVertexBytes(materials, materialID);
            const vertexBytes = 12 + extraBytes;

            // check if there's space for the polygon data
            const sectionBytes = polygonCount * vertexBytes * 3;
            if (sectionBytes === 0) {
                throw new Error(`Invalid material section; expected at least one polygon, got none`);
            }

            const sectionEnd = byteOffset + sectionBytes;
            if (sectionEnd > byteLength) {
                throw new Error(`Invalid material section; expected material section polygon data, but there are not enough bytes left for it`);
            }

            // parse polygons (groups of 3 vertices)
            const attributes = materials === null ? undefined : materials.get(materialID);
            while (byteOffset < sectionEnd) {
                const a = decodePoint(attributes, view, byteOffset);
                byteOffset += vertexBytes;
                const b = decodePoint(attributes, view, byteOffset);
                byteOffset += vertexBytes;
                const c = decodePoint(attributes, view, byteOffset);
                byteOffset += vertexBytes;

                const polygon = new Polygon([a, b, c], materialID);
                polygon.originalValid = true;
                octree.polygons.push(polygon);
            }
        }

        // decode subtrees
        if (hasSubTrees) {
            for (let i = 0; i < 8; i++) {
                let subTree;
                [subTree, byteOffset] = OctreeCSG.decodeBytes(view, byteOffset, byteLength, octree, materials);
                octree.subTrees.push(subTree);
            }
        }

        return [octree, byteOffset];
    }

    static decode(buffer: ArrayBuffer, materials: MaterialDefinitions): OctreeCSG {
        const [octree, _byteOffset] = OctreeCSG.decodeBytes(
            new DataView(buffer), 0, buffer.byteLength, null, materials
        );

        return octree;
    }

    protected getPolygonCloneCallback(cbFunc: (polygon: Polygon, triangleHasher: TriangleHasher) => unknown, triangleHasher: TriangleHasher) {
        for (const polygonsArray of this.polygonArrays) {
            for (const polygon of polygonsArray) {
                if (polygon.valid) {
                    cbFunc(polygon.clone(), triangleHasher);
                }
            }
        }
    }

    protected deleteReplacedPolygons() {
        if (this.replacedPolygons.length > 0) {
            for (const polygon of this.replacedPolygons) {
                polygon.delete();
            }

            this.replacedPolygons.length = 0;
        }

        for (const subTree of this.subTrees) {
            subTree.deleteReplacedPolygons();
        }
    }

    protected markPolygonsAsOriginal() {
        for(const polygonsArray of this.polygonArrays) {
            for (const polygon of polygonsArray) {
                polygon.originalValid = true;
            }
        }
    }

    applyMatrix(matrix: mat4, normalMatrix?: mat3, firstRun = true, needsNormalMatrix = false) {
        if (this.box) {
            this.box = undefined;
        }

        if (firstRun) {
            if (!needsNormalMatrix) {
                for (const attributes of this.materials.values()) {
                    if (attributes) {
                        for (const attribute of attributes) {
                            if (attribute.transformable === MaterialAttributeTransform.Normal) {
                                needsNormalMatrix = true;
                                break;
                            }
                        }
                    }

                    if (needsNormalMatrix) {
                        break;
                    }
                }
            }

            if (needsNormalMatrix && !normalMatrix) {
                normalMatrix = mat3.normalFromMat4(tmpm3, matrix);
            }
        }

        for (const polygon of this.polygons) {
            if (polygon.valid) {
                polygon.applyMatrixNoAuto(this.materials.get(polygon.shared), matrix, normalMatrix);
            }
        }

        for (const subTree of this.subTrees) {
            subTree.applyMatrix(matrix, normalMatrix, false, needsNormalMatrix);
        }

        if (firstRun) {
            this.processTree();
        }
    }

    setPolygonIndex(index: number) {
        if (index === undefined) {
            return;
        }

        for(const polygonsArray of this.polygonArrays) {
            for (const polygon of polygonsArray) {
                polygon.shared = index;
            }
        }
    }

    // utils from OctreeCSG.extended.js
    getTriangles(triangles: Triangle[] = []) {
        for (const polygon of this.getPolygons()) {
            triangles.push(polygon.triangle)
        }

        return triangles;
    }

    getRayTriangles(ray: Ray, triangles: Triangle[] = []) {
        for (const polygon of this.getRayPolygons(ray)) {
            triangles.push(polygon.triangle)
        }

        return triangles;
    }

    /*
    Union:
    1. Delete all polygons in A that are:
        a. inside and coplanar-back
        b. inside
    2. Delete all polygons in B that are:
        a. inside and coplanar-back
        b. inside and coplanar-front
        c. inside
    */
    static union(octreeA: OctreeCSG, octreeB: OctreeCSG) {
        // merge material definitions of both octrees
        const newMatDefs = mergeTwoMaterials(octreeA.materials, octreeB.materials);

        // build octrees if necessary
        if (octreeA.needsRebuild || !octreeA.box) {
            octreeA.buildTree();
        }

        if (octreeB.needsRebuild || !octreeB.box) {
            octreeB.buildTree();
        }

        const octree = new OctreeCSG(newMatDefs);
        const triangleHasher = new TriangleHasher();

        if ((octreeA.box as Box3).intersectsBox(octreeB.box as Box3)) {
            octreeA.resetPolygons(false);
            octreeB.resetPolygons(false);

            octreeA.markIntersectingPolygons(octreeB);
            octreeB.markIntersectingPolygons(octreeA);

            OctreeCSG.handleIntersectingOctrees(octreeA, octreeB);
            octreeA.deleteReplacedPolygons();
            octreeB.deleteReplacedPolygons();

            octreeA.deletePolygonsByStateRules(CSG_Rules.union.a);
            octreeB.deletePolygonsByStateRules(CSG_Rules.union.b);
        }

        octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree), triangleHasher);
        octreeB.getPolygonCloneCallback(octree.addPolygon.bind(octree), triangleHasher);

        triangleHasher.clear();

        octree.markPolygonsAsOriginal();

        return octree;
    }

    /*
    Subtract:
    1. Delete all polygons in A that are:
        a. inside and coplanar-back
        b. inside and coplanar-front
        c. inside
    2. Delete all polygons in B that are:
        a. outside and coplanar-back
        b. outside and coplanar-front
        c. inside and coplanar-front
        d. outside
    */
    static subtract(octreeA: OctreeCSG, octreeB: OctreeCSG) {
        // merge material definitions of both octrees
        const newMatDefs = mergeTwoMaterials(octreeA.materials, octreeB.materials);

        // build octrees if necessary
        if (octreeA.needsRebuild || !octreeA.box) {
            octreeA.buildTree();
        }

        if (octreeB.needsRebuild || !octreeB.box) {
            octreeB.buildTree();
        }

        const octree = new OctreeCSG(newMatDefs);
        const triangleHasher = new TriangleHasher();

        if ((octreeA.box as Box3).intersectsBox(octreeB.box as Box3)) {
            octreeA.resetPolygons(false);
            octreeB.resetPolygons(false);
            octreeA.markIntersectingPolygons(octreeB);
            octreeB.markIntersectingPolygons(octreeA);


            OctreeCSG.handleIntersectingOctrees(octreeA, octreeB);
            octreeA.deleteReplacedPolygons();
            octreeB.deleteReplacedPolygons();

            octreeA.deletePolygonsByStateRules(CSG_Rules.subtract.a);
            octreeB.deletePolygonsByStateRules(CSG_Rules.subtract.b);


            octreeB.deletePolygonsByIntersection(false);

            octreeB.invert();

            octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree), triangleHasher);
            octreeB.getPolygonCloneCallback(octree.addPolygon.bind(octree), triangleHasher);
        }
        else {
            octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree), triangleHasher);
        }

        triangleHasher.clear();

        octree.markPolygonsAsOriginal();

        return octree;
    }

    /*
    Intersect:
    1. Delete all polygons in A that are:
        a. inside and coplanar-back
        b. outside and coplanar-front
        c. outside and coplanar-back
        d. outside
    2. Delete all polygons in B that are:
        a. inside and coplanar-front
        b. inside and coplanar-back
        c. outside and coplanar-front
        d. outside and coplanar-back
        e. outside
    */
    static intersect(octreeA: OctreeCSG, octreeB: OctreeCSG) {
        // merge material definitions of both octrees
        const newMatDefs = mergeTwoMaterials(octreeA.materials, octreeB.materials);

        // build octrees if necessary
        if (octreeA.needsRebuild || !octreeA.box) {
            octreeA.buildTree();
        }

        if (octreeB.needsRebuild || !octreeB.box) {
            octreeB.buildTree();
        }

        const octree = new OctreeCSG(newMatDefs);
        const triangleHasher = new TriangleHasher();

        if ((octreeA.box as Box3).intersectsBox(octreeB.box as Box3)) {
            octreeA.resetPolygons(false);
            octreeB.resetPolygons(false);

            octreeA.markIntersectingPolygons(octreeB);
            octreeB.markIntersectingPolygons(octreeA);

            OctreeCSG.handleIntersectingOctrees(octreeA, octreeB);
            octreeA.deleteReplacedPolygons();
            octreeB.deleteReplacedPolygons();

            octreeA.deletePolygonsByStateRules(CSG_Rules.intersect.a);
            octreeB.deletePolygonsByStateRules(CSG_Rules.intersect.b);

            octreeA.deletePolygonsByIntersection(false);
            octreeB.deletePolygonsByIntersection(false);

            octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree), triangleHasher);
            octreeB.getPolygonCloneCallback(octree.addPolygon.bind(octree), triangleHasher);
        }

        triangleHasher.clear();

        octree.markPolygonsAsOriginal();

        return octree;
    }

    static unionArray(objArr: OctreeCSG[]) {
        return arrayOperation(OctreeCSG.union, objArr);
    }

    static subtractArray(objArr: OctreeCSG[]) {
        // XXX subtraction is a special case; the leftmost element is subtracted
        // with everything from the right, which means that:
        // subtractArray(0 ... N) = subtract(0, union(1 ... N))
        const objArrCount = objArr.length;
        if (objArrCount === 0) {
            throw new Error('Unable to find any result octree');
        } else if (objArrCount === 1) {
            return objArr[0];
        } else if (objArrCount === 2) {
            return OctreeCSG.subtract(objArr[0], objArr[1]);
        } else {
            return OctreeCSG.subtract(objArr[0], OctreeCSG.unionArray(objArr.slice(1)));
        }
    }

    static intersectArray(objArr: OctreeCSG[]) {
        return arrayOperation(OctreeCSG.intersect, objArr);
    }

    static operation(obj: OctreeCSGObject) {
        let resultOctree: OctreeCSG;

        switch (obj.op) {
            case 'union':
            case 'subtract':
            case 'intersect':
            {
                const octreeA = handleObjectForOp(obj.objA);
                const octreeB = handleObjectForOp(obj.objB);

                switch (obj.op) {
                    case 'union':
                        resultOctree = OctreeCSG.union(octreeA, octreeB);
                        break;
                    case 'subtract':
                        resultOctree = OctreeCSG.subtract(octreeA, octreeB);
                        break;
                    default:
                        resultOctree = OctreeCSG.intersect(octreeA, octreeB);
                }

                disposeOctree(octreeA, octreeB);
                break;
            }
            case 'unionArray':
            case 'subtractArray':
            case 'intersectArray':
            {
                const octrees = new Array<OctreeCSG>();

                for (const octreeObj of obj.objs) {
                    octrees.push(handleObjectForOp(octreeObj));
                }

                switch (obj.op) {
                    case 'unionArray':
                        resultOctree = OctreeCSG.unionArray(octrees);
                        break;
                    case 'subtractArray':
                        resultOctree = OctreeCSG.subtractArray(octrees);
                        break;
                    default:
                        resultOctree = OctreeCSG.intersectArray(octrees);
                }

                disposeOctree(...octrees);
                break;
            }
            default:
                throw new Error(`Unknown operation: ${(obj as {op: unknown}).op}`);
        }

        return resultOctree;
    }

    static async = {
        batchSize: 100,

        union(octreeA: OctreeCSG, octreeB: OctreeCSG): Promise<OctreeCSG> {
            const mergedMatDef = mergeTwoMaterials(octreeA.materials, octreeB.materials);
            return asyncOperation('union', OctreeCSG.union, octreeA, octreeB, mergedMatDef);
        },

        subtract(octreeA: OctreeCSG, octreeB: OctreeCSG): Promise<OctreeCSG> {
            const mergedMatDef = mergeTwoMaterials(octreeA.materials, octreeB.materials);
            return asyncOperation('subtract', OctreeCSG.subtract, octreeA, octreeB, mergedMatDef);
        },

        intersect(octreeA: OctreeCSG, octreeB: OctreeCSG): Promise<OctreeCSG> {
            const mergedMatDef = mergeTwoMaterials(octreeA.materials, octreeB.materials);
            return asyncOperation('intersect', OctreeCSG.intersect, octreeA, octreeB, mergedMatDef);
        },

        unionArray(objArr: OctreeCSG[]): Promise<OctreeCSG> {
            return asyncArrayOperation(OctreeCSG.async.union, OctreeCSG.async.unionArray, objArr);
        },

        async subtractArray(objArr: OctreeCSG[]): Promise<OctreeCSG> {
            // XXX subtraction is a special case; the leftmost element is
            // subtracted with everything from the right, which means that:
            // subtractArray(0 ... N) = subtract(0, union(1 ... N))
            const objArrCount = objArr.length;
            if (objArrCount === 0) {
                throw new Error('Unable to find any result octree');
            } else if (objArrCount === 1) {
                return objArr[0];
            } else if (objArrCount === 2) {
                return await OctreeCSG.async.subtract(objArr[0], objArr[1]);
            } else {
                return await OctreeCSG.async.subtract(objArr[0], await OctreeCSG.async.unionArray(objArr.slice(1)));
            }
        },

        intersectArray(objArr: OctreeCSG[]): Promise<OctreeCSG> {
            return asyncArrayOperation(OctreeCSG.async.intersect, OctreeCSG.async.intersectArray, objArr);
        },

        operation(obj: OctreeCSGObject): Promise<OctreeCSG> {
            return new Promise((resolve, reject) => {
                try {
                    switch (obj.op) {
                        case 'union':
                        case 'subtract':
                        case 'intersect':
                        {
                            let octreeA: OctreeCSG, octreeB: OctreeCSG;
                            const promises = [];
                            if (obj.objA) {
                                promises.push(handleObjectForOp_async(obj.objA, 0));
                            }

                            if (obj.objB) {
                                promises.push(handleObjectForOp_async(obj.objB, 1));
                            }

                            Promise.allSettled(promises).then(results => {
                                for (const result of results) {
                                    if (result.status === 'fulfilled') {
                                        const [csg, objIndex] = result.value;
                                        if (objIndex === 0) {
                                            octreeA = csg;
                                        } else if (objIndex === 1) {
                                            octreeB = csg;
                                        }
                                    }
                                }

                                let resultPromise;
                                switch (obj.op) {
                                    case 'union':
                                        resultPromise = OctreeCSG.async.union(octreeA, octreeB);
                                        break;
                                    case 'subtract':
                                        resultPromise = OctreeCSG.async.subtract(octreeA, octreeB);
                                        break;
                                    default:
                                        resultPromise = OctreeCSG.async.intersect(octreeA, octreeB);
                                }

                                resultPromise.then(resultOctree => {
                                    resolve(resultOctree);
                                    disposeOctree(octreeA, octreeB);
                                }).catch(e => reject(e));
                            });
                            break;
                        }
                        case 'unionArray':
                        case 'subtractArray':
                        case 'intersectArray':
                        {
                            const octrees = new Array<OctreeCSG>();

                            for (const octreeObj of obj.objs) {
                                octrees.push(handleObjectForOp(octreeObj));
                            }

                            let promise;
                            switch (obj.op) {
                                case 'unionArray':
                                    promise = OctreeCSG.async.unionArray(octrees);
                                    break;
                                case 'subtractArray':
                                    promise = OctreeCSG.async.subtractArray(octrees);
                                    break;
                                default:
                                    promise = OctreeCSG.async.intersectArray(octrees);
                            }

                            disposeOctree(...octrees);

                            promise.then(resultOctree => resolve(resultOctree));
                            break;
                        }
                        default:
                            throw new Error(`Unknown operation: ${(obj as {op: unknown}).op}`);
                    }
                }
                catch (e) {
                    reject(e);
                }
            });
        }
    }

    protected static handleIntersectingOctrees(octreeA: OctreeCSG, octreeB: OctreeCSG, bothOctrees = true, octreeA_buffer?: Float32Array, octreeB_buffer?: Float32Array) {
        if (OctreeCSG.useWindingNumber) {
            if (bothOctrees && !octreeA_buffer) {
                octreeA_buffer = prepareTriangleBuffer(octreeA.getPolygons());
            }

            if (!octreeB_buffer) {
                octreeB_buffer = prepareTriangleBuffer(octreeB.getPolygons());
            }
        }

        octreeA.handleIntersectingPolygons(octreeB, octreeB_buffer);

        if (bothOctrees) {
            octreeB.handleIntersectingPolygons(octreeA, octreeA_buffer);
        }

        if (octreeA_buffer !== undefined) {
            octreeA_buffer = undefined;
            octreeB_buffer = undefined;
        }
    }
}

function raycastIntersectAscSort(a: RayIntersect, b: RayIntersect) {
    return a.distance - b.distance;
}

function handleObjectForOp(obj: OctreeCSG | OctreeCSGObject) {
    if (obj instanceof OctreeCSG) {
        return obj;
    } else if (obj.op) {
        return OctreeCSG.operation(obj);
    } else {
        throw new Error('Invalid OctreeCSG operation object');
    }
}

function handleObjectForOp_async(obj: OctreeCSG | OctreeCSGObject, objIndex: number): Promise<[csg: OctreeCSG, objIndex: number]> {
    return new Promise((resolve, reject) => {
        try {
            if (obj instanceof OctreeCSG) {
                resolve([obj, objIndex]);
            } else if (obj.op) {
                OctreeCSG.async.operation(obj).then(returnObj => {
                    resolve([returnObj, objIndex]);
                });
            } else {
                throw new Error('Invalid OctreeCSG operation object');
            }
        }
        catch (e) {
            reject(e);
        }
    });
}

function disposeOctree(...octrees: OctreeCSG[]) {
    if (OctreeCSG.disposeOctree) {
        for (const octree of octrees) {
            octree.delete();
        }
    }
}

function handlePolygonArrayIntersections(targetPolygon: Polygon, outputPolygons: Polygon[], polygons: Polygon[]) {
    for (const polygon of polygons) {
        if (polygon.originalValid && polygon.valid && polygon.intersects && checkTrianglesIntersection(targetPolygon.triangle, polygon.triangle)) {
            outputPolygons.push(polygon);
        }
    }
}

function arrayOperation(callback: (octreeA: OctreeCSG, octreeB: OctreeCSG) => OctreeCSG, objArr: OctreeCSG[]) {
    let octreesArray = objArr.slice();

    // XXX minimise the octree bounding box after each operation by applying an
    // operation to pairs of octrees instead of applying it to the same octree
    // over and over again (which results in a single octree with a giant
    // bounding box), and trying to keep the same order. this works best when
    // each octree in the array is ordered by their position
    while (octreesArray.length > 1) {
        const octreeCount = octreesArray.length;
        const nextOctreeArray = new Array<OctreeCSG>();

        // process pairs
        let i = 0;
        for (; i + 1 < octreeCount; i += 2) {
            const octreeA = octreesArray[i];
            const octreeB = octreesArray[i + 1];
            const resultOctree = callback(octreeA, octreeB);
            disposeOctree(octreeA, octreeB);
            nextOctreeArray.push(resultOctree);
        }

        // add leftover octrees
        if (i < octreeCount) {
            nextOctreeArray.push(octreesArray[i]);
        }

        // next iteration array
        octreesArray = nextOctreeArray;
    }

    if (octreesArray.length === 0) {
        throw new Error('Unable to find any result octree');
    }

    return octreesArray[0];
}

async function asyncOperation(op: 'union' | 'subtract' | 'intersect', syncCallback: (octreeA: OctreeCSG, octreeB: OctreeCSG) => OctreeCSG, octreeA: OctreeCSG, octreeB: OctreeCSG, materials: MaterialDefinitions): Promise<OctreeCSG> {
    // try using async job dispatcher
    if (globalThis.globalOctreeCSGJobDispatcher) {
        try {
            return await globalThis.globalOctreeCSGJobDispatcher.dispatch({
                op,
                objA: octreeA,
                objB: octreeB,
            }, materials);
        } catch(error) {
            let rethrow = true;
            if (error instanceof JobError && error.failReason === JobFailReason.WorkerCreationFailure) {
                console.warn('Queued job failed due to worker creation failure. Retrying synchronously');
                rethrow = false;
            }

            if (rethrow) {
                throw error;
            }
        }
    }

    // fall back to synchronous implementation
    const result = syncCallback(octreeA, octreeB);
    disposeOctree(octreeA, octreeB);
    return result;
}

function asyncArrayOperation(singleCallback: (octreeA: OctreeCSG, octreeB: OctreeCSG) => Promise<OctreeCSG>, arrayCallback: (objArr: OctreeCSG[]) => Promise<OctreeCSG>, objArr: OctreeCSG[]): Promise<OctreeCSG> {
    return new Promise((resolve, reject) => {
        try {
            const usingBatches = OctreeCSG.async.batchSize > 4 && OctreeCSG.async.batchSize < objArr.length;
            let mainOctree: OctreeCSG;
            let mainOctreeUsed = false;
            const promises = [];

            if (usingBatches) {
                const batches = [];
                let currentIndex = 0;

                while (currentIndex < objArr.length) {
                    batches.push(objArr.slice(currentIndex, currentIndex + OctreeCSG.async.batchSize));
                    currentIndex += OctreeCSG.async.batchSize;
                }

                let batch;
                while ((batch = batches.shift())) { // XXX assignment is on purpose
                    promises.push(arrayCallback(batch));
                }

                mainOctreeUsed = true;
                objArr.length = 0;
            } else {
                const octreesArray: OctreeCSG[] = [];
                const objArrLen = objArr.length;
                for (let i = 0; i < objArrLen; i++) {
                    octreesArray.push(objArr[i]);
                }

                mainOctree = octreesArray.shift() as OctreeCSG;

                let leftOverOctree;
                const octreesArrayLen = octreesArray.length;
                for (let i = 0; i < octreesArrayLen; i += 2) {
                    if (i + 1 >= octreesArrayLen) {
                        leftOverOctree = octreesArray[i];
                        break;
                    }

                    promises.push(singleCallback(octreesArray[i], octreesArray[i + 1]));
                }

                if (leftOverOctree) {
                    promises.push(singleCallback(mainOctree, leftOverOctree));
                    mainOctreeUsed = true;
                }
            }

            Promise.allSettled(promises).then(results => {
                const octrees = new Array<OctreeCSG>();

                for (const result of results) {
                    if (result.status === 'fulfilled') {
                        octrees.push(result.value);
                    }
                }

                if (!mainOctreeUsed) {
                    octrees.unshift(mainOctree);
                }

                if (octrees.length <= 0) {
                    reject('Unable to find any result octree');
                } else if (octrees.length === 1) {
                    resolve(octrees[0]);
                } else if (octrees.length > 3) {
                    arrayCallback(octrees).then(result => {
                        resolve(result);
                    }).catch(e => reject(e));
                } else {
                    singleCallback(octrees[0], octrees[1]).then(result => {
                        if (octrees.length === 3) {
                            singleCallback(result, octrees[2]).then(innerResult => {
                                resolve(innerResult);
                            }).catch(e => reject(e));
                        } else {
                            resolve(result);
                        }
                    }).catch(e => reject(e));
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}