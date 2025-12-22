let teamData = {}; 
let selectedPlayer1 = null;
let selectedPlayer2 = null;
let currentPlayerHitter = null; 
let currentPlayerPitcher = null; 

function toggleLoading(show) {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

window.switch3DView = function(viewType) {
    const btnHitter = document.getElementById('btn-show-hitter');
    const btnPitcher = document.getElementById('btn-show-pitcher');
    const legend3D = document.getElementById('3d-legend');

    if (viewType === 'hitter') {
        btnHitter.classList.add('active-hitter');
        btnPitcher.classList.remove('active-pitcher');
        if(currentPlayerHitter) {
            update3DHeatmapSingle(currentPlayerHitter);
            legend3D.innerHTML = `<span style="color:#ff4444; font-weight:bold; font-size:16px;">■ ${currentPlayerHitter.name} 的打擊熱區 (個人數據)</span>`;
        }
    } else {
        btnPitcher.classList.add('active-pitcher');
        btnHitter.classList.remove('active-hitter');
        if(currentPlayerPitcher) {
            update3DHeatmapSingle(currentPlayerPitcher);
            legend3D.innerHTML = `<span style="color:#4488ff; font-weight:bold; font-size:16px;">■ ${currentPlayerPitcher.name} 的投球熱區 (個人數據)</span>`;
        }
    }
}

class StrikeZone3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, this.container.clientWidth / this.container.clientHeight, 0.1, 1000); 
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.controls = null; 
        this.init();
    }
    
    init() {
        this.container.appendChild(this.renderer.domElement);
        const light = new THREE.PointLight(0xffffff, 1.2, 100);
        light.position.set(5, 5, 10);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0x808080)); 

        // ★ 修改：繪製本壘板 (五邊形)
        this.createHomePlate();

        // ★ 新增：繪製方位標示文字
        this.createDirectionLabels();

        // 好球帶框線
        const geometry = new THREE.BoxGeometry(1.5, 2, 0.5); 
        const edges = new THREE.EdgesGeometry(geometry);
        const szLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
        szLine.position.y = 1.5; 
        this.scene.add(szLine);

        // 相機位置
        this.camera.position.set(0, 2.0, 3.8); 
        this.camera.lookAt(0, 1.5, 0);
        
        if (THREE.OrbitControls) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true; 
            this.controls.dampingFactor = 0.05;
            this.controls.target.set(0, 1.5, 0); 
        }
        this.animate();
    }

    // ★ 建立本壘板函式
    createHomePlate() {
        const shape = new THREE.Shape();
        // 畫五邊形：尖端朝向 Z+ (鏡頭/捕手)，平邊朝向 Z- (投手)
        // 座標系：2D Shape 的 Y+ 對應 3D 旋轉後的 Z- (遠方)
        shape.moveTo(-0.85, 0.6);  // 左後
        shape.lineTo(0.85, 0.6);   // 右後 (平邊)
        shape.lineTo(0.85, -0.2);  // 右肩
        shape.lineTo(0, -0.9);     // 尖端 (朝向捕手)
        shape.lineTo(-0.85, -0.2); // 左肩
        shape.lineTo(-0.85, 0.6);  // 閉合

        const extrudeSettings = { depth: 0.1, bevelEnabled: false };
        const plateGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const plate = new THREE.Mesh(plateGeo, new THREE.MeshPhongMaterial({ color: 0xffffff })); // 純白
        
        plate.rotation.x = -Math.PI / 2; // 躺平
        plate.position.y = 0.05; // 稍微墊高一點點避免破圖
        this.scene.add(plate);
    }

    // ★ 建立方位文字函式
    createDirectionLabels() {
        const createLabel = (text, x, y, z, color='#cccccc') => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 256; 
            canvas.height = 128;
            context.font = "Bold 50px Arial";
            context.fillStyle = color;
            context.textAlign = "center";
            context.fillText(text, 128, 80);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.8 });
            const sprite = new THREE.Sprite(material);
            sprite.position.set(x, y, z);
            sprite.scale.set(1.5, 0.75, 1); // 調整文字長寬比
            return sprite;
        };

        // 加入上下左右標示 (相對於捕手視角)
        this.scene.add(createLabel("左 (Left)", -2.0, 1.5, 0));
        this.scene.add(createLabel("右 (Right)", 2.0, 1.5, 0));
        this.scene.add(createLabel("上 (Top)", 0, 3.2, 0));
        this.scene.add(createLabel("本壘板 (Home)", 0, -0.5, 1.2)); // 標示本壘板位置
    }
    
    resize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (width && height) {
            this.renderer.setSize(width, height);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
    }
    
    addFixedHeatZone(type, x, y, intensity) {
        const isHitter = type === 'hitter';
        const color = isHitter ? 0xff0000 : 0x007bff; 
        const opacity = Math.min(Math.max(intensity * 2.5, 0.3), 0.9); 
        
        const zoneMat = new THREE.MeshPhongMaterial({ 
            color: color, transparent: true, opacity: opacity, 
            emissive: color, emissiveIntensity: 0.5, side: THREE.DoubleSide
        });

        const zone = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.1), zoneMat);
        zone.position.set(x, y, 0); 
        this.scene.add(zone);
    }

    clearZones() {
        while(this.scene.children.length > 7) { // 保留前 7 個物件 (光x2, 板, 框, 文字x4)
            this.scene.remove(this.scene.children[this.scene.children.length - 1]); 
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

let arena3D;
window.onload = () => {
    // ★ 新增這行：頁面一進來就顯示 Loading
    toggleLoading(true);

    arena3D = new StrikeZone3D('vs-3d-arena'); 
    initRosters();
};

async function initRosters() {
    try {
        const response = await fetch('/api/players');
        const data = await response.json();
        teamData = data; 
        renderTeamRoster('roster-bluejays', 'Blue Jays', '#134A8E', data.bluejays);
        renderTeamRoster('roster-dodgers', 'Dodgers', '#005A9C', data.dodgers);
    } catch (error) { 
        console.error("Error:", error); 
    } finally {
        // ★ 新增這行：不管成功或失敗，資料抓完後關閉 Loading
        toggleLoading(false);
    }
}

function renderTeamRoster(containerId, teamName, color, players) {
    const container = document.getElementById(containerId);
    let html = `<h3 style="color: ${color}; border-bottom: 2px solid ${color}; margin-bottom: 10px;">${teamName}</h3>`;
    const pitchers = players.filter(p => p.stats.type === 'pitcher');
    const hitters = players.filter(p => p.stats.type === 'hitter');
    html += `<div class="roster-section-title">⚾ Pitchers</div>`;
    pitchers.forEach(p => { html += createDraggableCard(p); });
    html += `<div class="roster-section-title" style="margin-top:20px;">🏏 Hitters</div>`;
    hitters.forEach(p => { html += createDraggableCard(p); });
    container.innerHTML = html;
}

function createDraggableCard(player) {
    const json = JSON.stringify(player).replace(/"/g, '&quot;'); 
    const statText = player.stats.type === 'pitcher' ? `ERA: ${player.stats.era}` : `AVG: ${player.stats.avg}`;
    return `<div class="draggable-player" draggable="true" ondragstart="drag(event)" data-player="${json}">
        <img src="${player.img}"><div><strong>${player.name}</strong><br><small>${player.position} | ${statText}</small></div></div>`;
}

function drag(ev) { ev.dataTransfer.setData("playerData", ev.target.getAttribute("data-player")); }
function allowDrop(ev) { ev.preventDefault(); ev.currentTarget.classList.add('hovered'); }

async function drop(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('hovered');
    const data = ev.dataTransfer.getData("playerData");
    if (!data) return;
    const player = JSON.parse(data);
    const zoneId = ev.currentTarget.id;

    ev.currentTarget.innerHTML = `<img src="${player.img}" style="width:80px; height:80px; border-radius:50%; margin-bottom:10px; border:3px solid white;"><h3>${player.name}</h3><p style="color:#aaa">${player.position}</p>`;

    if (zoneId === 'zone-1') selectedPlayer1 = player;
    else selectedPlayer2 = player;

    if (selectedPlayer1 && selectedPlayer2) {
        toggleLoading(true); 
        try {
            const [res1, res2] = await Promise.all([
                fetch(`/api/zones/${selectedPlayer1.id}/${selectedPlayer1.stats.type}`),
                fetch(`/api/zones/${selectedPlayer2.id}/${selectedPlayer2.stats.type}`)
            ]);
            selectedPlayer1.stats.zones = await res1.json();
            selectedPlayer2.stats.zones = await res2.json();
        } catch(e) { console.log("Data fetch error"); }

        handleDisplaySwitch(selectedPlayer1, selectedPlayer2);
        toggleLoading(false);
    }
}

function checkDataValidity(p1, p2) {
    const hasData = (p) => {
        const s = p.stats;
        if (s.type === 'pitcher') return parseFloat(s.ip) > 0 || parseFloat(s.k9) > 0 || parseFloat(s.era) > 0;
        else return parseFloat(s.avg) > 0 || parseFloat(s.ops) > 0;
    };
    return hasData(p1) && hasData(p2);
}

function handleDisplaySwitch(p1, p2) {
    const arena3DDom = document.getElementById('vs-3d-arena');
    const chartAreaDom = document.getElementById('chart-area');
    const noDataMsg = document.getElementById('no-data-msg');
    const toggleBtns = document.getElementById('toggle-btns');

    if(arena3DDom) { arena3DDom.style.display = 'none'; arena3DDom.style.height = '0px'; }
    if(chartAreaDom) chartAreaDom.style.display = 'none';
    if(noDataMsg) noDataMsg.style.display = 'none';
    if(toggleBtns) toggleBtns.style.display = 'none';

    if (!checkDataValidity(p1, p2)) {
        if(noDataMsg) noDataMsg.style.display = 'block';
        return; 
    }

    const isPitcherVsHitter = p1.stats.type !== p2.stats.type;

    if (isPitcherVsHitter) {
        if(arena3DDom) { 
            arena3DDom.style.display = 'flex'; 
            arena3DDom.style.height = '700px'; 
            
            currentPlayerPitcher = p1.stats.type === 'pitcher' ? p1 : p2;
            currentPlayerHitter = p1.stats.type === 'hitter' ? p1 : p2;
            
            if(toggleBtns) toggleBtns.style.display = 'flex';
            switch3DView('hitter');

            setTimeout(() => { if(arena3D) arena3D.resize(); }, 50);
        }
    } else {
        if(chartAreaDom) { 
            chartAreaDom.style.display = 'block'; 
            chartAreaDom.style.minHeight = '700px'; 
        }
        drawComparisonChart(p1, p2);
    }
}

function update3DHeatmapSingle(player) {
    if(!arena3D) return;
    arena3D.clearZones();
    const zones = player.stats.zones || [];
    zones.forEach(z => {
        if (z.zone >= 1 && z.zone <= 9) {
            const col = (z.zone - 1) % 3; 
            const row = Math.floor((z.zone - 1) / 3);
            arena3D.addFixedHeatZone(player.stats.type, (col - 1) * 0.45, 2.1 - (row * 0.62), parseFloat(z.pct));
        }
    });
}

function drawComparisonChart(p1, p2) {
    const container = d3.select("#chart-area");
    container.selectAll("*").remove();
    const chartDom = document.getElementById('chart-area');
    
    const metrics = p1.stats.type === 'hitter' ? ['AVG', 'OBP', 'SLG', 'OPS'] : ['ERA', 'WHIP', 'K9', 'BB9'];
    const chartData = metrics.map(m => ({
        metric: m,
        v1: parseFloat(p1.stats[m.toLowerCase()]) || 0,
        v2: parseFloat(p2.stats[m.toLowerCase()]) || 0
    }));

    const margin = {top: 100, right: 50, bottom: 60, left: 80}; 
    const width = chartDom.clientWidth - margin.left - margin.right;
    const height = 700 - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", chartDom.clientWidth).attr("height", 700)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x0 = d3.scaleBand().domain(metrics).rangeRound([0, width]).paddingInner(0.25);
    const x1 = d3.scaleBand().domain(['v1', 'v2']).rangeRound([0, x0.bandwidth()]).padding(0.05);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => Math.max(d.v1, d.v2)) * 1.15]).range([height, 0]);
    const z = d3.scaleOrdinal().range(["#134A8E", "#D32F2F"]);

    svg.append("g").selectAll("g").data(chartData).enter().append("g")
        .attr("transform", d => `translate(${x0(d.metric)},0)`)
        .selectAll("rect").data(d => [{k:'v1', v:d.v1}, {k:'v2', v:d.v2}]).enter().append("rect")
        .attr("x", d => x1(d.k)).attr("y", d => y(d.v)).attr("width", x1.bandwidth()).attr("height", d => height - y(d.v))
        .attr("fill", d => z(d.k)).attr("rx", 6);

    svg.append("g").selectAll("g").data(chartData).enter().append("g")
        .attr("transform", d => `translate(${x0(d.metric)},0)`)
        .selectAll("text").data(d => [{k:'v1', v:d.v1}, {k:'v2', v:d.v2}]).enter().append("text")
        .attr("x", d => x1(d.k) + x1.bandwidth()/2).attr("y", d => y(d.v) - 10)
        .attr("text-anchor", "middle").style("fill", "white").style("font-weight", "bold").style("font-size", "18px")
        .text(d => d.v.toFixed(3));

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x0)).selectAll("text").style("fill", "white").style("font-size", "20px").style("font-weight", "bold");
    svg.append("g").call(d3.axisLeft(y).ticks(5)).selectAll("text").style("fill", "#ccc").style("font-size", "16px");

    const legend = svg.append("g").attr("font-family", "sans-serif").attr("font-size", 16).attr("text-anchor", "start").attr("transform", "translate(0, -60)"); 
    legend.append("rect").attr("x", 0).attr("width", 20).attr("height", 20).attr("fill", "#134A8E");
    legend.append("text").attr("x", 30).attr("y", 15).attr("fill", "white").text(p1.name + " (Player A)");
    legend.append("rect").attr("x", 300).attr("width", 20).attr("height", 20).attr("fill", "#D32F2F");
    legend.append("text").attr("x", 330).attr("y", 15).attr("fill", "white").text(p2.name + " (Player B)");
}