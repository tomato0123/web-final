// 取得頁面元素
const pImage = document.getElementById('p-image');
const pName = document.getElementById('p-name');
const pPosition = document.getElementById('p-position');
const pStat = document.getElementById('p-stat');
const cardScroller = document.getElementById('cardScroller');
const dots = document.querySelectorAll('.dot');

// --- 功能 1: 更新卡片內容 ---
function updateCard(name, imgFileName, position, statValue) {
    pName.innerText = name;
    
    // 判斷 imgFileName 是不是 http 開頭的網址
    if (imgFileName && imgFileName.startsWith('http')) {
        // 如果是 API 來的網址，直接用
        pImage.src = imgFileName;
    } else {
        // 如果是本地檔案 (例如教練圖)，加上路徑
        pImage.src = imgFileName ? `/static/images/players/${imgFileName}` : '/static/images/default_player.png';
    }
    
    pPosition.innerText = `Position: ${position}`;
    pStat.innerText = statValue;

    // 切換球員時，滾動回頂部
    cardScroller.scrollTop = 0;
}

// --- 功能 2: 滾動監聽與指示點更新 ---
cardScroller.addEventListener('scroll', () => {
    const scrollPosition = cardScroller.scrollTop;
    const cardHeight = cardScroller.clientHeight;
    
    // 計算當前頁數
    const currentIndex = Math.round(scrollPosition / cardHeight);

    // 更新指示點
    dots.forEach((dot, index) => {
        if (index === currentIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
});