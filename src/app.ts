function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
	const dpr = window.devicePixelRatio;
	const {width, height} = canvas.getBoundingClientRect();
	const displayWidth = Math.round(width*dpr);
	const displayHeight = Math.round(height*dpr);

	const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;

	if (needResize) {
		canvas.width = displayWidth;
		canvas.height = displayHeight;
	}

	return needResize;
}

function createShader(gl: WebGLRenderingContext, type: GLenum, source: string) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
	if (success) { return shader; }

	console.error(gl.getShaderInfoLog(shader));
	gl.deleteShader(shader);
}

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	const success = gl.getProgramParameter(program, gl.LINK_STATUS);
	if (success) { return program; }

	console.error(gl.getProgramInfoLog(program));
	gl.deleteProgram(program);
}

console.log("Hello world");

function render(image: HTMLImageElement) {
	let canvas = document.getElementById("c") as HTMLCanvasElement;

	let gl = canvas.getContext("webgl2");

	if (!gl) {
		console.error("WebGL is not available.");
		return;
	}

	const vertexShaderSource = (document.getElementById("vertex-shader-2d") as HTMLScriptElement).text;
	const fragmentShaderSource = (document.getElementById("fragment-shader-2d") as HTMLScriptElement).text;

	const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

	console.log(vertexShader, fragmentShader);
	const program = createProgram(gl, vertexShader, fragmentShader);

	const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
	const charposAttributeLocation = gl.getAttribLocation(program, "a_charpos");
	const chardataAttributeLocation = gl.getAttribLocation(program, "a_chardata");
	const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
	const textureUniformLocation = gl.getUniformLocation(program, "u_texture");
	const colorsUniformLocation = gl.getUniformLocation(program, "u_colors");

	const positionBuffer = gl.createBuffer();
	const charposBuffer = gl.createBuffer();
	const chardataBuffer = gl.createBuffer();

	const term_font = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, term_font);
	// @ts-ignore
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, image);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.generateMipmap(gl.TEXTURE_2D);

	const colors = gl.createTexture();
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, colors);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 16, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(
		[0xF0, 0xF0, 0xF0,
		0xF2, 0xB2, 0x33,
		0xE5, 0x7F, 0xD8,
		0x99, 0xB2, 0xF2,
		0xDE, 0xDE, 0x6C,
		0x7F, 0xCC, 0x19,
		0xF2, 0xB2, 0xCC,
		0x4C, 0x4C, 0x4C,
		0x99, 0x99, 0x99,
		0x4C, 0x99, 0xB2,
		0xB2, 0x66, 0xE5,
		0x33, 0x66, 0xCC,
		0x7F, 0x66, 0x4C,
		0x57, 0xA6, 0x4E,
		0xCC, 0x4C, 0x4C,
		0x19, 0x19, 0x19,
		]));
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	resizeCanvasToDisplaySize(canvas);

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.useProgram(program);

	// Configure position attribute reading

	gl.enableVertexAttribArray(positionAttributeLocation);
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	const size = 4;          // 2 components per iteration
	const type = gl.FLOAT;   // the data is 32bit floats
	const normalize = false; // don't normalize the data
	const stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
	let offset = 0;        // start at the beginning of the buffer
	gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);

	// Configure charpos attribute reading
	gl.enableVertexAttribArray(charposAttributeLocation);
	gl.bindBuffer(gl.ARRAY_BUFFER, charposBuffer);
	gl.vertexAttribIPointer(charposAttributeLocation, 2, gl.UNSIGNED_INT, 8, 0);
	gl.vertexAttribDivisor(charposAttributeLocation, 1);

	// Configure chardata attribute reading
	gl.enableVertexAttribArray(chardataAttributeLocation);
	gl.bindBuffer(gl.ARRAY_BUFFER, chardataBuffer);
	gl.vertexAttribIPointer(
		chardataAttributeLocation,
		3,
		gl.UNSIGNED_INT,
		12,
		0
	);
	gl.vertexAttribDivisor(chardataAttributeLocation, 1);

	gl.uniform1i(textureUniformLocation, 0);
	gl.uniform1i(colorsUniformLocation, 1);
	gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	const x1 = 0;
	const x2 = 60;
	const y1 = 0;
	const y2 = 90;
	let vertices = new Float32Array([
		x1, y1, 0, 0,
		x1, y2, 0, 1,
		x2, y2, 1, 1,
		x1, y1, 0, 0,
		x2, y1, 1, 0,
		x2, y2, 1, 1,
	])
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, chardataBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Uint32Array([
		129, 15, 1,
		130, 15, 2,
		131, 15, 3,
		4, 15, 0,
		5, 15, 0,
	]), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, charposBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Uint32Array([
		0, 0,
		1, 1,
		2, 0,
		3, 1,
		4, 0,
	]), gl.STATIC_DRAW);

	gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, 5);
}

function main() {
	var image = new Image();
	image.src = "img/term_font.png";
	image.onload = function() {
		render(image);
	}
}

main();

document.addEventListener("touchstart", (e) => {console.log(e)});
