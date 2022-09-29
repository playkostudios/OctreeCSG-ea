import { checkTrianglesIntersection } from './three-triangle-intersection';
import { Polygon, PolygonState } from './math/Polygon';
import Plane from './math/Plane';
import Vertex from './math/Vertex';
import Triangle from './math/Triangle';
import { tmpm3, tv0 } from './temp';
import { polyInside_WindingNumber_buffer, _wP_EPS_ARR } from './common';

// TODO port whole file to gl-matrix

const _v1 = new Vector3();
const _v2 = new Vector3();
const _box3$1 = new Box3();

const _ray = new Ray();
const _rayDirection = new Vector3(0, 0, 1);

const EPSILON = 1e-5;
const COPLANAR = 0;
const FRONT = 1;
const BACK = 2;
const SPANNING = 3;

// working values for rayIntersectsTriangle static method
const edge1 = new Vector3();
const edge2 = new Vector3();
const h = new Vector3();
const s = new Vector3();
const q = new Vector3();
const RAY_EPSILON = 0.0000001;

interface RayIntersect {
    distance: number,
    polygon: Polygon,
    position: Vector3
}

interface OctreeCSGObject {
    op: 'union' | 'subtract' | 'intersect',
    objA: OctreeCSG | OctreeCSGObject,
    objB: OctreeCSG | OctreeCSGObject
}

class OctreeCSG {
    polygons: Polygon[];
    replacedPolygons: Polygon[];
    box?: Box3;
    subTrees: OctreeCSG[];
    parent: OctreeCSG | null;
    level: number;
    polygonArrays: Polygon[][];
    bounds?: Box3;

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

    addPolygonsArrayToRoot(array: Polygon[]) {
        if (this.parent) {
            this.parent.addPolygonsArrayToRoot(array);
        } else {
            this.polygonArrays.push(array);
        }
    }

    deletePolygonsArrayFromRoot(array: Polygon[]) {
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

    addPolygon(polygon: Polygon, trianglesSet?: Set<string>) {
        if (!this.bounds) {
            this.bounds = new Box3();
        }

        const triangle = polygon.triangle;

        if (trianglesSet && !isUniqueTriangle(triangle, trianglesSet)) {
            return this;
        }

        this.bounds.min.x = Math.min(this.bounds.min.x, triangle.a.x, triangle.b.x, triangle.c.x);
        this.bounds.min.y = Math.min(this.bounds.min.y, triangle.a.y, triangle.b.y, triangle.c.y);
        this.bounds.min.z = Math.min(this.bounds.min.z, triangle.a.z, triangle.b.z, triangle.c.z);
        this.bounds.max.x = Math.max(this.bounds.max.x, triangle.a.x, triangle.b.x, triangle.c.x);
        this.bounds.max.y = Math.max(this.bounds.max.y, triangle.a.y, triangle.b.y, triangle.c.y);
        this.bounds.max.z = Math.max(this.bounds.max.z, triangle.a.z, triangle.b.z, triangle.c.z);

        this.polygons.push(polygon);
        return this;
    }

    calcBox() {
        if (!this.bounds) {
            this.bounds = new Box3();
        }

        this.box = this.bounds.clone();

        // offset small ammount to account for regular grid
        this.box.min.x -= 0.01;
        this.box.min.y -= 0.01;
        this.box.min.z -= 0.01;

        return this;
    }

    newOctree(box?: Box3, parent?: OctreeCSG) {
        return new OctreeCSG(box, parent);
    }

    split(level: number) {
        if (!this.box) {
            throw new Error('Octree has no box');
        }

        const subTrees = [];
        const halfsize = _v2.copy(this.box.max).sub(this.box.min).multiplyScalar(0.5);
        for (let x = 0; x < 2; x++) {
            for (let y = 0; y < 2; y++) {
                for (let z = 0; z < 2; z++) {
                    const box = new Box3();
                    const v = _v1.set(x, y, z);

                    box.min.copy(this.box.min).add(v.multiply(halfsize));
                    box.max.copy(box.min).add(halfsize);
                    box.expandByScalar(EPSILON);
                    subTrees.push(this.newOctree(box, this));
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

                if (subBox.containsPoint(polygon.getMidpoint())) {
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
        this.calcBox();
        this.split(0);
        this.processTree();

        return this;
    }

    processTree() {
        if (!this.isEmpty()) {
            if (!this.box) {
                throw new Error('Octree has no box');
            }

            _box3$1.copy(this.box);
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

    expandParentBox() {
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

    _handlePolygonArrayIntersections(targetPolygon: Polygon, outputPolygons: Polygon[], polygons: Polygon[]) {
        for (const polygon of polygons) {
            if (!polygon.originalValid || !polygon.valid || !polygon.intersects) {
                continue;
            }

            if (checkTrianglesIntersection(targetPolygon.triangle, polygon.triangle)) {
                outputPolygons.push(polygon);
            }
        }
    }

    getPolygonsIntersectingPolygon(targetPolygon: Polygon, polygons: Polygon[] = []) {
        if (!this.box) {
            throw new Error('Octree has no box');
        }

        if (this.box.intersectsTriangle(targetPolygon.triangle) && this.polygons.length > 0) {
            this._handlePolygonArrayIntersections(targetPolygon, polygons, this.polygons);
            this._handlePolygonArrayIntersections(targetPolygon, polygons, this.replacedPolygons);
        }

        for (const subTree of this.subTrees) {
            subTree.getPolygonsIntersectingPolygon(targetPolygon, polygons);
        }

        return polygons;
    }

    getRayPolygons(ray: Ray, polygons: Polygon[] = []) {
        for (const polygon of this.polygons) {
            if (polygon.valid && polygon.originalValid && polygons.indexOf(polygon) === -1) {
                polygons.push(polygon);
            }
        }

        if (this.replacedPolygons.length > 0) {
            polygons.push(...this.replacedPolygons);
        }

        for (const subTree of this.subTrees) {
            if (ray.intersectsBox(subTree.box as Box3)) {
                subTree.getRayPolygons(ray, polygons);
            }
        }

        return polygons;
    }

    rayIntersect(ray: Ray, intersects: RayIntersect[] = []) {
        if (ray.direction.length() === 0) return [];

        let distance = 1e100;

        for (const polygon of this.getRayPolygons(ray)) {
            // MollerTrumbore
            const result = OctreeCSG.rayIntersectsTriangle(ray, polygon.triangle, _v1);
            if (result) {
                const newdistance = result.clone().sub(ray.origin).length();
                if (distance > newdistance) {
                    distance = newdistance;
                }
                if (distance < 1e100) {
                    intersects.push({ distance, polygon, position: result.clone().add(ray.origin) });
                }
            }
        }

        intersects.length && intersects.sort(raycastIntersectAscSort);
        return intersects;
    }

    getIntersectingPolygons(polygons: Polygon[] = []) {
        this.polygonArrays.forEach(polygonsArray => {
            for (const polygon of polygonsArray) {
                if (polygon.valid && polygon.intersects) {
                    polygons.push(polygon);
                }
            }
        });

        return polygons;
    }

    getPolygons(polygons: Polygon[] = []) {
        this.polygonArrays.forEach(polygonsArray => {
            for (const polygon of polygonsArray) {
                if (polygon.valid && polygons.indexOf(polygon) === -1) {
                    polygons.push(polygon);
                }
            }
        });

        return polygons;
    }

    invert() {
        this.polygonArrays.forEach(polygonsArray => {
            polygonsArray.forEach(p => p.flip());
        });
    }

    replacePolygon(polygon: Polygon, newPolygons: Polygon[] | Polygon) {
        if (!Array.isArray(newPolygons)) {
            newPolygons = [newPolygons];
        }

        if (this.polygons.length > 0) {
            const polygonIndex = this.polygons.indexOf(polygon);
            if (polygonIndex > -1) {
                if (polygon.originalValid === true) {
                    this.replacedPolygons.push(polygon);
                }
                else {
                    polygon.setInvalid();
                }


                this.polygons.splice(polygonIndex, 1, ...newPolygons);
            }
        }

        for (const subTree of this.subTrees) {
            subTree.replacePolygon(polygon, newPolygons);
        }
    }

    deletePolygonsByStateRules(rulesArr: CSGRulesArray, firstRun = true) {
        this.polygonArrays.forEach(polygonsArray => {
            if (polygonsArray.length === 0) {
                return;
            }

            polygonsArray.slice().forEach(polygon => {
                if (!polygon.valid || !polygon.intersects) {
                    return;
                }

                let found = false;
                for (const rule of rulesArr) {
                    if (rule.array) {
                        const states = rule.rule;
                        if (states.includes(polygon.state) && (((polygon.previousState !== PolygonState.Undecided) && (states.includes(polygon.previousState))) || polygon.previousState === PolygonState.Undecided)) {
                            found = true;
                            const missingStates = new Set<PolygonState>();
                            states.forEach(state => missingStates.add(state));
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
            });
        });
    }

    deletePolygonsByIntersection(intersects: boolean, firstRun = true) {
        this.polygonArrays.forEach(polygonsArray => {
            if (polygonsArray.length === 0) {
                return;
            }

            polygonsArray.slice().forEach(polygon => {
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
            });
        });
    }

    isPolygonIntersecting(polygon: Polygon) {
        if (!this.box) {
            throw new Error('Octree has no box');
        }

        return this.box.intersectsTriangle(polygon.triangle);
    }

    markIntersectingPolygons(targetOctree: OctreeCSG) {
        this.polygonArrays.forEach(polygonsArray => {
            polygonsArray.forEach(polygon => {
                polygon.intersects = targetOctree.isPolygonIntersecting(polygon);
            });
        });
    }

    resetPolygons(resetOriginal = true) {
        this.polygonArrays.forEach(polygonsArray => {
            polygonsArray.forEach(polygon => {
                polygon.reset(resetOriginal);
            });
        });
    }

    handleIntersectingPolygons(targetOctree: OctreeCSG, targetOctreeBuffer?: Float32Array) {
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
                    const splitResults = splitPolygonByPlane(currentPolygon, target.plane);

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
                if (targetOctree.box.containsPoint(currentPolygon.getMidpoint())) {
                    if (OctreeCSG.useWindingNumber) {
                        inside = polyInside_WindingNumber_buffer(targetOctreeBuffer as Float32Array, currentPolygon.getMidpoint(), currentPolygon.coplanar);
                    } else {
                        const point = pointRounding(_v2.copy(currentPolygon.getMidpoint()));

                        _ray.origin.copy(point);
                        _rayDirection.copy(currentPolygon.plane.normal);
                        _ray.direction.copy(currentPolygon.plane.normal);

                        let intersects = targetOctree.rayIntersect(_ray);
                        if (intersects.length > 0 && _rayDirection.dot(intersects[0].polygon.plane.normal) > 0) {
                            inside = true;
                        }

                        if (!inside && currentPolygon.coplanar) {
                            for (const _wP_EPS of _wP_EPS_ARR) {
                                _ray.origin.copy(point).add(_wP_EPS);
                                _rayDirection.copy(currentPolygon.plane.normal);
                                _ray.direction.copy(currentPolygon.plane.normal);

                                intersects = targetOctree.rayIntersect(_ray);
                                if (intersects.length > 0 && _rayDirection.dot(intersects[0].polygon.plane.normal) > 0) {
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
            this.polygons.forEach(p => p.delete());
            this.polygons.length = 0;
        }

        if (this.replacedPolygons.length > 0 && deletePolygons) {
            this.replacedPolygons.forEach(p => p.delete());
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

    getPolygonCloneCallback(cbFunc: (polygon: Polygon, trianglesSet: Set<string>) => unknown, trianglesSet: Set<string>) {
        this.polygonArrays.forEach(polygonsArray => {
            for (const polygon of polygonsArray) {
                if (polygon.valid) {
                    cbFunc(polygon.clone(), trianglesSet);
                }
            }
        });
    }

    deleteReplacedPolygons() {
        if (this.replacedPolygons.length > 0) {
            this.replacedPolygons.forEach(p => p.delete());
            this.replacedPolygons.length = 0;
        }

        for (const subTree of this.subTrees) {
            subTree.deleteReplacedPolygons();
        }
    }

    markPolygonsAsOriginal() {
        this.polygonArrays.forEach(polygonsArray => {
            polygonsArray.forEach(p => p.originalValid = true);
        });
    }

    applyMatrix(matrix: Matrix4, normalMatrix?: Matrix3, firstRun = true) {
        if (!this.box) {
            throw new Error('Octree has no box');
        }

        this.box.makeEmpty();

        if (!normalMatrix) {
            normalMatrix = tmpm3.getNormalMatrix(matrix);
        }

        for (const polygon of this.polygons) {
            if (polygon.valid) {
                polygon.applyMatrix(matrix, normalMatrix);
            }
        }

        for (const subTree of this.subTrees) {
            subTree.applyMatrix(matrix, normalMatrix, false);
        }

        if (firstRun) {
            this.processTree();
        }
    }

    setPolygonIndex(index: number) {
        if (index === undefined) {
            return;
        }

        this.polygonArrays.forEach(polygonsArray => {
            polygonsArray.forEach(p => p.shared = index);
        });
    }

    // utils from OctreeCSG.extended.js
    getTriangles(triangles: Triangle[] = []) {
        this.getPolygons().forEach(p => triangles.push(p.triangle));
        return triangles;
    }

    getRayTriangles(ray: Ray, triangles: Triangle[] = []) {
        this.getRayPolygons(ray).forEach(p => triangles.push(p.triangle));
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
    static union(octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree = true) {
        if (!octreeA.box) {
            octreeA.buildTree();
        }

        if (!octreeB.box) {
            octreeB.buildTree();
        }

        const octree = new OctreeCSG();
        const trianglesSet = new Set<string>();

        if ((octreeA.box as Box3).intersectsBox(octreeB.box as Box3)) {
            octreeA.resetPolygons(false);
            octreeB.resetPolygons(false);

            octreeA.markIntersectingPolygons(octreeB);
            octreeB.markIntersectingPolygons(octreeA);

            handleIntersectingOctrees(octreeA, octreeB);
            octreeA.deleteReplacedPolygons();
            octreeB.deleteReplacedPolygons();

            octreeA.deletePolygonsByStateRules(CSG_Rules.union.a);
            octreeB.deletePolygonsByStateRules(CSG_Rules.union.b);
        }

        octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree), trianglesSet);
        octreeB.getPolygonCloneCallback(octree.addPolygon.bind(octree), trianglesSet);

        trianglesSet.clear();

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
    static subtract(octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree = true) {
        if (!octreeA.box) {
            octreeA.buildTree();
        }

        if (!octreeB.box) {
            octreeB.buildTree();
        }

        const octree = new OctreeCSG();
        const trianglesSet = new Set<string>();

        if ((octreeA.box as Box3).intersectsBox(octreeB.box as Box3)) {
            octreeA.resetPolygons(false);
            octreeB.resetPolygons(false);
            octreeA.markIntersectingPolygons(octreeB);
            octreeB.markIntersectingPolygons(octreeA);


            handleIntersectingOctrees(octreeA, octreeB);
            octreeA.deleteReplacedPolygons();
            octreeB.deleteReplacedPolygons();

            octreeA.deletePolygonsByStateRules(CSG_Rules.subtract.a);
            octreeB.deletePolygonsByStateRules(CSG_Rules.subtract.b);


            octreeB.deletePolygonsByIntersection(false);

            octreeB.invert();

            octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree), trianglesSet);
            octreeB.getPolygonCloneCallback(octree.addPolygon.bind(octree), trianglesSet);
        }
        else {
            octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree), trianglesSet);
        }

        trianglesSet.clear();

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
    static intersect(octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree = true) {
        if (!octreeA.box) {
            octreeA.buildTree();
        }

        if (!octreeB.box) {
            octreeB.buildTree();
        }

        const octree = new OctreeCSG();
        const trianglesSet = new Set<string>();

        if ((octreeA.box as Box3).intersectsBox(octreeB.box as Box3)) {
            octreeA.resetPolygons(false);
            octreeB.resetPolygons(false);

            octreeA.markIntersectingPolygons(octreeB);
            octreeB.markIntersectingPolygons(octreeA);

            handleIntersectingOctrees(octreeA, octreeB);
            octreeA.deleteReplacedPolygons();
            octreeB.deleteReplacedPolygons();

            octreeA.deletePolygonsByStateRules(CSG_Rules.intersect.a);
            octreeB.deletePolygonsByStateRules(CSG_Rules.intersect.b);

            octreeA.deletePolygonsByIntersection(false);
            octreeB.deletePolygonsByIntersection(false);

            octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree), trianglesSet);
            octreeB.getPolygonCloneCallback(octree.addPolygon.bind(octree), trianglesSet);
        }

        trianglesSet.clear();

        octree.markPolygonsAsOriginal();

        if (buildTargetOctree) {
            octree.buildTree();
        }

        return octree;
    }

    static _arrayOperation(callback: (octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree?: boolean) => OctreeCSG, objArr: OctreeCSG[], materialIndexMax: number) {
        const octreesArray = [];
        const objArrLen = objArr.length;

        for (let i = 0; i < objArrLen; i++) {
            const tempOctree = objArr[i];
            tempOctree.setPolygonIndex(i > materialIndexMax ? materialIndexMax : i);
            octreesArray.push(tempOctree);
        }

        let octreeA = octreesArray.shift();
        let octreeB = octreesArray.shift();

        while (octreeA && octreeB) {
            const resultOctree = callback(octreeA, octreeB);
            disposeOctree(octreeA, octreeB);
            octreeA = resultOctree;
            octreeB = octreesArray.shift();
        }

        if (!octreeA) {
            throw new Error('Unable to find any result octree');
        }

        return octreeA;
    }

    static unionArray(objArr: OctreeCSG[], materialIndexMax = Infinity) {
        return OctreeCSG._arrayOperation(OctreeCSG.union, objArr, materialIndexMax);
    }

    static subtractArray(objArr: OctreeCSG[], materialIndexMax = Infinity) {
        return OctreeCSG._arrayOperation(OctreeCSG.subtract, objArr, materialIndexMax);
    }

    static intersectArray(objArr: OctreeCSG[], materialIndexMax = Infinity) {
        return OctreeCSG._arrayOperation(OctreeCSG.intersect, objArr, materialIndexMax);
    }

    static operation(obj: OctreeCSGObject, buildTargetOctree = true, options = { objCounter: 0 }) {
        let resultOctree: OctreeCSG;
        const octreeA = handleObjectForOp(obj.objA, buildTargetOctree, options);
        const octreeB = handleObjectForOp(obj.objB, buildTargetOctree, options);

        switch (obj.op) {
            case 'union':
                resultOctree = OctreeCSG.union(octreeA, octreeB, buildTargetOctree);
                break;
            case 'subtract':
                resultOctree = OctreeCSG.subtract(octreeA, octreeB, buildTargetOctree);
                break;
            case 'intersect':
                resultOctree = OctreeCSG.intersect(octreeA, octreeB, buildTargetOctree);
                break;
            default:
                throw new Error(`Unknown operation: ${obj.op}`);
        }

        disposeOctree(octreeA, octreeB);

        return resultOctree;
    }

    static rayIntersectsTriangle(ray: Ray, triangle: Triangle, target = new Vector3()) {
        // https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
        edge1.subVectors(triangle.b, triangle.a);
        edge2.subVectors(triangle.c, triangle.a);
        h.crossVectors(ray.direction, edge2);

        const a = edge1.dot(h);
        if (a > -RAY_EPSILON && a < RAY_EPSILON) {
            return null; // Ray is parallel to the triangle
        }

        s.subVectors(ray.origin, triangle.a);

        const f = 1 / a;
        const u = f * s.dot(h);
        if (u < 0 || u > 1) {
            return null;
        }

        q.crossVectors(s, edge1);

        const v = f * ray.direction.dot(q);
        if (v < 0 || u + v > 1) {
            return null;
        }

        // Check where intersection is
        const t = f * edge2.dot(q);
        if (t > RAY_EPSILON) {
            return target.copy(ray.direction).multiplyScalar(t).add(ray.origin);
        }

        return null;
    }

    // TODO use workers
    static async = {
        batchSize: 100,

        union(octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree = true): Promise<OctreeCSG> {
            // TODO this isn't actually async, just wrapped in a promise
            return new Promise((resolve, reject) => {
                try {
                    resolve(OctreeCSG.union(octreeA, octreeB, buildTargetOctree));
                    disposeOctree(octreeA, octreeB);
                }
                catch (e) {
                    reject(e);
                }
            });
        },

        subtract(octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree = true): Promise<OctreeCSG> {
            // TODO this isn't actually async, just wrapped in a promise
            return new Promise((resolve, reject) => {
                try {
                    resolve(OctreeCSG.subtract(octreeA, octreeB, buildTargetOctree));
                    disposeOctree(octreeA, octreeB);
                }
                catch (e) {
                    reject(e);
                }
            });
        },

        intersect(octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree = true): Promise<OctreeCSG> {
            // TODO this isn't actually async, just wrapped in a promise
            return new Promise((resolve, reject) => {
                try {
                    resolve(OctreeCSG.intersect(octreeA, octreeB, buildTargetOctree));
                    disposeOctree(octreeA, octreeB);
                }
                catch (e) {
                    reject(e);
                }
            });
        },

        _arrayOperation(singleCallback: (octreeA: OctreeCSG, octreeB: OctreeCSG, buildTargetOctree?: boolean) => Promise<OctreeCSG>, arrayCallback: (objArr: OctreeCSG[], materialIndexMax?: number) => Promise<OctreeCSG>, objArr: OctreeCSG[], materialIndexMax: number): Promise<OctreeCSG> {
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
                            promises.push(arrayCallback(batch, 0));
                        }

                        mainOctreeUsed = true;
                        objArr.length = 0;
                    } else {
                        const octreesArray: OctreeCSG[] = [];
                        const objArrLen = objArr.length;
                        for (let i = 0; i < objArrLen; i++) {
                            const tempOctree = objArr[i];

                            if (materialIndexMax > -1) {
                                tempOctree.setPolygonIndex(i > materialIndexMax ? materialIndexMax : i);
                            }

                            octreesArray.push(tempOctree);
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
                        results.forEach(r => {
                            if (r.status === 'fulfilled') {
                                octrees.push(r.value);
                            }
                        });

                        if (!mainOctreeUsed) {
                            octrees.unshift(mainOctree);
                        }

                        if (octrees.length <= 0) {
                            reject('Unable to find any result octree');
                        } else if (octrees.length === 1) {
                            resolve(octrees[0]);
                        } else if (octrees.length > 3) {
                            arrayCallback(octrees, usingBatches ? 0 : -1).then(result => {
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
        },

        unionArray(objArr: OctreeCSG[], materialIndexMax = Infinity): Promise<OctreeCSG> {
            return OctreeCSG.async._arrayOperation(OctreeCSG.async.union, OctreeCSG.async.unionArray, objArr, materialIndexMax);
        },

        subtractArray(objArr: OctreeCSG[], materialIndexMax = Infinity): Promise<OctreeCSG> {
            return OctreeCSG.async._arrayOperation(OctreeCSG.async.subtract, OctreeCSG.async.subtractArray, objArr, materialIndexMax);
        },

        intersectArray(objArr: OctreeCSG[], materialIndexMax = Infinity): Promise<OctreeCSG> {
            return OctreeCSG.async._arrayOperation(OctreeCSG.async.intersect, OctreeCSG.async.intersectArray, objArr, materialIndexMax);
        },

        operation(obj: OctreeCSGObject, buildTargetOctree = true, options = { objCounter: 0 }): Promise<OctreeCSG> {
            return new Promise((resolve, reject) => {
                try {
                    let octreeA: OctreeCSG, octreeB: OctreeCSG;

                    const promises = []
                    if (obj.objA) {
                        promises.push(handleObjectForOp_async(obj.objA, buildTargetOctree, options, 0));
                    }

                    if (obj.objB) {
                        promises.push(handleObjectForOp_async(obj.objB, buildTargetOctree, options, 1));
                    }

                    Promise.allSettled(promises).then(results => {
                        results.forEach(r => {
                            if (r.status === 'fulfilled') {
                                const [csg, objIndex] = r.value;
                                if (objIndex === 0) {
                                    octreeA = csg;
                                } else if (objIndex === 1) {
                                    octreeB = csg;
                                }
                            }
                        });

                        let resultPromise;
                        switch (obj.op) {
                            case 'union':
                                resultPromise = OctreeCSG.async.union(octreeA, octreeB, buildTargetOctree);
                                break;
                            case 'subtract':
                                resultPromise = OctreeCSG.async.subtract(octreeA, octreeB, buildTargetOctree);
                                break;
                            case 'intersect':
                                resultPromise = OctreeCSG.async.intersect(octreeA, octreeB, buildTargetOctree);
                                break;
                            default:
                                throw new Error(`Unknown operation: ${obj.op}`);
                        }

                        resultPromise.then(resultOctree => {
                            resolve(resultOctree);
                            disposeOctree(octreeA, octreeB);
                        }).catch(e => reject(e));
                    });
                }
                catch (e) {
                    reject(e);
                }
            });
        }
    }
}

function raycastIntersectAscSort(a: RayIntersect, b: RayIntersect) {
    return a.distance - b.distance;
}

function pointRounding(point: Vector3, num = 15) {
    point.x = +point.x.toFixed(num);
    point.y = +point.y.toFixed(num);
    point.z = +point.z.toFixed(num);
    return point;
}

enum ReturnPolygonType {
    Undecided = PolygonState.Undecided,
    Back,
    Front,
    CoplanarBack = PolygonState.CoplanarBack,
    CoplanarFront = PolygonState.CoplanarFront,
}

interface ReturnPolygon {
    polygon: Polygon,
    type: ReturnPolygonType
}

function splitPolygonByPlane(polygon: Polygon, plane: Plane, result: ReturnPolygon[] = []) {
    const returnPolygon = <ReturnPolygon>{
        polygon: polygon,
        type: ReturnPolygonType.Undecided
    };

    let polygonType = 0;
    const types = [];

    for (const vertex of polygon.vertices) {
        const t = plane.normal.dot(vertex.pos) - plane.w;
        const type = (t < -EPSILON) ? BACK : (t > EPSILON) ? FRONT : COPLANAR;
        polygonType |= type;
        types.push(type);
    }

    switch (polygonType) {
        case COPLANAR:
            returnPolygon.type = plane.normal.dot(polygon.plane.normal) > 0 ? ReturnPolygonType.CoplanarFront : ReturnPolygonType.CoplanarBack;
            result.push(returnPolygon);
            break;
        case FRONT:
            returnPolygon.type = ReturnPolygonType.Front;
            result.push(returnPolygon);
            break;
        case BACK:
            returnPolygon.type = ReturnPolygonType.Back;
            result.push(returnPolygon);
            break;
        case SPANNING:
        {
            const f = [];
            const b = [];

            const vertCount = polygon.vertices.length;
            for (let i = 0; i < vertCount; i++) {
                const j = (i + 1) % vertCount;
                const ti = types[i];
                const tj = types[j];
                const vi = polygon.vertices[i];
                const vj = polygon.vertices[j];

                if (ti !== BACK) {
                    f.push(vi);
                }

                if (ti !== FRONT) {
                    b.push(ti != BACK ? vi.clone() : vi);
                }

                if ((ti | tj) === SPANNING) {
                    const t = (plane.w - plane.normal.dot(vi.pos)) / plane.normal.dot(tv0.copy(vj.pos).sub(vi.pos));
                    const v = vi.interpolate(vj, t);
                    f.push(v);
                    b.push(v.clone());
                }
            }

            if (f.length > 3) {
                for (const newPoly of splitPolygonArr(f)) {
                    result.push({
                        polygon: new Polygon(newPoly, polygon.shared),
                        type: ReturnPolygonType.Front
                    });
                }
            } else if (f.length === 3) {
                result.push({
                    polygon: new Polygon(f, polygon.shared),
                    type: ReturnPolygonType.Front
                });
            }

            if (b.length > 3) {
                for (const newPoly of splitPolygonArr(b)) {
                    result.push({
                        polygon: new Polygon(newPoly, polygon.shared),
                        type: ReturnPolygonType.Back
                    });
                }
            } else if (b.length === 3) {
                result.push({
                    polygon: new Polygon(b, polygon.shared),
                    type: ReturnPolygonType.Back
                });
            }

            break;
        }
    }

    if (result.length == 0) {
        result.push(returnPolygon);
    }

    return result;
}

function splitPolygonArr(arr: Vertex[]) {
    const resultArr = [];

    if (arr.length > 4) {
        console.warn(`[splitPolygonArr] arr.length (${arr.length}) > 4`);
        for (let j = 3; j <= arr.length; j++) {
            resultArr.push([
                arr[0].clone(), arr[j - 2].clone(), arr[j - 1].clone()
            ]);
        }
    } else if (arr[0].pos.distanceTo(arr[2].pos) <= arr[1].pos.distanceTo(arr[3].pos)) {
        resultArr.push(
            [arr[0].clone(), arr[1].clone(), arr[2].clone()],
            [arr[0].clone(), arr[2].clone(), arr[3].clone()]
        );
    } else {
        resultArr.push(
            [arr[0].clone(), arr[1].clone(), arr[3].clone()],
            [arr[1].clone(), arr[2].clone(), arr[3].clone()]
        );
    }

    return resultArr;
}

type CSGRule = {
    array: true,
    rule: PolygonState[]
} | {
    array: false,
    rule: PolygonState
};

type CSGRulesArray = CSGRule[];

const CSG_Rules = {
    union: {
        a: <CSGRulesArray>[
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarBack]
            },
            {
                array: false,
                rule: PolygonState.Inside
            }
        ],
        b: <CSGRulesArray>[
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarBack]
            },
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarFront]
            },
            {
                array: false,
                rule: PolygonState.Inside
            }
        ]
    },
    subtract: {
        a: <CSGRulesArray>[
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarBack]
            },
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarFront]
            },
            {
                array: false,
                rule: PolygonState.Inside
            }
        ],
        b: <CSGRulesArray>[
            {
                array: true,
                rule: [PolygonState.Outside, PolygonState.CoplanarBack]
            },
            {
                array: true,
                rule: [PolygonState.Outside, PolygonState.CoplanarFront]
            },
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarFront]
            },
            {
                array: false,
                rule: PolygonState.Outside
            }
        ]
    },
    intersect: {
        a: <CSGRulesArray>[
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarBack]
            },
            {
                array: true,
                rule: [PolygonState.Outside, PolygonState.CoplanarFront]
            },
            {
                array: true,
                rule: [PolygonState.Outside, PolygonState.CoplanarBack]
            },
            {
                array: false,
                rule: PolygonState.Outside
            }
        ],
        b: <CSGRulesArray>[
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarFront]
            },
            {
                array: true,
                rule: [PolygonState.Inside, PolygonState.CoplanarBack]
            },
            {
                array: true,
                rule: [PolygonState.Outside, PolygonState.CoplanarFront]
            },
            {
                array: true,
                rule: [PolygonState.Outside, PolygonState.CoplanarBack]
            },
            {
                array: false,
                rule: PolygonState.Outside
            }
        ]
    }
};

function handleObjectForOp(obj: OctreeCSG | OctreeCSGObject, buildTargetOctree: boolean, options: {objCounter: number}) {
    if (obj instanceof OctreeCSG)
        return obj;
    else if (obj.op)
        return OctreeCSG.operation(obj, buildTargetOctree, options);
    else
        throw new Error('Invalid OctreeCSG operation object');
}

function handleObjectForOp_async(obj: OctreeCSG | OctreeCSGObject, buildTargetOctree: boolean, options: { objCounter: number }, objIndex: number): Promise<[csg: OctreeCSG, objIndex: number]> {
    return new Promise((resolve, reject) => {
        try {
            if (obj instanceof OctreeCSG) {
                resolve([obj, objIndex]);
            }
            else if (obj.op) {
                OctreeCSG.async.operation(obj, buildTargetOctree, options).then(returnObj => {
                    resolve([returnObj, objIndex]);
                });
            }
            else
                throw new Error('Invalid OctreeCSG operation object');
        }
        catch (e) {
            reject(e);
        }
    });
}

function isUniqueTriangle(triangle: Triangle, set: Set<string>) {
    const hash1 = `{${triangle.a.x},${triangle.a.y},${triangle.a.z}}-{${triangle.b.x},${triangle.b.y},${triangle.b.z}}-{${triangle.c.x},${triangle.c.y},${triangle.c.z}}`;

    if (set.has(hash1)) {
        return false;
    } else {
        set.add(hash1);
        return true;
    }
}

function disposeOctree(...octrees: OctreeCSG[]) {
    if (OctreeCSG.disposeOctree) {
        octrees.forEach(octree => octree.delete());
    }
}

function handleIntersectingOctrees(octreeA: OctreeCSG, octreeB: OctreeCSG, bothOctrees = true) {
    let octreeA_buffer;
    let octreeB_buffer;

    if (OctreeCSG.useWindingNumber) {
        if (bothOctrees) {
            octreeA_buffer = prepareTriangleBuffer(octreeA.getPolygons());
        }

        octreeB_buffer = prepareTriangleBuffer(octreeB.getPolygons());
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

function prepareTriangleBuffer(polygons: Polygon[]) {
    const array = new Float32Array(polygons.length * 3 * 3);

    let bufferIndex = 0;
    for (const polygon of polygons) {
        const triangle = polygon.triangle;
        array[bufferIndex++] = triangle.a.x;
        array[bufferIndex++] = triangle.a.y;
        array[bufferIndex++] = triangle.a.z;
        array[bufferIndex++] = triangle.b.x;
        array[bufferIndex++] = triangle.b.y;
        array[bufferIndex++] = triangle.b.z;
        array[bufferIndex++] = triangle.c.x;
        array[bufferIndex++] = triangle.c.y;
        array[bufferIndex++] = triangle.c.z;
    }

    return array;
}

export default OctreeCSG;