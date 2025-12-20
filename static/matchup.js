let teamData = {}; 

// 1. 初始化：從後端 Fetch 資料
async function initRosters() {
    try {
        const response = await fetch('/api/players');
        const data = await response.json();
        
        teamData = data; 
        
        const bjContainer = document.getElementById('roster-bluejays');
        const ladContainer = document.getElementById('roster-dodgers');

        bjContainer.innerHTML = '<h3 style="color: #134A8E;">Blue Jays</h3>';
        ladContainer.innerHTML = '<h3 style="color: #005A9C;">Dodgers</h3>';

        data.bluejays.forEach(p => {
            bjContainer.innerHTML += createDraggableCard(p);
        });

        data.dodgers.forEach(p => {
            ladContainer.innerHTML += createDraggableCard(p);
        });

    } catch (error) {
        console.error("無法獲取數據:", error);
        alert("無法連接後端，請確認 app.py 是否正在執行！");
    }
}

// 建立可拖曳卡片 (左側/右側名單)
function createDraggableCard(player) {
    const safePlayer = {
        ...player,
        avg: player.avg === 'N/A' ? 0 : parseFloat(player.avg),
        hr: player.hr === 'N/A' ? 0 : parseInt(player.hr)
    };
    
    const playerJson = JSON.stringify(safePlayer).replace(/"/g, '&quot;'); 

    // player.img 來自 API，已經是完整網址，直接用
    return `
        <div class="draggable-player" draggable="true" ondragstart="drag(event)" data-player="${playerJson}">
            <img src="${player.img}" alt="${player.name}">
            <div>
                <strong>${player.name}</strong><br>
                <small>${player.position} | AVG: ${player.avg}</small>
            </div>
        </div>
    `;
}

// 啟動
initRosters();

// 拖曳相關功能
function drag(ev) {
    ev.dataTransfer.setData("playerData", ev.target.getAttribute("data-player"));
}

function allowDrop(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.add('hovered');
}

function dragLeave(ev) {
    ev.currentTarget.classList.remove('hovered');
}

let selectedPlayer1 = null;
let selectedPlayer2 = null;

function drop(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('hovered');

    const data = ev.dataTransfer.getData("playerData");
    if (!data) return;

    const player = JSON.parse(data);
    const zoneId = ev.currentTarget.id;

    renderPlayerInZone(ev.currentTarget, player);

    if (zoneId === 'zone-1') selectedPlayer1 = player;
    if (zoneId === 'zone-2') selectedPlayer2 = player;

    if (selectedPlayer1 && selectedPlayer2) {
        drawComparisonChart(selectedPlayer1, selectedPlayer2);
    }
}

// ★ 修正重點在這裡 ★
function renderPlayerInZone(zoneElement, player) {
    // 這裡原本有 "images/players/"，現在拿掉了
    // 因為 player.img 是 MLB 官方的 URL
    zoneElement.innerHTML = `
        <img src="${player.img}" style="width:80px; height:80px; border-radius:50%; margin-bottom:10px;">
        <h3>${player.name}</h3>
        <p>AVG: ${player.avg} | HR: ${player.hr}</p>
    `;
    zoneElement.style.border = "2px solid #fff";
}

// D3 圖表繪製
function drawComparisonChart(p1, p2, targetId = "#chart-area") {
    // 清空該區域舊圖表
    d3.select(targetId).selectAll("*").remove();

    // 判斷比較類型
    const p1Type = p1.stats.type;
    const p2Type = p2.stats.type;

    if (p1Type !== p2Type) {
        d3.select(targetId).html("<h2 style='color:white; text-align:center;'>請比較相同類型的選手</h2>");
        return;
    }

    let metrics = [];
    if (p1Type === 'hitter') {
        metrics = ['AVG', 'OBP', 'SLG', 'OPS'];
    } else if (p1Type === 'pitcher') {
        metrics = ['ERA', 'WHIP', 'K9', 'BB9'];
    }

    // 準備數據
    const chartData = metrics.map(metric => {
        const key = metric.toLowerCase();
        let val1 = 0, val2 = 0;
        
        if(key === 'k9') { val1 = parseFloat(p1.stats.k9); val2 = parseFloat(p2.stats.k9); }
        else if(key === 'bb9') { val1 = parseFloat(p1.stats.bb9); val2 = parseFloat(p2.stats.bb9); }
        else { val1 = parseFloat(p1.stats[key]); val2 = parseFloat(p2.stats[key]); }

        return {
            metric: metric,
            [p1.name]: val1 || 0,
            [p2.name]: val2 || 0
        };
    });

    // 取得容器的寬高 (這樣才能適應彈出視窗的大尺寸)
    const containerEl = document.querySelector(targetId);
    const containerWidth = containerEl.clientWidth;
    const containerHeight = containerEl.clientHeight;

    const margin = {top: 40, right: 30, bottom: 40, left: 50}; // 邊距稍微加大
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = d3.select(targetId)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x0 = d3.scaleBand()
        .domain(metrics)
        .rangeRound([0, width])
        .paddingInner(0.1);

    const x1 = d3.scaleBand()
        .domain([p1.name, p2.name])
        .rangeRound([0, x0.bandwidth()])
        .padding(0.05);

    const maxValue = d3.max(chartData, d => Math.max(d[p1.name], d[p2.name]));
    const y = d3.scaleLinear()
        .domain([0, maxValue * 1.1])
        .rangeRound([height, 0]);

    // ★ 修改 2: 更改配色為「紅 vs 藍」高對比色 ★
    // 左邊選手(p1) = 藍色 (#134A8E), 右邊選手(p2) = 紅色 (#D32F2F)
    const z = d3.scaleOrdinal()
        .domain([p1.name, p2.name])
        .range(["#134A8E", "#D32F2F"]); 

    // 畫長條
    svg.append("g")
        .selectAll("g")
        .data(chartData)
        .enter().append("g")
        .attr("transform", d => `translate(${x0(d.metric)},0)`)
        .selectAll("rect")
        .data(d => [p1.name, p2.name].map(key => ({key: key, value: d[key]})))
        .enter().append("rect")
        .attr("x", d => x1(d.key))
        .attr("y", d => y(d.value))
        .attr("width", x1.bandwidth())
        .attr("height", d => height - y(d.value))
        .attr("fill", d => z(d.key));

    // 畫軸
    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .style("font-size", "14px") // 字體加大
        .call(d3.axisBottom(x0));

    svg.append("g")
        .attr("class", "axis")
        .style("font-size", "14px")
        .call(d3.axisLeft(y).ticks(null, "s"));
    
    // 圖例 (Legend)
    const legend = svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 14) // 圖例字體加大
        .attr("text-anchor", "end")
        .selectAll("g")
        .data([p1.name, p2.name].slice().reverse())
        .enter().append("g")
        .attr("transform", (d, i) => `translate(0,${i * 25})`); // 間距加大

    legend.append("rect")
        .attr("x", width - 19)
        .attr("width", 19)
        .attr("height", 19)
        .attr("fill", z);

    legend.append("text")
        .attr("x", width - 24)
        .attr("y", 9.5)
        .attr("dy", "0.32em")
        .attr("fill", "white") 
        .text(d => d);
}

// ★ 新增：彈出視窗控制邏輯 ★

// 1. 監聽小圖表的點擊事件
document.getElementById('chart-area').addEventListener('click', function() {
    // 只有當兩邊都選了人 (已產生圖表) 時才觸發
    if (selectedPlayer1 && selectedPlayer2) {
        openModal();
    }
});

function openModal() {
    const modal = document.getElementById("chart-modal");
    modal.style.display = "flex"; // 顯示視窗
    
    // 在彈出視窗的大容器裡再畫一次圖
    // 傳入 '#modal-chart-area' 讓它畫在彈出視窗裡
    drawComparisonChart(selectedPlayer1, selectedPlayer2, "#modal-chart-area");
}

function closeModal() {
    document.getElementById("chart-modal").style.display = "none";
}

// 點擊視窗外部也可以關閉
window.onclick = function(event) {
    const modal = document.getElementById("chart-modal");
    if (event.target == modal) {
        closeModal();
    }
}