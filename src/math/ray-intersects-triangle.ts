import type Triangle from './Triangle';
import type Ray from './Ray';

import { vec3, vec4 } from 'gl-matrix';

// const edge1 = vec3.create();
// const edge2 = vec3.create();
// const h = vec3.create();
// const s = vec3.create();
// const q = vec3.create();
// const RAY_EPSILON = 1e-7;

// export default function rayIntersectsTriangle(ray: Ray, triangle: Triangle, target = vec3.create()) {
//     // https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
//     vec3.sub(edge1, triangle.b, triangle.a);
//     vec3.sub(edge2, triangle.c, triangle.a);
//     vec3.cross(h, ray.direction, edge2);

//     const a = vec3.dot(edge1, h);
//     if (a > -RAY_EPSILON && a < RAY_EPSILON) {
//         return null; // Ray is parallel to the triangle
//     }

//     vec3.sub(s, ray.origin, triangle.a);

//     const f = 1 / a;
//     const u = f * vec3.dot(s, h);
//     if (u < 0 || u > 1) {
//         return null;
//     }

//     vec3.cross(q, s, edge1);

//     const v = f * vec3.dot(ray.direction, q);
//     if (v < 0 || u + v > 1) {
//         return null;
//     }

//     // Check where intersection is
//     const t = f * vec3.dot(edge2, q);
//     if (t > RAY_EPSILON) {
//         return vec3.scaleAndAdd(target, ray.origin, ray.direction, t);
//     }

//     return null;
// }

const edge1 = vec3.create();
const edge2 = vec3.create();
// const n = vec3.create();
const tmat1 = vec4.create();
const tmat2 = vec4.create();
const tmat3 = vec4.create();
const pos = vec4.create();

export default function rayIntersectsTriangle(ray: Ray, triangle: Triangle, n: vec3, target = vec3.create()) {
    // XXX this is just an experiment. so far, performance seems worse
    // this paper: https://jcgt.org/published/0005/03/03/
    // adapted from this implementation: https://www.shadertoy.com/view/wttyR4
    vec3.sub(edge1, triangle.b, triangle.a);
    vec3.sub(edge2, triangle.c, triangle.a);

    // vec3.cross(n, edge1, edge2);

    const anX = Math.abs(n[0]);
    const anY = Math.abs(n[1]);
    const anZ = Math.abs(n[2]);

    const num = -vec3.dot(triangle.a, n);

    if (anX > anY && anX > anZ) {
        vec4.set(
            tmat1,
            0,
            edge2[2],
            -edge2[1],
            (triangle.c[1] * triangle.a[2] - triangle.c[2] * triangle.a[1]),
        );

        vec4.set(
            tmat2,
            0,
            -edge1[2],
            edge1[1],
            (-triangle.b[1] * triangle.a[2] + triangle.b[2] * triangle.a[1]),
        );

        vec4.set(tmat3, n[0], n[1], n[2], num);

        const nx_inv = 1 / n[0];
        vec4.scale(tmat1, tmat1, nx_inv);
        vec4.scale(tmat2, tmat2, nx_inv);
        vec4.scale(tmat3, tmat3, nx_inv);
    } else if (anY > anZ) {
        vec4.set(
            tmat1,
            -edge2[2],
            0,
            edge2[0],
            (triangle.c[2] * triangle.a[0] - triangle.c[0] * triangle.a[2]),
        );

        vec4.set(
            tmat2,
            edge1[2],
            0,
            -edge1[0],
            (-triangle.b[2] * triangle.a[0] + triangle.b[0] * triangle.a[2]),
        );

        vec4.set(tmat3, n[0], n[1], n[2], num);

        const ny_inv = 1 / n[1];
        vec4.scale(tmat1, tmat1, ny_inv);
        vec4.scale(tmat2, tmat2, ny_inv);
        vec4.scale(tmat3, tmat3, ny_inv);
    } else if (anZ > 0) {
        vec4.set(
            tmat1,
            edge2[1],
            -edge2[0],
            0,
            (triangle.c[0] * triangle.a[1] - triangle.c[1] * triangle.a[0]),
        );

        vec4.set(
            tmat2,
            -edge1[1],
            edge1[0],
            0,
            (-triangle.b[0] * triangle.a[1] + triangle.b[1] * triangle.a[0]),
        );

        vec4.set(tmat3, n[0], n[1], n[2], num);

        const nz_inv = 1 / n[2];
        vec4.scale(tmat1, tmat1, nz_inv);
        vec4.scale(tmat2, tmat2, nz_inv);
        vec4.scale(tmat3, tmat3, nz_inv);
    }

    const s = vec3.dot(ray.origin, tmat3 as vec3) + tmat3[3];
    const d = vec3.dot(ray.direction, tmat3 as vec3);

    const t = -s / d;

    vec3.scaleAndAdd(pos as vec3, ray.origin, ray.direction, t);
    pos[3] = 1;

    const u = vec4.dot(pos, tmat1);
    const v = vec4.dot(pos, tmat2);

    if (u < 0 || v < 0 || (u + v) > 1) {
        return null;
    }

    return vec3.copy(target, pos as vec3);
}