# alispeak Android 壳

把一个纯 Canvas + 原生 JS 的网页，套成可以装进手机的点开即用的 App。
网页本体一行没重写，改的都是「浏览器里有、WebView 里没有」的那部分能力：
剪贴板、相册、分享。

APK 大小约 146 KB，minSdk 29（Android 10），targetSdk 30。

## 目录

```
app/src/main/
├── AndroidManifest.xml
├── assets/app/                  ← 构建时从仓库根目录同步过来，不入库
├── java/com/ukvanguard/alispeak/
│   ├── MainActivity.java        WebView 初始化
│   ├── AssetWebViewClient.java  把虚拟域名映射到 assets/app/
│   ├── NativeBridge.java        注入的 window.NativeBridge（复制/保存/分享）
│   └── ShareProvider.java       只读 ContentProvider，给剪贴板和分享提供 content:// 地址
└── res/                         主题、图标、应用名
build.sh                         一键构建
tools/fix_asset_names.py         构建后修补 assets 条目名（见下面第 1 个坑）
```

## 构建

```bash
cd android
./build.sh            # 产物：alispeak.apk
```

不需要 Gradle，也不需要联网：直接调用 SDK 里的 `aapt2 compile/link` → `javac` →
`d8` → `aapt add` → `zipalign` → `apksigner`。JDK 8 即可。
脚本会把仓库根目录的 `DrawLine.js`、`drawline.html` 和三张 jpg 同步进
`app/src/main/assets/app/`，所以网页改完直接重新跑一次就是最新的；
想从别处取网页源码用 `WEB_SRC=/path/to/web ./build.sh`。

依赖的 SDK 组件：`build-tools/30.0.3`、`platforms/android-30`。
`debug.keystore` 是自动生成的，第一次签名后会一直复用；想换签名删掉它即可。

## 为什么要走 `https://appassets.androidplatform.net`

页面不是用 `file:///android_asset/` 打开的，而是请求一个假域名，再由
`AssetWebViewClient.shouldInterceptRequest()` 从 assets 里读出来直接返回。原因：

- `file://` 下画布会被判定为 tainted，`toDataURL()` 直接抛 `SecurityError`，导出就废了；
- 走 https 假域名属于安全上下文，图片同源，导出和后续任何 Web API 都正常；
- 不用开 `setAllowFileAccess`、`setAllowUniversalAccessFromFileURLs` 这些开关。

`shouldInterceptRequest` 之外还必须在清单里声明 `INTERNET` 权限，否则请求连拦截
都到不了，直接 `net::ERR_ACCESS_DENIED`。

## 网页侧约定

`DrawLine.js` 里所有原生能力都是「有桥走桥，没桥走浏览器」：

```js
window.NativeBridge.copyPng(dataURL)   // 成功返回 ""，失败返回给用户看的原因
window.NativeBridge.savePng(dataURL)
window.NativeBridge.sharePng(dataURL)
```

桥不存在时（浏览器里打开），复制走 Web Clipboard，保存走 `<a download>`，
分享按钮因为 `typeof bridge.sharePng !== 'function'` 而保持隐藏。
所以同一份网页既能跑在浏览器，也能跑在壳里，不需要分叉。

- **复制**：图片先写到 `cache/share/alispeak-share.png`，再用 `ClipData.newUri`
  放进剪贴板。微信、QQ 读的是这个 content URI，不需要任何存储权限。
- **保存**：走 MediaStore，落到 `Pictures/alispeak/alispeak-yyyyMMdd-HHmmss.png`。
  Android 10 起写自己创建的媒体项不需要权限，所以清单里除了 `INTERNET` 一个权限都没有。
- **分享**：`ACTION_SEND` + `EXTRA_STREAM`，`ClipData` 上也挂一份授权（部分 ROM
  只认 ClipData），文件同样由 `ShareProvider` 提供。

## 踩过的坑

1. **Windows 版 `aapt2 link -A` 会把 assets 条目名写成 `assets/app\drawline.html`。**
   zip 能正常解开，但 Android 的 AssetManager 只按 `/` 查表，于是运行时
   `getAssets().list("app")` 返回空数组、`open()` 抛 `FileNotFoundException`，
   页面一片白。`tools/fix_asset_names.py` 在打包后做等长替换（`\` → `/`），
   不移动数据、不影响 zipalign 的偏移，构建流程里已经接好。
2. **中文文件名打不进 assets。** aapt2 在 Windows 上遇到 `我.jpg` 会报
   `failed to open file`。构建脚本把它们改名成 `left.jpg` / `body.jpg` / `cap.jpg`，
   网页那边按候选名依次尝试，仓库里保留原名也能跑。
3. **`shouldInterceptRequest` 找不到资源时必须返回 404 响应，不能返回 `null`。**
   返回 `null` 等于「我不管，你去联网吧」，于是真的去请求这个假域名，
   报 `net::ERR_HTTP_RESPONSE_CODE_FAILURE` / `ERR_NAME_NOT_RESOLVED`，很难看出是本地问题。
4. **WebView 的字体和桌面不一样。** 桌面用 SimHei，手机上会回退到系统黑体
   （Noto Sans CJK），同一个 43px 的度量略有差异，气泡宽度是按 `measureText`
   实时算的，所以只会跟着变，不会溢出。

## 换素材 / 换名字

头像、气泡图、名字都写在 `DrawLine.js` 顶部的常量里；换 App 名字改
`res/values/strings.xml` 的 `app_name`，换包名要同时改
`AndroidManifest.xml` 的 `package` 和 `ShareProvider` 的 `authorities`
（`NativeBridge` 里的 URI 是用 `getPackageName()` 拼的，不用动）。
