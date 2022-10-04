import { INV_EPSILON } from './const-numbers';

import { vec3 } from 'gl-matrix';

const THIRD = 1 / 3;

export default class Triangle {
    private _midpoint?: vec3;
    private _hash?: number;

    constructor(public a: Readonly<vec3>, public b: Readonly<vec3>, public c: Readonly<vec3>) {}

    static copyAuxValues(source: Triangle, destination: Triangle) {
        if (source._midpoint) {
            if (destination._midpoint) {
                vec3.copy(destination._midpoint, source._midpoint);
            } else {
                destination._midpoint = vec3.clone(source._midpoint);
            }
        }

        if (source._hash) {
            destination._hash = source._hash;
        }
    }

    set(a: Readonly<vec3>, b: Readonly<vec3>, c: Readonly<vec3>) {
        this.a = a;
        this.b = b;
        this.c = c;
        this._midpoint = undefined;
        this._hash = undefined;
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

    equals(other: Triangle) {
        return vec3.equals(this.a, other.a) && vec3.equals(this.b, other.b) && vec3.equals(this.c, other.c);
    }

    private murmur_32_scramble(k: number): number {
        k *= 0xcc9e2d51;
        k = (k << 15) | (k >> 17);
        k *= 0x1b873593;
        return k & 0xffffffff;
    }

    private murmur3_32(data: Float32Array, seed: number): number {
        let h = seed;

        /* Read in groups of 4. */
        const view = new Uint32Array(data.buffer);
        for (const key of view) {
            h ^= this.murmur_32_scramble(key);
            h = ((h << 13) & 0xffffffff) | (h >> 19);
            h = (h * 5 + 0xe6546b64) & 0xffffffff;
        }

        /* Finalize. */
        h ^= view.byteLength;
        h ^= h >> 16;
        h = (h * 0x85ebca6b) & 0xffffffff;
        h ^= h >> 13;
        h = (h * 0xc2b2ae35) & 0xffffffff;
        h ^= h >> 16;
        return h;
    }

    get hash(): number {
        // return cached version
        if (this._hash !== undefined) {
            // console.warn('HASH WAS ALREADY CACHED')
            return this._hash;
        }

        // no cached version, calculate hash
        const data = new Float32Array([
            this.a[0] * INV_EPSILON,
            this.a[1] * INV_EPSILON,
            this.a[2] * INV_EPSILON,
            this.b[0] * INV_EPSILON,
            this.b[1] * INV_EPSILON,
            this.b[2] * INV_EPSILON,
            this.c[0] * INV_EPSILON,
            this.c[1] * INV_EPSILON,
            this.c[2] * INV_EPSILON
        ]);

        this._hash = this.murmur3_32(data, 0xea8ed414);
        return this._hash;
    }
}