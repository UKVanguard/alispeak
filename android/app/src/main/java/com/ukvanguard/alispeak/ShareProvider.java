package com.ukvanguard.alispeak;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * 只读文件提供者，作用等同于 androidx 的 FileProvider：
 * 把 cache/share/ 下的图片暴露成 content:// 地址，
 * 剪贴板和 ACTION_SEND 都靠它把图片交给别的 App，不需要存储权限。
 *
 * 除了 openFile，还必须实现 query：接收方（QQ 这类）会先查
 * OpenableColumns.DISPLAY_NAME / SIZE 建缩略图，查不到就直接放弃，
 * 表现成「发出去是一条空消息」。
 */
public class ShareProvider extends ContentProvider {

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(resolve(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        return "image/png";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection,
                        String[] selectionArgs, String sortOrder) {
        if (projection == null) {
            projection = new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        }
        MatrixCursor cursor = new MatrixCursor(projection, 1);
        MatrixCursor.RowBuilder row = cursor.newRow();
        File file;
        try {
            file = resolve(uri);
        } catch (FileNotFoundException e) {
            return cursor;
        }
        for (String column : projection) {
            if (OpenableColumns.DISPLAY_NAME.equals(column)) {
                row.add(file.getName());
            } else if (OpenableColumns.SIZE.equals(column)) {
                row.add(file.length());
            } else {
                row.add(null);
            }
        }
        return cursor;
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

    /** 只允许读 cache/ 里面的文件，挡掉 ../ 这类越界路径。 */
    private File resolve(Uri uri) throws FileNotFoundException {
        if (getContext() == null) {
            throw new FileNotFoundException("没有上下文");
        }
        String path = uri.getPath();
        if (path == null || path.length() <= 1) {
            throw new FileNotFoundException("路径为空");
        }
        File cache = getContext().getCacheDir();
        // "/share/alispeak-share.png" -> cacheDir/share/alispeak-share.png
        File file = new File(cache, path.substring(1));
        try {
            String root = cache.getCanonicalPath() + File.separator;
            if (!file.getCanonicalPath().startsWith(root)) {
                throw new FileNotFoundException("越界路径");
            }
        } catch (java.io.IOException e) {
            throw new FileNotFoundException("无法解析路径");
        }
        if (!file.isFile()) {
            throw new FileNotFoundException("文件不存在：" + file.getName());
        }
        return file;
    }
}
