# 🚀 快速重启指南

## 当前状态

✅ 配置文件正确  
✅ 代码已修复  
❌ 服务器未运行

## 立即解决

### 1. 启动服务器

```bash
cd /Users/cj/Mac_Projects/JavaScript_Projects/xtream-proxy
npm start
```

### 2. 等待服务器完全启动

您应该看到类似的输出：
```
🚀 Starting Xtream Codes Proxy Server...
✅ ChannelManager initialized
✅ UserManager initialized
✅ Server started successfully!
🚀 Xtream Codes Proxy Server running on http://0.0.0.0:8080
```

### 3. 在 Telegram 中测试

发送命令：
```
/admin sources list
```

或
```
/changem3u
```

## 预期结果

现在您应该能看到：

```
📺 订阅源列表 (1 个)

1. ✅ 默认订阅源
   📡 URL: https://edgeone.passwdword.xyz/m3u/GoIptv.m3u
   📊 频道: 3297 个
   📂 分类: XX 个
   🔄 更新: 刚刚
```

## 如果仍然不显示

### 检查服务器日志

```bash
tail -f logs/app-*.log
```

查找错误信息。

### 检查配置是否被正确加载

在服务器启动时，日志中应该有类似的输出：
```
[INFO] Loaded X channels from Y source(s)
```

### 检查 Telegram Bot Token

确保 `config.json` 中的 `botToken` 是正确的：
```json
"telegram": {
  "botToken": "YOUR_BOT_TOKEN",
  ...
}
```

### 重新测试代码修复

运行诊断脚本：
```bash
node test/diagnose_config.js
```

应该显示：
```
✅ 检测到旧格式 URL，将自动转换为订阅源格式

📺 识别到的订阅源:
1. ✅ 默认订阅源
   URL: https://edgeone.passwdword.xyz/m3u/GoIptv.m3u
   状态: 已启用
```

## 后台运行（推荐）

如果您想让服务器在后台持续运行：

### 使用 PM2

```bash
# 安装 PM2（如果还没安装）
npm install -g pm2

# 启动服务器
pm2 start index.js --name xtream-proxy

# 查看状态
pm2 status

# 查看日志
pm2 logs xtream-proxy

# 重启
pm2 restart xtream-proxy

# 停止
pm2 stop xtream-proxy
```

### 使用 nohup

```bash
nohup npm start > server.log 2>&1 &

# 查看日志
tail -f server.log

# 停止（需要找到进程ID）
ps aux | grep node
kill <进程ID>
```

## 常见问题

### Q: 服务器启动失败

**A:** 检查端口是否被占用：
```bash
lsof -i :8080
```

如果端口被占用，杀死占用进程或修改配置文件中的端口号。

### Q: Telegram 机器人无响应

**A:** 检查：
1. Bot Token 是否正确
2. 网络连接是否正常
3. 是否被 Telegram 限流

### Q: 配置修改后没有生效

**A:** 确保：
1. 已保存配置文件
2. 已重启服务器
3. 清除可能的缓存

## 验证修复成功

运行完整测试：

```bash
# 1. 配置诊断
node test/diagnose_config.js

# 2. 旧格式兼容性测试
node test/test_old_format_config.js

# 3. 检查配置
node test/fix_config.js
```

所有测试都应该通过。

## 需要帮助？

如果以上步骤都无法解决问题，请：

1. 收集服务器日志
2. 截图 Telegram 机器人的响应
3. 运行诊断脚本并保存输出
4. 提供这些信息以获取进一步帮助

---

**最重要的一步：现在就重启服务器！** 🚀

```bash
cd /Users/cj/Mac_Projects/JavaScript_Projects/xtream-proxy
npm start
```

