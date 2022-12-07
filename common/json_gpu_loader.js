var loadOnGPU = function( jsonMesh, gl ) {
   var gpuMesh = {
    vertBuffer: null,
    indexBufferTriangles: null
   }
   
   gpuMesh.vertexBuffer = gl.createBuffer();
   gpuMesh.normalBuffer = gl.createBuffer();
   gpuMesh.indexBufferTriangles = gl.createBuffer();
   
   gl.bindBuffer( gl.ARRAY_BUFFER, gpuMesh.vertexBuffer );
   gl.bufferData( 
      gl.ARRAY_BUFFER, 
	  new Float32Array(jsonMesh.vertices[0].values), 
	  gl.STATIC_DRAW
   );

  gl.bindBuffer( gl.ARRAY_BUFFER, gpuMesh.normalBuffer );
   gl.bufferData( 
      gl.ARRAY_BUFFER, 
	  new Float32Array(jsonMesh.vertices[1].values), 
	  gl.STATIC_DRAW
   );
  
   gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, gpuMesh.indexBufferTriangles );
   gl.bufferData( 
      gl.ELEMENT_ARRAY_BUFFER, 
	  new Uint16Array(jsonMesh.connectivity[0].indices), 
	  gl.STATIC_DRAW
   );

  gpuMesh.triangleIndices  = jsonMesh.connectivity[0].indices ; 
 
   return gpuMesh;
}