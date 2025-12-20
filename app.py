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

def get_mlb_roster(team_id):
    url = f"https://statsapi.mlb.com/api/v1/teams/{team_id}/roster"
    # 這裡請求 season (基本) 數據，包含打擊與投球
    params = {
        "hydrations": "person(stats(type=season,season=2024,group=[hitting,pitching]))"
    }
    
    hitters = []
    pitchers = []

    try:
        response = requests.get(url, params=params)
        data = response.json()
        
        for player in data.get('roster', []):
            person = player.get('person', {})
            stats_list = person.get('stats', [])
            pos_abbr = person.get('primaryPosition', {}).get('abbreviation')
            pos_code = person.get('primaryPosition', {}).get('code')
            
            # 判斷身分： '1' 是投手
            is_pitcher = (pos_code == '1')
            
            # --- ★ 修正重點：尋找正確的數據群組 ★ ---
            # 投手要找 'pitching'，打者要找 'hitting'
            target_group = 'pitching' if is_pitcher else 'hitting'
            target_stat = {}

            # 遍歷所有數據，找到對應的那一組
            for stat_group in stats_list:
                group_name = stat_group.get('group', {}).get('displayName')
                if group_name == target_group:
                    splits = stat_group.get('splits', [])
                    if splits:
                        target_stat = splits[0].get('stat', {})
                    break
            # --- 修正結束 ---

            # 初始化數據結構 (給預設值，避免前端出現 undefined)
            stats_data = {}
            
            if is_pitcher:
                # --- 投手數據 (Pitcher) ---
                stats_data = {
                    'type': 'pitcher',
                    # 第二頁: 基本
                    'era': target_stat.get('era', '-.--'),
                    'whip': target_stat.get('whip', '-.--'),
                    'w_l': f"{target_stat.get('wins', 0)}-{target_stat.get('losses', 0)}",
                    'sv': target_stat.get('saves', 0),
                    'ip': target_stat.get('inningsPitched', '0.0'),
                    'so_bb': target_stat.get('strikeoutWalkRatio', '-.--'),
                    # 第三頁: 進階
                    'k9': target_stat.get('strikeoutsPer9Inn', '-.--'),
                    'bb9': target_stat.get('walksPer9Inn', '-.--'),
                    'h9': target_stat.get('hitsPer9Inn', '-.--'),
                    'hr9': target_stat.get('homeRunsPer9Inn', '-.--')
                }
            else:
                # --- 打者數據 (Hitter) ---
                stats_data = {
                    'type': 'hitter',
                    # 第二頁: 基本
                    'avg': target_stat.get('avg', '.---'),
                    'ab': target_stat.get('atBats', 0),
                    'h': target_stat.get('hits', 0),
                    'rbi': target_stat.get('rbi', 0),
                    'r': target_stat.get('runs', 0),
                    'bb': target_stat.get('baseOnBalls', 0),
                    'so': target_stat.get('strikeOuts', 0),
                    # 第三頁: 進階
                    'obp': target_stat.get('onBasePercentage', '.---'),
                    'slg': target_stat.get('sluggingPercentage', '.---'),
                    'ops': target_stat.get('ops', '.---'),
                    'babip': target_stat.get('babip', '.---'),
                    'woba': 'N/A',  # API 無此數據
                    'wrc_plus': 'N/A' # API 無此數據
                }

            player_data = {
                'name': person.get('fullName'),
                'position': pos_abbr,
                'stats': stats_data,
                'img': f"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{person.get('id')}/headshot/67/current"
            }

            if is_pitcher:
                pitchers.append(player_data)
            else:
                hitters.append(player_data)
                
    except Exception as e:
        print(f"Error fetching roster: {e}")

    return hitters, pitchers

def get_mlb_coaches(team_id):
    url = f"https://statsapi.mlb.com/api/v1/teams/{team_id}/coaches"
    coaches = []
    
    try:
        response = requests.get(url)
        data = response.json()
        
        for c in data.get('roster', []):
            person = c.get('person', {})
            job = c.get('job', 'Coach')
            
            # 教練數據 API 較難獲取，先給預設結構以免前端壞掉
            stats_data = {
                'type': 'coach',
                'wins': 'N/A', 
                'win_rate': 'N/A',
                'history': 'Info not in API'
            }

            coaches.append({
                'name': person.get('fullName'),
                'position': job, # 職稱
                'stats': stats_data,
                'img': f"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{person.get('id')}/headshot/67/current"
            })
            
    except Exception as e:
        print(f"Error fetching coaches: {e}")
        
    return coaches

# --- 路由設定 ---

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/index.html')
def home_redirect():
    return render_template('index.html')

@app.route('/bluejays.html')
def bluejays_page():
    # 同時呼叫兩個函式，抓取三種人
    hitters, pitchers = get_mlb_roster(TEAMS['bluejays'])
    coaches = get_mlb_coaches(TEAMS['bluejays'])
    
    # 把三個名單都傳給網頁
    return render_template('bluejays.html', hitters=hitters, pitchers=pitchers, coaches=coaches)

@app.route('/dodgers.html')
def dodgers_page():
    hitters, pitchers = get_mlb_roster(TEAMS['dodgers'])
    coaches = get_mlb_coaches(TEAMS['dodgers'])
    
    return render_template('dodgers.html', hitters=hitters, pitchers=pitchers, coaches=coaches)

@app.route('/matchup.html')
def matchup_page():
    return render_template('matchup.html')

# API 給 matchup.js 用的
@app.route('/api/players')
def get_all_players():
    bj_hitters, bj_pitchers = get_mlb_roster(TEAMS['bluejays'])
    lad_hitters, lad_pitchers = get_mlb_roster(TEAMS['dodgers'])
    
    # 這裡我們把打者和投手合併，方便對決模式使用
    return jsonify({
        'bluejays': bj_hitters + bj_pitchers,
        'dodgers': lad_hitters + lad_pitchers
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)