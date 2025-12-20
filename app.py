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
    print(f"\n--- 開始抓取球隊 {team_id} 的 2025 賽季資料 ---") 
    url = f"https://statsapi.mlb.com/api/v1/teams/{team_id}/roster"
    
    # ★ 設定為 2025 (因為賽季已結束，數據應該都有了)
    params = {
        "hydrate": "person(stats(group=[hitting,pitching],type=season,season=2025))",
        "season": 2025 
    }
    
    hitters = []
    pitchers = []

    try:
        response = requests.get(url, params=params)
        data = response.json()
        
        roster_list = data.get('roster', [])
        if not roster_list:
            print(f"!!! 警告: 球隊 {team_id} 回傳的名單是空的 !!!")

        for player in roster_list:
            person = player.get('person', {})
            player_name = person.get('fullName', 'Unknown')
            player_id = person.get('id')
            
            # --- 新人判斷邏輯 (2025版) ---
            is_rookie = person.get('rookie', False)
            
            # 輔助判斷：如果是 2025 年才初登場，也視為新人
            debut_date = person.get('mlbDebutDate', '')
            if debut_date and debut_date.startswith('2025'):
                is_rookie = True
            
            # 抓取守備位置
            pos_data = player.get('position') or person.get('primaryPosition') or {}
            pos_code = pos_data.get('code')
            pos_abbr = pos_data.get('abbreviation')

            # 提取數據 (統一抓 2025)
            stats_list = person.get('stats', [])
            hitter_stat = {}
            pitcher_stat = {}
            
            for s in stats_list:
                group = s.get('group', {}).get('displayName', '').lower()
                splits = s.get('splits', [])
                if splits:
                    if group == 'hitting':
                        hitter_stat = splits[0].get('stat', {})
                    elif group == 'pitching':
                        pitcher_stat = splits[0].get('stat', {})

            # --- 分流判斷 ---

            # 1. 處理投手 (Pitchers)
            # 條件：投手(1)、二刀流(Y)、TWP，或有 2025 投球數據
            if pos_code == '1' or pos_code == 'Y' or pos_abbr == 'TWP' or pitcher_stat:
                pitchers.append({
                    'name': player_name,
                    'position': pos_abbr,
                    'is_rookie': is_rookie,
                    'img': f"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{player_id}/headshot/67/current",
                    'stats': {
                        'type': 'pitcher',
                        'era': pitcher_stat.get('era', '-.--'),
                        'whip': pitcher_stat.get('whip', '-.--'),
                        'w_l': f"{pitcher_stat.get('wins', 0)}-{pitcher_stat.get('losses', 0)}",
                        'sv': pitcher_stat.get('saves', 0),
                        'ip': pitcher_stat.get('inningsPitched', '0.0'),
                        'so_bb': pitcher_stat.get('strikeoutWalkRatio', '-.--'),
                        'k9': pitcher_stat.get('strikeoutsPer9Inn', '-.--'),
                        'bb9': pitcher_stat.get('walksPer9Inn', '-.--'),
                        'h9': pitcher_stat.get('hitsPer9Inn', '-.--'),
                        'hr9': pitcher_stat.get('homeRunsPer9Inn', '-.--')
                    }
                })

            # 2. 處理打者 (Hitters)
            # 條件：非純投手(1)，或者有 2025 打擊數據 (大谷翔平會進來這裡)
            if pos_code != '1' or hitter_stat:
                hitters.append({
                    'name': player_name,
                    'position': pos_abbr,
                    'is_rookie': is_rookie,
                    'img': f"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{player_id}/headshot/67/current",
                    'stats': {
                        'type': 'hitter',
                        'avg': hitter_stat.get('avg', '.---'),
                        'hr': hitter_stat.get('homeRuns', 0),
                        'ab': hitter_stat.get('atBats', 0),
                        'h': hitter_stat.get('hits', 0),
                        'rbi': hitter_stat.get('rbi', 0),
                        'r': hitter_stat.get('runs', 0),
                        'bb': hitter_stat.get('baseOnBalls', 0),
                        'so': hitter_stat.get('strikeOuts', 0),
                        'obp': hitter_stat.get('obp', '.---'),
                        'slg': hitter_stat.get('slg', '.---'),
                        'ops': hitter_stat.get('ops', '.---'),
                        'babip': hitter_stat.get('babip', '.---'),
                    }
                })
        
        print(f"--- 成功: {team_id} 抓到 {len(hitters)} 位打者, {len(pitchers)} 位投手 ---\n")
                
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