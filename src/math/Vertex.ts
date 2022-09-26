import { Vector2, Vector3 } from "threejs-math";

export default class Vertex {
    pos: Vector3;
    normal: Vector3;
    uv?: Vector2;
    color?: Vector3;

    constructor(pos: Vector3, normal: Vector3, uv?: Vector2, color?: Vector3) {
        this.pos = new Vector3().copy(pos);
        this.normal = new Vector3().copy(normal);
        uv && (this.uv = new Vector2().copy(uv));
        color && (this.color = new Vector3().copy(color));
    }

    clone() {
        return new Vertex(this.pos.clone(), this.normal.clone(), this.uv && this.uv.clone(), this.color && this.color.clone());
    }

    // Invert all orientation-specific data (e.g. vertex normal). Called when the
    // orientation of a polygon is flipped.
    flip() {
        this.normal.negate();
    }

    delete() {
        (this.pos as unknown) = undefined;
        (this.normal as unknown) = undefined;
        this.uv && (this.uv = undefined);
        this.color && (this.color = undefined);
    }

    // Create a new vertex between this vertex and `other` by linearly
    // interpolating all properties using a parameter of `t`. Subclasses should
    // override this to interpolate additional properties.
    interpolate(other: Vertex, t: number) {
        return new Vertex(this.pos.clone().lerp(other.pos, t), this.normal.clone().lerp(other.normal, t), this.uv && other.uv && this.uv.clone().lerp(other.uv, t), this.color && other.color && this.color.clone().lerp(other.color, t));
    }
}