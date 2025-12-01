# 变更日志 - 多订阅源功能

## [1.1.0] - 2024-12-01

### 新增功能 ✨

#### 多订阅源支持
- 支持同时配置多个 M3U 订阅源
- 自动从所有启用的订阅源加载并合并频道
- 每个订阅源可以独立命名、启用/禁用
- 并行加载所有订阅源，提高加载速度
- 失败的订阅源不会影响其他订阅源的加载

#### Telegram 管理命令
新增 `/admin sources` 命令系列用于管理多个订阅源：
- `/admin sources list` - 查看所有订阅源及详细状态
- `/admin sources add <URL> <名称>` - 添加新订阅源
- `/admin sources remove <索引>` - 移除订阅源
- `/admin sources enable <索引>` - 启用订阅源
- `/admin sources disable <索引>` - 禁用订阅源
- `/admin sources rename <索引> <新名称>` - 重命名订阅源
- `/admin sources refresh` - 手动刷新所有订阅源

#### 统计信息增强
- 每个订阅源的加载状态（成功/失败）
- 每个订阅源的频道数量和分类数量
- 每个订阅源的最后更新时间
- 失败订阅源的详细错误信息

#### 频道管理改进
- 为每个频道分配全局唯一ID
- 每个频道标记来源信息（sourceId 和 sourceName）
- 自动合并来自不同订阅源的频道分类

### 改进 🔧

#### 配置管理
- 自动迁移旧的单订阅源配置到新格式
- 标准化订阅源配置格式
- 保持向后兼容性

#### 错误处理
- 使用 `Promise.allSettled` 确保一个源失败不影响其他源
- 详细记录每个源的加载状态和错误信息
- 即使所有源都失败，也会显示示例频道

### 文档 📚

新增文档：
- `doc/MULTI_SOURCE_FEATURE.md` - 完整的功能说明和使用指南
- `doc/MULTI_SOURCE_IMPLEMENTATION.md` - 实现细节和技术总结
- `doc/MULTI_SOURCE_UPDATE.md` - 快速更新指南

更新文档：
- `README.md` - 更新配置说明和管理员命令列表
- `config.example.json` - 添加多订阅源配置示例

### 测试 🧪

新增测试脚本：
- `test/test_multi_source.js` - 全面的多订阅源功能测试
  - 配置迁移测试
  - 多源加载测试
  - 频道ID唯一性测试
  - 统计信息测试
  - 所有测试通过率：100% (8/8)

### 技术细节 🔍

#### 修改的文件
1. **src/utils/ConfigManager.js**
   - 添加 `migrateConfig()` 方法
   - 自动迁移旧配置格式
   - 标准化 urls 数组格式

2. **src/managers/ChannelManager.js**
   - 添加 `getEnabledSources()` 方法
   - 重写 `refreshChannels()` 支持多源
   - 添加 `fetchChannelsFromSource()` 方法
   - 添加 `sourceStats` 统计信息
   - 更新 `createSampleChannels()` 包含来源信息

3. **src/managers/telegram/AdminHandler.js**
   - 添加 `handleSources()` 主处理方法
   - 添加 `listSources()` 显示订阅源列表
   - 添加 `addSource()` 添加订阅源
   - 添加 `removeSource()` 移除订阅源
   - 添加 `toggleSource()` 启用/禁用订阅源
   - 添加 `renameSource()` 重命名订阅源
   - 添加 `refreshSources()` 刷新所有订阅源
   - 更新管理员帮助信息

4. **config.example.json**
   - 添加 `urls` 数组字段示例

#### 配置格式变化

**旧格式（仍然支持）：**
```json
{
  "originalServer": {
    "url": "https://example.com/playlist.m3u"
  }
}
```

**新格式（推荐）：**
```json
{
  "originalServer": {
    "url": "https://example.com/playlist.m3u",
    "urls": [
      {
        "url": "https://example.com/playlist.m3u",
        "name": "Default Source",
        "enabled": true
      }
    ]
  }
}
```

### 向后兼容性 ⚡

- ✅ 完全向后兼容旧配置
- ✅ 自动迁移，无需手动修改
- ✅ `/changem3u` 命令继续可用
- ✅ 现有用户和频道不受影响

### 已知问题 ⚠️

无已知问题

### 升级说明 📦

**自动升级：** 无需任何操作，系统会自动迁移配置。

**可选步骤：** 
1. 备份 `config.json` 文件
2. 启动系统，查看配置是否自动迁移
3. 使用 `/admin sources list` 查看当前订阅源
4. 根据需要添加更多订阅源

### 性能影响 ⚡

- 初次加载时间与订阅源数量成正比
- 推荐订阅源数量：3-5 个
- 使用并行加载，多个源不会显著增加总加载时间
- 频道缓存功能可显著提高后续加载速度

### 安全性 🔒

- 所有订阅源管理操作需要管理员权限
- URL 格式验证防止无效配置
- 配置修改立即保存到文件

### 贡献者 👥

- AI Assistant (Claude) - 功能设计和实现

---

**完整变更**: v1.0.0...v1.1.0
