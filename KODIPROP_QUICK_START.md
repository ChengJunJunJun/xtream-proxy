# KODIPROP 快速使用指南

## 快速开始

### 1. 验证功能可用

运行测试脚本验证 KODIPROP 功能正常工作：

```bash
# 测试解析功能
node test/test_kodiprop_parser.js

# 测试播放列表生成
node test/test_kodiprop_playlist.js
```

如果看到 "🎉 所有测试通过！" 消息，说明功能正常。

### 2. 配置订阅源

在 `config.json` 中添加包含 KODIPROP 的订阅源：

```json
{
  "originalServer": {
    "urls": [
      {
        "url": "https://your-provider.com/playlist.m3u",
        "name": "Provider with DRM",
        "enabled": true
      }
    ]
  }
}
```

**注意**: 无需特殊配置，系统会自动识别 KODIPROP 指令。

### 3. 启动服务器

```bash
npm start
```

服务器启动后会自动解析订阅源并识别 KODIPROP 指令。

### 4. 获取播放列表

使用标准的 Xtream Codes API：

```bash
# M3U 格式
http://your-server:8080/get.php?username=USER&password=PASS&type=m3u

# M3U Plus 格式
http://your-server:8080/get.php?username=USER&password=PASS&type=m3u_plus
```

生成的播放列表会包含所有 KODIPROP 指令。

## 验证 KODIPROP 是否正确包含

### 方法 1: 使用 curl

```bash
curl "http://your-server:8080/get.php?username=USER&password=PASS&type=m3u_plus" | grep KODIPROP
```

如果有输出，说明 KODIPROP 指令已包含。

### 方法 2: 保存并查看

```bash
curl "http://your-server:8080/get.php?username=USER&password=PASS&type=m3u_plus" -o playlist.m3u
cat playlist.m3u | less
```

搜索 `#KODIPROP:` 来查看指令。

### 方法 3: 使用播放器

将播放列表链接添加到支持 KODIPROP 的播放器（如 Kodi），查看是否能正常播放 DRM 内容。

## 示例播放列表格式

### 输入（上游订阅）

```m3u
#EXTM3U
#EXTINF:-1 tvg-id="MytvSuper" tvg-name="SUPER识食" tvg-logo="https://example.com/logo.png" group-title="生活",SUPER識食
#KODIPROP:inputstream.adaptive.manifest_type=mpd
#KODIPROP:inputstream.adaptive.license_type=clearkey
#KODIPROP:inputstream.adaptive.license_key=2370118ce3d6fafe17502b0176abf9ae:357c7b5a9d01c25d8e30e46cc396de08
https://ofiii.passwdword.xyz/mytv265.php?id=SFOO
```

### 输出（代理播放列表）

```m3u
#EXTM3U x-tvg-url="http://your-server:8080/xmltv.php"
#EXTINF:-1 tvg-id="MytvSuper" tvg-name="SUPER识食" tvg-logo="https://example.com/logo.png" group-title="生活" tvg-chno="1" tvg-shift="0",SUPER識食
#KODIPROP:inputstream.adaptive.manifest_type=mpd
#KODIPROP:inputstream.adaptive.license_type=clearkey
#KODIPROP:inputstream.adaptive.license_key=2370118ce3d6fafe17502b0176abf9ae:357c7b5a9d01c25d8e30e46cc396de08
http://your-server:8080/live/encrypted/ENCRYPTED_TOKEN?username=USER
```

**关键点**:
- ✅ KODIPROP 指令完整保留
- ✅ URL 替换为代理服务器地址
- ✅ 所有频道属性保留

## 播放器配置

### Kodi

1. 安装 **InputStream Adaptive** 插件：
   - 设置 → 插件 → 从仓库安装
   - 视频播放器输入流 → InputStream Adaptive
   - 安装

2. 添加播放列表：
   - PVR IPTV Simple Client → 配置
   - M3U 播放列表 URL: `http://your-server:8080/get.php?username=USER&password=PASS&type=m3u_plus`

3. 播放频道，DRM 内容应该能正常工作

### TiviMate

1. 添加播放列表：
   - 设置 → 播放列表 → 添加播放列表
   - 选择 "Xtream Codes API"
   - 输入服务器信息

2. TiviMate 会自动处理 KODIPROP 指令

### IPTV Smarters Pro

1. 添加播放列表：
   - 添加用户 → Xtream Codes
   - 输入服务器 URL、用户名和密码

2. 播放器会自动识别 KODIPROP 指令

## 常见问题

### Q: 我怎么知道我的订阅源有 KODIPROP？

A: 下载原始 M3U 文件并搜索 `#KODIPROP:` 或 `#EXTVLCOPT:`：

```bash
curl "https://original-provider.com/playlist.m3u" | grep -i "KODIPROP\|EXTVLCOPT"
```

### Q: KODIPROP 不起作用怎么办？

A: 检查以下几点：
1. 播放器是否支持 KODIPROP（如 Kodi 需要 InputStream Adaptive 插件）
2. 运行测试脚本确认解析正常
3. 检查生成的播放列表是否包含 KODIPROP
4. 查看播放器日志了解错误信息

### Q: 需要修改配置文件吗？

A: 不需要！KODIPROP 支持是自动的，无需任何配置更改。

### Q: 会影响现有的订阅源吗？

A: 不会！功能完全向后兼容，不包含 KODIPROP 的订阅源照常工作。

### Q: 哪些播放器支持 KODIPROP？

A: 主要支持：
- Kodi (需要 InputStream Adaptive)
- TiviMate
- Perfect Player
- IPTV Smarters Pro

VLC 和其他播放器支持 `#EXTVLCOPT:` 指令。

## 故障排除

### 问题: 播放列表不包含 KODIPROP

**解决方案**:

1. 验证上游订阅源包含 KODIPROP：
   ```bash
   curl "https://original-provider.com/playlist.m3u" | head -50
   ```

2. 检查服务器日志：
   ```bash
   tail -f logs/app-*.log | grep -i kodiprop
   ```

3. 运行测试脚本：
   ```bash
   node test/test_kodiprop_parser.js
   ```

### 问题: DRM 内容无法播放

**解决方案**:

1. 确认播放器支持 DRM：
   - Kodi: 安装 InputStream Adaptive
   - TiviMate: 确保使用最新版本
   
2. 检查 KODIPROP 指令格式：
   - 应该是 `#KODIPROP:inputstream.adaptive.license_type=clearkey`
   - 不是 `#KODIPROP: inputstream.adaptive.license_type=clearkey`（注意冒号后无空格）

3. 查看播放器日志了解具体错误

### 问题: 测试脚本失败

**解决方案**:

1. 确保在项目根目录运行
2. 检查 Node.js 版本 (需要 16+)
3. 重新安装依赖：
   ```bash
   npm install
   ```

## 更多帮助

- 详细文档: [doc/KODIPROP_SUPPORT.md](doc/KODIPROP_SUPPORT.md)
- 更新日志: [CHANGELOG_KODIPROP.md](CHANGELOG_KODIPROP.md)
- 实现总结: [SUMMARY_KODIPROP.md](SUMMARY_KODIPROP.md)

## 反馈

如果遇到问题或有建议，请：
1. 查看文档寻找解决方案
2. 运行测试脚本验证功能
3. 提交 GitHub Issue 并附上：
   - 问题描述
   - 使用的播放器
   - 服务器日志（如有）
   - 示例 M3U 文件（可脱敏）

---

**提示**: 此功能现已完全集成，开箱即用，无需额外配置！

