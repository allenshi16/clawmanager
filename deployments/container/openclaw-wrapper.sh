#!/bin/bash

# 0. Clear proxy env vars — clawmanager-agent sets HTTP_PROXY to egress proxy
# which is unreachable from OpenClaw's fetch() calls
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
export NO_PROXY="10.42.0.0/16,10.43.0.0/16,localhost,127.0.0.1,::1"
export no_proxy="10.42.0.0/16,10.43.0.0/16,localhost,127.0.0.1,::1"

# 1. Determine instance config path from argv or workspace scan
CONFIG=""
for candidate in /workspaces/openclaw/user-*/instance-*/home/.openclaw/openclaw.json; do
  if [ -f "$candidate" ]; then
    CONFIG="$candidate"
    break
  fi
done

# 2. Inject LLM provider config into openclaw.json
# clawmanager-agent generates a minimal config without provider info.
# The backend sends CLAWMANAGER_OPENCLAW_CONFIG_JSON env var with the full
# provider config. We merge it into openclaw.json.
if [ -f "$CONFIG" ] && [ -n "$CLAWMANAGER_OPENCLAW_CONFIG_JSON" ]; then
  python3 -c '
import json, os

config_path = os.popen("echo " + os.environ.get("CONFIG", "")).read().strip()
if not config_path:
    import glob
    files = glob.glob("/workspaces/openclaw/user-*/instance-*/home/.openclaw/openclaw.json")
    if not files:
        raise SystemExit(0)
    config_path = files[0]

with open(config_path) as f:
    config = json.load(f)

override_json = os.environ.get("CLAWMANAGER_OPENCLAW_CONFIG_JSON", "")
if override_json:
    override = json.loads(override_json)
    if "models" in override:
        config["models"] = override["models"]
    if "agents" in override:
        config.setdefault("agents", {}).setdefault("defaults", {})
        if "model" in override.get("agents", {}).get("defaults", {}):
            config["agents"]["defaults"]["model"] = override["agents"]["defaults"]["model"]
        if "models" in override.get("agents", {}).get("defaults", {}):
            config["agents"]["defaults"]["models"] = override["agents"]["defaults"]["models"]

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)
' 2>/dev/null || true
fi

# 3. Also set OPENAI env vars from CLAWMANAGER_LLM_* if present
if [ -n "$CLAWMANAGER_LLM_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
  export OPENAI_API_KEY="$CLAWMANAGER_LLM_API_KEY"
fi
if [ -n "$CLAWMANAGER_LLM_BASE_URL" ] && [ -z "$OPENAI_BASE_URL" ]; then
  export OPENAI_BASE_URL="$CLAWMANAGER_LLM_BASE_URL"
  export OPENAI_API_BASE="$CLAWMANAGER_LLM_BASE_URL"
fi

# 4. Fix OpenAI plugin: enable onStartup so it loads and matches "openai" provider
PLUGIN="/usr/local/lib/node_modules/openclaw/dist/extensions/openai/openclaw.plugin.json"
if [ -f "$PLUGIN" ]; then
  python3 -c '
import json
p = "/usr/local/lib/node_modules/openclaw/dist/extensions/openai/openclaw.plugin.json"
with open(p) as f: d = json.load(f)
d.setdefault("activation", {})["onStartup"] = True
for x in ["openai-completions", "auto"]:
    if x not in d.get("providers", []): d.setdefault("providers", []).append(x)
with open(p, "w") as f: json.dump(d, f)
' 2>/dev/null || true
fi

# 5. Patch prepareProviderRuntimeAuth: add config fallback
# OpenAI plugin doesn't implement prepareRuntimeAuth, so auth is null.
# This fallback reads baseUrl/apiKey from the openclaw.json config.
RUNTIME_JS="/usr/local/lib/node_modules/openclaw/dist/provider-runtime-D2wRmWvE.js"
if [ -f "$RUNTIME_JS" ] && ! grep -q "pc.baseUrl" "$RUNTIME_JS" 2>/dev/null; then
  python3 -c '
import sys
fp = "/usr/local/lib/node_modules/openclaw/dist/provider-runtime-D2wRmWvE.js"
with open(fp) as f: c = f.read()
old = "async function prepareProviderRuntimeAuth(params) {\n\treturn await resolveProviderRuntimePlugin(params)?.prepareRuntimeAuth?.(params.context);\n}"
if old not in c:
    idx = c.find("async function prepareProviderRuntimeAuth")
    if idx < 0: sys.exit(0)
    depth = 0
    end = idx
    for i in range(idx, len(c)):
        if c[i] == "{": depth += 1
        elif c[i] == "}":
            depth -= 1
            if depth == 0: end = i; break
    old = c[idx:end+1]
new = "async function prepareProviderRuntimeAuth(params) {\n\tconst plugin = resolveProviderRuntimePlugin(params);\n\tlet result = null;\n\ttry { result = await plugin?.prepareRuntimeAuth?.(params.context); } catch(e) {}\n\tif (!result && params.config?.models?.providers) {\n\t\tconst pc = params.config.models.providers[params.provider];\n\t\tif (pc) result = { baseUrl: pc.baseUrl, apiKey: pc.apiKey };\n\t}\n\treturn result;\n}"
c = c.replace(old, new, 1)
with open(fp, "w") as f: f.write(c)
' 2>/dev/null || true
fi

# 6. Install SKILL.md for finproc-tender-monitor
# clawmanager-agent doesn't implement install_skill command, so we write
# the SKILL.md directly. The content is embedded here.
for ws in /workspaces/openclaw/user-*/instance-*/home/.openclaw; do
  SKILL_DIR="$ws/skills/finproc-tender-monitor"
  if [ ! -f "$SKILL_DIR/SKILL.md" ]; then
    mkdir -p "$SKILL_DIR"
    cat > "$SKILL_DIR/SKILL.md" << 'SKILLMDEOF'
---
name: finproc-tender-monitor
description: Use when the user asks to monitor, check, or search for tender/bidding announcements on financial procurement websites (金采网 cfcpn.com, 中银智采 boc.cn). Also use when the user mentions 招标, 采购公告, 投标, or wants to track bidding opportunities at Chinese banks and financial institutions.
user-invocable: true
---

# 金融采购招标信息监控

你是专业的金融采购招标信息监控助手。负责监控以下金融采购平台的招标公告，根据用户关键词筛选后通知用户。

## 监控目标网站

### 金采网（中国金融集中采购网）
- 入口页：http://www.cfcpn.com/
- 公告类型：采购公告、征集公告、结果公告、更正公告
- 特点：金融机构采购信息聚合平台，无需登录即可浏览公告列表
- 操作方法：在首页找到「采购公告」「征集公告」等栏目入口，点击进入列表页

### 中银智采（中国银行采购平台）
- 入口页：https://ctpch.fmscop.bankofchina.com/
- 备用入口：https://www.boc.cn/aboutboc/bi6/（中国银行官网采购公告页，无需登录）
- 公告类型：采购公告、采购结果公示、变更公告
- 注意：如果无法登录中银智采平台，改用 boc.cn/aboutboc/bi6/ 公开页面

## 工作流程

### 首次运行
1. 向用户确认关注的关键词（如：IT设备、软件、安全、咨询服务等）
2. 用浏览器打开金采网首页，观察页面结构，找到公告列表入口
3. 用浏览器打开中银智采或 boc.cn 采购公告页，观察页面结构
4. 将网站操作方法存入记忆

### 日常监控
1. 从记忆加载已知网站操作方法和已通知公告记录
2. 逐个打开网站公告列表页，翻页查看最近 2-3 页
3. 对每条公告，判断标题是否匹配用户关键词
4. 对匹配的公告，打开详情页获取摘要信息
5. 与记忆中的已通知列表比对，找出新公告
6. 提取标题、日期、来源、链接、摘要，格式化后通知用户
7. 更新记忆中的已通知列表

### 持续进化
1. 每周搜索新的金融采购平台
2. 网站改版时重新学习结构
3. 根据用户反馈调整关键词
4. 记录每个网站的更新频率，优化检查策略

## 关键词处理

- 用户通过对话提供关键词：「帮我关注网络安全和数据治理相关的招标」
- 支持必含/或含/排除关键词
- 默认关注所有采购公告
- 将关键词调整存入记忆，下次运行时生效

## 通知格式

```
📋 金融采购招标监控报告

🔍 监控范围：金采网、中银智采
📊 本次发现 N 条匹配公告

1. 【采购公告】标题
   📅 日期
   📌 来源
   🔗 链接
   📝 摘要
   ⭐ 匹配关键词
```

如果没有新公告：
```
✅ 金融采购招标监控完成
本次未发现新的匹配公告。
```

## 记忆结构

在记忆中维护：
- discovered_sites: 已发现的招标网站（url, name, login_required, quality_score）
- site_patterns: 每个网站的操作方法（列表页URL、翻页方式）
- notified_tenders: 已通知的公告记录（id, title, date, source）
- user_preferences: 用户关键词偏好（required_keywords, any_keywords, excluded_keywords）
- learning_notes: 学习笔记

## 错误处理

- 网站打不开：跳过，连续3次失败标记不可用并通知用户
- 中银智采需登录：改用 boc.cn/aboutboc/bi6/ 公开页面
- 页面改版：重新学习结构，更新记忆
- 被反爬限制：降低频率，间隔至少30秒翻页
- 通知渠道不可用：将结果存入记忆，下次运行时补发

## 用户交互

用户可以随时调整配置：
- 「帮我关注数据中心相关的招标」→ 添加关键词
- 「不用看结果公告了」→ 调整监控类型
- 「金采网不用监控了」→ 停用该网站
- 「每天检查一次就行」→ 调整检查频率
- 「上次的通知再发一次」→ 从记忆查询并重发

## 默认关键词

IT设备、软件、安全、网络安全、数据治理、咨询服务、云服务、数据中心
SKILLMDEOF
    # Fix ownership to match the workspace owner
    OWNER_UID=$(stat -c %u "$ws" 2>/dev/null)
    if [ -n "$OWNER_UID" ]; then
      chown -R "$OWNER_UID" "$SKILL_DIR" 2>/dev/null
    fi
  fi
done

# 7. Start OpenClaw
exec node /usr/local/lib/node_modules/openclaw/openclaw.mjs "$@"
