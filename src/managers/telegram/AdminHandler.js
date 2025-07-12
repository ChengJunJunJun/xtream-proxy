class AdminHandler {
    constructor(config, userManager, logger) {
        this.config = config;
        this.userManager = userManager;
        this.logger = logger;
    }
    
    async handleAdminCommand(msg, telegramBotManager, args) {
        if (args.length === 0) {
            await this.showAdminHelp(msg, telegramBotManager);
            return;
        }
        
        const subCommand = args[0].toLowerCase();
        
        switch (subCommand) {
            case 'stats':
                await this.handleStats(msg, telegramBotManager);
                break;
            case 'users':
                await this.handleUsersList(msg, telegramBotManager);
                break;
            case 'cleanup':
                await this.handleCleanup(msg, telegramBotManager);
                break;
            case 'changem3u':
                await this.handleChangeM3U(msg, telegramBotManager, args.slice(1));
                break;
            case 'limitexceeded':
                await this.handleLimitExceeded(msg, telegramBotManager, args.slice(1));
                break;
            case 'blacklist':
                await this.handleBlacklist(msg, telegramBotManager, args.slice(1));
                break;
            case 'useragent':
                await this.handleUserAgent(msg, telegramBotManager, args.slice(1));
                break;
            default:
                await this.showAdminHelp(msg, telegramBotManager);
        }
    }
    
    async showAdminHelp(msg, telegramBotManager) {
        const help = `🔧 管理员命令帮助：

• /admin stats - 查看系统统计
• /admin users - 查看用户列表
• /admin cleanup - 清理过期数据
• /admin limitexceeded - 管理令牌限制超额用户
• /admin blacklist - 管理黑名单
• /admin useragent - 管理User-Agent设置
• /changem3u <新的M3U链接> - 修改M3U订阅链接

使用示例：
• /admin stats
• /admin limitexceeded
• /admin blacklist list
• /admin useragent list
• /changem3u https://example.com/playlist.m3u`;
        
        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, help, { parse_mode: 'Markdown' }, msg);
    }
    
    async handleStats(msg, telegramBotManager) {
        const users = this.userManager.getUsers();
        const activeUsers = Object.values(users).filter(user => user.enabled).length;
        const telegramUsers = Object.values(users).filter(user => user.source === 'telegram').length;
        
        const stats = `📊 系统统计：

👥 *用户统计*
• 总用户数：${Object.keys(users).length}
• 活跃用户：${activeUsers}
• Telegram用户：${telegramUsers}

🖥️ *系统信息*
• 运行时间：${Math.floor(process.uptime() / 3600)} 小时
• 内存使用：${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
• Node.js版本：${process.version}

✅ 系统运行正常`;
        
        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, stats, { parse_mode: 'Markdown' }, msg);
    }
    
    async handleUsersList(msg, telegramBotManager) {
        const users = this.userManager.getUsers();
        
        if (Object.keys(users).length === 0) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, '当前没有用户', {}, msg);
            return;
        }
        
        let message = '👥 用户列表：\n\n';
        
        for (const [username, user] of Object.entries(users)) {
            const status = user.enabled ? '✅' : '❌';
            const source = user.source === 'telegram' ? '🤖' : '⚙️';
            const createdDate = new Date(user.createdAt).toLocaleDateString();
            
            message += `${status} ${source} \`${username}\`\n`;
            message += `   创建：${createdDate}\n\n`;
        }
        
        // 分割长消息
        if (message.length > 4000) {
            const chunks = this.splitMessage(message, 4000);
            for (const chunk of chunks) {
                await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, chunk, { parse_mode: 'Markdown' }, msg);
            }
        } else {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, message, { parse_mode: 'Markdown' }, msg);
        }
    }
    
    async handleCleanup(msg, telegramBotManager) {
        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, '🧹 正在清理过期数据...', {}, msg);
        
        try {
            // 这里可以调用各种清理方法
            this.userManager.cleanup();
            
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, '✅ 数据清理完成', {}, msg);
        } catch (error) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ 清理失败：${error.message}`, {}, msg);
        }
    }
    
    async handleChangeM3U(msg, telegramBotManager, args) {
        if (args.length === 0) {
            const currentUrl = this.config.originalServer?.url || '未设置';
            const channelCount = this.userManager.channelManager ? 
                this.userManager.channelManager.getChannelCount() : 0;
            
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `📺 *当前M3U订阅链接管理：*

🔗 *当前链接*：
\`${currentUrl}\`

📊 *当前状态*：
• *频道数量*：${channelCount}
• *链接状态*：${currentUrl !== '未设置' ? '✅ 已配置' : '❌ 未配置'}

💡 *使用方法*：
发送新的M3U链接URL即可更新

📝 *示例*：
\`https://example.com/playlist.m3u\`

⚠️ *注意*：修改后将自动刷新频道列表并更新所有用户的播放列表`, { parse_mode: 'Markdown' }, msg);
            return;
        }

        const newUrl = args.join(' ').trim();
        
        // 验证URL格式
        if (!this.isValidUrl(newUrl)) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ *无效的URL格式*

请提供有效的HTTP/HTTPS链接，例如：
\`https://example.com/playlist.m3u\``, { parse_mode: 'Markdown' }, msg);
            return;
        }

        const oldUrl = this.config.originalServer?.url || '未设置';
        
        try {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `�� *正在更新M3U订阅链接...*

📡 *旧链接*：\`${oldUrl}\`
🆕 *新链接*：\`${newUrl}\`

请稍候，正在测试新链接并刷新频道列表...`, { parse_mode: 'Markdown' }, msg);

            // 更新配置
            await this.updateM3UUrl(newUrl);
            
            // 更新ChannelManager的配置引用
            if (this.userManager.channelManager && this.userManager.channelManager.updateConfig) {
                this.userManager.channelManager.updateConfig(this.config);
            }
            
            // 刷新频道列表
            if (this.userManager.channelManager && this.userManager.channelManager.refreshChannels) {
                await this.userManager.channelManager.refreshChannels();
                
                const channelCount = this.userManager.channelManager.getChannelCount ? 
                    this.userManager.channelManager.getChannelCount() : '未知';
                
                await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `✅ *M3U订阅链接更新成功！*

📺 *新链接*：\`${newUrl}\`
🔄 *频道列表已自动刷新*
📊 *当前频道数量*：${channelCount}

💡 *重要提醒*：所有用户需要重新获取播放列表才能看到更新的频道。`, { parse_mode: 'Markdown' }, msg);
                
                this.logger.info(`管理员 ${msg.from.id} 更新了M3U链接: ${oldUrl} -> ${newUrl}`);
            } else {
                await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `✅ *M3U订阅链接已更新！*

📺 *新链接*：\`${newUrl}\`

⚠️ *警告*：频道管理器不可用，请手动刷新频道列表。`, { parse_mode: 'Markdown' }, msg);
            }
            
        } catch (error) {
            this.logger.error('更新M3U链接失败:', error);
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ *更新M3U链接失败：*

*错误信息*：${error.message}

*可能的原因*：
• 新链接无法访问
• 链接格式不正确
• 网络连接问题

*解决方案*：请检查链接是否有效后重试。`, { parse_mode: 'Markdown' }, msg);
        }
    }

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    async updateM3UUrl(newUrl) {
        // 更新内存中的配置
        if (!this.config.originalServer) {
            this.config.originalServer = {};
        }
        this.config.originalServer.url = newUrl;
        
        // 保存配置到文件并重新加载
        const ConfigManager = require('../../utils/ConfigManager');
        const configManager = new ConfigManager();
        configManager.set('originalServer.url', newUrl);
        
        // 重新加载配置以确保所有引用都更新
        const updatedConfig = configManager.getConfig();
        
        // 更新当前配置引用
        Object.assign(this.config, updatedConfig);
        
        this.logger.info(`M3U URL updated to: ${newUrl}`);
    }
    
    async handleLimitExceeded(msg, telegramBotManager, args) {
        try {
            // 获取TokenManager实例来查看达到限制的用户
            const TokenManager = require('./TokenManager');
            const tokenManager = new TokenManager(this.config, this.logger);
            
            const limitExceededUsers = tokenManager.getLimitExceededUsers();
            
            if (limitExceededUsers.length === 0) {
                await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `📊 令牌限制管理

🎯 当前没有达到每日令牌限制的用户

💡 用户达到每日令牌限制后会在这里显示，您可以选择：
• 重置用户的每日限制
• 将用户加入黑名单`, {}, msg);
                return;
            }

            let message = `📊 令牌限制超额用户管理\n\n`;
            
            // 确保配置结构存在
            const maxTokens = (this.config.telegram && this.config.telegram.maxTokensPerUser) ? this.config.telegram.maxTokensPerUser : 2;
            message += `⚠️ 以下用户已达到每日令牌生成限制 (${maxTokens}/天)：\n\n`;

            for (let i = 0; i < limitExceededUsers.length; i++) {
                const user = limitExceededUsers[i];
                const resetTime = new Date(user.resetTime).toLocaleString('zh-CN');
                
                message += `${i + 1}. *用户ID*: \`${user.userId}\`\n`;
                message += `   *已生成*: ${user.count} 个令牌\n`;
                message += `   *重置时间*: ${resetTime}\n\n`;
            }

            message += `🛠️ *管理操作*：\n`;
            message += `• 回复 \`reset <用户ID>\` - 重置用户每日限制\n`;
            message += `• 回复 \`blacklist <用户ID>\` - 加入黑名单\n\n`;
            message += `📝 *示例*：\n`;
            message += `• \`reset 123456789\`\n`;
            message += `• \`blacklist 123456789\``;

            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, message, { parse_mode: 'Markdown' }, msg);

        } catch (error) {
            this.logger.error('获取限制超额用户失败:', error);
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ 获取限制超额用户失败：${error.message}`, {}, msg);
        }
    }

    async handleBlacklist(msg, telegramBotManager, args) {
        if (args.length === 0) {
            await this.showBlacklistHelp(msg, telegramBotManager);
            return;
        }

        const action = args[0].toLowerCase();

        try {
            switch (action) {
                case 'list':
                    await this.listBlacklist(msg, telegramBotManager);
                    break;
                case 'add':
                    if (args.length < 2) {
                        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, '❌ 请提供要加入黑名单的用户ID\n\n使用方法：`/admin blacklist add <用户ID>`', { parse_mode: 'Markdown' }, msg);
                        return;
                    }
                    await this.addToBlacklist(msg, telegramBotManager, args[1]);
                    break;
                case 'remove':
                    if (args.length < 2) {
                        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, '❌ 请提供要移除的用户ID\n\n使用方法：`/admin blacklist remove <用户ID>`', { parse_mode: 'Markdown' }, msg);
                        return;
                    }
                    await this.removeFromBlacklist(msg, telegramBotManager, args[1]);
                    break;
                default:
                    await this.showBlacklistHelp(msg, telegramBotManager);
            }
        } catch (error) {
            this.logger.error('黑名单操作失败:', error);
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ 黑名单操作失败：${error.message}`, {}, msg);
        }
    }

    async showBlacklistHelp(msg, telegramBotManager) {
        const help = `🚫 *黑名单管理帮助*

*可用命令*：
• \`/admin blacklist list\` - 查看黑名单
• \`/admin blacklist add <用户ID>\` - 添加用户到黑名单
• \`/admin blacklist remove <用户ID>\` - 从黑名单移除用户

*使用示例*：
• \`/admin blacklist list\`
• \`/admin blacklist add 123456789\`
• \`/admin blacklist remove 123456789\`

*说明*：
• 黑名单用户无法生成令牌
• 黑名单用户无法使用机器人的任何功能
• 黑名单信息保存在配置文件中`;

        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, help, { parse_mode: 'Markdown' }, msg);
    }

    async listBlacklist(msg, telegramBotManager) {
        // 确保配置结构存在
        if (!this.config.telegram) {
            this.config.telegram = {};
        }
        if (!this.config.telegram.blacklist) {
            this.config.telegram.blacklist = [];
        }
        
        const blacklist = this.config.telegram.blacklist;
        
        if (blacklist.length === 0) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `🚫 *黑名单管理*

📝 当前黑名单为空

💡 您可以使用以下命令管理黑名单：
• \`/admin blacklist add <用户ID>\` - 添加用户
• 当用户达到令牌限制时，在限制管理页面也可直接加入黑名单`, { parse_mode: 'Markdown' }, msg);
            return;
        }

        let message = `🚫 *黑名单用户列表* (${blacklist.length} 人)\n\n`;
        
        for (let i = 0; i < blacklist.length; i++) {
            const userId = blacklist[i];
            message += `${i + 1}. *用户ID*: \`${userId}\`\n`;
            
            // 尝试获取用户信息
            try {
                const groupIds = this.getGroupIds();
                let userFound = false;
                
                // 尝试从任何一个群组获取用户信息
                for (const groupId of groupIds) {
                    try {
                        const chatMember = await telegramBotManager.getChatMember(parseInt(groupId), userId);
                        if (chatMember.user.username) {
                            message += `   *用户名*: @${chatMember.user.username}\n`;
                        }
                        if (chatMember.user.first_name) {
                            message += `   *姓名*: ${chatMember.user.first_name}\n`;
                        }
                        userFound = true;
                        break; // 找到用户信息就停止
                    } catch (error) {
                        // 继续尝试其他群组
                    }
                }
                
                if (!userFound) {
                    message += `   *状态*: 无法获取用户信息\n`;
                }
            } catch (error) {
                message += `   *状态*: 无法获取用户信息\n`;
            }
            message += '\n';
        }

        message += `🛠️ *管理操作*：\n`;
        message += `• 使用 \`/admin blacklist remove <用户ID>\` 移除用户`;

        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, message, { parse_mode: 'Markdown' }, msg);
    }

    async addToBlacklist(msg, telegramBotManager, userId) {
        const userIdStr = userId.toString();
        
        // 确保配置结构存在
        if (!this.config.telegram) {
            this.config.telegram = {};
        }
        if (!this.config.telegram.blacklist) {
            this.config.telegram.blacklist = [];
        }
        
        if (this.config.telegram.blacklist.includes(userIdStr)) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `⚠️ 用户 \`${userIdStr}\` 已在黑名单中`, { parse_mode: 'Markdown' }, msg);
            return;
        }

        // 添加到黑名单
        this.config.telegram.blacklist.push(userIdStr);
        
        // 保存配置
        await this.saveConfig();
        
        // 清除该用户的所有令牌和限制
        const TokenManager = require('./TokenManager');
        const tokenManager = new TokenManager(this.config, this.logger);
        tokenManager.revokeTokensForUser(parseInt(userIdStr));
        tokenManager.clearUserLimit(parseInt(userIdStr));

        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `✅ *用户已加入黑名单*

👤 *用户ID*: \`${userIdStr}\`
🚫 *状态*: 已禁止使用所有功能
🔄 *操作*: 已清除该用户的所有令牌和限制

该用户将无法：
• 生成新的访问令牌
• 使用机器人的任何功能
• 获取播放列表`, { parse_mode: 'Markdown' }, msg);

        // 尝试通知被加入黑名单的用户
        try {
            await telegramBotManager.sendAutoDeleteMessage(userIdStr, `🚫 *您已被管理员加入黑名单*

您的账户已被限制使用 Xtream Codes Proxy 机器人的所有功能。

如有疑问，请联系管理员。`, {}, msg);
        } catch (error) {
            // 如果无法发送消息给用户，不需要报错
            this.logger.debug(`无法通知被加入黑名单的用户 ${userIdStr}:`, error.message);
        }

        this.logger.info(`管理员 ${msg.from.id} 将用户 ${userIdStr} 加入黑名单`);
    }

    async removeFromBlacklist(msg, telegramBotManager, userId) {
        const userIdStr = userId.toString();
        
        // 确保配置结构存在
        if (!this.config.telegram) {
            this.config.telegram = {};
        }
        if (!this.config.telegram.blacklist) {
            this.config.telegram.blacklist = [];
        }
        
        const index = this.config.telegram.blacklist.indexOf(userIdStr);
        if (index === -1) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `⚠️ 用户 \`${userIdStr}\` 不在黑名单中`, { parse_mode: 'Markdown' }, msg);
            return;
        }

        // 从黑名单移除
        this.config.telegram.blacklist.splice(index, 1);
        
        // 保存配置
        await this.saveConfig();

        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `✅ *用户已从黑名单移除*

👤 *用户ID*: \`${userIdStr}\`
✅ *状态*: 恢复正常访问
🔄 *操作*: 用户可以重新使用机器人功能

该用户现在可以：
• 生成新的访问令牌
• 使用机器人的所有功能
• 获取播放列表`, { parse_mode: 'Markdown' }, msg);

        // 尝试通知被移除黑名单的用户
        try {
            await telegramBotManager.sendAutoDeleteMessage(userIdStr, `✅ *您已被管理员从黑名单移除*

您的账户已恢复正常，可以重新使用 Xtream Codes Proxy 机器人的所有功能。

请使用 /start 重新开始使用机器人。`, {}, msg);
        } catch (error) {
            // 如果无法发送消息给用户，不需要报错
            this.logger.debug(`无法通知被移除黑名单的用户 ${userIdStr}:`, error.message);
        }

        this.logger.info(`管理员 ${msg.from.id} 将用户 ${userIdStr} 从黑名单移除`);
    }

    async resetUserLimit(userId) {
        const TokenManager = require('./TokenManager');
        const tokenManager = new TokenManager(this.config, this.logger);
        return tokenManager.resetUserLimit(parseInt(userId));
    }

    async saveConfig() {
        const ConfigManager = require('../../utils/ConfigManager');
        const configManager = new ConfigManager();
        configManager.set('telegram.blacklist', this.config.telegram.blacklist);
        this.logger.info('黑名单配置已保存');
    }

    splitMessage(message, maxLength) {
        const chunks = [];
        let currentChunk = '';
        
        const lines = message.split('\n');
        
        for (const line of lines) {
            if (currentChunk.length + line.length + 1 > maxLength) {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }
            }
            currentChunk += line + '\n';
        }
        
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        
        return chunks;
    }

    // 获取群组ID列表 - 支持单个ID或多个ID
    getGroupIds() {
        const groupId = this.config.telegram?.groupId || this.config.groupId;
        
        if (!groupId) {
            return [];
        }
        
        // 如果是字符串且包含逗号，则按逗号分割
        if (typeof groupId === 'string') {
            if (groupId.includes(',')) {
                return groupId.split(',').map(id => id.trim()).filter(id => id);
            } else {
                return [groupId.trim()];
            }
        }
        
        // 如果是数组，直接返回
        if (Array.isArray(groupId)) {
            return groupId.map(id => id.toString().trim()).filter(id => id);
        }
        
        // 其他情况，转为字符串数组
        return [groupId.toString().trim()];
    }
    
    async handleUserAgent(msg, telegramBotManager, args) {
        if (args.length === 0) {
            await this.showUserAgentHelp(msg, telegramBotManager);
            return;
        }
        
        const subCommand = args[0].toLowerCase();
        
        switch (subCommand) {
            case 'list':
                await this.listUserAgents(msg, telegramBotManager);
                break;
            case 'set':
                await this.setUserAgent(msg, telegramBotManager, args.slice(1));
                break;
            case 'remove':
                await this.removeUserAgent(msg, telegramBotManager, args.slice(1));
                break;
            case 'enable':
                await this.enableUserAgent(msg, telegramBotManager);
                break;
            case 'disable':
                await this.disableUserAgent(msg, telegramBotManager);
                break;
            case 'default':
                await this.setDefaultUserAgent(msg, telegramBotManager, args.slice(1));
                break;
            case 'fallback':
                await this.setFallbackUrl(msg, telegramBotManager, args.slice(1));
                break;
            default:
                await this.showUserAgentHelp(msg, telegramBotManager);
        }
    }
    
    async showUserAgentHelp(msg, telegramBotManager) {
        const help = `🔧 *User-Agent 管理帮助*

📋 *可用命令*：
• \`/admin useragent list\` - 查看所有User-Agent设置
• \`/admin useragent set <服务器URL> <User-Agent>\` - 设置服务器User-Agent
• \`/admin useragent remove <服务器URL>\` - 移除服务器User-Agent
• \`/admin useragent enable\` - 启用User-Agent验证
• \`/admin useragent disable\` - 禁用User-Agent验证
• \`/admin useragent default <User-Agent>\` - 设置默认User-Agent
• \`/admin useragent fallback <回退URL>\` - 设置验证失败时的回退视频

💡 *使用示例*：
• \`/admin useragent set example.com judy/8.8.8\`
• \`/admin useragent remove example.com\`
• \`/admin useragent default judy/8.8.8\`
• \`/admin useragent fallback https://example.com/fallback.m3u8\`

⚠️ *注意*：
• 每个服务器只需要设置一个User-Agent
• 用户必须使用指定的User-Agent才能观看直播
• 验证失败时会自动跳转到回退视频（如已设置）`;
        
        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, help, { parse_mode: 'Markdown' }, msg);
    }
    
    async listUserAgents(msg, telegramBotManager) {
        const userAgentManager = this.userManager.channelManager?.getUserAgentManager();
        if (!userAgentManager) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, '❌ User-Agent管理器不可用', {}, msg);
            return;
        }
        
        const stats = userAgentManager.getStats();
        const allUserAgents = userAgentManager.getAllServerUserAgents();
        
        let message = `🔧 *User-Agent 配置状态*\n\n`;
        message += `📊 *总体状态*：\n`;
        message += `• *功能状态*：${stats.enabled ? '✅ 已启用' : '❌ 已禁用'}\n`;
        message += `• *默认User-Agent*：\`${stats.defaultUserAgent}\`\n`;
        message += `• *回退视频URL*：\`${stats.fallbackUrl}\`\n`;
        message += `• *配置服务器数量*：${stats.serverCount}\n\n`;
        
        if (Object.keys(allUserAgents).length === 0) {
            message += `📋 *服务器配置*：\n`;
            message += `暂无服务器User-Agent配置\n\n`;
        } else {
            message += `📋 *服务器配置*：\n`;
            for (const [server, config] of Object.entries(allUserAgents)) {
                const createdDate = new Date(config.createdAt).toLocaleDateString();
                message += `🌐 *服务器*：\`${server}\`\n`;
                message += `   *User-Agent*：\`${config.userAgent}\`\n`;
                message += `   *创建时间*：${createdDate}\n\n`;
            }
        }
        
        message += `💡 *提示*：\n`;
        message += `• 使用 \`/admin useragent set\` 添加新配置\n`;
        message += `• 使用 \`/admin useragent ${stats.enabled ? 'disable' : 'enable'}\` ${stats.enabled ? '禁用' : '启用'}验证`;
        
        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, message, { parse_mode: 'Markdown' }, msg);
    }
    
    async setUserAgent(msg, telegramBotManager, args) {
        if (args.length < 2) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ *参数不足*

*使用方法*：
\`/admin useragent set <服务器URL> <User-Agent>\`

*示例*：
\`/admin useragent set example.com judy/8.8.8\``, { parse_mode: 'Markdown' }, msg);
            return;
        }
        
        const serverUrl = args[0];
        const userAgent = args.slice(1).join(' ');
        
        const userAgentManager = this.userManager.channelManager?.getUserAgentManager();
        if (!userAgentManager) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, '❌ User-Agent管理器不可用', {}, msg);
            return;
        }
        
        try {
            userAgentManager.setServerUserAgent(serverUrl, userAgent);
            
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `✅ *User-Agent设置成功*

🌐 *服务器*：\`${serverUrl}\`
🔧 *User-Agent*：\`${userAgent}\`

⚠️ *重要提醒*：
• 用户必须使用指定的User-Agent才能观看此服务器的直播
• 如果功能未启用，请使用 \`/admin useragent enable\` 启用验证`, { parse_mode: 'Markdown' }, msg);
            
            this.logger.info(`管理员 ${msg.from.id} 设置服务器 ${serverUrl} 的User-Agent: ${userAgent}`);
            
        } catch (error) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ *设置失败*：${error.message}`, { parse_mode: 'Markdown' }, msg);
        }
    }
    
    async removeUserAgent(msg, telegramBotManager, args) {
        if (args.length === 0) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ *参数不足*

*使用方法*：
\`/admin useragent remove <服务器URL>\`

*示例*：
\`/admin useragent remove example.com\``, { parse_mode: 'Markdown' }, msg);
            return;
        }
        
        const serverUrl = args[0];
        
        const userAgentManager = this.userManager.channelManager?.getUserAgentManager();
        if (!userAgentManager) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, '❌ User-Agent管理器不可用', {}, msg);
            return;
        }
        
        try {
            const success = userAgentManager.removeServerUserAgent(serverUrl);
            
            if (success) {
                await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `✅ *User-Agent配置已移除*

🌐 *服务器*：\`${serverUrl}\`
🔄 *状态*：该服务器不再需要特定User-Agent验证`, { parse_mode: 'Markdown' }, msg);
                
                this.logger.info(`管理员 ${msg.from.id} 移除了服务器 ${serverUrl} 的User-Agent配置`);
            } else {
                await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `⚠️ *未找到配置*

🌐 *服务器*：\`${serverUrl}\`
❌ *状态*：该服务器没有User-Agent配置`, { parse_mode: 'Markdown' }, msg);
            }
            
        } catch (error) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ *移除失败*：${error.message}`, { parse_mode: 'Markdown' }, msg);
        }
    }
    
    async enableUserAgent(msg, telegramBotManager) {
        try {
            const ConfigManager = require('../../utils/ConfigManager');
            const configManager = new ConfigManager();
            configManager.set('userAgent.enabled', true);
            
            // 更新当前配置
            this.config.userAgent = this.config.userAgent || {};
            this.config.userAgent.enabled = true;
            
            // 更新ChannelManager的配置
            if (this.userManager.channelManager) {
                this.userManager.channelManager.updateConfig(this.config);
            }
            
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `✅ *User-Agent验证已启用*

🔒 *安全状态*：已启用
⚠️ *重要提醒*：
• 用户必须使用指定的User-Agent才能观看直播
• 不匹配的请求将被拒绝
• 请确保已为相关服务器配置User-Agent

💡 *查看配置*：使用 \`/admin useragent list\` 查看当前配置`, { parse_mode: 'Markdown' }, msg);
            
            this.logger.info(`管理员 ${msg.from.id} 启用了User-Agent验证`);
            
        } catch (error) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ *启用失败*：${error.message}`, { parse_mode: 'Markdown' }, msg);
        }
    }
    
    async disableUserAgent(msg, telegramBotManager) {
        try {
            const ConfigManager = require('../../utils/ConfigManager');
            const configManager = new ConfigManager();
            configManager.set('userAgent.enabled', false);
            
            // 更新当前配置
            this.config.userAgent = this.config.userAgent || {};
            this.config.userAgent.enabled = false;
            
            // 更新ChannelManager的配置
            if (this.userManager.channelManager) {
                this.userManager.channelManager.updateConfig(this.config);
            }
            
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `✅ *User-Agent验证已禁用*

🔓 *安全状态*：已禁用
⚠️ *重要提醒*：
• 用户可以使用任何User-Agent观看直播
• 不会进行User-Agent验证
• 服务器配置保持不变

💡 *重新启用*：使用 \`/admin useragent enable\` 重新启用验证`, { parse_mode: 'Markdown' }, msg);
            
            this.logger.info(`管理员 ${msg.from.id} 禁用了User-Agent验证`);
            
        } catch (error) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ *禁用失败*：${error.message}`, { parse_mode: 'Markdown' }, msg);
        }
    }
    
    async setDefaultUserAgent(msg, telegramBotManager, args) {
        if (args.length === 0) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ *参数不足*

*使用方法*：
\`/admin useragent default <User-Agent>\`

*示例*：
\`/admin useragent default judy/8.8.8\``, { parse_mode: 'Markdown' }, msg);
            return;
        }
        
        const userAgent = args.join(' ');
        
        try {
            const ConfigManager = require('../../utils/ConfigManager');
            const configManager = new ConfigManager();
            configManager.set('userAgent.defaultUserAgent', userAgent);
            
            // 更新当前配置
            this.config.userAgent = this.config.userAgent || {};
            this.config.userAgent.defaultUserAgent = userAgent;
            
            // 更新ChannelManager的配置
            if (this.userManager.channelManager) {
                this.userManager.channelManager.updateConfig(this.config);
            }
            
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `✅ *默认User-Agent设置成功*

🔧 *默认User-Agent*：\`${userAgent}\`

💡 *说明*：
• 当服务器没有特定User-Agent配置时，将使用此默认值
• 仅在User-Agent验证启用时生效
• 可以为特定服务器设置不同的User-Agent覆盖默认值`, { parse_mode: 'Markdown' }, msg);
            
            this.logger.info(`管理员 ${msg.from.id} 设置默认User-Agent: ${userAgent}`);
            
        } catch (error) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ *设置失败*：${error.message}`, { parse_mode: 'Markdown' }, msg);
        }
    }
    
    async setFallbackUrl(msg, telegramBotManager, args) {
        if (args.length === 0) {
            const userAgentManager = this.userManager.channelManager?.getUserAgentManager();
            const currentFallbackUrl = userAgentManager ? userAgentManager.getFallbackUrl() : '未设置';
            
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `🎬 *回退视频URL管理*

🔗 *当前回退URL*：
\`${currentFallbackUrl || '未设置'}\`

💡 *功能说明*：
• 当用户的User-Agent验证失败时，自动跳转到此视频
• 用户将直接播放回退视频而不是收到错误信息
• 提供更好的用户体验

📝 *使用方法*：
\`/admin useragent fallback <视频URL>\`

🎯 *示例*：
\`/admin useragent fallback https://smart.pendy.dpdns.org/judy/output.m3u8\``, { parse_mode: 'Markdown' }, msg);
            return;
        }
        
        const fallbackUrl = args.join(' ');
        
        // 验证URL格式
        if (!this.isValidUrl(fallbackUrl)) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ *无效的URL格式*

请提供有效的HTTP/HTTPS链接，例如：
\`https://smart.pendy.dpdns.org/judy/output.m3u8\``, { parse_mode: 'Markdown' }, msg);
            return;
        }
        
        const userAgentManager = this.userManager.channelManager?.getUserAgentManager();
        if (!userAgentManager) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, '❌ User-Agent管理器不可用', {}, msg);
            return;
        }
        
        try {
            const ConfigManager = require('../../utils/ConfigManager');
            const configManager = new ConfigManager();
            configManager.set('userAgent.fallbackUrl', fallbackUrl);
            
            // 更新当前配置
            this.config.userAgent = this.config.userAgent || {};
            this.config.userAgent.fallbackUrl = fallbackUrl;
            
            // 更新ChannelManager的配置
            if (this.userManager.channelManager) {
                this.userManager.channelManager.updateConfig(this.config);
            }
            
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `✅ *回退视频URL设置成功*

🎬 *回退URL*：\`${fallbackUrl}\`

💡 *效果说明*：
• 当用户User-Agent验证失败时，将自动跳转到此视频
• 用户不会看到错误信息，而是直接播放回退视频
• 提供更流畅的用户体验

⚠️ *注意*：
• 确保回退视频URL可正常访问
• 建议使用稳定可靠的视频源
• 此功能仅在User-Agent验证启用时生效`, { parse_mode: 'Markdown' }, msg);
            
            this.logger.info(`管理员 ${msg.from.id} 设置回退URL: ${fallbackUrl}`);
            
        } catch (error) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ *设置失败*：${error.message}`, { parse_mode: 'Markdown' }, msg);
        }
    }
}

module.exports = AdminHandler; 