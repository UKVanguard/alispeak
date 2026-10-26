package com.ukvanguard.alispeak;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 注入给网页的 window.NativeBridge。
 *
 * 约定：方法返回空字符串表示成功，返回非空字符串是给用户看的失败原因。
 * 所有方法都跑在 WebView 的 JavaBridge 线程，所以只做文件/系统服务调用，
 * 需要弹 UI 的动作（Toast、startActivity）都 post 回主线程。
 */
public class NativeBridge {

    private static final String CLIP_LABEL = "alispeak";

    private final Context context;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    NativeBridge(Context context) {
        this.context = context;
    }

    /** 写入系统剪贴板。URI 走自家 ContentProvider，读方拿到的是一次性授权。 */
    @JavascriptInterface
    public String copyPng(String dataUrl) {
        try {
            Uri uri = writeToCache(decodePng(dataUrl));
            ClipData clip = ClipData.newUri(context.getContentResolver(), CLIP_LABEL, uri);
            ClipboardManager manager =
                    (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
            if (manager == null) {
                return "系统剪贴板不可用";
            }
            manager.setPrimaryClip(clip);
            toast("已复制到剪贴板");
            return "";
        } catch (Exception e) {
            return describe(e);
        }
    }

    /** 存进相册 Pictures/alispeak。Android 10 起走 MediaStore，不需要任何权限。 */
    @JavascriptInterface
    public String savePng(String dataUrl) {
        try {
            byte[] bytes = decodePng(dataUrl);
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, buildFileName());
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            values.put(MediaStore.Images.Media.RELATIVE_PATH,
                    Environment.DIRECTORY_PICTURES + "/alispeak");
            values.put(MediaStore.Images.Media.IS_PENDING, 1);

            Uri uri = context.getContentResolver()
                    .insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                return "无法写入相册";
            }
            OutputStream out = context.getContentResolver().openOutputStream(uri);
            if (out == null) {
                return "无法打开相册文件";
            }
            try {
                out.write(bytes);
                out.flush();
            } finally {
                out.close();
            }

            ContentValues done = new ContentValues();
            done.put(MediaStore.Images.Media.IS_PENDING, 0);
            context.getContentResolver().update(uri, done, null, null);

            toast("已保存到相册");
            return "";
        } catch (Exception e) {
            return describe(e);
        }
    }

    /** 调起系统分享面板，微信/QQ/钉钉都能直接收到。 */
    @JavascriptInterface
    public String sharePng(String dataUrl) {
        final Uri uri;
        try {
            uri = writeToCache(decodePng(dataUrl));
        } catch (Exception e) {
            return describe(e);
        }

        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("image/png");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                // 部分 ROM / 接收方只认 ClipData 上的授权，而且 clip 自己也要带
                // MIME，所以用 newUri（会问 provider 要类型）而不是 newRawUri
                send.setClipData(ClipData.newUri(context.getContentResolver(), "alispeak", uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(send, "分享表情包");
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                if (context instanceof Activity) {
                    ((Activity) context).startActivity(chooser);
                }
            }
        });
        return "";
    }

    /* ---------------- 内部工具 ---------------- */

    private static byte[] decodePng(String dataUrl) {
        if (dataUrl == null) {
            throw new IllegalArgumentException("图片数据为空");
        }
        int comma = dataUrl.indexOf(',');
        String base64 = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
        return Base64.decode(base64, Base64.DEFAULT);
    }

    /**
     * 写到 cache/share/，返回 provider 地址。
     * 每次用不重名的文件：接收方（QQ 之类）可能过一会儿才去读，
     * 复用一个固定文件名的话，连着分享两张图会读到后一张。
     */
    private Uri writeToCache(byte[] bytes) throws IOException {
        File dir = new File(context.getCacheDir(), "share");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("无法创建缓存目录");
        }
        String name = "alispeak-" + new SimpleDateFormat("yyyyMMdd-HHmmss-SSS", Locale.US)
                .format(new Date()) + ".png";
        File file = new File(dir, name);
        FileOutputStream out = new FileOutputStream(file);
        try {
            out.write(bytes);
            out.flush();
        } finally {
            out.close();
        }
        pruneOldShares(dir);
        return Uri.parse("content://" + context.getPackageName() + ".files/share/" + name);
    }

    /** 清掉一天前的分享缓存，避免 cache 越堆越多。 */
    private static void pruneOldShares(File dir) {
        File[] files = dir.listFiles();
        if (files == null) {
            return;
        }
        long deadline = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
        for (File file : files) {
            if (file.isFile() && file.lastModified() < deadline) {
                // 删不掉也无所谓，下次再试
                //noinspection ResultOfMethodCallIgnored
                file.delete();
            }
        }
    }

    private static String buildFileName() {
        String stamp = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(new Date());
        return "alispeak-" + stamp + ".png";
    }

    private void toast(final String message) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private static String describe(Exception e) {
        String message = e.getMessage();
        if (message == null || message.trim().isEmpty()) {
            message = e.getClass().getSimpleName();
        }
        return message;
    }
}
