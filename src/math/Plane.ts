import { vec3, vec4 } from 'gl-matrix';
import { tv0, tv1 } from '../temp';

export default class Plane {
    constructor(public buffer: vec4) {}

    static fromNormal(normal: vec3, w: number) {
        const buffer = vec4.create();
        vec3.copy(buffer as vec3, normal);
        buffer[3] = w;
        return new Plane(buffer);
    }

    get w(): number {
        return this.buffer[3];
    }

    set w(w: number) {
        this.buffer[3] = w;
    }

    get unsafeNormal() {
        // XXX it's unsafe to reuse normals for other purposes. only use this
        // getter to copy the normal
        return this.buffer as vec3;
    }

    clone() {
        return new Plane(vec4.clone(this.buffer));
    }

    flip() {
        vec3.negate(this.buffer as vec3, this.buffer as vec3);
        this.w = -this.w;
    }

    delete() {
        (this.buffer as unknown) = undefined;
    }

    equals(p: Plane) {
        return vec4.equals(this.buffer, p.buffer);
    }

    static calculateNormal(a: Readonly<vec3>, b: Readonly<vec3>, c: Readonly<vec3>): vec3 {
        vec3.copy(tv1, c);
        vec3.sub(tv1, tv1, a);

        vec3.copy(tv0, b);
        vec3.sub(tv0, tv0, a);
        vec3.cross(tv0, tv0, tv1);
        vec3.normalize(tv0, tv0);

        return vec3.clone(tv0);
    }

    static fromPoints(a: vec3, b: vec3, c: vec3) {
        const n = Plane.calculateNormal(a, b, c);
        return Plane.fromNormal(n, vec3.dot(n, a));
    }
}