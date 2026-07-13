# OpenClaw 技能开发指南：以招标信息监控为例

> **适用版本**: ClawManager 2026.5.4, OpenClaw 2026.5.4
> **编写日期**: 2026-06-28
> **场景**: 为 OpenClaw 实例预置技能——搜索并登录招标信息公告网站，监控招标信息，定时发送给用户

---

## 一、技能系统架构概览

ClawManager 的技能系统有**两条注入路径**，理解这个区别是构建技能的前提：

| 路径 | 机制 | 时机 | 内容形式 |
|---|---|---|---|
| **A: 配置技能** | `CLAWMANAGER_*_SCHEDULED_TASKS_JSON` 等环境变量 | 实例创建时 | JSON 描述符（非 zip） |
| **B: 平台技能包** | `install_skill` 命令 → 下载 zip → 解压 | 运行时按需 | zip 包（含 skill.json + 源码） |

**你的招标监控技能需要两者配合：**
- **技能包（Path B）**：包含网站登录、爬取、通知逻辑的可执行代码
- **定时任务（Path A）**：cron 表达式，定时触发技能执行

两者可以打包到一个 **OpenClaw Config Bundle** 中，实现一键部署。

---

## 二、技能包结构

### 2.1 目录结构

```
tender-monitor/
  skill.json              ← 技能清单文件（必需）
  src/
    main.py               ← 主入口：登录 + 爬取 + 通知
    scraper.py            ← 网站爬取逻辑
    notifier.py           ← 通知发送逻辑
    config.py             ← 配置读取
  requirements.txt        ← Python 依赖（可选）
  README.md               ← 说明文档（可选）
```

### 2.2 skill.json 格式

```json
{
  "schemaVersion": 1,
  "kind": "skill",
  "format": "skill/custom@v1",
  "name": "tender-monitor",
  "version": "1.0.0",
  "description": "监控招标信息公告网站，定时发送新招标信息给用户",
  "dependsOn": [],
  "config": {
    "prompt": "你是一个招标信息监控助手。定时检查招标网站的新公告，并将新内容通知用户。",
    "sites": [
      {
        "name": "中国招标投标公共服务平台",
        "url": "http://www.cebpubservice.com/",
        "login_required": false,
        "selectors": {
          "list": ".list-item",
          "title": ".title",
          "date": ".date",
          "link": "a[href]"
        }
      }
    ],
    "notification": {
      "channel": "feishu",
      "schedule": "0 9 * * *"
    }
  }
}
```

> **注意**: `skill.json` 的 `config` 字段内容会被注入到 OpenClaw 运行时。具体的字段格式取决于 OpenClaw 运行时如何解析——你可以在 pod 内检查 `/usr/local/lib/node_modules/openclaw/dist/` 确认运行时期望的格式。

### 2.3 src/main.py 示例

```python
#!/usr/bin/env python3
"""招标信息监控技能主入口"""

import json
import os
import sys
from pathlib import Path

# 技能安装路径下的模块
SKILL_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(SKILL_DIR / "src"))

from scraper import TenderScraper
from notifier import NotificationSender
from config import load_config


def main():
    """主执行函数：爬取 → 去重 → 通知"""
    config = load_config(SKILL_DIR / "skill.json")
    
    # 读取上次运行的状态（已通知的招标公告 ID 列表）
    state_file = SKILL_DIR / ".state" / "notified.json"
    state_file.parent.mkdir(parents=True, exist_ok=True)
    notified_ids = set()
    if state_file.exists():
        notified_ids = set(json.loads(state_file.read_text()))
    
    # 爬取所有配置的招标网站
    scraper = TenderScraper()
    all_new_tenders = []
    
    for site in config.get("sites", []):
        tenders = scraper.scrape(site)
        new_tenders = [t for t in tenders if t["id"] not in notified_ids]
        all_new_tenders.extend(new_tenders)
        notified_ids.update(t["id"] for t in new_tenders)
    
    # 发送通知
    if all_new_tenders:
        notifier = NotificationSender(config.get("notification", {}))
        notifier.send(all_new_tenders)
        print(f"Sent {len(all_new_tenders)} new tender notifications")
    else:
        print("No new tenders found")
    
    # 保存状态
    state_file.write_text(json.dumps(list(notified_ids)))


if __name__ == "__main__":
    main()
```

### 2.4 src/scraper.py 示例

```python
"""招标网站爬取器"""

import hashlib
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urljoin


class TenderScraper:
    def scrape(self, site_config):
        """爬取一个招标网站的最新公告列表"""
        url = site_config["url"]
        selectors = site_config.get("selectors", {})
        login_required = site_config.get("login_required", False)
        
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (compatible; TenderMonitor/1.0)"
        })
        
        # 如果需要登录
        if login_required:
            self._login(session, site_config)
        
        # 获取列表页
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        
        # 解析招标公告列表
        items = soup.select(selectors.get("list", ".list-item"))
        tenders = []
        for item in items:
            title_el = item.select_one(selectors.get("title", ".title"))
            date_el = item.select_one(selectors.get("date", ".date"))
            link_el = item.select_one(selectors.get("link", "a[href]"))
            
            if not title_el:
                continue
            
            title = title_el.get_text(strip=True)
            date_str = date_el.get_text(strip=True) if date_el else ""
            link = urljoin(url, link_el["href"]) if link_el else ""
            
            # 用标题+日期生成唯一 ID
            tender_id = hashlib.md5(f"{title}{date_str}".encode()).hexdigest()
            
            tenders.append({
                "id": tender_id,
                "title": title,
                "date": date_str,
                "link": link,
                "source": site_config["name"]
            })
        
        return tenders
    
    def _login(self, session, site_config):
        """处理网站登录"""
        login_url = site_config.get("login_url")
        login_data = site_config.get("login_data", {})
        # 实现具体的登录逻辑
        if login_url:
            session.post(login_url, data=login_data, timeout=30)
```

### 2.5 src/notifier.py 示例

```python
"""通知发送器"""

import json
import requests


class NotificationSender:
    def __init__(self, config):
        self.channel = config.get("channel", "console")
        self.webhook_url = config.get("webhook_url", "")
    
    def send(self, tenders):
        """发送招标信息通知"""
        if not tenders:
            return
        
        message = self._format_message(tenders)
        
        if self.channel == "feishu":
            self._send_feishu(message)
        elif self.channel == "telegram":
            self._send_telegram(message)
        else:
            print(message)
    
    def _format_message(self, tenders):
        lines = [f"📋 发现 {len(tenders)} 条新招标信息:\n"]
        for t in tenders[:20]:  # 最多 20 条
            lines.append(f"• {t['title']}")
            lines.append(f"  日期: {t['date']} | 来源: {t['source']}")
            if t.get("link"):
                lines.append(f"  链接: {t['link']}")
            lines.append("")
        return "\n".join(lines)
    
    def _send_feishu(self, message):
        if not self.webhook_url:
            return
        requests.post(self.webhook_url, json={
            "msg_type": "text",
            "content": {"text": message}
        }, timeout=10)
    
    def _send_telegram(self, message):
        if not self.webhook_url:
            return
        requests.post(self.webhook_url, json={
            "chat_id": self.config.get("chat_id"),
            "text": message
        }, timeout=10)
```

### 2.6 src/config.py 示例

```python
"""配置读取"""

import json
from pathlib import Path


def load_config(skill_json_path):
    """从 skill.json 读取配置"""
    with open(skill_json_path) as f:
        data = json.load(f)
    return data.get("config", {})
```

---

## 三、打包与上传

### 3.1 创建 zip 包

```bash
# 确保顶层目录名与 skill_key 一致
cd /tmp
zip -r tender-monitor.zip tender-monitor/
```

**zip 结构必须为：**
```
tender-monitor.zip
  tender-monitor/
    skill.json
    src/
      main.py
      scraper.py
      notifier.py
      config.py
    requirements.txt
    README.md
```

### 3.2 计算 content_md5（用于验证）

使用 `docs/skill-content-md5-spec.md` 中的 Python 参考实现：

```python
import hashlib
from pathlib import Path

def skill_content_md5(skill_dir):
    root = Path(skill_dir).resolve()
    files = {}
    dirs = set()
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        if rel.startswith("./"):
            rel = rel[2:]
        if not rel or rel == "." or rel.startswith("../"):
            continue
        if any(part.startswith(".") for part in rel.split("/")):
            continue
        files[rel] = path.read_bytes()
        parts = rel.split("/")
        for i in range(1, len(parts)):
            parent = "/".join(parts[:i])
            if parent and not any(p.startswith(".") for p in parent.split("/")):
                dirs.add(parent)
    entries = {rel: "file" for rel in files}
    for rel in dirs:
        entries[rel] = "dir"
    digest = hashlib.md5()
    for rel in sorted(entries):
        digest.update(rel.encode("utf-8"))
        digest.update(b"\n")
        if entries[rel] == "dir":
            digest.update(b"dir\n")
        else:
            digest.update(b"file\n")
            digest.update(files[rel])
            digest.update(b"\n")
    return digest.hexdigest()

# 使用
print(skill_content_md5("/tmp/tender-monitor"))
```

### 3.3 通过 API 上传

```bash
# 登录
TOKEN=$(curl -s -X POST http://<backend>:9001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# 上传技能 zip
curl -s -X POST "http://<backend>:9001/api/v1/skills/import" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/tender-monitor.zip" \
  | python3 -m json.tool
```

上传后，skill-scanner 会自动扫描风险等级。如果风险等级为 `medium` 或 `high`，技能将被阻止附加到实例。

### 3.4 通过前端 UI 上传

1. 登录 ClawManager 前端
2. 进入 **管理** → **技能管理**
3. 点击 **导入技能**
4. 选择 `tender-monitor.zip` 上传
5. 等待安全扫描完成
6. 确认风险等级为 `none` 或 `low`

---

## 四、定时任务配置

### 4.1 创建定时任务配置资源

定时任务（`scheduled_task`）是一种 OpenClaw Config 资源，通过环境变量 `CLAWMANAGER_OPENCLAW_SCHEDULED_TASKS_JSON` 注入实例。

通过 API 创建：

```bash
curl -s -X POST "http://<backend>:9001/api/v1/openclaw-config/resources" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_type": "scheduled_task",
    "resource_key": "tender-monitor-daily",
    "name": "招标信息每日监控",
    "description": "每天 9:00 执行招标信息监控技能",
    "enabled": true,
    "content": {
      "schemaVersion": 1,
      "kind": "scheduled_task",
      "format": "scheduled_task/cron@v1",
      "config": {
        "schedule": "0 9 * * *",
        "skill": "tender-monitor",
        "action": "run",
        "args": {}
      }
    }
  }'
```

> **注意**: `scheduled_task` 的 `content` 字段格式取决于 OpenClaw 运行时的解析逻辑。你可以在 pod 内检查 OpenClaw 的 cron 配置格式：
> ```bash
> kubectl exec -n clawmanager-system <pod> -- cat /workspaces/openclaw/user-1/instance-4/home/.openclaw/cron/jobs.json
> ```

### 4.2 创建通知渠道（可选）

如果需要通过飞书/Telegram 等发送通知，创建一个 channel 配置资源：

```bash
curl -s -X POST "http://<backend>:9001/api/v1/openclaw-config/resources" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_type": "channel",
    "resource_key": "tender-notify-feishu",
    "name": "招标通知飞书群",
    "enabled": true,
    "content": {
      "schemaVersion": 1,
      "kind": "channel",
      "format": "channel/feishu@v1",
      "config": {
        "webhook_url": "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx",
        "msg_type": "text"
      }
    }
  }'
```

---

## 五、打包为 Bundle 一键部署

将技能 + 定时任务 + 通知渠道组合到一个 Bundle 中：

```bash
curl -s -X POST "http://<backend>:9001/api/v1/openclaw-config/bundles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "招标监控套件",
    "description": "包含爬取技能、定时任务和通知渠道的完整套件",
    "enabled": true,
    "items": [
      {"resource_id": <scheduled_task_id>, "sort_order": 1, "required": true},
      {"resource_id": <channel_id>, "sort_order": 2, "required": true}
    ],
    "skill_items": [
      {"skill_id": <tender_monitor_skill_id>, "sort_order": 1, "required": true}
    ]
  }'
```

创建实例时选择此 Bundle，所有资源会一起注入。

---

## 六、附加技能到已有实例

如果实例已经存在，可以直接附加技能：

```bash
# 附加技能（会创建 install_skill 命令）
curl -s -X POST "http://<backend>:9001/api/v1/instances/4/skills" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"skill_id": <tender_monitor_skill_id>}'

# 查看实例技能列表
curl -s "http://<backend>:9001/api/v1/instances/4/skills" \
  -H "Authorization: Bearer $TOKEN"
```

附加后，ClawManager 会向 agent 发送 `install_skill` 命令。Agent 会：
1. 下载技能 zip
2. 解压到 `.openclaw/skills/tender-monitor/`
3. 计算 `content_md5` 验证
4. 上报技能清单

---

## 七、技能安装路径

| 运行时类型 | 技能根目录 | 配置文件 |
|---|---|---|
| OpenClaw (Lite) | `/workspaces/openclaw/user-{uid}/instance-{iid}/home/.openclaw/skills/{name}` | `{workspace}/home/.openclaw/openclaw.json` |
| OpenClaw (Pro) | 同上 | 同上 |
| Hermes | `/config/.hermes/skills/{name}` | `/config/.hermes/hermes.json` |

技能代码在 agent 运行时进程空间内执行，可以访问：
- `CLAWMANAGER_LLM_*` 环境变量（AI Gateway LLM 接口）
- OpenClaw 的浏览器自动化能力
- 实例工作空间文件系统

---

## 八、安全注意事项

### 8.1 安全扫描

上传技能后，`skill-scanner` 服务会自动扫描：
- 网络访问代码（`requests.get`、`urllib` 等）
- 凭据处理（密码、token、API key）
- 文件系统操作
- 命令执行

如果扫描结果为 `medium` 或 `high` 风险，技能将被**阻止附加**到实例。需要管理员手动重新扫描或调整扫描规则。

### 8.2 凭据存储

**不要**将登录凭据放在技能 zip 包中。应通过以下方式传递：
1. 在 `skill.json` 的 `config` 字段中引用环境变量名
2. 通过 ClawManager 的 Secret 机制注入
3. 或在实例工作空间中手动配置（如 `.openclaw/tender-monitor/credentials.json`，权限 `0600`）

### 8.3 content_md5 校验

Agent 安装技能后会重新计算 `content_md5`，如果与平台记录的不匹配，安装会失败。常见错误：
- zip 中包含了隐藏文件（`.git/`, `.DS_Store`）→ 被跳过，不影响
- zip 中有多层目录 → 只剥离一层顶层目录
- 在上传前修改了文件但没有重新打包 → content_md5 变化

---

## 九、调试与验证

### 9.1 检查技能是否安装成功

```bash
POD=$(kubectl get pods -n clawmanager-system -l app=openclaw-runtime -o jsonpath='{.items[0].metadata.name}')

# 检查技能目录
kubectl exec -n clawmanager-system $POD -- ls -la /workspaces/openclaw/user-1/instance-4/home/.openclaw/skills/tender-monitor/

# 检查技能清单
kubectl exec -n clawmanager-system $POD -- cat /workspaces/openclaw/user-1/instance-4/home/.openclaw/skills/tender-monitor/skill.json

# 检查 cron 任务
kubectl exec -n clawmanager-system $POD -- cat /workspaces/openclaw/user-1/instance-4/home/.openclaw/cron/jobs.json
```

### 9.2 手动执行技能

```bash
kubectl exec -n clawmanager-system $POD -- bash -c '
cd /workspaces/openclaw/user-1/instance-4/home/.openclaw/skills/tender-monitor
python3 src/main.py
'
```

### 9.3 检查 OpenClaw 日志

```bash
kubectl exec -n clawmanager-system $POD -- tail -20 /tmp/openclaw-200004/openclaw-*.log
```

### 9.4 检查平台侧技能状态

```bash
TOKEN=$(curl -s -X POST http://<backend>:9001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# 查看实例技能列表
curl -s "http://<backend>:9001/api/v1/instances/4/skills" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 查看技能扫描结果
curl -s "http://<backend>:9001/api/v1/skills/<id>/scan-results" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

---

## 十、完整流程总结

```
1. 编写技能代码
   └─ tender-monitor/skill.json + src/*.py

2. 打包 zip
   └─ zip -r tender-monitor.zip tender-monitor/

3. 上传到平台
   └─ POST /api/v1/skills/import (或前端 UI)
   └─ skill-scanner 自动扫描风险

4. 创建定时任务配置资源
   └─ POST /api/v1/openclaw-config/resources (type=scheduled_task)

5. 创建通知渠道配置资源（可选）
   └─ POST /api/v1/openclaw-config/resources (type=channel)

6. 打包为 Bundle（可选但推荐）
   └─ POST /api/v1/openclaw-config/bundles

7. 部署到实例
   ├─ 新实例：创建时选择 Bundle
   └─ 已有实例：POST /api/v1/instances/:id/skills + 应用配置快照

8. 验证
   └─ 检查技能目录、cron 任务、OpenClaw 日志
```

---

## 十一、相关 API 速查

| 操作 | Method | Path |
|---|---|---|
| 上传技能 | POST | `/api/v1/skills/import` |
| 列出技能 | GET | `/api/v1/skills` |
| 获取技能 | GET | `/api/v1/skills/:id` |
| 下载技能 | GET | `/api/v1/skills/:id/download` |
| 技能版本列表 | GET | `/api/v1/skills/:id/versions` |
| 扫描结果 | GET | `/api/v1/skills/:id/scan-results` |
| 附加到实例 | POST | `/api/v1/instances/:id/skills` |
| 从实例移除 | DELETE | `/api/v1/instances/:id/skills/:skillId` |
| 创建配置资源 | POST | `/api/v1/openclaw-config/resources` |
| 创建 Bundle | POST | `/api/v1/openclaw-config/bundles` |
| 编译快照 | POST | `/api/v1/openclaw-config/snapshots` |
| 应用快照 | POST | `/api/v1/instances/:id/config-snapshot` |

---

## 十二、相关文档

- [Skill Content MD5 计算规范](./skill-content-md5-spec.md)
- [Hermes 运行时 Agent 开发指南](./hermes-runtime-agent-development.md)
- [通用运行时 Agent 集成指南](./runtime-agent-integration-guide.md)
- [资源管理指南](./resource-management.md)
- [安全 / Skill Scanner 指南](./security-skill-scanner.md)
- [OpenClaw LLM 连接故障排查](./openclaw-llm-troubleshooting.md)
