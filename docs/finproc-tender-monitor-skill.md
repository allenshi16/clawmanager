# 金融采购招标监控技能 + 实例模板

> **目标网站**: 金采网 (cfcpn.com) + 中银智采 (ctpch.fmscop.bankofchina.com)
> **技能类型**: Prompt 驱动的 Agent 自主技能（无硬编码爬虫）
> **部署方式**: 技能 + 实例模板，模板创建实例即自动具备此技能

---

## 一、技能文件

### 1.1 目录结构

```
finproc-tender-monitor/
  skill.json
  README.md
```

> **没有 Python 代码** — 技能核心是 prompt，Agent 用 LLM + browser 插件自主执行。

### 1.2 skill.json

```json
{
  "schemaVersion": 1,
  "kind": "skill",
  "format": "skill/custom@v1",
  "name": "finproc-tender-monitor",
  "version": "1.0.0",
  "description": "金融采购招标信息监控技能——自主监控金采网和中银智采的招标公告，根据用户关键词筛选，定时通知",
  "dependsOn": [],
  "config": {
    "prompt": "你是一个专业的金融采购招标信息监控助手。你负责监控以下金融采购平台的招标公告，并根据用户提供的关键词筛选相关信息后通知用户。\n\n## 监控目标网站\n\n### 网站一：金采网\n- 名称：金采网（中国金融集中采购网）\n- 入口页：http://www.cfcpn.com/\n- 公告类型：采购公告、征集公告、结果公告、更正公告\n- 特点：金融机构采购信息聚合平台，无需登录即可浏览公告列表\n- 公告列表入口：在首页找到「采购公告」「征集公告」「结果公告」「更正公告」等栏目入口\n\n### 网站二：中银智采\n- 名称：中银智采（中国银行采购平台）\n- 入口页：https://ctpch.fmscop.bankofchina.com/\n- 备用入口：https://www.boc.cn/aboutboc/bi6/（中国银行官网采购公告页）\n- 公告类型：采购公告、采购结果公示、变更公告\n- 特点：中国银行及其下属机构的采购项目信息\n- 注意：中银智采平台部分功能需要注册登录。如果无法登录，改用 boc.cn/aboutboc/bi6/ 的公开公告页面\n\n## 工作流程\n\n### 启动阶段（首次运行）\n\n1. 从记忆中加载用户关键词和历史状态。如果是首次运行，向用户确认关注的关键词（如：IT设备、软件、安全、咨询服务、办公用品等）\n2. 用浏览器打开金采网首页，观察页面结构，找到各类型公告的列表入口\n3. 用浏览器打开中银智采（或 boc.cn 采购公告页），观察页面结构\n4. 将两个网站的操作方法存入记忆：\n   - 列表页 URL\n   - 翻页方式\n   - 公告条目的标题、日期、链接位置\n   - 是否需要登录\n\n### 日常监控（每次运行）\n\n1. 从记忆加载已知网站操作方法和已通知公告记录\n2. 逐个打开网站公告列表页\n3. 对每个网站：\n   a. 获取最新公告列表（翻页查看最近 2-3 页）\n   b. 对每条公告，用 LLM 判断标题是否匹配用户关键词\n   c. 对匹配的公告，打开详情页获取摘要信息\n   d. 与记忆中的「已通知列表」比对，找出新公告\n4. 如果发现新的匹配公告：\n   a. 提取标题、日期、来源网站、公告类型、链接、摘要\n   b. 按重要性排序（采购公告 > 征集公告 > 更正公告 > 结果公告）\n   c. 格式化通知消息\n   d. 通过配置的通知渠道发送\n5. 更新记忆中的「已通知列表」\n\n### 持续进化\n\n1. 每周一次重新搜索是否有新的金融采购平台出现（搜索关键词：「金融采购」「银行招标」「采购公告」）\n2. 如果发现新平台，学习其结构并加入监控范围\n3. 如果某个网站改版导致操作失败，重新学习其结构\n4. 根据用户反馈调整关键词（用户说\"多关注安全类\"就增加安全相关关键词权重）\n5. 记录每个网站的信息更新频率，优化检查策略（更新快的网站多检查，更新慢的少检查）\n\n## 关键词处理\n\n- 用户可以通过对话提供关键词：「帮我关注『网络安全』和『数据治理』相关的招标」\n- 支持关键词分组：\n  - 必含关键词（标题必须包含才通知）\n  - 或含关键词（标题包含任一即通知）\n  - 排除关键词（标题包含则不通知）\n- 如果用户没有提供关键词，默认关注所有采购公告\n- 每次用户调整关键词时，更新记忆中的 user_preferences\n\n## 记忆结构\n\n在记忆中维护以下信息：\n\n```\ndiscovered_sites:\n  - name: 金采网\n    url: http://www.cfcpn.com/\n    login_required: false\n    quality_score: 8\n    last_checked: 2026-06-28T09:00:00Z\n    update_frequency: daily\n  - name: 中银智采\n    url: https://ctpch.fmscop.bankofchina.com/\n    fallback_url: https://www.boc.cn/aboutboc/bi6/\n    login_required: true\n    quality_score: 9\n    last_checked: 2026-06-28T09:00:00Z\n    update_frequency: weekly\n\nsite_patterns:\n  cfcpn.com:\n    list_pages:\n      采购公告: <learned_url>\n      征集公告: <learned_url>\n    pagination: <learned_method>\n    item_selector_hint: <natural_language_description_of_where_items_are>\n  boc.cn:\n    list_page: <learned_url>\n    pagination: <learned_method>\n\nnotified_tenders:\n  - id: <title+date_hash>\n    title: \"...\"\n    date: \"2026-06-28\"\n    source: \"金采网\"\n    notified_at: \"2026-06-28T09:05:00Z\"\n\nuser_preferences:\n  required_keywords: []\n  any_keywords: [\"网络安全\", \"数据治理\", \"IT设备\", \"软件\", \"安全\"]\n  excluded_keywords: [\"家具\", \"绿化\"]\n  notification_format: \"detailed\"\n  max_notifications_per_run: 20\n\nlearning_notes:\n  - site: \"金采网\"\n    note: \"采购公告每天上午更新，建议9点检查\"\n    timestamp: \"2026-06-28\"\n  - site: \"中银智采\"\n    note: \"需要注册才能看到详情，用 boc.cn 公开页替代\"\n    timestamp: \"2026-06-28\"\n```\n\n## 通知格式\n\n发现新招标信息时：\n\n```
📋 金融采购招标监控报告\n\n🔍 监控范围：金采网、中银智采\n📊 本次发现 N 条匹配公告\n\n1. 【采购公告】某某银行2026年网络安全设备采购项目\n   📅 截止日期：2026-07-15\n   📌 来源：金采网\n   🔗 链接：http://...\n   📝 摘要：本项目采购网络安全设备，预算XXX万元...\n   ⭐ 匹配关键词：网络安全\n\n2. 【征集公告】某某银行数据治理咨询服务供应商征集\n   📅 发布日期：2026-06-28\n   📌 来源：中银智采\n   🔗 链接：https://...\n   📝 摘要：面向全社会征集数据治理咨询服务供应商...\n   ⭐ 匹配关键词：数据治理\n\n💡 如需调整监控关键词，请直接告诉我。\n```\n\n如果没有发现新公告：\n\n```
✅ 金融采购招标监控完成\n\n监控范围：金采网、中银智采\n本次未发现新的匹配公告。\n上次检查时间：2026-06-28 09:00\n下次检查时间：2026-06-28 12:00\n\n💡 如需调整关键词或添加新监控网站，请告诉我。\n```\n\n## 错误处理\n\n- 网站打不开：跳过，下次再试，连续 3 次失败标记为不可用并通知用户\n- 中银智采需要登录：改用 boc.cn/aboutboc/bi6/ 公开页面\n- 页面结构变化：重新学习，更新记忆中的 site_patterns\n- 被反爬限制：降低频率，间隔至少 30 秒翻页\n- 通知渠道不可用：将结果存入记忆，下次运行时补发\n\n## 与用户的交互\n\n用户可以随时通过对话调整监控配置：\n- 「帮我关注『数据中心』相关的招标」→ 添加关键词\n- 「不用看结果公告了」→ 调整监控类型\n- 「金采网不用监控了」→ 停用该网站\n- 「每天检查一次就行」→ 调整检查频率\n- 「上次的通知我再发一次」→ 从记忆中查询并重发\n\nAgent 应将这些调整存入记忆的 user_preferences，确保下次运行时生效。",
    "sites": [
      {
        "name": "金采网",
        "url": "http://www.cfcpn.com/",
        "type": "金融采购聚合",
        "login_required": false
      },
      {
        "name": "中银智采",
        "url": "https://ctpch.fmscop.bankofchina.com/",
        "fallback_url": "https://www.boc.cn/aboutboc/bi6/",
        "type": "银行采购",
        "login_required": true
      }
    ],
    "default_keywords": ["IT设备", "软件", "安全", "网络安全", "数据治理", "咨询服务", "云服务", "数据中心"],
    "schedule_hint": "0 9,12,18 * * *"
  }
}
```

### 1.3 README.md

```markdown
# 金融采购招标监控技能 (finproc-tender-monitor)

## 功能

自主监控金采网和中银智采的招标公告，根据用户关键词筛选后定时通知。

## 监控网站

| 网站 | URL | 说明 |
|---|---|---|
| 金采网 | http://www.cfcpn.com/ | 中国金融集中采购网，金融机构采购信息聚合 |
| 中银智采 | https://ctpch.fmscop.bankofchina.com/ | 中国银行采购平台（备用：boc.cn/aboutboc/bi6/）|

## 使用方式

1. 将此技能附加到 OpenClaw 实例
2. 创建定时任务触发执行
3. 通过对话告诉 agent 关注的关键词

## 进化能力

- Agent 自主学习网站结构，无需硬编码选择器
- 网站改版后自动重新学习
- 根据用户反馈调整关键词和监控范围
- 持续发现新的金融采购平台
```

---

## 二、部署步骤

### 2.1 打包技能

```bash
mkdir -p finproc-tender-monitor
# 将上面的 skill.json 和 README.md 放入目录
zip -r finproc-tender-monitor.zip finproc-tender-monitor/
```

### 2.2 上传技能

```bash
TOKEN=$(curl -s -X POST http://<backend>:9001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# 上传技能
curl -s -X POST "http://<backend>:9001/api/v1/skills/import" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@finproc-tender-monitor.zip" | python3 -m json.tool

# 记下返回的 skill ID（后续创建模板需要）
```

### 2.3 创建定时任务配置资源

```bash
curl -s -X POST "http://<backend>:9001/api/v1/openclaw-config/resources" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_type": "scheduled_task",
    "resource_key": "finproc-daily-monitor",
    "name": "金融采购招标每日监控",
    "description": "每天 9:00、12:00、18:00 检查金采网和中银智采的新公告",
    "enabled": true,
    "content": {
      "schemaVersion": 1,
      "kind": "scheduled_task",
      "config": {
        "schedule": "0 9,12,18 * * *",
        "skill": "finproc-tender-monitor",
        "action": "run"
      }
    }
  }' | python3 -m json.tool

# 记下返回的 resource ID
```

### 2.4 创建实例模板（核心步骤）

实例模板 (`agent_variant_template`) 支持嵌入 `skill_ids` 和 `config_plan`。创建实例时选择模板，技能会自动附加。

```bash
curl -s -X POST "http://<backend>:9001/api/v1/admin/agent-variants" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "金融采购招标监控助手",
    "slug": "finproc-tender-monitor",
    "description": "预置金采网和中银智采招标监控技能的 OpenClaw 实例模板。创建实例即自动具备金融采购招标信息监控能力，支持关键词定制和定时通知。",
    "runtime_type": "openclaw",
    "skill_ids": [<上一步的skill_id>],
    "config_plan": {
      "mode": "manual",
      "resources": [
        {
          "resource_id": <scheduled_task_resource_id>,
          "required": true
        }
      ]
    },
    "icon": "briefcase",
    "category": "finance",
    "is_public": true,
    "recommended_cpu": 2.0,
    "recommended_memory": 4,
    "recommended_disk": 20,
    "readme_md": "# 金融采购招标监控助手\n\n此模板创建的实例自带金融采购招标监控技能。\n\n## 功能\n- 自主监控金采网 (cfcpn.com) 招标公告\n- 自主监控中银智采 (中银智采平台) 采购公告\n- 根据用户关键词筛选\n- 定时检查并通知\n\n## 使用\n1. 使用此模板创建实例\n2. 实例启动后，告诉 agent 你关注的关键词\n3. Agent 会按定时任务自动检查并通知\n\n## 关键词定制\n创建实例后直接对话：\n- \"帮我关注网络安全和数据治理相关的招标\"\n- \"多关注IT设备采购\"\n- \"不用看家具类公告\"",
    "status": "draft"
  }' | python3 -m json.tool

# 记下返回的 template ID
```

### 2.5 发布模板

```bash
# 发布模板（使其出现在公开模板列表中）
curl -s -X POST "http://<backend>:9001/api/v1/admin/agent-variants/<template_id>/publish" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### 2.6 验证模板

```bash
# 查看公开模板列表
curl -s "http://<backend>:9001/api/v1/agent-variants" | python3 -m json.tool

# 查看模板详情
curl -s "http://<backend>:9001/api/v1/agent-variants/finproc-tender-monitor" | python3 -m json.tool
```

---

## 三、使用模板创建实例

### 3.1 通过 API 创建

```bash
curl -s -X POST "http://<backend>:9001/api/v1/instances" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "我的招标监控",
    "os_type": "linux",
    "os_version": "ubuntu22",
    "cpu_cores": 2,
    "memory_gb": 4,
    "disk_gb": 20,
    "skill_ids": [<skill_id>],
    "openclaw_config_plan": {
      "mode": "manual",
      "resources": [
        {"resource_id": <scheduled_task_resource_id>, "required": true}
      ]
    }
  }' | python3 -m json.tool
```

### 3.2 通过前端 UI 创建

1. 登录 ClawManager 前端
2. 点击「创建实例」
3. 在模板选择页面选择「金融采购招标监控助手」
4. 配置实例名称和资源规格
5. 点击创建

实例创建后：
- 技能自动通过 `install_skill` 命令安装到实例
- 定时任务通过 `CLAWMANAGER_OPENCLAW_SCHEDULED_TASKS_JSON` 环境变量注入
- Agent 启动后即具备招标监控能力

### 3.3 创建后与 Agent 对话

实例启动后，通过聊天界面告诉 agent 你的关键词：

```
用户：帮我关注「网络安全」「数据治理」「IT设备」相关的招标信息
Agent：好的！我已记录您的关注关键词：网络安全、数据治理、IT设备。
      我会每天 9:00、12:00、18:00 检查金采网和中银智采的招标公告，
      发现匹配的公告会及时通知您。
      现在需要我立即检查一次吗？
```

---

## 四、模板系统工作原理

### 4.1 数据模型

```
AgentVariantTemplate
├── skill_ids: [12]              ← 技能 ID 列表（JSON 数组）
├── config_plan: {               ← OpenClaw 配置计划（JSON）
│     "mode": "manual",
│     "resources": [
│       {"resource_id": 5, "required": true}
│     ]
│   }
├── runtime_type: "openclaw"
├── recommended_cpu: 2.0
├── recommended_memory: 4
└── status: "published"
```

### 4.2 实例创建时的技能注入流程

```
用户选择模板创建实例
        │
        ▼
ResolveForInstance(template_id)
  ├── 提取 skill_ids → [12]
  └── 提取 config_plan → {resources: [...]}
        │
        ▼
CreateInstance(skill_ids=[12], config_plan={...})
  ├── 创建实例记录
  ├── CreateSnapshotForInstance(config_plan) → 生成 CLAWMANAGER_*_SCHEDULED_TASKS_JSON 等环境变量
  └── for each skill_id:
      └── AttachSkillToInstance(instance_id, skill_id)
          ├── 创建 InstanceSkill 记录
          └── 创建 install_skill 命令
                │
                ▼
          Agent 轮询命令
          ├── 下载技能 zip
          ├── 解压到 .openclaw/skills/finproc-tender-monitor/
          ├── 验证 content_md5
          └── 上报技能清单
                │
                ▼
          Agent 读取环境变量中的定时任务
          └── 注册 cron 任务
                │
                ▼
          定时触发 → Agent 执行 prompt 中定义的监控流程
```

### 4.3 关键 API

| 操作 | Method | Path |
|---|---|---|
| 上传技能 | POST | `/api/v1/skills/import` |
| 创建配置资源 | POST | `/api/v1/openclaw-config/resources` |
| 创建实例模板 | POST | `/api/v1/admin/agent-variants` |
| 发布模板 | POST | `/api/v1/admin/agent-variants/:id/publish` |
| 查看公开模板 | GET | `/api/v1/agent-variants` |
| 用模板创建实例 | POST | `/api/v1/instances` (带 skill_ids + config_plan) |

---

## 五、网站信息备忘

### 金采网 (cfcpn.com)

| 属性 | 值 |
|---|---|
| 名称 | 金采网（中国金融集中采购网）|
| URL | http://www.cfcpn.com/ |
| 公告类型 | 采购公告、征集公告、结果公告、更正公告 |
| 登录要求 | 浏览公告列表无需登录 |
| 特点 | 金融机构采购信息聚合平台 |
| 更新频率 | 每日更新 |

### 中银智采

| 属性 | 值 |
|---|---|
| 名称 | 中银智采（中国银行采购平台）|
| URL | https://ctpch.fmscop.bankofchina.com/ |
| 备用 URL | https://www.boc.cn/aboutboc/bi6/ （官网采购公告页，无需登录）|
| 公告类型 | 采购公告、采购结果公示、变更公告 |
| 登录要求 | 平台功能需注册登录；官网公开页面无需登录 |
| 特点 | 中国银行及其下属机构采购项目 |
| 更新频率 | 不定期，通常每周有新公告 |

### Agent 学习策略

Agent 首次访问时需要：
1. 打开首页，观察导航结构和公告入口位置
2. 进入公告列表页，观察列表条目的 HTML 结构
3. 学会翻页方式（页码、加载更多、无限滚动）
4. 记住公告详情页的 URL 模式
5. 将学到的信息存入 memory-core

后续运行直接使用学过的方法，遇到改版再重新学习。
