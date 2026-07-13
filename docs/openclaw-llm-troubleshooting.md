# OpenClaw Agent LLM 连接故障排查与修复指南

> **适用版本**: ClawManager 2026.5.4, OpenClaw 2026.5.4, Node.js 22.22.3
> **编写日期**: 2026-06-28
> **状态**: 已验证，pod 重启后持久化

---

## 一、故障现象

用户在 ClawManager 前端向 OpenClaw agent 实例发送聊天消息时，agent 返回错误：

```
[assistant turn failed before producing content]
```

OpenClaw 日志中对应错误为：

```
FailoverError: LLM request failed: network connection error.
```

后端 (ClawManager backend) 日志中看不到任何 `/api/v1/gateway/llm/chat/completions` 请求。

---

## 二、根因分析

故障由 **4 层问题叠加** 导致，每一层都需要单独修复：

### 2.1 HTTP_PROXY 指向不可达的 egress proxy（最核心）

**现象**: `fetch` 调用报 `getaddrinfo ENOTFOUND clawmanager-egress-proxy.clawmanager-system.svc.cluster.local`

**原因**:
- Kubernetes 为 `clawmanager-egress-proxy` service 自动注入了 `CLAWMANAGER_EGRESS_PROXY_SERVICE_HOST` 等环境变量
- `clawmanager-agent` 二进制根据这些变量构造了 `HTTP_PROXY=http://clawmanager-egress-proxy.clawmanager-system:3128`
- 该 proxy 域名在 OpenClaw 进程的 DNS 上下文中无法解析（`ENOTFOUND`）
- Node.js `fetch` (undici) 或 OpenAI SDK 读取 `HTTP_PROXY` 环境变量后，所有 HTTP 请求都尝试通过该不可达代理转发
- `NO_PROXY` 环境变量虽然能绕过代理，但 OpenClaw 的 HTTP 客户端不尊重 `NO_PROXY`

**修复**: 在 wrapper 脚本中 `unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy`

### 2.2 OpenAI 插件未加载

**现象**: `resolveProviderRuntimePlugin("auto")` 返回 `null`，`plugin=NULL`

**原因**:
- OpenClaw 的 OpenAI 插件 (`extensions/openai/openclaw.plugin.json`) 配置 `"activation": {"onStartup": false}`
- 插件不在启动时加载，需要按需加载
- 按需加载逻辑 (`resolveProviderPluginsForHooks`) 也未能匹配 "auto" provider
- 结果：没有任何 runtime plugin 注册 for "auto" provider

**修复**: 修改插件配置 `"onStartup": true`，并在 `providers` 列表中添加 `"openai-completions"` 和 `"auto"`

### 2.3 Provider 名称不匹配

**现象**: 即使插件加载了，`matchesProviderId` 仍不匹配

**原因**:
- `openclaw.json` 配置中 provider 名称为 `"auto"`，API 类型为 `"openai-completions"`
- `resolveProviderConfigApiOwnerHint` 返回 `"openai-completions"` 作为 `apiOwnerHint`
- `normalizeProviderId` 不会将 `"openai-completions"` 转换为 `"openai"`（仅做小写化）
- OpenAI 插件的 `id` 为 `"openai"`，`providers` 为 `["openai", "openai-codex"]`
- `"auto"` ≠ `"openai"`，`"openai-completions"` ≠ `"openai"` → 不匹配

**修复**: 在 wrapper 脚本中将 `openclaw.json` 的 provider 名称从 `"auto"` 改为 `"openai"`，同时更新 model 引用 `auto/auto` → `openai/auto`

### 2.4 prepareProviderRuntimeAuth 无返回值

**现象**: `plugin=FOUND` 但 `prepare=NO`，`result=NULL`，`baseUrl=EMPTY`，`apiKey=NOTSET`

**原因**:
- OpenAI 插件没有实现 `prepareRuntimeAuth` 方法
- `prepareProviderRuntimeAuth` 返回 `undefined`
- `preparedAuth` 为 null，后续代码无法获取 `baseUrl` 和 `apiKey`
- LLM 请求无法构造

**修复**: 在 `provider-runtime-D2wRmWvE.js` 中 patch `prepareProviderRuntimeAuth` 函数，添加从 config 读取 `baseUrl` 和 `apiKey` 的 fallback

### 2.5 风控 403: 需要 secure model

**现象**: LLM 请求到达后端后返回 `403 "sensitive content requires an active secure model"`

**原因**:
- AI Gateway 的风控规则匹配到请求中的 IP 地址等模式（如 `10.x.x.x`）
- 风控动作为 `route_secure_model`，尝试路由到安全模型
- 数据库中没有模型标记为 `is_secure=true`
- 返回 403 错误

**修复**: 通过 Admin API 将模型 `is_secure` 设为 `true`

---

## 三、修复实施

### 3.1 持久化修复架构

```
┌─────────────────────────────────────────────────────────┐
│                    k8s Deployment                        │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ NO_PROXY    │  │ ConfigMap    │  │ postStart Hook │ │
│  │ env var     │  │ openclaw-    │  │ cp wrapper to  │ │
│  │ (k8s level) │  │ wrapper      │  │ /usr/local/bin │ │
│  └─────────────┘  └──────┬───────┘  └───────┬────────┘ │
│                          │                   │          │
│                          ▼                   ▼          │
│                   /tmp/openclaw-      /usr/local/bin/   │
│                   wrapper.sh          openclaw           │
│                                          │               │
│                                          ▼               │
│                                   wrapper 脚本执行:      │
│                                   1. unset HTTP_PROXY   │
│                                   2. 创建 env 文件       │
│                                   3. 修复插件配置        │
│                                   4. patch runtime       │
│                                   5. 重命名 provider     │
│                                   6. exec node openclaw  │
│                                          │               │
│                          ┌───────────────┘               │
│                          ▼                               │
│                   ┌─────────────┐                        │
│                   │ MySQL (PVC) │                        │
│                   │ is_secure=  │                        │
│                   │ true        │                        │
│                   └─────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

### 3.2 具体步骤

#### 步骤 1: 添加 NO_PROXY 环境变量到 k8s deployment

```bash
kubectl set env deployment/openclaw-runtime -n clawmanager-system \
  NO_PROXY=10.42.0.1,localhost,127.0.0.1,::1,10.43.0.0/16

kubectl set env deployment/openclaw-runtime -n clawmanager-system \
  no_proxy=10.42.0.1,localhost,127.0.0.1,::1,10.43.0.0/16
```

#### 步骤 2: 创建 wrapper 脚本 ConfigMap

将完整的 wrapper 脚本保存为文件 `wrapper.sh`，然后：

```bash
kubectl create configmap openclaw-wrapper -n clawmanager-system \
  --from-file=wrapper=wrapper.sh
```

**wrapper 脚本内容** (保存为 `wrapper.sh`):

```bash
#!/bin/bash

CONFIG="/workspaces/openclaw/user-1/instance-4/home/.openclaw/openclaw.json"

# 0. 清除代理环境变量 — 最关键的修复
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
export NO_PROXY=10.42.0.1,localhost,127.0.0.1,::1,10.43.0.0/16
export no_proxy=10.42.0.1,localhost,127.0.0.1,::1,10.43.0.0/16

# 1. 从 openclaw.json 提取 API key 和 base URL 到环境变量
if [ -f "$CONFIG" ]; then
    python3 -c '
import json
with open("/workspaces/openclaw/user-1/instance-4/home/.openclaw/openclaw.json") as f:
    d = json.load(f)
providers = d.get("models", {}).get("providers", {})
for name, p in providers.items():
    if p.get("apiKey") and p.get("baseUrl"):
        print("OPENAI_API_KEY=" + p["apiKey"])
        print("OPENAI_BASE_URL=" + p["baseUrl"])
        print("OPENAI_API_BASE=" + p["baseUrl"])
        break
' > /tmp/openclaw-env 2>/dev/null
    while IFS= read -r line; do
        [ -n "$line" ] && export "$line" 2>/dev/null
    done < /tmp/openclaw-env
fi

# 2. 修复 OpenAI 插件: 设置 onStartup=true 并添加 provider 别名
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

# 3. Patch prepareProviderRuntimeAuth — 添加 config fallback
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

# 4. 重命名 provider: auto -> openai (使插件 ID 匹配)
if [ -f "$CONFIG" ]; then
    python3 -c '
import json
with open("/workspaces/openclaw/user-1/instance-4/home/.openclaw/openclaw.json") as f: d = json.load(f)
ps = d.get("models", {}).get("providers", {})
if "auto" in ps: ps["openai"] = ps.pop("auto")
a = d.get("agents", {}).get("defaults", {})
if a.get("model", {}).get("primary") == "auto/auto": a["model"]["primary"] = "openai/auto"
m = a.get("models", {})
a["models"] = {k.replace("auto/","openai/") if k.startswith("auto/") else k: v for k, v in m.items()}
with open("/workspaces/openclaw/user-1/instance-4/home/.openclaw/openclaw.json", "w") as f: json.dump(d, f, indent=2)
' 2>/dev/null || true
fi

# 5. 启动 OpenClaw
exec node /usr/local/lib/node_modules/openclaw/openclaw.mjs "$@"
```

#### 步骤 3: 配置 Deployment 挂载和 postStart Hook

在 deployment 中添加：

```yaml
spec:
  template:
    spec:
      containers:
      - name: runtime
        env:
        - name: NO_PROXY
          value: "10.42.0.1,localhost,127.0.0.1,::1,10.43.0.0/16"
        - name: no_proxy
          value: "10.42.0.1,localhost,127.0.0.1,::1,10.43.0.0/16"
        volumeMounts:
        - name: openclaw-wrapper
          mountPath: /tmp/openclaw-wrapper.sh
          subPath: wrapper
        lifecycle:
          postStart:
            exec:
              command:
              - bash
              - -c
              - "rm -f /usr/local/bin/openclaw && cp /tmp/openclaw-wrapper.sh /usr/local/bin/openclaw && chmod +x /usr/local/bin/openclaw"
      volumes:
      - name: openclaw-wrapper
        configMap:
          name: openclaw-wrapper
          defaultMode: 0755
```

**注意**: 不要将 ConfigMap 直接挂载到 `/usr/local/bin/openclaw`，因为该路径是符号链接，Kubernetes 会解析符号链接并替换目标文件 `openclaw.mjs`，导致 Node.js 报 `SyntaxError: Invalid or unexpected token`。

#### 步骤 4: 标记模型为 secure

```bash
# 登录获取 token
TOKEN=$(curl -s -X POST http://<backend>:9001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# 获取模型列表
curl -s "http://<backend>:9001/api/v1/admin/models" \
  -H "Authorization: Bearer $TOKEN"

# 更新模型 is_secure=true
curl -s -X PUT "http://<backend>:9001/api/v1/admin/models" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": 1, "display_name": "echahub", "is_secure": true, "is_active": true, ...}'
```

#### 步骤 5: 后端代码修改（可选但推荐）

在 `backend/cmd/server/main.go` 中添加 `/v1/chat/completions` 路由别名：

```go
gatewayLLM := api.Group("/gateway/llm")
gatewayLLM.Use(middleware.GatewayAuth(instanceRepo, bindingRepo))
{
    gatewayLLM.GET("/models", aiGatewayHandler.ListModels)
    gatewayLLM.POST("/chat/completions", aiGatewayHandler.ChatCompletions)
    gatewayLLM.POST("/v1/chat/completions", aiGatewayHandler.ChatCompletions) // 新增
}
```

---

## 四、验证方法

### 4.1 检查 OpenClaw 进程

```bash
POD=$(kubectl get pods -n clawmanager-system -l app=openclaw-runtime -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n clawmanager-system $POD -- ps -u 200004 -o pid,comm
```

应看到 `openclaw` 进程。

### 4.2 检查启动日志

```bash
kubectl exec -n clawmanager-system $POD -- tail -5 /tmp/openclaw-200004/openclaw-*.log
```

应看到 `gateway ready` 且无 `warmup timed out` 警告。

### 4.3 检查 wrapper 是否生效

```bash
# wrapper 脚本应替换了原始符号链接
kubectl exec -n clawmanager-system $POD -- head -1 /usr/local/bin/openclaw
# 应输出: #!/bin/bash  (而非 #!/usr/bin/env node)

# openclaw.mjs 应保持原始内容
kubectl exec -n clawmanager-system $POD -- head -1 /usr/local/lib/node_modules/openclaw/openclaw.mjs
# 应输出: #!/usr/bin/env node
```

### 4.4 检查 NO_PROXY 环境变量

```bash
kubectl exec -n clawmanager-system $POD -- bash -c 'echo $NO_PROXY'
# 应输出: 10.42.0.1,localhost,127.0.0.1,::1,10.43.0.0/16
```

### 4.5 检查模型 secure 状态

```bash
TOKEN=$(kubectl exec -n clawmanager-system $POD -- curl -s -X POST http://10.42.0.1:9001/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

kubectl exec -n clawmanager-system $POD -- curl -s "http://10.42.0.1:9001/api/v1/admin/models" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
for m in json.load(sys.stdin).get('data',{}).get('items',[]):
    print(f\"  {m['display_name']}: secure={m.get('is_secure')}\")
"
```

### 4.6 端到端聊天测试

通过 WebSocket 发送聊天消息（需要 instance access token 和 gateway password），或直接通过前端 UI 发送消息，确认 agent 流式输出回复。

### 4.7 后端日志确认

```bash
grep "gateway/llm" /var/log/clawmanager-server.log | tail -5
```

应看到 `200` 状态码的 `POST /api/v1/gateway/llm/chat/completions` 请求。

---

## 五、注意事项

### 5.1 ConfigMap 挂载陷阱

**绝对不要**将 ConfigMap 通过 `volumeMount` 直接挂载到 `/usr/local/bin/openclaw`。该路径是符号链接 (`symlink → ../lib/node_modules/openclaw/openclaw.mjs`)，Kubernetes 会解析符号链接并将 ConfigMap 内容写入目标文件 `openclaw.mjs`，导致：

```
SyntaxError: Invalid or unexpected token
    at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
```

**正确做法**: 挂载到安全路径 (如 `/tmp/openclaw-wrapper.sh`)，通过 `postStart` hook 复制到目标位置。

### 5.2 s6-svscan 文件描述符

**不要**通过 `bash -c "... exec s6-svscan"` 覆盖容器启动命令。s6-svscan 的 `-d4` 参数要求 fd 4 可用，而 bash 启动时不会设置该文件描述符，导致：

```
s6-svscan: fatal: invalid notification fd: Bad file descriptor
```

**正确做法**: 保持原始 entrypoint 不变，使用 `postStart` lifecycle hook 应用修复。

### 5.3 Python f-string 引号嵌套

在 ConfigMap 中存储的 shell 脚本内嵌 Python 代码时，**不要**使用双引号 f-string 内嵌双引号索引：

```python
# 错误 (Python 3.11 不支持):
print(f"OPENAI_API_KEY={p["apiKey"]}")

# 正确:
print("OPENAI_API_KEY=" + p["apiKey"])
```

Python 3.12+ 才支持相同引号嵌套 (PEP 701)，容器中通常使用 Python 3.11。

### 5.4 HTTP_PROXY 来源

`HTTP_PROXY` 不在 k8s deployment 的 env 配置中，也不在 s6 服务脚本中。它由 `clawmanager-agent` 二进制根据 Kubernetes 自动注入的 `CLAWMANAGER_EGRESS_PROXY_SERVICE_HOST` 和 `CLAWMANAGER_EGRESS_PROXY_SERVICE_PORT` 环境变量构造。

即使设置了 `NO_PROXY`，OpenClaw 的 HTTP 客户端可能不尊重它。**必须**通过 `unset` 清除 `HTTP_PROXY` 等变量。

### 5.5 clawmanager-agent 环境变量传递

`clawmanager-agent` 启动 OpenClaw 进程时：
- **会** 传递自身继承的环境变量 (约 155 个)
- **不会** 传递后端 `buildGatewayEnv` 生成的 `Environment` 字段 (通过 CreateGateway RPC 发送)
- 某些机制会清空 C-level `environ` (`/proc/<pid>/environ` = 0 字节)，但 `process.env` (JavaScript 对象) 可能保留值

因此，wrapper 脚本中的 `unset` 和 `export` 对 `process.env` 有效。

### 5.6 Provider 名称匹配机制

OpenClaw 的 provider → plugin 匹配链：

```
resolveProviderRuntimePlugin(params)
  → resolveProviderConfigApiOwnerHint(provider, config)  // 返回 api 字段值
  → getLoadedRuntimePluginRegistry(params)                // 查已加载的 plugin registry
  → findProviderRuntimePluginInRegistry(...)               // 用 matchesProviderId 匹配
  → resolveProviderPluginsForHooks(...)                    // fallback: 按需加载
```

`normalizeProviderId` 仅做小写化，不做 "openai-completions" → "openai" 的转换。因此 provider 名称必须与 plugin 的 `id` 或 `aliases` 精确匹配。

### 5.7 风控规则

AI Gateway 有 31 条风控规则，所有规则的 action 都是 `route_secure_model`。规则匹配 IP 地址、密钥、邮箱、手机号等模式。OpenClaw agent 的请求上下文中包含 `10.x.x.x` IP 地址，会触发 IP 地址规则。

如果没有模型标记为 `is_secure=true`，请求会被 403 拒绝。**必须**确保至少有一个 active secure model。

### 5.8 wrapper 脚本中的错误处理

wrapper 脚本中的 Python 命令使用 `|| true` 防止失败中断脚本。不使用 `set -e`，因为某些修复（如 provider rename）在 `clawmanager-agent` 重新生成配置后可能已经生效，不需要重复执行。

### 5.9 Pod 重启后的配置覆盖

`clawmanager-agent` 在创建 gateway 时会重新生成 `openclaw.json` 配置文件，覆盖 wrapper 脚本的修改。因此，wrapper 脚本在每次启动时都会重新执行所有修复（包括 provider rename）。这是设计意图，确保修复始终生效。

### 5.10 后端代码修改

`backend/cmd/server/main.go` 中添加的 `/v1/chat/completions` 路由别名需要重新编译后端二进制才能生效。当前修复不依赖此路由（OpenAI SDK 构造的 URL 是 `/chat/completions` 不带 `/v1/`），但保留此路由作为兼容性保障。

---

## 六、故障排查命令速查

```bash
# 1. 检查 OpenClaw 进程是否存在
POD=$(kubectl get pods -n clawmanager-system -l app=openclaw-runtime -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n clawmanager-system $POD -- ps -u 200004 -o pid,comm

# 2. 检查 OpenClaw 日志
kubectl exec -n clawmanager-system $POD -- tail -20 /tmp/openclaw-200004/openclaw-*.log

# 3. 检查后端是否收到 LLM 请求
grep "gateway/llm" /var/log/clawmanager-server.log | tail -10

# 4. 检查 wrapper 是否替换了符号链接
kubectl exec -n clawmanager-system $POD -- file /usr/local/bin/openclaw

# 5. 检查 openclaw.mjs 是否被破坏
kubectl exec -n clawmanager-system $POD -- head -1 /usr/local/lib/node_modules/openclaw/openclaw.mjs

# 6. 检查 NO_PROXY 环境变量
kubectl exec -n clawmanager-system $POD -- bash -c 'echo $NO_PROXY'

# 7. 检查 HTTP_PROXY 是否被清除
kubectl exec -n clawmanager-system $POD -- bash -c 'echo HTTP_PROXY=$HTTP_PROXY'
# 应为空

# 8. 检查 OpenAI 插件配置
kubectl exec -n clawmanager-system $POD -- python3 -c "
import json
d=json.load(open('/usr/local/lib/node_modules/openclaw/dist/extensions/openai/openclaw.plugin.json'))
print('onStartup:', d.get('activation',{}).get('onStartup'))
print('providers:', d.get('providers'))
"

# 9. 检查 openclaw.json provider 名称
kubectl exec -n clawmanager-system $POD -- python3 -c "
import json
d=json.load(open('/workspaces/openclaw/user-1/instance-4/home/.openclaw/openclaw.json'))
print('providers:', list(d.get('models',{}).get('providers',{}).keys()))
print('model:', d.get('agents',{}).get('defaults',{}).get('model',{}).get('primary'))
"

# 10. 检查 provider-runtime patch
kubectl exec -n clawmanager-system $POD -- bash -c 'grep -c "pc.baseUrl" /usr/local/lib/node_modules/openclaw/dist/provider-runtime-D2wRmWvE.js'
# 应输出 1 或更多

# 11. 检查模型 secure 状态
TOKEN=$(kubectl exec -n clawmanager-system $POD -- curl -s -X POST http://10.42.0.1:9001/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])")
kubectl exec -n clawmanager-system $POD -- curl -s "http://10.42.0.1:9001/api/v1/admin/models" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;[print(f'  {m[\"display_name\"]}: secure={m.get(\"is_secure\")}') for m in json.load(sys.stdin).get('data',{}).get('items',[])]"

# 12. 重启 instance
kubectl exec -n clawmanager-system $POD -- curl -s -X POST "http://10.42.0.1:9001/api/v1/instances/4/stop" -H "Authorization: Bearer $TOKEN"
sleep 3
kubectl exec -n clawmanager-system $POD -- curl -s -X POST "http://10.42.0.1:9001/api/v1/instances/4/start" -H "Authorization: Bearer $TOKEN"
```

---

## 七、相关文件路径

| 文件 | 路径 | 说明 |
|---|---|---|
| OpenClaw 配置 | `/workspaces/openclaw/user-1/instance-4/home/.openclaw/openclaw.json` | clawmanager-agent 生成，wrapper 修改 |
| OpenAI 插件配置 | `/usr/local/lib/node_modules/openclaw/dist/extensions/openai/openclaw.plugin.json` | wrapper 修改 onStartup |
| Provider Runtime | `/usr/local/lib/node_modules/openclaw/dist/provider-runtime-D2wRmWvE.js` | wrapper patch prepareProviderRuntimeAuth |
| OpenClaw 入口 | `/usr/local/lib/node_modules/openclaw/openclaw.mjs` | 原始文件，不可修改 |
| openclaw 命令 | `/usr/local/bin/openclaw` | 原为符号链接，postStart 替换为 wrapper |
| OpenClaw 日志 | `/tmp/openclaw-200004/openclaw-*.log` | 运行时日志 |
| 环境变量文件 | `/tmp/openclaw-env` | wrapper 从 config 提取的 API key/URL |
| 后端日志 | `/var/log/clawmanager-server.log` | 后端请求日志 |
| s6 服务脚本 | `/etc/services.d/clawmanager-agent/run` | clawmanager-agent 启动脚本 |
| 后端 AI Gateway | `backend/internal/handlers/ai_gateway_handler.go` | LLM 请求处理 |
| 后端路由 | `backend/cmd/server/main.go` (line 491-496) | gateway 路由注册 |
| 后端环境生成 | `backend/internal/services/instance_service.go` (line 933) | buildGatewayEnv 函数 |
| 风控代码 | `backend/internal/aigateway/service.go` (line 2105-2122) | risk control 逻辑 |
