import { Renderer, matTo33 } from "../renderer_00/main_00.js";

'use strict'

class SpotLight {
    pos = [];
    dir = [];
    posViewSpace = [];
    dirViewSpace = [];
    cutOff = [];
    fallOff = [];
    constructor(){}
    get pos (){
        return this.pos;
    }
    set pos(pos){
        this.pos = pos;
    }

    get dir(){
        return this.dir;
    }
    set dir(dir){
        this.dir = dir;
    }

    get posViewSpace(){
        return this.posViewSpace;
    }
    set posViewSpace(posViewSpace){
        this.posViewSpace = posViewSpace;
    }

    get dirViewSpace(){
        return this.dirViewSpace;
    }
    set dirViewSpace(dirViewSpace){
        this.dirViewSpace=dirViewSpace;
    }

    get cutOff(){
        return this.cutOff;
    }
    set cutOff(cutOff){
        this.cutOff = cutOff;
    }

    get fallOff(){
        return this.fallOff;
    }
    set fallOff(fallOff){
        this.fallOff = fallOff;
    }

}

Renderer.lightsGeometryViewSpace = new Array();
Renderer.lightsColor = new Array();

Renderer.createLamps = function (){
    Game.setScene(scene_0);
    const lamps = Game.scene.lamps;
    const nLamps = lamps.length;
    this.streetLamps = new Array();
    for (let i = 0; i < nLamps; ++i) {
        const lampLight = [lamps[i].position[0], lamps[i].position[1], lamps[i].position[2], 1.0];
        lampLight[1] +=2;
        this.streetLamps[i] = {position: lamps[i].position, light: {geometry: lampLight, color: [0.2, 0.2, 0.2, 1.0]}};

    }

    this.spotLights = new Array();
    this.spotLights[0] = new SpotLight();
    this.spotLights[1] = new SpotLight();

    this.spotLights[0].pos = [-0.6, 0.5, -1.1, 1.0];
    this.spotLights[0].dir = glMatrix.vec4.normalize(glMatrix.vec4.create(), [-0.2, 0.2, -1.0, 0.0]);
    this.spotLights[0].cutOff = 0.2;
    this.spotLights[0].fallOff = 8.0;

    this.spotLights[1].pos = [0.6, 0.5, -1.1, 1.0];
    this.spotLights[1].dir = glMatrix.vec4.normalize(glMatrix.vec4.create(), [-0.2, 0.2, -1.0, 0.0]);
    this.spotLights[1].cutOff = 0.2;
    this.spotLights[1].fallOff = 8.0;

}



Renderer.drawLighting = function (view_transform ) {
    this.lightsGeometryViewSpace[0] = glMatrix.vec4.transformMat4(glMatrix.vec4.create(), [this.sunDir[0], this.sunDir[1], this.sunDir[2], 0.0], view_transform);
    this.lightsColor[0] = [0.3, 0.3, 0.3, 1.0];
    for(let i = 0; i < this.streetLamps.length; i++){
        this.lightsGeometryViewSpace[i+1] =  glMatrix.vec4.transformMat4(glMatrix.vec4.create(), this.streetLamps[i].light.geometry, view_transform);
        this.lightsColor[i+1] = this.streetLamps[i].light.color;
    }

    for(let i = 0; i < this.spotLights.length; i++) {
        this.spotLights[i].posViewSpace = glMatrix.vec4.transformMat4(glMatrix.vec4.create(), glMatrix.vec4.transformMat4(glMatrix.vec4.create(), this.spotLights[i].pos, this.car.frame), view_transform);
        this.spotLights[i].dirViewSpace = glMatrix.vec4.transformMat4(glMatrix.vec4.create(), glMatrix.vec4.transformMat4(glMatrix.vec4.create(), this.spotLights[i].dir, this.car.frame), view_transform);
    }


    for(let i = 0; i < this.streetLamps.length+1; i++){
        this.gl.uniform4fv(this.phongShader.uLightsGeometryLocation[i], this.lightsGeometryViewSpace[i]);
        this.gl.uniform4fv(this.phongShader.uLightsColorLocation[i], this.lightsColor[i]);
    }

    this.gl.uniform3fv(this.phongShader.uSpotLightsPosLocation[0], vecTo3(this.spotLights[0].posViewSpace));
    this.gl.uniform3fv(this.phongShader.uSpotLightsPosLocation[1], vecTo3(this.spotLights[1].posViewSpace));
    this.gl.uniform3fv(this.phongShader.uSpotLightsDirLocation[0], vecTo3(this.spotLights[0].dirViewSpace));
    this.gl.uniform3fv(this.phongShader.uSpotLightsDirLocation[1], vecTo3(this.spotLights[1].dirViewSpace));
    this.gl.uniform4fv(this.phongShader.uSpotLightsColorLocation[0], [0.0, 0.4, 0.9, 1.0]);
    this.gl.uniform4fv(this.phongShader.uSpotLightsColorLocation[1], [0.0, 0.4, 0.9, 1.0]);
    
    this.gl.uniform1f(this.phongShader.uSpotLightsCutOffLocation[0], this.spotLights[0].cutOff);
    this.gl.uniform1f(this.phongShader.uSpotLightsCutOffLocation[1], this.spotLights[1].cutOff);
    this.gl.uniform1f(this.phongShader.uSpotLightsFallOffLocation[0], this.spotLights[0].fallOff);
    this.gl.uniform1f(this.phongShader.uSpotLightsFallOffLocation[1], this.spotLights[1].fallOff);

    this.gl.uniform1f(this.phongShader.uKaLocation,1);
	this.gl.uniform1f(this.phongShader.uKdLocation,0.7);
	this.gl.uniform1f(this.phongShader.uKsLocation,0.5);
	this.gl.uniform1f(this.phongShader.uShininessLocation,0.5);
    

}

function vecTo3(vec){
    return [vec[0], vec[1], vec[2]];
}

