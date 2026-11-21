#!/usr/bin/env bash
# Apply the Tavern left-page seam (3.4.0) to a Tavern install and rebuild its client bundle.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAVERN_DIR="${TAVERN_DIR:-/home/crux/.dsh-tavern/apps/dsh-tavern}"
PATCH="${PATCH:-$HERE/0002-tavern-left-page-seam-3.4.0.patch}"
BACKUP_ROOT="${BACKUP_ROOT:-$HERE/backups}"
FILES=(
  tavern-plugin/src/client/features/sidebar.js
  tavern-plugin/src/client/main.js
  tavern-plugin/lib/client-assets/tavern.css
  tavern-plugin/lib/client.js
)

fail() { echo "错误：$*" >&2; exit 1; }
[ -d "$TAVERN_DIR" ] || fail "找不到 Tavern 目录：$TAVERN_DIR（可用 TAVERN_DIR=... 指定）"
[ -f "$PATCH" ] || fail "找不到补丁：$PATCH"
cd "$TAVERN_DIR"

VERSION="$(node -p "require('./tavern-plugin/package.json').version" 2>/dev/null || true)"
[ -n "$VERSION" ] || fail "无法读取 tavern-plugin/package.json 版本"
if grep -q "createTavernLeftPageSeam" tavern-plugin/src/client/features/sidebar.js 2>/dev/null; then
  echo "已经打过接缝补丁（Tavern $VERSION），无需重复应用。"
  exit 0
fi
if [ "$VERSION" != "3.4.0" ] && [ "${FORCE:-0}" != "1" ]; then
  fail "该补丁基线是 Tavern 3.4.0，当前是 $VERSION；确认可用 FORCE=1 强制尝试。"
fi

BACKUP="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"
for file in "${FILES[@]}"; do
  [ -f "$file" ] || fail "缺少文件：$file"
  mkdir -p "$BACKUP/$(dirname "$file")"
  cp -p "$file" "$BACKUP/$file"
done
echo "已备份到 $BACKUP"

git apply --check "$PATCH"
git apply "$PATCH"
echo "补丁已应用，正在重建 Tavern 客户端 bundle…"
node bin/build-tavern-client.mjs
grep -q "createTavernLeftPageSeam" tavern-plugin/src/client/features/sidebar.js || fail "源码校验失败"
node bin/build-tavern-client.mjs --check
echo "完成：Tavern $VERSION 已带左栏接缝。请重启 Tavern/DSH 后再刷新页面。"
echo "回滚：git apply -R "$PATCH" && node bin/build-tavern-client.mjs"
