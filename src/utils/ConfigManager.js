const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor(configPath = null) {
        this.configPath = configPath || path.join(__dirname, '../../config.json');
        this.config = null;
        this.loadConfig();
    }
    
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                this.config = JSON.parse(configData);
                this.migrateConfig();
                console.log('✅ Configuration loaded successfully');
            } else {
                console.warn('⚠️  Config file not found, using default configuration');
                this.config = this.getDefaultConfig();
            }
        } catch (error) {
            console.error('❌ Error loading config:', error);
            this.config = this.getDefaultConfig();
        }
    }
    
    // 迁移旧配置到新格式
    migrateConfig() {
        if (!this.config.originalServer) {
            return;
        }
        
        // 如果没有 urls 字段，则初始化为空数组
        if (!this.config.originalServer.urls) {
            this.config.originalServer.urls = [];
        }
        
        // 如果有旧的 url 字段且不在 urls 数组中，将其添加到 urls
        if (this.config.originalServer.url && 
            this.config.originalServer.url !== 'http://example.com' &&
            this.config.originalServer.url !== '') {
            
            // 检查是否已存在于 urls 数组中
            const existingUrl = this.config.originalServer.urls.find(
                item => (typeof item === 'string' ? item : item.url) === this.config.originalServer.url
            );
            
            if (!existingUrl) {
                // 将单个 url 转换为数组格式
                this.config.originalServer.urls.push({
                    url: this.config.originalServer.url,
                    name: 'Default Source',
                    enabled: true
                });
                console.log('📝 Migrated single URL to multi-source format');
            }
        }
        
        // 标准化 urls 数组格式
        this.config.originalServer.urls = this.config.originalServer.urls.map((item, index) => {
            if (typeof item === 'string') {
                return {
                    url: item,
                    name: `Source ${index + 1}`,
                    enabled: true
                };
            }
            return {
                url: item.url || '',
                name: item.name || `Source ${index + 1}`,
                enabled: item.enabled !== undefined ? item.enabled : true
            };
        });
    }
    
    getDefaultConfig() {
        return {
            server: {
                port: 8080,
                host: '0.0.0.0'
            },
            originalServer: {
                // 支持单个URL（向后兼容）或多个URL数组
                url: 'http://example.com',
                urls: [],  // 多个订阅源URLs
                m3uPath: '/tv.m3u',
                timeout: 10000,
                autoRefreshInterval: 7200000,
                enableAutoRefresh: true
            },
            telegram: {
                botToken: '',
                groupId: '',
                adminUserId: '',
                adminUserIds: [],
                tokenExpiry: 600000,
                maxTokensPerUser: 2,
                tokenGenerationPeriod: 86400000
            },
            users: {},
            security: {
                connectionTimeout: 60000,
                cleanupInterval: 20000,
                enableLogging: false,
                allowedIPs: [],
                blockedIPs: [],
                enableIPBinding: false,
                redirectTokenExpiry: 7200000,
                maxTokenUsage: 3
            },
            features: {
                enableAdmin: true,
                enableStatus: true,
                enableEPG: true,
                cacheChannels: true,
                channelRefreshInterval: 3600000,
                enableTelegramBot: false,
                filterChannels: {
                    enabled: false,
                    blacklistKeywords: [],
                    whitelistKeywords: []
                }
            },
            playlist: {
                refreshLimitPeriod: 18000000,
                maxRefreshesBeforeExpiry: 6,
                maxSimultaneousPlaylists: 3,
                defaultLinkExpiry: 31536000000,
                enablePersistentStorage: true,
                persistentStorageCleanupInterval: 86400000,
                enablePermanentUsers: false,
                userLinkExpiry: 86400000,
                expiryNotificationHours: [24, 12, 1],
                streamInactiveThreshold: 300000,
                maxHourlyRefreshLimit: 10
            },
            userAgent: {
                enabled: false,
                defaultUserAgent: 'judy/8.8.8',
                channels: {},
                enforceValidation: true,
                fallbackUrl: 'https://smart.pendy.dpdns.org/judy/output.m3u8'
            }
        };
    }
    
    getConfig() {
        return this.config;
    }
    
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.saveConfig();
    }
    
    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            console.log('✅ Configuration saved successfully');
        } catch (error) {
            console.error('❌ Error saving config:', error);
        }
    }
    
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.config;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }
    
    set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let target = this.config;
        
        for (const k of keys) {
            if (!target[k] || typeof target[k] !== 'object') {
                target[k] = {};
            }
            target = target[k];
        }
        
        target[lastKey] = value;
        this.saveConfig();
    }
}

module.exports = ConfigManager; 