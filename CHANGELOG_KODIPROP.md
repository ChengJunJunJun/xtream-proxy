# KODIPROP 功能更新 - 2025年12月7日

## 新增功能

### KODIPROP 和 EXTVLCOPT 指令支持

项目现在完全支持包含高级流配置指令的 M3U 播放列表。

#### 主要改进

1. **完整的指令解析**
   - 自动识别 `#KODIPROP:` 指令
   - 自动识别 `#EXTVLCOPT:` 指令
   - 保留所有指令参数和值

2. **无缝集成**
   - 解析时提取指令
   - 存储时关联到频道
   - 生成播放列表时完整保留

3. **正确的格式**
   - 指令位置正确（在 URL 之前）
   - 支持标准 M3U 和 M3U Plus 格式
   - 向后兼容不包含指令的订阅源

#### 技术细节

**修改的文件：**
- `src/managers/ChannelManager.js` - 添加 KODIPROP 解析逻辑
- `src/managers/UserManager.js` - 在播放列表生成中包含 KODIPROP

**新增的文件：**
- `test/test_kodiprop.m3u` - 测试用的示例 M3U 文件
- `test/test_kodiprop_parser.js` - 解析功能测试
- `test/test_kodiprop_playlist.js` - 播放列表生成测试
- `doc/KODIPROP_SUPPORT.md` - 完整的功能文档

#### 测试结果

所有测试通过：
```
✅ 频道数量正确
✅ KODIPROP 指令数量正确
✅ KODIPROP 指令内容正确
✅ KODIPROP 指令位置正确（在 URL 之前）
✅ M3U 播放列表包含 KODIPROP 指令
✅ M3U Plus 播放列表包含 KODIPROP 指令
```

#### 使用场景

这个功能特别适用于：
- 包含 DRM 保护的 IPTV 订阅源
- 使用 MPEG-DASH 协议的流媒体
- 需要 clearkey 授权的频道
- 需要特殊 HTTP 头的流媒体

#### 示例

**输入（上游订阅源）：**
```m3u
#EXTINF:-1 tvg-id="MytvSuper" tvg-name="SUPER识食",SUPER識食
#KODIPROP:inputstream.adaptive.manifest_type=mpd
#KODIPROP:inputstream.adaptive.license_type=clearkey
#KODIPROP:inputstream.adaptive.license_key=2370118ce3d6fafe17502b0176abf9ae:357c7b5a9d01c25d8e30e46cc396de08
https://ofiii.passwdword.xyz/mytv265.php?id=SFOO
```

**输出（代理后的播放列表）：**
```m3u
#EXTINF:-1 tvg-id="1" tvg-name="SUPER識食",SUPER識食
#KODIPROP:inputstream.adaptive.manifest_type=mpd
#KODIPROP:inputstream.adaptive.license_type=clearkey
#KODIPROP:inputstream.adaptive.license_key=2370118ce3d6fafe17502b0176abf9ae:357c7b5a9d01c25d8e30e46cc396de08
http://localhost:8080/live/encrypted/TOKEN?username=user
```

#### 兼容性

**支持的播放器：**
- Kodi (需要 InputStream Adaptive 插件)
- TiviMate
- Perfect Player
- IPTV Smarters Pro
- VLC Media Player (EXTVLCOPT)

**向后兼容：**
- 不支持 KODIPROP 的播放器会自动忽略这些指令
- 不包含 KODIPROP 的订阅源完全正常工作
- 无需修改配置文件

#### 如何测试

1. **运行解析测试：**
   ```bash
   node test/test_kodiprop_parser.js
   ```

2. **运行播放列表生成测试：**
   ```bash
   node test/test_kodiprop_playlist.js
   ```

3. **使用实际订阅源：**
   - 在 config.json 中配置包含 KODIPROP 的订阅源
   - 启动服务器
   - 获取播放列表并验证 KODIPROP 指令已包含

#### 文档

详细文档请参考：
- [KODIPROP 支持说明](doc/KODIPROP_SUPPORT.md)
- [README.md](README.md) - 已更新主要特性说明

## 升级说明

此功能向后兼容，无需任何配置更改。只需：
1. 更新代码到最新版本
2. 重启服务器

现有的订阅源和配置将继续正常工作。如果订阅源包含 KODIPROP 指令，它们将自动被识别和保留。

## 问题反馈

如果遇到任何与 KODIPROP 相关的问题，请：
1. 查看 [KODIPROP_SUPPORT.md](doc/KODIPROP_SUPPORT.md) 文档
2. 运行测试脚本验证功能
3. 提交 GitHub Issue 并附上：
   - 示例 M3U 文件（可以脱敏）
   - 使用的播放器
   - 遇到的具体问题

---

**版本**: 1.x.x  
**日期**: 2025年12月7日  
**影响范围**: ChannelManager, UserManager, 播放列表生成

