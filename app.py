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
    
    params = {"hydrate": "person(stats(group=[hitting,pitching],type=season,season=2025))", "season": 2025}
    
    # ★ 修正這裡：分開初始化兩個列表
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
            is_rookie = person.get('rookie', False)
            
            pos_data = player.get('position') or person.get('primaryPosition') or {}
            pos_code = pos_data.get('code')
            pos_abbr = pos_data.get('abbreviation')

            stats_list = person.get('stats', [])
            hitter_stat = {}
            pitcher_stat = {}
            
            for s in stats_list:
                group = s.get('group', {}).get('displayName', '').lower()
                splits = s.get('splits', [])
                if splits:
                    if group == 'hitting': hitter_stat = splits[0].get('stat', {})
                    elif group == 'pitching': pitcher_stat = splits[0].get('stat', {})

            # 1. 處理投手 (補上 script.js 需要的所有欄位)
            if pos_code == '1' or pos_code == 'Y' or pos_abbr == 'TWP' or pitcher_stat:
                pitchers.append({
                    'id': player_id,
                    'name': player_name,
                    'position': pos_abbr,
                    'is_rookie': is_rookie,
                    'img': f"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{player_id}/headshot/67/current",
                    'stats': {
                        'type': 'pitcher',
                        'era': pitcher_stat.get('era', '0.00'),
                        'whip': pitcher_stat.get('whip', '0.00'),
                        'k9': pitcher_stat.get('strikeoutsPer9Inn', '0.00'),
                        'bb9': pitcher_stat.get('walksPer9Inn', '0.00'),
                        # ★ 新增以下缺少的欄位 ★
                        'w_l': f"{pitcher_stat.get('wins', 0)}-{pitcher_stat.get('losses', 0)}",
                        'sv': pitcher_stat.get('saves', 0),
                        'ip': pitcher_stat.get('inningsPitched', '0.0'),
                        'so_bb': pitcher_stat.get('strikeoutWalkRatio', '0.00'),
                        'h9': pitcher_stat.get('hitsPer9Inn', '0.00'),
                        'hr9': pitcher_stat.get('homeRunsPer9Inn', '0.00')
                    }
                })

            # 2. 處理打者 (補上 script.js 需要的所有欄位)
            if pos_code != '1' or hitter_stat:
                hitters.append({
                    'id': player_id,
                    'name': player_name,
                    'position': pos_abbr,
                    'is_rookie': is_rookie,
                    'img': f"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{player_id}/headshot/67/current",
                    'stats': {
                        'type': 'hitter',
                        'avg': hitter_stat.get('avg', '.000'),
                        'ops': hitter_stat.get('ops', '.000'),
                        'hr': hitter_stat.get('homeRuns', 0),
                        # ★ 新增以下缺少的欄位 ★
                        'ab': hitter_stat.get('atBats', 0),
                        'h': hitter_stat.get('hits', 0),
                        'rbi': hitter_stat.get('rbi', 0),
                        'r': hitter_stat.get('runs', 0),
                        'bb': hitter_stat.get('baseOnBalls', 0),
                        'so': hitter_stat.get('strikeOuts', 0),
                        'obp': hitter_stat.get('obp', '.000'),
                        'slg': hitter_stat.get('slg', '.000'),
                        'babip': hitter_stat.get('babip', '.000')
                    }
                })
                
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

@app.route('/sandbox.html')
def sandbox_page():
    # 1. 獲取原始資料
    bj_hitters, bj_pitchers = get_mlb_roster(TEAMS['bluejays'])
    lad_hitters, lad_pitchers = get_mlb_roster(TEAMS['dodgers'])
    
    # 輔助函式：處理球員數據、計算身價、並去除重複 (Merge TWP)
    def process_team_players(hitters, pitchers, team_name):
        player_map = {} # 用 ID 當 Key 來去重

        # 先處理打者
        for p in hitters:
            p_id = p['name'] # 暫時用名字當 ID (API如果有id更好，這裡用名字夠用)
            
            # 真實數據計算
            stats = p['stats']
            ops = float(stats.get('ops', 0) if stats.get('ops') != '.---' else 0)
            
            # 分數：OPS * 90 (例如 OPS 1.0 -> 90分)
            score = ops * 95
            # 薪資(模擬市場價)：底薪0.75M + (OPS平方 * 25)
            # 例如 OPS 1.0 -> $25M, OPS 0.7 -> $12M
            salary = 0.75 + (ops * ops * 25)

            p['power_score'] = round(score, 1)
            p['salary'] = round(salary, 1)
            p['team'] = team_name
            p['role_type'] = 'hitter'
            p['desc'] = f"AVG: {stats.get('avg')} | HR: {stats.get('hr')} | OPS: {stats.get('ops')}"
            
            player_map[p_id] = p

        # 再處理投手 (如果有重複，代表是二刀流 TWP)
        for p in pitchers:
            p_id = p['name']
            stats = p['stats']
            
            era = float(stats.get('era', 99) if stats.get('era') != '-.--' else 99)
            # 分數：防禦率越低越好。 (7 - ERA) * 20
            # ERA 2.0 -> 100分, ERA 5.0 -> 40分
            raw_score = max(0, (6.5 - era) * 20)
            # 薪資：底薪0.75M + 表現加給
            raw_salary = 0.75 + max(0, (5.5 - era) * 8)

            score = round(raw_score, 1)
            salary = round(raw_salary, 1)
            desc = f"ERA: {stats.get('era')} | WHIP: {stats.get('whip')}"

            if p_id in player_map:
                # ★ 發現大谷！(已在打者名單中) -> 執行合併 ★
                existing = player_map[p_id]
                existing['position'] = 'TWP' # 強制標記為二刀流
                
                # 分數取兩者最高 (通常大谷打擊更好)
                existing['power_score'] = max(existing['power_score'], score)
                
                # 薪資疊加 (投打雙份貢獻 = 超級高薪)
                # 大谷真實薪資 70M，這裡模擬算法會接近 50-60M
                existing['salary'] = round(existing['salary'] + salary, 1)
                
                # 描述合併
                existing['desc'] = f"OPS: {existing['stats'].get('ops')} | ERA: {stats.get('era')}"
                existing['role_type'] = 'twp'
            else:
                # 純投手
                p['power_score'] = score
                p['salary'] = salary
                p['team'] = team_name
                p['role_type'] = 'pitcher'
                p['desc'] = desc
                player_map[p_id] = p

        # 轉回 List
        return list(player_map.values())

    # 執行處理
    bj_players = process_team_players(bj_hitters, bj_pitchers, 'bluejays')
    lad_players = process_team_players(lad_hitters, lad_pitchers, 'dodgers')

    return render_template('sandbox.html', bluejays=bj_players, dodgers=lad_players)

@app.route('/api/zones/<int:player_id>/<string:pos_type>')
def get_player_zones(player_id, pos_type):
    # ★ 修改：使用 hotColdZones 抓取九宮格數據
    stat_type = "hotColdZones"
    # 如果是打者抓 hitting，投手抓 pitching (被打擊數據)
    group = "pitching" if pos_type == 'pitcher' else "hitting"
    
    player_zones = []
    
    # 優先嘗試 2025，若無則回退 2024
    seasons_to_try = [2025, 2024]
     
    for season in seasons_to_try:
        try:
            url = f"https://statsapi.mlb.com/api/v1/people/{player_id}/stats?stats={stat_type}&group={group}&season={season}"
            print(f"Requesting: {url}")
            res = requests.get(url).json()
            
            if 'stats' in res and res['stats']:
                splits = res['stats'][0].get('splits', [])
                if splits: 
                    # hotColdZones 的結構通常在 splits[0].stat.zones
                    raw_zones = splits[0].get('stat', {}).get('zones', [])
                    
                    for z in raw_zones:
                        zone_code = z.get('zone') # 例如 "01", "09", "11"
                        if zone_code and zone_code.isdigit():
                            z_num = int(zone_code)
                            # 只取 1~9 號位 (好球帶九宮格)
                            if 1 <= z_num <= 9:
                                # 取出數值 (可能是打擊率 .300)
                                val_str = z.get('value', '.000')
                                try:
                                    val = float(val_str)
                                except: val = 0.0
                                
                                player_zones.append({"zone": z_num, "pct": val})
                    
                    if player_zones: 
                        print(f"Found {len(player_zones)} zones for {player_id}")
                        break
        except Exception as e: 
            print(f"API Error: {e}")
            continue
    
    # 防呆：若真的沒資料，回傳空陣列
    if not player_zones:
        return jsonify([])

    return jsonify(player_zones)


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