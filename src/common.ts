import { Matrix3, Vector3 } from "threejs-math";

// Winding Number algorithm adapted from https://github.com/grame-cncm/faust/blob/master-dev/tools/physicalModeling/mesh2faust/vega/libraries/windingNumber/windingNumber.cpp
const EPSILON = 1e-5;
const _wV1 = new Vector3();
const _wV2 = new Vector3();
const _wV3 = new Vector3();
const _wP = new Vector3();
export const _wP_EPS_ARR = [
    new Vector3(EPSILON, 0, 0),
    new Vector3(0, EPSILON, 0),
    new Vector3(0, 0, EPSILON),
    new Vector3(-EPSILON, 0, 0),
    new Vector3(0, -EPSILON, 0),
    new Vector3(0, 0, -EPSILON)
];

export const _wP_EPS_ARR_COUNT = _wP_EPS_ARR.length;
const _matrix3 = new Matrix3();
const wNPI = 4 * Math.PI;

function returnXYZ(arr: Float32Array, index: number) {
    return new Vector3(arr[index], arr[index + 1], arr[index + 2]);
}

function calcWindingNumber_buffer(trianglesArr: Float32Array, point: Vector3) {
    let wN = 0;
    for (let i = 0; i < trianglesArr.length; i += 9) {
        _wV1.subVectors(returnXYZ(trianglesArr, i), point);
        _wV2.subVectors(returnXYZ(trianglesArr, i + 3), point);
        _wV3.subVectors(returnXYZ(trianglesArr, i + 6), point);
        let lenA = _wV1.length();
        let lenB = _wV2.length();
        let lenC = _wV3.length();
        _matrix3.set(_wV1.x, _wV1.y, _wV1.z, _wV2.x, _wV2.y, _wV2.z, _wV3.x, _wV3.y, _wV3.z);
        let omega = 2 * Math.atan2(_matrix3.determinant(), (lenA * lenB * lenC + _wV1.dot(_wV2) * lenC + _wV2.dot(_wV3) * lenA + _wV3.dot(_wV1) * lenB));
        wN += omega;
    }
    wN = Math.round(wN / wNPI);
    return wN;
}

export function polyInside_WindingNumber_buffer(trianglesArr: Float32Array, point: Vector3, coplanar: boolean) {
    let result = false;
    _wP.copy(point);
    let wN = calcWindingNumber_buffer(trianglesArr, _wP);
    if (wN === 0) {
        if (coplanar) {
            for (let j = 0; j < _wP_EPS_ARR_COUNT; j++) {
                _wP.copy(point).add(_wP_EPS_ARR[j]);
                wN = calcWindingNumber_buffer(trianglesArr, _wP);
                if (wN !== 0) {
                    result = true;
                    break;
                }
            }
        }
    }
    else {
        result = true;
    }

    return result;

}