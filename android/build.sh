#!/usr/bin/env bash
# alispeak Android 壳的构建脚本。
# 不依赖 Gradle，直接调用 Android SDK 的命令行工具，因此 JDK 8 也能跑。
#
# 用法： ./build.sh
# 产物： ./alispeak.apk
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# git-bash 里 pwd 给的是 /c/... 形式，Windows 版 javac 读 @argfile 时会解析错，
# 统一转成 C:/... 形式；非 Windows 环境 cygpath 不存在，保持原样。
if command -v cygpath >/dev/null 2>&1; then
  ROOT="$(cygpath -m "$ROOT")"
fi
APP="$ROOT/app/src/main"
BUILD="$ROOT/build"
OUT_APK="$ROOT/alispeak.apk"

# 网页源码的位置（这个目录的上一层就是仓库根目录）
WEB_SRC="${WEB_SRC:-$ROOT/..}"

# ---- 定位 SDK ----
if [ -z "${ANDROID_HOME:-}" ]; then
  if [ -n "${LOCALAPPDATA:-}" ]; then
    ANDROID_HOME="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")/Android/Sdk"
  fi
fi
SDK="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
BT="$SDK/build-tools/30.0.3"
PLATFORM="$SDK/platforms/android-30/android.jar"

if [ ! -d "$BT" ] || [ ! -f "$PLATFORM" ]; then
  echo "找不到 Android SDK，请设置 ANDROID_HOME（需要 build-tools 30.0.3 与 platforms/android-30）" >&2
  exit 1
fi
if [ ! -d "$WEB_SRC" ]; then
  echo "找不到网页源码目录：$WEB_SRC（可用 WEB_SRC=... 指定）" >&2
  exit 1
fi
JAVA_BIN="${JAVA_HOME:-}"; JAVA_BIN="${JAVA_BIN:+$JAVA_BIN/bin/}"
JAVAC="${JAVA_BIN}javac"; JAVA="${JAVA_BIN}java"; KEYTOOL="${JAVA_BIN}keytool"
# 只用来跑 tools/fix_asset_names.py，系统里有 python / python3 都行
PYTHON="${PYTHON:-python}"

echo "==> 1/6 同步网页资源"
rm -rf "$APP/assets/app"
mkdir -p "$APP/assets/app"
cp "$WEB_SRC/DrawLine.js" "$WEB_SRC/drawline.html" "$APP/assets/app/"
# aapt2 在 Windows 上打不开中文文件名，这里改成 ASCII，网页端会按候选名自动回退
cp "$WEB_SRC/我.jpg" "$APP/assets/app/left.jpg"
cp "$WEB_SRC/超.jpg" "$APP/assets/app/body.jpg"
cp "$WEB_SRC/盒1.jpg" "$APP/assets/app/cap.jpg"

echo "==> 2/6 编译资源"
rm -rf "$BUILD"; mkdir -p "$BUILD/classes" "$BUILD/dex"
"$BT/aapt2.exe" compile --dir "$APP/res" -o "$BUILD/res.zip"
"$BT/aapt2.exe" link \
  -o "$BUILD/base.apk" \
  -I "$PLATFORM" \
  --manifest "$APP/AndroidManifest.xml" \
  -A "$APP/assets" \
  --java "$BUILD/gen" \
  --min-sdk-version 29 \
  --target-sdk-version 30 \
  --version-code 1 \
  --version-name 1.0 \
  "$BUILD/res.zip"

echo "==> 3/6 编译 Java"
find "$APP/java" "$BUILD/gen" -name "*.java" > "$BUILD/sources.txt"
"$JAVAC" -encoding UTF-8 -source 1.8 -target 1.8 -nowarn \
  -bootclasspath "$PLATFORM" -d "$BUILD/classes" @"$BUILD/sources.txt"

echo "==> 4/6 生成 dex"
find "$BUILD/classes" -name "*.class" > "$BUILD/classlist.txt"
"$JAVA" -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 \
  --lib "$PLATFORM" --min-api 29 --output "$BUILD/dex" @"$BUILD/classlist.txt"

echo "==> 5/6 打包"
cp "$BUILD/base.apk" "$BUILD/unsigned.apk"
(cd "$BUILD/dex" && "$BT/aapt.exe" add "$BUILD/unsigned.apk" classes.dex > /dev/null)
# Windows 版 aapt2 会把 assets 条目名写成 "assets/app\\xxx"，AssetManager 只认 "/"，
# 必须等长替换回来，否则运行期 assets 目录看起来是空的。
"$PYTHON" "$ROOT/tools/fix_asset_names.py" "$BUILD/unsigned.apk"
"$BT/zipalign.exe" -f 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"

echo "==> 6/6 签名"
KEYSTORE="$ROOT/debug.keystore"
if [ ! -f "$KEYSTORE" ]; then
  "$KEYTOOL" -genkeypair -keystore "$KEYSTORE" -storepass android -keypass android \
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=alispeak,O=Android,C=US" > /dev/null 2>&1
fi
"$JAVA" -jar "$BT/lib/apksigner.jar" sign \
  --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android \
  --out "$OUT_APK" "$BUILD/aligned.apk"

echo
echo "完成：$OUT_APK"
ls -lh "$OUT_APK"
