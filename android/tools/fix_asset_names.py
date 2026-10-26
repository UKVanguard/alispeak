#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 APK 里 zip 条目名中的反斜杠改成正斜杠。

Windows 版 aapt2 link -A 在写 assets 条目时用的是系统路径分隔符，
产物里会出现 "assets/app\\drawline.html" 这样的名字；Android 的
AssetManager 只按 "/" 查表，于是就出现「assets 里明明有文件，运行时
list("app") 却是空的」。这里做等长替换（一个字符换一个字符），
不会移动任何数据、不影响 zipalign 的偏移，也不需要重新压缩。
"""
from __future__ import print_function

import struct
import sys

EOCD_SIG = b"PK\x05\x06"
CD_SIG = b"PK\x01\x02"
LOCAL_SIG = b"PK\x03\x04"


def fix_names(path):
    with open(path, "rb") as fh:
        blob = bytearray(fh.read())

    eocd = blob.rfind(EOCD_SIG)
    if eocd < 0:
        raise SystemExit("EOCD not found: %s" % path)
    cd_offset = struct.unpack_from("<I", blob, eocd + 16)[0]
    total = struct.unpack_from("<H", blob, eocd + 10)[0]

    renamed = []
    pos = cd_offset
    for _ in range(total):
        if blob[pos:pos + 4] != CD_SIG:
            raise SystemExit("bad central directory at %d" % pos)
        name_len = struct.unpack_from("<H", blob, pos + 28)[0]
        local_offset = struct.unpack_from("<I", blob, pos + 42)[0]
        name_at = pos + 46
        name = bytes(blob[name_at:name_at + name_len])
        if b"\\" in name:
            fixed = name.replace(b"\\", b"/")
            blob[name_at:name_at + name_len] = fixed
            # 本地文件头里也有一份同样的名字
            if blob[local_offset:local_offset + 4] != LOCAL_SIG:
                raise SystemExit("bad local header at %d" % local_offset)
            local_name_at = local_offset + 30
            local_name = bytes(blob[local_name_at:local_name_at + name_len])
            if local_name != name:
                raise SystemExit("name mismatch: %r / %r" % (name, local_name))
            blob[local_name_at:local_name_at + name_len] = fixed
            renamed.append(name.decode("utf-8", "replace"))

        extra_len = struct.unpack_from("<H", blob, pos + 30)[0]
        comment_len = struct.unpack_from("<H", blob, pos + 32)[0]
        pos += 46 + name_len + extra_len + comment_len

    with open(path, "wb") as fh:
        fh.write(blob)

    if renamed:
        print("fixed %d asset entry name(s):" % len(renamed))
        for name in renamed:
            print("  " + name.replace("\\", "/"))
    else:
        print("asset entry names already ok")
    return renamed


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: fix_asset_names.py <apk>")
    fix_names(sys.argv[1])
