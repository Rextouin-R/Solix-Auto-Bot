require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

const ACCOUNTS_FILE = 'accounts.json';
const PROXIES_FILE = 'proxies.txt';
const DEFAULT_CHECK_INTERVAL = 30; 
const DEFAULT_PING_INTERVAL = 1; 

const BASE_URL = 'https://api.solixdepin.net/api';
const LOGIN_URL = `${BASE_URL}/auth/login-password`;
const TASKS_URL = `${BASE_URL}/task/get-user-task`;
const CLAIM_TASK_URL = `${BASE_URL}/task/claim-task`;
const TOTAL_POINT_URL = `${BASE_URL}/point/get-total-point`;
const CONNECTION_QUALITY_URL = `${BASE_URL}/point/get-connection-quality`;

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const WHITE = "\x1b[37m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const BLUE = "\x1b[34m";

const accounts = [];
const proxies = [];
let currentProxyIndex = 0;

function printBanner() {
    console.log(`${CYAN}
    ▄▀█ █ █▀█ █▀▄ █▀█ █▀█ █▀█ ∞
    █▀█ █ █▀▄ █▄▀ █▀▄ █▄█ █▀▀   
    ${RESET}`);
    console.log(`${WHITE}
    ┏━┓ ┏━┓         ┏━┓ ╔═╗             ╔═╗ ┏━┓__            ┏━┓
    ┃ ┃ ┃ ┃ ┏━╻━━━┓ ┃ ┃ ┏━┓ ┏━╻━━╻━━━━┓ ┏━┓ ┃ ┏━┛  ┏━━━━╮ ╭━━╹ ┃
    ┃ ┗━┛ ┃ ┃ ┏━┓ ┃ ┃ ┃ ┃ ┃ ┃ ┏━┓ ┏━┓ ┃ ┃ ┃ ┃ ┗━━┓ ┃ ┏━━┛ ┃ ━━ ┃
    ┗━━━ ━┛ ┗━┛ ┗━┛ ┗━┛ ┗━┛ ┗━┛ ┗━┛ ┗━┛ ┗━┛ ┗━━━━┛ ┗━━━━┛ ╰━━━━┛
    ${RESET}`);
    console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
}

async function loadProxies() {
    try {
        if (!fs.existsSync(PROXIES_FILE)) {
            console.log(`${YELLOW}${RESET}`);
            return [];
        }

        const proxyData = fs.readFileSync(PROXIES_FILE, 'utf8');
        const proxyList = proxyData.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));

        console.log(`${GREEN}${RESET}`);
        return proxyList;
    } catch (error) {
        console.error(`${RED}${RESET}`);
        return [];
    }
}

function getNextProxy() {
    if (proxies.length === 0) return null;
    
    const proxy = proxies[currentProxyIndex];
    currentProxyIndex = (currentProxyIndex + 1) % proxies.length;
    return proxy;
}

function createProxyAgent(proxyString) {
    if (!proxyString) return null;
    
    try {
        let formattedProxy = proxyString;

        if (proxyString.includes('@') && !proxyString.startsWith('http')) {
            formattedProxy = `http://${proxyString}`;
        }
        else if (!proxyString.includes('@') && !proxyString.startsWith('http')) {
            formattedProxy = `http://${proxyString}`;
        }
        
        return new HttpsProxyAgent(formattedProxy);
    } catch (error) {
        console.error(`${RED}${RESET}`);
        return null;
    }
}

class AccountSession {
    constructor(email, password, label = null) {
        this.email = email;
        this.password = password;
        this.label = label || email;
        this.token = null;
        this.userInfo = null;
        this.connectionQualityInterval = null;
        this.taskCheckInterval = null;
        this.lastPointsUpdate = null;
        this.currentProxy = null;
    }

    rotateProxy() {
        const proxyString = getNextProxy();
        if (proxyString) {
            this.currentProxy = proxyString;
            console.log(`${YELLOW}${RESET}`);
            return createProxyAgent(proxyString);
        }
        return null;
    }

    createAxiosInstance() {
        const agent = this.rotateProxy();
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
        
        if (agent) {
            config.httpsAgent = agent;
            config.proxy = false; 
        }
        
        return { 
            config,
            proxyInfo: this.currentProxy ? ` (via proxy: ${this.currentProxy})` : ''
        };
    }

    async login() {
        try {
            console.log(`\n${CYAN}━━━━━━━━━━━━━━━━━━━ LOGIN (${this.label}) ━━━━━━━━━━━━━━━━━━━${RESET}`);
            console.log(`${YELLOW}🔑 Login dengan akun: ${this.label}...${RESET}`);
            
            if (!this.email || !this.password) {
                throw new Error(`Missing credential for account ${this.label}`);
            }

            const { config, proxyInfo } = this.createAxiosInstance();
            
            const response = await axios.post(LOGIN_URL, {
                email: this.email,
                password: this.password
            }, config);

            if (response.data && response.data.result === 'success' && response.data.data.accessToken) {
                this.token = response.data.data.accessToken;
                this.userInfo = response.data.data.user;
                
                console.log(`${GREEN}✅ Login berhasil untuk ${this.label}${proxyInfo}${RESET}`);
                console.log(`${GREEN}👤 User Info:${RESET}`);
                console.log(`${WHITE}   • User ID: ${this.userInfo._id}${RESET}`);
                console.log(`${WHITE}   • Email: ${this.userInfo.email}${RESET}`);
                console.log(`${WHITE}   • Referral Code: ${this.userInfo.referralCode}${RESET}`);
                if (this.userInfo.referrerId) {
                    console.log(`${WHITE}   • Referrer ID: ${this.userInfo.referrerId}${RESET}`);
                }

                try {
                    const payload = JSON.parse(Buffer.from(this.token.split('.')[1], 'base64').toString());
                    const expiryDate = new Date(payload.exp * 1000);
                    console.log(`${YELLOW}🕒 Token expires: ${expiryDate.toLocaleString()}${RESET}`);
                } catch (e) {
                    console.log(`${YELLOW}⚠️ Tidak ada parse token terbaca: ${e.message}${RESET}`);
                }
                console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
                return true;
            } else {
                console.error(`${RED}Respon login untuk ${this.label}:${RESET}`, response.data);
                throw new Error('Login gagal - tidak ada respon format');
            }
        } catch (error) {
            console.error(`${RED}❌ Login gagal untuk ${this.label}: ${error.message}${RESET}`);
            if (error.response) {
                console.error(`${RED}Error details:${RESET}`, error.response.data);
            }
            return false;
        }
    }

    async checkAndClaimTasks() {
        try {
            console.log(`\n${CYAN}━━━━━━━━━━━━━━━━━━━ TASKS (${this.label}) ━━━━━━━━━━━━━━━━━━━${RESET}`);
            console.log(`${YELLOW}📋 Memeriksa task untuk ${this.label}...${RESET}`);

            const tasks = await this.getTasks();
            if (!tasks || tasks.length === 0) {
                console.log(`${WHITE}ℹ️ Tidak ada task berhasil untuk ${this.label}${RESET}`);
                console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
                return;
            }
            
            console.log(`${GREEN}📝 Found ${tasks.length} tasks for ${this.label}${RESET}`);

            for (const task of tasks) {
                console.log(`\n${WHITE}▶️ Task: ${task.name} (${task.status}) - ${task.pointAmount} points${RESET}`);
                
                if (task.status === 'idle') {
                    console.log(`${YELLOW}🔄 Memeriksa task untuk di klaim: ${task.name}${RESET}`);
                    await this.claimTask(task._id);
                } else if (task.status === 'pending') {
                    console.log(`${YELLOW}⏳ Task pending terverifikasi: ${task.name}${RESET}`);
                } else if (task.status === 'claimed') {
                    console.log(`${GREEN}✅ Task berhasil di klaim: ${task.name}${RESET}`);
                }
            }
            console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
            
        } catch (error) {
            console.error(`${RED}❌ Gagal memeriksa task untuk ${this.label}: ${error.message}${RESET}`);
            if (error.response) {
                console.error(`${RED}Error details:${RESET}`, error.response.data);
            }

            if (error.response && error.response.status === 401) {
                console.log(`${YELLOW}🔄 Token expired untuk ${this.label}, logging in again...${RESET}`);
                await this.login();
            }
        }
    }

    async getTasks() {
        try {
            const { config, proxyInfo } = this.createAxiosInstance();
            config.headers.authorization = `Bearer ${this.token}`;
            
            const response = await axios.get(TASKS_URL, config);
            
            return response.data.data || [];
        } catch (error) {
            console.error(`${RED}❌ Gagal memeriksa task untuk ${this.label}: ${error.message}${RESET}`);
            throw error;
        }
    }

    async claimTask(taskId) {
        try {
            const { config, proxyInfo } = this.createAxiosInstance();
            config.headers.authorization = `Bearer ${this.token}`;
            
            const response = await axios.post(CLAIM_TASK_URL, {
                taskId: taskId
            }, config);
            
            if (response.data && response.data.result === 'success') {
                console.log(`${GREEN}✅ Berhasil mengklaim task: ${taskId} untuk ${this.label}${proxyInfo}${RESET}`);
                return true;
            } else {
                console.log(`${YELLOW}⚠️ Tidak dapat mengklaim task: ${taskId} untuk ${this.label}${proxyInfo}${RESET}`);
                if (response.data) {
                    console.log('Response:', response.data);
                }
                return false;
            }
        } catch (error) {
            console.error(`${RED}❌ Gagal mengklaim task ${taskId} untuk ${this.label}: ${error.message}${RESET}`);
            if (error.response && error.response.data) {
                console.error(`${RED}Error details:${RESET}`, error.response.data);
            }
            return false;
        }
    }

    async getTotalPoints(showDetailedInfo = false) {
        try {
            const { config, proxyInfo } = this.createAxiosInstance();
            config.headers.authorization = `Bearer ${this.token}`;
            
            const response = await axios.get(TOTAL_POINT_URL, config);
            
            if (response.data && response.data.result === 'success' && response.data.data) {
                const pointsData = response.data.data;
                this.lastPointsUpdate = new Date();
                
                if (showDetailedInfo) {
                    console.log(`\n${GREEN}💰 Informasi poin untuk ${this.label}${proxyInfo}:${RESET}`);
                    console.log(`${WHITE}   • Total Poin: ${pointsData.total.toFixed(2)}${RESET}`);
                    console.log(`${WHITE}   • 🌟 Total Earning Poin: ${pointsData.totalEarningPoint.toFixed(2)}${RESET}`);
                    console.log(`${WHITE}   • 🔌 Internet Poin: ${pointsData.totalPointInternet.toFixed(2)}${RESET}`);
                    console.log(`${WHITE}   • ✅ Task Poin: ${pointsData.totalPointTask.toFixed(2)}${RESET}`);
                    console.log(`${WHITE}   • 👥 Referral Poin: ${pointsData.totalPointReferral.toFixed(2)}${RESET}`);
                    console.log(`${WHITE}   • 🎁 Bonus Poin: ${pointsData.totalPointBonus.toFixed(2)}${RESET}`);
                    console.log(`${WHITE}   • 📅 Poin hari ini: ${pointsData.todayPointEarned.toFixed(2)}${RESET}`);
                } else {
                    console.log(`${WHITE}⏳ Memeriksa ${this.label}: Total Poin: ${pointsData.total.toFixed(2)}${proxyInfo}${RESET}`);
                    console.log(`${CYAN}
                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
                    console.log(`${WHITE} 
                                                    █▀ █▀█ █░ █ ▀▄▀  █▄▄ █▀█ ▀█▀
                                                    ▄█ █▄█ █▄ █ █░█  █▄█ █▄█ ░█░
                    ${RESET}`);
                    console.log(`${CYAN}
                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
                }
                
                return pointsData;
            }
            console.log(`${YELLOW}⚠️ Kesalahan memeriksa poin untuk ${this.label}${proxyInfo}${RESET}`);
            return null;
        } catch (error) {
            console.error(`${RED}❌ Gagal mendapatkan poin untuk ${this.label}: ${error.message}${RESET}`);
            if (error.response) {
                console.error(`${RED}Error details:${RESET}`, error.response.data);
            }
            return null;
        }
    }

    startConnectionQuality(intervalMinutes = DEFAULT_PING_INTERVAL) {
        console.log(`\n${CYAN}━━━━━━━━━━━━━━━━━━━ KONEKSI PING (${this.label}) ━━━━━━━━━━━━━━━━━━━${RESET}`);
        console.log(`${YELLOW}🔌 Memulai koneksi ping untuk ${this.label}...${RESET}`);

        this.stopConnectionQuality();
        this.pingConnectionQuality();
        this.connectionQualityInterval = setInterval(() => this.pingConnectionQuality(), intervalMinutes * 60 * 1000);
    }

    stopConnectionQuality() {
        if (this.connectionQualityInterval) {
            clearInterval(this.connectionQualityInterval);
            this.connectionQualityInterval = null;
        }
    }

    async pingConnectionQuality() {
        try {
            const { config, proxyInfo } = this.createAxiosInstance();
            config.headers.authorization = `Bearer ${this.token}`;
            
            const response = await axios.get(CONNECTION_QUALITY_URL, config);
            
            const now = new Date().toLocaleTimeString();
            if (response.status === 200) {
                console.log(`${GREEN}[${now}] 📡 Koneksi ping berhasil untuk ${this.label}${proxyInfo}${RESET}`);
                await this.getTotalPoints();
                return true;
            } else {
                console.log(`${YELLOW}[${now}] ⚠️ Koneksi bermasalah, ping buruk untuk ${this.label}${proxyInfo}: ${response.status}${RESET}`);
                return false;
            }
        } catch (error) {
            console.error(`${RED}[${new Date().toLocaleTimeString()}] ❌ Koneksi ping gagal untuk ${this.label}: ${error.message}${RESET}`);

            if (error.response && error.response.status === 401) {
                console.log(`${YELLOW}🔄 Token expired untuk ${this.label}, logging in again...${RESET}`);
                await this.login();
            }
            return false;
        }
    }

    startTaskChecker(intervalMinutes = DEFAULT_CHECK_INTERVAL) {
        this.stopTaskChecker();
        this.taskCheckInterval = setInterval(() => this.checkAndClaimTasks(), intervalMinutes * 60 * 1000);
    }

    stopTaskChecker() {
        if (this.taskCheckInterval) {
            clearInterval(this.taskCheckInterval);
            this.taskCheckInterval = null;
        }
    }

    async start() {
        try {
            if (await this.login()) {
                await this.getTotalPoints(true);
                await this.checkAndClaimTasks();
                this.startTaskChecker();
                this.startConnectionQuality();
                return true;
            }
            return false;
        } catch (error) {
            console.error(`${RED}❌ Gagal memulai akun ${this.label}: ${error.message}${RESET}`);
            return false;
        }
    }

    cleanup() {
        console.log(`${YELLOW}🧹 Memeriksa semua akun ${this.label}...${RESET}`);
        this.stopConnectionQuality();
        this.stopTaskChecker();
    }
}

async function loadAccounts() {
    try {
        let accountsData = [];
        
        if (fs.existsSync(ACCOUNTS_FILE)) {
            const fileData = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
            accountsData = JSON.parse(fileData);
            console.log(`${GREEN}✅ Loaded ${accountsData.length} akun dari ${ACCOUNTS_FILE}${RESET}`);
        } else {
            console.log(`${YELLOW}⚠️ Tidak ${ACCOUNTS_FILE} berhasil, memeriksa .env untuk akun${RESET}`);

            const email = process.env.SOLIX_EMAIL;
            const password = process.env.SOLIX_PASSWORD;
            
            if (email && password) {
                accountsData.push({ email, password, label: "Default" });
                console.log(`${GREEN}✅ Akun default berhasil di .env file${RESET}`);
            }

            let accountNumber = 1;
            let foundNumberedAccounts = false;
            
            while (true) {
                const email = process.env[`SOLIX_EMAIL_${accountNumber}`];
                const password = process.env[`SOLIX_PASSWORD_${accountNumber}`];
                const label = process.env[`SOLIX_LABEL_${accountNumber}`] || `Account ${accountNumber}`;
                
                if (!email || !password) {
                    break; 
                }
                
                accountsData.push({ email, password, label });
                foundNumberedAccounts = true;
                accountNumber++;
            }
            
            if (foundNumberedAccounts) {
                console.log(`${GREEN}✅ ${accountNumber-1} terditeksi di  .env file${RESET}`);
            }

            if (accountsData.length > 0) {
                fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accountsData, null, 2));
                console.log(`${GREEN}✅ ${ACCOUNTS_FILE} berhasil membuat ${accountsData.length} akun${RESET}`);
            } else {
                fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify([], null, 2));
                console.log(`${RED}❌ Tidak ada akun yang berhasil dibuat ${ACCOUNTS_FILE}${RESET}`);
                console.log(`${YELLOW}Mohon isi akun ${ACCOUNTS_FILE} untuk format ini:${RESET}`);
                console.log(`${CYAN}[
  {
    "email": "your-email@example.com",
    "password": "your-password",
    "label": "Account name" 
  }
]${RESET}`);
                console.log(`${YELLOW}Alternatively, you can use .env file with this format:${RESET}`);
                console.log(`${CYAN}# Account 1
SOLIX_EMAIL_1=account1@example.com
SOLIX_PASSWORD_1=password1
SOLIX_LABEL_1=Account One

# Account 2
SOLIX_EMAIL_2=account2@example.com
SOLIX_PASSWORD_2=password2
SOLIX_LABEL_2=Account Two${RESET}`);
            }
        }
        
        return accountsData;
    } catch (error) {
        console.error(`${RED}❌ Error loading akun: ${error.message}${RESET}`);
        return [];
    }
}

async function showAccountsStatus() {
    console.log(`\n${MAGENTA}━━━━━━━━━━━━━━━━━━━ AKUN TERDITEKSI ━━━━━━━━━━━━━━━━━━━${RESET}`);
    console.log(`${BLUE}Berhasil menditeski ${accounts.length} akun:${RESET}`);
    
    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        console.log(`${WHITE}${i + 1}. ${account.label} (${account.email})${RESET}`);
        if (account.lastPointsUpdate) {
            console.log(`   Update selanjutnya: ${account.lastPointsUpdate.toLocaleString()}`);
        }
        if (account.currentProxy) {
            console.log(`   Current proxy: ${account.currentProxy}`);
        }
    }
    console.log(`${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
}

async function main() {
    try {
        printBanner();
        console.log(`${GREEN}🚀 Memulai Solix Depin Multi-Akun Bot...${RESET}`);

        const loadedProxies = await loadProxies();
        if (loadedProxies.length > 0) {
            proxies.push(...loadedProxies);
            console.log(`${GREEN}✅ Proxies loaded and ready for use${RESET}`);
        } else {
            console.log(`${YELLOW}${RESET}`);
            console.log(`${YELLOW}${RESET}`);
            console.log(`${CYAN}${RESET}`);
        }

        const accountsData = await loadAccounts();
        
        if (accountsData.length === 0) {
            console.log(`${RED}❌ No accounts found. Add accounts to ${ACCOUNTS_FILE} and restart the bot.${RESET}`);
            return;
        }

        for (const accountData of accountsData) {
            const session = new AccountSession(
                accountData.email, 
                accountData.password, 
                accountData.label || accountData.email
            );
            
            console.log(`${YELLOW}🔄 Initializing account: ${session.label}${RESET}`);
            
            if (await session.start()) {
                accounts.push(session);
            } else {
                console.log(`${RED}❌ Failed to initialize account: ${session.label}${RESET}`);
            }
        }

        showAccountsStatus();
        setInterval(showAccountsStatus, 60 * 60 * 1000);
        
    } catch (error) {
        console.error(`${RED}❌ Error in main process: ${error.message}${RESET}`);
        cleanup();
    }
}

function cleanup() {
    console.log(`${YELLOW}🧹 Cleaning up all accounts...${RESET}`);
    for (const account of accounts) {
        account.cleanup();
    }
}

process.on('SIGINT', () => {
    console.log(`\n${RED}🛑 Bot shutting down...${RESET}`);
    cleanup();
    process.exit(0);
});

main();
