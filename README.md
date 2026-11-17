# 鲸语

一个界面贴近 DeepSeek 官方 App 的手机客户端，直接接入 DeepSeek API。

## 功能
- **一键接入**：粘贴 API Key → 一键接入，自动测试连接并显示余额
- **原版体验**：深色/浅色、深度思考（可折叠思考过程）、侧边栏按时间分组、搜索、设置页布局与官方一致
- **导入聊天记录**：zip / json / 纯文本（「我：… / TA：…」），导入后可直接继续聊（⚠️ 导入格式待用真实导出文件核实）
- **智能压缩**：对话超过阈值（默认约 64k tokens）时，把较早内容整理成「回顾」，保留称呼、语气、约定、重要事件；回顾可查看和手动修改
- **跨会话长期记忆**：聊天时自动提取值得记住的事，所有新对话都会带上；可查看、编辑、删除、手动添加
- **个性化**：你的昵称、头像、TA 的名字、人设（系统提示词）
- **其他**：图片输入（Flash 模型）、文本文件、朗读、复制/重新生成/编辑重发、备份导出与恢复
- 所有数据只存在手机本地（IndexedDB），只发送给你填写的 API 地址

## 模型
- `deepseek-flash`（默认，快，支持图片）
- `deepseek-v4-pro`（更聪明，不支持图片）
- 深度思考通过 `thinking: {type: enabled/disabled}` 开关，可调强度 low / high / max

## 目录
- `www/`：App 本体（纯 HTML/CSS/JS，无需构建），也可以直接部署成网页 / PWA
- `android/`：Capacitor 安卓工程

## 打包 APK
```bash
npm install
npx cap sync android
cd android && ./gradlew assembleDebug
```
产物：`android/app/build/outputs/apk/debug/app-debug.apk`

iPhone 用户：把 `www/` 部署到任意 HTTPS 静态托管（如 GitHub Pages），用 Safari 打开 → 分享 → 添加到主屏幕。
