// 取得頁面元素
const pImage = document.getElementById('p-image');
const pName = document.getElementById('p-name');
const pPosition = document.getElementById('p-position');
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
    // 1. 更新大頭照與名字
    pName.innerText = player.name;
    pPosition.innerText = player.position;
    
    if (player.img && player.img.startsWith('http')) {
        pImage.src = player.img;
    } else {
        pImage.src = '/static/images/default_player.png';
    }

    // 2. 準備數據 HTML
    const s = player.stats;
    
    // ★ 新增這段檢查：如果數據是空的，顯示提示，不要讓它報錯 ★
    if (!s || Object.keys(s).length === 0 || s.error) {
        statsBasic.innerHTML = "<p style='padding:20px; color:#666;'>No stats available for this season.</p>";
        statsAdvanced.innerHTML = "<p style='padding:20px; color:#666;'>No advanced stats available.</p>";
        return; 
    }

    let basicHtml = '';
    let advHtml = '';

    if (s.type === 'hitter') {
        // [打者]
        // 第二頁: 基本
        basicHtml = `
            <div class="stat-item"><strong>AVG (打擊率)</strong> <span>${s.avg}</span></div>
            <div class="stat-item"><strong>AB (打數)</strong> <span>${s.ab}</span></div>
            <div class="stat-item"><strong>H (安打)</strong> <span>${s.h}</span></div>
            <div class="stat-item"><strong>RBI (打點)</strong> <span>${s.rbi}</span></div>
            <div class="stat-item"><strong>R (得分)</strong> <span>${s.r}</span></div>
            <div class="stat-item"><strong>BB (四壞)</strong> <span>${s.bb}</span></div>
            <div class="stat-item"><strong>SO (三振)</strong> <span>${s.so}</span></div>
        `;
        // 第三頁: 進階
        advHtml = `
            <div class="stat-item"><strong>OBP (上壘率)</strong> <span>${s.obp}</span></div>
            <div class="stat-item"><strong>SLG (長打率)</strong> <span>${s.slg}</span></div>
            <div class="stat-item"><strong>OPS (整體攻擊)</strong> <span>${s.ops}</span></div>
            <div class="stat-item"><strong>BABIP</strong> <span>${s.babip}</span></div>
            <div class="stat-item"><strong>wOBA</strong> <span>${s.woba}</span></div>
            <div class="stat-item"><strong>wRC+</strong> <span>${s.wrc_plus}</span></div>
        `;

    } else if (s.type === 'pitcher') {
        // [投手]
        // 第二頁: 基本
        basicHtml = `
            <div class="stat-item"><strong>ERA (防禦率)</strong> <span>${s.era}</span></div>
            <div class="stat-item"><strong>WHIP</strong> <span>${s.whip}</span></div>
            <div class="stat-item"><strong>W-L (勝敗)</strong> <span>${s.w_l}</span></div>
            <div class="stat-item"><strong>SV (救援)</strong> <span>${s.sv}</span></div>
            <div class="stat-item"><strong>IP (局數)</strong> <span>${s.ip}</span></div>
            <div class="stat-item"><strong>SO/BB</strong> <span>${s.so_bb}</span></div>
        `;
        // 第三頁: 進階
        advHtml = `
            <div class="stat-item"><strong>K/9 (每九局K)</strong> <span>${s.k9}</span></div>
            <div class="stat-item"><strong>BB/9 (每九局BB)</strong> <span>${s.bb9}</span></div>
            <div class="stat-item"><strong>H/9 (每九局安打)</strong> <span>${s.h9}</span></div>
            <div class="stat-item"><strong>HR/9 (每九局HR)</strong> <span>${s.hr9}</span></div>
        `;

    } else {
        // [教練]
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

    // 填入 HTML
    statsBasic.innerHTML = basicHtml;
    statsAdvanced.innerHTML = advHtml;

    // 切換球員時，自動滾回第一頁
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