import { Polygon, PolygonState } from './Polygon';
import { EPSILON } from './const-numbers';
import { tv0 } from './temp';

import type Vertex from './Vertex';
import type Plane from './Plane';

import { vec3 } from 'gl-matrix';
import { MaterialDefinitions } from '../base/MaterialDefinition';

export enum ReturnPolygonType {
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

const COPLANAR = 0;
const FRONT = 1;
const BACK = 2;
const SPANNING = 3;

export function splitPolygonByPlane(polygon: Polygon, plane: Plane, materials: MaterialDefinitions, result: ReturnPolygon[] = []) {
    const attributes = materials.get(polygon.shared);

    const returnPolygon = <ReturnPolygon>{
        polygon: polygon,
        type: ReturnPolygonType.Undecided
    };

    let polygonType = 0;
    const types = [];

    for (const vertex of polygon.vertices) {
        const t = vec3.dot(plane.unsafeNormal, vertex.pos) - plane.w;
        const type = (t < -EPSILON) ? BACK : (t > EPSILON) ? FRONT : COPLANAR;
        polygonType |= type;
        types.push(type);
    }

    switch (polygonType) {
        case COPLANAR:
            returnPolygon.type = vec3.dot(plane.unsafeNormal, polygon.plane.unsafeNormal) > 0 ? ReturnPolygonType.CoplanarFront : ReturnPolygonType.CoplanarBack;
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
                    vec3.sub(tv0, vj.pos, vi.pos);
                    const t = (plane.w - vec3.dot(plane.unsafeNormal, vi.pos)) / vec3.dot(plane.unsafeNormal, tv0);
                    const v = vi.interpolate(vj, t, attributes);
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
    } else if (vec3.squaredDistance(arr[0].pos, arr[2].pos) <= vec3.squaredDistance(arr[1].pos, arr[3].pos)) {
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