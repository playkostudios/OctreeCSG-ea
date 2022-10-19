import { polyInside_WindingNumber_buffer, _wP_EPS_ARR, prepareTriangleBuffer } from '../math/winding-number';
import { checkTrianglesIntersection } from '../math/three-triangle-intersection';
import { ReturnPolygonType, splitPolygonByPlane } from '../math/split-polygon';
import rayIntersectsTriangle from '../math/ray-intersects-triangle';
import pointRounding from '../math/pointRounding';
import { EPSILON } from '../math/const-numbers';
import { PolygonState } from '../math/Polygon';
import { tmpm3 } from '../math/temp';
import Box3 from '../math/Box3';
import Ray from '../math/Ray';

import type { Polygon } from '../math/Polygon';
import type Triangle from '../math/Triangle';

import { JobError, JobFailReason } from '../worker/JobError';
import TriangleHasher from './TriangleHasher';
import { CSG_Rules } from './CSGRule';

import type { OctreeCSGObject } from './OctreeCSGObject';
import type { CSGRulesArray } from './CSGRule';

import { mat3, mat4, vec3 } from 'gl-matrix';
import { MaterialDefinitions, MaterialAttributeTransform } from './MaterialDefinition';

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

export default class OctreeCSG {
    protected polygons: Polygon[];
    protected replacedPolygons: Polygon[];
    protected box?: Box3;
    protected subTrees: OctreeCSG[];
    protected parent: OctreeCSG | null;
    protected level: number;
    protected polygonArrays: Polygon[][];

    static disposeOctree = true;
    static useWindingNumber = false;
    static maxLevel = 16;
    static polygonsPerTree = 100;

    constructor(box?: Box3, parent: OctreeCSG | null = null) {
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
        return new OctreeCSG().copy(this);
    }

    copy(source: OctreeCSG) {
        this.deletePolygonsArrayFromRoot(this.polygons);
        this.polygons = source.polygons.map(p => p.clone());
        this.addPolygonsArrayToRoot(this.polygons);

        this.replacedPolygons = source.replacedPolygons.map(p => p.clone());
        this.box = source.box?.clone();
        this.level = source.level;

        for (const subTree of source.subTrees) {
            this.subTrees.push(new OctreeCSG(undefined, this).copy(subTree));
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

    protected split(level: number) {
        if (!this.box) {
            throw new Error('Octree has no box');
        }

        const subTrees = [];
        vec3.sub(_v2, this.box.max, this.box.min);
        const halfsize = vec3.scale(_v2, _v2, 0.5);
        for (let x = 0; x < 2; x++) {
            for (let y = 0; y < 2; y++) {
                for (let z = 0; z < 2; z++) {
                    const box = new Box3();
                    const v = vec3.set(_v1, x, y, z);

                    vec3.multiply(_v3, v, halfsize);
                    vec3.add(box.min, this.box.min, _v3);
                    vec3.add(box.max, box.min, halfsize);
                    box.expandByScalar(EPSILON);
                    subTrees.push(new OctreeCSG(box, this));
                }
            }
        }

        let polygon;
        while ((polygon = this.polygons.pop())) { // XXX assignment is on purpose
            let found = false;
            for (let i = 0; i < subTrees.length; i++) {
                const subTree = subTrees[i];
                const subBox = subTree.box;

                if (!subBox) {
                    throw new Error('Subtree has no box');
                }

                if (subBox.containsPoint(polygon.midpoint)) {
                    subTree.polygons.push(polygon);
                    found = true;
                }
            }

            if (!found) {
                console.error('ERROR: unable to find subtree for:', polygon.triangle);
                throw new Error(`Unable to find subtree for triangle at level ${level}`);
            }
        }

        for (const subTree of subTrees) {
            subTree.level = level + 1;
            const len = subTree.polygons.length;

            if (len > OctreeCSG.polygonsPerTree && level < OctreeCSG.maxLevel) {
                subTree.split(level + 1);

            }
            this.subTrees.push(subTree);
        }

        return this;
    }

    buildTree() {
        this.split(0);
        this.processTree();

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

        let distance = 1e100;

        for (const polygon of this.getRayPolygons(ray)) {
            // MollerTrumbore
            const result = rayIntersectsTriangle(ray, polygon.triangle, _v1);
            if (result) {
                const newdistance = vec3.distance(result, ray.origin);
                if (distance > newdistance) {
                    distance = newdistance;
                }
                if (distance < 1e100) {
                    intersects.push({ distance, polygon, position: vec3.add(vec3.create(), result, ray.origin) });
                }
            }
        }

        intersects.length && intersects.sort(raycastIntersectAscSort);
        return intersects;
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

    invert(materialDefinitions: MaterialDefinitions) {
        for(const polygonsArray of this.polygonArrays) {
            for(const polygon of polygonsArray) {
                if (polygon.valid) {
                    polygon.flip(materialDefinitions);
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

    protected handleIntersectingPolygons(targetOctree: OctreeCSG, materialDefinitions: MaterialDefinitions, targetOctreeBuffer?: Float32Array) {
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
                    const splitResults = splitPolygonByPlane(currentPolygon, target.plane, materialDefinitions);

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
                        const point = pointRounding(vec3.copy(_v2, currentPolygon.midpoint));

                        vec3.copy(_ray.origin, point);
                        vec3.copy(_rayDirection, currentPolygon.plane.unsafeNormal);
                        vec3.copy(_ray.direction, currentPolygon.plane.unsafeNormal);

                        let intersects = targetOctree.rayIntersect(_ray);
                        if (intersects.length > 0 && vec3.dot(_rayDirection, intersects[0].polygon.plane.unsafeNormal) > 0) {
                            inside = true;
                        } else if (currentPolygon.coplanar) {
                            for (const _wP_EPS of _wP_EPS_ARR) {
                                vec3.add(_ray.origin, point, _wP_EPS);
                                vec3.copy(_rayDirection, currentPolygon.plane.unsafeNormal);
                                vec3.copy(_ray.direction, currentPolygon.plane.unsafeNormal);

                                intersects = targetOctree.rayIntersect(_ray);
                                if (intersects.length > 0 && vec3.dot(_rayDirection, intersects[0].polygon.plane.unsafeNormal) > 0) {
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
            subTree.handleIntersectingPolygons(targetOctree, materialDefinitions, targetOctreeBuffer);
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

    applyMatrix(materialDefinitions: MaterialDefinitions, matrix: mat4, normalMatrix?: mat3, firstRun = true, needsNormalMatrix = false) {
        if (this.box) {
            this.box = undefined;
        }

        if (firstRun) {
            if (!needsNormalMatrix) {
                for (const attributes of materialDefinitions.values()) {
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
                polygon.applyMatrixNoAuto(materialDefinitions.get(polygon.shared), matrix, normalMatrix);
            }
        }

        for (const subTree of this.subTrees) {
            subTree.applyMatrix(materialDefinitions, matrix, normalMatrix, false, needsNormalMatrix);
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
    static union(octreeA: OctreeCSG, octreeB: OctreeCSG, materialDefinitions: MaterialDefinitions, buildTargetOctree = true) {
        if (!octreeA.box) {
            octreeA.buildTree();
        }

        if (!octreeB.box) {
            octreeB.buildTree();
        }

        const octree = new OctreeCSG();
        const triangleHasher = new TriangleHasher();

        if ((octreeA.box as Box3).intersectsBox(octreeB.box as Box3)) {
            octreeA.resetPolygons(false);
            octreeB.resetPolygons(false);

            octreeA.markIntersectingPolygons(octreeB);
            octreeB.markIntersectingPolygons(octreeA);

            OctreeCSG.handleIntersectingOctrees(octreeA, octreeB, materialDefinitions);
            octreeA.deleteReplacedPolygons();
            octreeB.deleteReplacedPolygons();

            octreeA.deletePolygonsByStateRules(CSG_Rules.union.a);
            octreeB.deletePolygonsByStateRules(CSG_Rules.union.b);
        }

        octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree), triangleHasher);
        octreeB.getPolygonCloneCallback(octree.addPolygon.bind(octree), triangleHasher);

        triangleHasher.clear();

        octree.markPolygonsAsOriginal();

        if (buildTargetOctree) {
            octree.buildTree();
        }

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
    static subtract(octreeA: OctreeCSG, octreeB: OctreeCSG, materialDefinitions: MaterialDefinitions, buildTargetOctree = true) {
        if (!octreeA.box) {
            octreeA.buildTree();
        }

        if (!octreeB.box) {
            octreeB.buildTree();
        }

        const octree = new OctreeCSG();
        const triangleHasher = new TriangleHasher();

        if ((octreeA.box as Box3).intersectsBox(octreeB.box as Box3)) {
            octreeA.resetPolygons(false);
            octreeB.resetPolygons(false);
            octreeA.markIntersectingPolygons(octreeB);
            octreeB.markIntersectingPolygons(octreeA);


            OctreeCSG.handleIntersectingOctrees(octreeA, octreeB, materialDefinitions);
            octreeA.deleteReplacedPolygons();
            octreeB.deleteReplacedPolygons();

            octreeA.deletePolygonsByStateRules(CSG_Rules.subtract.a);
            octreeB.deletePolygonsByStateRules(CSG_Rules.subtract.b);


            octreeB.deletePolygonsByIntersection(false);

            octreeB.invert(materialDefinitions);

            octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree), triangleHasher);
            octreeB.getPolygonCloneCallback(octree.addPolygon.bind(octree), triangleHasher);
        }
        else {
            octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree), triangleHasher);
        }

        triangleHasher.clear();

        octree.markPolygonsAsOriginal();

        if (buildTargetOctree) {
            octree.buildTree();
        }

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
    static intersect(octreeA: OctreeCSG, octreeB: OctreeCSG, materialDefinitions: MaterialDefinitions, buildTargetOctree = true) {
        if (!octreeA.box) {
            octreeA.buildTree();
        }

        if (!octreeB.box) {
            octreeB.buildTree();
        }

        const octree = new OctreeCSG();
        const triangleHasher = new TriangleHasher();

        if ((octreeA.box as Box3).intersectsBox(octreeB.box as Box3)) {
            octreeA.resetPolygons(false);
            octreeB.resetPolygons(false);

            octreeA.markIntersectingPolygons(octreeB);
            octreeB.markIntersectingPolygons(octreeA);

            OctreeCSG.handleIntersectingOctrees(octreeA, octreeB, materialDefinitions);
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

        if (buildTargetOctree) {
            octree.buildTree();
        }

        return octree;
    }

    static unionArray(objArr: OctreeCSG[], materialDefinitions: MaterialDefinitions) {
        return arrayOperation(OctreeCSG.union, objArr, materialDefinitions);
    }

    static subtractArray(objArr: OctreeCSG[], materialDefinitions: MaterialDefinitions) {
        // XXX subtraction is a special case; the leftmost element is subtracted
        // with everything from the right, which means that:
        // subtractArray(0 ... N) = subtract(0, union(1 ... N))
        const objArrCount = objArr.length;
        if (objArrCount === 0) {
            throw new Error('Unable to find any result octree');
        } else if (objArrCount === 1) {
            return objArr[0];
        } else if (objArrCount === 2) {
            return OctreeCSG.subtract(objArr[0], objArr[1], materialDefinitions);
        } else {
            return OctreeCSG.subtract(objArr[0], OctreeCSG.unionArray(objArr.slice(1), materialDefinitions), materialDefinitions);
        }
    }

    static intersectArray(objArr: OctreeCSG[], materialDefinitions: MaterialDefinitions) {
        return arrayOperation(OctreeCSG.intersect, objArr, materialDefinitions);
    }

    static operation(obj: OctreeCSGObject, materialDefinitions: MaterialDefinitions, buildTargetOctree = true) {
        let resultOctree: OctreeCSG;

        switch (obj.op) {
            case 'union':
            case 'subtract':
            case 'intersect':
            {
                const octreeA = handleObjectForOp(obj.objA, materialDefinitions, buildTargetOctree);
                const octreeB = handleObjectForOp(obj.objB, materialDefinitions, buildTargetOctree);

                switch (obj.op) {
                    case 'union':
                        resultOctree = OctreeCSG.union(octreeA, octreeB, materialDefinitions, buildTargetOctree);
                        break;
                    case 'subtract':
                        resultOctree = OctreeCSG.subtract(octreeA, octreeB, materialDefinitions, buildTargetOctree);
                        break;
                    default:
                        resultOctree = OctreeCSG.intersect(octreeA, octreeB, materialDefinitions, buildTargetOctree);
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
                    octrees.push(handleObjectForOp(octreeObj, materialDefinitions, buildTargetOctree));
                }

                switch (obj.op) {
                    case 'unionArray':
                        resultOctree = OctreeCSG.unionArray(octrees, materialDefinitions);
                        break;
                    case 'subtractArray':
                        resultOctree = OctreeCSG.subtractArray(octrees, materialDefinitions);
                        break;
                    default:
                        resultOctree = OctreeCSG.intersectArray(octrees, materialDefinitions);
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

        union(octreeA: OctreeCSG, octreeB: OctreeCSG, materialDefinitions: MaterialDefinitions, buildTargetOctree = true): Promise<OctreeCSG> {
            return asyncOperation('union', OctreeCSG.union, octreeA, octreeB, materialDefinitions, buildTargetOctree);
        },

        subtract(octreeA: OctreeCSG, octreeB: OctreeCSG, materialDefinitions: MaterialDefinitions, buildTargetOctree = true): Promise<OctreeCSG> {
            return asyncOperation('subtract', OctreeCSG.subtract, octreeA, octreeB, materialDefinitions, buildTargetOctree);
        },

        intersect(octreeA: OctreeCSG, octreeB: OctreeCSG, materialDefinitions: MaterialDefinitions, buildTargetOctree = true): Promise<OctreeCSG> {
            return asyncOperation('intersect', OctreeCSG.intersect, octreeA, octreeB, materialDefinitions, buildTargetOctree);
        },

        unionArray(objArr: OctreeCSG[], materialDefinitions: MaterialDefinitions): Promise<OctreeCSG> {
            return asyncArrayOperation(OctreeCSG.async.union, OctreeCSG.async.unionArray, objArr, materialDefinitions);
        },

        async subtractArray(objArr: OctreeCSG[], materialDefinitions: MaterialDefinitions): Promise<OctreeCSG> {
            // XXX subtraction is a special case; the leftmost element is
            // subtracted with everything from the right, which means that:
            // subtractArray(0 ... N) = subtract(0, union(1 ... N))
            const objArrCount = objArr.length;
            if (objArrCount === 0) {
                throw new Error('Unable to find any result octree');
            } else if (objArrCount === 1) {
                return objArr[0];
            } else if (objArrCount === 2) {
                return await OctreeCSG.async.subtract(objArr[0], objArr[1], materialDefinitions);
            } else {
                return await OctreeCSG.async.subtract(objArr[0], await OctreeCSG.async.unionArray(objArr.slice(1), materialDefinitions), materialDefinitions);
            }
        },

        intersectArray(objArr: OctreeCSG[], materialDefinitions: MaterialDefinitions): Promise<OctreeCSG> {
            return asyncArrayOperation(OctreeCSG.async.intersect, OctreeCSG.async.intersectArray, objArr, materialDefinitions);
        },

        operation(obj: OctreeCSGObject, materialDefinitions: MaterialDefinitions, buildTargetOctree = true): Promise<OctreeCSG> {
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
                                promises.push(handleObjectForOp_async(obj.objA, materialDefinitions, buildTargetOctree, 0));
                            }

                            if (obj.objB) {
                                promises.push(handleObjectForOp_async(obj.objB, materialDefinitions, buildTargetOctree, 1));
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
                                        resultPromise = OctreeCSG.async.union(octreeA, octreeB, materialDefinitions, buildTargetOctree);
                                        break;
                                    case 'subtract':
                                        resultPromise = OctreeCSG.async.subtract(octreeA, octreeB, materialDefinitions, buildTargetOctree);
                                        break;
                                    default:
                                        resultPromise = OctreeCSG.async.intersect(octreeA, octreeB, materialDefinitions, buildTargetOctree);
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
                                octrees.push(handleObjectForOp(octreeObj, materialDefinitions, buildTargetOctree));
                            }

                            let promise;
                            switch (obj.op) {
                                case 'unionArray':
                                    promise = OctreeCSG.async.unionArray(octrees, materialDefinitions);
                                    break;
                                case 'subtractArray':
                                    promise = OctreeCSG.async.subtractArray(octrees, materialDefinitions);
                                    break;
                                default:
                                    promise = OctreeCSG.async.intersectArray(octrees, materialDefinitions);
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

    protected static handleIntersectingOctrees(octreeA: OctreeCSG, octreeB: OctreeCSG, materialDefinitions: MaterialDefinitions, bothOctrees = true, octreeA_buffer?: Float32Array, octreeB_buffer?: Float32Array) {
        if (OctreeCSG.useWindingNumber) {
            if (bothOctrees && !octreeA_buffer) {
                octreeA_buffer = prepareTriangleBuffer(octreeA.getPolygons());
            }

            if (!octreeB_buffer) {
                octreeB_buffer = prepareTriangleBuffer(octreeB.getPolygons());
            }
        }

        octreeA.handleIntersectingPolygons(octreeB, materialDefinitions, octreeB_buffer);

        if (bothOctrees) {
            octreeB.handleIntersectingPolygons(octreeA, materialDefinitions, octreeA_buffer);
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

function handleObjectForOp(obj: OctreeCSG | OctreeCSGObject, materialDefinitions: MaterialDefinitions, buildTargetOctree: boolean) {
    if (obj instanceof OctreeCSG) {
        return obj;
    } else if (obj.op) {
        return OctreeCSG.operation(obj, materialDefinitions, buildTargetOctree);
    } else {
        throw new Error('Invalid OctreeCSG operation object');
    }
}

function handleObjectForOp_async(obj: OctreeCSG | OctreeCSGObject, materialDefinitions: MaterialDefinitions, buildTargetOctree: boolean, objIndex: number): Promise<[csg: OctreeCSG, objIndex: number]> {
    return new Promise((resolve, reject) => {
        try {
            if (obj instanceof OctreeCSG) {
                resolve([obj, objIndex]);
            } else if (obj.op) {
                OctreeCSG.async.operation(obj, materialDefinitions, buildTargetOctree).then(returnObj => {
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

function arrayOperation(callback: (octreeA: OctreeCSG, octreeB: OctreeCSG, materialDefinitions: MaterialDefinitions, buildTargetOctree?: boolean) => OctreeCSG, objArr: OctreeCSG[], materialDefinitions: MaterialDefinitions) {
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
            const resultOctree = callback(octreeA, octreeB, materialDefinitions);
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

async function asyncOperation(op: 'union' | 'subtract' | 'intersect', syncCallback: (octreeA: OctreeCSG, octreeB: OctreeCSG, materialDefinitions: MaterialDefinitions, buildTargetOctree?: boolean) => OctreeCSG, octreeA: OctreeCSG, octreeB: OctreeCSG, materialDefinitions: MaterialDefinitions, buildTargetOctree = true): Promise<OctreeCSG> {
    // try using async job dispatcher
    if (globalThis.globalOctreeCSGJobDispatcher) {
        try {
            return await globalThis.globalOctreeCSGJobDispatcher.dispatch({
                op,
                objA: octreeA,
                objB: octreeB,
            }, materialDefinitions);
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
    const result = syncCallback(octreeA, octreeB, materialDefinitions, buildTargetOctree);
    disposeOctree(octreeA, octreeB);
    return result;
}

function asyncArrayOperation(singleCallback: (octreeA: OctreeCSG, octreeB: OctreeCSG, materialDefinitions: MaterialDefinitions, buildTargetOctree?: boolean) => Promise<OctreeCSG>, arrayCallback: (objArr: OctreeCSG[], materialDefinitions: MaterialDefinitions) => Promise<OctreeCSG>, objArr: OctreeCSG[], materialDefinitions: MaterialDefinitions): Promise<OctreeCSG> {
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
                    promises.push(arrayCallback(batch, materialDefinitions));
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

                    promises.push(singleCallback(octreesArray[i], octreesArray[i + 1], materialDefinitions));
                }

                if (leftOverOctree) {
                    promises.push(singleCallback(mainOctree, leftOverOctree, materialDefinitions));
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
                    arrayCallback(octrees, materialDefinitions).then(result => {
                        resolve(result);
                    }).catch(e => reject(e));
                } else {
                    singleCallback(octrees[0], octrees[1], materialDefinitions).then(result => {
                        if (octrees.length === 3) {
                            singleCallback(result, octrees[2], materialDefinitions).then(innerResult => {
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