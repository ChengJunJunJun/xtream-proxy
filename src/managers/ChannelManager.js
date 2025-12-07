const fs = require('fs');
const path = require('path');
const axios = require('axios');
const UserAgentManager = require('./UserAgentManager');

class ChannelManager {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        
        // 初始化 UserAgentManager
        this.userAgentManager = new UserAgentManager(config, logger);
        
        this.channels = [];
        this.categories = [];
        this.lastRefresh = 0;
        this.lastRefreshDiff = null;
        this.sourceStats = {}; // 记录每个源的统计信息
        
        // 数据文件路径
        this.dataDir = path.join(__dirname, '../../data');
        this.channelsFile = path.join(this.dataDir, 'channels.json');
        
        this.ensureDataDirectory();
    }
    
    ensureDataDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }
    
    async initialize() {
        await this.loadChannels();
        this.logger.info('✅ ChannelManager initialized');
    }
    
    async loadChannels() {
        try {
            // 获取所有有效的订阅源
            const sources = this.getEnabledSources();
            
            if (sources.length > 0) {
                // 如果有有效URL，优先从服务器刷新
                await this.refreshChannels();
                return;
            }
            
            // 如果没有有效URL，尝试从缓存加载
            if (this.config.features.cacheChannels && fs.existsSync(this.channelsFile)) {
                const cacheData = JSON.parse(fs.readFileSync(this.channelsFile, 'utf8'));
                const cacheAge = Date.now() - cacheData.timestamp;
                const maxCacheAge = this.config.features.channelRefreshInterval || 3600000;
                
                if (cacheAge < maxCacheAge) {
                    this.channels = cacheData.channels || [];
                    this.categories = cacheData.categories || [];
                    this.lastRefresh = cacheData.timestamp;
                    this.sourceStats = cacheData.sourceStats || {};
                    this.logger.info(`Loaded ${this.channels.length} channels from cache`);
                    return;
                }
            }
            
            // 如果没有缓存或缓存过期，创建示例频道
            this.createSampleChannels();
            
        } catch (error) {
            this.logger.error('Error loading channels:', error);
            this.createSampleChannels();
        }
    }
    
    // 获取所有启用的订阅源
    getEnabledSources() {
        const sources = [];
        
        // 检查新格式的 urls 数组
        if (this.config.originalServer?.urls && Array.isArray(this.config.originalServer.urls)) {
            this.config.originalServer.urls.forEach((source, index) => {
                if (source.enabled !== false && source.url && source.url !== 'http://example.com') {
                    sources.push({
                        id: `source_${index}`,
                        url: source.url,
                        name: source.name || `Source ${index + 1}`,
                        enabled: true
                    });
                }
            });
        }
        
        // 向后兼容：检查旧格式的单个 url
        if (sources.length === 0 && this.config.originalServer?.url && 
            this.config.originalServer.url !== 'http://example.com' &&
            this.config.originalServer.url !== '') {
            sources.push({
                id: 'source_0',
                url: this.config.originalServer.url,
                name: 'Default Source',
                enabled: true
            });
        }
        
        return sources;
    }
    
    async refreshChannels() {
        try {
            this.logger.info('Refreshing channels from original servers...');
            // 在刷新前保留旧频道用于对比
            const previousChannels = Array.isArray(this.channels) ? [...this.channels] : [];

            const sources = this.getEnabledSources();
            
            if (sources.length === 0) {
                this.logger.warn('No enabled sources found');
                this.createSampleChannels();
                return;
            }

            // 从所有源并行加载频道
            const allChannels = [];
            const allCategories = new Set();
            this.sourceStats = {};
            let nextChannelId = 1;

            // 使用 Promise.allSettled 来处理多个源，即使有些失败也继续
            const results = await Promise.allSettled(
                sources.map(source => this.fetchChannelsFromSource(source))
            );

            results.forEach((result, index) => {
                const source = sources[index];
                
                if (result.status === 'fulfilled' && result.value) {
                    const { channels, categories } = result.value;
                    
                    // 为每个频道分配唯一ID并标记来源
                    channels.forEach(channel => {
                        channel.id = nextChannelId++;
                        channel.sourceId = source.id;
                        channel.sourceName = source.name;
                        allChannels.push(channel);
                    });
                    
                    // 合并分类
                    categories.forEach(cat => allCategories.add(cat));
                    
                    // 记录源统计
                    this.sourceStats[source.id] = {
                        name: source.name,
                        url: source.url,
                        channelCount: channels.length,
                        categoryCount: categories.length,
                        lastRefresh: Date.now(),
                        status: 'success'
                    };
                    
                    this.logger.success(`✅ Loaded ${channels.length} channels from ${source.name}`);
                } else {
                    // 记录失败的源
                    this.sourceStats[source.id] = {
                        name: source.name,
                        url: source.url,
                        channelCount: 0,
                        categoryCount: 0,
                        lastRefresh: Date.now(),
                        status: 'failed',
                        error: result.reason?.message || 'Unknown error'
                    };
                    
                    this.logger.error(`❌ Failed to load from ${source.name}: ${result.reason?.message}`);
                }
            });

            if (allChannels.length === 0) {
                this.logger.warn('No channels loaded from any source');
                if (previousChannels.length > 0) {
                    this.logger.info('Keeping previous channels');
                    return;
                }
                this.createSampleChannels();
                return;
            }

            this.channels = allChannels;
            this.categories = Array.from(allCategories).sort();
            this.lastRefresh = Date.now();

            // 计算刷新前后的差异
            this.lastRefreshDiff = this.computeChannelDiff(previousChannels, this.channels);
            
            // 应用频道过滤
            if (this.config.features.filterChannels?.enabled) {
                this.applyChannelFilters();
            }
            
            // 缓存频道数据
            if (this.config.features.cacheChannels) {
                this.saveChannelsToCache();
            }
            
            this.logger.success(`✅ Successfully loaded ${this.channels.length} channels from ${sources.length} source(s), ${this.categories.length} categories`);
            if (this.lastRefreshDiff) {
                const { added, removed, updated, unchanged } = this.lastRefreshDiff;
                this.logger.info(`Channel diff - added: ${added.length}, removed: ${removed.length}, updated: ${updated.length}, unchanged: ${unchanged.length}`);
            }
        } catch (error) {
            this.logger.error('Error refreshing channels:', error);
            
            // 如果没有缓存的频道，创建示例频道
            if (this.channels.length === 0) {
                this.createSampleChannels();
            }
        }
    }

    // 从单个源获取频道
    async fetchChannelsFromSource(source) {
        try {
            const fullUrl = `${source.url}${this.config.originalServer.m3uPath || ''}`;
            
            this.logger.info(`Fetching from ${source.name}: ${fullUrl}`);
            
            const response = await axios.get(fullUrl, {
                timeout: this.config.originalServer.timeout || 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const channelData = this.parseM3UContent(response.data);
            return channelData;
        } catch (error) {
            this.logger.error(`Error fetching from ${source.name}:`, error.message);
            throw error;
        }
    }

    // 计算频道差异（基于名称或tvgId作为键，比较URL是否变化）
    computeChannelDiff(previousChannels, newChannels) {
        const toKey = (c) => (c && (c.tvgId || c.name || '').toString().toLowerCase());
        const prevMap = new Map();
        const newMap = new Map();
        const added = [];
        const removed = [];
        const updated = [];
        const unchanged = [];

        for (const c of previousChannels || []) {
            const key = toKey(c);
            if (key) prevMap.set(key, c);
        }
        for (const c of newChannels || []) {
            const key = toKey(c);
            if (key) newMap.set(key, c);
        }

        // 检查新增和更新/未变
        for (const [key, newC] of newMap.entries()) {
            if (!prevMap.has(key)) {
                added.push(newC);
            } else {
                const prevC = prevMap.get(key);
                if ((prevC.url || '') !== (newC.url || '')) {
                    updated.push({ before: prevC, after: newC });
                } else {
                    unchanged.push(newC);
                }
            }
        }

        // 检查移除
        for (const [key, prevC] of prevMap.entries()) {
            if (!newMap.has(key)) {
                removed.push(prevC);
            }
        }

        return { added, removed, updated, unchanged };
    }
    
    parseM3UContent(content) {
        const lines = content.split('\n');
        const channels = [];
        const categories = new Set();
        
        let currentChannel = null;
        let kodiProps = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                // 如果有上一个频道还没有URL，先清理
                if (currentChannel) {
                    kodiProps = [];
                }
                currentChannel = this.parseExtinfLine(line);
                if (currentChannel.category) {
                    categories.add(currentChannel.category);
                }
                // 重置KODIPROP收集
                kodiProps = [];
            } else if (line.startsWith('#KODIPROP:')) {
                // 收集KODIPROP指令
                if (currentChannel) {
                    kodiProps.push(line);
                }
            } else if (line.startsWith('#EXTVLCOPT:')) {
                // 支持EXTVLCOPT指令（类似KODIPROP）
                if (currentChannel) {
                    kodiProps.push(line);
                }
            } else if (line && !line.startsWith('#') && currentChannel) {
                // 这是频道URL
                currentChannel.url = line;
                currentChannel.id = channels.length + 1;
                // 保存KODIPROP指令（如果有）
                if (kodiProps.length > 0) {
                    currentChannel.kodiProps = [...kodiProps];
                }
                channels.push(currentChannel);
                currentChannel = null;
                kodiProps = [];
            }
        }
        
        return {
            channels,
            categories: Array.from(categories).sort()
        };
    }
    
    parseExtinfLine(line) {
        const channel = {
            name: '',
            logo: '',
            category: '',
            tvgId: '',
            tvgName: ''
        };
        
        // 提取频道名称并清理其中的属性信息
        const nameMatch = line.match(/,(.+)$/);
        if (nameMatch) {
            let channelName = nameMatch[1].trim();
            
            // 清理频道名称中的属性信息
            // 移除 tvg-* 属性
            channelName = channelName.replace(/tvg-[a-zA-Z]+=["'][^"']*["']/g, '').trim();
            // 移除 group-title 属性
            channelName = channelName.replace(/group-title=["'][^"']*["']/g, '').trim();
            // 移除开头的 -1 或其他数字标识
            channelName = channelName.replace(/^-?\d+\s+/, '').trim();
            // 移除多余的逗号、空格和特殊字符
            channelName = channelName.replace(/^[,\s-]+|[,\s-]+$/g, '').trim();
            // 如果名称为空或只是逗号，使用默认名称
            if (!channelName || channelName === ',') {
                channelName = `Channel ${Math.random().toString(36).substring(7)}`;
            }
            
            channel.name = channelName;
        }
        
        // 提取属性
        const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
        if (tvgIdMatch) {
            channel.tvgId = tvgIdMatch[1];
        }
        
        const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
        if (tvgNameMatch) {
            channel.tvgName = tvgNameMatch[1];
        }
        
        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
        if (logoMatch) {
            channel.logo = logoMatch[1];
        }
        
        // 修复：只取第一个group-title属性
        // 使用非贪婪匹配，确保只获取第一个group-title
        const categoryMatch = line.match(/group-title="([^"]*?)"/);
        if (categoryMatch) {
            channel.category = categoryMatch[1];
        }
        
        return channel;
    }
    
    applyChannelFilters() {
        const filters = this.config.features.filterChannels;
        let filteredChannels = [...this.channels];
        
        // 应用黑名单过滤
        if (filters.blacklistKeywords?.length > 0) {
            filteredChannels = filteredChannels.filter(channel => {
                return !filters.blacklistKeywords.some(keyword => 
                    channel.name.toLowerCase().includes(keyword.toLowerCase())
                );
            });
        }
        
        // 应用白名单过滤
        if (filters.whitelistKeywords?.length > 0) {
            filteredChannels = filteredChannels.filter(channel => {
                return filters.whitelistKeywords.some(keyword => 
                    channel.name.toLowerCase().includes(keyword.toLowerCase())
                );
            });
        }
        
        const originalCount = this.channels.length;
        this.channels = filteredChannels;
        
        this.logger.info(`Channel filtering: ${originalCount} -> ${this.channels.length} channels`);
    }
    
    saveChannelsToCache() {
        try {
            const cacheData = {
                channels: this.channels,
                categories: this.categories,
                timestamp: this.lastRefresh,
                sourceStats: this.sourceStats
            };
            
            fs.writeFileSync(this.channelsFile, JSON.stringify(cacheData, null, 2));
            this.logger.debug('Channels cached successfully');
        } catch (error) {
            this.logger.error('Error saving channels to cache:', error);
        }
    }
    
    createSampleChannels() {
        this.logger.warn('Creating sample channels as fallback');
        
        this.channels = [
            {
                id: 1,
                name: 'Sample Channel 1',
                category: 'General',
                logo: '',
                tvgId: 'sample1',
                tvgName: 'Sample Channel 1',
                url: 'http://example.com/stream1.m3u8',
                sourceId: 'sample_source',
                sourceName: 'Sample Source'
            },
            {
                id: 2,
                name: 'Sample Channel 2',
                category: 'General',
                logo: '',
                tvgId: 'sample2',
                tvgName: 'Sample Channel 2',
                url: 'http://example.com/stream2.m3u8',
                sourceId: 'sample_source',
                sourceName: 'Sample Source'
            }
        ];
        
        this.categories = ['General'];
        this.lastRefresh = Date.now();
        this.sourceStats = {
            'sample_source': {
                name: 'Sample Source',
                url: 'http://example.com',
                channelCount: 2,
                categoryCount: 1,
                lastRefresh: Date.now(),
                status: 'success'
            }
        };
    }
    
    getChannels(categoryFilter = null) {
        if (categoryFilter) {
            return this.channels.filter(channel => channel.category === categoryFilter);
        }
        return this.channels;
    }
    
    getChannelById(id) {
        return this.channels.find(channel => channel.id === parseInt(id));
    }
    
    getCategories() {
        return this.categories;
    }
    
    getChannelCount() {
        return this.channels.length;
    }
    
    getCategoryCount() {
        return this.categories.length;
    }
    
    async generateXMLTV() {
        let xmltv = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmltv += '<!DOCTYPE tv SYSTEM "xmltv.dtd">\n';
        xmltv += '<tv generator-info-name="Xtream Codes Proxy">\n';
        
        // 添加频道信息
        this.channels.forEach(channel => {
            xmltv += `  <channel id="${channel.tvgId || channel.id}">\n`;
            xmltv += `    <display-name>${this.escapeXml(channel.name)}</display-name>\n`;
            if (channel.logo) {
                xmltv += `    <icon src="${this.escapeXml(channel.logo)}" />\n`;
            }
            xmltv += '  </channel>\n';
        });
        
        xmltv += '</tv>\n';
        return xmltv;
    }
    
    escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    
    getChannelsForUser(username) {
        // 这里可以根据用户权限返回不同的频道列表
        // 目前返回所有频道
        return this.channels;
    }

    getLastRefreshDiff() {
        return this.lastRefreshDiff;
    }
    
    getUserAgentManager() {
        return this.userAgentManager;
    }
    
    updateConfig(newConfig) {
        this.config = newConfig;
        // 同时更新 UserAgentManager 的配置
        this.userAgentManager.updateConfig(newConfig);
        this.logger.info('ChannelManager configuration updated');
    }

    getServerInfo() {
        const sources = this.getEnabledSources();
        
        return {
            url: this.config.originalServer.url, // 向后兼容
            sources: sources,
            sourceStats: this.sourceStats,
            lastRefresh: this.lastRefresh,
            channelCount: this.channels.length,
            categoryCount: this.categories.length,
            autoRefresh: this.config.originalServer.enableAutoRefresh
        };
    }
    
    async gracefulShutdown() {
        if (this.config.features.cacheChannels) {
            this.saveChannelsToCache();
        }
        this.logger.info('✅ ChannelManager shutdown completed');
    }
}

module.exports = ChannelManager; 