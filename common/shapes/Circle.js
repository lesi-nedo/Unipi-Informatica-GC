class Circle {
  #num_points;
  #radius;
  #vertices;
  #x;
  #y;
  #colors;
  num_vertices;
  #num_colors;
  vertexBuffer = null;
  colorsBuffer = null;
  constructor(num_points, num_colors, radius, x, y){
    this.#num_points = num_points;
    this.#num_colors = num_colors;
    this.#radius = radius;
    this.#vertices = new Float32Array((num_points+1)*2);
    this.#x=x;
    this.#y=y;
    this.#colors = new Float32Array(num_colors*4);
    this.#create_cirle();
  }

  #create_cirle(){
    const color1 = [Math.random(),Math.random(), Math.random(), Math.random()];
    const color2 = [Math.random(),Math.random(), Math.random(), Math.random()];
    const color3 = [Math.random(),Math.random(), Math.random(), Math.random()];
    const div_elem = this.#num_points-2;
    
    this.#vertices.set([0, 0], 0);
    for(let i = 0; i < this.#num_points; i++){
      const angle = 2*Math.PI*i/div_elem;
      const x = this.#x + this.#radius*Math.cos(angle);
      const y = this.#y + this.#radius*Math.sin(angle);
      this.#vertices.set([x, y], (i+1)*2);
    }
    for(let i = 0; i<this.#num_colors; i++){
      let curr_color = null;
      let mod_i = i % 3
      if(mod_i == 0){
        curr_color = color1;
      } else if(mod_i == 1){
        curr_color = color2;
      } else {
        curr_color = color3;
      }
      this.#colors.set(curr_color, i*4);
    }
    this.num_vertices = this.#vertices.length/2;
  }
  get vertices (){
    return Float32Array.from(this.#vertices);
  }

  get num_points() {
    return this.#num_points;
  }

  get colors(){
    return this.#colors;
  }
}