# 宣传视频 / 封面源文件

逐帧渲染：`video.html` 里的 `render(t)` 按时间计算每一帧，`rec.js` 用 Playwright 截图后交给 ffmpeg 编码。

```bash
npm i playwright @fontsource/noto-sans-sc@5 @fontsource/noto-serif-sc@5
PAGE=video.html OUT=out.mp4 node rec.js video      # 出视频（需要 ffmpeg）
PAGE=video.html node rec.js 3,10,20                # 只截几帧预览
node shot.js                                       # 出封面 cover.png
```
