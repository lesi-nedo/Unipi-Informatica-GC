'use strict';
import { Renderer } from "../renderer_00/main_00.js";
import { PhongShader } from "../renderer_01/shaderPhong.js";
import { ShadowMapShader } from './shadowMapShader.js';
import { rotateMulStack, trackball_matrix, matTo33 } from "../renderer_00/main_00.js";
import { ShadowPhongShader } from "./shadowShader.js";
import { BlurShader } from "./blurShader.js";

const projection_matrix = glMatrix.mat4.create();
const toView = glMatrix.mat4.create();
const viewMatrixLight = glMatrix.mat4.create();
let rotAngleWheelsRad = 0;
let MS = [];
let MS_SHADOW =[];
let MS_LAMP_SHADOW = [];


class Texture {
    #frameBuffer;
    #texture;
    #colorTexture;
    constructor(frameBuffer, texture, colorTexture){
        this.#frameBuffer = frameBuffer;
        this.#texture = texture;
        this.#colorTexture = colorTexture;
    }

    get texture(){
        return this.#texture;
    }

    get frameBuffer(){
        return this.#frameBuffer;
    }

    get colorTexture(){
        return this.#colorTexture;
    }
}

Renderer.setupAndStart = function (){
   
    Renderer.canvas = document.getElementById("OUTPUT-CANVAS");
    Renderer.gl = Renderer.canvas.getContext("webgl");
    if(!Renderer.gl){
        throw new Error("Did not get the context");
    }

    const ext = Renderer.gl.getExtension('WEBGL_depth_texture');
    Renderer.gl.getExtension("EXT_frag_depth");
    Renderer.gl.getExtension('OES_standard_derivatives');
    Renderer.gl.getExtension('EXT_shader_texture_lod');
    Renderer.ext = Renderer.gl.getExtension('WEBGL_color_buffer_float');
    Renderer.gl.getExtension('OES_texture_float');
    Renderer.gl.getExtension('OES_texture_float_linear');




    if(!ext){
        return alert('need WEBGL_depth_texture extension');
    }

    const width =  Renderer.canvas.width;
    const height =  Renderer.canvas.height;
    const ratio = width / height;

    const gl_version = Renderer.gl.getParameter(Renderer.gl.VERSION);
    log("glVersion: " + gl_version);
    const GLSL_version = Renderer.gl.getParameter(Renderer.gl.SHADING_LANGUAGE_VERSION);
    log(`GLSLVersion: ${GLSL_version}`);

    Renderer.stack = new MatrixStack();
    Renderer.currentCamera = 1;
    Renderer.cameras[Renderer.currentCamera].setToDef();
    Renderer.lightsGeometryViewSpace = new Array();
    Renderer.lightsColor = new Array();

    glMatrix.mat4.perspective(projection_matrix, 3.14/4, ratio, 1, 500);
    Renderer.sunDir = [-2.4,-1,-0,0.0];
    
    Renderer.createLamps();
    Renderer.initializeObjects(Renderer.gl);
    
    Renderer.enlargeBox(Game.scene.bbox, 1.05);

    Renderer.roadTex = Renderer.createTexture(Renderer.gl, '../common/textures/street4.png');
    Renderer.facade = Renderer.createTexture(Renderer.gl, '../common/textures/facade3.jpg');
    Renderer.roof = Renderer.createTexture(Renderer.gl, '../common/textures/roof.jpg');
    Renderer.headlight = Renderer.createTexture(Renderer.gl, '../common/textures/headlight.png');

    Renderer.gl.enable(Renderer.gl.DEPTH_TEST);
    Renderer.gl.depthFunc(Renderer.gl.LESS);

    Renderer.shadowMap = Renderer.setTextureFrameBuff(Renderer.gl, false, 4096, 4096);
    Renderer.blurFBO = Renderer.blurFBOFunc(Renderer.gl, 4096, 4096);
    Renderer.uniformShader = new uniformShader(Renderer.gl);
    Renderer.phongShader = new PhongShader(Renderer.gl, Renderer.streetLamps.length+1, 2, 0.1).shader;
    Renderer.shadowMapShader = new ShadowMapShader(Renderer.gl).shader;
    Renderer.shadowShader = new ShadowPhongShader(Renderer.gl, Renderer.streetLamps.length+1, 2).shader;
    Renderer.blurShader = new BlurShader(Renderer.gl).shader;

    Renderer.gl.uniform1i(Renderer.shadowShader.uBuildingsIntegerLocation, false, 0);
    Renderer.drawScene(Renderer.gl);
    Renderer.addListeners();
    Renderer.Display();
}

Renderer.createTexture = function (gl, data) {
    const texture = gl.createTexture();
    texture.image = new Image();
    texture.image.onload = function (){
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.bindTexture(gl.TEXTURE_2D, null);
    }
    texture.image.src = data;
    return texture;
}

window.onload = Renderer.setupAndStart;


Renderer.setTextureFrameBuff = function (gl, mipMap, w, h) {
    const texture =  new Texture(gl.createFramebuffer(), gl.createTexture(), gl.createTexture());
    
    if(w){
        texture.frameBuffer.width = w;
    } else {
        texture.frameBuffer.width = 512;
    }
    if(h){
        texture.frameBuffer.height = h;
    } else {
        texture.frameBuffer.height = 512;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, texture.frameBuffer.width, texture.frameBuffer.height, 0,gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
   
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindTexture(gl.TEXTURE_2D, texture.colorTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texture.frameBuffer.width, texture.frameBuffer.height, 0, gl.RGBA, gl.FLOAT, null);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, texture.frameBuffer);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture.texture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.colorTexture, 0);
    
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if(status !== gl.FRAMEBUFFER_COMPLETE){
        throw new Error(`framebuffer incomplete #1: `)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return texture;
    
}

Renderer.blurFBOFunc = function(gl, width, height){
    const texture = new Texture(gl.createFramebuffer(), gl.createTexture(), gl.createTexture());
    gl.bindFramebuffer(gl.FRAMEBUFFER, texture.frameBuffer);
    texture.frameBuffer.width = width;
    texture.frameBuffer.height = height;
    gl.bindTexture(gl.TEXTURE_2D, texture.colorTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);

    const renderBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.colorTexture, 0)
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if(status !== gl.FRAMEBUFFER_COMPLETE){
        throw new Error(`framebuffer incomplete #2: `)
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return texture;
}


Renderer.drawScene = function (gl) {
    const width = gl.canvas.width;
    const height = gl.canvas.height;
    const stack = Renderer.stack;
    const bbox = Game.scene.bbox;
    const eye = glMatrix.vec3.scale(glMatrix.vec3.create(), this.sunDir, 0.0);
    const target = glMatrix.vec3.add(glMatrix.vec3.create(), eye, this.sunDir);
    glMatrix.mat4.lookAt(viewMatrixLight, eye, target, [0.0, 1.0, 0.0]);
    const light = glMatrix.vec4.transformMat4(glMatrix.vec4.create(), [this.sunDir[0], this.sunDir[1], this.sunDir[2], 0.0], viewMatrixLight);
    const newBbox = this.findMinimumViewWindow(bbox, viewMatrixLight);
    const projMatrix = glMatrix.mat4.ortho(glMatrix.mat4.create(), newBbox[0], newBbox[3], newBbox[1], newBbox[4], -newBbox[5], -newBbox[2]);
    this.shadowMatrix = glMatrix.mat4.mul(glMatrix.mat4.create(), projMatrix, viewMatrixLight);
    
    
   

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowMap.frameBuffer);
    gl.viewport(0, 0, this.shadowMap.frameBuffer.width, this.shadowMap.frameBuffer.height);
    gl.clearColor(0.4, 0.6, 0.8, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2, 3);

    this.stack.loadIdentity();
    this.stack.multiply(this.shadowMatrix);
    
    
    gl.useProgram(this.shadowMapShader);
    gl.uniformMatrix4fv(this.shadowMapShader.uShadowMatrixLocation, false, this.stack.matrix);
    gl.uniformMatrix4fv(this.shadowShader.uViewWorldMatrixLocation, false, viewMatrixLight);
    gl.uniform3fv(this.shadowMapShader.uLightPosVec3Location, [light[0], light[1], light[2]]);
    gl.uniform1f(this.shadowMapShader.uFarPlaneFloatLocation, newBbox[2]);
    gl.uniform1f(this.shadowMapShader.uNearPlaneFloatLocation, newBbox[5]);

    this.drawShadowCasters(gl);

    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO.frameBuffer);
    // gl.clearColor(0.4, 0.6, 0.8, 1.0);
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // gl.viewport(0, 0, this.blurFBO.frameBuffer.width, this.blurFBO.frameBuffer.height);
    // gl.useProgram(this.blurShader);
    
    // gl.uniformMatrix4fv(this.blurShader.uShadowMatrixLocation, false, this.stack.matrix);
    // gl.uniform1i(this.blurShader.uHorizontallyBoolLocation, 1);
    // gl.uniform1i(this.blurShader.uShaderMapLocation, 0);
    // gl.activeTexture(gl.TEXTURE0);
    // gl.bindTexture(gl.TEXTURE_2D, this.shadowMap.colorTexture);

    // this.drawObject(gl, this.texBlurShaderObj, this.blurShader);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // gl.bindTexture(gl.TEXTURE_2D, null);

    
    // gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowMap.frameBuffer);
    // gl.viewport(0, 0, this.shadowMap.frameBuffer.width, this.shadowMap.frameBuffer.height);
    // gl.clearColor(0.4, 0.6, 0.8, 1.0);
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // gl.uniformMatrix4fv(this.blurShader.uShadowMatrixLocation, false, this.stack.matrix);
    // gl.uniform1i(this.blurShader.uShaderMapLocation, 0);
    // gl.uniform1i(this.blurShader.uHorizontallyBoolLocation, 0);

    // gl.activeTexture(gl.TEXTURE0);
    // gl.bindTexture(gl.TEXTURE_2D, this.blurFBO.colorTexture);
    // this.drawObject(gl, this.texBlurShaderObj, this.blurShader);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // gl.bindTexture(gl.TEXTURE_2D, null);
    
    gl.clearColor(0.4, 0.6, 0.8, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.cullFace(gl.BACK);
    
    this.stack.pop();
    this.stack.loadIdentity();
    this.cameras[this.currentCamera].update(this.car.frame);

    this.drawEverything(gl, [newBbox[5], newBbox[2]]);

} 

Renderer.getHeadlightMatrix = function (eyeVec, targetVec, upVec) {
    const eye = glMatrix.vec3.create();
    const target = glMatrix.vec3.create();
    const up  = glMatrix.vec4.create();
    glMatrix.vec3.transformMat4(eye, eyeVec, glMatrix.mat4.create());
    glMatrix.vec3.transformMat4(target, targetVec, glMatrix.mat4.create());
    glMatrix.vec4.transformMat4(up, upVec, glMatrix.mat4.create());
    
    return glMatrix.mat4.lookAt(glMatrix.mat4.create(), eye, target, up)
}

Renderer.drawEverything = function (gl, nearFarPlane){
    const stack = this.stack;
    const view_transform = glMatrix.mat4.create();
    
    // this.cameras[this.currentCamera].matrix()
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    glMatrix.mat4.copy(view_transform, this.cameras[this.currentCamera].matrix());
    gl.useProgram(this.shadowShader);
    gl.uniformMatrix4fv(this.shadowShader.uProjectionMatrixLocation, false, projection_matrix);
    gl.uniformMatrix4fv(this.shadowShader.uHeadlightLeftMatrixLocation, false, glMatrix.mat4.create());
    gl.uniformMatrix4fv(this.shadowShader.uHeadlightRightMatrixLocation, false, glMatrix.mat4.create());
    gl.uniform1f(this.shadowShader.uFarPlaneFloatLocation, nearFarPlane[1]);
    gl.uniform1f(this.shadowShader.uNearPlaneFloatLocation, nearFarPlane[0]);
    gl.uniform1i(this.shadowShader.uShadowMapLocation, 0);
    gl.uniform1i(this.shadowShader.uTextureLocation, 1);
    gl.uniform1i(this.shadowShader.uHeadlightLocation, 2);

    gl.uniform1i(this.shadowShader.uTexIntLocation, 0);
    gl.uniformMatrix4fv(this.shadowShader.uShadowMatrixLocation, false, this.shadowMatrix);
    gl.uniformMatrix4fv(this.shadowShader.uModelMatrixLocation, false, trackball_matrix);
    glMatrix.mat4.mul(toView, view_transform, trackball_matrix);
    gl.uniformMatrix4fv(this.shadowShader.uModelViewMatrixLocation, false, toView);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowMap.colorTexture);
    
    this.drawLighting(toView, this.shadowShader);  

    gl.uniformMatrix3fv(this.shadowShader.uViewNormalMatrixLocation, false, matTo33(toView));


    


    
    
    

   
    this.drawWire ={
        viewMatrix: view_transform,
        trackballMatrix: trackball_matrix,
        modelMatrix: glMatrix.mat4.create(),
        projectionMatrix: projection_matrix
    }
    gl.uniform1i(this.shadowShader.uTexIntLocation, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.headlight);

    this.stack.push();
    this.stack.multiply(this.car.frame);
    Renderer.drawCar(gl);
    this.stack.pop();
    gl.uniform1i(this.shadowShader.uTexIntLocation, 0);

        
    this.drawWire.modelMatrix = glMatrix.mat4.create(),
    gl.uniformMatrix3fv(this.shadowShader.uViewNormalMatrixLocation, false, matTo33(toView));
    gl.uniformMatrix4fv(this.shadowShader.uModelViewMatrixLocation, false, toView);

    gl.uniform1i(this.shadowShader.uTexIntLocation, 1);
    this.drawObject(gl, Game.scene.groundObj, this.shadowShader, [0.3, 0.7, 0.2, 1.0], [0.0, 0, 0, 1.0]);
    gl.uniform1i(this.shadowShader.uTexIntLocation, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.roadTex);
 	this.drawObject(gl, Game.scene.trackObj, this.shadowShader, [0.9, 0.8, 0.7, 1.0], [1.0, 0, 0, 1.0]);
    
    gl.uniform1i(this.shadowShader.uBuildingsIntegerLocation, false, 1);
	for (var i in Game.scene.buildingsObj){
        gl.bindTexture(gl.TEXTURE_2D, this.facade);
   		this.drawObject(gl, Game.scene.buildingsObjTex[i], this.shadowShader, [0.8, 0.8, 0.8, 1.0], [0.2, 0.2, 0.2, 1.0]);
        gl.bindTexture(gl.TEXTURE_2D, this.roof);   
        this.drawObject(gl, Game.scene.buildingsObjTex[i].roof, this.shadowShader, [0.8, 0.8, 0.8, 1.0], [0.2, 0.2, 0.2, 1.0]);

    }
    gl.uniform1i(this.shadowShader.uBuildingsIntegerLocation, false, 0);

   
    gl.useProgram(this.uniformShader);
    gl.uniformMatrix4fv(this.uniformShader.uProjectionMatrixLocation, false, projection_matrix);
    gl.uniformMatrix4fv(this.uniformShader.uViewMatrixLocation, false, view_transform);
    gl.uniformMatrix4fv(this.uniformShader.uTrackballMatrixLocation, false, trackball_matrix);
    for(let i =0; i < this.streetLamps.length; i++){
    stack.push();
    const MLamp = glMatrix.mat4.fromTranslation(glMatrix.mat4.create(), [this.streetLamps[i].position[0], this.streetLamps[i].position[1], this.streetLamps[i].position[2], this.streetLamps[i].position[3]]);
    this.stack.multiply(MLamp);

    this.drawLamp(this.uniformShader, MS_LAMP_SHADOW);

    }
        
    gl.bindTexture(gl.TEXTURE_2D, null);
	gl.useProgram(null);
}

Renderer.drawLampDepth = function (shader){
    this.stack.push();
    const M = glMatrix.mat4.fromTranslation(glMatrix.mat4.create(), [0, 2.2, 0]);
    this.stack.multiply(M);
    const M1 = glMatrix.mat4.fromScaling(glMatrix.mat4.create(), [0.2, 0.1, 0.2]);
    this.stack.multiply(M1);
    MS_LAMP_SHADOW[0] = this.stack.matrix;
    this.gl.uniformMatrix4fv(shader.uShadowMatrixLocation, false, this.stack.matrix);
    this.drawObject(this.gl, this.cube, shader);
    this.stack.pop();
    this.stack.push();
    const M_scal = glMatrix.mat4.fromScaling(glMatrix.mat4.create(), [0.1, 1.1, 0.10]);
    this.stack.multiply(M_scal);
    MS_LAMP_SHADOW[1] = this.stack.matrix;
    this.gl.uniformMatrix4fv(shader.uShadowMatrixLocation, false, this.stack.matrix);
    this.drawObject(this.gl, this.cylinder, shader, [0.6, 0.23, 0.12, 1]);
    this.stack.pop();
};

Renderer.drawShadowCasters = function (gl) {
    this.stack.push();
    this.stack.multiply(this.car.frame);
    this.drawDepthCar(gl);
    this.stack.pop();
    MS_LAMP_SHADOW = new Array();
    this.gl.uniformMatrix4fv(this.shadowMapShader.uShadowMatrixLocation, false, this.stack.matrix);
    for(let  b of Game.scene.buildingsObjTex ){
        this.drawObject(gl, b, this.shadowMapShader);
        this.drawObject(gl, b.roof, this.shadowMapShader);

    }

    for(let i= 0; i < this.streetLamps.length; i++){
        this.stack.push();
        const MLamp = glMatrix.mat4.fromTranslation(glMatrix.mat4.create(), [this.streetLamps[i].position[0], this.streetLamps[i].position[1], this.streetLamps[i].position[2]]);
        this.stack.multiply(MLamp);
        this.drawLampDepth(this.shadowMapShader);
        this.stack.pop();
    }

    
    

    
}

Renderer.drawDepthCar = function (gl){
    const M                 = glMatrix.mat4.create();
    const rotate_transform  = glMatrix.mat4.create();
    const translate_matrix  = glMatrix.mat4.create();
    const scale_matrix      = glMatrix.mat4.create();
    MS = new Array();
    MS_SHADOW = new Array();
    glMatrix.mat4.fromTranslation(translate_matrix,[0,1,1]);
    glMatrix.mat4.fromScaling(scale_matrix,[0.7,0.25,1]);
    glMatrix.mat4.mul(M,scale_matrix,translate_matrix);
    glMatrix.mat4.fromRotation(rotate_transform,-0.1,[1,0,0]);
    glMatrix.mat4.mul(M,rotate_transform,M);
    glMatrix.mat4.fromTranslation(translate_matrix,[0,0.1,-1]);
    glMatrix.mat4.mul(M,translate_matrix,M);

    glMatrix.mat4.fromScaling(scale_matrix,[1.1,0.9,1.0]);

    this.stack.push();
    this.stack.multiply(M);
    this.stack.multiply(scale_matrix);

    MS[0] = glMatrix.mat4.copy(glMatrix.mat4.create(), M);
    MS_SHADOW[0] = this.stack.matrix;

    gl.uniformMatrix4fv(this.shadowMapShader.uShadowMatrixLocation, false, this.stack.matrix);
    
    this.drawObject(gl, this.cube,  this.shadowMapShader);
    Renderer.stack.pop();

    const Mw                 = glMatrix.mat4.create();
    /* draw the wheels */
    glMatrix.mat4.fromRotation(rotate_transform,3.14/2.0,[0,0,1]);
    glMatrix.mat4.fromTranslation(translate_matrix,[1,0,0]);
    glMatrix.mat4.mul(Mw,translate_matrix,rotate_transform);
    
    glMatrix.mat4.fromScaling(scale_matrix,[0.1,0.2,0.2]);
    glMatrix.mat4.mul(Mw,scale_matrix,Mw);

     
    glMatrix.mat4.identity(M);


    glMatrix.mat4.fromTranslation(translate_matrix,[-0.8,0.2,-0.7]);
    glMatrix.mat4.mul(M,translate_matrix,Mw);
    this.stack.push();
    glMatrix.mat4.fromScaling(scale_matrix,[1.0,1.4,1.0]);

    this.stack.multiply(M);
    this.stack.multiply(scale_matrix);
    MS[1] = glMatrix.mat4.copy(glMatrix.mat4.create(), M);
    MS_SHADOW[1] = this.stack.matrix;


    gl.uniformMatrix4fv(this.shadowMapShader.uShadowMatrixLocation, false, this.stack.matrix);
  
    this.drawObject(gl, this.cylinder, this.shadowMapShader);
    this.stack.pop();

    glMatrix.mat4.fromTranslation(translate_matrix,[0.8,0.2,-0.7]);
    glMatrix.mat4.mul(M,translate_matrix,Mw);

    this.stack.push();
    this.stack.multiply(M);
    this.stack.multiply(scale_matrix);

    MS[2] = glMatrix.mat4.copy(glMatrix.mat4.create(), M);
    MS_SHADOW[2] = this.stack.matrix;


    gl.uniformMatrix4fv(this.shadowMapShader.uShadowMatrixLocation, false, this.stack.matrix);
  
    this.drawObject(gl, this.cylinder,  this.shadowMapShader);
    this.stack.pop();

    glMatrix.mat4.fromScaling(scale_matrix,[1,1.5,1.5]);;
    glMatrix.mat4.mul(Mw,scale_matrix,Mw);
    
    glMatrix.mat4.fromTranslation(translate_matrix,[0.8,0.3,0.7]);
    glMatrix.mat4.mul(M,translate_matrix,Mw);
  
    this.stack.push();
    this.stack.multiply(M);
    glMatrix.mat4.fromScaling(scale_matrix,[1.0,1.4,1.0]);
    this.stack.multiply(scale_matrix);

    MS[3] = glMatrix.mat4.copy(glMatrix.mat4.create(), M);
    MS_SHADOW[3] = this.stack.matrix;

    gl.uniformMatrix4fv(this.shadowMapShader.uShadowMatrixLocation, false, this.stack.matrix);

    this.drawObject(gl,  this.cylinder, this.shadowMapShader);
    this.stack.pop();

    glMatrix.mat4.fromTranslation(translate_matrix,[-0.8,0.3,0.7]);
    glMatrix.mat4.mul(M,translate_matrix,Mw);
  
    this.stack.push();
    this.stack.multiply(M);
    this.stack.multiply(scale_matrix);

    MS[4] = glMatrix.mat4.copy(glMatrix.mat4.create(), M);
    MS_SHADOW[4] = this.stack.matrix;

    gl.uniformMatrix4fv(this.shadowMapShader.uShadowMatrixLocation, false, this.stack.matrix);
  
    this.drawObject(gl, this.cylinder, this.shadowMapShader);
    this.stack.pop();


};

Renderer.drawCar = function (gl) {
    const M                 = glMatrix.mat4.create();
    const translate_matrix  = glMatrix.mat4.create();
    const modelMatrix      = glMatrix.mat4.create();
    const viewModelMatrix = glMatrix.mat4.create();
    const normalMatrix = glMatrix.mat4.create();
    let eyeVec = [0.0 , -0.7, 5.5, 0.0];
    let targetVec= [0.0, 1.0, 1.0];
    let upVec = [0.0,-1.0, 0, 0.0];  
    const headlightMatrixRight = this.getHeadlightMatrix(eyeVec, targetVec, upVec);
    glMatrix.mat4.translate(headlightMatrixRight, headlightMatrixRight, [0, -3.0, 4.3]);

    gl.useProgram(this.shadowShader);

    let rotRad = this.car.wheelsAngle*10;
    if(rotRad > 0.3){
      rotRad = 0.3;
    } else if(rotRad < -0.3){
      rotRad = -0.3;
    }

    Renderer.stack.push();
    Renderer.stack.multiply(MS[0]);
    gl.uniformMatrix4fv(this.shadowShader.uShadowMatrixLocation, false, MS_SHADOW[0]);
    glMatrix.mat4.mul(viewModelMatrix, toView, this.stack.matrix);
    glMatrix.mat4.mul(modelMatrix, trackball_matrix, this.stack.matrix);
    glMatrix.mat4.transpose(normalMatrix, glMatrix.mat4.invert(normalMatrix, viewModelMatrix))
    gl.uniformMatrix4fv(this.shadowShader.uModelMatrixLocation, false, modelMatrix);
    this.gl.uniformMatrix3fv(this.shadowShader.uViewNormalMatrixLocation, false, matTo33(normalMatrix));
    gl.uniformMatrix4fv(this.shadowShader.uModelViewMatrixLocation, false, viewModelMatrix);
    gl.uniform1i(this.shadowShader.uHeadlightIntLocation, 2);
    glMatrix.mat4.scale( MS[0],  MS[0], [3,3,3]);
    glMatrix.mat4.mul(headlightMatrixRight,headlightMatrixRight, MS[0]);
    gl.uniformMatrix4fv(this.shadowShader.uHeadlightRightMatrixLocation, false, headlightMatrixRight);
    

    this.drawWire.modelMatrix = this.stack.matrix;
    this.drawObject(gl, this.cube,  this.shadowShader ,[0.2,0.6,0.7,1.0],[0.2, 0.2, 0.2, 1.0]);
    Renderer.stack.pop();
    gl.uniform1i(this.shadowShader.uHeadlightIntLocation, 0);



    let radius = 0.2;
    rotAngleWheelsRad = (this.car.rotationWheels/radius);



    this.stack.push();
    Renderer.stack.multiply(MS[1]);
    gl.uniformMatrix4fv(this.shadowShader.uShadowMatrixLocation, false, MS_SHADOW[1]);
    let rotMatY = glMatrix.mat4.fromYRotation(glMatrix.mat4.create(), rotRad);
    let rotMatYAngular = glMatrix.mat4.fromYRotation(glMatrix.mat4.create(), rotAngleWheelsRad);
    Renderer.stack.multiply(rotMatYAngular);

    rotateMulStack(rotMatY, Renderer.stack);
    glMatrix.mat4.mul(viewModelMatrix, toView, this.stack.matrix);
    glMatrix.mat4.mul(modelMatrix, trackball_matrix, this.stack.matrix);

    glMatrix.mat4.transpose(normalMatrix, glMatrix.mat4.invert(normalMatrix, viewModelMatrix))
    this.gl.uniformMatrix3fv(this.shadowShader.uViewNormalMatrixLocation, false, matTo33(normalMatrix));
    gl.uniformMatrix4fv(this.shadowShader.uModelMatrixLocation, false, modelMatrix);
    gl.uniformMatrix4fv(this.shadowShader.uModelViewMatrixLocation, false, viewModelMatrix);
    this.drawWire.modelMatrix = this.stack.matrix;

    this.drawObject(gl, this.cylinder, this.shadowShader,[1.0,0.6,0.5,1.0],[0.2, 0.2, 0.2, 1.0]);
    Renderer.stack.pop();


    this.stack.push();
    Renderer.stack.multiply(MS[2]);
    
    Renderer.stack.multiply(rotMatYAngular);
    rotateMulStack(rotMatY, Renderer.stack);
    glMatrix.mat4.mul(viewModelMatrix, toView, this.stack.matrix);
    glMatrix.mat4.mul(modelMatrix, trackball_matrix, this.stack.matrix);

    glMatrix.mat4.transpose(normalMatrix, glMatrix.mat4.invert(normalMatrix, viewModelMatrix))
    this.gl.uniformMatrix3fv(this.shadowShader.uViewNormalMatrixLocation, false, matTo33(normalMatrix));
    gl.uniformMatrix4fv(this.shadowShader.uModelMatrixLocation, false, modelMatrix);
    gl.uniformMatrix4fv(this.shadowShader.uModelViewMatrixLocation, false, viewModelMatrix);
    gl.uniformMatrix4fv(this.shadowShader.uShadowMatrixLocation, false, MS_SHADOW[2]);

    this.drawWire.modelMatrix = this.stack.matrix;

    this.drawObject(gl, this.cylinder,  this.shadowShader, [1.0,0.6,0.5,1.0],[0.2, 0.2, 0.2, 1.0]);
    Renderer.stack.pop();

  
    Renderer.stack.push();
    Renderer.stack.multiply(MS[3]);
    Renderer.stack.multiply(rotMatYAngular);

    glMatrix.mat4.mul(viewModelMatrix, toView, this.stack.matrix);
    glMatrix.mat4.mul(modelMatrix, trackball_matrix, this.stack.matrix);

    glMatrix.mat4.transpose(normalMatrix, glMatrix.mat4.invert(normalMatrix, viewModelMatrix))
    this.gl.uniformMatrix3fv(this.shadowShader.uViewNormalMatrixLocation, false, matTo33(normalMatrix));
    gl.uniformMatrix4fv(this.shadowShader.uModelMatrixLocation, false, modelMatrix);
    gl.uniformMatrix4fv(this.shadowShader.uModelViewMatrixLocation, false, viewModelMatrix);
    gl.uniformMatrix4fv(this.shadowShader.uShadowMatrixLocation, false, MS_SHADOW[3]);
    this.drawWire.modelMatrix = this.stack.matrix;

    this.drawObject(gl,  this.cylinder, this.shadowShader, [1.0,0.6,0.5,1.0],[0.2, 0.2, 0.2, 1.0]);
    Renderer.stack.pop();
  
    Renderer.stack.push();
    Renderer.stack.multiply(MS[4]);
    Renderer.stack.multiply(rotMatYAngular);

    glMatrix.mat4.mul(viewModelMatrix, toView, this.stack.matrix);
    glMatrix.mat4.mul(modelMatrix, trackball_matrix, this.stack.matrix);

    glMatrix.mat4.transpose(normalMatrix, glMatrix.mat4.invert(normalMatrix, viewModelMatrix))
    this.gl.uniformMatrix3fv(this.shadowShader.uViewNormalMatrixLocation, false, matTo33(normalMatrix));
    gl.uniformMatrix4fv(this.shadowShader.uModelMatrixLocation, false, modelMatrix);
    gl.uniformMatrix4fv(this.shadowShader.uModelViewMatrixLocation, false, viewModelMatrix);
    gl.uniformMatrix4fv(this.shadowShader.uShadowMatrixLocation, false, MS_SHADOW[4]);
    this.drawWire.modelMatrix = this.stack.matrix;

    this.drawObject(gl, this.cylinder, this.shadowShader, [1.0,0.6,0.5,1.0],[0.2, 0.2, 0.2, 1.0]);
    Renderer.stack.pop();
    gl.uniformMatrix4fv(this.shadowShader.uShadowMatrixLocation, false, this.shadowMatrix);
};




Renderer.drawObject = function(gl, obj, shader, fillColor, drawWire){
    gl.useProgram(shader);
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
    gl.enableVertexAttribArray(shader.aPositionIndex);
    gl.vertexAttribPointer(shader.aPositionIndex, 3, gl.FLOAT, false, 0, 0);

    if(shader.aNormalIndex && obj.normalBuffer){
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
        gl.enableVertexAttribArray(shader.aNormalIndex);
        gl.vertexAttribPointer(shader.aNormalIndex, 3, gl.FLOAT, false, 0, 0);
    }
    if(shader.aTexCoordIndex && obj.texCoordBuffer){
        // console.log(obj);
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.texCoordBuffer);
        gl.enableVertexAttribArray(shader.aTexCoordIndex);
        gl.vertexAttribPointer(shader.aTexCoordIndex, 2, gl.FLOAT,false, 0, 0);
    }

    if(fillColor && shader.uColorLocation){
        gl.uniform4fv(shader.uColorLocation, fillColor);
    }

    

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferTriangles);
    gl.drawElements(gl.TRIANGLES, obj.triangleIndices.length, gl.UNSIGNED_SHORT, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    if(drawWire){
        if(!this.drawWire){
            throw new Error('add an object with name: \'drawWire\' to the Renderer object with matrixes: viewMatrix, modelMatrix, trackballMatrix, projectionMatrix');
        }
        gl.useProgram(this.uniformShader);
        gl.uniformMatrix4fv(this.uniformShader.uProjectionMatrixLocation, false, this.drawWire.projectionMatrix);
        gl.uniformMatrix4fv(this.uniformShader.uModelMatrixLocation, false, this.drawWire.modelMatrix);
        gl.uniformMatrix4fv(this.uniformShader.uTrackballMatrixLocation, false, this.drawWire.trackballMatrix);
        gl.uniformMatrix4fv(this.uniformShader.uViewMatrixLocation, false, this.drawWire.viewMatrix);

        gl.uniform4fv(this.uniformShader.uColorLocation, [0, 0, 1, 1]);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferEdges);
        gl.drawElements(gl.LINES, obj.numTriangles * 4, gl.UNSIGNED_SHORT, 0);
        gl.useProgram(shader);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.disableVertexAttribArray(shader.aPositionIndex);
    gl.disableVertexAttribArray(shader.aNormalIndex);
    gl.disableVertexAttribArray(shader.aTexCoordIndex);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

Renderer.createObjectBuffers = function (gl, obj, createNormalBuffer, texCoordBuffer){
    obj.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, obj.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    if(createNormalBuffer){
        obj.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, obj.normals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    if(texCoordBuffer){
        obj.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, obj.texCoords, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    obj.indexBufferTriangles = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferTriangles);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, obj.triangleIndices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // create edges
    const edges = new Uint16Array(obj.numTriangles * 4);
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
        b=0;
        c=0;
        d=1;
    } else if(obj.name === 'Body_Normals'){
        a=0;
        b=2;
        c=0;
        d=1;
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

Renderer.initializeObjects = function (gl) {
    Game.setScene(scene_0);
    // this.sunDir =Game.scene.weather.sunLightDirection;

    this.texBlurShaderObj = {}
    this.texBlurShaderObj.vertices = new Float32Array([-1.0,  1.0, 0.0,  
                                                       -1.0, -1.0, 0.0, 
                                                        1.0,  1.0, 0.0, 
                                                        1.0, -1.0, 0.0]);
    this.texBlurShaderObj.texCoords = new Float32Array([1.0,1.0, 1.0,0.0, 0.0,0.0, 0.0,1.0]);
    this.texBlurShaderObj.triangleIndices = new Uint16Array([2,3,1, 2, 1, 0]);
    this.texBlurShaderObj.numTriangles = 2;
    this.texBlurShaderObj.numVertices = 4;
  
    this.createObjectBuffers(gl,this.texBlurShaderObj, 0, 1);


    this.car = Game.addCar("mycar");
    this.cube = new Cube(10);
    this.cube.name = "Body";
    ComputeNormals(this.cube);
    this.createObjectBuffers(gl,this.cube, 1);
    
    this.cylinder = new Cylinder(10);
    this.cylinder.name = 'Wheel';
  
    ComputeNormals(this.cylinder);
    this.createObjectBuffers(gl,this.cylinder, 1 );
  
    ComputeNormals(Game.scene.trackObj);
    Renderer.createObjectBuffers(gl,Game.scene.trackObj, 1, 1);
    Game.scene.groundObj.name = "Ground";
    ComputeNormals(Game.scene.groundObj);
    Renderer.createObjectBuffers(gl,Game.scene.groundObj, 1);
    


    for (var i = 0; i < Game.scene.buildings.length; ++i){
      ComputeNormals(Game.scene.buildingsObjTex[i]);
      Renderer.createObjectBuffers(gl,Game.scene.buildingsObjTex[i], 1, 1);
      ComputeNormals(Game.scene.buildingsObjTex[i].roof);
      Renderer.createObjectBuffers(gl,Game.scene.buildingsObjTex[i].roof, 1, 1);

    }
    Game.scene.buildingsObj[0].vertices[13] = 20;
    Game.scene.buildingsObj[0].vertices[16] = 20;
  };
  

Renderer.findMinimumViewWindow = function (bbox, projMatrix){
    let bbox_vs = [];
    let p = glMatrix.vec4.transformMat4(glMatrix.vec4.create(), [bbox[0], bbox[1], bbox[2], 1.0], projMatrix);

    glMatrix.vec4.div(p, p, [p[3], p[3], p[3], p[3]]);
    bbox_vs = [p[0], p[1], p[2], p[0], p[1], p[2]];

    glMatrix.vec4.transformMat4(p, [bbox[3], bbox[1], bbox[2], 1.0], projMatrix);
    glMatrix.vec4.div(p, p, [p[3], p[3], p[3], p[3]]);
    bbox_vs = updateBBox(bbox_vs, [p[0], p[1], p[2]]);

    glMatrix.vec4.transformMat4(p, [bbox[3], bbox[4], bbox[2], 1.0], projMatrix);
    glMatrix.vec4.div(p, p, [p[3], p[3], p[3], p[3]]);
    bbox_vs = updateBBox(bbox_vs, [p[0], p[1], p[2]]);

    glMatrix.vec4.transformMat4(p, [bbox[0], bbox[4], bbox[2], 1.0], projMatrix);
    glMatrix.vec4.div(p, p, [p[3], p[3], p[3], p[3]]);
    bbox_vs = updateBBox(bbox_vs, [p[0], p[1], p[2]]);

    glMatrix.vec4.transformMat4(p, [bbox[0], bbox[1], bbox[5], 1.0], projMatrix);
    glMatrix.vec4.div(p, p, [p[3], p[3], p[3], p[3]]);
    bbox_vs = updateBBox(bbox_vs, [p[0], p[1], p[2]]);

    glMatrix.vec4.transformMat4(p, [bbox[3], bbox[1], bbox[5], 1.0], projMatrix);
    glMatrix.vec4.div(p, p, [p[3], p[3], p[3], p[3]]);
    bbox_vs = updateBBox(bbox_vs, [p[0], p[1], p[2]]);


    glMatrix.vec4.transformMat4(p, [bbox[3], bbox[4], bbox[5], 1.0], projMatrix);
    glMatrix.vec4.div(p, p, [p[3], p[3], p[3], p[3]]);
    bbox_vs = updateBBox(bbox_vs, [p[0], p[1], p[2]]);

    glMatrix.vec4.transformMat4(p, [bbox[0], bbox[4], bbox[5], 1.0], projMatrix);
    glMatrix.vec4.div(p, p, [p[3], p[3], p[3]]);
    bbox_vs = updateBBox(bbox_vs, [p[0], p[1], p[2]]);

    return bbox_vs;

};


function updateBBox (bbox, newPoint){
    if(newPoint[0] < bbox[0]){
        bbox[0] = newPoint[0];
    } else {
        if(newPoint[0] > bbox[3]){
            bbox[3] = newPoint[0];
        }
    }
    if(newPoint[1] < bbox[1]){
        bbox[1] = newPoint[1];
    } else {
        if(newPoint[1] > bbox[4]){
            bbox[4] = newPoint[1];
        }
    }

    if(newPoint[2] < bbox[2]){
        bbox[2] = newPoint[2];
    } else {
        if(newPoint[2] > bbox[5]){
            bbox[5] = newPoint[2];
        }
    }
    return bbox;
}


Renderer.enlargeBox = function (box, perc){
    const center = [];
    center[0] = (box[0]+box[3])*0.5;
    center[1] = (box[1] + box[4])*0.5;
    center[2] = (box[2] + box[5])*0.5;

    box[0] += (box[0] - center[0])* perc;
    box[1] += (box[1] - center[1])* perc;
    box[2] += (box[2] - center[2])* perc;
    box[3] += (box[3] - center[0])* perc;
    box[4] += (box[4] - center[1])* perc;
    box[5] += (box[5] - center[2])* perc;
}