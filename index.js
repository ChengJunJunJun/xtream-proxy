// 安全的TLS配置
const tls = require('tls');
const crypto = require('crypto');

// 设置默认的TLS选项（更安全的方式）
tls.DEFAULT_ECDH_CURVE = 'auto';
tls.DEFAULT_MIN_VERSION = 'TLSv1.2';
tls.DEFAULT_MAX_VERSION = 'TLSv1.3';

// 只在开发环境中禁用TLS验证
if (process.env.NODE_ENV === 'development') {
    console.log('⚠️  Development mode: TLS certificate verification disabled');
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
}

const XtreamCodesProxy = require('./src/app');

// 防止多重启动
let isStarting = false;
let hasStarted = false;

async function main() {
    // 防止重复启动
    if (isStarting || hasStarted) {
        console.log('⚠️  Application is already starting or has started. Exiting...');
        return;
    }
    
    isStarting = true;
    
    try {
        console.log('🚀 Starting Xtream Codes Proxy Server...');
        console.log('📋 Environment:', process.env.NODE_ENV || 'production');
        console.log('📋 Node.js version:', process.version);
        console.log('📋 Platform:', process.platform);
        console.log('📋 Process ID:', process.pid);
        
        const app = new XtreamCodesProxy();
        await app.start();
        
        hasStarted = true;
        isStarting = false;
        
        console.log('✅ Server started successfully!');
        
        // 防止重复添加监听器
        let shutdownInProgress = false;
        
        const gracefulShutdown = async () => {
            if (shutdownInProgress) {
                console.log('⚠️  Shutdown already in progress...');
                return;
            }
            shutdownInProgress = true;
            console.log('\n🛑 Shutting down gracefully...');
            try {
                await app.gracefulShutdown();
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };
        
        // 优雅关闭处理
        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);
        
    } catch (error) {
        console.error('❌ Failed to start application:', error.message);
        
        // 如果是端口占用错误，不退出进程，让其他实例继续运行
        if (error.message.includes('Port') && error.message.includes('already in use')) {
            console.log('💡 Another instance appears to be running. This instance will exit.');
            process.exit(0);
        } else {
            process.exit(1);
        }
    } finally {
        isStarting = false;
    }
}

main();