const express = require('express');
const router = express.Router();
const axios = require('axios');



module.exports = (userManager, channelManager, securityManager, config) => {
    
    // 处理直播流请求
    router.get('/:username/:password/:streamId', async (req, res) => {
        try {
            const { username, password, streamId } = req.params;
            const clientIP = securityManager.getClientIP(req);
            
            console.log(`📺 Stream request: ${username} -> ${streamId} from ${clientIP}`);
            
            // 验证用户身份
            if (!userManager.authenticateUser(username, password)) {
                console.log(`❌ Authentication failed for user: ${username}`);
                return res.status(401).send('Unauthorized');
            }
            
            // 检查并发限制
            const streamSessionId = userManager.checkStreamConcurrency(username, streamId, clientIP);
            if (!streamSessionId) {
                const maxDevices = config.playlist?.maxSimultaneousPlaylists || 3;
                console.log(`⚠️  Concurrent stream limit exceeded for ${username} (${maxDevices} devices total)`);
                return res.status(429).json({
                    error: 'Concurrent stream limit exceeded',
                    message: `Maximum ${maxDevices} devices can stream simultaneously per user`
                });
            }
            
            // 获取频道信息
            const channel = channelManager.getChannelById(streamId);
            if (!channel) {
                console.log(`❌ Channel not found: ${streamId}`);
                userManager.removeStreamConnection(username, streamId, clientIP);
                return res.status(404).send('Stream not found');
            }
            
            // 验证 User-Agent
            const userAgentManager = channelManager.getUserAgentManager();
            const requestUserAgent = req.headers['user-agent'];
            
            if (!userAgentManager.validateUserAgent(channel.url, requestUserAgent)) {
                console.log(`🚫 User-Agent validation failed for ${username} -> ${channel.url}`);
                console.log(`   Required: ${userAgentManager.getServerUserAgent(channel.url)}`);
                console.log(`   Received: ${requestUserAgent}`);
                userManager.removeStreamConnection(username, streamId, clientIP);
                return res.status(403).json({
                    error: 'Invalid User-Agent',
                    message: 'Your player User-Agent is not authorized for this stream'
                });
            }
            
            console.log(`🔄 Redirecting ${username} to: ${channel.url}`);
            
            // 302重定向到原始流URL
            res.redirect(302, channel.url);
            
        } catch (error) {
            console.error('❌ Stream proxy error:', error);
            res.status(500).send('Internal server error');
        }
    });
    
    // 处理加密的流重定向
    router.get('/encrypted/:token', async (req, res) => {
        // 将变量声明提到外层，确保在catch块中可以访问
        const { token } = req.params;
        const { username } = req.query;
        const clientIP = securityManager.getClientIP(req);
        
        try {
            // 解密token并验证
            const payload = userManager.decryptChannelToken(token, username, clientIP);
            
            if (!payload) {
                console.log(`🚫 ${username || 'Unknown'} 访问被拒绝: Invalid token from ${clientIP}`);
                return res.status(401).json({
                    error: 'Invalid or expired token',
                    message: 'Token has expired or is invalid'
                });
            }
            
            // 检查并发限制
            const streamSessionId = userManager.checkStreamConcurrency(username, payload.channelId, clientIP);
            if (!streamSessionId) {
                const maxDevices = config.playlist?.maxSimultaneousPlaylists || 3;
                console.log(`⚠️  ${username} 并发限制超出 from ${clientIP} (${maxDevices} devices total)`);
                return res.status(429).json({
                    error: 'Concurrent stream limit exceeded', 
                    message: `Maximum ${maxDevices} devices can stream simultaneously per user`
                });
            }
            
            // 验证 User-Agent
            const userAgentManager = channelManager.getUserAgentManager();
            const requestUserAgent = req.headers['user-agent'];
            
            if (!userAgentManager.validateUserAgent(payload.url, requestUserAgent)) {
                console.log(`🚫 User-Agent validation failed for ${username} -> ${payload.url}`);
                console.log(`   Required: ${userAgentManager.getServerUserAgent(payload.url)}`);
                console.log(`   Received: ${requestUserAgent}`);
                userManager.removeStreamConnection(username, payload.channelId, clientIP);
                return res.status(403).json({
                    error: 'Invalid User-Agent',
                    message: 'Your player User-Agent is not authorized for this stream'
                });
            }
            
            // 记录流访问 - 简化日志输出
            console.log(`📺 ${username} -> 频道${payload.channelId} from ${clientIP}`);
            userManager.logger.info(`Stream access: ${username} -> ${payload.channelId} from ${clientIP}`);
            
            // 302重定向到真实的流URL
            res.redirect(302, payload.url);
            
        } catch (error) {
            // 优化错误处理 - 根据错误类型提供简洁的提示
            const errorMessage = error.message || 'Unknown error';
            
            if (errorMessage === 'Token expired') {
                console.log(`⏰ ${username || 'Unknown'} Token已过期 from ${clientIP}`);
                return res.status(401).json({
                    error: 'Token expired',
                    message: 'Please refresh your playlist to get new links'
                });
            }
            
            if (errorMessage === 'User not found') {
                console.log(`🚫 ${username || 'Unknown'} 用户不存在 from ${clientIP}`);
                userManager.logger.warn(`Access denied for non-existent user: ${username} from ${clientIP}`);
                return res.status(403).json({
                    error: 'User not found',
                    message: 'Your account has been removed. Please contact administrator.'
                });
            }
            
            if (errorMessage === 'User disabled') {
                console.log(`🔒 ${username || 'Unknown'} 账户已禁用 from ${clientIP}`);
                userManager.logger.warn(`Access denied for disabled user: ${username} from ${clientIP}`);
                return res.status(403).json({
                    error: 'Account disabled',
                    message: 'Your account has been disabled. Please contact administrator.'
                });
            }
            
            if (errorMessage === 'Invalid username') {
                console.log(`❌ ${username || 'Unknown'} 用户名不匹配 from ${clientIP}`);
                return res.status(401).json({
                    error: 'Invalid username',
                    message: 'Token does not match the provided username'
                });
            }
            
            // 其他未知错误 - 不显示详细堆栈跟踪
            console.log(`❌ ${username || 'Unknown'} Token解密失败: ${errorMessage} from ${clientIP}`);
            userManager.logger.error(`Token decryption failed for user ${username}: ${errorMessage}`);
            
            return res.status(401).json({
                error: 'Invalid token',
                message: 'Token is invalid or malformed'
            });
        }
    });
    
    // 流心跳检测 - 更新活跃状态
    router.post('/heartbeat', async (req, res) => {
        try {
            const { username, channelId } = req.body;
            const clientIP = securityManager.getClientIP(req);
            
            console.log(`💓 Heartbeat: ${username}:${channelId} from ${clientIP}`);
            
            // 更新流活跃状态
            for (const [streamId, stream] of userManager.activeStreams.entries()) {
                if (stream.username === username && 
                    stream.channelId === channelId && 
                    stream.clientIP === clientIP) {
                    stream.lastActivity = Date.now();
                    break;
                }
            }
            
            res.json({ status: 'ok' });
            
        } catch (error) {
            console.error('❌ Heartbeat error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    
    // 流结束通知
    router.post('/stream-end', async (req, res) => {
        try {
            const { username, channelId } = req.body;
            const clientIP = securityManager.getClientIP(req);
            
            console.log(`🛑 Stream ended: ${username}:${channelId} from ${clientIP}`);
            
            // 移除流连接
            userManager.removeStreamConnection(username, channelId, clientIP);
            
            res.json({ status: 'ok' });
            
        } catch (error) {
            console.error('❌ Stream end error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    
    return router;
}; 