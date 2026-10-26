package com.ukvanguard.alispeak;

import android.app.Activity;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;

/**
 * 极简 WebView 壳。
 *
 * 页面不是用 file:// 打开的，而是走 https://appassets.androidplatform.net/app/…
 * 这样一个假域名。好处有三个：
 *   1. 图片同源，画布不会被污染，toDataURL / toDataBlob 正常工作；
 *   2. 属于安全上下文，未来就算想用 Web Clipboard 也有机会；
 *   3. 不需要 openFile 之类的危险开关。
 * 请求由 AssetWebViewClient 从 assets/app/ 里读出来直接返回，不走网络。
 */
public class MainActivity extends Activity {

    private static final String START_URL = "https://appassets.androidplatform.net/app/drawline.html";
    private static final boolean DEBUG_WEBVIEW = true;   // 想用 chrome://inspect 调试时保持 true

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setTextZoom(100);
        // 页面只加载自家 assets，把这两个后门关掉
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        webView.setWebViewClient(new AssetWebViewClient(this));
        webView.addJavascriptInterface(new NativeBridge(this), "NativeBridge");

        WebView.setWebContentsDebuggingEnabled(DEBUG_WEBVIEW);

        webView.loadUrl(START_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
