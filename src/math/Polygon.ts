import { Matrix3, Matrix4, Vector3 } from 'threejs-math';
import { tmpm3 } from '../temp';
import Plane from './Plane';
import Triangle from './Triangle';
import Vertex from './Vertex';

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

    getMidpoint() {
        if (this.triangle.midPoint) {
            return this.triangle.midPoint;
        }

        this.triangle.midPoint = this.triangle.getMidpoint(new Vector3());
        return this.triangle.midPoint;
    }

    applyMatrix(matrix: Matrix4, normalMatrixIn?: Matrix3) {
        const normalMatrix = normalMatrixIn || tmpm3.getNormalMatrix(matrix);

        this.vertices.forEach(v => {
            v.pos.applyMatrix4(matrix);
            v.normal.applyMatrix3(normalMatrix);
        });

        this.plane.delete();
        this.plane = Plane.fromPoints(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
        this.triangle.set(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);

        if (this.triangle.midPoint) {
            this.triangle.getMidpoint(this.triangle.midPoint);
        }
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

        if (this.triangle.midPoint) {
            polygon.triangle.midPoint = this.triangle.midPoint.clone();
        }

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