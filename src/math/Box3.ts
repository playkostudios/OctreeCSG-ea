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

        let min = vec3.dot(points[0], normal);
        let max = min;

        for (let i = 1; i < count; i++) {
            const dotProd = vec3.dot(points[i], normal);

            if(dotProd < min) {
                min = dotProd;
            }

            if(dotProd > max) {
                max = dotProd;
            }
        }

        return [min, max];
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

    intersectsTriangle(triangle: Triangle): boolean {
        // AABB and triangle intersection algorithm from:
        // https://stackoverflow.com/a/17503268
        // using fix from:
        // https://stackoverflow.com/a/23456651

        // test box normals
        const triVerts = [triangle.a, triangle.b, triangle.c];

        if (
            this._testNormal(this.min[0], this.max[0], _bxNorm, triVerts) ||
            this._testNormal(this.min[1], this.max[1], _byNorm, triVerts) ||
            this._testNormal(this.min[2], this.max[2], _bzNorm, triVerts)
        ) {
            return false;
        }

        // test triangle normal
        const triNorm = Plane.calculateNormal(triangle.a, triangle.b, triangle.c);
        const triOffset = vec3.dot(triNorm, triangle.a);
        const boxVerts = [
            vec3.set(_lub, this.min[0], this.max[1], this.min[2]),
            vec3.set(_rub, this.max[0], this.max[1], this.min[2]),
            vec3.set(_luf, this.min[0], this.max[1], this.max[2]),
            vec3.set(_ruf, this.max[0], this.max[1], this.max[2]),
            vec3.set(_ldb, this.min[0], this.min[1], this.min[2]),
            vec3.set(_rdb, this.max[0], this.min[1], this.min[2]),
            vec3.set(_ldf, this.min[0], this.min[1], this.max[2]),
            vec3.set(_rdf, this.max[0], this.min[1], this.max[2])
        ];

        const [boxMin, boxMax] = this._project(boxVerts, triNorm);
        if (boxMax < triOffset || boxMin > triOffset) {
            return false;
        }

        // test nine edge cross-products
        vec3.sub(_ba, triangle.a, triangle.b);
        vec3.sub(_cb, triangle.b, triangle.c);
        vec3.sub(_ac, triangle.c, triangle.a);

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
        return tmin <= tmax;
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