import Line from './Line';
import Triangle from './Triangle';

import { vec2, vec3 } from 'gl-matrix';

interface Additions {
    coplanar: boolean,
    source: vec3,
    target: vec3,
}

interface AdditionsN extends Additions {
    N1: vec3,
    N2: vec3,
}

const _v1 = vec3.create();
const _v2 = vec3.create();
const _v3 = vec3.create();

// https://github.com/benardp/contours/blob/master/freestyle/view_map/triangle_triangle_intersection.c
function triangleIntersectsTriangle(triangleA: Triangle, triangleB: Triangle, additionsIn: Additions = { coplanar: false, source: vec3.create(), target: vec3.create() }) {
    const additions = additionsIn as AdditionsN;

    const p1 = triangleA.a;
    const q1 = triangleA.b;
    const r1 = triangleA.c;

    const p2 = triangleB.a;
    const q2 = triangleB.b;
    const r2 = triangleB.c;

    // Compute distance signs  of p1, q1 and r1
    // to the plane of triangleB (p2,q2,r2)
    vec3.sub(_v1, p2, r2);
    vec3.sub(_v2, q2, r2);
    const N2 = vec3.cross(vec3.create(), _v1, _v2);

    vec3.sub(_v1, p1, r2);
    const dp1 = vec3.dot(_v1, N2);
    vec3.sub(_v1, q1, r2);
    const dq1 = vec3.dot(_v1, N2);
    vec3.sub(_v1, r1, r2);
    const dr1 = vec3.dot(_v1, N2);

    if (dp1 * dq1 > 0 && dp1 * dr1 > 0) {
        return false;
    }

    // Compute distance signs  of p2, q2 and r2
    // to the plane of triangleA (p1,q1,r1)
    vec3.sub(_v1, q1, p1);
    vec3.sub(_v2, r1, p1);
    const N1 = vec3.cross(vec3.create(), _v1, _v2);

    vec3.sub(_v1, p2, r1);
    const dp2 = vec3.dot(_v1, N1);
    vec3.sub(_v1, q2, r1);
    const dq2 = vec3.dot(_v1, N1);
    vec3.sub(_v1, r2, r1);
    const dr2 = vec3.dot(_v1, N1);

    if (dp2 * dq2 > 0 && dp2 * dr2 > 0) {
        return false;
    }

    additions.N2 = N2;
    additions.N1 = N1;

    if (dp1 > 0) {
        if (dq1 > 0) {
            return tri_tri_intersection(r1, p1, q1, p2, r2, q2, dp2, dr2, dq2, additions);
        } else if (dr1 > 0) {
            return tri_tri_intersection(q1, r1, p1, p2, r2, q2, dp2, dr2, dq2, additions);
        } else {
            return tri_tri_intersection(p1, q1, r1, p2, q2, r2, dp2, dq2, dr2, additions);
        }
    } else if (dp1 < 0) {
        if (dq1 < 0) {
            return tri_tri_intersection(r1, p1, q1, p2, q2, r2, dp2, dq2, dr2, additions);
        } else if (dr1 < 0) {
            return tri_tri_intersection(q1, r1, p1, p2, q2, r2, dp2, dq2, dr2, additions);
        } else {
            return tri_tri_intersection(p1, q1, r1, p2, r2, q2, dp2, dr2, dq2, additions);
        }
    } else if (dq1 < 0) {
        if (dr1 >= 0) {
            return tri_tri_intersection(q1, r1, p1, p2, r2, q2, dp2, dr2, dq2, additions);
        } else {
            return tri_tri_intersection(p1, q1, r1, p2, q2, r2, dp2, dq2, dr2, additions);
        }
    } else if (dq1 > 0) {
        if (dr1 > 0) {
            return tri_tri_intersection(p1, q1, r1, p2, r2, q2, dp2, dr2, dq2, additions);
        } else {
            return tri_tri_intersection(q1, r1, p1, p2, q2, r2, dp2, dq2, dr2, additions);
        }
    } else if (dr1 > 0) {
        return tri_tri_intersection(r1, p1, q1, p2, q2, r2, dp2, dq2, dr2, additions);
    } else if (dr1 < 0) {
        return tri_tri_intersection(r1, p1, q1, p2, r2, q2, dp2, dr2, dq2, additions);
    } else {
        // triangles are co-planar
        additions.coplanar = true;
        return coplanar_tri_tri3d(p1, q1, r1, p2, q2, r2, N1);
    }
}

function tri_tri_intersection(p1: Readonly<vec3>, q1: Readonly<vec3>, r1: Readonly<vec3>, p2: Readonly<vec3>, q2: Readonly<vec3>, r2: Readonly<vec3>, dp2: number, dq2: number, dr2: number, additions: AdditionsN) {
    if (dp2 > 0) {
        if (dq2 > 0) {
            return construct_intersection(p1, r1, q1, r2, p2, q2, additions);
        } else if (dr2 > 0) {
            return construct_intersection(p1, r1, q1, q2, r2, p2, additions);
        } else {
            return construct_intersection(p1, q1, r1, p2, q2, r2, additions);
        }
    } else if (dp2 < 0) {
        if (dq2 < 0) {
            return construct_intersection(p1, q1, r1, r2, p2, q2, additions);
        } else if (dr2 < 0) {
            return construct_intersection(p1, q1, r1, q2, r2, p2, additions);
        } else {
            return construct_intersection(p1, r1, q1, p2, q2, r2, additions);
        }
    } else if (dq2 < 0) {
        if (dr2 >= 0) {
            return construct_intersection(p1, r1, q1, q2, r2, p2, additions);
        } else {
            return construct_intersection(p1, q1, r1, p2, q2, r2, additions);
        }
    } else if (dq2 > 0) {
        if (dr2 > 0) {
            return construct_intersection(p1, r1, q1, p2, q2, r2, additions);
        } else {
            return construct_intersection(p1, q1, r1, q2, r2, p2, additions);
        }
    } else if (dr2 > 0) {
        return construct_intersection(p1, q1, r1, r2, p2, q2, additions);
    } else if (dr2 < 0) {
        return construct_intersection(p1, r1, q1, r2, p2, q2, additions);
    } else {
        additions.coplanar = true;
        return coplanar_tri_tri3d(p1, q1, r1, p2, q2, r2, additions.N1);
    }
}

function coplanar_tri_tri3d(p1: Readonly<vec3>, q1: Readonly<vec3>, r1: Readonly<vec3>, p2: Readonly<vec3>, q2: Readonly<vec3>, r2: Readonly<vec3>, normal_1: vec3) {
    const P1 = vec2.create(), Q1 = vec2.create(), R1 = vec2.create(),
          P2 = vec2.create(), Q2 = vec2.create(), R2 = vec2.create();

    const n_x = normal_1[0] < 0 ? -normal_1[0] : normal_1[0];
    const n_y = normal_1[1] < 0 ? -normal_1[1] : normal_1[1];
    const n_z = normal_1[2] < 0 ? -normal_1[2] : normal_1[2];

    /* Projection of the triangles in 3D onto 2D such that the area of
    the projection is maximized. */

    // TODO maybe use Float32Array.slice if the source is contiguous
    if (n_x > n_z && n_x >= n_y) { // Project onto plane YZ
        P1[0] = q1[2], P1[1] = q1[1];
        Q1[0] = p1[2], Q1[1] = p1[1];
        R1[0] = r1[2], R1[1] = r1[1];

        P2[0] = q2[2], P2[1] = q2[1];
        Q2[0] = p2[2], Q2[1] = p2[1];
        R2[0] = r2[2], R2[1] = r2[1];
    } else if (n_y > n_z && n_y >= n_x) { // Project onto plane XZ
        P1[0] = q1[0], P1[1] = q1[2];
        Q1[0] = p1[0], Q1[1] = p1[2];
        R1[0] = r1[0], R1[1] = r1[2];

        P2[0] = q2[0], P2[1] = q2[2];
        Q2[0] = p2[0], Q2[1] = p2[2];
        R2[0] = r2[0], R2[1] = r2[2];
    } else { // Project onto plane XY
        P1[0] = p1[0], P1[1] = p1[1];
        Q1[0] = q1[0], Q1[1] = q1[1];
        R1[0] = r1[0], R1[1] = r1[1];

        P2[0] = p2[0], P2[1] = p2[1];
        Q2[0] = q2[0], Q2[1] = q2[1];
        R2[0] = r2[0], R2[1] = r2[1];
    }

    return tri_tri_overlap_test_2d(P1, Q1, R1, P2, Q2, R2);
}

function tri_tri_overlap_test_2d(p1: vec2, q1: vec2, r1: vec2, p2: vec2, q2: vec2, r2: vec2) {
    if (ORIENT_2D(p1, q1, r1) < 0) {
        if (ORIENT_2D(p2, q2, r2) < 0) {
            return ccw_tri_tri_intersection_2d(p1, r1, q1, p2, r2, q2);
        } else {
            return ccw_tri_tri_intersection_2d(p1, r1, q1, p2, q2, r2);
        }
    } else if (ORIENT_2D(p2, q2, r2) < 0) {
        return ccw_tri_tri_intersection_2d(p1, q1, r1, p2, r2, q2);
    } else {
        return ccw_tri_tri_intersection_2d(p1, q1, r1, p2, q2, r2);
    }
}

function ORIENT_2D(a: vec2, b: vec2, c: vec2) {
    return ((a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[1]));
}

function ccw_tri_tri_intersection_2d(p1: vec2, q1: vec2, r1: vec2, p2: vec2, q2: vec2, r2: vec2) {
    if (ORIENT_2D(p2, q2, p1) >= 0) {
        if (ORIENT_2D(q2, r2, p1) >= 0) {
            if (ORIENT_2D(r2, p2, p1) >= 0) {
                return true;
            } else {
                return intersection_test_edge(p1, q1, r1, p2, r2);
            }
        } else if (ORIENT_2D(r2, p2, p1) >= 0) {
            return intersection_test_edge(p1, q1, r1, r2, q2);
        } else {
            return intersection_test_vertex(p1, q1, r1, p2, q2, r2)
        }
    } else if (ORIENT_2D(q2, r2, p1) >= 0) {
        if (ORIENT_2D(r2, p2, p1) >= 0) {
            return intersection_test_edge(p1, q1, r2, q2, p2);
        } else {
            return intersection_test_vertex(p1, q1, r1, q2, r2, p2);
        }
    } else {
        return intersection_test_vertex(p1, q1, r1, r2, p2, q2);
    }
}

function intersection_test_edge(P1: vec2, Q1: vec2, R1: vec2, P2: vec2, R2: vec2) {
    if (ORIENT_2D(R2, P2, Q1) >= 0) {
        if (ORIENT_2D(P1, P2, Q1) >= 0) {
            return ORIENT_2D(P1, Q1, R2) >= 0;
        } else if (ORIENT_2D(Q1, R1, P2) >= 0) {
            return ORIENT_2D(R1, P1, P2) >= 0;
        }
    } else if (ORIENT_2D(R2, P2, R1) >= 0 && ORIENT_2D(P1, P2, R1) >= 0) {
        return ORIENT_2D(P1, R1, R2) >= 0 || ORIENT_2D(Q1, R1, R2) >= 0;
    }

    return false;
}

function intersection_test_vertex(P1: vec2, Q1: vec2, R1: vec2, P2: vec2, Q2: vec2, R2: vec2) {
    if (ORIENT_2D(R2, P2, Q1) >= 0) {
        if (ORIENT_2D(R2, Q2, Q1) <= 0) {
            if (ORIENT_2D(P1, P2, Q1) > 0) {
                return ORIENT_2D(P1, Q2, Q1) <= 0;
            } else if (ORIENT_2D(P1, P2, R1) >= 0) {
                return ORIENT_2D(Q1, R1, P2) >= 0;
            }
        } else if (ORIENT_2D(P1, Q2, Q1) <= 0 && ORIENT_2D(R2, Q2, R1) <= 0) {
            return ORIENT_2D(Q1, R1, Q2) >= 0;
        }
    } else if (ORIENT_2D(R2, P2, R1) >= 0) {
        if (ORIENT_2D(Q1, R1, R2) >= 0) {
            return ORIENT_2D(P1, P2, R1) >= 0;
        } else if (ORIENT_2D(Q1, R1, Q2) >= 0) {
            return ORIENT_2D(R2, R1, Q2) >= 0;
        }
    }

    return false;
}

function construct_intersection(p1: Readonly<vec3>, q1: Readonly<vec3>, r1: Readonly<vec3>, p2: Readonly<vec3>, q2: Readonly<vec3>, r2: Readonly<vec3>, additions: AdditionsN) {
    let alpha: number;
    vec3.sub(_v1, q1, p1);
    vec3.sub(_v2, r2, p1);
    const N = vec3.cross(vec3.create(), _v1, _v2);
    vec3.sub(_v3, p2, p1);

    if (vec3.dot(_v3, N) > 0) {
        vec3.sub(_v1, r1, p1);
        vec3.cross(N, _v1, _v2);

        if (vec3.dot(_v3, N) <= 0) {
            vec3.sub(_v2, q2, p1);
            vec3.cross(N, _v1, _v2);

            if (vec3.dot(_v3, N) > 0) {
                vec3.sub(_v1, p1, p2);
                vec3.sub(_v2, p1, r1);
                alpha = vec3.dot(_v1, additions.N2) / vec3.dot(_v2, additions.N2);
                vec3.scale(_v1, _v2, alpha);
                vec3.sub(additions.source, p1, _v1);
                vec3.sub(_v1, p2, p1);
                vec3.sub(_v2, p2, r2);
                alpha = vec3.dot(_v1, additions.N1) / vec3.dot(_v2, additions.N1);
                vec3.scale(_v1, _v2, alpha);
                vec3.sub(additions.target, p2, _v1);
            }
            else {
                vec3.sub(_v1, p2, p1);
                vec3.sub(_v2, p2, q2);
                alpha = vec3.dot(_v1, additions.N1) / vec3.dot(_v2, additions.N1);
                vec3.scale(_v1, _v2, alpha);
                vec3.sub(additions.source, p2, _v1);
                vec3.sub(_v1, p2, p1);
                vec3.sub(_v2, p2, r2);
                alpha = vec3.dot(_v1, additions.N1) / vec3.dot(_v2, additions.N1);
                vec3.scale(_v1, _v2, alpha);
                vec3.sub(additions.target, p2, _v1);
            }

            return true;
        }
    }
    else {
        vec3.sub(_v2, q2, p1);
        vec3.cross(N, _v1, _v2);

        if (vec3.dot(_v3, N) >= 0) {
            vec3.sub(_v1, r1, p1);
            vec3.cross(N, _v1, _v2);
            if (vec3.dot(_v3, N) >= 0) {
                vec3.sub(_v1, p1, p2);
                vec3.sub(_v2, p1, r1);
                alpha = vec3.dot(_v1, additions.N2) / vec3.dot(_v2, additions.N2);
                vec3.scale(_v1, _v2, alpha);
                vec3.sub(additions.source, p1, _v1);
                vec3.sub(_v1, p1, p2);
                vec3.sub(_v2, p1, q1);
                alpha = vec3.dot(_v1, additions.N2) / vec3.dot(_v2, additions.N2);
                vec3.scale(_v1, _v2, alpha);
                vec3.sub(additions.target, p1, _v1);
            }
            else {
                vec3.sub(_v1, p2, p1);
                vec3.sub(_v2, p2, q2);
                alpha = vec3.dot(_v1, additions.N1) / vec3.dot(_v2, additions.N1);
                vec3.scale(_v1, _v2, alpha);
                vec3.sub(additions.source, p2, _v1);
                vec3.sub(_v1, p1, p2);
                vec3.sub(_v2, p1, q1);
                alpha = vec3.dot(_v1, additions.N2) / vec3.dot(_v2, additions.N2);
                vec3.scale(_v1, _v2, alpha);
                vec3.sub(additions.target, p1, _v1);
            }

            return true;
        }
    }

    return false;
}

function lineIntersects(line1: Line, line2: Line, points?: vec3[]) {
    const r = vec3.sub(vec3.create(), line1.end, line1.start);
    const s = vec3.sub(vec3.create(), line2.end, line2.start);
    const q = vec3.sub(vec3.create(), line1.start, line2.start);

    const dotqr = vec3.dot(q, r);
    const dotqs = vec3.dot(q, s);
    const dotrs = vec3.dot(r, s);
    const dotrr = vec3.dot(r, r);
    const dotss = vec3.dot(s, s);

    const denom = (dotrr * dotss) - (dotrs * dotrs);
    const numer = (dotqs * dotrs) - (dotqr * dotss);

    const t = numer / denom;
    const u = (dotqs + t * dotrs) / dotss;

    const p0 = vec3.scaleAndAdd(r, line1.start, r, t);
    const p1 = vec3.scaleAndAdd(s, line2.start, s, u);

    let onSegment = false;
    let intersects = false;

    if (0 <= t && t <= 1 && 0 <= u && u <= 1) {
        onSegment = true;
    }

    const p0p1Length = vec3.distance(p0, p1);

    if (p0p1Length <= 1e-5) {
        intersects = true;
    }

    if (!(intersects && onSegment)) {
        return false;
    }

    if (points) {
        points.push(p0, p1);
    }

    return true;
}

function getLines(triangle: Triangle) {
    return [
        <Line>{ start: triangle.a, end: triangle.b },
        <Line>{ start: triangle.b, end: triangle.c },
        <Line>{ start: triangle.c, end: triangle.a }
    ];
}

function checkTrianglesIntersection(triangle1: Triangle, triangle2: Triangle, additions: Additions = { coplanar: false, source: vec3.create(), target: vec3.create() }) {
    const triangleIntersects = triangleIntersectsTriangle(triangle1, triangle2, additions);
    if (!triangleIntersects && additions.coplanar) {
        const triangle1Lines = getLines(triangle1);
        const triangle2Lines = getLines(triangle2);

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (lineIntersects(triangle1Lines[i], triangle2Lines[j])) {
                    return true;
                }
            }
        }

        return false;
    }

    return triangleIntersects;
}

export { triangleIntersectsTriangle, checkTrianglesIntersection, getLines, lineIntersects };