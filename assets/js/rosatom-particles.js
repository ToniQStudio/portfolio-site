(function () {
	'use strict';

	var cover = document.querySelector('.cover-rosatom');
	if (!cover) return;
	if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	var canvas = cover.querySelector('.ra-field');
	if (!canvas) return;
	var ctx = canvas.getContext('2d');
	if (!ctx) return;

	var W = 0, H = 0;
	var dpr = Math.min(2, window.devicePixelRatio || 1);
	var parts = [];
	var N = 56, LINK = 120;

	function resize() {
		W = Math.max(1, Math.round(cover.clientWidth));
		H = Math.max(1, Math.round(cover.clientHeight));
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		canvas.style.width = '100%';
		canvas.style.height = '100%';
		seed();
	}

	function seed() {
		parts = [];
		for (var i = 0; i < N; i++) {
			var a = Math.random() * Math.PI * 2;
			var sp = 0.175 + Math.random() * 0.3;
			parts.push({
				x: Math.random() * W,
				y: Math.random() * H,
				vx: Math.cos(a) * sp,
				vy: Math.sin(a) * sp,
				r: 1.4 + Math.random() * 1.8,
				p: Math.random() * Math.PI * 2,
				ps: 0.004 + Math.random() * 0.008
			});
		}
	}

	function frame() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);

		// faint molecular bonds between nearby particles
		ctx.lineWidth = 1;
		for (var i = 0; i < parts.length; i++) {
			var a = parts[i];
			for (var j = i + 1; j < parts.length; j++) {
				var b = parts[j];
				var dx = a.x - b.x, dy = a.y - b.y;
				var d2 = dx * dx + dy * dy;
				if (d2 < LINK * LINK) {
					var t = 1 - Math.sqrt(d2) / LINK;
					ctx.strokeStyle = 'rgba(150, 185, 255, ' + (t * 0.28).toFixed(3) + ')';
					ctx.beginPath();
					ctx.moveTo(a.x, a.y);
					ctx.lineTo(b.x, b.y);
					ctx.stroke();
				}
			}
		}

		// drifting, twinkling particles
		ctx.globalCompositeOperation = 'lighter';
		for (var k = 0; k < parts.length; k++) {
			var e = parts[k];
			e.x += e.vx;
			e.y += e.vy;
			e.p += e.ps;
			if (e.x < -12) e.x = W + 12; else if (e.x > W + 12) e.x = -12;
			if (e.y < -12) e.y = H + 12; else if (e.y > H + 12) e.y = -12;
			var tw = 0.55 + 0.45 * Math.sin(e.p);
			ctx.fillStyle = 'rgba(214, 230, 255, ' + (0.42 * tw).toFixed(3) + ')';
			ctx.beginPath();
			ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalCompositeOperation = 'source-over';

		requestAnimationFrame(frame);
	}

	resize();
	requestAnimationFrame(frame);

	var rt;
	window.addEventListener('resize', function () {
		clearTimeout(rt);
		rt = setTimeout(resize, 200);
	});
})();
