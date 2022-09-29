import { vec3 } from 'gl-matrix';

const THIRD = 1 / 3;

export default class Triangle {
    private _midPoint?: vec3;

    constructor(public a: Readonly<vec3>, public b: Readonly<vec3>, public c: Readonly<vec3>) {}

    static copyMidPoint(source: Triangle, destination: Triangle) {
        if (source._midPoint) {
            destination._midPoint = vec3.clone(source._midPoint);
        }
    }

    set(a: vec3, b: vec3, c: vec3) {
        this.a = a;
        this.b = b;
        this.c = c;
        this._midPoint = undefined;
    }

    get midPoint(): vec3 {
        // return cached version
        if (this._midPoint) {
            return this._midPoint;
        }

        // no cached version, calculate average point
        this._midPoint = vec3.clone(this.a);
        vec3.add(this._midPoint, this._midPoint, this.b);
        vec3.add(this._midPoint, this._midPoint, this.c);
        return vec3.scale(this._midPoint, this._midPoint, THIRD);
    }
}