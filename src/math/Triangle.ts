import { vec3 } from 'gl-matrix';

const THIRD = 1 / 3;

export default class Triangle {
    private _midpoint?: vec3;

    constructor(public a: Readonly<vec3>, public b: Readonly<vec3>, public c: Readonly<vec3>) {}

    static copyMidPoint(source: Triangle, destination: Triangle) {
        if (source._midpoint) {
            if (destination._midpoint) {
                vec3.copy(destination._midpoint, source._midpoint);
            } else {
                destination._midpoint = vec3.clone(source._midpoint);
            }
        }
    }

    set(a: Readonly<vec3>, b: Readonly<vec3>, c: Readonly<vec3>) {
        this.a = a;
        this.b = b;
        this.c = c;
        this._midpoint = undefined;
    }

    get midpoint(): Readonly<vec3> {
        // return cached version
        if (this._midpoint) {
            return this._midpoint;
        }

        // no cached version, calculate average point
        this._midpoint = vec3.clone(this.a);
        vec3.add(this._midpoint, this._midpoint, this.b);
        vec3.add(this._midpoint, this._midpoint, this.c);
        return vec3.scale(this._midpoint, this._midpoint, THIRD);
    }
}