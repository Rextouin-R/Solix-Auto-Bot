# Join Telegram  ♾︎ 
[![Static Badge](https://img.shields.io/badge/Telegram-Airdrop◾unlimited-Link?style=for-the-badge&logo=Telegram&logoColor=white&logoSize=auto&color=blue)](https://t.me/UNLXairdop)

# SOLIX Extension automatic claim
⚠️ Kestabilan jaringan sangat berpengaruh untuk progres
## Tools by airdropinsiders

## Memerlukan 
- Node JS
- `install nodejs`

## Features

- Automatic login to Solix Depin dashboard
- Automatic task claiming
- Regular connection quality pings to maintain active status
- Tracking of point accumulation

## Install
1. Cloning repositorynya
   ```
   git clone https://github.com/Rextouin-R/Solix-Auto-Bot/
   ```
   ```
   cd Solix-Auto-Bot
   ```
2. Install 
   ```
   npm install
   ```
   atau
   ```
   npm i
   ```
### Persiapan untuk menjalankan

1. Login/register Solix, siapkan semua email yang kamu buat lalu edit `.env` nya.

2. Sesuaikan nomor yang berurutan seperti `SOLIX_EMAIL_1` `SOLIX_PASSWORD_1` `SOLIX_LABEL_1=Account1` dan seterusnya.
3. Buka file `Dawn-Validator-bot` edit berkas `accounts.js isi bagian "email" dengan akun DAWN kalian dan paste bearer tokennya di bagian "token1" atau "token2", seperti contoh berkasnya.
	```
	// .env
	module.exports = [
		{ email: "user1@example.com", token: "token1" },
		{ email: "user2@example.com", token: "token2" },
		// Add more accounts as needed
	];
	```
4. Edit berkas `config.js`. dan jika tidak ingin menggunakan proxy biarkan "false".
	```
	// config.js
	module.exports = {
	    useProxy: false, // biarkan false jika tidak ingin menggunakan proxy
	    minDelay: 3, // 
	    maxDelay: 10, // 
	    restartDelay: 241, // 
	    accountDelay: 121, //
	};
	```
5. Untuk menjalankan scriptnya, ketikan perintah :
    ```
    node index.js
    ```
	
	
	
Dawn Validator Extension : https://chromewebstore.google.com/detail/dawn-validator-chrome-ext/fpdkjdnhkakefebpekbdhillbhonfjjp?authuser=0&hl=en
