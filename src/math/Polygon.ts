import { tmpm3 } from '../temp';
import Plane from './Plane';
import Triangle from './Triangle';
import Vertex from './Vertex';

import { mat3, mat4, vec3 } from 'gl-matrix';

let _polygonID = 0;

export enum PolygonState {
    Undecided,
    Inside,
    Outside,
    CoplanarBack,
    CoplanarFront,
}

export class Polygon {
    id: number;
    vertices: Vertex[];
    shared?: number;
    plane: Plane;
    triangle: Triangle;
    intersects = false;
    state = PolygonState.Undecided;
    previousState = PolygonState.Undecided;
    previousStates: PolygonState[] = [];
    valid = true;
    coplanar = false;
    originalValid = false;
    newPolygon = false;

    constructor(vertices: Vertex[], shared?: number) {
        this.id = _polygonID++;
        this.vertices = vertices.map(v => v.clone());
        this.shared = shared;
        this.plane = Plane.fromPoints(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
        this.triangle = new Triangle(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
    }

    get midpoint() {
        return this.triangle.midpoint;
    }

    applyMatrix(matrix: mat4, normalMatrixIn?: mat3) {
        const normalMatrix = normalMatrixIn || mat3.normalFromMat4(tmpm3, matrix);

        this.vertices.forEach(v => {
            vec3.transformMat4(v.pos, v.pos, matrix);
            vec3.transformMat3(v.normal, v.normal, normalMatrix);
        });

        this.plane.delete();
        this.plane = Plane.fromPoints(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
        this.triangle.set(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
    }

    reset(resetOriginal = true) {
        this.intersects = false;
        this.state = PolygonState.Undecided;
        this.previousState = PolygonState.Undecided;
        this.previousStates.length = 0;
        this.valid = true;
        this.coplanar = false;
        resetOriginal && (this.originalValid = false);
        this.newPolygon = false;
    }

    setState(state: PolygonState, keepState?: PolygonState) {
        if (this.state === keepState) {
            return;
        }

        this.previousState = this.state;
        this.state !== PolygonState.Undecided && this.previousStates.push(this.state);
        this.state = state;
    }

    checkAllStates(state: PolygonState) {
        if (this.state !== state || (this.previousState !== state && this.previousState !== PolygonState.Undecided)) {
            return false;
        }

        for (const previousState of this.previousStates) {
            if (previousState !== state) {
                return false;
            }
        }

        return true;
    }

    setInvalid() {
        this.valid = false;
    }

    setValid() {
        this.valid = true;
    }

    clone() {
        const polygon = new Polygon(this.vertices.map(v => v.clone()), this.shared);
        polygon.intersects = this.intersects;
        polygon.valid = this.valid;
        polygon.coplanar = this.coplanar;
        polygon.state = this.state;
        polygon.originalValid = this.originalValid;
        polygon.newPolygon = this.newPolygon;
        polygon.previousState = this.previousState;
        polygon.previousStates = this.previousStates.slice();

        Triangle.copyAuxValues(this.triangle, polygon.triangle);

        return polygon;
    }

    flip() {
        this.vertices.reverse().forEach(v => v.flip());
        const tmp = this.triangle.a;
        this.triangle.a = this.triangle.c;
        this.triangle.c = tmp;
        this.plane.flip();
    }

    delete() {
        this.vertices.forEach(v => v.delete());
        this.vertices.length = 0;

        if (this.plane) {
            this.plane.delete();
            (this.plane as unknown) = undefined;
        }

        (this.triangle as unknown) = undefined;
        this.shared = undefined;
        this.setInvalid();
    }
}