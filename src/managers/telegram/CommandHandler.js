class CommandHandler {
    constructor(config, userManager, logger, serverConfig) {
        this.config = config;
        this.userManager = userManager;
        this.logger = logger;
        this.serverConfig = serverConfig;
    }
    
    getServerUrl() {
        // 优先使用配置中的外部URL，否则使用localhost
        if (this.config.server?.externalUrl) {
            return this.config.server.externalUrl;
        }
        
        // 如果配置了host且不是0.0.0.0，使用配置的host
        const host = this.serverConfig.host === '0.0.0.0' ? 'localhost' : this.serverConfig.host;
        return `http://${host}:${this.serverConfig.port}`;
    }
    
    async handleStart(msg, telegramBotManager) {
        const welcome = `🎬 欢迎使用 Xtream Codes Proxy 机器人！

✨ *功能介绍:*
• 安全的IPTV访问管理
• 自动生成个人登录凭据
• 支持多种播放器格式

📋 *可用命令:*
🔸 /help - 详细帮助信息
🔸 /gettoken - 获取访问令牌
🔸 /mycredentials - 查看登录凭据
🔸 /status - 服务器状态
🔸 /refresh - 刷新频道列表

🚀 *开始使用:*
请使用 /gettoken 命令获取您的访问权限！

🔒 *隐私保护:*
所有操作均在私聊中进行，确保您的信息安全。`;
        
        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, welcome, { parse_mode: 'Markdown' }, msg);
    }
    
    async handleHelp(msg, telegramBotManager) {
        const tokenExpiryMinutes = Math.floor((this.config.telegram?.tokenExpiry || 600000) / 60000);
        const maxTokensPerUser = this.config.telegram?.maxTokensPerUser || 2;
        
        const help = `📖 *Xtream Codes Proxy 机器人使用指南*

🚀 *主要功能:*
获取IPTV播放列表访问令牌，支持多种播放器

🔧 *可用命令:*
/start - 开始使用机器人
/help - 显示此帮助信息
/gettoken - 获取访问令牌
/mycredentials - 查看当前登录凭据

📱 *支持的播放器:*
• Perfect Player
• TiviMate
• IPTV Smarters Pro
• VLC Player
• GSE Smart IPTV
• 其他支持Xtream Codes的播放器

🛡️ *安全特性:*
• 令牌有时间限制（${tokenExpiryMinutes}分钟）
• 每用户每天限制生成令牌数量
• 自动检测群组成员身份
• 离开群组自动撤销权限

💡 *使用技巧:*
• 所有操作都在私聊中完成
• 妥善保存您的登录凭据
• 定期使用 /mycredentials 查看信息
• 遇到问题请联系管理员

❓ 如有疑问，请联系群组管理员。`;
        
        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, help, { parse_mode: 'Markdown' }, msg);
    }
    
    async handleGetToken(msg, telegramBotManager, tokenManager) {
        try {
            const userId = msg.from.id;
            const username = msg.from.username || msg.from.first_name;
            
            const tokenData = tokenManager.createToken(userId, username);
            const expiryMinutes = Math.floor((tokenData.expiresAt - Date.now()) / 60000);
            
            const message = `🎫 您的访问令牌已生成：

*令牌*: \`${tokenData.token}\`

⏰ *有效期*: ${expiryMinutes} 分钟

📝 *下一步操作:*
请在此私聊中直接发送上面的令牌（复制粘贴8位字符）来验证身份。

例如：直接发送 \`${tokenData.token}\`

🔒 *注意事项:*
• 此令牌仅供您个人使用
• 请勿分享给他人
• 令牌验证后将自动失效
• 如令牌过期，请重新生成`;
            
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, message, { parse_mode: 'Markdown' }, msg);
            
        } catch (error) {
            let errorMessage = `❌ 令牌生成失败：${error.message}`;
            
            if (error.message === 'Token generation limit exceeded') {
                const maxTokens = this.config.telegram?.maxTokensPerUser || 2;
                const periodHours = Math.floor((this.config.telegram?.tokenGenerationPeriod || 86400000) / 3600000);
                
                errorMessage = `❌ 令牌生成失败：每日限制已达上限

⚠️ 限制说明：
• 每${periodHours}小时最多生成 ${maxTokens} 个令牌
• ${periodHours}小时后自动重置

💡 如果您已有有效令牌，请直接使用
🔄 请稍后再试或联系管理员`;
            } else if (error.message === 'User is blacklisted') {
                errorMessage = `🚫 您已被加入黑名单

❌ 您的账户已被管理员限制使用机器人的所有功能

如有疑问，请联系管理员`;
            }
            
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, errorMessage, {}, msg);
        }
    }
    
    async handleTokenVerification(msg, telegramBotManager, tokenManager) {
        const token = msg.text.trim();
        const userId = msg.from.id;
        
        this.logger.info(`验证令牌: ${token} for user ${userId}`);
        
        const tokenData = tokenManager.verifyToken(token, userId);
        if (!tokenData) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ 令牌验证失败

可能的原因：
• 令牌已过期
• 令牌格式不正确
• 令牌已被使用

请使用 /gettoken 重新生成令牌。`, {}, msg);
            return;
        }
        
        // 创建用户凭据
        const username = `tg_${this.generateShortId()}`;
        const password = this.generatePassword();
        
        try {
            // 检查用户是否已存在，如果存在则更新过期时间
            const existingUsers = this.userManager.getUsers();
            let existingUsername = null;
            
            for (const [uname, user] of Object.entries(existingUsers)) {
                if (user.telegramUserId === userId) {
                    existingUsername = uname;
                    break;
                }
            }
            
            if (existingUsername) {
                // 用户已存在，更新过期时间和重置通知状态
                const userLinkExpiry = this.config.playlist?.userLinkExpiry || 86400000; // 从配置读取，默认24小时
                const newExpiryTime = Date.now() + userLinkExpiry;
                this.userManager.updateUser(existingUsername, {
                    expiryTime: newExpiryTime,
                    expiryNotified: false,
                    enabled: true
                });
                username = existingUsername;
                password = existingUsers[existingUsername].password;
                
                this.logger.info(`用户 ${userId} 重新验证，过期时间重置为: ${new Date(newExpiryTime).toLocaleString()}`);
            } else {
                // 创建新用户
                this.userManager.createTelegramUser(username, password, userId);
            }
            
            // 重置用户的每小时播放列表刷新限制
            this.userManager.resetUserHourlyLimit(username);
            
            const serverUrl = this.userManager.getServerUrl();
            
            // 计算过期时间
            const user = this.userManager.getUsers()[username];
            const expiryTime = new Date(user.expiryTime);
            const userLinkExpiry = this.config.playlist?.userLinkExpiry || 86400000;
            const hoursValidity = Math.floor(userLinkExpiry / (60 * 60 * 1000)); // 转换为小时
            
            // 只发送M3U Plus播放列表链接
            const message = `🎉 令牌验证成功！您的登录凭据：

📺 M3U Plus播放列表链接：

\`${serverUrl}/get.php?username=${username}&password=${password}&type=m3u_plus\`

⏰ 链接有效期：${hoursValidity}小时
📅 过期时间：${expiryTime.toLocaleString()}

💡 提示：
• 复制上述链接到您的IPTV播放器
• 链接在${hoursValidity}小时后自动失效
• 过期前机器人会自动提醒您
• 需要续期时请重新获取token`;
            
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, message, { parse_mode: 'Markdown' }, msg);
            
            this.logger.info(`用户 ${userId} 验证成功，创建凭据: ${username}`);
            
        } catch (error) {
            this.logger.error(`创建用户失败:`, error);
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ 创建用户失败：${error.message}

请稍后重试或联系管理员。`, {}, msg);
        }
    }
    
    async handleMyCredentials(msg, telegramBotManager) {
        const userId = msg.from.id;
        
        // 查找用户的Telegram用户名
        const users = this.userManager.getUsers();
        let userCredentials = null;
        let foundUsername = null;
        
        for (const [username, user] of Object.entries(users)) {
            if (user.telegramUserId === userId) {
                userCredentials = user;
                foundUsername = username;
                break;
            }
        }
        
        if (!userCredentials) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ 您还没有登录凭据

🔧 获取凭据流程：
1. 使用 /gettoken 命令获取令牌
2. 直接发送令牌进行验证
3. 验证成功后自动获得凭据

请使用 /gettoken 开始获取访问权限。`, {}, msg);
            return;
        }
        
        const serverUrl = this.userManager.getServerUrl();
        
        // 检查用户是否过期
        if (userCredentials.expiryTime && Date.now() > userCredentials.expiryTime) {
            const userLinkExpiry = this.config.playlist?.userLinkExpiry || 86400000;
            const hoursValidity = Math.floor(userLinkExpiry / (60 * 60 * 1000));
            
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ 您的访问权限已过期

🔄 重新获取访问权限：
1. 使用 /gettoken 命令获取新的访问令牌
2. 在私聊中发送令牌进行验证
3. 验证成功后获得新的${hoursValidity}小时访问权限`, {}, msg);
            return;
        }
        
        const expiryTime = userCredentials.expiryTime ? new Date(userCredentials.expiryTime) : null;
        const timeLeft = expiryTime ? Math.max(0, Math.floor((userCredentials.expiryTime - Date.now()) / (60 * 60 * 1000))) : null;
        
        // 只显示M3U Plus播放列表链接
        let message = `🎉 您的登录凭据：

📺 M3U Plus播放列表链接：

\`${serverUrl}/get.php?username=${foundUsername}&password=${userCredentials.password}&type=m3u_plus\``;

        if (expiryTime && timeLeft !== null) {
            message += `

⏰ 链接状态：${timeLeft > 0 ? '有效' : '已过期'}
📅 过期时间：${expiryTime.toLocaleString()}
⏳ 剩余时间：${timeLeft > 0 ? `${timeLeft} 小时` : '已过期'}

💡 提示：链接过期后请使用 /gettoken 重新获取`;
        } else {
            message += `

💡 提示：复制上述链接到您的IPTV播放器`;
        }
        
        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, message, { parse_mode: 'Markdown' }, msg);
    }
    
    async handleStatus(msg, telegramBotManager) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        // 获取频道数量
        const channelCount = this.userManager.channelManager ? 
            this.userManager.channelManager.getChannelCount() : 0;
        const categoryCount = this.userManager.channelManager ? 
            this.userManager.channelManager.getCategoryCount() : 0;
        
        const status = `📊 服务器状态报告：

🟢 *服务状态*: 在线运行
⏰ *运行时间*: ${hours}小时 ${minutes}分钟
👥 *总用户数*: ${this.userManager.getUserCount()}
💾 *内存使用*: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
🌐 *服务器地址*: ${this.userManager.getServerUrl()}

📈 *服务统计:*
• 活跃用户: ${this.userManager.getActiveUsers().length}
• 频道总数: ${channelCount}
• 频道分类: ${categoryCount}
• 系统负载: 正常

✅ *系统状态*: 所有服务运行正常

🔄 最后更新: ${new Date().toLocaleString()}`;
        
        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, status, { parse_mode: 'Markdown' }, msg);
    }
    
    async handleRefresh(msg, telegramBotManager) {
        const userId = msg.from.id;
        const isAdmin = this.isAdmin(userId);
        
        // 管理员和普通用户都可以使用，但显示不同的消息
        const userType = isAdmin ? '管理员' : '用户';
        
        await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `🔄 ${userType}操作：正在刷新频道列表...

请稍候，这可能需要几秒钟时间。`, {}, msg);
        
        try {
            // 调用频道管理器的刷新方法
            if (this.userManager.channelManager && this.userManager.channelManager.refreshChannels) {
                const oldChannelCount = this.userManager.channelManager.getChannelCount();
                await this.userManager.channelManager.refreshChannels();
                const newChannelCount = this.userManager.channelManager.getChannelCount();
                
                const message = isAdmin ? 
                    `✅ 管理员操作完成：频道列表刷新成功！

📺 频道数量：${oldChannelCount} → ${newChannelCount}
🔄 频道列表已更新到最新版本
📊 所有用户需要重新获取播放列表才能看到更新

💡 用户可以通过重新访问播放列表链接获取最新频道。` :
                    `✅ 频道列表刷新成功！

📺 频道数量：${newChannelCount}
🔄 频道列表已更新
💡 请重新获取播放列表链接以查看最新频道

📋 使用 /mycredentials 获取您的播放列表链接`;
                
                await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, message, {}, msg);
            } else {
                await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ 频道管理器不可用

请联系管理员检查服务器状态。`, {}, msg);
            }
        } catch (error) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ 刷新操作失败：${error.message}

请稍后重试或联系管理员。`, {}, msg);
        }
    }
    
    async handleRevoke(msg, telegramBotManager, args) {
        const userId = msg.from.id;
        
        // 查找并删除用户的所有凭据
        const users = this.userManager.getUsers();
        let deletedCount = 0;
        let deletedUsernames = [];
        
        for (const [username, user] of Object.entries(users)) {
            if (user.telegramUserId === userId) {
                if (this.userManager.deleteUser(username)) {
                    deletedCount++;
                    deletedUsernames.push(username);
                }
            }
        }
        
        if (deletedCount > 0) {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `✅ 访问权限撤销成功

🗑️ 已删除的账户: ${deletedCount} 个
📝 删除的用户名: ${deletedUsernames.join(', ')}

💡 后续操作：
• 您的所有登录凭据已失效
• 播放器将无法继续播放
• 如需重新获取，请使用 /gettoken

🔒 权限撤销操作已完成。`, {}, msg);
        } else {
            await telegramBotManager.sendAutoDeleteMessage(msg.chat.id, `❌ 未找到您的用户信息

可能的原因：
• 您还未获取过访问权限
• 账户已经被删除
• 系统数据异常

💡 请使用 /gettoken 获取新的访问权限。`, {}, msg);
        }
    }
    
    generatePassword() {
        // 生成更安全的密码
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }
    
    generateShortId() {
        // 生成更短但足够唯一的ID
        return Math.random().toString(36).substring(2, 10);
    }
    
    // 检查是否为管理员
    isAdmin(userId) {
        const userIdStr = userId.toString();
        
        // 检查新格式的管理员列表
        if (this.config.adminUserIds?.includes(userIdStr)) {
            return true;
        }
        
        // 兼容旧格式
        if (this.config.adminUserId === userIdStr) {
            return true;
        }
        
        return false;
    }
}

module.exports = CommandHandler; 