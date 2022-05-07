
import * as THREE from 'three';
import {OrbitControls} from 'threeModules/controls/OrbitControls.js';
//import {TorusKnotGeometry} from 'threeModules/geometries/TorusKnotGeometry.js';
import CSG from "./three-csg.js"
import app from "./app3.js"
let {renderer,scene,camera} = app;

//UI(app);
let tx = app.environment.makeProceduralTexture(256,(u,v)=>{
    let rb = ((Math.random()*128)|0) * (((((u*2)&1)^((v*2)&1))|0)?1:2)
    return (rb*256)|(rb*256*256)|(rb*256*256*256)|0x000000ff
})
tx.repeat.set(2,2);
tx.wrapS = tx.wrapT = THREE.RepeatWrapping

let mkMat=(color) => new THREE.MeshStandardMaterial({color:color,roughness:1,metalness:0.8,map:tx});
let rnd=(rng)=>((Math.random()*2)-1)*(rng||1)

let testMeshes = {
    sphere:new THREE.Mesh(new THREE.SphereGeometry(1.2,8,8),mkMat('grey')),
    box: new THREE.Mesh(new THREE.BoxGeometry(2,2,2),mkMat('grey')),    
    torusknot: new THREE.Mesh(new THREE.TorusKnotGeometry(1, .4, 30, 4),mkMat('grey')),    
}
let meshNames=Object.keys(testMeshes)
let objA = 0;
let objB = 1;


let animating = true
let stepping = false

let meshA = testMeshes[meshNames[objA]].clone();
scene.add(meshA)

let meshB = testMeshes[meshNames[objB]].clone();
scene.add(meshB)

import OctreeCSG from "../OctreeCSG.js"
function doCSGbrute(a,b,op,mat){
    let bspA = CSG.fromMesh( a );
    let bspB = CSG.fromMesh( b );
    let bspC = bspA[op]( bspB );
    let result = CSG.toMesh( bspC, a.matrix );
    result.material = mat;
    result.castShadow  = result.receiveShadow = true;
    return result;
}
function doCSGocttree(a,b,op,mat){
    let bspA = OctreeCSG.fromMesh( a );
    let bspB = OctreeCSG.fromMesh( b );
    let bspC = OctreeCSG[op]( bspA,bspB );
    let result = OctreeCSG.toMesh( bspC , a.material);//, a.matrix );
    result.material = mat;
    result.castShadow  = result.receiveShadow = true;
    return result;
}

let subMaterial = mkMat('red')
let intersectMaterial = mkMat('green')
let unionMaterial = mkMat('blue');
let results = []

let mats=[subMaterial,intersectMaterial,unionMaterial]

let csgMethods={
    'brute':doCSGbrute,
    'octtree':doCSGocttree
}

let curCSGMethod = 'octtree'
let csgMethod = csgMethods[curCSGMethod]

let info = document.createElement('span')

Object.assign(info.style,{
    position: 'absolute',
    zIndex: 10,
    left: '10px',
    top: '10px',
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: 'white',
    background: 'rgba(50,50,50,.5)'})
document.body.appendChild(info)

let timeTaken=0;
let heap = 0;
let heapLow = 0;
let heapHigh = 0;
let heapChange = 0;
let mb=v=>(v/1000000)|0
let updateInfo=()=>{
    let ntris=0;
    results.forEach(m=>ntris+=m.geometry.attributes.position.count)
    info.innerHTML = `[W] - wireframe<br>
[Space] - change method<br>
[Q] - objA:${meshNames[objA]}<br>
[E] - objB:${meshNames[objB]}<br>
[A] - animate<br>
[E] - step<br>
current method:${curCSGMethod}<br>time taken: ${timeTaken.toFixed(2)}<br>
triangles: ${ntris}<br>
heap low (mb) : ${mb(heapLow)}<br>
heap high (mb): ${mb(heapHigh)}<br>
heap (mb)     : ${mb(heap)}<br>
<span style="width:${(((heap-heapLow)*100)/(heapHigh-heapLow))|0}px;height:16px;background:red;display:inline-block">used</span>
`
}

let step = 0;
window.addEventListener("keydown", (e)=>{
if(e.code=='KeyW'){
    scene.traverse(e=>e.isMesh&&((e.material.length&&(e.material.forEach(m=>m.wireframe=!m.wireframe)))||(e.material.wireframe = !e.material.wireframe)))
    mats.forEach(m=>m.wireframe=!m.wireframe)
}else if(e.code=='Space'){
    csgMethod = csgMethods[curCSGMethod = (curCSGMethod == 'brute')?'octtree':'brute'];
}else if(e.code=='KeyQ'){
    objA=(objA+1)%meshNames.length;
    meshA.geometry=testMeshes[meshNames[objA]].geometry;
}else if(e.code=='KeyE'){
    objB=(objB+1)%meshNames.length;
    meshB.geometry=testMeshes[meshNames[objB]].geometry;
}else if(e.code=='KeyA'){
    animating = true;
    stepping = false;
}else if(e.code=='KeyD'){
    animating = false;
    stepping = true;
    step+=16;
}
    
}, false);

function recompute(){
    heapChange = performance.memory.usedJSHeapSize;
    timeTaken = performance.now();
    for(let i=0;i<results.length;i++){
        let m = results[i]
        m.parent.remove(m)
        m.geometry.dispose();
    }
    results = [];

    meshB.updateMatrix();
    meshA.updateMatrix();

    results.push(csgMethod(meshB,meshA,'subtract',subMaterial))
    results.push(csgMethod(meshB,meshA,'intersect',intersectMaterial))
    results.push(csgMethod(meshB,meshA,'union',unionMaterial))

    results.push(csgMethod(meshA,meshB,'subtract',subMaterial))
    results.push(csgMethod(meshA,meshB,'intersect',intersectMaterial))
    results.push(csgMethod(meshA,meshB,'union',unionMaterial))

    for(let i=0;i<results.length;i++){
        let r = results[i];
        r.castShadow = r.receiveShadow = true;
        scene.add(r)

        r.position.z += -5 + ((i%3)*5)
        r.position.x += -5 + (((i/3)|0)*10)
    }    
    
    timeTaken = performance.now()-timeTaken;
    heap = performance.memory.usedJSHeapSize
    heapChange = heap-heapChange;
    if(heapChange<0)
        heapLow = heap;
    else
        if(heapHigh < heap)heapHigh = heap
    
    updateInfo();
}
document.addEventListener('afterRender',()=>{
    //let time = performance.now()
    
    meshA.position.x=Math.sin(step*0.001)*2;
    meshA.position.z=Math.cos(step*0.0011)*0.5;
    if(animating){
        step+=16
    }
    //meshA.position.t=Math.sin(time*-0.0012)*0.5;
    recompute();
})