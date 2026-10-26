package com.ukvanguard.alispeak;

import android.content.Context;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * 把 appassets.androidplatform.net 上的请求映射到 assets/app/。
 * 相当于自己实现了一个轻量版 WebViewAssetLoader，好处是不依赖 androidx。
 */
public class AssetWebViewClient extends WebViewClient {

    static final String HOST = "appassets.androidplatform.net";

    private final Context context;

    AssetWebViewClient(Context context) {
        this.context = context;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (uri == null || !HOST.equals(uri.getHost())) {
            return null;
        }
        // Uri.getPath() 已经做过百分号解码，中文文件名到这里是原文
        String path = uri.getPath();
        if (path == null || path.length() <= 1) {
            return notFound();
        }
        String assetPath = path.substring(1);
        try {
            InputStream stream = context.getAssets().open(assetPath);
            return new WebResourceResponse(mimeTypeOf(assetPath), "UTF-8", stream);
        } catch (IOException e) {
            Log.e("alispeak", "asset open failed: " + assetPath, e);
            return notFound();
        }
    }

    /** 返回 404 而不是 null：null 会让 WebView 真的去网上找这个假域名。 */
    private static WebResourceResponse notFound() {
        WebResourceResponse response = new WebResourceResponse(
                "text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
        response.setStatusCodeAndReasonPhrase(404, "Not Found");
        return response;
    }

    private static String mimeTypeOf(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html")) {
            return "text/html";
        }
        if (lower.endsWith(".js")) {
            return "application/javascript";
        }
        if (lower.endsWith(".css")) {
            return "text/css";
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".webp")) {
            return "image/webp";
        }
        if (lower.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (lower.endsWith(".woff2")) {
            return "font/woff2";
        }
        if (lower.endsWith(".woff")) {
            return "font/woff";
        }
        return "application/octet-stream";
    }
}
