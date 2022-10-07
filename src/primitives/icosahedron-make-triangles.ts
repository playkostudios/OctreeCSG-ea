import { vec3 } from 'gl-matrix';

import Vertex from '../math/Vertex';

const ICO_V: Array<Readonly<vec3>> = [
    vec3.fromValues( 0       ,  1       ,  0      ),
    vec3.fromValues( 0.276385,  0.447215, -0.85064),
    vec3.fromValues(-0.7236  ,  0.447215, -0.52572),
    vec3.fromValues(-0.7236  ,  0.447215,  0.52572),
    vec3.fromValues( 0.276385,  0.447215,  0.85064),
    vec3.fromValues( 0.894425,  0.447215,  0      ),
    vec3.fromValues(-0.276385, -0.447215, -0.85064),
    vec3.fromValues(-0.894425, -0.447215,  0      ),
    vec3.fromValues(-0.276385, -0.447215,  0.85064),
    vec3.fromValues( 0.7236  , -0.447215,  0.52572),
    vec3.fromValues( 0.7236  , -0.447215, -0.52572),
    vec3.fromValues( 0       , -1       ,  0      ),
];

export default function makeIcosahedronTriangles(addTriangle: (vertices: Array<Vertex>, index: number, radius: number, a: Readonly<vec3>, b: Readonly<vec3>, c: Readonly<vec3>) => number, vertices: Array<Vertex>, radius: number) {
    // top triangles
    let index = addTriangle(vertices, 0, radius, ICO_V[0], ICO_V[1], ICO_V[2]);
    index = addTriangle(vertices, index, radius, ICO_V[0], ICO_V[2], ICO_V[3]);
    index = addTriangle(vertices, index, radius, ICO_V[0], ICO_V[3], ICO_V[4]);
    index = addTriangle(vertices, index, radius, ICO_V[0], ICO_V[4], ICO_V[5]);
    index = addTriangle(vertices, index, radius, ICO_V[0], ICO_V[5], ICO_V[1]);

    // side triangles
    index = addTriangle(vertices, index, radius, ICO_V[1], ICO_V[6], ICO_V[2]);
    index = addTriangle(vertices, index, radius, ICO_V[2], ICO_V[6], ICO_V[7]);
    index = addTriangle(vertices, index, radius, ICO_V[2], ICO_V[7], ICO_V[3]);
    index = addTriangle(vertices, index, radius, ICO_V[3], ICO_V[7], ICO_V[8]);
    index = addTriangle(vertices, index, radius, ICO_V[3], ICO_V[8], ICO_V[4]);
    index = addTriangle(vertices, index, radius, ICO_V[4], ICO_V[8], ICO_V[9]);
    index = addTriangle(vertices, index, radius, ICO_V[4], ICO_V[9], ICO_V[5]);
    index = addTriangle(vertices, index, radius, ICO_V[5], ICO_V[9], ICO_V[10]);
    index = addTriangle(vertices, index, radius, ICO_V[5], ICO_V[10], ICO_V[1]);
    index = addTriangle(vertices, index, radius, ICO_V[1], ICO_V[10], ICO_V[6]);

    // bottom triangles
    index = addTriangle(vertices, index, radius, ICO_V[11], ICO_V[7], ICO_V[6]);
    index = addTriangle(vertices, index, radius, ICO_V[11], ICO_V[8], ICO_V[7]);
    index = addTriangle(vertices, index, radius, ICO_V[11], ICO_V[9], ICO_V[8]);
    index = addTriangle(vertices, index, radius, ICO_V[11], ICO_V[10], ICO_V[9]);
            addTriangle(vertices, index, radius, ICO_V[11], ICO_V[6], ICO_V[10]);
}