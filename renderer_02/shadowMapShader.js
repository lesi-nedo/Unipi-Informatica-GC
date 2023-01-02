export class ShadowMapShader {
    #program;
    #gl;

    constructor(gl){
        this.#program = gl.createProgram();
        this.#gl = gl;
        this.#initShader();
    }

    get shader(){
        return this.#program;
    }

    #vertexShader(){
        return `
            precision highp float;
            uniform mat4 uShadowMatrix;
            uniform mat4 uViewWorldMatrix;
            attribute vec3 aPosition;
            varying vec4 vPosition;
            void main (){
                vec4 pos = vec4(aPosition, 1.0);
                gl_Position = uShadowMatrix * pos;
                vPosition = uShadowMatrix * pos;
            }

        `
    }

    #fragmentShader(){
        return `
            #extension GL_EXT_frag_depth : require
            #extension GL_EXT_shader_texture_lod : enable
            #extension GL_OES_standard_derivatives : enable

            precision highp float;
            float unpack(vec4 v);

            vec2 pack_depth(const in float value);
            uniform vec3 uLightPos;
            uniform float uFarPlane;
            uniform float uNearPlane;

            varying vec4 vPosition;
            void main(){
                float depth = vPosition.z/vPosition.w;
                depth = depth * 0.5 + 0.5;
                float moment1 = depth;
                float moment2 = depth*depth;
                float dx = dFdx(depth);
                float dy = dFdy(depth);

                moment2 += 0.25 * (dx * dx + dy * dy);
                gl_FragColor = vec4(pack_depth(moment1), pack_depth(moment2));
            }
            vec2 pack_depth(const float value){
                vec2 rg = fract(value * vec2(256.0, 1.0));
                return rg - rg.rr*vec2(0.0, 0.00390625);
            }

            float unpack(vec4 v){
                return v.x + v.y / (256.0) + v.z / (256.0 * 256.0) + v.w / (256.0 * 256.0 * 256.0);
            }

        `
    }

    #initShader(){
        const gl = this.#gl;
        const program = this.#program;
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, this.#vertexShader());
        gl.compileShader(vertexShader);

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, this.#fragmentShader());
        gl.compileShader(fragmentShader);

        const aPositionIndex = 0;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.bindAttribLocation(program, aPositionIndex, "aPosition");
        gl.linkProgram(program);

        program.vertex_shader = this.#vertexShader();
        program.fragment_shader =  this.#fragmentShader();

        if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
            let str = `Unable to initialize the shader program\n\n`;
            str += `VS:\n ${gl.getShaderInfoLog(vertexShader)}\n\n`;
            str += `FS:\n ${gl.getShaderInfoLog(fragmentShader)}\n\n`;
            str += `PROG:\n ${gl.getProgramInfoLog(program)}\n\n`;
            alert(str);
        }

        program.aPositionIndex = aPositionIndex;
        program.uShadowMatrixLocation = gl.getUniformLocation(program, 'uShadowMatrix');
        program.uViewWorldMatrixLocation = gl.getUniformLocation(program, 'uViewWorldMatrix');

        program.uLightPosVec3Location = gl.getUniformLocation(program, 'uLightPos');
        program.uFarPlaneFloatLocation = gl.getUniformLocation(program, 'uFarPlane');
        program.uNearPlaneFloatLocation = gl.getUniformLocation(program, 'uNearPlane');


    }
}

