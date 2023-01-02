export class ShadowPhongShader {
    #gl;
    #program;
    #nLights;
    #nSpotLights;
    constructor(gl, nLights, nSpotLights,){
        this.#gl = gl;
        this.#nLights = nLights;
        this.#nSpotLights = nSpotLights;
        this.#program = gl.createProgram();
        this.#initShader();
    }

    get shader(){
        return this.#program;
    }
    #vertexShader(){
        return `
            const int cNLights = ${this.#nLights};
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uShadowMatrix;
            uniform mat4 uModelMatrix;
            uniform mat4 uNormWorldMatrix;
            uniform mat3 uViewNormalMatrix;
            uniform mat4 uHeadlightLeftMatrix;
            uniform mat4 uHeadlightRightMatrix;

            

            attribute vec3 aPosition;
            attribute vec3 aNormal;
            attribute vec2 aTexCoord;

            varying vec3 vNormal;
            varying vec4 vShadowPosition;
            varying vec3 vPos;
            varying vec3 vNormalWorld;
            varying vec3 vPosWorld;
            varying vec2 vTexCoord;
            varying vec2 vTexCoordHeadlightRight;

            mat3 toMat33(mat4 matrix);

            void main(){

                vTexCoord = aTexCoord;
                vec4 position   = vec4(aPosition, 1.0);
                vec4 pos = uModelViewMatrix * position;
                vec4 texPosRight =  uHeadlightRightMatrix * position;
                vTexCoordHeadlightRight = (texPosRight.xy/texPosRight.w);
                vShadowPosition =  uShadowMatrix    * (position);
                vPos =  vec3(pos);
               

                vNormal = normalize(uViewNormalMatrix * aNormal);
                gl_Position = uProjectionMatrix * pos;

            }

            mat3 toMat33(mat4 matrix){
                float 
                    a00 = matrix[0][0], a01 = matrix[0][1], a02 = matrix[0][2],
                    a10 = matrix[1][0], a11 = matrix[1][1], a12 = matrix[1][2],
                    a20 = matrix[2][0], a21 = matrix[2][1], a22 = matrix[2][2];
                return mat3(a00, a01, a02,
                            a10, a11, a12,
                            a20, a21, a22);
            }
        `
    }

    #fragmentShadow() {
        return `
            precision highp float;
            const int cNLights = ${this.#nLights};
            const int cNSpotLights = ${this.#nSpotLights};
            
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
            uniform float uFarPlane;
            uniform float uNearPlane;
            uniform int uBuildings;
            uniform int uTexInt;
            uniform int uHeadlightInt;
            uniform vec4 uColor;
            uniform sampler2D uShadowMap;
            uniform sampler2D uTexture;
            uniform sampler2D uHeadlight;
            varying vec4 vShadowPosition;
            varying vec3 vNormal;
            varying vec3 vNormalWorld;
            varying vec3 vPosWorld;
            varying vec3 vPos;
            varying vec2 vTexCoord;
            varying vec2 vTexCoordHeadlightRight;

            float unpack(vec4 v);
            vec2 unpack2(sampler2D tex, vec2 co);
            float isInShadow(vec4 vShadowPos, vec3 N);
            vec3 phongShading(vec3 L, vec3 N, vec3 V, vec3 lightColor, float shadow);
            float chebyshevUpperBound(float distance, vec3 shadowPos);
            float linstep(float mi, float ma, float v);

            bool isOutside(vec2 xy);


            void main(){
                vec3 N = normalize(vNormal);
                float shadow = (isInShadow(vShadowPosition, N));
               
                
                vec3 final = vec3(0.0,0.0,0.0);

                if(uHeadlightInt >= 1){
                    vec4 color = vec4(0.0);
                    vec2 uv;
                    uv = vTexCoordHeadlightRight;
                    color = texture2D(uHeadlight, uv);
                    final.r  = color.r*color.a;
                    final.g = color.g*color.a;
                    final.b = color.b*color.a;
                    if(isOutside(uv)){
                        final = vec3(0.0);
                    }
                    
                }

                float N_dot_L;
                float r;
                vec3 L;
                vec3 lc;
                

                for(int i = 0; i < cNLights; i++){
                    if(abs(uLightsGeometry[i].w - 1.0) < 0.01){
                        
                        r = length(uLightsGeometry[i].xyz-vPos);
                        L = normalize(uLightsGeometry[i].xyz - vPos);
                        lc = uLightsColor[i].xyz / (0.04*3.14*3.14*r*r);
                    } else {
                        
                        L = -uLightsGeometry[i].xyz;
                        r = 1.0;
                        lc = uLightsColor[i].xyz;
                    }
                    vec3 V = -normalize(vPos);
                    final += phongShading(L, N, V, lc, shadow);
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
                    final += phongShading(L, N, V, lc, shadow);
                }
                
                gl_FragColor = vec4(final,  1.0);
            }

            vec2 unpack2(sampler2D tex, vec2 co){
                vec4 color = texture2D(tex, co);
                float value1 = dot(color.rg, vec2(0.00390625, 1.0));
                float value2 = dot(color.ba, vec2(0.00390625, 1.0));
                return vec2(value1, value2);
            }

            vec3 phongShading(vec3 L, vec3 N, vec3 V, vec3 lightColor, float shadow){
                vec4 color = vec4(0.0);
                if(uTexInt == 0){
                    color = texture2D(uTexture, vTexCoord);
                } else {
                    color = uColor;
                }
                vec3 k_diffuse = color.xyz;
                vec3 k_specular = color.xyz;
                vec3 k_ambient = color.xyz;

                vec3 diffuse = vec3(0, 0, 0);
                vec3 specular = vec3(0, 0, 0);
                vec3 ambient = k_ambient * lightColor;
               

                float N_dot_L = max(0.0, dot(N, L));
                diffuse = (k_diffuse * lightColor) * N_dot_L;
                
                vec3 H = normalize(L + V);
                float N_dot_H = smoothstep(-0.125, 0.125, dot(N, H));
                float spec = pow(max(N_dot_H, 0.0), uShininess);
                specular = (k_specular * lightColor) * spec;
                
                vec3 res_color =  uKa * ambient + ( uKd * diffuse + uKs * specular);
                res_color.x *= shadow;
                res_color.y *= shadow;
                res_color.z *= shadow;
                
                return res_color;
            }

            float isInShadow(vec4 vShadowPos, vec3 N){
                

                vec3 normShadowPos = (vShadowPos.xyz / vShadowPos.w);
                vec3 shadowPos = normShadowPos * 0.5 + vec3(0.5);
                shadowPos.z += 0.00191;
                float shadow = chebyshevUpperBound(shadowPos.z, shadowPos.xyz);
                
                return min(max(shadow, 0.64), 0.9);
            }

            float unpack(vec4 v){
                return v.x   + v.y / (256.0) + v.z/(256.0*256.0)+v.w/ (256.0*256.0*256.0);
            }

            float chebyshevUpperBound(float distance, vec3 shadowPos){
                vec2 moments = unpack2(uShadowMap, shadowPos.xy);
                if(distance < moments.x){
                    return 1.0;
                } 

                float variance = min(max(moments.y - (moments.x*moments.x), 0.0)+0.000002, 1.0);
                float mD = moments.x  - distance;
                float mD_2 = mD*mD;

                float p_max = variance / (variance + mD_2);
                // p_max =smoothstep(0.06, 0.7, p_max);
                p_max = linstep(0.1, 0.38   , p_max);
                return max(p_max, float(distance <=   moments.x));
            }

            float linstep(float mi, float ma, float v)
            {
                    return clamp ((v - mi)/(ma - mi), 0.0, 1.0);
            }

            bool isOutside(vec2 xy){
                if(xy.x > 1.0 && xy.x < 2.0 && xy.y > 3.0 && xy.y < 4.0){
                    
                    return false;
                }
                
                if(xy.x > -2.0 && xy.x < -1.0 && xy.y > 3.0 && xy.y < 4.0){
                    return false;
                }
               

                
                
                return true;
            }

        `
    }

    #initShader(){
        const gl = this.#gl;
        const program = this.#program;
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

        gl.shaderSource(vertexShader, this.#vertexShader());
        gl.compileShader(vertexShader);

        gl.shaderSource(fragmentShader, this.#fragmentShadow());
        gl.compileShader(fragmentShader);

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);

        program.aPositionIndex = 0;
        program.aNormalIndex = 2;
        program.aTexCoordIndex = 4;
        program.vertexShader = this.#vertexShader();
        program.fragmentShader = this.#fragmentShadow();

        gl.bindAttribLocation(program, program.aPositionIndex, "aPosition");
        gl.bindAttribLocation(program, program.aNormalIndex, "aNormal");
        gl.bindAttribLocation(program, program.aTexCoordIndex, 'aTexCoord');
        gl.linkProgram(program);

        if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
            const str = `
                Unable to initialize the shader program.
                VS:\n ${gl.getShaderInfoLog(vertexShader)}
                FS:\n ${gl.getShaderInfoLog(fragmentShader)}
                PROG:\n ${gl.getProgramInfoLog(program)}
            `
            alert(str);
        }

        program.uModelViewMatrixLocation = gl.getUniformLocation(program, "uModelViewMatrix");
        program.uModelMatrixLocation = gl.getUniformLocation(program, 'uModelMatrix');
        program.uProjectionMatrixLocation = gl.getUniformLocation(program, "uProjectionMatrix");
        program.uShadowMatrixLocation = gl.getUniformLocation(program, "uShadowMatrix");
        program.uColorLocation = gl.getUniformLocation(program, "uColor");
        program.uShadowMapLocation = gl.getUniformLocation(program, "uShadowMap");
        program.uTextureLocation = gl.getUniformLocation(program, 'uTexture');
        program.uHeadlightLocation = gl.getUniformLocation(program, 'uHeadlight');

        this.#program.uProjectionMatrixLocation = this.#gl.getUniformLocation(this.#program, 'uProjectionMatrix');
        this.#program.uModelViewMatrixLocation = this.#gl.getUniformLocation(this.#program, 'uModelViewMatrix');
        this.#program.uViewNormalMatrixLocation = this.#gl.getUniformLocation(this.#program, 'uViewNormalMatrix');
        this.#program.uHeadlightRightMatrixLocation = this.#gl.getUniformLocation(this.#program, 'uHeadlightRightMatrix');
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
        this.#program.uWorldNormalMatrixLocation = this.#gl.getUniformLocation(this.#program, 'uNormWorldMatrix');
        this.#program.uBuildingsIntegerLocation = this.#gl.getUniformLocation(this.#program, 'uBuildings');
        this.#program.uNearPlaneFloatLocation = this.#gl.getUniformLocation(this.#program, 'uNearPlane');
        this.#program.uFarPlaneFloatLocation = this.#gl.getUniformLocation(this.#program, 'uFarPlane');
        this.#program.uTexIntLocation = this.#gl.getUniformLocation(this.#program, 'uTexInt');
        this.#program.uHeadlightIntLocation = this.#gl.getUniformLocation(this.#program, 'uHeadlightInt');
    }
}