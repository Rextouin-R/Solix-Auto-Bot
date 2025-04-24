require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

const BASE_URL = 'https://api.solixdepin.net/api';
const LOGIN_URL = `${BASE_URL}/auth/login-password`;
const TASKS_URL = `${BASE_URL}/task/get-user-task`;
const CLAIM_TASK_URL = `${BASE_URL}/task/claim-task`;
const TOTAL_POINT_URL = `${BASE_URL}/point/get-total-point`;

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const WHITE = "\x1b[37m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";

let isRunning = true;
let accountIndex = 0;
let accounts = [];
let proxies = [];

function printBanner() {
    console.log(`${CYAN}----------------------------------------${RESET}`);
    console.log(`${CYAN}  Solix Force Auto Task - Airdrop Insiders  ${RESET}`);
    console.log(`${CYAN}----------------------------------------${RESET}`);
}

function loadAccounts() {
    const envVars = Object.keys(process.env);
    const emailKeys = envVars.filter(key => key.startsWith('SOLIX_EMAIL_'));
    const accountNumbers = emailKeys.map(key => key.replace('SOLIX_EMAIL_', ''));
    
    if (accountNumbers.length === 0) {
        if (process.env.SOLIX_EMAIL && process.env.SOLIX_PASSWORD) {
            accounts.push({
                email: process.env.SOLIX_EMAIL,
                password: process.env.SOLIX_PASSWORD,
                label: "Default Account",
                token: null,
                userInfo: null
            });
            console.log(`${YELLOW}ℹ️ Loaded 1 account using legacy SOLIX_EMAIL/SOLIX_PASSWORD format${RESET}`);
            return true;
        }
        console.error(`${RED}❌ No accounts found in .env file!${RESET}`);
        console.log(`${YELLOW}ℹ️ Please add accounts in format SOLIX_EMAIL_1, SOLIX_PASSWORD_1, etc.${RESET}`);
        return false;
    }

    accountNumbers.forEach(num => {
        const email = process.env[`SOLIX_EMAIL_${num}`];
        const password = process.env[`SOLIX_PASSWORD_${num}`];
        const label = process.env[`SOLIX_LABEL_${num}`] || `Account${num}`;
        
        if (email && password) {
            accounts.push({
                email,
                password,
                label,
                token: null,
                userInfo: null
            });
        } else {
            console.log(`${YELLOW}⚠️ Skipping incomplete account #${num}${RESET}`);
        }
    });

    console.log(`${GREEN}✅ Loaded ${accounts.length} accounts from .env${RESET}`);
    return accounts.length > 0;
}

function loadProxies() {
    try {
        if (!fs.existsSync('proxies.txt')) {
            console.log(`${YELLOW}⚠️ proxies.txt not found, will run without proxies${RESET}`);
            return;
        }

        const proxyContent = fs.readFileSync('proxies.txt', 'utf8');
        const proxyLines = proxyContent.split('\n').filter(line => line.trim() !== '');
        
        proxyLines.forEach(line => {
            proxies.push(line.trim());
        });

        console.log(`${GREEN}✅ Loaded ${proxies.length} proxies from proxies.txt${RESET}`);
    } catch (error) {
        console.error(`${RED}❌ Error loading proxies: ${error.message}${RESET}`);
    }
}

function getProxy(index) {
    if (proxies.length === 0) return null;
    const proxyIndex = index % proxies.length;
    return proxies[proxyIndex];
}

function createAxiosInstance(accountIndex) {
    const config = {
        headers: {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.5',
            'content-type': 'application/json',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'Referer': 'https://dashboard.solixdepin.net/',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
    };

    const proxyString = getProxy(accountIndex);
    if (proxyString) {
        try {
            let formattedProxy;

            let cleanProxyString = proxyString;
            if (cleanProxyString.startsWith('http://')) {
                cleanProxyString = cleanProxyString.substring(7);
            } else if (cleanProxyString.startsWith('https://')) {
                cleanProxyString = cleanProxyString.substring(8);
            }
            
            if (cleanProxyString.includes('@')) {
                formattedProxy = `http://${cleanProxyString}`;
            }
            else if (cleanProxyString.split(':').length === 4) {
                const parts = cleanProxyString.split(':');
                formattedProxy = `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
            }
            else {
                formattedProxy = `http://${cleanProxyString}`;
            }

            const agent = new HttpsProxyAgent(formattedProxy);
            config.httpsAgent = agent;
            config.proxy = false; 
            
            console.log(`${CYAN}🔌 Using proxy: ${formattedProxy}${RESET}`);
        } catch (error) {
            console.error(`${RED}❌ Error configuring proxy: ${error.message}${RESET}`);
            console.log(`${YELLOW}⚠️ Continuing without proxy for this request${RESET}`);
        }
    }

    return axios.create(config);
}

async function login(accountIndex) {
    const account = accounts[accountIndex];
    const axiosInstance = createAxiosInstance(accountIndex);
    
    try {
        console.log(`\n${CYAN}==================== LOGIN ====================${RESET}`);
        console.log(`${YELLOW}🔑 Logging in ${account.label}: ${account.email}${RESET}`);
        
        const response = await axiosInstance.post(LOGIN_URL, {
            email: account.email,
            password: account.password
        });
        
        if (response.data && response.data.result === 'success' && response.data.data.accessToken) {
            account.token = response.data.data.accessToken;
            account.userInfo = response.data.data.user;
            
            console.log(`${GREEN}✅ Login successful${RESET}`);
            console.log(`${GREEN}👤 User Info:${RESET}`);
            console.log(`${WHITE}   • Label: ${account.label}${RESET}`);
            console.log(`${WHITE}   • User ID: ${account.userInfo._id}${RESET}`);
            console.log(`${WHITE}   • Email: ${account.userInfo.email}${RESET}`);
            console.log(`${WHITE}   • Referral Code: ${account.userInfo.referralCode}${RESET}`);
            if (account.userInfo.referrerId) {
                console.log(`${WHITE}   • Referrer ID: ${account.userInfo.referrerId}${RESET}`);
            }

            try {
                const payload = JSON.parse(Buffer.from(account.token.split('.')[1], 'base64').toString());
                const expiryDate = new Date(payload.exp * 1000);
                console.log(`${YELLOW}🕒 Token expires: ${expiryDate.toLocaleString()}${RESET}`);
            } catch (e) {
                console.log(`${YELLOW}⚠️ Could not parse token expiry: ${e.message}${RESET}`);
            }
            console.log(`${CYAN}===============================================${RESET}`);
            return true;
        } else {
            console.error(`${RED}Login response:${RESET}`, response.data);
            throw new Error('Login failed - Invalid response format');
        }
    } catch (error) {
        console.error(`${RED}❌ Login failed for ${account.label}: ${error.message}${RESET}`);
        if (error.response) {
            console.error(`${RED}Error details:${RESET}`, error.response.data);
        }
        return false;
    }
}

async function getTasks(accountIndex) {
    const account = accounts[accountIndex];
    const axiosInstance = createAxiosInstance(accountIndex);
    
    try {
        const response = await axiosInstance.get(TASKS_URL, {
            headers: {
                ...axiosInstance.defaults.headers,
                'authorization': `Bearer ${account.token}`
            }
        });
        
        return response.data.data || [];
    } catch (error) {
        console.error(`${RED}❌ Error fetching tasks: ${error.message}${RESET}`);
        throw error;
    }
}

async function claimTask(accountIndex, taskId) {
    const account = accounts[accountIndex];
    const axiosInstance = createAxiosInstance(accountIndex);
    
    try {
        const response = await axiosInstance.post(CLAIM_TASK_URL, {
            taskId: taskId
        }, {
            headers: {
                ...axiosInstance.defaults.headers,
                'authorization': `Bearer ${account.token}`
            }
        });
        
        if (response.data && response.data.result === 'success') {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        if (error.response && error.response.status !== 400) {
            console.error(`${RED}❌ Unexpected error claiming task ${taskId}: ${error.message}${RESET}`);
        }
        return false;
    }
}

async function getTotalPoints(accountIndex, showDetailedInfo = false) {
    const account = accounts[accountIndex];
    const axiosInstance = createAxiosInstance(accountIndex);
    
    try {
        const response = await axiosInstance.get(TOTAL_POINT_URL, {
            headers: {
                ...axiosInstance.defaults.headers,
                'authorization': `Bearer ${account.token}`
            }
        });
        
        if (response.data && response.data.result === 'success' && response.data.data) {
            const pointsData = response.data.data;
            
            if (showDetailedInfo) {
                console.log(`\n${GREEN}💰 Points Information for ${account.label}:${RESET}`);
                console.log(`${WHITE}   • Total Points: ${pointsData.total.toFixed(2)}${RESET}`);
                console.log(`${WHITE}   • 🌟 Total Earning Points: ${pointsData.totalEarningPoint.toFixed(2)}${RESET}`);
                console.log(`${WHITE}   • 🔌 Internet Points: ${pointsData.totalPointInternet.toFixed(2)}${RESET}`);
                console.log(`${WHITE}   • ✅ Task Points: ${pointsData.totalPointTask.toFixed(2)}${RESET}`);
                console.log(`${WHITE}   • 👥 Referral Points: ${pointsData.totalPointReferral.toFixed(2)}${RESET}`);
                console.log(`${WHITE}   • 🎁 Bonus Points: ${pointsData.totalPointBonus.toFixed(2)}${RESET}`);
                console.log(`${WHITE}   • 📅 Today's Points: ${pointsData.todayPointEarned.toFixed(2)}${RESET}`);
            } else {
                console.log(`${WHITE}💰 ${account.label}: ${pointsData.total.toFixed(2)} points (Today: ${pointsData.todayPointEarned.toFixed(2)})${RESET}`);
            }
            
            return pointsData;
        }
        console.log(`${YELLOW}⚠️ Invalid points data structure${RESET}`);
        return null;
    } catch (error) {
        console.error(`${RED}❌ Error fetching total points: ${error.message}${RESET}`);
        if (error.response) {
            console.error(`${RED}Error details:${RESET}`, error.response.data);
        }
        return null;
    }
}

async function forceClaimAllTasks(accountIndex) {
    const account = accounts[accountIndex];
    
    try {
        console.log(`${YELLOW}📋 Getting tasks for ${account.label}...${RESET}`);

        const tasks = await getTasks(accountIndex);
        if (!tasks || tasks.length === 0) {
            console.log(`${WHITE}ℹ️ No tasks found for ${account.label}${RESET}`);
            return;
        }
        
        console.log(`${GREEN}📝 Found ${tasks.length} tasks for ${account.label}${RESET}`);

        const idleTasks = tasks.filter(task => task.status === 'idle');
        const pendingTasks = tasks.filter(task => task.status === 'pending');
        const claimedTasks = tasks.filter(task => task.status === 'claimed');
        
        console.log(`${WHITE}📊 Task Status: ${GREEN}${claimedTasks.length} claimed${RESET}, ${YELLOW}${pendingTasks.length} pending${RESET}, ${CYAN}${idleTasks.length} idle${RESET}`);

        console.log(`${GREEN}🔄 Force claiming ALL ${tasks.length} tasks${RESET}`);
        
        let successCount = 0;
        let failedCount = 0;

        for (const task of tasks) {
            let statusColor = task.status === 'claimed' ? GREEN : 
                             (task.status === 'pending' ? YELLOW : CYAN);
            
            console.log(`${WHITE}▶️ Attempting to claim: ${task.name} (${statusColor}${task.status}${RESET}) - ${task.pointAmount} points${RESET}`);
            
            const claimResult = await claimTask(accountIndex, task._id);
            
            if (claimResult) {
                console.log(`${GREEN}✅ Claim attempt successful: ${task.name}${RESET}`);
                successCount++;
            } else {
                console.log(`${YELLOW}⚠️ Claim attempt ignored: ${task.name}${RESET}`);
                failedCount++;
            }
            
            await sleep(1500);
        }
        
        console.log(`${GREEN}📈 Claim attempt summary for ${account.label}: ${successCount} succeeded, ${failedCount} ignored${RESET}`);
        
    } catch (error) {
        console.error(`${RED}❌ Error claiming tasks for ${account.label}: ${error.message}${RESET}`);
        throw error;
    }
}

async function processAccount(accountIndex, cycleNumber) {
    const account = accounts[accountIndex];
    console.log(`\n${MAGENTA}======== ${account.label} (CYCLE #${cycleNumber}) ========${RESET}`);
    
    try {
        if (!account.token) {
            const loginSuccess = await login(accountIndex);
            if (!loginSuccess) {
                console.error(`${RED}❌ Login failed for ${account.label}. Skipping.${RESET}`);
                return false;
            }
        }
        
        await forceClaimAllTasks(accountIndex);
        await getTotalPoints(accountIndex, false);
        return true;
        
    } catch (error) {
        console.error(`${RED}❌ Error processing ${account.label}: ${error.message}${RESET}`);
        
        if (error.response && error.response.status === 401) {
            console.log(`${YELLOW}🔄 Token expired for ${account.label}, will login again next cycle${RESET}`);
            account.token = null; 
        }
        
        return false;
    }
}

async function runTaskClaimingLoop() {
    let loopCount = 1;
    
    while (isRunning) {
        console.log(`\n${CYAN}============== CYCLE #${loopCount} ==============${RESET}`);
        const timestamp = new Date().toLocaleTimeString();
        console.log(`${WHITE}⏱️ Time: ${timestamp}${RESET}`);
        
        for (let i = 0; i < accounts.length; i++) {
            await processAccount(i, loopCount);
            if (i < accounts.length - 1) await sleep(2000);
        }
        
        console.log(`\n${YELLOW}⏳ Waiting 10 seconds before next cycle...${RESET}`);
        await sleep(10000);
        loopCount++;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    try {
        printBanner();
        console.log(`${GREEN}🚀 Starting Solix Auto Task with Multi-Account and Proxy Support..${RESET}`);

        const accountsLoaded = loadAccounts();
        if (!accountsLoaded) {
            console.error(`${RED}❌ No accounts configured. Exiting program.${RESET}`);
            process.exit(1);
        }
        
        loadProxies();

        console.log(`${GREEN}🔑 Logging in to all accounts...${RESET}`);
        for (let i = 0; i < accounts.length; i++) {
            await login(i);
            await getTotalPoints(i, true);
            if (i < accounts.length - 1) await sleep(2000);
        }

        console.log(`${CYAN}============================================${RESET}`);
        console.log(`${GREEN}🔄 Starting continuous force claiming cycle (10-second intervals)${RESET}`);
        console.log(`${YELLOW}⚠️ Press Ctrl+C to stop the script${RESET}`);
        console.log(`${GREEN}🔍 ${accounts.length} accounts will be processed in each cycle${RESET}`);

        await runTaskClaimingLoop();
        
    } catch (error) {
        console.error(`${RED}❌ Error in main process: ${error.message}${RESET}`);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log(`\n${RED}🛑 Bot shutting down...${RESET}`);
    isRunning = false;
    console.log(`${YELLOW}👋 Thank you for using Solix Force Claimer!${RESET}`);
    process.exit(0);
});

function disableProxies() {
    proxies = [];
    console.log(`${YELLOW}⚠️ Proxies disabled${RESET}`);
}

if (process.argv.includes('--no-proxy')) {
    disableProxies();
}

main();
