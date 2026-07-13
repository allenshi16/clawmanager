# OpenClaw 自主进化技能开发指南：以招标信息监控为例

> **核心理念**: 不写死爬虫代码，而是给 AI agent 一套"工作指南"，让 agent 用自身的 LLM 推理 + 浏览器自动化 + 记忆系统，自主发现网站、学习爬取策略、持续进化。

---

## 一、两种技能范式对比

| 维度 | 硬编码技能（错误做法） | Agent 自主技能（正确做法） |
|---|---|---|
| **网站发现** | 在代码里写死 URL 列表 | Agent 自主搜索发现新招标网站 |
| **页面解析** | 写死 CSS 选择器 | Agent 用 LLM 理解页面结构，动态提取信息 |
| **登录方式** | 写死登录流程 | Agent 观察登录页面，自主完成登录 |
| **策略进化** | 改代码 → 重新打包 → 重新部署 | Agent 每次运行后更新记忆，下次更聪明 |
| **新网站适配** | 人工添加代码 | Agent 自动学习新网站的结构 |
| **技能核心** | Python 源码 | **Prompt（自然语言指令）+ 记忆持久化** |

---

## 二、OpenClaw Agent 的原生能力

OpenClaw 实例启动后自带 6 个插件（从启动日志可见）：

```
http server listening (6 plugins: browser, device-pair, file-transfer, memory-core, phone-control, talk-voice)
```

| 插件 | 能力 | 招标监控用途 |
|---|---|---|
| **browser** | 浏览器自动化（Playwright 内核，监听 `127.0.0.1:20002`） | 打开招标网站、搜索、翻页、登录、截图 |
| **memory-core** | 跨会话记忆持久化 | 记住已发现的网站、已通知的招标、学到的页面结构 |
| **talk-voice** | 对话交互 | 与用户对话，接收反馈，调整监控策略 |
| **file-transfer** | 文件读写 | 存储中间数据、导出报告 |

**关键**: Agent 有 LLM 访问能力（通过我们修复的 AI Gateway），可以：
- **理解网页内容** — 不需要 CSS 选择器，LLM 直接"读懂"页面
- **推理决策** — "这个网站需要先登录" / "这个页面是列表页" / "这条是新的招标公告"
- **自主规划** — "我先搜索'招标公告'，找到几个网站，然后逐个检查"
- **自然语言提取** — 从 HTML 中提取结构化信息，不需要正则或选择器

---

## 三、技能设计

### 3.1 核心思路

```
用户给 agent 一个"岗位描述"（prompt）
        │
        ▼
┌─────────────────────────┐
│   OpenClaw Agent (LLM)   │
│                          │
│  1. 搜索发现招标网站      │ ← browser 插件 + LLM 推理
│  2. 学习网站结构          │ ← LLM 理解页面，存入 memory-core
│  3. 检查新公告            │ ← browser 打开页面，LLM 提取信息
│  4. 与历史比对            │ ← memory-core 存储已通知记录
│  5. 发送通知              │ ← channel 配置
│  6. 记录经验              │ ← memory-core 更新，下次更聪明
│                          │
│  cron 定时触发 ↑          │
└─────────────────────────┘
```

### 3.2 skill.json — Prompt 驱动的技能

```json
{
  "schemaVersion": 1,
  "kind": "skill",
  "format": "skill/custom@v1",
  "name": "tender-monitor",
  "version": "1.0.0",
  "description": "自主招标信息监控技能——agent 自主发现网站、学习结构、持续监控",
  "dependsOn": [],
  "config": {
    "prompt": "你是一个专业的招标信息监控助手。你的职责是持续监控各类招标投标公告网站，发现新的招标信息后通知用户。\n\n## 工作流程\n\n### 阶段一：网站发现（首次运行）\n1. 使用浏览器搜索「招标公告」「采购公告」「bid notice」「tender announcement」等关键词\n2. 识别出信息量大的招标网站（如中国招标投标公共服务平台、各省政府采购网、中国采购与招标网等）\n3. 将发现的网站信息（URL、名称、更新频率、是否需要登录）存入记忆\n\n### 阶段二：网站学习（每个新网站）\n1. 用浏览器打开网站\n2. 观察页面结构，找到招标公告列表的位置\n3. 学习如何翻页、如何按时间筛选\n4. 如果需要登录，观察登录入口和表单结构\n5. 将学到的网站操作方法存入记忆，下次直接使用\n\n### 阶段三：日常监控（每次运行）\n1. 从记忆中加载所有已知招标网站\n2. 逐个打开网站，查看最新公告列表\n3. 与记忆中的「已通知公告」列表比对\n4. 提取新公告的标题、日期、链接、摘要\n5. 将新公告通知用户\n6. 更新「已通知公告」列表\n\n### 阶段四：持续进化\n1. 定期搜索是否有新的招标网站出现\n2. 如果某个网站改版了，重新学习其结构\n3. 根据用户反馈调整监控范围（用户说"这个网站不用看了"就停止监控）\n4. 记录每个网站的信息质量评分，优先检查高质量来源\n\n## 记忆结构\n\n在记忆中维护以下信息：\n- `discovered_sites`: 已发现的招标网站列表，每个包含 url、name、login_required、quality_score\n- `site_patterns`: 每个网站的操作方法（列表页URL、翻页方式、登录流程）\n- `notified_tenders`: 已通知的招标公告ID列表（用标题+日期哈希）\n- `user_preferences`: 用户的偏好（关注的关键词、排除的类别、通知频率）\n- `learning_notes`: 学习笔记（哪个网站改版了、哪个网站信息质量高）\n\n## 通知格式\n\n发现新招标信息时，按以下格式通知用户：\n\n📋 发现 N 条新招标信息\n\n1. 【标题】\n   日期：YYYY-MM-DD\n   来源：网站名称\n   链接：URL\n   摘要：一句话摘要\n\n2. ...\n\n## 注意事项\n\n- 每次运行先检查记忆，避免重复通知\n- 如果网站需要登录且没有凭据，通知用户并提供登录入口\n- 不要爬取非公开页面\n- 优先关注用户指定关键词相关的招标信息\n- 如果连续多次某个网站没有新信息，降低检查频率\n- 每次运行后更新记忆，让下一次运行更高效",
    "schedule_hint": "0 9 * * *",
    "initial_keywords": ["招标公告", "采购公告", "bid notice", "tender", "政府采购"],
    "notification_channel": "default"
  }
}
```

> **关键区别**: 这里没有一行 Python 代码。`config.prompt` 是自然语言指令，告诉 agent "你的工作是什么、怎么做、怎么进化"。Agent 用 LLM 理解这些指令，并用 browser 插件执行。

### 3.3 为什么这样能"进化"

| 运行次数 | Agent 行为 |
|---|---|
| **第 1 次** | 搜索关键词，发现 5 个招标网站，学习每个网站的结构，存入 memory-core |
| **第 2 次** | 直接打开已知的 5 个网站（不用再搜索），快速检查新公告，发现 3 条新招标 |
| **第 5 次** | 记忆中已有 8 个网站（运行 3 时又发现 3 个），知道哪些网站更新频率高、优先检查 |
| **第 10 次** | 某个网站改版了，agent 发现旧方法不work，重新学习新结构，更新记忆 |
| **第 20 次** | 用户说"多关注医疗器械招标"，agent 调整关键词权重，优先检查医疗器械相关公告 |
| **第 N 次** | Agent 已经是一个经验丰富的"招标信息专家" |

**进化机制：**
1. **memory-core 持久化** — 记忆跨会话保留，不会每次从零开始
2. **LLM 自适应** — 遇到新网站结构不需要改代码，LLM 直接理解
3. **经验积累** — 记录每个网站的质量评分、更新频率、操作方法
4. **用户反馈闭环** — 用户可以通过对话告诉 agent 调整策略

---

## 四、部署方式

### 4.1 打包技能

```
tender-monitor/
  skill.json              ← 上面的 JSON（核心是 prompt）
  README.md               ← 简要说明
```

注意：**没有 src/ 目录，没有 Python 代码**。技能的核心就是 prompt。

```bash
zip -r tender-monitor.zip tender-monitor/
```

### 4.2 上传

```bash
# API 方式
curl -X POST "http://<backend>:9001/api/v1/skills/import" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@tender-monitor.zip"

# 或前端 UI：管理 → 技能管理 → 导入技能
```

### 4.3 创建定时任务

```bash
curl -X POST "http://<backend>:9001/api/v1/openclaw-config/resources" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_type": "scheduled_task",
    "resource_key": "tender-monitor-cron",
    "name": "招标监控定时任务",
    "enabled": true,
    "content": {
      "schemaVersion": 1,
      "kind": "scheduled_task",
      "config": {
        "schedule": "0 9,12,18 * * *",
        "skill": "tender-monitor",
        "action": "run"
      }
    }
  }'
```

> **注意**: 定时任务的 content 格式取决于 OpenClaw 运行时的解析逻辑。
> 在 pod 内检查 cron 配置格式：
> ```bash
> kubectl exec <pod> -- cat /workspaces/openclaw/user-1/instance-4/home/.openclaw/cron/jobs.json
> ```

### 4.4 创建通知渠道

```bash
curl -X POST "http://<backend>:9001/api/v1/openclaw-config/resources" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_type": "channel",
    "resource_key": "tender-notify",
    "name": "招标通知渠道",
    "enabled": true,
    "content": {
      "schemaVersion": 1,
      "kind": "channel",
      "format": "channel/feishu@v1",
      "config": {
        "webhook_url": "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"
      }
    }
  }'
```

### 4.5 打包为 Bundle

把技能 + 定时任务 + 通知渠道组合到一个 Bundle，创建实例时一键部署。

### 4.6 附加到已有实例

```bash
curl -X POST "http://<backend>:9001/api/v1/instances/4/skills" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"skill_id": <skill_id>}'
```

---

## 五、Agent 如何使用这些能力

### 5.1 浏览器自动化

OpenClaw 的 browser 插件监听在 `127.0.0.1:20002`，agent 可以：

```
Agent LLM 推理:
  "我需要打开中国招标投标公共服务平台"
  → 调用 browser 插件: navigate("http://www.cebpubservice.com/")
  → browser 返回页面内容
  → LLM 理解: "这是首页，我看到有'招标公告'入口"
  → 调用 browser: click("招标公告"链接)
  → browser 返回列表页
  → LLM 理解: "这是公告列表，每条有标题、日期、链接"
  → LLM 提取结构化信息
```

**不需要写 CSS 选择器** — LLM 直接"看懂"页面内容。

### 5.2 记忆持久化

```
运行 1:
  Agent 发现 5 个网站 → 存入 memory-core
  Agent 学会网站 A 的操作方法 → 存入 memory-core

运行 2:
  Agent 启动 → 从 memory-core 加载已知网站和操作方法
  Agent 直接用学过的方法打开网站 A → 快速检查
  Agent 发现网站 B 改版了 → 重新学习 → 更新 memory-core
```

### 5.3 自主搜索新网站

```
Agent LLM 推理:
  "我已经知道 8 个招标网站了，但可能还有新的"
  → 调用 browser: 搜索 "2026 新招标公告平台"
  → 浏览搜索结果
  → 发现一个新网站 "某某招标网"
  → 打开网站，学习结构
  → 存入 memory-core
  → 下次运行时自动检查这个新网站
```

### 5.4 用户交互进化

用户可以直接和 agent 对话：

```
用户: "帮我多关注一下医疗器械方面的招标"
Agent: "好的，我会把'医疗器械'加入重点关键词，优先检查相关公告"
      → 更新 memory-core 中的 user_preferences

用户: "某某招标网不用看了，信息太旧"
Agent: "好的，我已将该网站标记为停用"
      → 更新 memory-core 中的 discovered_sites
```

---

## 六、Prompt 工程建议

### 6.1 Prompt 要"教方法"而非"给答案"

```json
// ❌ 错误：给死规则
"config": {
  "prompt": "打开 http://example.com，点击 .btn-search，提取 .result-item 的文本"
}

// ✅ 正确：教方法论
"config": {
  "prompt": "你的任务是发现和监控招标网站。对于每个新网站：先观察页面结构，找到公告列表的位置，学会翻页和筛选。将学到的方法存入记忆，下次直接使用。如果网站改版，重新学习。"
}
```

### 6.2 定义记忆结构

在 prompt 中明确定义 agent 应该在记忆中维护什么：

```
## 记忆结构
- discovered_sites: [{url, name, login_required, quality_score, last_checked}]
- site_patterns: {site_url: {list_page_url, pagination_method, login_flow}}
- notified_tenders: [{id, title, date, source}]
- user_preferences: {keywords, excluded_categories, notification_frequency}
- learning_notes: [{site, note, timestamp}]
```

### 6.3 定义进化机制

```
## 持续进化
1. 每 10 次运行搜索一次新网站
2. 每次网站操作失败时重新学习结构
3. 根据用户反馈调整策略
4. 记录信息质量评分，优化检查优先级
```

### 6.4 定义错误处理

```
## 错误处理
- 网站打不开：跳过，下次再试，连续 3 次失败则标记为不可用
- 需要登录但没有凭据：通知用户，跳过该网站
- 页面结构变化：重新学习，更新记忆
- 被反爬：降低频率，更换 User-Agent
```

---

## 七、与硬编码技能的混合策略

对于某些**稳定且高频**的网站，可以混合使用：

| 网站 | 方式 | 原因 |
|---|---|---|
| 中国招标投标公共服务平台 | Agent 自主 | 结构稳定但可能改版，LLM 自适应 |
| 某省政府采购网 | Agent 自主 | 每个省格式不同，LLM 自动适配 |
| 企业自建招标系统 | Agent 自主 + 提示 | 需要 login，agent 自主学习登录流程 |
| 已知 API 接口的网站 | 可选：代码辅助 | 如果网站提供 API，agent 可以直接调用 |

在 prompt 中可以这样指导：

```
## 优化策略
- 如果某个网站提供了 API 接口（在页面底部或 robots.txt 中发现），优先使用 API
- 对于更新非常频繁的网站（每小时更新），可以增加检查频率
- 对于月度更新的网站，降低检查频率
```

---

## 八、验证与调试

### 8.1 观察 Agent 的推理过程

通过 OpenClaw 的 WebSocket 聊天界面，可以看到 agent 的完整推理和操作过程：

```
用户: 检查一下今天的招标信息

Agent: 好的，我来检查已知的招标网站。
  [browser] 打开 http://www.cebpubservice.com/
  [browser] 点击"招标公告"
  [browser] 获取列表页内容
  
  我发现 3 条新招标公告：
  1. 【某某医院医疗设备采购招标】日期：2026-06-28
  2. 【某某学校信息化建设招标】日期：2026-06-28  
  3. 【某某道路工程招标】日期：2026-06-27
  
  已存入记忆，下次不会重复通知。
  是否需要我通过飞书通知您？
```

### 8.2 检查记忆内容

```bash
# 在 pod 内检查 agent 的记忆/状态文件
kubectl exec <pod> -- ls -la /workspaces/openclaw/user-1/instance-4/home/.openclaw/
# 查找 memory 或 state 相关文件
```

### 8.3 手动触发技能

通过 WebSocket 发送聊天消息让 agent 执行技能：

```javascript
// 通过 WebSocket 发送
send('chat.send', {
  sessionKey: 'tender-check-' + uuid(),
  idempotencyKey: uuid(),
  message: '检查所有已知招标网站的最新公告'
});
```

### 8.4 检查 cron 任务

```bash
kubectl exec <pod> -- cat /workspaces/openclaw/user-1/instance-4/home/.openclaw/cron/jobs.json
```

---

## 九、进阶：多技能协作

可以创建多个相关技能，让 agent 在不同场景下使用：

| 技能 | 职责 | 触发方式 |
|---|---|---|
| `tender-discovery` | 搜索和发现新招标网站 | 每周一次 |
| `tender-monitor` | 日常检查所有已知网站 | 每天 3 次 |
| `tender-analyzer` | 分析招标信息，判断是否值得参与 | 发现新招标时 |
| `tender-reporter` | 生成周报/月报 | 每周/每月 |

这些技能可以共享 memory-core 中的记忆，形成协作。

---

## 十、总结

```
传统方式:                        Agent 自主方式:
                                  
Python 爬虫代码                    skill.json (prompt 指令)
  ↓                                ↓
写死 URL + 选择器                  Agent 用 LLM 理解指令
  ↓                                ↓
网站改版 → 改代码 → 重新部署        网站改版 → Agent 自动重新学习
  ↓                                ↓
新增网站 → 改代码 → 重新部署        新增网站 → Agent 自主发现
  ↓                                ↓
固定行为，不进化                    每次运行都在进化
```

**核心原则：不要替 Agent 写代码，而是给 Agent 写"岗位说明书"。**
