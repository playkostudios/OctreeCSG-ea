import { Vector3 } from "threejs-math";

export default class Vertex {
    pos: Vector3;
    normal: Vector3;

    constructor(pos: Vector3, normal: Vector3) {
        this.pos = new Vector3().copy(pos);
        this.normal = new Vector3().copy(normal);
    }

    clone() {
        return new Vertex(this.pos.clone(), this.normal.clone());
    }

    // Invert all orientation-specific data (e.g. vertex normal). Called when the
    // orientation of a polygon is flipped.
    flip() {
        this.normal.negate();
    }

    delete() {
        (this.pos as unknown) = undefined;
        (this.normal as unknown) = undefined;
    }

    // Create a new vertex between this vertex and `other` by linearly
    // interpolating all properties using a parameter of `t`. Subclasses should
    // override this to interpolate additional properties.
    interpolate(other: Vertex, t: number) {
        return new Vertex(this.pos.clone().lerp(other.pos, t), this.normal.clone().lerp(other.normal, t));
    }
}