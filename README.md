# 直播吧节目单（CCTV5 筛选）

本仓库包含两种查看 [直播吧](https://www.zhibo8.com/) 节目单的方式，都**无需打开或登录直播吧网站**，
并且都可以一键筛选出 **CCTV5** 的节目：

1. **浏览器插件**（Chrome / Edge，Manifest V3）——点插件图标在弹出页看节目单。
2. **独立网页 `sports.html`**——不装插件，直接用浏览器打开一个网页看节目单。

## 功能

- 插件页面直接展示直播吧首页的节目单（按日期分组）。
- **默认只显示 CCTV5 的节目**（CCTV5 / CCTV5+），其余节目和没有 CCTV5 节目的日期自动隐藏。
- 顶部有一个筛选按钮：默认处于「只看 CCTV5」状态，点击「显示全部节目」可查看完整节目单，
  再点「筛选 CCTV5」又回到只显示 CCTV5。
- 每场比赛显示开赛时间、赛事名称、对阵（如有）以及可点击的直播频道链接。
- 右上角可刷新，页面底部有官网入口。
- 数据获取时不携带 Cookie，不登录即可查看。

## 目录结构

```
sports/
├── manifest.json        # 扩展清单（MV3）
├── popup.html           # 插件页面结构
├── popup.css            # 插件页面样式
├── popup.js             # 抓取 + 解析 + 渲染 + 筛选逻辑
├── sports.html          # 独立网页版（无需安装插件，可直接打开）
├── icons/               # 扩展图标
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 安装（开发者模式加载）

1. 打开浏览器扩展管理页：
   - Chrome：地址栏输入 `chrome://extensions/`
   - Edge：地址栏输入 `edge://extensions/`
2. 打开右上角/左下角的「开发者模式」。
3. 点击「加载已解压的扩展程序」（Edge 为「加载解压缩的扩展」）。
4. 选择本目录 `D:\codes\sports`。
5. 加载成功后，浏览器工具栏会出现插件图标。

> 如果图标没显示，点工具栏的拼图按钮，把本扩展固定到工具栏即可。

## 使用

1. 点击工具栏里的插件图标，弹出节目单。**默认只显示 CCTV5 的节目。**
2. 点击「显示全部节目」可查看完整节目单；点击「筛选 CCTV5」重新只显示 CCTV5。
3. 点击任意频道链接可跳转观看。

## 独立网页版 sports.html

不安装插件也能看节目单：直接用浏览器打开 `sports.html`（或放到任意静态服务器上）。

- **默认只显示 CCTV5 的节目**；点「显示全部节目」查看完整节目单，再点「筛选 CCTV5」切回。
- 页面按日期分组，展示时间、赛事、对阵（含队徽）和直播频道。
- 数据来自移动站 **`m.zhibo8.com`**，共 **16 天**节目单（比桌面首页的 3 天更全）。

### 为什么用 m.zhibo8.com？

桌面站 `www.zhibo8.com` **不开放跨域**（响应头固定为 `Access-Control-Allow-Origin: https://news.zhibo8.cc`，
且 `OPTIONS` 返回 405），普通网页无法用 `fetch` 读取；而移动站 `m.zhibo8.com` 返回
`Access-Control-Allow-Origin: *`，**支持跨域**，因此独立网页版直接抓取移动站。

> 插件版没有这个限制：`host_permissions` 已授权，扩展页的 `fetch` 不受 CORS 限制，所以插件版
> 直接用桌面站 `www.zhibo8.com`。

### 打开方式

- 直接双击 `sports.html` 打开即可（大多数浏览器允许 `file://` 页面发起跨域请求，且移动站返回 `*`）。
- 如果直接用文件打开被浏览器拦截，可在文件所在目录起一个本地服务器再访问：
  ```bash
  python -m http.server 8000
  # 然后浏览器打开 http://localhost:8000/sports.html
  ```
  或
  ```bash
  npx serve .
  ```

## 工作原理

- `popup.js` 使用 `fetch` 请求 `https://www.zhibo8.com/`（`credentials: 'omit'`，不带登录信息）。
  `manifest.json` 中的 `host_permissions` 已授权，扩展页发起跨域请求不会被浏览器拦截。
- 拿到的是服务器返回的 HTML，用 `DOMParser` 解析其中的节目单区域：
  - `.schedule` 下的每个 `.vct-box` 是一个日期分组，标题在 `._header ._title`；
  - 每场比赛是 `._content > ul > li`，时间取 `<time>`，赛事取 `._league`，对阵取 `._teams`；
  - `<a>` 是直播频道（如 `CCTV5`、`CCTV5+`、`咪咕`），解析时排除「文字 / 手机看直播 / 比分 / 动画」等非频道链接。
- `sports.html`（独立版）改用 `https://m.zhibo8.com/`，解析移动站结构：
  - `.saishi` 是日期分组，标题在 `.g-title`（带 `formatDate`）；
  - 每场比赛是 `.lists > li`，时间取 `.time`，赛事取 `.s_name`，频道取 `.s_keywords`，
    对阵取 `.left-team .team-name` / `.right-team .team-name`，直播链接取该 `li` 的 `href`。
- 判断是否属于 CCTV5：频道文本中包含 `CCTV5`（因此 `CCTV5` 与 `CCTV5+` 都会命中）。

## 自定义

- 想筛选别的频道（如「咪咕」「央视频」），修改 `popup.js` 顶部的 `SOURCE_URL` 附近逻辑，
  把判断关键字从 `CCTV5` 换成目标频道即可（`parseItem` 里的 `isCctv5` 判断与筛选按钮文案）。
- 想抓取其它页面，把 `SOURCE_URL` 改为对应地址，并按实际 DOM 结构调整 `parseSchedule`。

## 说明

- 节目单数据版权归直播吧所有，本扩展仅做展示与筛选。
- 若直播吧页面结构发生变化，解析可能失效，此时会在页面上提示「没有解析到节目单」，按上面
  「工作原理」中的选择器更新即可。
