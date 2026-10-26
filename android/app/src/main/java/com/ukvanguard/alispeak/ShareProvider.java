package com.ukvanguard.alispeak;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * 只读文件提供者，作用等同于 androidx 的 FileProvider：
 * 把 cache/share/ 下的图片暴露成 content:// 地址，
 * 剪贴板和 ACTION_SEND 都靠它把图片交给别的 App，不需要存储权限。
 */
public class ShareProvider extends ContentProvider {

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (getContext() == null) {
            throw new FileNotFoundException("没有上下文");
        }
        String path = uri.getPath();
        if (path == null || path.length() <= 1) {
            throw new FileNotFoundException("路径为空");
        }
        // "/share/alispeak-share.png" -> cacheDir/share/alispeak-share.png
        File file = new File(getContext().getCacheDir(), path.substring(1));
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        return "image/png";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection,
                        String[] selectionArgs, String sortOrder) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
