from flask import Flask, render_template, jsonify
import requests

app = Flask(__name__)

# MLB API 設定
# Blue Jays ID: 141, Dodgers ID: 119
TEAMS = {
    'bluejays': 141,
    'dodgers': 119
}

# app.py

# 1. 修改抓取函式，增加 position_type 參數來區分
def get_mlb_roster(team_id):
    url = f"https://statsapi.mlb.com/api/v1/teams/{team_id}/roster"
    # 注意：這裡我們同時抓取打擊(season)和投球(pitching)數據
    params = {
        "hydrations": "person(stats(type=season,season=2024,group=[hitting,pitching]))"
    }
    
    try:
        response = requests.get(url, params=params)
        data = response.json()
        
        hitters = []
        pitchers = []

        for player in data.get('roster', []):
            person = player.get('person', {})
            stats_list = person.get('stats', [])
            pos_code = person.get('primaryPosition', {}).get('code')
            
            # 預設數據
            stat_value = 'N/A'
            
            # 判斷是投手還是打者
            is_pitcher = (pos_code == '1')
            
            if stats_list:
                splits = stats_list[0].get('splits', [])
                if splits:
                    stat = splits[0].get('stat', {})
                    if is_pitcher:
                        # 投手顯示 ERA
                        era = stat.get('era', 'N/A')
                        stat_value = f"{era} ERA"
                    else:
                        # 打者顯示打擊率
                        avg = stat.get('avg', 'N/A')
                        stat_value = f"{avg} AVG"

            player_data = {
                'name': person.get('fullName'),
                'position': person.get('primaryPosition', {}).get('abbreviation'),
                'stat': stat_value,
                # 使用 MLB 官方圖片網址
                'img': f"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{person.get('id')}/headshot/67/current"
            }

            if is_pitcher:
                pitchers.append(player_data)
            else:
                hitters.append(player_data)
        
        return hitters, pitchers
    
    except Exception as e:
        print(f"Error: {e}")
        return [], []


# --- 路由設定 ---

# 藍鳥隊路由
@app.route('/bluejays.html')
def bluejays_page():
    # 取得兩份名單
    hitters, pitchers = get_mlb_roster(TEAMS['bluejays'])
    # 把資料傳給網頁 (render_template 的參數)
    return render_template('bluejays.html', hitters=hitters, pitchers=pitchers)

# 道奇隊路由
@app.route('/dodgers.html')
def dodgers_page():
    hitters, pitchers = get_mlb_roster(TEAMS['dodgers'])
    return render_template('dodgers.html', hitters=hitters, pitchers=pitchers)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/matchup.html')
def matchup_page():
    return render_template('matchup.html')

# 這就是我們的前端要呼叫的 API
@app.route('/api/players')
def get_all_players():
    # 分別抓取兩隊數據
    bj_roster = get_mlb_roster(TEAMS['bluejays'])
    lad_roster = get_mlb_roster(TEAMS['dodgers'])
    
    return jsonify({
        'bluejays': bj_roster,
        'dodgers': lad_roster
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)