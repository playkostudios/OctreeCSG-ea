import type Triangle from './Triangle';
import type Ray from './Ray';

import { vec3 } from 'gl-matrix';

const edge1 = vec3.create();
const edge2 = vec3.create();
const h = vec3.create();
const s = vec3.create();
const q = vec3.create();
const RAY_EPSILON = 1e-7;

export default function rayIntersectsTriangle(ray: Ray, triangle: Triangle, target = vec3.create()) {
    // XXX a big chunk of the computation time is spent here. it would be nice
    // to have a faster intersection algorithm. for example, we already have
    // pre-calculated triangle normals. maybe find a way to reuse them?

    // https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
    vec3.sub(edge1, triangle.b, triangle.a);
    vec3.sub(edge2, triangle.c, triangle.a);
    vec3.cross(h, ray.direction, edge2);

    const a = vec3.dot(edge1, h);
    if (a > -RAY_EPSILON && a < RAY_EPSILON) {
        return null; // Ray is parallel to the triangle
    }

    vec3.sub(s, ray.origin, triangle.a);

    const f = 1 / a;
    const u = f * vec3.dot(s, h);
    if (u < 0 || u > 1) {
        return null;
    }

    vec3.cross(q, s, edge1);

    const v = f * vec3.dot(ray.direction, q);
    if (v < 0 || u + v > 1) {
        return null;
    }

    // Check where intersection is
    const t = f * vec3.dot(edge2, q);
    if (t > RAY_EPSILON) {
        return vec3.scaleAndAdd(target, ray.origin, ray.direction, t);
    }

    return null;
}