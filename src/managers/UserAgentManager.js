const fs = require('fs');
const path = require('path');
const { URL } = require('url');

class UserAgentManager {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        
        // 数据文件路径
        this.dataDir = path.join(__dirname, '../../data');
        this.userAgentFile = path.join(this.dataDir, 'user-agents.json');
        
        // User-Agent 设置
        this.userAgents = {};
        
        this.ensureDataDirectory();
        this.loadUserAgents();
    }
    
    ensureDataDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }
    
    loadUserAgents() {
        try {
            if (fs.existsSync(this.userAgentFile)) {
                const data = fs.readFileSync(this.userAgentFile, 'utf8');
                this.userAgents = JSON.parse(data);
                this.logger.info(`Loaded ${Object.keys(this.userAgents).length} User-Agent configurations`);
            } else {
                this.userAgents = {};
                this.logger.info('No User-Agent configuration file found, starting with empty configuration');
            }
        } catch (error) {
            this.logger.error('Error loading User-Agent configurations:', error);
            this.userAgents = {};
        }
    }
    
    saveUserAgents() {
        try {
            fs.writeFileSync(this.userAgentFile, JSON.stringify(this.userAgents, null, 2));
            this.logger.debug('User-Agent configurations saved successfully');
        } catch (error) {
            this.logger.error('Error saving User-Agent configurations:', error);
        }
    }
    
    /**
     * 获取服务器域名
     * @param {string} url - 完整的URL或域名
     * @returns {string} 服务器域名
     */
    getServerDomain(url) {
        try {
            // 如果是完整的URL，提取域名
            if (url.startsWith('http://') || url.startsWith('https://')) {
                const parsedUrl = new URL(url);
                return parsedUrl.hostname;
            }
            // 如果是域名，直接返回
            return url;
        } catch (error) {
            this.logger.warn(`Invalid URL format: ${url}`);
            return url;
        }
    }
    
    /**
     * 为服务器设置 User-Agent
     * @param {string} serverUrl - 服务器URL
     * @param {string} userAgent - User-Agent 字符串
     */
    setServerUserAgent(serverUrl, userAgent) {
        const domain = this.getServerDomain(serverUrl);
        this.userAgents[domain] = {
            userAgent: userAgent,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.saveUserAgents();
        this.logger.info(`Set User-Agent for server ${domain}: ${userAgent}`);
    }
    
    /**
     * 获取服务器的 User-Agent
     * @param {string} serverUrl - 服务器URL
     * @returns {string|null} User-Agent 字符串或null
     */
    getServerUserAgent(serverUrl) {
        const domain = this.getServerDomain(serverUrl);
        const config = this.userAgents[domain];
        
        if (config) {
            return config.userAgent;
        }
        
        // 如果没有为特定服务器设置，返回默认 User-Agent
        if (this.config.userAgent?.enabled && this.config.userAgent?.defaultUserAgent) {
            return this.config.userAgent.defaultUserAgent;
        }
        
        return null;
    }
    
    /**
     * 删除服务器的 User-Agent 设置
     * @param {string} serverUrl - 服务器URL
     * @returns {boolean} 是否成功删除
     */
    removeServerUserAgent(serverUrl) {
        const domain = this.getServerDomain(serverUrl);
        if (this.userAgents[domain]) {
            delete this.userAgents[domain];
            this.saveUserAgents();
            this.logger.info(`Removed User-Agent setting for server ${domain}`);
            return true;
        }
        return false;
    }
    
    /**
     * 获取所有服务器的 User-Agent 设置
     * @returns {Object} 所有服务器的 User-Agent 设置
     */
    getAllServerUserAgents() {
        return { ...this.userAgents };
    }
    
    /**
     * 验证请求的 User-Agent
     * @param {string} channelUrl - 频道URL
     * @param {string} requestUserAgent - 请求中的 User-Agent
     * @returns {Object} 验证结果 {valid: boolean, fallbackUrl?: string}
     */
    validateUserAgent(channelUrl, requestUserAgent) {
        // 如果功能未启用，始终通过验证
        if (!this.config.userAgent?.enabled) {
            return { valid: true };
        }
        
        const requiredUserAgent = this.getServerUserAgent(channelUrl);
        
        // 如果没有设置 User-Agent 要求，通过验证
        if (!requiredUserAgent) {
            return { valid: true };
        }
        
        // 检查请求的 User-Agent 是否匹配
        const isValid = requestUserAgent === requiredUserAgent;
        
        if (!isValid && this.config.userAgent?.fallbackUrl) {
            return { 
                valid: false, 
                fallbackUrl: this.config.userAgent.fallbackUrl 
            };
        }
        
        return { valid: isValid };
    }
    
    /**
     * 获取回退URL
     * @returns {string|null} 回退URL
     */
    getFallbackUrl() {
        return this.config.userAgent?.fallbackUrl || null;
    }
    
    /**
     * 设置回退URL
     * @param {string} url - 回退URL
     */
    setFallbackUrl(url) {
        if (!this.config.userAgent) {
            this.config.userAgent = {};
        }
        this.config.userAgent.fallbackUrl = url;
        this.logger.info(`Set fallback URL: ${url}`);
    }
    
    /**
     * 更新配置
     * @param {Object} newConfig - 新的配置
     */
    updateConfig(newConfig) {
        this.config = newConfig;
    }
    
    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            enabled: this.config.userAgent?.enabled || false,
            defaultUserAgent: this.config.userAgent?.defaultUserAgent || 'Not set',
            fallbackUrl: this.config.userAgent?.fallbackUrl || 'Not set',
            serverCount: Object.keys(this.userAgents).length,
            servers: Object.keys(this.userAgents)
        };
    }
    
    /**
     * 清理过期或无效的配置
     */
    cleanup() {
        // 这里可以添加清理逻辑，比如删除长时间未使用的配置
        this.logger.info('UserAgentManager cleanup completed');
    }
}

module.exports = UserAgentManager; 