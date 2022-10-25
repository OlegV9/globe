(function() {
	const radian = Math.PI / 180;
	
	let canvas = document.getElementById('canvas');
	let ctx = canvas.getContext('2d');
	
	let cW = canvas.width;
	let cH = canvas.height;
	
	let centerX = cW / 2;
	let centerY = cH / 2;
	
	let left;
	let top;
	
	setCanvasSize();
	
	let zoom = 1;
	let finalZoom = 1;
	let radius;
	let mercatorSize;
	
	let maxRotateY = 80;
	let rotateX = -60;
	let rotateY = -15;
	
	let maxInertion = 5;
	let easing = 0.01;
	
	let constantSpeed = true;
	let inertionX = 0.1;
	let inertionY = 0;
	
	let mSpeedX = 0;
	let mSpeedY = 0;
	
	let lastMouseX, lastMouseY;
	let isDrag = false;
	
	let switchRatio = 1;
	let switchDuration = 250;
	let switchStart;
	let mode = 'globe';
	let modeTransitionZoom = [2.9, 4.4];
	
	let accuracy = 5;
	
	let additRotate = 0;
	
	let tileData = {};
	let fullTile;
	
	let data;
	
	let objects;
	let redCoords;
	
	let labels = [
		{ coords: [50, 20],		type: 'land',	text: 'Europe' },
		{ coords: [10, 20], 	type: 'land',	text: 'Africa' },
		{ coords: [40, 80],		type: 'land',	text: 'Asia' },
		{ coords: [-25, 134],	type: 'land',	text: 'Australia' },
		{ coords: [-12, -60],	type: 'land',	text: 'South America' },
		{ coords: [38, -100],	type: 'land',	text: 'North America' },
		{ coords: [-90, 0],		type: 'land',	text: 'Antarctica' },
		
		{ coords: [-10, 80],	type: 'ocean',	text: 'Indian\nOcean' },
		{ coords: [15, -35],	type: 'ocean',	text: 'Atlantic\nOcean' },
		{ coords: [0, -155],	type: 'ocean',	text: 'Pacific\nOcean' },
		{ coords: [85, 180],	type: 'ocean',	text: 'Arctic Ocean' },
	];
	
	document.querySelector('#switch_btn').addEventListener('click', switchMode);
	
	document.addEventListener('wheel', e => doZoom(e.deltaY < 0));
	document.querySelector('#zoom_in').addEventListener('click', e => doZoom(true));
	document.querySelector('#zoom_out').addEventListener('click', e => doZoom(false));
	
	let box = document.querySelector('#canvas_box');
	box.addEventListener('mousedown', onMouseDown);
	box.addEventListener('touchstart', onMouseDown);
	
	window.addEventListener('resize', setCanvasSize);
	
	document.addEventListener('keydown', onKeyDown);
	
	initObjects();
	initRotate();
	
	let intervalCnt = 0;
	
	function render() {
		draw();
		window.requestAnimationFrame(render);
	}
	window.requestAnimationFrame(render);
	//setInterval(draw, 10);
	
	function getGlobeRatio() {
		let mz = modeTransitionZoom;
		let globeRatio;
		if (zoom < mz[0]) {
			globeRatio = 1;
		} else if (zoom > mz[1]) {
			globeRatio = 0;
		} else {
			let range = mz[1] - mz[0];
			globeRatio = 1 - (zoom - mz[0]) / range;
		}
		return globeRatio;
	}
	
	function toXY(lat, lng, i, j) {
		let globeRatio = getGlobeRatio();
		
		if (globeRatio === 1) return toGlobeXY(lat, lng, i, j);
		if (globeRatio === 0) return toWebMercatorXY(lat, lng, i, j);
		
		let globe = toGlobeXY(lat, lng, i, j);
		let flat = toWebMercatorXY(lat, lng, i, j);
		if (!flat) return;
		
		let distX = (globe.x - flat.x) * globeRatio;
		let distY = (globe.y - flat.y) * globeRatio;
		
		let x, y;
		if (mode === 'globe') {
			x = flat.x + distX;
			y = flat.y + distY;
		} else {
			x = globe.x - distX;
			y = globe.y - distY;
		}
		
		return {
			x,
			y,
			z: globe.z,
			back: globe.back
		};
		
		
		
		/*if (!switchStart) {
			if (mode === 'globe') return toGlobeXY(lat, lng, i, j);
			if (mode === 'flat') return toWebMercatorXY(lat, lng, i, j);
		}
		
		let globe = toGlobeXY(lat, lng, i, j);
		let flat = toWebMercatorXY(lat, lng, i, j);
		if (!flat) return;
		
		let distX = (globe.x - flat.x) * switchRatio;
		let distY = (globe.y - flat.y) * switchRatio;
		
		let x, y;
		if (mode === 'globe') {
			x = flat.x + distX;
			y = flat.y + distY;
		} else {
			x = globe.x - distX;
			y = globe.y - distY;
		}
		
		return {
			x,
			y,
			z: globe.z,
			back: flat.back
		};*/
	}
	
	function toGlobeXY(lat, lng, i, j) {
		//TODO: fix
		if (lng === 0) {
			lng = 0.01;
		}
		if (lat === 0) {
			lat = 0.01;
		}
		
		let newLng = lng + rotateX;
		if (newLng > 180) {
			newLng -= 360;
		} else if (newLng < -180) {
			newLng += 360;
		}
		
		let dY = radius * Math.sin(lat * radian);
		let ratio = Math.tan((90 - lat) * radian);
		let distX = ratio * dY * Math.sin(newLng * radian);
		
		let newLat = lat;
		let dY2 = radius * Math.sin(newLat * radian);
		
		let hh = dY2 * Math.cos(rotateY * radian);
		
		let eW = radius * Math.cos(lat * radian);
		let eH = eW * Math.sin(rotateY * radian);
		
		let diffH = eH * Math.cos(newLng * radian);
		
		let distY = hh + diffH;
		
		let zH = eW * Math.sin((newLng + 90) * radian);
		let zDiff = distY * Math.sin(rotateY * radian);
		let distZ = zH - zDiff;
		
		if (rotateY > 90 || rotateY < -90) {
			distZ *= -1;
		}
		
		return {
			x: distX,
			y: distY,
			z: distZ,
			back: (distZ < 0)
		};
	}
	
	function toWebMercatorXY(lat, lng, i, j) {
		if (lat > 85 || lat < -85) return null;
		
		let degree = mercatorSize / 360;
		
		let x = (rotateX + lng) * degree;
		let y = rotateY * degree + Math.log((1 + sin(lat)) / (1 - sin(lat))) * mercatorSize / Math.PI / 4;
		
		return {
			x: x,
			y: y
		};
	}
	
	function getFlatAngle(xy) {
		let [x, y] = xy;
		
		let angle = -Math.asin(y / radius) / radian;
		
		if (x < 0) {
			angle = 180 - angle;
		}
		if (angle < 0) {
			angle += 360;
		}
		
		return angle;
	}
	
	function getChainJoin(p1, p2) {
		let chain = [];
		
		let angle1 = getFlatAngle(p1);
		let angle2 = getFlatAngle(p2);
		
		let anglesCnt = Math.abs(angle1 - angle2);
		if (anglesCnt > 180) {
			anglesCnt = 360 - anglesCnt;
			if (angle1 < angle2) {
				angle1 += 360;
			} else {
				angle2 += 360;
			}
		}
		let step = angle1 < angle2 ? 1 : -1;
		
		//let cnt = 0;
		for (let i = 0, angle = round(angle1); i < anglesCnt; i++) {
			angle += step;
			
			let x = radius * Math.cos(angle * radian);
			let y = radius * Math.sin(-angle * radian);
			chain.push([x, y]);
			
			//if (++cnt > 500) break;
		}
		//log(cnt, step, round(angle1), round(angle2));
		
		return chain;
	}
	
	function getPolygons(coords) {
		let chains = [];
		let chain = [];
		
		let firstVisible, lastVisible;
		
		coords.forEach((point, i) => {
			let [lat, lng] = point;
			let flat = toXY(lat, lng);
			if (!flat) return;
			
			if (i === 0) {
				firstVisible = !flat.back;
			}
			lastVisible = !flat.back;
			
			if (flat.back && chain.length) {
				chains.push(chain);
				chain = [];
			}
			if (!flat.back) {
				chain.push([flat.x, flat.y]);
			}
		});
		if (chain.length) {
			chains.push(chain);
		}
		if (firstVisible && !lastVisible) {
			let [x, y] = chains[0][0];
			let chain = [[x, y]];
			chains.push(chain);
		}
		
		if (!chains.length) return [];
		
		let polygon = [];
		
		let lastPoint;
		chains.forEach((chain, i) => {
			if (i > 0) {
				let joinChain = getChainJoin(lastPoint, chain[0]);
				joinChain.forEach(p => {
					polygon.push(p);
				});
			}
			chain.forEach(p => {
				polygon.push(p);
				lastPoint = p;
			});
		});
		if (!firstVisible && chains && chains[0]) {
			let joinChain = getChainJoin(lastPoint, chains[0][0]);
			joinChain.forEach(p => {
				polygon.push(p);
			});
		}
		
		return [polygon];
	}
	
	function draw() {
		intervalCnt++;
		
		if (!isDrag) {
			rotateX += inertionX;
			rotateY += inertionY;
			
			ensureRotateBounds();
			
			if (!constantSpeed) {
				inertionX *= 1 - easing;
				inertionY *= 1 - easing;
			}
		}
		
		mSpeedX = 0;
		mSpeedY = 0;
		
		zoom += (finalZoom - zoom) / 5;
		radius = 100 * Math.pow(2, zoom);
		mercatorSize = radius * Math.PI * 2;
		
		left = cW / 2 - radius;
		top = cH / 2 - radius;
		
		if (switchStart) {
			let passedMs = Date.now() - switchStart;
			switchRatio = passedMs / switchDuration;
			if (switchRatio >= 1) {
				switchRatio = 1;
				switchStart = null;
			}
		}
		
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.strokeStyle = 'black';
		
		if (mode === 'globe' && switchRatio > 0.7) {
			drawCircle();
		} else {
			drawBg();
		}
		
		drawObjects();
		//if (mode === 'globe') {
		if (zoom < modeTransitionZoom[1]) {
			drawGrid();
		} else {
			drawTiles();
			drawFragment();
		}
		drawTexts();
		
		if (redCoords) {
			let xy = toXY(redCoords[0], redCoords[1]);
			if (xy) {
				drawDot(left + radius + xy.x, top + radius - xy.y, 'red', 10);
			}
		}
	}
	
	function absXY(xy) {
		let x = left + radius + xy[0];
		let y = top + radius - xy[1];
		
		return [x, y];
	}
	
	function drawCircle() {
		let gradient = ctx.createRadialGradient(centerX, centerY, radius, centerX, centerY, radius * 2);

		let light = '#eaf2ff';
		let white = '#ffffff';
		
		gradient.addColorStop(0, light);
		gradient.addColorStop(0.1, white);
		gradient.addColorStop(1, white);

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		
		ctx.beginPath();
		ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
		ctx.fillStyle = '#8ab4f8';
		ctx.fill();
	}
	
	function drawBg() {
		ctx.fillStyle = '#8ab4f8';
		ctx.fillRect(0, 0, cW, cH);
	}
	
	function onKeyDown(e) {
		let step = 1;
		if (e.keyCode === 37) {
			additRotate -= step;
		} else if (e.keyCode === 39) {
			additRotate += step;
		}
	}
	
	function drawAxis() {
		ctx.beginPath();
		ctx.stokeStyle = 'black';
		
		ctx.moveTo(centerX, centerY - radius);
		ctx.lineTo(centerX, centerY + radius);
		
		ctx.moveTo(centerX - radius, centerY);
		ctx.lineTo(centerX + radius, centerY);
		
		ctx.stroke();
	}
	
	function drawParallel(lat, color) {
		color = color || '#678fd1';
		
		let fromAngle, toAngle;
		
		let smallRadius = radius * sin(90 - lat);
		
		let h1 = radius * sin(lat);
		let h2 = h1 * -sin(rotateY);
		let h3 = h2 / cos(rotateY);
		
		if (-h3 > smallRadius) return;
		
		if (h3 > smallRadius) {
			fromAngle = 0;
			toAngle = 360;
		} else {
			let angle = Math.asin(h3 / smallRadius) / radian;
			fromAngle = 180 - angle;
			toAngle = angle;
			if (rotateY < 0) {
				fromAngle += 180;
				toAngle += 180;
			}
		}
		
		let cX = centerX;
		let cY = top + radius - h1 * cos(rotateY);
		
		let radX = radius * cos(lat);
		let radY = abs(radX * cos(90 - rotateY));
		
		ctx.beginPath();
		ctx.strokeStyle = color;
		ctx.ellipse(cX, cY, radX, radY, 0, fromAngle * radian, toAngle * radian);
		ctx.stroke();
	}
	
	function drawMeridian(lng, color) {
		color = color || '#678fd1';
		
		let rX = rotateX + lng;
		let rY = rotateY;
		
		if (rX >= 270) {
			rX -= 360;
		}
		
		let sinX = sin(rX);
		let sinY = sin(rY);
		let cosX = cos(rX);
		let cosY = cos(rY);
		
		let wdr = radius * sinX;
		let smr = radius * cosX;
		let bgr = radius / cosX;
		
		let smrr = bgr * sinY;
		let bgrr = smr * sinY;
		
		let rotate
		if (!bgrr && !smrr) {
			rotate = 0;
		} else {
			let diff = bgrr - smrr;
			rotate = -Math.atan(diff / wdr);
		}
		
		let radiusX = abs(radius * sinX * cosY);
		
		let fromAngle = -90;
		let toAngle = 90;
		
		if (rX > 90 && rX < 180) {
			fromAngle += 180;
			toAngle += 180;
		}
		if (rX < 0 && rX > -90) {
			fromAngle *= -1;
			toAngle *= -1;
		}
		
		ctx.beginPath();
		ctx.strokeStyle = color;
		ctx.ellipse(centerX, centerY, radiusX, radius, rotate, fromAngle * radian, toAngle * radian);
		ctx.stroke();
	}
	
	function drawPole() {
		ctx.beginPath();
		let pole = toXY(90, 0);
		ctx.arc(left + radius + pole.x, top + radius - pole.y, 5, 0, Math.PI * 2);
		ctx.stroke();
	}
	
	function drawGrid() {
		//drawAxis();
		//drawPole();
		
		drawParallel(0);
		//drawMeridian(0);
	}
	
	function getTileUrl(type, z, x, y, r) {
		if (r == null) {
			r = Math.floor(Math.random() * 4);
		}
		if (type === 'satellite') {
			return 'https://khms' + r + '.google.com/kh/v=932?x=' + x + '&y=' + y + '&z=' + z;
		}
		//return 'https://mt' + r + '.google.com/vt/lyrs=m&x=' + x + '&y=' + y + '&z=' + z + '&hl=en';
		
		let url = 'https://www.google.com/maps/vt/pb=!1m5!1m4!1i' + (z - 1) + '!2i' + x + '!3i' + y + '!4i128!2m2!1e0!3i624356444!3m7!2sen!3sua!5e1105!12m1!1e47!12m1!1e3!4e0!5m2!1e0!5f2!23i10203575!23i1381033!23i1368782!23i1368785!23i47025228!23i4592408!23i4640515!23i4819508!23i1375050!23i4536287';
		return url;
	}
	
	function drawTiles() {
		let d = tileData;
		
		getTilesIndexes().forEach(tile => {
			let {x, y, z, cnt} = tile;
			
			if (z <= 3) return;
			
			if (!d[z]) {
				d[z] = {};
			}
			if (!d[z][x]) {
				d[z][x] = {};
			}
			if (!d[z][x][y]) {
				d[z][x][y] = true;
				
				let url = getTileUrl('standard', z, x, y);
				let img = new Image();
				img.onload = function() {
					this.loaded = true;
				}
				img.src = url;
				d[z][x][y] = img;
			} else if (d[z][x][y] instanceof Image && d[z][x][y].loaded) {
				let img = d[z][x][y];
				
				let size = mercatorSize / cnt;
				let tileX = centerX + x * size - cnt / 2 * size + rotateX * mercatorSize / 360;
				let tileY = centerY + y * size - cnt / 2 * size - rotateY * mercatorSize / 360;
				ctx.drawImage(img, tileX, tileY, size, size);
			}
		});
	}
	
	function getTilesIndexes() {
		let list = [];
		
		let z = Math.round(zoom - 0.1) + 1;
		let cnt = Math.pow(2, z);
		let fsz = mercatorSize / cnt;
		
		let degree = mercatorSize / 360;
		
		let left = (180 - rotateX) * degree - cW / 2;
		let right = left + cW;
		
		let top = (180 + rotateY) * degree - cH / 2;
		let bottom = top + cH;
		
		for (let x = 0; x < cnt; x++) {
			for (let y = 0; y < cnt; y++) {
				if (left > (x + 1) * fsz || right < x * fsz) continue;
				if (top > (y + 1) * fsz || bottom < y * fsz) continue;
				
				list.push({
					z: z,
					x: x,
					y: y,
					cnt: cnt
				});
			}
		}
		
		return list;
	}
	
	function drawFragment(withAreas) {
		if (!fullTile) {
			fullTile = new Image();
			fullTile.onload = function() {}
			fullTile.src = getTileUrl('satellite', 0, 0, 0, 0);
			return;
		}
		
		let size = 100;
		let offsetX = cW - size - 10;
		let offsetY = 10;
		
		let w = cW / mercatorSize * size;
		let h = cH / mercatorSize * size;
		
		let rectX = size / 2 - rotateX / 360 * size - w / 2;
		let rectY = size / 2 + rotateY / 360 * size - h / 2;
		
		ctx.drawImage(fullTile, offsetX, offsetY, size, size);
		
		ctx.beginPath();
		ctx.strokeStyle = 'red';
		ctx.rect(offsetX + rectX, offsetY + rectY, w, h);
		ctx.stroke();
		
		if (!withAreas) return;
		
		getTilesIndexes().forEach(t => {
			let s = size / t.cnt;
			
			ctx.beginPath();
			ctx.strokeStyle = 'yellow';
			ctx.rect(offsetX + t.x * s, offsetY + t.y * s, s, s);
			ctx.stroke();
		});
	}
	
	function renderObject(object, i) {
		let polygons = getPolygons(object.coords);
		
		let colorMap = {
			field: '#bbe2c6',
			forest: '#94d2a5',
			lake: '#8ab4f8',
			desert: '#f5f0e4',
			ice: '#fff'
		};
		
		polygons.forEach(points => {
			ctx.beginPath();
			
			let color = colorMap[object.type];
			ctx.fillStyle = color;
			
			let firstPoint;
			points.forEach((p, j) => {
				let [x, y] = absXY(p);
				if (j === 0) {
					firstPoint = p;
					ctx.moveTo(x, y);
				} else {
					ctx.lineTo(x, y);
				}
			});
			let [x, y] = absXY(firstPoint);
			ctx.lineTo(x, y);
			
			ctx.fill();
			//ctx.stroke();
			
			if (object.sub) {
				ctx.save();
				ctx.clip();
				
				object.sub.forEach(renderObject);
				
				//ctx.fillStyle = 'red';
				//ctx.fillRect(centerX - 100, centerY - 100, 200, 200);
				ctx.restore();
			}
		});
	}
	
	function drawObjects() {
		let n = 0;
		//objects = objects.slice(n, n+1);
		
		objects.forEach(renderObject);
	}
	
	function drawTexts() {
		ctx.beginPath();
		ctx.fillStyle = 'black';
		ctx.font = '20px serif';
		ctx.fillText('X: ' + round(rotateX, 1), 5, 15);
		ctx.fillText('Y: ' + round(rotateY, 1), 5, 35);
		ctx.fillText('Z: ' + round(zoom, 1), 5, 55);
		
		labels.forEach(label => {
			if (!label.node) {
				let box = document.querySelector('#labels_box');
				let node = document.createElement('span');
				node.className = 'label label-' + label.type;
				node.innerHTML = label.text.replace(/\n/g, '<br>');
				box.appendChild(node);
				
				label.node = node;
			}
			
			let coords = toXY(label.coords[0], label.coords[1]);
			if (!coords || coords.back) {
				label.node.style.visibility = 'hidden';
				return;
			}
			
			let size = label.node.getBoundingClientRect();
			let [x, y] = absXY([coords.x, coords.y]);
			
			label.node.style.visibility = 'visible';
			label.node.style.left = (x - size.width / 2) + 'px';
			label.node.style.top = (y - size.height / 2) + 'px';
		});
		
		ctx.stroke();
	}
	
	function doZoom(isIn) {
		let zoomInc = 0.5;
		if (isIn) {
			finalZoom += zoomInc;
		} else {
			finalZoom -= zoomInc;
		}
		if (finalZoom < 1) {
			finalZoom = 1;
		}
	}
	
	function onMouseDown(e) {
		e.preventDefault();
		
		isDrag = true;
		
		lastMouseX = e.pageX != null ? e.pageX : e.touches[0].pageX;
		lastMouseY = e.pageY != null ? e.pageY : e.touches[0].pageY;
		
		constantSpeed = false;
		inertionX = 0;
		inertionY = 0;
		
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('touchmove', onMouseMove);
		
		document.addEventListener('mouseup', onMouseUp);
		document.addEventListener('touchend', onMouseUp);
	}
	
	function ensureRotateBounds() {
		if (rotateX > 180) {
			rotateX -= 360;
		} else if (rotateX < -180) {
			rotateX += 360;
		}
		
		if (rotateY > maxRotateY) {
			rotateY = maxRotateY;
		} else if (rotateY < -maxRotateY) {
			rotateY = -maxRotateY;
		}
	}
	
	function onMouseMove(e) {
		let pageX = e.pageX != null ? e.pageX : e.touches[0].pageX;
		let pageY = e.pageY != null ? e.pageY : e.touches[0].pageY;
		
		let distX = pageX - lastMouseX;
		let distY = pageY - lastMouseY;
		
		let circle = Math.PI * radius * 2;
		let angleX = distX / circle * 360;
		let angleY = -distY / circle * 360;
		
		mSpeedX = angleX;
		mSpeedY = angleY;
		
		if (!e.ctrlKey) {
			rotateX += angleX;
		}
		if (!e.shiftKey) {
			rotateY += angleY;
		}
		
		ensureRotateBounds();
		
		lastMouseX = pageX;
		lastMouseY = pageY;
	}
	
	function onMouseUp(e) {
		isDrag = false;
		
		inertionX = mSpeedX;
		inertionY = mSpeedY;
		
		inertionX = Math.min(inertionX, maxInertion);
		inertionX = Math.max(inertionX, -maxInertion);
		
		inertionY = Math.min(inertionY, maxInertion);
		inertionY = Math.max(inertionY, -maxInertion);
		
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('touchmove', onMouseMove);
		
		document.removeEventListener('mouseup', onMouseUp);
		document.removeEventListener('touchend', onMouseUp);
	}
	
	function drawDot(x, y, color = 'red', radius = 2) {
		ctx.beginPath();
		ctx.strokeStyle = color;
		ctx.arc(x, y, radius, 0, 2 * Math.PI);
		ctx.stroke();
	}
	
	function setCanvasSize() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		
		cW = canvas.width;
		cH = canvas.height;
		
		centerX = cW / 2;
		centerY = cH / 2;
	}
	
	function switchMode() {
		switchStart = Date.now();
		mode = (mode === 'globe' ? 'flat' : 'globe');
	}
	
	function initRotate() {
		if (!location.search) return;
		let pairs = location.search.slice(1).split('&');
		let data = {};
		pairs.forEach(pair => {
			let keyVal = pair.split('=');
			let key = keyVal[0];
			let val = keyVal[1];
			data[key] = val;
		});
		
		if (data.x) {
			rotateX = parseFloat(data.x);
		}
		if (data.y) {
			rotateY = parseFloat(data.y);
		}
		if (data.mode) {
			mode = data.mode;
		}
	}
	
	function cos(angle) {
		return Math.cos(angle * Math.PI / 180);
	}
	
	function sin(angle) {
		return Math.sin(angle * Math.PI / 180);
	}
	
	function tan(angle) {
		return Math.tan(angle * Math.PI / 180);
	}
	
	function abs(num) {
		return Math.abs(num);
	}
	
	function log(...args) {
		if (intervalCnt % 10 === 0) {
			console.log.apply(console, args);
		}
	}
	
	function logRound(...args) {
		args = args.map(arg => Math.round(arg));
		console.log.apply(console, args);
	}
	
	function round(num, dec = 0) {
		if (!dec) return Math.round(num);
		
		let multi = Math.pow(10, dec);
		return Math.round(num * multi) / multi;
	}
	
	function initObjects() {
		let test = [
			[40, -20], [40, -10], [40, 0], [40, 10], [40, 20], [40, 30], [40, 40],
			[30, 40], [20, 40],
			[20, 30], [20, 20], [10, 20], [0.1, 20], [-10, 20],
			[-10, 30], [-10, 40],// [-10, 45],
			[-35, -0.1],
			[-30, -20], [-25, -20], [-20, -20], [-15, -20], [-10, -20], [-5, -20], [0.1, -20]
		];
		
		objects = [
			{
				type: 'desert',
				coords: [[10, -10], [10, 10], [-10, 10], [-10, -10]]
			}
		];
		//return;
		
		objects = [
			{
				comment: 'Africa',
				type: 'desert',
				coords: [[31.3,32.3],[31.2,32.1],[31.4,31.8],[31.5,32],[31.5,31.5],[31.6,31.1],[31.5,30.9],[31.4,30.9],[31.4,30.6],[31.3,29.9],[30.9,29.2],[31.1,28.4],[31.1,27.8],[31.3,27.8],[31.4,27.3],[31.6,26.6],[31.6,25.9],[31.6,25.1],[31.9,25],[32.1,24.6],[32,24],[32.2,23.7],[32.2,23.2],[32.4,23],[32.7,23.1],[32.8,22.7],[32.9,22.1],[33,21.6],[32.8,21.3],[32.8,21.2],[32.6,20.7],[32.3,20.2],[31.9,19.9],[31.5,19.9],[31.2,20.2],[30.7,19.9],[30.4,19.5],[30.3,19],[30.6,18.4],[30.8,18.2],[31,17.5],[31.2,16.9],[31.2,16.2],[31.5,15.6],[31.9,15.3],[32.2,15.3],[32.4,15.1],[32.6,14.4],[32.8,13.8],[32.9,13.2],[32.8,12.4],[33.3,10.9],[34.1,9.8],[34.9,10.8],[35.9,11.1],[36.2,10.5],[37,11],[36.9,10.4],[37.4,9.9],[37.2,9],[36.9,8.5],[37,8],[37,6.3],[36.7,5.1],[36.9,3.8],[36.6,1.2],[36,0],[35.6,-0.8],[35.2,-2.8],[35.3,-3.8],[35.2,-4.7],[35.9,-5.4],[35.7,-6],[34.2,-6.6],[33.3,-8.7],[32.7,-9.3],[31.5,-9.9],[30.3,-9.6],[28.9,-11.1],[28,-12.9],[26.7,-13.6],[26.2,-14.6],[25.4,-14.9],[24.8,-15],[23.7,-15.9],[22.3,-16.6],[22.2,-16.8],[21.4,-17.1],[20.7,-16.6],[20,-16.2],[19.4,-16.6],[18.6,-16],[17.2,-16.2],[16.3,-16.7],[14.9,-17.6],[13.9,-16.7],[12.7,-16.9],[11.9,-15.7],[11,-15.1],[10.1,-14.4],[9.1,-13.3],[8.2,-13.3],[7.3,-12],[5.9,-10.2],[4.4,-7.8],[4.8,-6.7],[5.2,-5.3],[5.1,-4.2],[5.2,-3.1],[4.9,-2],[5.4,-0.6],[6.1,0.8],[6.3,1.9],[6.4,3.6],[6.4,4.6],[4.3,6.1],[4.4,7.5],[4.6,8.2],[4.2,9],[3.8,9.6],[2.9,9.9],[1.3,9.4],[0.3,9.4],[-0.7,8.8],[-2.3,9.6],[-3.5,10.9],[-4.7,11.8],[-6.1,12.3],[-7,12.8],[-8.4,13.4],[-9,13],[-10.9,13.8],[-12.1,13.7],[-12.6,13],[-13.2,12.6],[-14,12.4],[-15.7,11.8],[-16.6,11.8],[-17.7,11.8],[-18.9,12.4],[-20.4,13.2],[-21.8,14],[-22.4,14.5],[-23.1,14.5],[-24,14.4],[-24.9,14.9],[-26.4,15],[-27.3,15.2],[-28.3,16],[-28.7,16.4],[-29.4,16.8],[-30.3,17.2],[-31.1,17.7],[-31.9,18.2],[-32.7,18.2],[-32.7,17.9],[-33,17.9],[-33.7,18.5],[-34.1,18.2],[-34.3,19.2],[-34.8,19.9],[-34.4,21],[-34.4,21.9],[-33.9,22.5],[-34.1,23.4],[-34.1,24.7],[-33.9,25.5],[-33.7,26.5],[-33.1,27.8],[-32.3,28.8],[-31.4,29.6],[-29.8,30.9],[-29,31.6],[-28.6,32.3],[-28,32.4],[-26.4,32.9],[-25.9,32.6],[-25.2,33.5],[-24.5,34.9],[-23.9,35.5],[-22.1,35.4],[-20.7,35],[-20.4,34.5],[-19.9,34.7],[-18.9,36.1],[-17.8,37.1],[-17,39],[-14.2,40.7],[-12.5,40.5],[-11.4,40.4],[-10.4,40.3],[-9.9,39.8],[-8.2,39.4],[-6.9,39.5],[-6,38.7],[-4.9,39.1],[-2.2,40.9],[-0.4,42.4],[1.9,45.3],[3.7,47],[5.1,48.4],[6.6,49.1],[7.5,49.7],[9.4,50.7],[10.4,50.9],[11.8,51.2],[12,50.7],[11.6,49.9],[11.3,48.9],[11.1,48],[11.2,47.4],[10.8,46.5],[10.8,45.8],[10.4,44.9],[10.5,44],[11.3,43.5],[11.7,42.5],[12.1,43.4],[12.8,42.9],[14.7,41],[15.5,39.9],[15.8,39.3],[17.7,38.9],[18.4,38],[18.8,37.3],[19.8,37],[21.2,37.1],[22,36.8],[22.9,35.7],[24.2,35.5],[25.4,34.6],[27,33.9],[27.8,33.4],[29,32.6],[29.6,32.2],[30,32.4]],
				sub: [
					{
						comment: '',
						type: 'field',
						coords: [[15.2,-18.6],[16.9,-14.7],[16.5,-11.1],[15.9,-6.7],[15.2,-1.5],[15.6,1.2],[15.3,6.6],[13,10.8],[14.1,16.1],[15.3,20.3],[14.7,23.8],[15.2,30.3],[14.7,33.3],[15,36.2],[10.4,40],[8.1,41],[6.2,41],[4,39.9],[3.7,37],[5,35.1],[3.4,34.4],[1.8,36],[0.8,37.5],[-3.9,36],[-8,36.7],[-8,39.9],[-14.6,41.9],[-19.1,40.4],[-22.8,38.2],[-30.4,37.1],[-34.3,32.5],[-36.1,28.4],[-36.7,22.4],[-35.2,18.1],[-33.4,18.2],[-33,21.3],[-32.2,25.1],[-30.4,28.1],[-27.7,29.8],[-27,26.7],[-25.1,25.6],[-23.6,27.7],[-18.7,26.6],[-17.6,25.5],[-17.1,22.1],[-17.1,14.9],[-13.9,10.9],[-6.1,6.1],[0.7,-2.6],[2.3,-11.5],[5.8,-17],[10.7,-19.5]],
						sub: [
							{
								type: 'forest',
								coords: [[-3.9,13.8],[-2.7,12.2],[2.4,11],[4.2,10.8],[5.9,11.8],[6.1,13.8],[5.8,15.5],[4.9,16.3],[4,16.3],[3.8,18.4],[3.1,20.7],[3.6,21.4],[4.7,22.7],[5.3,24.6],[3.2,27.8],[3.2,29.5],[1.9,30.4],[0.6,30.1],[-0.4,28.8],[-2.1,28.8],[-3.8,28.5],[-4.6,27.2],[-4.4,26.1],[-5.1,24.9],[-5.9,24.5],[-5.9,22.6],[-6.4,22.1],[-6.9,20.7],[-4.7,19.9],[-2.2,18.1],[-0.9,17.9],[-0.5,16.6],[-0.5,15.5],[-1.5,15.3],[-2.4,14.5],[-2.9,12.9]]
							}
						]
					},
					{
						type: 'lake',
						coords: [[-2.7,31.8],[-2.2,31.6],[-1.6,31.6],[-1,31.8],[-0.5,31.9],[-0.1,32.2],[0.1,32.6],[0.2,33.4],[-0.1,34.1],[-0.9,33.9],[-1.5,33.7],[-1.7,33.3],[-2,33],[-2.4,33.3],[-2.6,32.7],[-2.4,32.2],[-2.7,32]]
					}
				]
			},
			{
				comment: 'Madagascar',
				type: 'field',
				coords: [[-12,49.1],[-13,49.9],[-15.3,50.4],[-17.2,49.4],[-19.7,48.7],[-22.5,47.9],[-25,47],[-25.1,46.3],[-25.7,45.3],[-25,44],[-23.3,43.6],[-22.2,43.1],[-20.1,44.4],[-17.3,43.8],[-16,44.6],[-15.5,46.7],[-14.3,47.7],[-13.3,48.4],[-12.5,48.7]],
				sub: [
					{
						type: 'desert',
						coords: [[-24.9,45.3],[-24.7,45.9],[-16.9,49.1],[-15,49.1],[-18.3,45],[-21.5,44.1],[-24.1,44.2],[-24.4,44.5]]
					}
				]
			},
			{
				comment: 'Eurasia',
				type: 'field',
				coords: [[31.2,32.4],[31.1,32.6],[31.2,33.1],[31.1,33.3],[31.2,33.8],[31.7,34.5],[32.9,34.9],[34,35.4],[34.8,35.8],[35.7,35.7],[36.3,35.7],[37,36],[36.7,35.5],[36.8,34.6],[36.3,33.9],[36,32.6],[36.5,31.9],[36.9,30.6],[36.4,30.3],[36.1,29.6],[36.7,28.8],[37,27.1],[37.4,27.5],[37.9,27.1],[38.3,26.3],[38.9,26.9],[39.5,26.6],[39.5,26.1],[40.1,26.3],[40.4,27],[40.3,28.3],[40.6,29.4],[40.9,29.1],[41,29],[41,29.1],[41.1,29.1],[41.1,29.1],[41.2,29.1],[41.2,29.2],[41.2,29.4],[41.2,29.6],[41.2,29.8],[41.1,29.9],[41.1,30.1],[41.2,30.3],[41.2,30.5],[41.1,30.7],[41.1,30.9],[41.1,31.2],[41.2,31.4],[41.3,31.4],[41.4,31.6],[41.5,31.8],[41.6,32],[41.8,32.3],[41.8,32.5],[41.9,32.9],[41.9,33.1],[42,33.3],[42,33.7],[42,34],[42,34.5],[42,34.8],[42.1,34.9],[41.7,35.6],[41.8,36],[41.3,36.4],[41.4,36.7],[41,38.5],[41.1,39.4],[41.1,40.7],[41.6,41.5],[42.2,41.6],[42.7,41.4],[42.8,41],[43.1,40.4],[44.1,39.1],[44.4,38.2],[44.7,37.8],[44.7,37.4],[45.1,37.2],[45.2,36.7],[45.4,36.9],[45.4,37.5],[45.9,37.9],[46.1,37.9],[46.1,38.4],[46.4,37.9],[46.6,37.8],[46.7,38.2],[46.6,38.6],[46.9,38.4],[46.9,38.9],[47,39.2],[47.3,39.2],[47.2,38.5],[47.1,38],[47.1,37.6],[46.8,36.7],[46.5,35.6],[46.6,35.3],[46.4,35.1],[46.2,34.8],[46.2,34.2],[46,34],[45.8,34.6],[45.6,35],[45.4,35.1],[45.3,35.3],[45.4,35.9],[45.5,36.3],[45.1,36.3],[45.1,36.1],[45.1,35.4],[44.8,35.1],[44.8,34.5],[44.5,34.3],[44.4,33.6],[44.6,33.4],[45.2,33.6],[45.2,33.2],[45.3,33],[45.4,32.5],[45.9,33.6],[46.1,33.5],[46.1,32.4],[46.3,31.9],[46.5,32.4],[46.7,31.9],[46.7,31.3],[46.6,30.8],[46,30.4],[45.7,29.7],[44.9,29.6],[44.8,29.1],[44.7,28.8],[44.1,28.6],[43.5,28.6],[43.4,28],[42.4,27.5],[42.2,27.9],[41.6,28.1],[41.4,28.5],[41.3,29],[41,28.9],[41,28.5],[41.1,28.2],[41,27.9],[41,27.5],[40.7,27.1],[40.6,26.9],[40.7,26.7],[40.6,26.3],[40.7,26],[40.9,25.7],[41,25.1],[40.9,24.8],[40.8,24.2],[40.8,24.1],[40.8,23.9],[40.7,23.7],[40.5,23.9],[40.3,24.3],[40.1,24.2],[40.3,24],[40.3,23.7],[40.1,23.9],[39.9,24],[40.1,23.8],[40.2,23.6],[40.2,23.3],[40.1,23.5],[40,23.6],[39.9,23.6],[40,23.3],[40.2,23.2],[40.4,22.8],[40.6,22.8],[40.5,22.6],[40.1,22.5],[39.8,22.9],[39.2,23.3],[39.2,23.2],[39.3,23],[39.2,22.9],[39,23],[38.9,22.7],[38.8,22.9],[38.5,23.4],[38.7,23.5],[38.9,23.1],[39,23.3],[38.8,23.7],[38.6,24.2],[38.2,24.6],[38,24.5],[38,24.2],[38.3,24],[38.4,23.6],[38.1,23.9],[37.7,24],[37.9,23.6],[37.9,23.1],[37.6,23.4],[37.3,23.3],[37.6,22.8],[37.2,22.8],[36.8,23.1],[36.6,23.1],[36.8,22.8],[36.5,22.4],[36.6,22.3],[37,22.1],[36.8,21.9],[37.1,21.6],[37.5,21.6],[37.9,21.1],[38.2,21.4],[38.3,21.9],[38.2,22.2],[38.1,22.5],[38,22.7],[38,23],[38.1,23.2],[38.3,22.8],[38.4,22.7],[38.4,22.4],[38.4,22.4],[38.3,22.2],[38.4,21.9],[38.4,21.7],[38.3,21.5],[38.4,21.4],[38.3,21.1],[38.6,21],[38.9,20.7],[39.1,20.9],[39.1,20.6],[39.7,20.1],[40.4,19.4],[41.4,19.4],[41.9,19.6],[42.5,18.4],[43,17.5],[43.9,15.6],[45.1,14.8],[45.6,13.6],[45.5,12.1],[44.8,12.4],[44.3,12.3],[43.6,13.7],[42.7,14],[41.9,15.4],[41.9,16.1],[40.6,18.1],[39.8,18.2],[40.2,17.6],[40.5,16.8],[39.7,16.4],[39.4,17.2],[39,17.1],[38.9,16.5],[38.4,16.6],[38,16.1],[38.1,15.7],[38.4,15.7],[38.9,16.1],[40.1,15.5],[40.1,15.2],[40.7,14.4],[41.3,13.4],[41.3,12.8],[42.1,11.8],[43,10.4],[44,10.1],[44.4,8.6],[43.7,7.9],[43.7,7.2],[43.1,6.4],[43.1,5.4],[43.5,4.5],[43,2.9],[41.9,3.2],[41.4,2.2],[40.8,0.6],[39.5,-0.4],[38.7,0.1],[37.6,-1],[36.8,-2.1],[36.8,-4.2],[37.1,-6.8],[37.2,-8],[37.1,-9],[38.5,-8.8],[38.8,-9.6],[41.2,-8.6],[42.5,-8.8],[43.7,-7.7],[43.7,-5.4],[43.6,-3.9],[43.4,-1.7],[44.7,-1.2],[46.2,-1.2],[47.3,-2.3],[48,-4.5],[48.6,-4.6],[48.9,-3.3],[48.7,-1.4],[49.8,-1.8],[49.4,-0.1],[49.9,0.3],[50.1,1.4],[50.9,1.6],[51.5,3.7],[52,4.1],[53,4.7],[52.6,5.5],[53.2,5.4],[53.4,6.4],[53.6,8],[54.4,8.8],[55.3,8.6],[55.8,8.1],[56.7,8.1],[57.2,9.2],[57.7,10.3],[56.4,10.9],[55.8,10.1],[55.4,10.8],[55,10.6],[55.4,9.7],[54.5,10.1],[54.5,11.2],[54.5,12.9],[54,14.5],[54.8,18.1],[54.9,19.9],[55.1,21.1],[56.6,20.9],[57.5,21.2],[57.8,22.4],[57,23.5],[57.3,24.3],[58.4,24.4],[59.1,23.3],[59.5,27.7],[59.9,30.1],[60.5,28.7],[60.7,28.5],[60.5,26.7],[60.3,24.8],[59.9,23.1],[60.7,21.3],[61.7,21.6],[62.8,21.1],[63.7,22.6],[64.5,24],[64.9,25.1],[65.8,24.5],[65.8,22.5],[65.2,21.5],[64.5,21.4],[63.9,20.7],[63.4,19.2],[62.8,18.1],[61.9,17.2],[60.8,17.1],[59.8,18.9],[59,18.1],[58.5,16.7],[57.3,16.5],[56.2,15.8],[56.1,14.4],[55.5,14.3],[55.5,13],[56.9,12.9],[58.1,11.5],[59.1,11],[59.3,10.3],[58.1,7.8],[58.3,6.4],[58.9,5.1],[60.3,5.2],[61.8,5.2],[62.4,5.4],[63.2,8],[63.8,9.7],[65,11.9],[66.4,13.1],[67.8,15.3],[68.2,16.4],[68.7,14.6],[69.5,17.6],[70.2,19.7],[70.3,21.8],[71.1,25.2],[71.1,27.5],[70.7,29],[70.4,31.1],[69.9,29.4],[69.7,31.8],[69.8,32.9],[69.5,32.8],[69.2,35.4],[68.4,38.3],[67.1,41.3],[66.4,40.2],[66.1,37.9],[66.6,34.6],[67.1,32.4],[66.1,34.5],[65.4,34.6],[64.3,35.1],[64.4,37.8],[64.8,36.6],[64.7,40.2],[65.5,39.5],[66.6,42.2],[66.3,43.8],[66.8,44.5],[67.3,43.8],[68.3,44.1],[68.7,43.2],[68.6,45.9],[67.9,46.7],[67.3,45.3],[67,47.6],[67.7,48.1],[68.3,50.2],[68.8,53.6],[67.9,53],[68.5,55.3],[68.6,57],[68.4,59.8],[69.2,60.8],[69.7,63.5],[68.9,66.6],[68.4,68.4],[69.5,68],[69.9,66.8],[70.8,67.3],[71.3,67.1],[71.7,68.4],[72.9,69.6],[72.7,72.9],[71.5,71.9],[70.4,72.5],[68.5,73],[66.6,71.5],[68.7,75.2],[68.3,78.4],[70.1,74.4],[71.6,74.3],[73,75.1],[72.2,80.6],[71.4,82.5],[73.1,81.3],[73.8,87.9],[74.9,86.4],[76.1,94.1],[76.4,98.2],[77.7,103.6],[77.3,106.6],[76.5,112.5],[75.3,113.4],[73.9,108.6],[73.5,117.7],[73,122.8],[73,129.6],[71.9,129.2],[71.9,132.6],[71.5,139.2],[72.8,141.6],[72.4,146.4],[71,152.2],[70.8,158.6],[69.5,162.1],[69.1,169.7],[70.1,170.5],[69,180.2],[67.5,184.4],[66.3,188.9],[64.6,187.4],[65.7,181.6],[64.6,177.8],[62.5,179.5],[61.8,173.7],[60.9,171.5],[60.1,170.1],[60.3,166.7],[60.1,163.4],[58.1,162.4],[56.4,163.2],[54.7,161.6],[52.2,158.5],[51,156.3],[53.6,155.9],[56.6,155.6],[58.2,158.6],[60.4,162],[62.5,164.6],[61.4,159.4],[61.9,158.8],[61.5,156.7],[59.5,154.1],[59.1,152.3],[59.7,150.1],[59.4,145.6],[59.3,142.4],[55.1,135.4],[53.6,140.6],[51.7,140.9],[49.7,140.4],[48.4,140],[46.6,138.1],[45,136.4],[43.1,133.6],[43.1,131.6],[41.7,129.7],[40.9,129.6],[39.4,127.2],[38.2,128.6],[36.6,129.5],[35.2,128.9],[34.7,127.4],[35,126.3],[36.9,126.3],[37.3,126.7],[38,125.1],[38.3,124.7],[39.5,125.3],[39.8,124.2],[39.6,122.6],[39,121.4],[39.7,121.4],[40.5,122.1],[40.9,120.9],[40.1,120.1],[39.9,119.4],[39,118.4],[39.1,117.7],[38.7,117.5],[38,118.9],[37,119.3],[37.5,122.5],[36.9,122.4],[36.5,120.8],[34.3,120.1],[32.7,120.9],[31.7,121.9],[30.8,121.8],[30.1,122.1],[29.3,122],[28.2,121.2],[27.4,120.5],[25.5,119.7],[24.6,118.6],[23.8,117.5],[22.9,116.1],[22.6,114.5],[22.2,113.6],[21.7,111.6],[21,110.2],[20.6,110.5],[20.3,110.2],[20.9,109.6],[21.4,109.8],[21.7,108.8],[21.4,107.6],[20.6,106.6],[19,105.7],[17.6,106.6],[16.2,108.2],[14.4,109.2],[13,109.2],[11.5,108.9],[10.7,107.8],[10.6,106.8],[9.7,106.5],[9.2,105.3],[8.6,104.9],[9.7,104.8],[10.1,105],[10.5,104],[11.1,103],[12.1,102.7],[12.7,101.6],[12.8,100.9],[13.4,101.1],[13.4,99.9],[12.4,100.1],[10.8,99.3],[9.5,99.1],[9.4,99.9],[7.8,100.3],[7.3,100.2],[6.8,100.9],[6.9,101.5],[5.9,102.5],[5.1,103.5],[4,103.4],[2.8,103.6],[1.9,104.2],[1.5,104],[1.5,103.4],[2.3,102.2],[3.3,101.1],[4.5,100.5],[6,100.3],[7.8,99.2],[8.2,98.3],[10.7,98.4],[12.5,98.5],[14,97.9],[16.3,97.4],[17.3,97],[16.7,96.5],[15.8,95.4],[16.1,94.1],[17.4,94.6],[19.2,93.9],[20.3,92.8],[22.7,91.6],[22,89.7],[21.7,89],[21.4,86.9],[20.7,86.8],[19.8,85.6],[18,83.6],[17,82.3],[15.6,80.9],[15.3,80.1],[13.1,80],[11.8,79.8],[10.5,79.7],[9.4,78.8],[8.8,78],[7.9,77.5],[9.2,76.5],[10.5,76],[12.8,74.8],[15.5,73.7],[18.7,72.8],[20.7,72.8],[22.5,72.5],[21.1,71.7],[20.7,70.9],[22.5,68.8],[23.6,68.3],[24.1,69.1],[24.2,67.5],[24.9,66.6],[25.6,66.5],[25.4,64],[25.3,61.7],[25.4,59.8],[25.9,57.4],[27.1,56.4],[26.6,54.8],[27.3,52.9],[27.9,51.3],[29.2,50.8],[30.3,49.9],[29.3,47.9],[27.2,49.5],[26.3,50.7],[25.9,50.5],[25.6,50.3],[24.8,50.8],[25.5,50.9],[26.2,51.1],[25.8,51.5],[25,51.5],[24.3,51.3],[24.2,52.7],[24.2,54.1],[25.3,55.3],[26.1,56],[24.2,56.5],[22.4,59.7],[21.3,58.9],[20.4,58.5],[20.2,57.7],[18.8,57.7],[18.9,56.7],[18.1,56.3],[17.9,55.4],[17.1,55],[16.9,53.9],[16.4,52.1],[15.7,52.1],[15,50.4],[14.7,49.1],[14.2,48.8],[14.1,47.9],[13.6,46.9],[13.4,45.8],[12.9,44.8],[12.8,43.6],[14.5,42.8],[16.4,42.7],[18.2,41.5],[20.2,40.4],[21.3,39.1],[23.9,38.4],[24.9,37.1],[25.7,36.8],[26.8,36.2],[27.7,35.7],[28.2,34.7],[29.6,34.8],[28.3,34.3],[27.9,34.3],[27.9,33.9],[28.5,33.3],[29,33.2],[29.7,32.7],[30,32.6]],
				sub: [
					{
						type: 'forest',
						coords: [[51.4,24.4],[50.8,28.2],[51.2,30.6],[52.7,34.8],[53.4,35.5],[54.2,35.5],[55.4,39.4],[54.9,39.7],[54.8,40.8],[54.9,41.8],[54.4,42.3],[53.4,41.8],[55.9,48.1],[57,48.5],[56.5,54.2],[53.1,56.5],[52.4,57.2],[53.2,58],[56.8,60.9],[57.3,62.1],[57.8,64],[58.1,66.7],[60.2,64.6],[66.1,64.5],[65.2,61.5],[65,59.3],[65.7,53.3],[65.6,51.9],[65.3,49.5],[65,48.3],[64.2,47.5],[63.5,46],[62.9,43.8],[62,43.1],[60.8,40.5],[60.8,39],[62.4,37.2],[62.5,36.3],[59.9,34.5],[59.2,32.9],[58.4,30.3],[57.7,28.9],[57.4,28.2],[56.5,28],[56.7,24.6],[56.5,24.2],[55.7,24.1],[54.8,24.8],[53.4,24.3],[52.5,24.1],[52.2,23.5],[51.7,23.5]]
					},
					{
						type: 'forest',
						coords: [[39.6,97.5],[39.6,99],[38.7,101.5],[37.7,103.3],[35.9,102.1],[35.4,106.7],[37.4,111.8],[34.7,111.9],[32,112.7],[29.3,113.4],[29.6,115.1],[29.8,116.7],[28.7,118.5],[22.7,112],[21.9,109.3],[22.1,106.3],[21.2,105.5],[19.7,104.8],[18.5,104.9],[17.6,106],[15.6,107.4],[14.7,107.7],[13,107.7],[11.8,107.5],[14.9,103.4],[15.1,105.2],[15.9,105.4],[16.5,104],[16,100.3],[14,100.1],[12.9,99.8],[11,100.3],[9.2,100.8],[7.2,102.5],[3.9,105.4],[1.7,105.6],[-0.2,103.3],[16.8,97.5],[17.5,97.3],[22.7,96.4],[23.6,95.7],[23.2,94.8],[19.7,94.7],[18.2,94.8],[17.7,93],[21.9,91.5],[24.2,89.9],[24.5,89.3],[24.8,88.8],[25.5,87.8],[26.4,85.9],[27.8,87.4],[27.4,93.3],[27.5,95],[28.2,96],[29.7,98.3],[30.8,97.4],[31.5,97],[34,93.9],[34.2,93.9],[34.6,98.4],[35.6,98.8],[36.5,99.9],[37.1,98.9],[37.4,96.6],[39,96]]
					},
					{
						type: 'desert',
						coords: [[32.1,29.9],[25.8,31.4],[19.3,36.2],[12.6,41.5],[11.3,49],[17.8,62.2],[20.1,66.6],[21.3,70.1],[24.2,71.5],[27.1,73.3],[28.1,75.1],[29.7,70.7],[33.3,71.5],[33.1,73.8],[35.2,73.3],[36.3,75.9],[35.3,79.3],[32.2,79.1],[30.4,81.4],[29.5,84.7],[28.9,90.2],[34.7,97.7],[36.6,98.3],[38.7,96.7],[39.8,99.1],[39,102.5],[37.4,108.5],[40.4,109],[41.5,113.4],[41.8,116],[42.2,119.2],[45,117.2],[46.6,111.6],[47.8,104.6],[49.5,100.2],[50.3,94.9],[51.3,93.2],[50.2,90],[48.5,85.6],[48.2,84.9],[48.2,83.3],[50.3,81.2],[51.9,83],[52.7,76.3],[51.7,73.5],[52.1,70.8],[52.2,68.4],[51.4,65.9],[50.8,62.2],[50.8,59.7],[51.2,57.6],[51.3,53.4],[51.9,51],[51.6,47.4],[50.5,45.2],[49.7,43],[48,43.6],[46.7,44.5],[43.3,47.4],[42,47.6],[40.8,47.3],[40.2,44.5],[40.7,43.2],[41.5,42],[41.5,39.5],[39.8,38.5],[40,37.2],[40.4,35.1],[40.8,32.1],[40.1,30.6],[39,30.5],[39.3,29.5],[39,28.1],[37.8,29],[36.6,29.3],[35.5,29.2],[34.7,28.7]]
					},
					{
						type: 'desert',
						coords: [[36.1,-9],[36.6,-7.4],[37,-7.1],[38,-6.8],[38.4,-6.2],[38.8,-5.4],[38.8,-4.7],[39,-4.3],[39.5,-4.2],[39.9,-4.3],[40.3,-4.5],[40.7,-6.1],[41,-6.4],[41.2,-6.4],[41.5,-6.4],[42.5,-5.8],[42.7,-4.5],[42.8,-4.1],[42.7,-3],[42.7,-2.3],[42.6,-2],[42.5,-1.1],[42.3,-0.5],[41.4,0.8],[40.4,-1.1],[40.5,-2],[39.9,-2.2],[39.2,-1.5],[38.1,-1.1],[38,-1.1],[36.2,-1.8],[36.1,-2.9],[36.1,-3.7],[35.1,-5.2],[35,-7.2],[35.5,-9.6],[35.9,-11.9]]
					},
					{
						comment: 'Kaspi',
						type: 'lake',
						coords: [[45.5,52.9],[46.2,53.1],[47,51],[46.6,49.1],[46.1,47.3],[45,47.2],[44.3,47.2],[43.8,47.7],[43,47.6],[42.4,48.2],[41.7,48.9],[40.8,50],[40.4,50.3],[40,49.5],[39.4,49.3],[37.8,49.1],[37.7,49.8],[37.2,50.4],[36.8,51.3],[36.8,52.5],[37,53.2],[37.2,53.4],[38.3,53.9],[40.5,52.7],[40.8,53.7],[40.9,54.7],[42.2,53.4],[42.1,52.9],[42.6,52.8],[42.8,52.2],[43.9,50.9],[44.3,50.3],[44.8,50.1],[44.7,50.8],[44.5,51.1],[44.9,51.4],[45.3,51.5],[45.5,52.1],[45.4,52.5]]
					},
					{
						comment: 'Baikal',
						type: 'lake',
						coords: [[51.6,103.8],[51.4,104.5],[52.2,106.2],[52.7,107.8],[53,108.3],[53.2,108.6],[54.1,109.6],[54.7,109.5],[55.4,109.8],[55.8,109.5],[53.5,107.6],[52.6,106.1],[51.8,104.3],[51.8,103.7]]
					}
				]
			},
			{
				comment: 'Sicily & Sardigna',
				type: 'field',
				coords: [[38.3,15.6],[38.2,15.5],[38.1,15.5],[37.9,15.3],[37.8,15.2],[37.6,15.2],[37.5,15.1],[37.3,15.1],[37.3,15.2],[37.2,15.2],[37,15.3],[37,15.2],[36.9,15.1],[36.7,15.1],[36.6,15.1],[36.6,15],[36.7,14.8],[36.7,14.6],[36.8,14.4],[37,14.2],[37.3,13.6],[37.5,13.1],[37.6,12.9],[37.6,12.6],[37.8,12.4],[38,12.5],[38.1,12.9],[38.2,13.1],[38.2,13.3],[38.1,13.5],[38,13.9],[38,14.2],[38.1,14.7],[38.2,14.8],[38.2,14.9],[38.1,15.1],[38.2,15.3],[38.3,15.5]]
			},
			{
				comment: 'Sardigna',
				type: 'field',
				coords: [[39.1,9.6],[39.8,9.7],[40.1,9.6],[40.4,9.5],[40.5,9.8],[41.1,9.5],[41.3,9.2],[41,8.8],[40.8,8.5],[40.9,8.2],[40.7,8],[40.4,8.4],[40,8.4],[39.9,8.5],[39.3,8.4],[39.2,8.4],[38.9,8.7],[39,9],[39.2,9.3]]
			},
			{
				comment: 'Corsica',
				type: 'field',
				coords: [[43,9.4],[42.8,9.5],[42.6,9.4],[42.3,9.5],[42.1,9.5],[41.9,9.4],[41.7,9.4],[41.5,9.3],[41.4,9.2],[41.5,9],[41.6,8.8],[41.7,8.9],[41.7,8.8],[41.8,8.7],[42,8.6],[42.1,8.7],[42.3,8.6],[42.4,8.6],[42.7,9],[42.7,9.1],[42.7,9.3],[42.9,9.3],[43,9.3]]
			},
			{
				comment: 'Cyprus',
				type: 'field',
				coords: [[35.6,34.5],[35.6,34.4],[35.4,34.1],[35.3,33.9],[35,34],[34.9,33.8],[35,33.7],[35,33.5],[34.8,33.6],[34.8,33.4],[34.7,33],[34.6,33],[34.7,32.8],[34.7,32.6],[34.8,32.4],[35.1,32.2],[35.1,32.4],[35.2,32.5],[35.2,32.7],[35.2,32.9],[35.4,32.9],[35.3,33.6],[35.4,33.8],[35.5,34.1],[35.6,34.3]]
			},
			{
				comment: 'Kriti',
				type: 'desert',
				coords: [[35.3,26.2],[35,26.1],[35,25.8],[35,25.3],[34.9,25.1],[35.1,24.8],[35.3,23.6],[35.6,23.5],[35.6,24.1],[35.4,25.1],[35.4,25.5],[35.4,25.8],[35.2,26.1],[35.3,26.2]]
			},
			{
				comment: 'Iceland',
				type: 'field',
				coords: [[65.5,-24.5],[65.4,-23.9],[65.6,-22.6],[65.4,-22.1],[65.1,-22.3],[64.9,-24.1],[64.8,-23.9],[64.7,-22.5],[64.2,-21.9],[64,-22.8],[63.8,-22.7],[63.4,-18.7],[63.6,-17.8],[64,-16.3],[64.7,-14.1],[65.7,-14.5],[66.5,-15.9],[66.5,-16.6],[66.2,-16.6],[66.2,-17],[66.3,-18.3],[66,-18.6],[66.1,-19.7],[66.1,-20.5],[65.6,-20.8],[65.5,-21.4],[66.2,-22.1],[66.4,-22.4],[66.2,-23.8],[65.8,-23.8],[65.7,-24.1],[65.6,-24.5]]
			},
			{
				comment: 'Sri lanka',
				type: 'field',
				coords: [[9.6,79.8],[9.4,80.1],[8.6,79.9],[7.9,79.7],[7.2,79.8],[6.5,79.9],[6,80.3],[6,80.9],[6.3,81.5],[7.3,81.9],[7.9,81.7],[8.5,81.3],[9.4,80.7],[9.8,80.2],[9.7,79.9]]
			},
			{
				comment: 'Australia',
				type: 'desert',
				coords: [[-10.9,142.1],[-14.5,143.6],[-14.1,145],[-15.9,145.6],[-17.6,146],[-18.4,145.8],[-19.7,147.6],[-21.1,149.5],[-22.4,149.6],[-22.6,150.3],[-23.8,151.3],[-25.2,152.9],[-28,153.5],[-30.4,152.8],[-32.2,152.1],[-33.5,151],[-35.6,149.9],[-37.4,149.6],[-37.5,147.7],[-38.8,145.8],[-38.2,144.6],[-38.8,143.1],[-38.3,141.2],[-37.7,139.9],[-35.4,139.1],[-34.9,138],[-32.3,137.8],[-34.5,135.5],[-31.5,131.4],[-31.7,128.9],[-32,126.2],[-33.2,123.9],[-33.9,123.6],[-33.8,119.8],[-34.9,118],[-34.8,116.1],[-34,114.9],[-31.5,115.5],[-30.7,114.7],[-29.3,114.9],[-26.9,113.3],[-26.2,114.2],[-24.7,113.2],[-22.3,114],[-20.6,116.9],[-19.7,119.2],[-19.6,121.4],[-18.1,122],[-16.3,122.6],[-16.7,124],[-14.6,125.4],[-14,126.7],[-14.9,128.3],[-14.9,129.4],[-12.8,130.2],[-11.6,131.1],[-11.3,132.5],[-11.9,136.6],[-14.5,135.2],[-16.3,138.2],[-17.4,140.5],[-15,141.2],[-12.6,141.3],[-11.7,141.7]],
				sub: [
					{
						type: 'field',
						coords: [[-33.6,113.5],[-32,115.6],[-32.5,116.7],[-33.7,118.7],[-34.6,128.1],[-35.9,133],[-37.4,137.2],[-37.8,139],[-36,144.8],[-34.9,145.9],[-34.6,146.6],[-33.5,147.3],[-33.3,148],[-31.1,147],[-30.9,146.8],[-23.7,144.5],[-21.5,143.3],[-21,142.6],[-20.6,141.8],[-20.3,141.2],[-19.8,140.7],[-19.4,137.1],[-19,135.7],[-17.1,133.9],[-16.5,131.6],[-18.4,127.3],[-17.6,124.7],[-15.7,122.5],[-14.3,122.4],[-12.1,123.1],[-6.6,129.9],[-5.8,137.6],[-7.7,150],[-14.9,155],[-21.9,158.2],[-26,159],[-33.8,158.8],[-37.9,157.6],[-43.2,150.5],[-43.4,142.2],[-43,138.8],[-36.6,111.8],[-33.9,111.8],[-32.7,112.8]]
					}
				]
			},
			{
				comment: '',
				type: 'field',
				coords: [[-40.8,144.5],[-42.9,145.2],[-43.5,146.3],[-43.1,147.9],[-42.1,148.1],[-41.2,148.1],[-41.1,146.3],[-40.7,145.4]]
			},
			{
				comment: 'Sakhalin',
				type: 'field',
				coords: [[46,141.9],[46.6,141.7],[47.1,142],[47.7,141.9],[48.1,142.2],[48.5,142],[48.7,141.8],[49.6,142.1],[50.3,142.1],[50.6,142],[51,142.2],[51.6,141.9],[52,141.7],[52.4,141.7],[52.8,141.8],[53.1,141.9],[53.5,141.9],[53.5,142.2],[53.7,142.7],[54.2,142.3],[54.4,142.7],[53.9,143],[53.1,143.1],[52.8,143.4],[52.2,143],[51.1,143.5],[50.4,143.7],[49.7,144.1],[49.1,144.4],[49,144.2],[49.4,143.3],[49.1,142.9],[48.5,142.8],[48,142.5],[47.5,142.8],[46.7,143.2],[46.3,143.5],[46.2,143.3],[46.6,143.1],[46.7,142.7],[46.6,142.4],[46.2,142.2]]
			},
			{
				comment: 'GB',
				type: 'field',
				coords: [[50.1,-5.6],[50,-5.2],[50.4,-4.3],[50.2,-3.7],[50.6,-3.5],[50.8,-2.9],[50.6,-1.9],[50.8,-1.4],[50.8,-0.4],[50.8,0.2],[50.9,0.9],[51.2,1.3],[51.4,1.4],[51.4,0.7],[51.7,0.7],[52.1,1.5],[52.6,1.7],[52.9,1.3],[52.9,0.5],[52.8,0.4],[52.9,0],[53.1,0.4],[53.5,0.1],[53.6,-0.1],[53.7,0.1],[54.1,-0.3],[54.4,-0.5],[54.7,-1.2],[55.1,-1.5],[55.5,-1.6],[55.9,-2.1],[56,-2.7],[56,-3.3],[56.2,-3.1],[56.3,-2.6],[56.4,-3],[56.6,-2.7],[56.8,-2.4],[57.1,-2.1],[57.3,-2],[57.5,-1.8],[57.7,-1.9],[57.7,-2.4],[57.7,-3],[57.7,-3.5],[57.5,-4.2],[57.6,-4.2],[57.7,-4.1],[57.8,-3.9],[57.9,-4.1],[58,-4],[58,-3.8],[58.6,-3.1],[58.7,-3.6],[58.6,-4.4],[58.7,-5],[58.3,-5.3],[58.1,-5.4],[57.8,-5.8],[57.4,-5.9],[57.6,-6.2],[57.5,-6.6],[56.7,-6.1],[56.4,-6.4],[56.3,-6.1],[56.4,-5.7],[56,-5.6],[55.5,-5.8],[55.3,-5.5],[55.7,-5.3],[55.8,-5.1],[55.5,-4.8],[55.2,-4.9],[55,-5.2],[54.8,-4.6],[54.9,-4],[55,-3.4],[54.9,-3.3],[54.5,-3.6],[54.1,-3.3],[54.2,-2.8],[54.1,-2.7],[53.8,-3.1],[53.3,-3.2],[53.3,-3.8],[53.4,-4.4],[53.1,-4.3],[52.7,-4.6],[52.8,-4.3],[52.5,-4.1],[52.2,-4.4],[52,-4.8],[51.9,-5.2],[51.6,-5],[51.7,-4.4],[51.6,-4.3],[51.6,-3.8],[51.4,-3.4],[51.6,-2.8],[51.5,-2.7],[51.4,-3],[51.2,-3.1],[51.2,-3.2],[51.2,-3.8],[51.2,-4.2],[51,-4.2],[51,-4.5],[50.7,-4.6],[50.5,-5],[50.3,-5.2],[50.2,-5.6]]
			},
			{
				comment: 'Ireland',
				type: 'field',
				coords: [[51.5,-9.4],[51.7,-8.3],[52.2,-7.3],[52.3,-6.7],[52.2,-6.4],[52.9,-6.1],[53.4,-6.2],[53.9,-6.3],[54,-6.5],[54.1,-6],[54.4,-5.7],[54.8,-5.7],[55.2,-6.1],[55.1,-6.9],[55.1,-7.2],[55.3,-7.2],[55.3,-7.7],[55.2,-8.4],[54.9,-8.4],[54.7,-8.9],[54.5,-8.4],[54.4,-8.4],[54.2,-8.6],[54.2,-9.3],[54.2,-9.9],[53.8,-9.9],[53.5,-10.2],[53.2,-9.7],[53.3,-9.2],[53.1,-9.1],[53,-9.4],[52.6,-9.6],[52.3,-9.9],[52.2,-10.5],[51.7,-10.2]]
			},
			{
				comment: 'South America',
				type: 'desert',
				coords: [[-54.7,-65.2],[-54.6,-66],[-54.4,-66.5],[-54.2,-66.9],[-53.8,-67.7],[-53.3,-68.1],[-53.2,-68.6],[-52.9,-68.3],[-52.6,-68.7],[-52.3,-68.5],[-51.6,-69],[-51.5,-69.5],[-51.3,-69.1],[-50.7,-69.2],[-50.3,-69],[-50.2,-68.4],[-50,-68],[-49.5,-67.7],[-49.1,-67.8],[-48.8,-67.2],[-48.5,-66.8],[-48.3,-66.4],[-48,-66],[-47.2,-65.7],[-47,-66.8],[-46.5,-67.6],[-45.8,-67.6],[-45.2,-66.8],[-45,-65.7],[-44.7,-66],[-44.4,-65.3],[-43.9,-65.3],[-43.6,-65.4],[-43,-64.4],[-42.6,-65.1],[-42.4,-64.6],[-42,-65.1],[-41.5,-65],[-40.7,-65.1],[-41.1,-63.9],[-41.1,-63.1],[-40.6,-62.2],[-40.3,-62.5],[-39.7,-62.2],[-39.3,-62.3],[-38.8,-62.6],[-38.8,-62],[-38.9,-61.4],[-38.8,-59.9],[-38.5,-58.4],[-38.1,-57.5],[-37.7,-57.6],[-37.3,-57],[-36.4,-56.7],[-36,-57.5],[-35.5,-57.2],[-34,-58.8],[-34.2,-57.5],[-34.8,-56.3],[-34.7,-54.8],[-33.8,-53.7],[-32.9,-52.7],[-32.5,-53.2],[-32.4,-52.3],[-31.4,-51.9],[-30.1,-51.5],[-30.2,-50.9],[-30.9,-50.9],[-30.3,-50.2],[-29.5,-50.1],[-28.4,-48.9],[-25.3,-49],[-24.3,-46.6],[-23,-44.4],[-22.9,-43.4],[-22.6,-43.3],[-23,-43],[-22.8,-42],[-22.5,-42],[-22.2,-41.6],[-22,-41],[-21.5,-41.1],[-20.8,-40.7],[-20.4,-40.3],[-19.3,-39.7],[-18.8,-39.8],[-18.3,-39.7],[-17.8,-39.3],[-16.8,-39.3],[-15.9,-38.9],[-14.9,-39.1],[-14.1,-39],[-13.7,-39.1],[-12.6,-38.8],[-12.9,-38.3],[-11.5,-37.4],[-10.5,-36.6],[-9.6,-35.7],[-8.7,-35.2],[-7.5,-34.8],[-6.5,-35],[-5.2,-35.4],[-5,-36.8],[-4.9,-37.3],[-4.6,-37.7],[-3.8,-38.6],[-3.2,-39.6],[-3,-40.1],[-2.8,-40.8],[-3,-41.4],[-2.7,-41.8],[-2.8,-42.3],[-2.3,-43.4],[-2.8,-44.4],[-2.9,-44.8],[-2.2,-44.6],[-1.9,-44.6],[-1.6,-45.2],[-1.9,-45.3],[-1.7,-45.5],[-1.4,-45.7],[-1.1,-46.2],[-1,-47.1],[-0.6,-47.2],[-0.8,-48.1],[-1.2,-48.5],[-0.3,-48.5],[-0.1,-49.5],[0.2,-50.5],[1,-49.9],[1.7,-49.9],[1.8,-50.6],[4,-51.2],[4.6,-51.9],[5.3,-52.9],[5.7,-54.1],[5.9,-55.3],[6,-56.6],[6,-57.1],[6.8,-58.1],[6.8,-58.5],[7.5,-58.5],[8.5,-59.9],[8.5,-60.8],[9.4,-60.8],[9.9,-61.6],[9.9,-62.6],[10.5,-62.8],[10.7,-62.6],[10.6,-63.9],[10.2,-64.9],[10.4,-66],[10.7,-66.2],[10.5,-68.2],[11.2,-68.4],[11.6,-69.5],[11.2,-70.8],[9.6,-71],[9.1,-71.2],[9.2,-71.8],[9.7,-72.2],[10.5,-71.9],[11.2,-71.9],[11.5,-72],[12,-71.2],[12.5,-71.6],[11.8,-72.6],[11.2,-73.5],[11.4,-74.2],[10.6,-74.6],[11.1,-74.8],[10.5,-75.6],[9.4,-75.7],[9.3,-76.1],[8.7,-76.5],[8.7,-76.9],[8,-76.8],[8.7,-77.5],[9.4,-78.5],[9.6,-79.5],[9.1,-80.4],[8.8,-81.4],[8.9,-81.8],[9.1,-82.2],[9.4,-82.5],[8.2,-82.9],[8.2,-81.8],[7.6,-81.4],[7.2,-80.8],[7.6,-80],[8.2,-80.6],[9,-79.7],[8.5,-78.3],[7.9,-78.4],[6.5,-77.5],[5.5,-77.5],[4.3,-77.6],[3.7,-77.2],[2.7,-77.8],[2.5,-78.7],[1.7,-79],[1.2,-78.8],[0.7,-80.2],[-0.4,-80.5],[-1,-80.5],[-0.9,-80.9],[-2.3,-81],[-2.8,-80.4],[-2.1,-80],[-2.6,-79.6],[-3.4,-80.1],[-4.4,-81.4],[-5.7,-80.9],[-6.1,-81.2],[-6.7,-79.9],[-8.1,-79.2],[-9.3,-78.6],[-12.2,-77],[-13.5,-76.3],[-14,-76.3],[-14.7,-76],[-15.3,-75.2],[-16.2,-73.7],[-16.9,-72.4],[-17.3,-71.4],[-18.3,-70.4],[-19.7,-70.1],[-20.5,-70.3],[-21.4,-70.1],[-22.3,-70.3],[-23.1,-70.4],[-23.4,-70.7],[-24.2,-70.6],[-25.2,-70.4],[-25.8,-70.8],[-26.3,-70.7],[-27.3,-71],[-28.1,-71.2],[-28.9,-71.5],[-29.5,-71.4],[-30.3,-71.8],[-32.4,-71.5],[-33,-71.8],[-33.7,-71.7],[-34.1,-72.1],[-35.1,-72.3],[-37.2,-73.2],[-37.5,-73.7],[-38.1,-73.5],[-38.8,-73.4],[-39.9,-73.2],[-39.9,-73.7],[-41.1,-74],[-41.9,-73.5],[-41.2,-72.8],[-42,-72.7],[-43.6,-73],[-44.8,-73.1],[-45.6,-73.4],[-45.6,-74.3],[-47.4,-74.4],[-48.3,-74.5],[-49.5,-74.5],[-51,-74.7],[-52,-73.9],[-52.9,-73.1],[-53.3,-72.6],[-53.9,-71.2],[-54.8,-70.9],[-55,-68.7],[-55.2,-67.1],[-55,-66.4],[-54.9,-66],[-54.7,-65.2]],
				sub: [
					{
						type: 'field',
						coords: [[-2.6,-81.3],[-5.5,-79.6],[-7.8,-77.6],[-12,-73.2],[-12.9,-70.1],[-14.2,-68.1],[-18.7,-65.7],[-22.6,-64.9],[-26.1,-65.9],[-29.8,-68.8],[-32.6,-67.2],[-37.7,-66],[-40.4,-63.3],[-41.8,-60.5],[-36.9,-47.2],[-29.1,-36.7],[-19.5,-31.9],[-6,-29.5],[2.4,-36.9],[8.9,-45.6],[15.9,-62.4],[16.2,-73.7],[12.4,-83.4],[7.1,-86.8],[1.5,-84],[-2,-81.6]],
						sub: [
							{
								type: 'forest',
								coords: [[-3.9,-46.6],[-4.2,-48.8],[-6.2,-50.7],[-8.6,-52],[-12.1,-53],[-12.4,-55.2],[-10.7,-55.2],[-10,-56.7],[-9.7,-57.8],[-13,-60.5],[-18.1,-59.3],[-15.5,-64.4],[-17.2,-64.2],[-15.7,-67.7],[-7.6,-77.8],[0.3,-77.4],[7.2,-64.3],[7.9,-60],[5,-57.9],[-3.4,-48.1],[-4.1,-44.2],[-5.4,-43]]
							}
						]
					}
				]
			},
			{
				comment: 'Falcland/Malvina',
				type: 'desert',
				coords: [[-51.7,-57.8],[-51.8,-58.1],[-51.8,-58.9],[-51.9,-58.9],[-52.1,-59.1],[-51.8,-59.5],[-51.9,-60.2],[-52.1,-60.9],[-51.7,-60.4],[-51.4,-60],[-51.4,-59.7],[-51.4,-59.3],[-51.4,-59.2],[-51.3,-58.8],[-51.4,-58.3],[-51.4,-58]]
			},
			{
				comment: 'Cuba & Caribean',
				type: 'field',
				coords: [[21.9,-84.6],[21.9,-84],[22.7,-82.4],[22.7,-82],[22.3,-82],[22.1,-80.8],[21.7,-79.7],[21.5,-79.2],[21.5,-78.8],[21.2,-78.5],[20.9,-78.3],[20.6,-77.4],[20.3,-77.2],[20.2,-77.5],[19.8,-77.7],[19.8,-77.3],[19.8,-75.3],[20,-74.5],[20.7,-75.5],[21,-75.7],[21.3,-76.1],[22.5,-79.5],[22.9,-80],[23.3,-81.9],[23.1,-82.7],[23.1,-83.5],[22.9,-83.9],[22.3,-84.5]],
			},
			{
				comment: '',
				type: 'field',
				coords: [[18.5,-74.5],[18.2,-74],[18.1,-72.4],[18.2,-72],[17.8,-71.6],[17.8,-71.3],[18.3,-70.2],[18.5,-69.5],[19.9,-72.5],[19.8,-73.3],[19.6,-73.5],[19.4,-73.1],[19.1,-72.9],[18.6,-73],[18.6,-73.6],[18.6,-74.1]]
			},
			{
				comment: '',
				type: 'field',
				coords: [[18.4,-78.3],[17.9,-77.4],[17.9,-76.9],[17.9,-76.4],[18.6,-77],[18.7,-77.8],[18.6,-78.2]]
			},
			{
				comment: '',
				type: 'field',
				coords: [[18,-67.1],[18,-66.6],[17.9,-66.1],[18.2,-65.7],[18.6,-67.2],[18.2,-67.2]]
			},
			{
				comment: 'North America',
				type: 'desert',
				coords: [[8.9,-79.6],[9.1,-79.8],[9,-80.1],[9.3,-79.9],[9.4,-79.9],[9.2,-80.3],[9,-80.7],[8.9,-81],[8.8,-81.6],[9.1,-81.8],[9,-82.2],[9.5,-82.6],[10,-83.2],[10.9,-83.6],[11.4,-83.9],[11.7,-83.7],[11.9,-83.8],[12.4,-83.8],[12.9,-83.5],[13.7,-83.5],[14.3,-83.3],[14.8,-83.4],[15.2,-83.4],[15.3,-83.9],[15.7,-84.1],[15.9,-84.5],[16,-85],[15.9,-85.5],[16,-85.9],[15.8,-86.5],[15.9,-86.8],[15.8,-87.3],[15.7,-87.7],[15.9,-87.7],[15.8,-88.3],[15.9,-88.5],[15.8,-88.7],[16,-88.9],[16.3,-88.6],[17,-88.2],[17.4,-88.4],[17.8,-88.3],[18.2,-88.1],[18.4,-88.4],[18.9,-88.1],[18.3,-87.9],[19.3,-87.5],[19.5,-87.5],[19.7,-87.7],[19.9,-87.4],[20.2,-87.5],[20.5,-87.2],[20.9,-86.8],[21.2,-86.8],[21.6,-87.1],[21.4,-87.3],[21.6,-88.1],[21.4,-89.1],[21.1,-90.2],[20.5,-90.5],[19.7,-90.7],[18.9,-91.4],[18.6,-91.4],[18.4,-91.9],[18.7,-92.1],[18.2,-94.1],[18.6,-95.2],[19.6,-96.4],[21,-97.3],[22.9,-98],[24.8,-98.1],[25.4,-97.7],[25.9,-97.1],[27,-97.7],[28.6,-96.8],[29,-95.4],[29.4,-95.3],[29.7,-93.1],[29.9,-91.5],[29.4,-90.3],[30.6,-87.9],[30.4,-86.1],[29.8,-85.1],[30.3,-84],[29.4,-83.1],[28.9,-82.6],[27.9,-82.8],[26.8,-82.1],[25.2,-80.7],[25.4,-80.3],[26.7,-80.1],[27.5,-80.5],[28.3,-80.8],[30,-81.4],[30.9,-81.7],[32.1,-81.1],[32.7,-79.8],[33.5,-79.2],[34,-78.1],[34.7,-77.4],[34.8,-76.3],[35.4,-76.7],[35.9,-75.9],[36.8,-76.1],[37.5,-76.6],[38.7,-77.4],[38.6,-76.5],[39.4,-76.5],[39.6,-76.2],[38.4,-75.9],[38.5,-75],[39.3,-75.3],[39.3,-74.8],[40.2,-74.1],[40.7,-74.1],[40.8,-72.9],[41.2,-73.1],[41.6,-71.3],[41.7,-70.5],[42.4,-71],[43.5,-70.4],[44.3,-69],[44.8,-67.3],[45.2,-66.9],[45.7,-64.8],[45.5,-64.3],[45.2,-64.4],[44.5,-66],[43.5,-65.8],[44.3,-64.1],[44.8,-63],[45.3,-61.4],[45.9,-59.9],[46.3,-60.1],[47.1,-60.7],[46,-61.6],[45.8,-63],[46.5,-64.6],[47.5,-65],[48,-65.5],[48.8,-64.4],[49.3,-65.2],[48.8,-67.7],[48.2,-68.9],[47.1,-70.4],[47.4,-70.8],[48.3,-69.9],[49.2,-68.7],[49.4,-67.3],[50.2,-66.8],[50.5,-63.9],[50.2,-61.7],[50.3,-60.1],[51.4,-58.5],[51.5,-57],[52.2,-55.8],[52.8,-56],[53.3,-56],[53.7,-57],[54.3,-57.9],[54.1,-59.4],[54.6,-58.8],[55.2,-59.3],[55.8,-60.9],[56.5,-61.7],[57.2,-61.7],[58.2,-62.7],[59.3,-63.7],[60.5,-64.7],[59.7,-65.6],[59.2,-65.6],[58.8,-66.3],[58.3,-67.6],[58.8,-68.5],[59,-69.8],[59.5,-69.5],[60.6,-69.9],[61.2,-71.4],[61.6,-71.6],[62.5,-73.8],[62.3,-75.2],[62.6,-77.6],[62.3,-78.6],[61.6,-77.7],[60.9,-78.1],[58.8,-78.5],[58.1,-77.3],[57.1,-76.6],[56.2,-76.7],[55.3,-77.6],[54.9,-78.8],[54.7,-79.7],[54.1,-79.1],[52.8,-78.8],[52.3,-78.5],[51.9,-78.8],[51.2,-79.8],[51.5,-80.6],[52.4,-81.5],[53.1,-82.3],[54.3,-82.6],[55.1,-82.3],[55.3,-83.9],[55.3,-85],[55.6,-85.9],[56,-87.4],[56.4,-87.9],[56.8,-89],[57.3,-90.9],[57,-92.8],[57.5,-92.5],[58.7,-93.2],[58.8,-94.6],[59.4,-94.8],[60.3,-94.7],[61.5,-93.7],[62.4,-92.8],[62.7,-92.1],[63,-91],[63.4,-90.9],[63.9,-93.2],[63.8,-90.2],[64.1,-88.4],[65.2,-87.1],[65.3,-89.1],[65.8,-89.8],[65.6,-87.2],[66,-86.1],[66.4,-86.8],[66.6,-85.8],[66,-84],[66.4,-83.3],[67.2,-81.5],[67.7,-81.7],[68.5,-82.6],[69.1,-81.8],[69.7,-83.7],[69.7,-85.6],[68.7,-85.8],[67.3,-87.2],[68.2,-88.5],[69.1,-88.6],[69.1,-89.9],[68.3,-90.1],[69.2,-91.3],[69.7,-92.9],[70.2,-92.5],[71.2,-92.9],[73.7,-91.4],[74.1,-95.2],[72.1,-95.8],[70.8,-97.1],[69.7,-95.9],[68.9,-94],[67.7,-96.6],[68.6,-97.3],[69.7,-97.2],[69.7,-98.9],[68.6,-99.5],[67.9,-99.1],[68,-102.9],[68.5,-105.9],[67.9,-109.8],[67.7,-114.9],[68.5,-114.7],[69,-116.2],[69.4,-120.4],[69.6,-123.5],[70.3,-127.4],[69.1,-131.7],[68.9,-135.3],[69.6,-141.1],[70.1,-143.4],[70,-146.9],[70.7,-149.8],[70.4,-153.7],[71.5,-157.3],[70.7,-160.3],[69.9,-162.8],[69.1,-163.6],[68.7,-166.8],[67.2,-163],[66.7,-160.4],[66,-163.5],[66.3,-164.6],[65.6,-167.2],[64.8,-165.8],[64.8,-160.9],[63.7,-161],[63.1,-165.7],[61.2,-166.6],[60.3,-165],[60.1,-162.8],[59,-162],[58.7,-159.3],[58.8,-157.1],[57.6,-158],[56.5,-160.3],[55.3,-163.1],[53.4,-167.6],[55.3,-160],[56.9,-156.7],[58.7,-153.5],[59.4,-153.5],[60.9,-152.2],[61.4,-150.4],[59.5,-151],[59.7,-148.4],[60.9,-146.9],[60,-140.5],[58.6,-136.8],[55.4,-132.2],[53.3,-129.6],[51,-125.9],[49.1,-122.3],[49.7,-126.6],[47,-124],[42.5,-124.8],[40.2,-124.4],[37.6,-122.6],[34.7,-120.4],[33.3,-117.9],[30.7,-116.4],[28.1,-114.2],[27.7,-115],[25.7,-112.6],[23.7,-110.6],[22.9,-110.1],[23.3,-109.1],[25.1,-110.5],[26.7,-111.8],[27.9,-112.9],[29.3,-113.8],[30.2,-114.5],[31.7,-114.9],[31.2,-112.9],[27.9,-110.5],[25.4,-108.4],[23.2,-106.2],[21.4,-105.4],[19.7,-105.4],[17.6,-101.2],[15.7,-96.6],[16.2,-94.9],[14.5,-92],[13.9,-89.7],[13.4,-88],[12,-86.7],[11.5,-85.9],[11.9,-85.4],[11.1,-84.7],[10.3,-85.6],[9.7,-84.3],[8.3,-82.6],[7.7,-81.4],[7.6,-80.1],[8.1,-80.5],[8.4,-80],[8.9,-79.7]],
				sub: [
					{
						type: 'field',
						coords: [[24.7,-109.2],[26.7,-108.9],[29.8,-109.4],[31.4,-109.4],[31.7,-108.2],[30.4,-106.9],[29.2,-105.1],[28,-105.3],[22.6,-102.6],[22.8,-99.9],[24.5,-100.6],[31.1,-100],[33.9,-98.5],[35.6,-97.7],[42.4,-101.7],[48.7,-106.5],[47.8,-107.6],[49.7,-110.4],[48.2,-112.7],[45.8,-114],[46.9,-119.1],[43,-122.3],[40.1,-122.4],[37.8,-122.1],[36.6,-124.4],[40.8,-128.2],[45.7,-130.2],[50.2,-132.5],[53.6,-137.7],[56.7,-143.2],[56.1,-150.4],[51.9,-158.2],[49.7,-171.5],[54.6,-178.9],[58.6,-175],[61.4,-172.8],[64.6,-169.8],[66.8,-168.3],[69.6,-168.7],[72.2,-154.9],[71.9,-148.2],[71.6,-139.9],[79.8,-124.8],[83.5,-103.4],[84.4,-79.8],[84.7,-48.9],[84.1,-18.1],[82,-3.5],[73.5,-1.4],[68,-12.5],[65.9,-29],[60.5,-34.3],[54.4,-39],[44.1,-45],[36.9,-54.7],[28,-65.1],[16.5,-64.5],[15.8,-73.3],[14.8,-78.3],[8.9,-74.9],[3.5,-76.8],[3.3,-83],[5.3,-90.6],[9.4,-100.6],[13.8,-108],[19.3,-108.5],[23.8,-108.1],[24.8,-108.9]]
					},
					{
						type: 'lake',
						coords: [[46.5,-84.6],[46.5,-85],[46.6,-85.1],[46.8,-85.7],[46.7,-86.4],[46.5,-87.3],[46.8,-87.8],[46.9,-88.2],[46.8,-88.5],[47,-88.5],[47.3,-88],[47.5,-87.9],[47.5,-88.2],[47.4,-88.6],[47.2,-89],[46.9,-89.5],[46.8,-89.9],[46.6,-90.3],[46.5,-90.8],[46.9,-90.8],[46.9,-91.2],[46.7,-91.6],[46.7,-92.1],[47.1,-91.7],[47.6,-91],[47.7,-90.5],[47.8,-89.9],[48,-89.5],[48.6,-88.9],[48.5,-88.4],[48.7,-88],[48.8,-87.6],[48.9,-86.9],[48.8,-86.7],[48.3,-86.1],[48,-85.9],[47.8,-85.7],[47.9,-85],[47.4,-84.8],[47.1,-84.7]]
					},
					{
						type: 'lake',
						coords: [[44.6,-88],[44.8,-88],[45,-87.6],[45.8,-87],[45.8,-86.8],[45.7,-86.6],[46.1,-85.7],[46.1,-85.2],[46,-84.8],[46.1,-84.7],[46,-84.4],[46,-84.1],[46,-84],[45.9,-83.5],[45.9,-83.2],[45.8,-83.1],[45.8,-82.8],[45.8,-82.6],[45.7,-82.3],[45.6,-81.9],[45.6,-81.8],[45.8,-81.7],[46,-82.3],[46.2,-83.7],[46.4,-83.6],[46.5,-83.1],[45.9,-81.1],[45.7,-80.6],[45.5,-80.4],[45.4,-80.1],[45.1,-79.9],[45,-79.9],[44.8,-80],[44.6,-80.1],[44.6,-80.4],[44.7,-80.7],[45,-81.2],[45.2,-81.3],[45.2,-81.4],[45.3,-81.6],[45.2,-81.7],[45.1,-81.7],[44.9,-81.5],[44.8,-81.4],[44.6,-81.3],[44.4,-81.4],[44.3,-81.6],[44.2,-81.7],[44,-81.8],[43.6,-81.7],[43.4,-81.7],[43.3,-82],[43.1,-82.3],[43.5,-82.6],[43.9,-83.4],[43.8,-83.5],[43.8,-83.8],[44.7,-83.3],[45.2,-83.5],[45.3,-83.5],[45.6,-84.1],[45.6,-84.4],[45.6,-84.6],[45.5,-84.9],[45.4,-85.1],[45,-85.4],[44.9,-85.8],[44.8,-86.1],[44.4,-86.3],[44,-86.4],[43.7,-86.4],[43.5,-86.4],[43.2,-86.3],[42.9,-86.2],[42.3,-86.3],[42.1,-86.5],[41.8,-86.7],[41.8,-87],[42,-87.7],[43.3,-88],[44.6,-87.4],[44.7,-87.3],[45,-87],[45.2,-86.9],[45.3,-86.8],[45.4,-86.8],[45.4,-87.1],[45.2,-87.2],[45.1,-87.3],[44.9,-87.5],[44.8,-87.7],[44.6,-87.8],[44.4,-87.9]]
					}
				]
			},
			{
				comment: 'Canada islands',
				type: 'field',
				coords: [[62.2,-67.2],[62.8,-70.8],[64.4,-75.6],[65.8,-75],[68,-73.2],[70.9,-89.2],[73,-89.2],[73.7,-88.1],[73.8,-85.5],[73.2,-86.2],[72,-86.6],[73.7,-83],[73.3,-77.1],[69.6,-68.3],[68.6,-68.4],[67.1,-62.8],[65.3,-64],[65.7,-66.8],[64.7,-67.1],[63.9,-64.6],[63,-65.5],[63,-67.2]]
			},
			{
				comment: '',
				type: 'field',
				coords: [[69.1,-102],[69.3,-105.1],[69.2,-106.8],[68.8,-113],[72.1,-118.3],[72.4,-118.6],[72.3,-120.1],[71.7,-121],[71.4,-123.5],[74.3,-124.3],[74.6,-121],[73.5,-116.2],[73.3,-114.1],[72.8,-114.1],[72.9,-110.6],[72.5,-109],[73.2,-107.6],[73.4,-106],[71.6,-104.4],[71,-103.3],[70.5,-101.6],[70,-100.3],[69.7,-101.1]]
			},
			{
				comment: '',
				type: 'ice',
				coords: [[82.2,-61.6],[81.6,-67.3],[81.3,-66],[80.8,-68.2],[80.3,-70.5],[79.8,-71.6],[79.4,-74],[79.5,-76.5],[78.4,-74.8],[77.9,-75.5],[77.2,-78.6],[76.6,-86.4],[76.5,-88.7],[75.5,-81.8],[74.6,-91],[76.7,-93.7],[78.8,-89.4],[79.2,-94.6],[80.3,-96],[81.3,-94.1],[80.8,-91.2],[80.4,-85.7],[80.6,-84.9],[81,-88.8],[81.8,-89.7],[82.1,-85.9],[82.6,-82.7],[83.1,-77.7],[83,-69.5],[83,-65.9],[82.7,-63.2]]
			},
			{
				comment: 'JP',
				type: 'field',
				coords: [[45.5,142],[44.7,142.8],[44.2,143.7],[44.1,144.5],[44.3,145.2],[44,145.3],[43.4,145.4],[43.1,145.3],[43,144.6],[42.9,143.8],[42.5,143.4],[42,143.2],[42.4,142.1],[42.6,141.6],[42.4,141.1],[42.4,140.5],[42.2,140.7],[42,141.2],[41.6,141.1],[41.2,141.5],[40.5,141.6],[39.9,141.9],[39.4,141.9],[38.8,141.6],[38.4,141.5],[38.2,141],[37.3,141],[36.7,140.7],[36.2,140.6],[35.1,140.3],[35.4,139.2],[35,139],[34.7,138.8],[34.8,138.3],[34.8,138.1],[34.8,136.8],[34.2,136.3],[33.9,135.1],[34.6,135.2],[33.9,134.5],[33.4,134.1],[33.5,133.4],[33.2,133],[32.9,132.8],[34.4,133.9],[34.7,134.2],[34.6,133.5],[34.2,132.5],[34.1,132.1],[34.1,131.3],[33.7,131.2],[33.3,131.8],[32.8,131.8],[32.2,131.5],[31.5,131.4],[31.2,131],[32.2,130.1],[33,130.3],[33.2,130.1],[33,129.5],[33.4,129.5],[33.8,130.5],[34.1,130.8],[34.4,130.9],[34.7,131.4],[35.1,132],[35.5,132.6],[35.7,133.4],[35.7,134.5],[35.8,135.3],[35.6,135.4],[36,136],[36.3,136.1],[36.9,136.7],[37.5,136.7],[37.6,137.3],[37.5,137.4],[37.1,137],[36.9,137.2],[37.3,138.4],[37.8,138.8],[38.5,139.4],[39.2,139.8],[39.9,140],[40.2,139.9],[40.6,139.9],[41.2,140.4],[41.5,140.1],[41.8,139.9],[42.6,139.7],[43.3,140.3],[43.4,140.8],[43.3,141.2],[43.7,141.3],[44,141.5],[44.6,141.7],[45,141.7],[45.3,141.6]]
			},
			{
				comment: 'TW',
				type: 'field',
				coords: [[21.9,120.8],[22.4,120.9],[22.8,121.2],[23.4,121.4],[24,121.6],[24.6,121.9],[24.9,121.8],[25,121.9],[25.3,121.6],[25.3,121.4],[25.1,121.3],[25,121],[24.7,120.7],[24.4,120.6],[23.9,120.3],[23.3,120],[23.2,120],[22.9,120.1],[22.6,120.3],[22.5,120.3],[22.4,120.6],[22.1,120.7],[22,120.7]]
			},
			{
				comment: 'Hainan',
				type: 'field',
				coords: [[20.1,110.7],[19.8,111],[19.4,110.6],[19,110.5],[18.7,110.4],[18.5,109.8],[18.3,109.5],[18.7,108.4],[19.7,109],[19.9,109.2],[19.9,109.7],[20,110.2]]
			},
			{
				comment: 'NZ',
				type: 'field',
				coords: [[-46.2,166.6],[-46.3,168],[-46.6,169.4],[-45.6,170.7],[-44.6,171.1],[-43.7,173.3],[-43.1,172.8],[-41.1,173.8],[-42.6,170.4],[-44,168.2],[-44.6,166.9],[-45.2,166.6]]
			},
			{
				comment: '',
				type: 'field',
				coords: [[-41.3,175.4],[-40.8,174.8],[-40,175.2],[-35.9,174.2],[-35,173.1],[-34.7,174.2],[-35.4,174.8],[-36.3,175.4],[-37.6,176.5],[-37.5,178.2],[-38.4,178.4],[-39.1,177.8],[-39.4,176.8],[-40.2,176.7],[-40.8,176],[-41.3,175.6]]
			},
			{
				comment: 'Papua New Guinea',
				type: 'field',
				coords: [[-0.8,130.8],[-2,132.6],[-2.6,133],[-3.4,132.5],[-3.8,134.1],[-4.8,137.1],[-5.7,137.8],[-7.3,138.5],[-8.4,137.9],[-8.5,140.4],[-9.1,142.2],[-7.9,144.1],[-8.1,145.8],[-10.1,149.2],[-10.6,150.3],[-10.1,150.4],[-8.5,148.6],[-7,146.7],[-6.8,147.5],[-6.1,147.6],[-5.2,145.7],[-4.4,145.5],[-3.7,143.9],[-2.6,140.8],[-1.3,138],[-2.4,135.8],[-2,134.1],[-0.9,134.2],[-0.2,131.8],[-0.5,130.8]]
			},
			{
				comment: 'Indonesia',
				type: 'field',
				coords: [[6.9,117.1],[6.6,116.4],[6.1,116.2],[5.5,115.3],[4.9,115.1],[5,114.5],[4.6,114],[3.9,113.5],[3.3,113],[3.1,111.8],[1.9,110.9],[1.6,109.9],[1.8,109.4],[0.9,108.7],[-1.5,110],[-2.6,110.1],[-3.1,111.7],[-3.3,113],[-3.4,113.8],[-3.4,114.6],[-4.2,114.6],[-4.2,114.9],[-3.8,115.8],[-3.8,116.1],[-3.5,116.3],[-3.2,116.3],[-2.7,116.2],[-2.4,116.7],[-1.9,116.3],[-1,116.8],[-0.8,117.4],[0.6,117.7],[0.8,117.9],[0.8,118.9],[1,118.9],[1.5,118.6],[2.3,117.9],[3.3,117.4],[4.1,117.7],[4.3,118.1],[4.5,118.6],[4.9,118.1],[5.1,118.7],[5.2,119.1],[5.4,119.1],[5.8,118.3],[5.9,117.8],[6.5,117.5],[6.8,117.1]]
			},
			{
				comment: '',
				type: 'field',
				coords: [[5.6,95.2],[4.9,95.4],[4.2,96],[3.7,96.6],[3.6,96.9],[3.3,97.2],[2.8,97.6],[2.4,97.7],[1.9,98.6],[1.4,98.8],[1,98.9],[0.2,99.4],[-0.1,99.7],[-0.5,100.1],[-1,100.4],[-1.5,100.6],[-1.9,100.9],[-2.6,101],[-2.8,101.4],[-3.2,101.6],[-3.5,102],[-3.9,102.1],[-4.2,102.6],[-4.6,103.1],[-5.1,103.7],[-5.9,104.5],[-5.9,104.7],[-5.8,104.7],[-5.5,104.6],[-5.5,104.7],[-5.7,105],[-5.8,105.2],[-5.8,105.7],[-5.2,105.8],[-4.7,105.9],[-4.2,105.9],[-3.3,105.9],[-3.2,106],[-3,106],[-2.8,105.7],[-2.4,105.6],[-2.3,105.2],[-2.4,104.8],[-2,104.8],[-1,104.3],[-0.9,103.7],[-0.6,103.4],[-0.4,103.6],[-0.3,103.7],[0.1,103.7],[0.3,103.7],[0.6,103.3],[1.6,101.8],[2.1,101.2],[2.3,100.8],[2.9,100.1],[3.4,99.3],[3.8,98.9],[4,98.5],[4.5,98.2],[5.2,97.5],[5.3,97.1],[5.3,96.6],[5.4,96.2],[5.6,95.9],[5.7,95.7],[5.7,95.5]]
			},
			{
				comment: '',
				type: 'field',
				coords: [[-6.7,105.4],[-6.9,106.1],[-6.9,106.5],[-7.3,106.4],[-7.4,107],[-7.4,107.8],[-8.4,112.9],[-8.3,113.3],[-8.5,113.9],[-8.6,114.5],[-8.5,115.4],[-8.8,116.3],[-8.9,117.9],[-8.7,118.2],[-8.7,119.1],[-8,117.7],[-8.4,116.7],[-8.3,115.9],[-7.6,113.8],[-7.3,113],[-7,114],[-6.9,112.7],[-6.4,111],[-6.4,110.5],[-6.6,108.5],[-6.4,108.3],[-6,106.7],[-5.8,106.2],[-6.2,105.8]]
			},
			{
				comment: '',
				type: 'field',
				coords: [[1.8,124.9],[1.6,124.8],[1.4,124.6],[1.3,124.3],[0.9,123.6],[1,122.7],[1.2,121.6],[1.4,120.8],[0.9,120.5],[0.8,120.3],[0.9,120.2],[0.5,119.9],[0,119.8],[-0.4,119.7],[-0.8,119.7],[-1.2,119.3],[-1.7,119.3],[-2.1,119.2],[-2.7,118.8],[-3.5,119.4],[-4.6,119.5],[-5.4,119.4],[-5.6,120.4],[-3.6,120.4],[-2.7,120.5],[-2.7,120.8],[-2.7,121],[-3.2,121.1],[-3.3,121],[-3.5,120.8],[-3.8,121],[-4.1,121.5],[-4.5,121.4],[-4.9,121.9],[-4.9,122.1],[-4.6,122.1],[-4.5,122.7],[-2,121.5],[-1.9,121.4],[-1,122.7],[-0.9,123],[-1,123.3],[-0.7,123.4],[-0.5,123.1],[-0.6,122.6],[-0.8,121.9],[-0.9,121.6],[-1,121.2],[-0.3,120.1],[0.4,120.3],[0.5,121],[0.5,121.8],[0.5,122.3],[0.3,123.3],[0.4,124.4],[0.8,124.6],[1,124.9],[1.3,125.2],[1.5,125.2]]
			},
			{
				comment: '',
				type: 'field',
				coords: [[-10.3,123.3],[-10.2,124.1],[-9.4,125.2],[-8.8,126.6],[-8.3,127.2],[-8.4,126.1],[-8.6,125.5],[-9,124.7],[-9.5,123.8]]
			},
			{
				comment: 'PH',
				type: 'field',
				coords: [[6.5,122],[7.6,122.5],[7.7,123.1],[7.5,123.6],[7.6,124.1],[6.3,124.1],[5.9,124.9],[5.8,125.3],[6.6,126.1],[8,126.4],[8.4,126.3],[9.5,125.8],[9.9,125.6],[9.4,125.1],[9,124.6],[8.7,124.1],[8.7,123.7],[9.3,123.9],[9.6,124.4],[10,124.7],[10.3,125.2],[11,125],[11.4,125.4],[12,125.4],[13.6,123.7],[14.1,123.8],[14.5,121.8],[15.6,121.5],[16.2,121.8],[16.5,122.3],[17.1,122.5],[17.6,122.1],[18.6,120.9],[18.4,120.6],[16.1,120.3],[16.3,119.8],[15.4,119.7],[14.8,120.2],[14.6,120.4],[14.5,120.8],[14.1,120.7],[13.6,121.2],[13.6,121.6],[13.5,122.6],[12.5,122.3],[12.3,121.8],[11.6,122.4],[10.9,121.8],[10.6,122.6],[11.3,123],[10.3,122.9],[9.5,123.8],[8.8,123.1],[8.1,122.6],[7.8,122],[7.3,121.9],[6.8,121.8]]
			},
			{
				comment: 'Hawaii',
				type: 'field',
				coords: [[18.9,204.3],[19.2,204],[19.4,204],[19.8,204],[20.1,204.1],[20.6,203.9],[20.8,204],[20.4,204.2],[20.1,204.7],[19.9,205],[19.5,205.2],[19.4,205.1],[19.3,204.8],[19.2,204.5]]
			},
			{
				comment: 'Greenland',
				type: 'ice',
				coords: [[59.9,-43],[65.2,-39.9],[66.3,-35.5],[68,-31.1],[69.1,-23.9],[70.4,-23.2],[71.5,-24.6],[76.4,-20],[81.3,-13],[81.8,-15.8],[82.2,-26.2],[82.5,-23.2],[83.5,-38.3],[82.6,-46],[82.1,-47.8],[82.2,-51.3],[82,-57.6],[82,-60.1],[80.8,-65.3],[80.1,-66.8],[79.7,-65],[79,-67.1],[78.6,-71.1],[77.4,-67.1],[77,-69.9],[76.5,-68.2],[75.8,-59.5],[73.5,-55.7],[67.1,-50.9],[64.3,-50.9],[61.4,-47.9],[60.6,-46.2]]
			},
			{
				comment: 'North islands',
				type: 'ice',
				coords: [[70.7,57.3],[71.3,56.1],[72,55.6],[72.9,55.9],[74.2,58.1],[74.6,59.5],[75.2,61.2],[75.7,64],[76,66.4],[76.3,68],[76.8,69],[77,66.7],[76.7,65.8],[76.5,64.8],[76.3,63.4],[76.3,61.5],[76,59.8],[75.7,57.9],[75.1,56.5],[74.3,55.5],[73.8,53.8],[73.3,53.8],[73.1,53.1],[72.6,52.2],[72,52.2],[72,51.6],[71.4,51.5],[71.5,52.9],[71.1,53],[70.8,54.1],[70.6,55.2]]
			},
			{
				comment: 'Spitsbergen',
				type: 'ice',
				coords: [[76.7,16.8],[77.2,17.5],[77.6,17.4],[77.6,18.4],[78.2,18.6],[78.5,19.1],[78.7,20.3],[78.3,21.1],[78.1,20.5],[77.5,22.2],[77.3,22.9],[78,24.1],[78.4,22.9],[78.5,22],[79.1,19.9],[79.4,19.2],[79.5,18.6],[79.7,18.8],[79.7,20.4],[79.3,24],[80.3,23.3],[80.4,22.7],[80.4,19.8],[80.2,18.9],[80.1,18.4],[79.9,18.2],[80,16.8],[80,15.7],[79.7,15.7],[79.5,15.4],[79.8,14.8],[79.6,13.5],[79.8,13.8],[79.7,10.9],[78.9,12.1],[78.8,11.5],[78.4,14.4],[78.8,15],[78.5,15.7],[78.2,15.4],[78.1,14],[77.8,13.7],[77.8,15.2],[77.8,15.8],[77.6,16],[77.6,15],[77.4,14.1],[77.2,15],[77,15.5]]
			},
			{
				comment: '',
				type: 'ice',
				coords: [[78,100.1],[78.2,102],[78.2,103.9],[78.5,105.4],[78.8,105.1],[79,103.8],[79.3,103.6],[79.4,102.6],[79.3,101.3],[79,100.8],[79,99.8],[80,98.5],[80.2,96.4],[80.3,96.4],[80.7,97.3],[80.7,97.7],[81,96.8],[81.1,96.3],[81.2,95.8],[81.2,95.2],[81.1,94.7],[81,93.6],[80.8,92.8],[80.5,92.9],[80.4,91.3],[80.2,92.6],[80,93.2],[80,92.9],[80.1,91.5],[79.7,91.7],[79.7,92.8],[79.8,93.6],[79.9,94],[79.7,94],[79.4,94.1],[79.3,94.7],[79.1,95.7],[78.9,97],[78.8,97.7],[78.8,99.1],[78.8,99.4],[78.6,99.8],[78.3,100],[78.2,99.6],[78.1,99.6]]
			},
			{
				comment: '',
				type: 'ice',
				coords: [[75.9,137.2],[74.8,138.6],[74.7,139.2],[74.9,139.8],[75,143.7],[75.5,142],[75.6,142.7],[75.3,142.8],[75.2,143.6],[75.1,144.2],[75.4,144.6],[75.4,145.3],[75.3,146.5],[75,150.6],[75.3,149.1],[75.4,148.1],[75.7,146.2],[75.7,145.1],[75.9,143.1],[76,141.8],[76.1,141.4],[76.1,140.6],[75.8,140.7],[75.7,140.3],[75.9,139.6],[76,139.3],[76.1,139]]
			},
			{
				comment: 'Antarctida',
				type: 'ice',
				coords: [[-63.6,-57.6],[-65.3,-62.1],[-66.7,-60.3],[-67.6,-61.8],[-68.9,-60.7],[-69.7,-62.1],[-72.5,-59.8],[-74.4,-60.8],[-74.8,-61.4],[-76.6,-52.4],[-77.7,-47.9],[-78,-44.1],[-77.7,-41],[-78.2,-35.8],[-76.1,-26.7],[-75.4,-27.4],[-72.5,-19.6],[-71.2,-12],[-70.6,-9.1],[-69.6,-1.1],[-69.5,0.3],[-69.9,3.9],[-69.8,12.6],[-69.3,13.6],[-69.5,19.1],[-70.2,23.6],[-69.7,28],[-69,29.4],[-68.4,33.8],[-69.6,36.8],[-68.8,39.8],[-67.2,46.9],[-66.5,50.3],[-66.5,57],[-67.2,62],[-67.4,69.8],[-68.6,70.9],[-68.6,73.7],[-69.6,73.8],[-69,77.8],[-68.5,78.2],[-67.8,81.2],[-66,86.2],[-66.5,93.4],[-65.1,95.7],[-65.5,98.2],[-65.7,103.3],[-66.8,108.8],[-66.2,110.6],[-65.8,114.3],[-66.8,119.2],[-66.3,124.8],[-66.2,126.6],[-66.4,129.9],[-66.3,135.2],[-67.1,144.9],[-68.3,147.9],[-68.3,152.4],[-69.4,159.3],[-70.5,166.3],[-71.4,169.5],[-73.5,168.6],[-75.1,163.7],[-76.9,162.6],[-77.8,165.3],[-77.6,181.1],[-78.5,195.9],[-77.2,203],[-75.6,212.8],[-74.9,222.6],[-74.2,232.6],[-73.3,232.7],[-73.4,235.4],[-73.8,240.5],[-74.1,248.6],[-75,251.2],[-74.9,257.6],[-72.9,256.9],[-71.8,263.4],[-72.5,268.9],[-73,275.3],[-72.5,281.3],[-72.4,286.9],[-71.7,284.9],[-70.7,284.9],[-68.8,288.2],[-69,291.4],[-67.4,292.1],[-64.8,295.7],[-63.9,299.5]]
			}
		];
	}
	
	window.hilite = function(i, j, k) {
		if (k !== undefined) {
			redCoords = objects[i].sub[j].coords[k];
		} else {
			redCoords = objects[i].coords[j];
		}
		
		return redCoords;
	}
})();












