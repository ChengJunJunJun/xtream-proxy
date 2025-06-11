#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// PID文件路径
const PID_FILE = path.join(__dirname, '.server.pid');
const LOCK_FILE = path.join(__dirname, '.server.lock');

// 检查进程是否仍在运行
function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return false;
    }
}

// 清理文件
function cleanup() {
    try {
        if (fs.existsSync(PID_FILE)) {
            fs.unlinkSync(PID_FILE);
            console.log('🧹 Removed PID file');
        }
        if (fs.existsSync(LOCK_FILE)) {
            fs.unlinkSync(LOCK_FILE);
            console.log('🧹 Removed lock file');
        }
    } catch (error) {
        console.warn('⚠️  Error during cleanup:', error.message);
    }
}

// 主函数
function main() {
    console.log('🛑 Xtream Codes Proxy Stopper');
    
    // 检查PID文件
    if (!fs.existsSync(PID_FILE)) {
        console.log('❌ No PID file found. Server may not be running.');
        cleanup(); // 清理可能存在的锁文件
        process.exit(1);
    }
    
    try {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
        
        if (!isProcessRunning(pid)) {
            console.log(`❌ Process ${pid} is not running. Cleaning up...`);
            cleanup();
            process.exit(1);
        }
        
        console.log(`📝 Found server process with PID ${pid}`);
        console.log('🛑 Sending SIGTERM signal...');
        
        // 发送SIGTERM信号
        process.kill(pid, 'SIGTERM');
        
        // 等待进程退出
        const maxWaitTime = 10000; // 10秒
        const checkInterval = 500; // 500ms
        let waitTime = 0;
        
        const checkExit = setInterval(() => {
            waitTime += checkInterval;
            
            if (!isProcessRunning(pid)) {
                clearInterval(checkExit);
                console.log('✅ Server stopped gracefully');
                cleanup();
                process.exit(0);
            }
            
            if (waitTime >= maxWaitTime) {
                clearInterval(checkExit);
                console.log('⚠️  Server did not exit gracefully, sending SIGKILL...');
                
                try {
                    process.kill(pid, 'SIGKILL');
                    console.log('💀 Forcefully killed server process');
                } catch (error) {
                    console.log('❌ Failed to kill process:', error.message);
                }
                
                cleanup();
                process.exit(1);
            }
        }, checkInterval);
        
    } catch (error) {
        console.error('❌ Error reading PID file:', error.message);
        cleanup();
        process.exit(1);
    }
}

// 运行主函数
main(); 