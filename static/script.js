// 取得頁面元素
const pImage = document.getElementById('p-image');
const pName = document.getElementById('p-name');
const pPosition = document.getElementById('p-position');
const rookieBadge = document.getElementById('rookie-badge');
const statsBasic = document.getElementById('stats-basic');
const statsAdvanced = document.getElementById('stats-advanced');
const cardScroller = document.getElementById('cardScroller');
const dots = document.querySelectorAll('.dot');

// 監聽點擊事件
document.querySelectorAll('.roster-item').forEach(item => {
    item.addEventListener('click', function() {
        // 從 HTML 屬性中取回整包 JSON 資料
        const playerData = JSON.parse(this.getAttribute('data-player'));
        updateCard(playerData);
    });
});

function updateCard(player) {
    // 1. 更新名字
    pName.innerText = player.name;

    // 2. 更新大頭照 (修正重複與邏輯)
    if (player.img && player.img.startsWith('http')) {
        pImage.src = player.img;
    } else {
        pImage.src = '/static/images/default_player.png';
    }

    // 3. ★ 新增：Rookie 標籤控制 (原本缺少的) ★
    // 必須檢查 player.is_rookie 是否為真
    if (player.is_rookie) {
        rookieBadge.style.display = 'inline-block';
    } else {
        rookieBadge.style.display = 'none';
    }

    // 4. 更新守備位置
    pPosition.innerText = player.position;
    
    // 5. 數據呈現 (保持你原本的檢查邏輯)
    const s = player.stats;
    
    // 檢查數據是否存在
    if (!s || Object.keys(s).length === 0 || s.error) {
        // 如果沒數據，清空或顯示提示
        statsBasic.innerHTML = "<p style='padding:20px; color:#666;'>No stats available for this season.</p>";
        statsAdvanced.innerHTML = "<p style='padding:20px; color:#666;'>No advanced stats available.</p>";
        return; 
    }

    let basicHtml = '';
    let advHtml = '';

    const infoBtnHtml = (type) => `
        <div class="stat-info-btn-container">
            <button class="stat-info-btn" onclick="showGlossary('${type}')" title="What do these stats mean?">?</button>
        </div>
    `;

    // ... (原本的 if (s.type === 'hitter') ... 後面的邏輯保持不變)
    if (s.type === 'hitter') {
        basicHtml = infoBtnHtml('hitter') +`
            <div class="stat-item"><strong>AVG (打擊率)</strong> <span>${s.avg}</span></div>
            <div class="stat-item"><strong>HR (全壘打)</strong> <span>${s.hr}</span></div>
            <div class="stat-item"><strong>AB (打數)</strong> <span>${s.ab}</span></div>
            <div class="stat-item"><strong>H (安打)</strong> <span>${s.h}</span></div>
            <div class="stat-item"><strong>RBI (打點)</strong> <span>${s.rbi}</span></div>
            <div class="stat-item"><strong>R (得分)</strong> <span>${s.r}</span></div>
            <div class="stat-item"><strong>BB (四壞)</strong> <span>${s.bb}</span></div>
            <div class="stat-item"><strong>SO (三振)</strong> <span>${s.so}</span></div>
        `;
        advHtml = infoBtnHtml('hitter') +`
            <div class="stat-item"><strong>OBP (上壘率)</strong> <span>${s.obp}</span></div>
            <div class="stat-item"><strong>SLG (長打率)</strong> <span>${s.slg}</span></div>
            <div class="stat-item"><strong>OPS (整體攻擊)</strong> <span>${s.ops}</span></div>
            <div class="stat-item"><strong>BABIP</strong> <span>${s.babip}</span></div>
        `;
    } else if (s.type === 'pitcher') {
        // ... (投手的 HTML 保持不變) ...
        basicHtml = infoBtnHtml('pitcher') +`
            <div class="stat-item"><strong>ERA (防禦率)</strong> <span>${s.era}</span></div>
            <div class="stat-item"><strong>WHIP</strong> <span>${s.whip}</span></div>
            <div class="stat-item"><strong>W-L (勝敗)</strong> <span>${s.w_l}</span></div>
            <div class="stat-item"><strong>SV (救援)</strong> <span>${s.sv}</span></div>
            <div class="stat-item"><strong>IP (局數)</strong> <span>${s.ip}</span></div>
            <div class="stat-item"><strong>SO/BB</strong> <span>${s.so_bb}</span></div>
        `;
        advHtml = infoBtnHtml('pitcher') +`
            <div class="stat-item"><strong>K/9 (每九局K)</strong> <span>${s.k9}</span></div>
            <div class="stat-item"><strong>BB/9 (每九局BB)</strong> <span>${s.bb9}</span></div>
            <div class="stat-item"><strong>H/9 (每九局安打)</strong> <span>${s.h9}</span></div>
            <div class="stat-item"><strong>HR/9 (每九局HR)</strong> <span>${s.hr9}</span></div>
        `;
    } else {
        // ... (教練的 HTML 保持不變) ...
        basicHtml = `
            <div class="stat-item"><strong>Job Title</strong> <span>${player.position}</span></div>
            <div class="stat-item"><strong>Wins</strong> <span>${s.wins}</span></div>
            <div class="stat-item"><strong>Win Rate</strong> <span>${s.win_rate}</span></div>
        `;
        advHtml = `
            <div class="stat-item"><strong>History</strong></div>
            <p style="font-size:14px; color:#666;">${s.history}</p>
        `;
    }

    statsBasic.innerHTML = basicHtml;
    statsAdvanced.innerHTML = advHtml;

    cardScroller.scrollTop = 0;
}

// --- 滾動監聽與指示點更新 ---
cardScroller.addEventListener('scroll', () => {
    const scrollPosition = cardScroller.scrollTop;
    const cardHeight = cardScroller.clientHeight;
    
    // 計算當前頁數 (0, 1, 2)
    const currentIndex = Math.round(scrollPosition / cardHeight);

    dots.forEach((dot, index) => {
        if (index === currentIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
});

// 顯示彈出視窗
function showGlossary(type) {
    const modalId = type === 'hitter' ? 'hitter-glossary-modal' : 'pitcher-glossary-modal';
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex'; // 使用 flex 讓它置中
    }
}

// 關閉所有彈出視窗
function closeGlossary() {
    document.querySelectorAll('.glossary-modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// 點擊視窗外部背景時也要關閉
window.onclick = function(event) {
    if (event.target.classList.contains('glossary-modal')) {
        closeGlossary();
    }
}