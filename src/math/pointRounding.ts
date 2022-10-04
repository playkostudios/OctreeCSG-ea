import type { vec3 } from 'gl-matrix';

export default function pointRounding(point: vec3, num = 15) {
    point[0] = +point[0].toFixed(num);
    point[1] = +point[1].toFixed(num);
    point[2] = +point[2].toFixed(num);
    return point;
}