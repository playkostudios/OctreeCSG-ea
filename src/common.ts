import { mat3, vec3 } from "gl-matrix";

// Winding Number algorithm adapted from https://github.com/grame-cncm/faust/blob/master-dev/tools/physicalModeling/mesh2faust/vega/libraries/windingNumber/windingNumber.cpp
const EPSILON = 1e-5;
const _wV1 = vec3.create();
const _wV2 = vec3.create();
const _wV3 = vec3.create();
const _wP = vec3.create();
export const _wP_EPS_ARR = [
    vec3.fromValues(EPSILON, 0, 0),
    vec3.fromValues(0, EPSILON, 0),
    vec3.fromValues(0, 0, EPSILON),
    vec3.fromValues(-EPSILON, 0, 0),
    vec3.fromValues(0, -EPSILON, 0),
    vec3.fromValues(0, 0, -EPSILON)
];

const _matrix3 = mat3.create();
const wNPI = 4 * Math.PI;

function returnXYZ(arr: Float32Array, index: number): vec3 {
    return arr.slice(index, index + 3);
}

function calcWindingNumber_buffer(trianglesArr: Float32Array, point: vec3) {
    let wN = 0;

    const trianglesArrLen = trianglesArr.length;
    for (let i = 0; i < trianglesArrLen; i += 9) {
        vec3.sub(_wV1, returnXYZ(trianglesArr, i), point);
        vec3.sub(_wV2, returnXYZ(trianglesArr, i + 3), point);
        vec3.sub(_wV3, returnXYZ(trianglesArr, i + 6), point);

        const lenA = vec3.length(_wV1);
        const lenB = vec3.length(_wV2);
        const lenC = vec3.length(_wV3);

        mat3.set(
            _matrix3,
            _wV1[0], _wV2[0], _wV3[0],
            _wV1[1], _wV2[1], _wV3[1],
            _wV1[2], _wV2[2], _wV3[2]
        );

        wN += 2 * Math.atan2(
            mat3.determinant(_matrix3),
            lenA * lenB * lenC
                + vec3.dot(_wV1, _wV2) * lenC
                + vec3.dot(_wV2, _wV3) * lenA
                + vec3.dot(_wV1, _wV3) * lenB
        );
    }

    return Math.round(wN / wNPI);
}

export function polyInside_WindingNumber_buffer(trianglesArr: Float32Array, point: vec3, coplanar: boolean) {
    vec3.copy(_wP, point);

    if (calcWindingNumber_buffer(trianglesArr, _wP) !== 0) {
        return true;
    } else if (coplanar) {
        for (const _wP_EPS of _wP_EPS_ARR) {
            vec3.add(_wP, point, _wP_EPS);
            if (calcWindingNumber_buffer(trianglesArr, _wP) !== 0) {
                return true;
            }
        }
    }

    return false;
}