# OctreeCSG-ea

A stripped down engine-agnostic version of the
[OctreeCSG library](https://github.com/giladdarshan/OctreeCSG), ported to
Typescript. **This is very work-in-progress**.

Because this is a stripped down version of the library, some features are
missing, such as directly operating with meshes and assigning materials.

### Table of Contents
- [Usage](#usage)
- [Operations](#operations)
  - [OctreeCSG.union](#octreecsgunion)
  - [OctreeCSG.subtract](#octreecsgsubtract)
  - [OctreeCSG.intersect](#octreecsgintersect)
  - [OctreeCSG.operation](#octreecsgoperation)
- [Array Operations](#array-operations)
- [Asynchronous Operations](#asynchronous-operations)
- [OctreeCSG Flags](#octreecsg-flags)
- [Limitations](#limitations)
- [Resources](#resources)

## Usage
OctreeCSG comes as a Javascript Module and can be imported with the following
command:
```js
import { OctreeCSG } from 'octreecsg-ea';
```

This assumes that the library was installed as a node module. If not, replace
`octreecsg-ea` with a full path to the bundle.

Note that if asynchronous operations are used, then the job dispatcher should be
created with:
```js
OctreeCSGJobDispatcher.create('/OctreeCSG-ea.worker.min.js', 2, 1000);
```

This only has to be done once, and further calls will be ignored. The first
argument is the path to the web worker script, the second argument is the size
of the worker pool (how many web workers should be created), and the third
argument is the timeout in milliseconds for the creation of each worker (if this
time is exceeded, then the worker fails to be created). The worker script must
be copied to the root of the domain.

If the job dispatcher is not created, or fails to be created, then the library
will still work, but asynchronous operations will simply act as synchronous
operations wrapped in a promise (operations will not be done in a separate
thread), which may introduce stuttering to a game that is using this library.

## Operations
### OctreeCSG.union:
Merges two Octrees (octreeA and octreeB) to one Octree

| Parameter | Description |
| --- | --- |
| octreeA | First octree object |
| octreeB | Second octree object |
| buildTargetOctree | (Optional) Specifies if to build the target Octree tree or return a flat Octree (true / flase). **Default**: true |

### OctreeCSG.subtract:
Subtracts octreeB from octreeA and returns the result Octree

| Parameter | Description |
| --- | --- |
| octreeA | First octree object |
| octreeB | Second octree object |
| buildTargetOctree | (Optional) Specifies if to build the target Octree tree or return a flat Octree (true / flase). **Default**: true |

### OctreeCSG.intersect:
Returns the intersection of octreeA and octreeB

| Parameter | Description |
| --- | --- |
| octreeA | First octree object |
| octreeB | Second octree object |
| buildTargetOctree | (Optional) Specifies if to build the target Octree tree or return a flat Octree (true / flase). **Default**: true |

### OctreeCSG.operation
CSG Hierarchy of Operations (syntax may change), provides a simple method to combine several CSG operations into one

| Parameter | Description |
| --- | --- |
| obj | Input object with the CSG hierarchy |
| returnOctrees | (Optional) Specifies whether to return the Octrees as part of the result or not (true / false). **Default**: false |

Input object structure:
| Key | Expected Value |
| --- | --- |
| op | Type of operation to perform as string, options: union, subtract and intersect |
| material | (Optional) Used only in the root level of the object, if a material is provided the returned object will be a three.js mesh instead of an Octree. Value can be a single material or an array of materials |
| objA | First object, can be a three.js mesh, Octree or a sub-structure of the CSG operation |
| objB | Second object, can be a three.js mesh, Octree or a sub-structure of the CSG operation |

## Array Operations
OctreeCSG provides 3 methods to perform CSG operations on an array of meshes / octrees

| Parameter | Description |
| --- | --- |
| objArr | An array of meshes or octrees to perform the CSG operation on |

List of Methods:
- OctreeCSG.unionArray - Union operation on an array of meshes
- OctreeCSG.subtractArray - Subtract operation on an array of meshes
- OctreeCSG.intersectArray - Intersect operation on an array of meshes

## Asynchronous Operations
OctreeCSG provides asynchronous CSG methods for all the advanced CSG operations.

List of Methods:
- OctreeCSG.async.union
- OctreeCSG.async.subtract
- OctreeCSG.async.intersect
- OctreeCSG.async.operation
- OctreeCSG.async.unionArray
- OctreeCSG.async.subtractArray
- OctreeCSG.async.intersectArray

## OctreeCSG Flags
The following flags and variables control how OctreeCSG operates.

| Flag / Variable | Default Value | Description |
| --- | --- | --- |
| OctreeCSG.useWindingNumber | false | Determines if to use the ray-triangle intersection algorithm or the [Winding number algorithm](https://en.wikipedia.org/wiki/Point_in_polygon#Winding_number_algorithm). The Winding number alogirthm can be more accurate than the ray-triangle algorithm on some occasions at the cost of performance. **Options**: true, false |
| OctreeCSG.maxLevel | 16 | Maximum number of sub-Octree levels in the tree |
| OctreeCSG.polygonsPerTree | 100 | Minimum number of polygons (triangles) in a sub-Octree before a split is needed |

## Limitations
The current worker script size is huge due to browser and esbuild limitations.
Ideally, the worker script would share code with the rest of the library,
however, esbuild code splitting is only available for ES6 modules, but
[module workers are not yet supported on Firefox](https://bugzilla.mozilla.org/show_bug.cgi?id=1247687).

As a workaround, the worker is bundled with the library and gl-matrix as an
IIFE, which increases the size of the worker script dramatically.

## Resources
- The Polygon, Vertex and Plane classes were adapted from [THREE-CSGMesh](https://github.com/manthrax/THREE-CSGMesh)
- The Winding number algorithm is based on this [code](https://github.com/grame-cncm/faust/blob/master-dev/tools/physicalModeling/mesh2faust/vega/libraries/windingNumber/windingNumber.cpp)
- The Möller–Trumbore ray-triangle intersection algorithm is based on this [code](https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm#C++_implementation)
- The triangle-triangle intersection logic and algorithm is based on this [code](https://github.com/benardp/contours/blob/master/freestyle/view_map/triangle_triangle_intersection.c)
- The ray-box intersection logic and algorithm is based on these 3 articles: [part 1](https://tavianator.com/2011/ray_box.html), [part 2](https://tavianator.com/2015/ray_box_nan.html) and [part 3](https://tavianator.com/2022/ray_box_boundary.html)
- The triangle-box intersection logic and algorithm is based on this [code](https://stackoverflow.com/questions/17458562/efficient-aabb-triangle-intersection-in-c-sharp/17503268#17503268), which in turn is based on this [paper](https://fileadmin.cs.lth.se/cs/Personal/Tomas_Akenine-Moller/code/tribox_tam.pdf)
- The triangulation algorithms are based on the book `Computational Geometry: Algorithms and Applications` (ISBN `978-3-540-77973-5`)