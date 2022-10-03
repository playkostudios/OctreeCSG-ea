import OctreeCSGJobDispatcher from './worker/OctreeCSGJobDispatcher';

OctreeCSGJobDispatcher.register('/OctreeCSG-worker.esm.min.js');

export { default as OctreeCSG } from './base/OctreeCSG';
export { Polygon } from './math/Polygon';
export { default as Plane } from './math/Plane';
export { default as Vertex } from './math/Vertex';