// 變數設定
const draggables = document.querySelectorAll('.player-token');
const dropZones = document.querySelectorAll('.position-box');
const bench = document.getElementById('bench');
const totalScoreDisplay = document.getElementById('totalScore');
const salaryText = document.getElementById('salaryText');
const salaryBar = document.getElementById('salaryBar');
const lineupList = document.getElementById('lineupList');
const infield = document.getElementById('infield');
const toast = document.getElementById('toast');
const hoverCard = document.getElementById('hoverCard');

let draggedItem = null;
let currentTeam = 'bluejays';
let currentPosFilter = 'ALL';
let battingOrder = []; // 儲存目前的打擊順序 (名字陣列)

// 設定：最大薪資上限 (150M)
const MAX_SALARY = 150.0;

// --- 初始化 ---
draggables.forEach(setupDraggable);
setupDropZones();

// --- 功能 1: 拖曳與智慧亮起 ---
function setupDraggable(item) {
    item.addEventListener('dragstart', function() {
        draggedItem = this;
        setTimeout(() => this.style.opacity = '0.5', 0);

        // 智慧亮起：遍歷所有格子，亮起合法的位置
        const playerPos = this.dataset.pos;
        dropZones.forEach(zone => {
            if (validatePosition(playerPos, zone.dataset.role)) {
                zone.classList.add('highlight-valid');
            }
        });
    });

    item.addEventListener('dragend', function() {
        draggedItem = null;
        this.style.opacity = '1';
        // 移除亮起
        dropZones.forEach(zone => zone.classList.remove('highlight-valid'));
    });
}

function setupDropZones() {
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');

            if (!draggedItem) return;

            // 1. 驗證位置
            const playerPos = draggedItem.dataset.pos;
            const targetRole = zone.dataset.role;

            if (!validatePosition(playerPos, targetRole)) {
                zone.classList.add('wrong-pos');
                setTimeout(() => zone.classList.remove('wrong-pos'), 500);
                showToast(`❌ Cannot play ${playerPos} at ${targetRole}!`);
                return;
            }

            // 2. 驗證薪資 (Salary Cap)
            const playerSalary = parseFloat(draggedItem.dataset.salary);
            const currentTotalSalary = calculateCurrentSalary();
            let existingSalary = 0;
            const existingPlayer = zone.querySelector('.player-in-field');
            if (existingPlayer) existingSalary = parseFloat(existingPlayer.dataset.salary);

            if (currentTotalSalary - existingSalary + playerSalary > MAX_SALARY) {
                zone.classList.add('wrong-pos');
                setTimeout(() => zone.classList.remove('wrong-pos'), 500);
                showToast(`💰 Over Salary Cap! Limit: $${MAX_SALARY}M`);
                return;
            }

            // 3. 處理換人
            if (existingPlayer) {
                removePlayerFromField(existingPlayer);
            }

            // 4. 正式放入
            renderPlayerOnField(zone, draggedItem);
            draggedItem.remove(); 
            zone.classList.add('occupied');
            
            // 5. 更新狀態
            updateGameState();
        });
    });
}

// --- 功能 2: 驗證位置 (含 DH 邏輯) ---
function validatePosition(playerPos, targetRole) {
    if (targetRole === 'P') return ['P', 'SP', 'RP', 'TWP'].includes(playerPos);
    if (targetRole === 'C') return playerPos === 'C';
    
    // 內野
    if (['1B', '2B', '3B', 'SS'].includes(targetRole)) {
        return ['1B', '2B', '3B', 'SS', 'IF', 'TWP'].includes(playerPos);
    }
    // 外野
    if (['LF', 'CF', 'RF'].includes(targetRole)) {
        return ['LF', 'CF', 'RF', 'OF', 'TWP'].includes(playerPos);
    }
    // ★ DH: 只要不是純投手都可以，TWP 也可以 ★
    if (targetRole === 'DH') {
        return playerPos !== 'P' && playerPos !== 'SP' && playerPos !== 'RP';
    }

    return false;
}

// --- 功能 3: 渲染場上球員 ---
function renderPlayerOnField(zone, source) {
    const data = source.dataset;
    zone.innerHTML = `
        <div class="player-in-field" 
             data-name="${data.name}" data-img="${data.img}" 
             data-score="${data.score}" data-salary="${data.salary}"
             data-pos="${data.pos}" data-desc="${data.desc}" data-team="${data.team}">
            <img src="${data.img}">
            <div class="p-name">${data.name}</div>
        </div>
    `;

    const playerEl = zone.querySelector('.player-in-field');

    playerEl.addEventListener('dblclick', function() {
        removePlayerFromField(this);
        updateGameState();
    });

    playerEl.addEventListener('mouseenter', (e) => {
        const rect = zone.getBoundingClientRect();
        document.getElementById('cardName').innerText = data.name;
        document.getElementById('cardStats').innerText = data.desc;
        document.getElementById('cardSalary').innerText = `Salary: $${data.salary}M`;
        
        hoverCard.style.top = `${rect.top - 80}px`;
        hoverCard.style.left = `${rect.left + 50}px`;
        hoverCard.style.display = 'block';
    });

    playerEl.addEventListener('mouseleave', () => {
        hoverCard.style.display = 'none';
    });
}

function removePlayerFromField(playerEl) {
    const data = playerEl.dataset;
    const card = createBenchCard(data);
    bench.appendChild(card);
    setupDraggable(card);
    
    const zone = playerEl.parentElement;
    zone.classList.remove('occupied');
    zone.innerHTML = `<span class="pos-label">${zone.dataset.role}</span>`;
    
    applyFilters(); 
}

function createBenchCard(data) {
    const div = document.createElement('div');
    div.className = `player-token team-${data.team}`;
    div.draggable = true;
    Object.assign(div.dataset, data); 
    
    if (data.team !== currentTeam) div.style.display = 'none';

    div.innerHTML = `
        <img src="${data.img}">
        <div style="flex:1;">
            <div style="font-weight:bold; font-size:13px;">${data.name}</div>
            <div style="font-size:11px; color:#aaa;">${data.pos}</div>
        </div>
        <div style="text-align:right;">
            <span style="display:block; font-weight:bold; color:#FFD700;">${data.score}</span>
            <span class="salary-badge">$${data.salary}M</span>
        </div>
    `;
    return div;
}

// --- 功能 4: 更新遊戲狀態 ---
function updateGameState() {
    const players = document.querySelectorAll('.player-in-field');
    
    // 計算分數與薪資
    let totalScore = 0;
    let totalSalary = 0;
    
    players.forEach(p => {
        totalScore += parseFloat(p.dataset.score);
        totalSalary += parseFloat(p.dataset.salary);
    });

    // 隊伍默契檢查 (內野全同隊)
    const infieldRoles = ['1B', '2B', '3B', 'SS'];
    const infieldPlayers = [];
    dropZones.forEach(z => {
        if (infieldRoles.includes(z.dataset.role)) {
            const p = z.querySelector('.player-in-field');
            if(p) infieldPlayers.push(p.dataset.team);
        }
    });

    const isChemistry = infieldPlayers.length === 4 && infieldPlayers.every(t => t === infieldPlayers[0]);
    if (isChemistry) {
        totalScore *= 1.1; 
        infield.classList.add('chemistry-bonus');
        document.getElementById('chemistryText').style.display = 'block';
    } else {
        infield.classList.remove('chemistry-bonus');
        document.getElementById('chemistryText').style.display = 'none';
    }

    // 更新 UI
    totalScoreDisplay.innerText = totalScore.toFixed(1);
    salaryText.innerText = `$${totalSalary.toFixed(1)}M / $${MAX_SALARY}M`;
    
    const salaryPercent = (totalSalary / MAX_SALARY) * 100;
    salaryBar.style.width = `${Math.min(salaryPercent, 100)}%`;
    
    if (totalSalary > MAX_SALARY) {
        salaryBar.classList.add('over-budget');
        salaryText.style.color = '#f44336';
    } else {
        salaryBar.classList.remove('over-budget');
        salaryText.style.color = '#aaa';
    }

    // 更新棒次
    refreshBattingOrderArray(players);
    renderBattingLineup();
}

function calculateCurrentSalary() {
    let total = 0;
    document.querySelectorAll('.player-in-field').forEach(p => {
        total += parseFloat(p.dataset.salary);
    });
    return total;
}

// --- 功能 5: 棒次管理 (自訂順序) ---

function refreshBattingOrderArray(playersInField) {
    const currentFielders = [];
    playersInField.forEach(p => {
        const role = p.parentElement.dataset.role;
        const name = p.dataset.name;
        // 投手不打擊，除非他是 DH
        if (role !== 'P') {
            currentFielders.push(name);
        }
    });

    // 1. 移除已下場的
    battingOrder = battingOrder.filter(name => currentFielders.includes(name));
    // 2. 加入新上場的 (還不在名單內的)
    currentFielders.forEach(name => {
        if (!battingOrder.includes(name)) {
            battingOrder.push(name);
        }
    });
}

function renderBattingLineup() {
    lineupList.innerHTML = '';
    
    if (battingOrder.length === 0) {
        lineupList.innerHTML = '<p style="color:#666; font-size:12px; padding:10px;">Drag fielders to the field to fill lineup.</p>';
        return;
    }

    battingOrder.forEach((name, index) => {
        // 抓取場上該球員的資訊
        const playerEl = document.querySelector(`.player-in-field[data-name="${name}"]`);
        const desc = playerEl ? playerEl.dataset.desc.split('|')[0] : '';
        const pos = playerEl ? playerEl.parentElement.dataset.role : '';

        const div = document.createElement('div');
        div.className = 'lineup-item';
        div.innerHTML = `
            <div class="order-btns">
                <button class="order-btn" onclick="moveOrder(${index}, -1)">▲</button>
                <button class="order-btn" onclick="moveOrder(${index}, 1)">▼</button>
            </div>
            <span class="lineup-num">${index + 1}.</span>
            <span style="flex:1; margin-left:5px;">${name} <span style="color:#aaa; font-size:10px;">(${pos})</span></span>
            <span style="color:#aaa; font-size:10px;">${desc}</span>
        `;
        lineupList.appendChild(div);
    });
}

// 全域函式供 HTML 呼叫：移動棒次
window.moveOrder = function(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= battingOrder.length) return; 

    // 交換陣列元素
    const temp = battingOrder[index];
    battingOrder[index] = battingOrder[newIndex];
    battingOrder[newIndex] = temp;

    renderBattingLineup(); 
};

// --- 功能 6: 一鍵清空 ---
window.clearField = function() {
    const players = document.querySelectorAll('.player-in-field');
    players.forEach(p => removePlayerFromField(p));
    updateGameState();
    showToast("🧹 Field Cleared!");
}

function showToast(msg) {
    toast.innerText = msg;
    toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

// --- 篩選與切換 ---
window.switchTeam = function(team) {
    currentTeam = team;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if(team === 'bluejays') document.querySelector('button[onclick="switchTeam(\'bluejays\')"]').classList.add('active');
    else document.querySelector('button[onclick="switchTeam(\'dodgers\')"]').classList.add('active');
    applyFilters();
}

window.filterPos = function(pos) {
    currentPosFilter = pos;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    applyFilters();
}

window.filterName = function() { applyFilters(); }

function applyFilters() {
    const searchVal = document.getElementById('searchInput').value.toUpperCase();
    const cards = bench.querySelectorAll('.player-token');
    cards.forEach(card => {
        const matchTeam = (card.dataset.team === currentTeam);
        let matchPos = false;
        
        if (currentPosFilter === 'ALL') matchPos = true;
        else if (currentPosFilter === 'C') matchPos = (card.dataset.pos === 'C'); // ★ 支援捕手篩選
        else if (currentPosFilter === 'DH') matchPos = true; // DH 顯示所有人(或只顯示強打)
        else if (currentPosFilter === 'IF') matchPos = ['1B','2B','3B','SS','IF','TWP'].includes(card.dataset.pos);
        else if (currentPosFilter === 'OF') matchPos = ['LF','CF','RF','OF','TWP'].includes(card.dataset.pos);
        else matchPos = (card.dataset.pos === currentPosFilter);
        
        const matchName = card.dataset.name.toUpperCase().includes(searchVal);
        card.style.display = (matchTeam && matchPos && matchName) ? 'flex' : 'none';
    });
}