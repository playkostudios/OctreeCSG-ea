import Plane from './Plane.js';
import Ray from './Ray.js';
import Triangle from './Triangle.js';

import { vec3 } from 'gl-matrix';

const _tv1 = vec3.create();
const _tv2 = vec3.create();
const _tv3 = vec3.create();

// 3 main axis of an AABB
const _bxNorm: Readonly<vec3> = vec3.fromValues(1, 0, 0);
const _byNorm: Readonly<vec3> = vec3.fromValues(0, 1, 0);
const _bzNorm: Readonly<vec3> = vec3.fromValues(0, 0, 1);

// temp variables for box vertices. Up, Down, Left, Right, Back (-z), Front (+z)
const _lub = vec3.create();
const _rub = vec3.create();
const _luf = vec3.create();
const _ruf = vec3.create();
const _ldb = vec3.create();
const _rdb = vec3.create();
const _ldf = vec3.create();
const _rdf = vec3.create();

// temp variables for triangle edges
const _ba = vec3.create();
const _cb = vec3.create();
const _ac = vec3.create();

// temp variables for box min/max and triangle vertices
const _a = vec3.create();
const _b = vec3.create();
const _c = vec3.create();
const _min = vec3.create();
const _max = vec3.create();

const HALF = 1 / 2;

export default class Box3 {
    constructor(public min = vec3.create(), public max = vec3.create()) {}

    clone(): Box3 {
        return new Box3(vec3.clone(this.min), vec3.clone(this.max));
    }

    expandByPoint(point: Readonly<vec3>) {
        vec3.min(this.min, this.min, point);
        vec3.max(this.max, this.max, point);
    }

    expandByScalar(scalar: number) {
        vec3.set(_tv1, scalar, scalar, scalar);
        vec3.sub(this.min, this.min, _tv1);
        vec3.add(this.max, this.max, _tv1);
    }

    private _project(points: Readonly<Readonly<vec3>[]>, normal: Readonly<vec3>): [min: number, max: number] {
        const count = points.length;
        const dotProds = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            dotProds[i] = vec3.dot(points[i], normal);
        }

        // XXX force-cast Float32Array to number[] because, despite being
        // compatible on all browsers and according to the spec, typescript
        // expects the type to be number[] instead of ArrayLike<number>. source:
        // https://stackoverflow.com/a/73882069
        return [
            Math.min.apply(null, dotProds as unknown as number[]),
            Math.max.apply(null, dotProds as unknown as number[])
        ];
    }

    private _testNormal(boxAxisMin: number, boxAxisMax: number, normal: Readonly<vec3>, vertices: Readonly<Readonly<vec3>[]>): boolean {
        const [min, max] = this._project(vertices, normal);
        return max < boxAxisMin || min > boxAxisMax;
    }

    private _testECP(triEdge: Readonly<vec3>, boxNormal: Readonly<vec3>, triVerts: Readonly<Readonly<vec3>[]>, boxVerts: Readonly<Readonly<vec3>[]>): boolean {
        const axis = vec3.cross(_tv1, triEdge, boxNormal);
        const [boxMin, boxMax] = this._project(boxVerts, axis);
        const [triMin, triMax] = this._project(triVerts, axis);
        return boxMax < triMin || boxMin > triMax;
    }

    private _intersectsTriangle(boxMin: vec3, boxMax: vec3, triA: vec3, triB: vec3, triC: vec3): boolean {
        // AABB and triangle intersection algorithm from:
        // https://stackoverflow.com/a/17503268
        // using fix from:
        // https://stackoverflow.com/a/23456651

        // test box normals
        const triVerts = [triA, triB, triC];

        if (
            this._testNormal(boxMin[0], boxMax[0], _bxNorm, triVerts) ||
            this._testNormal(boxMin[1], boxMax[1], _byNorm, triVerts) ||
            this._testNormal(boxMin[2], boxMax[2], _bzNorm, triVerts)
        ) {
            return false;
        }

        // test triangle normal
        const triNorm = Plane.calculateNormal(triA, triB, triC);
        const triOffset = vec3.dot(triNorm, triA);
        const boxVerts = [
            vec3.set(_lub, boxMin[0], boxMax[1], boxMin[2]),
            vec3.set(_rub, boxMax[0], boxMax[1], boxMin[2]),
            vec3.set(_luf, boxMin[0], boxMax[1], boxMax[2]),
            vec3.set(_ruf, boxMax[0], boxMax[1], boxMax[2]),
            vec3.set(_ldb, boxMin[0], boxMin[1], boxMin[2]),
            vec3.set(_rdb, boxMax[0], boxMin[1], boxMin[2]),
            vec3.set(_ldf, boxMin[0], boxMin[1], boxMax[2]),
            vec3.set(_rdf, boxMax[0], boxMin[1], boxMax[2])
        ];

        const [boxMin2, boxMax2] = this._project(boxVerts, triNorm);
        if (boxMax2 < triOffset || boxMin2 > triOffset) {
            return false;
        }

        // test nine edge cross-products
        vec3.sub(_ba, triA, triB);
        vec3.sub(_cb, triB, triC);
        vec3.sub(_ac, triC, triA);

        return !(
            this._testECP(_ba, _bxNorm, triVerts, boxVerts) ||
            this._testECP(_ba, _byNorm, triVerts, boxVerts) ||
            this._testECP(_ba, _bzNorm, triVerts, boxVerts) ||
            this._testECP(_cb, _bxNorm, triVerts, boxVerts) ||
            this._testECP(_cb, _byNorm, triVerts, boxVerts) ||
            this._testECP(_cb, _bzNorm, triVerts, boxVerts) ||
            this._testECP(_ac, _bxNorm, triVerts, boxVerts) ||
            this._testECP(_ac, _byNorm, triVerts, boxVerts) ||
            this._testECP(_ac, _bzNorm, triVerts, boxVerts)
        );
    }

    intersectsTriangle(triangle: Triangle, debug = false): boolean {
        // TODO remove if this is not necessary
        // get box center
        vec3.add(_tv1, this.min, this.max);
        vec3.scale(_tv1, _tv1, HALF);

        // center everything around box center
        vec3.sub(_min, this.min, _tv1);
        vec3.sub(_max, this.max, _tv1);
        vec3.sub(_a, triangle.a, _tv1);
        vec3.sub(_b, triangle.b, _tv1);
        vec3.sub(_c, triangle.c, _tv1);

        // check for intersection
        const int = this._intersectsTriangle(_min, _max, _a, _b, _c);

        if (debug) {
            console.debug(`box{min{${this.min[0].toFixed(2)}, ${this.min[1].toFixed(2)}, ${this.min[2].toFixed(2)}}, max{${this.max[0].toFixed(2)}, ${this.max[1].toFixed(2)}, ${this.max[2].toFixed(2)}}} intersects triangle{a{${triangle.a[0].toFixed(2)}, ${triangle.a[1].toFixed(2)}, ${triangle.a[2].toFixed(2)}}, b{${triangle.b[0].toFixed(2)}, ${triangle.b[1].toFixed(2)}, ${triangle.b[2].toFixed(2)}}, c{${triangle.c[0].toFixed(2)}, ${triangle.c[1].toFixed(2)}, ${triangle.c[2].toFixed(2)}}}? ${int}`);
        }

        return int;
    }

    intersectsBox(box: Box3): boolean {
        return !(
            this.min[0] > box.max[0] || this.max[0] < box.min[0] ||
            this.min[1] > box.max[1] || this.max[1] < box.min[1] ||
            this.min[2] > box.max[2] || this.max[2] < box.min[2]
        );
    }

    intersectsRay(ray: Ray): boolean {
        // AABB and line intersection algorithm from:
        // https://tavianator.com/2022/ray_box_boundary.html
        // adapted to handle directional rays instead of bi-directional lines

        // dir_inv
        vec3.inverse(_tv3, ray.direction);

        // t1
        vec3.sub(_tv1, this.min, ray.origin);
        vec3.mul(_tv1, _tv1, _tv3);

        // t2
        vec3.sub(_tv2, this.max, ray.origin);
        vec3.mul(_tv2, _tv2, _tv3);

        const tmax = Math.max(_tv1[0], _tv2[0], _tv1[1], _tv2[1], _tv1[2], _tv2[2]);
        if (tmax < 0) {
            return false;
        }

        const tmin = Math.min(_tv1[0], _tv2[0], _tv1[1], _tv2[1], _tv1[2], _tv2[2]);

        // TODO remove
        if (isNaN(tmin) || isNaN(tmax)) {
            console.warn('NaN in intersectsRay detected');
        }

        return tmin <= tmax;
    }

    intersectsRayNaive(ray: Ray): boolean {
        // TODO remove
        // NAIVE IMPLEMENTATION
        let tmin = -Infinity, tmax = Infinity;

        for (let i = 0; i < 3; i++) {
            if (ray.direction[i] !== 0) {
                const t1 = (this.min[i] - ray.origin[i]) / ray.direction[i];
                const t2 = (this.max[i] - ray.origin[i]) / ray.direction[i];

                tmin = Math.max(tmin, Math.min(t1, t2));
                tmax = Math.min(tmax, Math.max(t1, t2));
            } else if (ray.origin[i] <= this.min[i] || ray.origin[i] >= this.max[i]) {
                return false;
            }
        }

        if (isNaN(tmin) || isNaN(tmax)) {
            console.warn('NaN in intersectsRay detected');
        }

        return tmax > tmin && tmax > 0;
    }

    containsPoint(point: Readonly<vec3>): boolean {
        return point[0] >= this.min[0] && point[0] <= this.max[0]
            && point[1] >= this.min[1] && point[1] <= this.max[1]
            && point[2] >= this.min[2] && point[2] <= this.max[2];
    }

    makeEmpty() {
        vec3.set(this.min, 0, 0, 0);
        vec3.set(this.max, 0, 0, 0);
    }
}