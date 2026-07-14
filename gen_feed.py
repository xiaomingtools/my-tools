#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 data.json 生成 RSS 订阅源 feed.xml。
内容更新后重新运行：python3 gen_feed.py
部署前把 SITE_BASE 改成你的真实 GitHub Pages 地址。
"""
import json, sys, email.utils, datetime

SITE_BASE = "https://xiaoming-tools.github.io"
CHANNEL_LINK = SITE_BASE + "/index.html"

def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))

def rfc822(d):
    try:
        dt = datetime.datetime.strptime(d[:10], "%Y-%m-%d")
    except Exception:
        return email.utils.formatdate(datetime.datetime.utcnow().timestamp(), usegmt=True)
    return email.utils.formatdate(dt.replace(tzinfo=datetime.timezone.utc).timestamp(), usegmt=True)

with open("data.json", encoding="utf-8") as f:
    data = json.load(f)

site = data.get("site", {})
title = site.get("title", "工具狂魔小明")
desc = site.get("subtitle", "")
items = []

for a in data.get("articles", []):
    items.append(
        "  <item>\n"
        "    <title>{t}</title>\n"
        "    <link>{l}</link>\n"
        "    <guid isPermaLink=\"false\">{l}</guid>\n"
        "    <pubDate>{p}</pubDate>\n"
        "    <description>{d}</description>\n"
        "  </item>".format(t=esc(a.get("title", "")), l=esc(a.get("url", "")),
                           p=rfc822(a.get("date", "")), d=esc(a.get("summary", a.get("desc", ""))))
    )

for t in data.get("tools", []):
    items.append(
        "  <item>\n"
        "    <title>{t}</title>\n"
        "    <link>{l}</link>\n"
        "    <guid isPermaLink=\"false\">{l}</guid>\n"
        "    <pubDate>{p}</pubDate>\n"
        "    <description>{d}</description>\n"
        "  </item>".format(t=esc(t.get("name", "")), l=esc(t.get("url", "")),
                           p=rfc822(t.get("date", "")), d=esc(t.get("desc", "")))
    )

for r in data.get("resources", []):
    rd = r.get("desc", "")
    if r.get("reason"):
        rd += " " + r.get("reason", "")
    items.append(
        "  <item>\n"
        "    <title>{t}</title>\n"
        "    <link>{l}</link>\n"
        "    <guid isPermaLink=\"false\">{l}</guid>\n"
        "    <pubDate>{p}</pubDate>\n"
        "    <description>{d}</description>\n"
        "  </item>".format(t=esc(r.get("name", "")), l=esc(r.get("url", "")),
                           p=rfc822(r.get("date", "")), d=esc(rd))
    )

now = email.utils.formatdate(datetime.datetime.utcnow().timestamp(), usegmt=True)
xml = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<rss version="2.0">\n'
    "  <channel>\n"
    "    <title>{t}</title>\n"
    "    <link>{l}</link>\n"
    "    <description>{d}</description>\n"
    "    <language>zh-CN</language>\n"
    "    <lastBuildDate>{b}</lastBuildDate>\n"
    "    <generator>工具狂魔小明静态站</generator>\n"
    "{items}\n"
    "  </channel>\n"
    "</rss>\n"
).format(t=esc(title), l=esc(CHANNEL_LINK), d=esc(desc), b=now, items="\n".join(items))

with open("feed.xml", "w", encoding="utf-8") as f:
    f.write(xml)

print("feed.xml 生成完成，共 %d 条内容" % len(items))
