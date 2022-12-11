'use strict';
export class PhongShader {
    #program;
    #nLights;
    #nSpotLights;
    #gl;
    #ambientStrength;
    constructor(gl, nLights, nSpotLights, ambientStrength){
        this.#ambientStrength = ambientStrength;
        this.#gl = gl;
        this.#program = gl.createProgram();
        this.#nLights = nLights;
        this.#nSpotLights = nSpotLights;
        this.#initShader();
    }

    get shader(){
        return this.#program;
    }

    #vertexShader(){
        return `
            precision highp float;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uModelViewMatrix;
            uniform mat3 uViewNormalMatrix;

            attribute vec3 aPosition;
            attribute vec3 aNormal;
            
            varying vec3 vPos;
            varying vec3 vNormal;

            void main() {
                vNormal = normalize(uViewNormalMatrix * aNormal);
                vec4 position = vec4(aPosition, 1.0);
                vPos = vec3(uModelViewMatrix * position);
                gl_Position = uProjectionMatrix * uModelViewMatrix * position;
            }
        `
    }

    #fragmentShader(){
        return `
            precision highp float;

            const int cNLights = ${this.#nLights};
            const int cNSpotLights = ${this.#nSpotLights};

            uniform vec4 uColor;
            uniform vec4 uLightsColor[cNLights];
            uniform vec4 uLightsGeometry[cNLights];

            uniform vec3 uSpotLightsDir[cNSpotLights];
            uniform vec3 uSpotLightsPos[cNSpotLights];
            uniform vec4 uSpotLightsColor[cNSpotLights];
            uniform float uSpotLightsCutOff[cNSpotLights];
            uniform float uSpotLightsFallOff[cNSpotLights];


            uniform vec3 uCameraPos;

            uniform float uAmbientStrength;
            uniform float uShininess;
            uniform float uKa;
            uniform float uKd;
            uniform float uKs;


            varying vec3 vNormal;
            varying vec3 vPos;

            vec3 phongShading(vec3 L, vec3 N, vec3 V, vec3 lightColor);

            void main(){
                vec3 N = normalize(vNormal);
                vec3 final = vec3(0.0,0.0,0.0);

                float N_dot_L;
                float r;
                vec3 L;
                vec3 lc;

                for(int i = 0; i < cNLights; i++){
                    if(abs(uLightsGeometry[i].w - 1.0) < 0.01){
                        
                        r = length(uLightsGeometry[i].xyz-vPos);
                        L = normalize(uLightsGeometry[i].xyz - vPos);
                        lc = uLightsColor[i].xyz / (0.03*3.14*3.14*r*r);
                    } else {
                        
                        L = -uLightsGeometry[i].xyz;
                        r = 1.0;
                        lc = uLightsColor[i].xyz;
                    }
                    vec3 V = normalize(-vPos);
                    final += phongShading(L, N, V, lc);
                }

                for(int i =0; i < cNSpotLights; i++){
                    r = length(uSpotLightsPos[i] - vPos);
                    L = normalize(uSpotLightsPos[i] - vPos);
                    float L_dot_D = dot(uSpotLightsDir[i], -L);
                    if(L_dot_D > uSpotLightsCutOff[i]){
                        L_dot_D = pow(L_dot_D, uSpotLightsFallOff[i]);
                    } else {
                        L_dot_D = 0.0;
                    }

                    vec3 V = normalize(-vPos);
                    vec3 lc = uSpotLightsColor[i].xyz * L_dot_D /(0.009 * 3.14 * 3.14 * r * r);
                    final += phongShading(L, N, V, lc);
                }

                gl_FragColor = vec4(final, 1.0);
            }

            vec3 phongShading(vec3 L, vec3 N, vec3 V, vec3 lightColor){
                vec3 k_diffuse = uColor.xyz;
                vec3 k_specular = uColor.xyz;
                vec3 k_ambient = uColor.xyz;

                vec3 diffuse = vec3(0, 0, 0);
                vec3 specular = vec3(0, 0, 0);
                vec3 ambient = k_ambient * lightColor;

                float N_dot_L = max(0.0, dot(N, L));
                diffuse = (k_diffuse * lightColor) * N_dot_L;

                vec3 H = normalize(L + V);

                float spec = pow(max(dot(N, H), 0.0), uShininess);
                specular = (k_specular * lightColor) * spec;

                return uKa * ambient * uKd * diffuse;
            }

            `
    }

    #initShader(){
        const vertexShader = this.#gl.createShader(this.#gl.VERTEX_SHADER);
        this.#gl.shaderSource(vertexShader, this.#vertexShader());
        this.#gl.compileShader(vertexShader);

        const fragmentShader = this.#gl.createShader(this.#gl.FRAGMENT_SHADER);
        this.#gl.shaderSource(fragmentShader, this.#fragmentShader());
        this.#gl.compileShader(fragmentShader);

        this.#gl.attachShader(this.#program, vertexShader);
        this.#gl.attachShader(this.#program, fragmentShader);

        this.#program.aPositionIndex = 0;
        this.#program.aNormalIndex = 2;
        this.#gl.bindAttribLocation(this.#program, this.#program.aPositionIndex, 'aPosition');
        this.#gl.bindAttribLocation(this.#program, this.#program.aNormalIndex, 'aNormal');

        this.#gl.linkProgram(this.#program);
        
        this.#program.vertexShader = vertexShader;
        this.#program.fragmentShader = fragmentShader;

        console.log(this.#gl.getProgramParameter(this.#program, this.#gl.LINK_STATUS));
        if(!this.#gl.getProgramParameter(this.#program, this.#gl.LINK_STATUS)){
            alert('Unable to initialize the shader program');
            const str = `
            VS:\n${this.#gl.getShaderInfoLog(vertexShader)}\n\n
            FS:\n${this.#gl.getShaderInfoLog(fragmentShader)}\n\n
            PROG:\n${this.#gl.getProgramInfoLog(this.#program)}\n\n
            `;

            alert(str);
            
        }

        this.#program.uProjectionMatrixLocation = this.#gl.getUniformLocation(this.#program, 'uProjectionMatrix');
        this.#program.uModelViewMatrixLocation = this.#gl.getUniformLocation(this.#program, 'uModelViewMatrix');
        this.#program.uViewNormalMatrixLocation = this.#gl.getUniformLocation(this.#program, 'uViewNormalMatrix');
        this.#program.uLightsGeometryLocation = new Array();
        this.#program.uLightsColorLocation = new Array();
        
        for(let i = 0; i < this.#nLights; i++){
            this.#program.uLightsGeometryLocation[i] = this.#gl.getUniformLocation(this.#program, `uLightsGeometry[${i}]`);
            this.#program.uLightsColorLocation[i] = this.#gl.getUniformLocation(this.#program, `uLightsColor[${i}]`);
        }

        this.#program.uSpotLightsDirLocation = new Array();
        this.#program.uSpotLightsPosLocation = new Array();
        this.#program.uSpotLightsCutOffLocation = new Array();
        this.#program.uSpotLightsFallOffLocation = new Array();
        this.#program.uSpotLightsColorLocation = new Array();

        for(let i = 0; i < this.#nSpotLights; i++) {
            this.#program.uSpotLightsDirLocation[i] = this.#gl.getUniformLocation(this.#program, `uSpotLightsDir[${i}]`);
            this.#program.uSpotLightsPosLocation[i] = this.#gl.getUniformLocation(this.#program, `uSpotLightsPos[${i}]`);
            this.#program.uSpotLightsCutOffLocation[i] = this.#gl.getUniformLocation(this.#program, `uSpotLightsCutOff[${i}]`);
            this.#program.uSpotLightsColorLocation[i] = this.#gl.getUniformLocation(this.#program, `uSpotLightsColor[${i}]`);
            this.#program.uSpotLightsFallOffLocation[i] = this.#gl.getUniformLocation(this.#program, `uSpotLightsFallOff[${i}]`);

        }


        this.#program.uAmbientStrengthLocation = this.#gl.getUniformLocation(this.#program, 'uAmbientStrength');
        this.#program.uShininessLocation = this.#gl.getUniformLocation(this.#program, 'uShininess');
        this.#program.uKaLocation = this.#gl.getUniformLocation(this.#program, 'uKa');
        this.#program.uKdLocation = this.#gl.getUniformLocation(this.#program, 'uKd');
        this.#program.uKsLocation = this.#gl.getUniformLocation(this.#program, 'uKs');

        this.#program.uCameraPosLocation = this.#gl.getUniformLocation(this.#program, 'uCameraPos');
        this.#program.uColorLocation = this.#gl.getUniformLocation(this.#program, 'uColor');
    }
}