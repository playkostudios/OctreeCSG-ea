import { Vector3 } from 'threejs-math';
import { tv0, tv1 } from '../temp';

export default class Plane {
    constructor(public normal: Vector3, public w: number) {}

    clone() {
        return new Plane(this.normal.clone(), this.w);
    }

    flip() {
        this.normal.negate();
        this.w = -this.w;
    }

    delete() {
        (this.normal as unknown) = undefined;
        this.w = 0;
    }

    equals(p: Plane) {
        return this.normal.equals(p.normal) && this.w === p.w;
    }

    static fromPoints(a: Vector3, b: Vector3, c: Vector3) {
        const n = tv0.copy(b).sub(a).cross(tv1.copy(c).sub(a)).normalize().clone();
        return new Plane(n, n.dot(a));
    }
}