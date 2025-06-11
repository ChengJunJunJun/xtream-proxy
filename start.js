#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// PID文件路径
const PID_FILE = path.join(__dirname, '.server.pid');
const LOCK_FILE = path.join(__dirname, '.server.lock');

// 清理函数
function cleanup() {
    try {
        if (fs.existsSync(PID_FILE)) {
            fs.unlinkSync(PID_FILE);
        }
        if (fs.existsSync(LOCK_FILE)) {
            fs.unlinkSync(LOCK_FILE);
        }
    } catch (error) {
        // 忽略清理错误
    }
}

// 检查进程是否仍在运行
function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return false;
    }
}

// 检查是否已有实例在运行
function checkExistingInstance() {
    // 检查锁文件
    if (fs.existsSync(LOCK_FILE)) {
        const lockTime = fs.statSync(LOCK_FILE).mtime.getTime();
        const now = Date.now();
        
        // 如果锁文件超过30秒，认为是僵尸锁
        if (now - lockTime > 30000) {
            console.log('🧹 Found stale lock file, removing...');
            fs.unlinkSync(LOCK_FILE);
        } else {
            console.log('❌ Another instance is starting up. Please wait...');
            process.exit(1);
        }
    }
    
    // 检查PID文件
    if (fs.existsSync(PID_FILE)) {
        try {
            const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
            
            if (isProcessRunning(pid)) {
                console.log(`❌ Server is already running with PID ${pid}`);
                console.log('💡 Use "npm run stop" to stop the existing instance');
                process.exit(1);
            } else {
                console.log('🧹 Found stale PID file, removing...');
                fs.unlinkSync(PID_FILE);
            }
        } catch (error) {
            console.log('🧹 Found invalid PID file, removing...');
            fs.unlinkSync(PID_FILE);
        }
    }
}

// 创建锁文件
function createLockFile() {
    fs.writeFileSync(LOCK_FILE, process.pid.toString());
}

// 移除锁文件
function removeLockFile() {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            fs.unlinkSync(LOCK_FILE);
        }
    } catch (error) {
        // 忽略错误
    }
}

// 主函数
function main() {
    console.log('🚀 Xtream Codes Proxy Launcher');
    console.log('📋 Checking for existing instances...');
    
    // 检查现有实例
    checkExistingInstance();
    
    // 创建锁文件
    createLockFile();
    
    try {
        console.log('🎯 Starting server...');
        
        // 启动服务器
        const child = spawn('node', ['index.js'], {
            stdio: 'inherit',
            cwd: __dirname
        });
        
        // 移除锁文件（启动成功）
        removeLockFile();
        
        // 保存PID
        fs.writeFileSync(PID_FILE, child.pid.toString());
        console.log(`📝 Server started with PID ${child.pid}`);
        
        // 监听子进程事件
        child.on('exit', (code, signal) => {
            console.log(`\n🏁 Server process exited with code ${code} and signal ${signal}`);
            cleanup();
            
            // 如果不是正常退出且不是被信号杀死，可能需要重启
            if (code !== 0 && !signal) {
                console.log('⚠️  Server exited unexpectedly. Check logs for details.');
            }
            
            process.exit(code || 0);
        });
        
        child.on('error', (error) => {
            console.error('❌ Failed to start server:', error.message);
            cleanup();
            process.exit(1);
        });
        
        // 处理启动器的信号
        process.on('SIGINT', () => {
            console.log('\n🛑 Launcher received SIGINT, forwarding to server...');
            child.kill('SIGINT');
        });
        
        process.on('SIGTERM', () => {
            console.log('\n🛑 Launcher received SIGTERM, forwarding to server...');
            child.kill('SIGTERM');
        });
        
        // 清理函数在退出时执行
        process.on('exit', cleanup);
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught exception in launcher:', error);
            cleanup();
            process.exit(1);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        removeLockFile();
        process.exit(1);
    }
}

// 运行主函数
main(); 