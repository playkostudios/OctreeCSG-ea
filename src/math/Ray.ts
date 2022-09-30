import { vec3 } from 'gl-matrix';

export default class Ray {
    origin = vec3.create();
    direction = vec3.fromValues(0, 0, -1);
}