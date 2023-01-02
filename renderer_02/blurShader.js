export class BlurShader {
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
            precision mediump float;
            uniform mat4 uShadowMatrix;


            attribute vec3 aPosition;
            attribute vec2 aTexCoord;

            varying vec2 vTexCoord;
            varying vec2 pos;
            void main (){
               
                vTexCoord = aTexCoord;
                pos = aPosition.xy;
                gl_Position = vec4(aPosition, 1.0);
            }

        `
    }

    #fragmentShader(){
        return `
        precision mediump float;
        uniform sampler2D shaderMap;

            varying vec2 pos;
            varying vec2 vTexCoord;

            uniform int uHorizontally;
            float rand(vec2 co);
            
            
            void main(){
                vec2 p=0.5*pos + (vec2(0.5,0.5));
                vec4 color = vec4(0.0);
                float blurSize = 0.00029296875;
                float offset[3];
                offset[0]=0.0, offset[1]=1.3846153846, offset[2]=3.2307692308;
                float weights[3];
                weights[0]=0.2270270270, weights[1]= 0.3162162162, weights[2]=0.0702702703;

                color = texture2D(shaderMap, (vec2(gl_FragCoord))/4096.0) * weights[0];
                if(uHorizontally != 1){
                    color += texture2D(shaderMap, (vec2(gl_FragCoord) + vec2(0.0, offset[1]))/4096.0) * weights[1];
                    color += texture2D(shaderMap, (vec2(gl_FragCoord) - vec2(0.0, offset[2]))/4096.0) * weights[2];
                 } else {
                    color += texture2D(shaderMap, (vec2(gl_FragCoord) + vec2(offset[1], 0.0))/4096.0) * weights[1];
                    color += texture2D(shaderMap, (vec2(gl_FragCoord) - vec2(offset[2], 0.0))/4096.0) * weights[2];
                }
                // color = texture2D(shaderMap, vec2(p.x, p.y));
                gl_FragColor = color;
            }

            
            float rand(vec2 co){
                return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
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
        const aTexCoordIndex = 1;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.bindAttribLocation(program, aPositionIndex, "aPosition");
        gl.bindAttribLocation(program, aTexCoordIndex, 'aTexCoord');
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
        program.aTexCoordIndex = aTexCoordIndex;
        program.uShaderMapLocation = gl.getUniformLocation(program, 'shaderMap');
        program.uShadowMatrixLocation = gl.getUniformLocation(program, 'uShadowMatrix');
        program.uHorizontallyBoolLocation = gl.getUniformLocation(program, 'uHorizontally');

    }
}

