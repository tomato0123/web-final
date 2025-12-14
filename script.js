// 取得頁面元素
const pImage = document.getElementById('p-image');
const pName = document.getElementById('p-name');
const pPosition = document.getElementById('p-position');
const pStat = document.getElementById('p-stat');
const cardScroller = document.getElementById('cardScroller');
const dots = document.querySelectorAll('.dot');

// --- 功能 1: 更新卡片內容 ---
// 這裡的參數對應 HTML 中 onclick 傳入的值
function updateCard(name, imgFileName, position, statValue) {
    // 更新文字和圖片路徑
    pName.innerText = name;
    // 假設你的圖片都放在 images/players/ 資料夾下，且有預設圖
    pImage.src = imgFileName ? `images/players/${imgFileName}` : 'images/default_player.png';
    pPosition.innerText = `Position: ${position}`;
    pStat.innerText = statValue;

    // 重要：切換球員時，把卡片滾動回最上面 (第一頁)
    cardScroller.scrollTop = 0;
}


// --- 功能 2: 滾動監聽與指示點更新 ---
cardScroller.addEventListener('scroll', () => {
    // 計算當前滾動的高度
    const scrollPosition = cardScroller.scrollTop;
    // 計算卡片容器的高度
    const cardHeight = cardScroller.clientHeight;
    
    // 計算當前在哪一頁 (四捨五入)
    // 例如：滾動了 0px 是第 0 頁，滾動了 600px 是第 1 頁
    const currentIndex = Math.round(scrollPosition / cardHeight);

    // 更新指示點的 active 狀態
    dots.forEach((dot, index) => {
        if (index === currentIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
});