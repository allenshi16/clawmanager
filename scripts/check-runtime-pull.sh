#!/bin/bash
# 监控 runtime 镜像拉取进度 (openclaw-lite + hermes-lite)
# 用法: bash ~/project/clawmanager/scripts/check-runtime-pull.sh

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         Runtime 镜像拉取进度监控                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "=== k3s containerd 中缓存的层数 ==="
echo "  openclaw-lite (目标: ~30 个 layer, ~5.4GB):"
OPENCLAW_LAYERS=$(k3s ctr content list 2>/dev/null | grep -c openclaw-lite || echo 0)
echo "    当前已缓存: ${OPENCLAW_LAYERS:-0} 个 layer"
echo ""
echo "  hermes-lite  (目标: ??? 个 layer, ~4GB):"
HERMES_LAYERS=$(k3s ctr content list 2>/dev/null | grep -c hermes-lite || echo 0)
echo "    当前已缓存: ${HERMES_LAYERS:-0} 个 layer"
echo ""

echo "=== 各 Runtime Pod 状态 ==="
kubectl -n clawmanager-system get pods -l "app in (openclaw-runtime, hermes-runtime)" -o wide 2>&1 || echo "  (无 runtime pod)"
echo ""

echo "=== 最近 5 个事件 ==="
kubectl -n clawmanager-system get events --sort-by='.lastTimestamp' 2>&1 | grep -iE "runtime|Pull|pulled" | tail -5
echo ""

echo "=== 全部 Pods ==="
kubectl -n clawmanager-system get pods 2>&1
echo ""

echo "=== 镜像是否 ready? ==="
for IMG in "ghcr.io/yuan-lab-llm/agentsruntime/openclaw-lite:latest" "ghcr.io/yuan-lab-llm/agentsruntime/hermes-lite:latest"; do
  if k3s ctr images list --quiet 2>/dev/null | grep -qF "$IMG"; then
    echo "  ✓ $IMG 已就绪"
  else
    echo "  ✗ $IMG 还在拉取中"
  fi
done
echo ""
echo "=== 提示 ==="
echo "  如果网络较慢，可以在另一个更快网络环境下:"
echo "    docker pull <镜像>"
echo "    docker save <镜像> | ssh root@allen-pc 'k3s ctr images import -'"
echo ""
echo "  监控命令:"
echo "    watch -n 10 bash ~/project/clawmanager/scripts/check-runtime-pull.sh"
