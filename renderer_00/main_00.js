

import { trackballView } from './helperFun.js';
import { PhongShader } from '../renderer_01/shaderPhong.js';



/* the main object to be implementd */
export const Renderer = new Object();

const view_transform = glMatrix.mat4.create();
const toView = glMatrix.mat4.create();
const trackball_matrix = glMatrix.mat4.create();
const trackball_rotation = glMatrix.mat4.create();
const trackball_scaling  = glMatrix.mat4.create();
const trackball_translate = glMatrix.mat4.create();
const DEFAULT_eyeVecFollowCam = [0.0, 5.0, 0.0, 0.0];
const DEFAULT_eyeVecChaseCam = [0 , 1.5, 4.0, 10.0];
const DEFAULT_targetVecChaseCam = [0, 0, 0];
const DEFAULT_targetVecFollowCam = [0.0, 0.0, 0.0];
const DEFAULT_upVecFollowCam = [-5, 0.0, -1.0, 0.0];
const DEFAULT_upVecChaseCam = [0.0,1.0, 0, 0.0];

const invTrackball_matrix  = glMatrix.mat4.create();
const SMOOTH_FACTOR= 0.0005;
const initialScale = 1;
const trans_axis = glMatrix.vec3.create();
const toRad = Math.PI/180;
let eyeVec = DEFAULT_eyeVecFollowCam;
let targetVec= DEFAULT_targetVecFollowCam;
let upVec = DEFAULT_upVecFollowCam;
let altPressed = 0;
let eye = glMatrix.vec3.create();
let target = glMatrix.vec3.create();
let up = glMatrix.vec4.create();
let reset = 0;
let alpha = 0, beta =0;
let rotAngleWheelsRad = 0;
let rotating = false;
let start_point = [0, 0, 0];
let lastMousePos = [1, 1, 1];

let scaling_factor = initialScale;
let projection_matrix;
let scale_matrix = glMatrix.mat4.create();
let translate_matrix = glMatrix.mat4.create();
let rotate_transform = glMatrix.mat4.create();
const identity = glMatrix.mat4.create();
let M = glMatrix.mat4.create();

/*
the FollowFromUpCamera always look at the car from a position abova right over the car
*/
const FollowFromUpCamera = function(){

  /* the only data it needs is the position of the camera */
  this.frame = glMatrix.mat4.create();
  
  /* update the camera with the current car position */
  this.update = function(car_position){

    this.frame = car_position;
  }

  /* return the transformation matrix to transform from worlod coordiantes to the view reference frame */
  this.matrix = function(){
    

    glMatrix.vec3.transformMat4(eye, eyeVec, this.frame);
    glMatrix.vec3.transformMat4(target, targetVec, this.frame);
    glMatrix.vec4.transformMat4(up, upVec, this.frame);
    let diffTarget = [0, 0, 0];
    glMatrix.vec3.sub(diffTarget, target, [trackball_rotation[8], trackball_rotation[9], trackball_rotation[10]]);

    
    return glMatrix.mat4.lookAt(glMatrix.mat4.create(),eye,diffTarget,[trackball_rotation[4], trackball_rotation[5], trackball_rotation[6]]);	
  }

  this.setToDef = function(){
    eyeVec = DEFAULT_eyeVecFollowCam;
    targetVec= DEFAULT_targetVecFollowCam;
    upVec = DEFAULT_upVecFollowCam;
    setRotationToDef(eyeVec, upVec);
  }
}

/*
the ChaseCamera always look at the car from behind the car, slightly above
*/
const ChaseCamera = function(){

  /* the only data it needs is the frame of the camera */
  this.frame = glMatrix.mat4.create();
  
  /* update the camera with the current car position */
  this.update = function(car_frame){
    this.frame = car_frame.slice();
  }

  /* return the transformation matrix to transform from worlod coordiantes to the view reference frame */
  this.matrix = function(){
    glMatrix.vec3.transformMat4(eye, eyeVec, this.frame);
    glMatrix.vec3.transformMat4(target, targetVec, this.frame);
    glMatrix.vec4.transformMat4(up, upVec, this.frame);
    
    let diffTarget = target;
    glMatrix.vec3.transformMat4(target, target, trackball_translate);

    if(Renderer.car.control_keys['Alt'] || (!Renderer.car.control_keys['ArrowUp'] &&
      !Renderer.car.control_keys['ArrowLeft']  &&
      !Renderer.car.control_keys['ArrowRight']  &&
      !Renderer.car.control_keys['ArrowDown'])
      ){
        if(Renderer.car.control_keys['Alt']){
          if(!altPressed){
            altPressed++;
          }
          glMatrix.vec4.set(up, trackball_rotation[4], trackball_rotation[5], trackball_rotation[6]);
          glMatrix.vec3.sub(diffTarget, eye, [trackball_rotation[8], trackball_rotation[9], trackball_rotation[10]]);
        } else {
          if(altPressed){
            glMatrix.vec4.set(up, trackball_rotation[4], trackball_rotation[5], trackball_rotation[6]);
          glMatrix.vec3.sub(diffTarget, eye, [trackball_rotation[8], trackball_rotation[9], trackball_rotation[10]]);
          }
        }
      
    } else {
      if(altPressed){
        altPressed--;
      }
    }

    return glMatrix.mat4.lookAt(glMatrix.mat4.create(),eye, diffTarget , up);	
  }
  this.setToDef = function(){
    eyeVec = DEFAULT_eyeVecChaseCam;
    targetVec= DEFAULT_targetVecChaseCam;
    upVec = DEFAULT_upVecChaseCam;
    setRotationToDef([4, eyeVec[1], 0, 0], upVec);
  }
}


/* array of cameras that will be used */
Renderer.cameras = [];
// add a FollowFromUpCamera
Renderer.cameras.push(new FollowFromUpCamera());
Renderer.cameras.push(new ChaseCamera());

// set the camera currently in use

/*
create the buffers for an object as specified in common/shapes/triangle.js
*/
Renderer.createObjectBuffers = function (gl, obj, lineColor) {

  obj.vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, obj.vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  
  obj.normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, obj.normals, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  obj.indexBufferTriangles = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferTriangles);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, obj.triangleIndices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  if(!lineColor){
    // create edges
    var edges = new Uint16Array(obj.numTriangles * 4);
    let a=0,b=0,c=0,d=0;
    if(obj.name === "TexturedTrack_Normals"){
      a=0;
      b=3;
      c=1;
      d=7;
    } else if(obj.name === "Building_Normals"){
      a = 1;
      b=2;
      c=0;
      d=0;
    } else if(obj.name === 'Wheel_Normals'){
      a = 2;
      b=1;
      c=0;
      d=3;
    }
    for (var i = 0; i < obj.numTriangles; ++i) {
      edges[i * 4 + 0] = obj.triangleIndices[i * 3 + a];
      edges[i * 4 + 1] = obj.triangleIndices[i * 3 + b];
      edges[i * 4 + 2] = obj.triangleIndices[i * 3 + c];
      edges[i * 4 + 3] = obj.triangleIndices[i * 3 + d];
    }

    obj.indexBufferEdges = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferEdges);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edges, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }
};

/*
draw an object as specified in common/shapes/triangle.js for which the buffer 
have alrady been created
*/
Renderer.drawObject = function (gl, obj, shader, fillColor, lineColor) {
  gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
  gl.enableVertexAttribArray(shader.aPositionIndex);
  gl.vertexAttribPointer(shader.aPositionIndex, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
  gl.enableVertexAttribArray(shader.aNormalIndex);
  gl.vertexAttribPointer(shader.aNormalIndex, 3, gl.FLOAT, false, 0, 0);
 
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1.0, 1.0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferTriangles);
  gl.uniform4fv(shader.uColorLocation, fillColor);
  gl.drawElements(gl.TRIANGLES, obj.triangleIndices.length, gl.UNSIGNED_SHORT, 0);

  gl.disable(gl.POLYGON_OFFSET_FILL);
  if(lineColor){
    gl.uniform4fv(shader.uColorLocation, lineColor);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferEdges);
    gl.drawElements(gl.LINES, obj.numTriangles * 4, gl.UNSIGNED_SHORT, 0);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  gl.disableVertexAttribArray(shader.aPositionIndex);
  gl.disableVertexAttribArray(shader.aNormalIndex);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
};

/*
initialize the object in the scene
*/
Renderer.initializeObjects = function (gl) {
  Game.setScene(scene_0);
  this.sunDir = glMatrix.vec3.normalize(glMatrix.vec3.create(), Game.scene.weather.sunLightDirection);

  this.car = Game.addCar("mycar");
  this.cube = new Cube(10);
  ComputeNormals(this.cube);
  this.createObjectBuffers(gl,this.cube);
  
  this.cylinder = new Cylinder(10);
  this.cylinder.name = 'Wheel';
  ComputeNormals(this.cylinder);
  this.createObjectBuffers(gl,this.cylinder );

  ComputeNormals(Game.scene.trackObj);
  Renderer.createObjectBuffers(gl,Game.scene.trackObj);
  Game.scene.groundObj.name = "Ground";
  ComputeNormals(Game.scene.groundObj);
  Renderer.createObjectBuffers(gl,Game.scene.groundObj);
  for (var i = 0; i < Game.scene.buildings.length; ++i){
    ComputeNormals(Game.scene.buildingsObj[i]);
    Renderer.createObjectBuffers(gl,Game.scene.buildingsObj[i]);
  }

  this.myCar = loadOnGPU(bodyCar, Renderer.gl);

};
let i = 0;


/*
draw the car
*/
Renderer.drawCar = function (gl) {

    M                 = glMatrix.mat4.create();
    rotate_transform  = glMatrix.mat4.create();
    translate_matrix  = glMatrix.mat4.create();
    scale_matrix      = glMatrix.mat4.create();
    const normalMatrix  = glMatrix.mat4.create();
    const viewModelMatrix = glMatrix.mat4.create();

    let rotRad = this.car.wheelsAngle*10;
    if(rotRad > 0.3){
      rotRad = 0.3;
    } else if(rotRad < -0.3){
      rotRad = -0.3;
    }

    glMatrix.mat4.fromTranslation(translate_matrix,[0,1,1]);
    glMatrix.mat4.fromScaling(scale_matrix,[0.7,0.25,1]);
    glMatrix.mat4.mul(M,scale_matrix,translate_matrix);
    glMatrix.mat4.fromRotation(rotate_transform,-0.1,[1,0,0]);
    glMatrix.mat4.mul(M,rotate_transform,M);
    glMatrix.mat4.fromTranslation(translate_matrix,[0,0.1,-1]);
    glMatrix.mat4.mul(M,translate_matrix,M);

    Renderer.stack.push();
    Renderer.stack.multiply(M);
    glMatrix.mat4.mul(viewModelMatrix, toView, this.stack.matrix);
    glMatrix.mat4.transpose(normalMatrix, glMatrix.mat4.invert(normalMatrix, viewModelMatrix));
    console.log(matTo33(normalMatrix));
    this.gl.uniformMatrix3fv(this.phongShader.uViewNormalMatrixLocation, false, matTo33(normalMatrix));
    gl.uniformMatrix4fv(this.phongShader.uModelViewMatrixLocation, false, viewModelMatrix);

    this.drawObject(gl, this.cube,  this.phongShader ,[0.2,0.6,0.7,1.0],[0.2, 0.2, 0.2, 1.0]);
    Renderer.stack.pop();

    const Mw                 = glMatrix.mat4.create();
    /* draw the wheels */
    glMatrix.mat4.fromRotation(rotate_transform,3.14/2.0,[0,0,1]);
    glMatrix.mat4.fromTranslation(translate_matrix,[1,0,0]);
    glMatrix.mat4.mul(Mw,translate_matrix,rotate_transform);
    
    glMatrix.mat4.fromScaling(scale_matrix,[0.1,0.2,0.2]);
    glMatrix.mat4.mul(Mw,scale_matrix,Mw);
     /* now the diameter of the wheel is 2*0.2 = 0.4 and the wheel is centered in 0,0,0 */

     
    glMatrix.mat4.identity(M);

    let radius = 0.2;
    let deltaS = this.car.position[2] * this.car.speed;
    let deltaAngle = (deltaS/radius)*toRad;
    rotAngleWheelsRad += deltaAngle;
    rotAngleWheelsRad = Math.abs(rotAngleWheelsRad) > 100*3.14 ? 0 : rotAngleWheelsRad;

    glMatrix.mat4.fromTranslation(translate_matrix,[-0.8,0.2,-0.7]);
    glMatrix.mat4.mul(M,translate_matrix,Mw);
    Renderer.stack.push();
    Renderer.stack.multiply(M);
    let rotMatY = glMatrix.mat4.fromYRotation(glMatrix.mat4.create(), rotRad);
    let rotMatYAngular = glMatrix.mat4.fromYRotation(glMatrix.mat4.create(), rotAngleWheelsRad);
    Renderer.stack.multiply(rotMatYAngular);

    rotateMulStack(rotMatY, Renderer.stack);
    glMatrix.mat4.mul(viewModelMatrix, toView, this.stack.matrix);
    glMatrix.mat4.transpose(normalMatrix, glMatrix.mat4.invert(normalMatrix, viewModelMatrix))
    this.gl.uniformMatrix3fv(this.phongShader.uViewNormalMatrixLocation, false, matTo33(normalMatrix));
    gl.uniformMatrix4fv(this.phongShader.uModelViewMatrixLocation, false, viewModelMatrix);
  
    this.drawObject(gl, this.cylinder, this.phongShader,[1.0,0.6,0.5,1.0],[0.2, 0.2, 0.2, 1.0]);
    Renderer.stack.pop();
    Renderer.stack.pop();

    glMatrix.mat4.fromTranslation(translate_matrix,[0.8,0.2,-0.7]);
    glMatrix.mat4.mul(M,translate_matrix,Mw);

    Renderer.stack.push();
    Renderer.stack.multiply(M);
    Renderer.stack.multiply(rotMatYAngular);

    rotateMulStack(rotMatY, Renderer.stack);
    glMatrix.mat4.mul(viewModelMatrix, toView, this.stack.matrix);
    glMatrix.mat4.transpose(normalMatrix, glMatrix.mat4.invert(normalMatrix, viewModelMatrix))
    this.gl.uniformMatrix3fv(this.phongShader.uViewNormalMatrixLocation, false, matTo33(normalMatrix));
    gl.uniformMatrix4fv(this.phongShader.uModelViewMatrixLocation, false, viewModelMatrix);
  
    this.drawObject(gl, this.cylinder,  this.phongShader, [1.0,0.6,0.5,1.0],[0.2, 0.2, 0.2, 1.0]);
    Renderer.stack.pop();
    Renderer.stack.pop();

    /* this will increase the size of the wheel to 0.4*1,5=0.6 */
    glMatrix.mat4.fromScaling(scale_matrix,[1,1.5,1.5]);;
    glMatrix.mat4.mul(Mw,scale_matrix,Mw);
    
    glMatrix.mat4.fromTranslation(translate_matrix,[0.8,0.3,0.7]);
    glMatrix.mat4.mul(M,translate_matrix,Mw);
  
    Renderer.stack.push();
    Renderer.stack.multiply(M);
    Renderer.stack.multiply(rotMatYAngular);

    glMatrix.mat4.mul(viewModelMatrix, toView, this.stack.matrix);
    glMatrix.mat4.transpose(normalMatrix, glMatrix.mat4.invert(normalMatrix, viewModelMatrix))
    this.gl.uniformMatrix3fv(this.phongShader.uViewNormalMatrixLocation, false, matTo33(normalMatrix));
    gl.uniformMatrix4fv(this.phongShader.uModelViewMatrixLocation, false, viewModelMatrix);
    Renderer.stack.pop();

    this.drawObject(gl,  this.cylinder, this.phongShader, [1.0,0.6,0.5,1.0],[0.2, 0.2, 0.2, 1.0]);

    glMatrix.mat4.fromTranslation(translate_matrix,[-0.8,0.3,0.7]);
    glMatrix.mat4.mul(M,translate_matrix,Mw);
  
    Renderer.stack.push();
    Renderer.stack.multiply(M);
    Renderer.stack.multiply(rotMatYAngular);

    glMatrix.mat4.mul(viewModelMatrix, toView, this.stack.matrix);
    glMatrix.mat4.transpose(normalMatrix, glMatrix.mat4.invert(normalMatrix, viewModelMatrix))
    this.gl.uniformMatrix3fv(this.phongShader.uViewNormalMatrixLocation, false, matTo33(normalMatrix));
    gl.uniformMatrix4fv(this.phongShader.uModelViewMatrixLocation, false, viewModelMatrix);
  
    this.drawObject(gl, this.cylinder, this.phongShader, [1.0,0.6,0.5,1.0],[0.2, 0.2, 0.2, 1.0]);
    Renderer.stack.pop();
};

Renderer.drawLamp = function(shader){
  this.stack.push();
  const M = glMatrix.mat4.fromTranslation(glMatrix.mat4.create(), [0, 2, 0]);
  this.stack.multiply(M);

  const M1 = glMatrix.mat4.fromScaling(glMatrix.mat4.create(), [0.2, 0.1, 0.2]);
  this.stack.multiply(M1);

  this.gl.uniformMatrix4fv(shader.uModelMatrixLocation, false, this.stack.matrix);
  this.drawObject(this.gl, this.cube, shader, [0.1, 1, 1, 1.0]);
  this.stack.pop();

  const M_scal = glMatrix.mat4.fromScaling(glMatrix.mat4.create(), [0.05, 1, 0.05]);
  this.stack.multiply(M_scal);

  this.gl.uniformMatrix4fv(shader.uModelMatrixLocation, false, this.stack.matrix);
  this.drawObject(this.gl, this.phongShader, shader, this.cylinder, [0.6, 0.23, 0.12, 1]);
}


Renderer.drawScene = function (gl) {

  var width = this.canvas.width;
  var height = this.canvas.height
  const inv_view_transform = glMatrix.mat4.create();
  const invToView = glMatrix.mat4.create();
  this.stack = new MatrixStack();

  gl.viewport(0, 0, width, height);
  
  gl.enable(gl.DEPTH_TEST);

  // Clear the framebuffer
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


  this.cameras[Renderer.currentCamera].update(this.car.frame);

  gl.useProgram(this.phongShader);
  
  glMatrix.mat4.mul(toView, view_transform, trackball_matrix);

  this.drawLighting(toView, projection_matrix)  

  glMatrix.mat4.copy(view_transform, Renderer.cameras[Renderer.currentCamera].matrix());
  gl.uniformMatrix4fv(this.phongShader.uProjectionMatrixLocation, false, projection_matrix);
  gl.uniformMatrix4fv(this.phongShader.uModelViewMatrixLocation, false, toView);
  gl.uniformMatrix3fv(this.phongShader.uViewNormalMatrixLocation, false, matTo33(toView));

  // gl.uniformMatrix4fv(this.uniformShader.uViewMatrixLocation, false, view_transform);
  // gl.uniformMatrix4fv(this.uniformShader.uTrackballMatrixLocation, false, trackball_matrix);
  

  // glMatrix.mat4.invert(inv_view_transform, view_transform);
  // gl.uniformMatrix4fv(this.uniformShader.uInvViewMatrixLocation, false, inv_view_transform);

  // glMatrix.mat4.mul(toView, view_transform, trackball_matrix);
  // glMatrix.mat4.invert(invToView, toView);
  // gl.uniformMatrix4fv(this.uniformShader.uInvToViewSpaceMatrixLocation, false, invToView);
  // gl.uniformMatrix4fv(this.uniformShader.uInvTrackballMatrixLocation, false, invTrackball_matrix);


  // initialize the stack with the identity
  this.stack.loadIdentity();

  // drawing the car
  this.stack.push();
  this.stack.multiply(this.car.frame); 

  this.drawCar(gl);
  this.stack.pop();

  this.gl.uniformMatrix3fv(this.phongShader.uViewNormalMatrixLocation, false, matTo33(toView));
  gl.uniformMatrix4fv(this.phongShader.uModelViewMatrixLocation, false, toView);
  
  // drawing the static elements (ground, track and buldings)
	this.drawObject(gl, Game.scene.groundObj, this.phongShader, [0.3, 0.7, 0.2, 1.0], [0.0, 0, 0, 1.0]);
 	this.drawObject(gl, Game.scene.trackObj, this.phongShader, [0.9, 0.8, 0.7, 1.0], [1.0, 0, 0, 1.0]);
	for (var i in Game.scene.buildingsObj) 
		this.drawObject(gl, Game.scene.buildingsObj[i], this.phongShader, [0.8, 0.8, 0.8, 1.0], [0.2, 0.2, 0.2, 1.0]);

  // gl.useProgram(this.uniformShader);
    // for(let i =0; i < this.streetLamps.length; i++){
    //   const MLamp = glMatrix.mat4.fromTranslation(glMatrix.mat4.create(), this.streetLamps[i].position);
    //   this.stack.multiply(MLamp);
    //   this.drawLamp();
    //   this.stack.pop(); 
    // }

	gl.useProgram(null);
  this.stack.pop();
};



Renderer.Display = function () {
  Renderer.drawScene(Renderer.gl);
  window.requestAnimationFrame(Renderer.Display) ;
};


Renderer.setupAndStart = function () {
 /* create the canvas */
	Renderer.canvas = document.getElementById("OUTPUT-CANVAS");
 /* get the webgl context */
	Renderer.gl = Renderer.canvas.getContext("webgl");
  const width = Renderer.canvas.width;
  const height = Renderer.canvas.height
  const ratio = width / height;

  projection_matrix = glMatrix.mat4.perspective(glMatrix.mat4.create(),3.14 / 4, ratio, 1, 500);
  setRotationToDef(eyeVec, upVec);
  /* read the webgl version and log */
	var gl_version = Renderer.gl.getParameter(Renderer.gl.VERSION); 
	log("glversion: " + gl_version);
	var GLSL_version = Renderer.gl.getParameter(Renderer.gl.SHADING_LANGUAGE_VERSION)
	log("glsl  version: "+GLSL_version);

  /* create the matrix stack */
	Renderer.stack = new MatrixStack();
  Renderer.currentCamera = 1;
  Renderer.cameras[Renderer.currentCamera].setToDef();
  Renderer.createLamps();
  /* initialize objects to be rendered */
  Renderer.initializeObjects(Renderer.gl);
  /* create the shader */
  Renderer.uniformShader = new uniformShader(Renderer.gl);
  Renderer.phongShader = new PhongShader(Renderer.gl, Renderer.streetLamps.length+1, 2, 0.1).shader;
  /*
  add listeners for the mouse / keyboard events
  */
  Renderer.canvas.addEventListener('mousemove',on_mouseMove,false);
  Renderer.canvas.addEventListener('keydown',on_keydown,false);
  Renderer.canvas.addEventListener('keyup',on_keyup,false);
  Renderer.canvas.addEventListener('mouseup', on_mouseup, false);
  Renderer.canvas.addEventListener('mousedown', on_mousedown, false);
  Renderer.canvas.addEventListener('mousemove', on_mouseMove, false);
  Renderer.canvas.addEventListener('wheel', on_mouseWheel, false);

  Renderer.Display();
}





const ray_sphere_intersection = (r, radius, dz) => {
  const a = r[0] * r[0] + r[1] * r[1] + r[2] * r[2];
  const b = -2 * dz * r[2];
  const c = dz * dz - radius * radius;
  const dis = b * b - 4 * a * c;

  if(dis > 0){
    const t0 = (-b - Math.sqrt(dis)) / (2 * a);
    const t1 = (-b + Math.sqrt(dis)) / (2 * a);
    const t = Math.min(t0, t1);
    return [true, [t * r[0], t * r[1], t * r[2]]];
  } else {
    return [false, [0, 0, 0]];
  }
}

const ray_from_click = (x, y) => {
  const px = l + (x / 500.0) * (r - l);
  const py = b + ((500 - y) / 500.0) * (t - b);
  const pz = -n;
  return [px, py, pz];
}

const point_on_sphere = (x, y) => {
  const ray = ray_from_click(x, y);
  return ray_sphere_intersection(ray, 5, -7.5);
}

function startMotion (x, y){
  rotating = true;
  lastMousePos = trackballView(x, y);
}

function stopMotion(){
  rotating = false;
  Renderer.car.control_keys["mouse"] = false;

}

function mouseMove(x, y, ctrl){
  if(rotating){
    let dx, dy, dz;
    let trans_factor = 1;
    const curPos = trackballView(x, y);
    dx = curPos[0] - lastMousePos[0];
    dy = curPos[2] - lastMousePos[2];
    dz = curPos[1] - lastMousePos[1];
    if(dx < 0.004 && dz < 0.004)
      trans_factor = 0.1;
    else
      trans_factor = 0.2;
    if(dx || dy || dz){
      if(!ctrl){
        trans_axis[0] = dz;
        trans_axis[1] = 0;
        trans_axis[2] = dx;
        glMatrix.vec3.normalize(trans_axis, trans_axis);
        trans_axis[0] = trans_axis[0]*trans_factor;
        trans_axis[1] = 0;
        trans_axis[2] = trans_axis[2]*trans_factor;
      } else {

      trans_axis[0] = 0;
      trans_axis[1] = -dz;
      trans_axis[2] = 0;
      glMatrix.vec3.normalize(trans_axis, trans_axis);
      }
      lastMousePos[0] = curPos[0];
      lastMousePos[1] = curPos[1];
      lastMousePos[2] = curPos[2];
    }
  }
}

const on_mousedown = (e) => {
  Renderer.car.control_keys["mouse"] = true;
  if(!reset){
    reset++;
  }
  const posM = getMousePos(e, Renderer.gl);
  if(e.altKey){
    start_point = [posM[0], posM[1]];
  }
  const xy = helperXY(e);
  startMotion(xy.x, xy.y);
}



const on_mouseMove = function(e){
  e.preventDefault();
  if(!rotating){
   
    return;
  }
  const xy = helperXY(e);
  const transMat = glMatrix.mat4.create();
  let dx=0, dy =0, dz=0;
  let ox, oy, oz;
  if(e.altKey){
    Renderer.car.control_keys["Alt"] = true;
    const posM = getMousePos(e, Renderer.gl);
    alpha = posM[0]- start_point[0];
    beta = posM[1] - start_point[1];
    start_point[0] = posM[0];
    start_point[1] = posM[1];
    updateView();
    return;
  }

  if(e.ctrlKey){
    mouseMove(xy.x, xy.y, 1);
  } else {

    mouseMove(xy.x, xy.y, 0);

  }

  

  while(true){
    let diffx = Math.abs(trans_axis[0]) - Math.abs(dx);
    let diffy = Math.abs(trans_axis[1]) - Math.abs(dy);
    let diffz = Math.abs(trans_axis[2]) - Math.abs(dz);
    if(diffx <= 0 && diffy <= 0 && diffz <= 0)
    break;
    ox = diffx > 0 ? SMOOTH_FACTOR * trans_axis[0]: 0;
    oy = diffy > 0 ? SMOOTH_FACTOR * trans_axis[1]: 0;
    oz = diffz > 0 ? SMOOTH_FACTOR * trans_axis[2]: 0;
    dx += ox;
    dy += oy;
    dz += oz;
    glMatrix.mat4.fromTranslation(transMat, [ox, oy, oz]);
    glMatrix.mat4.mul(trackball_translate, transMat, trackball_translate);

    glMatrix.mat4.mul(trackball_matrix, trackball_scaling, trackball_translate);

  }

}

const on_mouseup = (e) => {
  stopMotion();
}

const on_mouseWheel = (e) => {
  e.preventDefault();
  
  const xy = helperXY(e);
  let dx, dy, dz;
  const curPos = trackballView(xy.x, xy.y);
  const diffArr = [curPos[0] - lastMousePos[0], curPos[2] - lastMousePos[2], curPos[1] - lastMousePos[1]];
  scaling_factor *= (1+ e.deltaY * 0.0008);
  
  glMatrix.vec3.normalize(diffArr, diffArr);


  glMatrix.mat4.fromScaling(trackball_scaling, [scaling_factor, scaling_factor, scaling_factor]);
  glMatrix.mat4.mul(trackball_matrix, trackball_scaling, trackball_translate);

  

}

const on_keyup = function(e){
	Renderer.car.control_keys[e.key] = false;
  
}
const on_keydown = function(e){
	Renderer.car.control_keys[e.key] = true;
  if(e.key ==='ArrowUp') {
    if(reset){
      // glMatrix.mat4.identity(trackball_matrix);
      glMatrix.mat4.identity(trackball_scaling);
      // glMatrix.mat4.identity(trackball_translate);
      // Renderer.cameras[Renderer.currentCamera].setToDef();

      reset--;
    }
  }
}

window.onload = Renderer.setupAndStart;


window.update_camera = function (value){
  glMatrix.mat4.identity(trackball_matrix);
  glMatrix.mat4.identity(trackball_scaling);
  glMatrix.mat4.identity(trackball_translate);

  Renderer.currentCamera = value;
  Renderer.cameras[value].setToDef();
}

function helperXY(e) {
  const obj = {x: 2*e.clientX/Renderer.canvas.width-1, y: 2*(Renderer.canvas.height-e.clientY)/Renderer.canvas.height-1};
  if(obj.x > 1){
    obj.x =1;
  } else if(obj.x < -1){
    obj.x =-1;
  }
  if(obj.y > 1){
    obj.y =1;
  } else if(obj.y < -1){
    obj.y =-1;
  }
  return obj;
}

function updateView(){
  
  const rotMatY = glMatrix.mat4.create();
  const rotMatX = glMatrix.mat4.create();
  glMatrix.mat4.fromRotation(rotMatY, (alpha/15)*toRad, [0, 1, 0]);
  glMatrix.mat4.fromRotation(rotMatX, (-beta/15)*toRad, [1, 0, 0]);
  glMatrix.mat4.mul(trackball_rotation, rotMatY, trackball_rotation);
  glMatrix.mat4.mul(trackball_rotation, trackball_rotation, rotMatX);
  alpha = 0;
  beta = 0;
}

function rotateMulStack(rotateMatrix, stack){
  let matrixToMul = stack.matrix;
  stack.push();
  stack.loadIdentity();
  rotateMul(rotateMatrix, matrixToMul);
  stack.multiply(matrixToMul);
}

function rotateMul(rotateMatrix, matrixToMul){
  let lastPos = [matrixToMul[12], matrixToMul[13], matrixToMul[14], 1];
  matrixToMul[12] = 0, matrixToMul[13] = 0, matrixToMul[14] = 0, matrixToMul[15] = 1;
  glMatrix.mat4.mul(matrixToMul, rotateMatrix, matrixToMul);
  matrixToMul[12] = lastPos[0], matrixToMul[13] = lastPos[1], matrixToMul[14] = lastPos[2], matrixToMul[15] = lastPos[3];
}

function setRotationToDef(eyeVecArg, upVecArg){
  glMatrix.mat4.identity(trackball_rotation);
  trackball_rotation[8] = eyeVecArg[0];
  trackball_rotation[9] = eyeVecArg[1];
  trackball_rotation[10] = eyeVecArg[2];
  trackball_rotation[11] = eyeVecArg[3];

  trackball_rotation[4] = upVecArg[0];
  trackball_rotation[5] = upVecArg[1];
  trackball_rotation[6] = upVecArg[2];
  trackball_rotation[7] = upVecArg[3];

  
  
}

 function getMousePos (e, gl) {
  const r = gl.canvas.getBoundingClientRect();
  const w = gl.canvas.width;
  const h = gl.canvas.height;
  const x = e.clientX - r.left;
  const y = h - 1 - (e.clientY - r.top);
  const outside = ((x < 0) || (x >= w) || (y < 0) || (y >= h));
  return [x, y, outside];
}

export function matTo33(m){
  return glMatrix.mat3.set( glMatrix.mat3.create(),
  m[ 0], m[ 1], m[ 2],
  m[ 4], m[ 5], m[ 6],
  m[ 8], m[ 9], m[10]
);

}