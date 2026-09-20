export class EqVisualizer {
    constructor(canvasId, onChange) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.onChange = onChange;
        this.isDragging = false;
        this.dragNodeIndex = -1;

        this.minFreq = 20;
        this.maxFreq = 20000;
        this.minGain = -12;
        this.maxGain = 12;

        this.bands = [
            { freq: 80.0, gain_db: 0.0, q: 0.707, color: '#ff66b2', label: 'Rumble' },
            { freq: 250.0, gain_db: 0.0, q: 0.707, color: '#ffb366', label: 'Boom' },
            { freq: 1000.0, gain_db: 0.0, q: 0.707, color: '#ffff66', label: 'Boxy' },
            { freq: 4000.0, gain_db: 0.0, q: 0.707, color: '#66ff66', label: 'Nasal' },
            { freq: 8000.0, gain_db: 0.0, q: 0.707, color: '#ff4d4d', label: 'Presence' },
        ];

        this.setupEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    setBands(newBands) {
        for (let i = 0; i < 5; i++) {
            if (newBands[i]) {
                this.bands[i].freq = newBands[i].freq;
                this.bands[i].gain_db = newBands[i].gain_db;
            }
        }
        this.draw();
    }

    getBands() {
        return this.bands.map(b => ({ freq: b.freq, gain_db: b.gain_db, q: b.q }));
    }

    freqToX(freq) {
        const logMin = Math.log10(this.minFreq);
        const logMax = Math.log10(this.maxFreq);
        return ((Math.log10(freq) - logMin) / (logMax - logMin)) * this.canvas.width;
    }

    xToFreq(x) {
        const logMin = Math.log10(this.minFreq);
        const logMax = Math.log10(this.maxFreq);
        const logFreq = logMin + (x / this.canvas.width) * (logMax - logMin);
        return Math.pow(10, logFreq);
    }

    gainToY(gain) {
        // Gain range: +12 top, -12 bottom
        const pct = (this.maxGain - gain) / (this.maxGain - this.minGain);
        return pct * this.canvas.height;
    }

    yToGain(y) {
        const pct = y / this.canvas.height;
        return this.maxGain - pct * (this.maxGain - this.minGain);
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = 180;
        this.draw();
    }

    setupEvents() {
        const getMousePos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };

        this.canvas.addEventListener('mousedown', (e) => {
            const pos = getMousePos(e);
            let closest = -1;
            let minDist = 15; // Hit radius

            for (let i = 0; i < this.bands.length; i++) {
                const bx = this.freqToX(this.bands[i].freq);
                const by = this.gainToY(this.bands[i].gain_db);
                const dist = Math.hypot(pos.x - bx, pos.y - by);
                if (dist < minDist) {
                    minDist = dist;
                    closest = i;
                }
            }

            if (closest !== -1) {
                this.isDragging = true;
                this.dragNodeIndex = closest;
                this.canvas.style.cursor = 'grabbing';
            }
        });

        const onMove = (e) => {
            if (!this.isDragging) return;
            const pos = getMousePos(e);
            
            let freq = this.xToFreq(pos.x);
            let gain = this.yToGain(pos.y);

            freq = Math.max(this.minFreq, Math.min(this.maxFreq, freq));
            gain = Math.max(this.minGain, Math.min(this.maxGain, gain));

            this.bands[this.dragNodeIndex].freq = freq;
            this.bands[this.dragNodeIndex].gain_db = gain;
            
            this.draw();
            if (this.onChange) this.onChange();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.dragNodeIndex = -1;
                this.canvas.style.cursor = 'default';
                this.draw();
            }
        });
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        // Draw zero line
        const zeroY = this.gainToY(0);
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, zeroY);
        this.ctx.lineTo(w, zeroY);
        this.ctx.stroke();

        // Draw frequency guides
        this.ctx.fillStyle = '#666';
        this.ctx.font = '10px sans-serif';
        const guides = [100, 1000, 10000];
        guides.forEach(g => {
            const gx = this.freqToX(g);
            this.ctx.strokeStyle = '#333';
            this.ctx.beginPath();
            this.ctx.moveTo(gx, 0);
            this.ctx.lineTo(gx, h);
            this.ctx.stroke();
            this.ctx.fillText(g >= 1000 ? (g/1000)+'k' : g, gx + 2, h - 2);
        });

        // Catmull-Rom spline
        const points = this.bands.map(b => ({
            x: this.freqToX(b.freq),
            y: this.gainToY(b.gain_db)
        }));
        
        points.unshift({ x: 0, y: points[0].y });
        points.push({ x: w, y: points[points.length-1].y });

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];

            for (let t = 0; t < 1; t += 0.1) {
                const t2 = t * t;
                const t3 = t2 * t;

                const cx = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
                const cy = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
                this.ctx.lineTo(cx, cy);
            }
        }
        
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#007bff';
        this.ctx.stroke();

        this.ctx.lineTo(w, zeroY);
        this.ctx.lineTo(0, zeroY);
        this.ctx.fillStyle = 'rgba(0, 123, 255, 0.2)';
        this.ctx.fill();

        // Draw Nodes
        this.bands.forEach((b, i) => {
            const bx = this.freqToX(b.freq);
            const by = this.gainToY(b.gain_db);
            
            if (this.dragNodeIndex === i) {
                this.ctx.beginPath();
                this.ctx.arc(bx, by, 10, 0, Math.PI * 2);
                this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
                this.ctx.fill();
            }

            this.ctx.beginPath();
            this.ctx.arc(bx, by, 6, 0, Math.PI * 2);
            this.ctx.fillStyle = b.color;
            this.ctx.fill();
            this.ctx.lineWidth = 1.5;
            this.ctx.strokeStyle = '#fff';
            this.ctx.stroke();

            this.ctx.fillStyle = '#ccc';
            this.ctx.font = '10px sans-serif';
            this.ctx.fillText(`${b.gain_db.toFixed(1)}dB`, bx - 12, by - 14);
            
            // Draw label at bottom
            this.ctx.fillStyle = b.color;
            this.ctx.fillText(b.label, bx - 15, h - 5);
        });
    }
}

export class CompVisualizer {
    constructor(canvasId, onChange) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.onChange = onChange;
        this.isDragging = false;
        
        this.threshold = -20;
        this.minThresh = -60;
        this.maxThresh = 0;

        this.waveform = [];
        for (let i = 0; i < 150; i++) {
            this.waveform.push(Math.random() * 0.7 + 0.1);
        }

        this.setupEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.animationTick = 0;
        const animate = () => {
            this.animationTick++;
            if (this.animationTick % 4 === 0) {
                this.waveform.shift();
                this.waveform.push(Math.random() * 0.8 + 0.1);
                this.draw();
            }
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    setThreshold(t) {
        this.threshold = t;
        this.draw();
    }

    getThreshold() {
        return this.threshold;
    }

    yToThresh(y) {
        const pct = y / this.canvas.height;
        return this.maxThresh - pct * (this.maxThresh - this.minThresh);
    }

    threshToY(t) {
        const pct = (this.maxThresh - t) / (this.maxThresh - this.minThresh);
        return pct * this.canvas.height;
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = 120;
        this.draw();
    }

    setupEvents() {
        const getMouseY = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            return e.clientY - rect.top;
        };

        this.canvas.addEventListener('mousedown', (e) => {
            const my = getMouseY(e);
            const ty = this.threshToY(this.threshold);
            if (Math.abs(my - ty) < 15) {
                this.isDragging = true;
                this.canvas.style.cursor = 'ns-resize';
            }
        });

        const onMove = (e) => {
            if (!this.isDragging) return;
            const my = getMouseY(e);
            let t = this.yToThresh(my);
            t = Math.max(this.minThresh, Math.min(this.maxThresh, t));
            this.threshold = t;
            this.draw();
            if (this.onChange) this.onChange();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.canvas.style.cursor = 'default';
            }
        });
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        const barWidth = w / this.waveform.length;
        const ty = this.threshToY(this.threshold);

        for (let i = 0; i < this.waveform.length; i++) {
            const x = i * barWidth;
            let val = this.waveform[i];
            let barH = val * h * 0.9;
            
            const midY = h / 2;
            const topY = midY - barH / 2;
            
            this.ctx.fillStyle = '#007bff'; // base blue
            
            if (topY < ty) {
                // Dim the part cut off by the threshold
                this.ctx.fillRect(x, midY - barH/2, barWidth - 0.5, barH);
                
                // Draw red reduction overlay above threshold
                this.ctx.fillStyle = 'rgba(255, 50, 50, 0.7)';
                this.ctx.fillRect(x, topY, barWidth - 0.5, ty - topY);
            } else {
                this.ctx.fillRect(x, midY - barH/2, barWidth - 0.5, barH);
            }
        }

        // Draw Threshold Line
        this.ctx.strokeStyle = '#ff4d4d';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, ty);
        this.ctx.lineTo(w, ty);
        this.ctx.stroke();
        
        // Handle
        this.ctx.fillStyle = '#ff4d4d';
        this.ctx.beginPath();
        this.ctx.arc(w - 15, ty, 6, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '11px sans-serif';
        this.ctx.fillText(`Threshold: ${this.threshold.toFixed(1)} dB`, 5, ty - 5);
    }
}
