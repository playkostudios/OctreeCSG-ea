import { vec3 } from 'gl-matrix';

export default class Vertex {
    constructor(public pos: vec3, public normal: vec3) {}

    clone() {
        return new Vertex(vec3.clone(this.pos), vec3.clone(this.normal));
    }

    // Invert all orientation-specific data (e.g. vertex normal). Called when the
    // orientation of a polygon is flipped.
    flip() {
        vec3.negate(this.normal, this.normal);
    }

    delete() {
        (this.pos as unknown) = undefined;
        (this.normal as unknown) = undefined;
    }

    // Create a new vertex between this vertex and `other` by linearly
    // interpolating all properties using a parameter of `t`. Subclasses should
    // override this to interpolate additional properties.
    interpolate(other: Vertex, t: number) {
        return new Vertex(
            vec3.lerp(vec3.create(), this.pos, other.pos, t),
            vec3.lerp(vec3.create(), this.normal, other.normal, t)
        );
    }
}