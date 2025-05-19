/**
 * @name BetterStats
 * @version 0.1.0
 * @description Tracks and displays various user statistics in Discord.
 * @author ImAngelOfDead
 * @source https://github.com/ImAngelOfDead/BetterDiscord/blob/main/BetterStats.plugin.js
 * @updateUrl https://github.com/ImAngelOfDead/BetterDiscord/blob/main/BetterStats.plugin.js
 */

const config = {
    settings: [
        {
            type: "category",
            id: "statsDisplay",
            name: "Statistics",
            collapsible: true,
            shown: true,
            settings: [
                {
                    type: "text",
                    id: "voiceTime",
                    name: "Total Voice Time",
                    value: "00:00:00",
                    note: "Time spent in voice channels",
                    disabled: true,
                },
                {
                    type: "text",
                    id: "messageCount",
                    name: "Messages Sent",
                    value: "0",
                    note: "Total messages sent",
                    disabled: true,
                },
                {
                    type: "text",
                    id: "clickCount",
                    name: "Total Clicks",
                    value: "0",
                    note: "Total clicks recorded",
                    disabled: true,
                },
                {
                    type: "text",
                    id: "voiceConnectCount",
                    name: "Voice Connections",
                    value: "0",
                    note: "Total voice channel connections",
                    disabled: true,
                },
            ],
        },
    ],
    changelog: [
        {
            title: "New Features",
            items: [
                "Updated to support latest BetterDiscord API changes",
                "Added support for the new settings panel API",
                "Added changelog modal support"
            ]
        },
        {
            title: "Improvements",
            items: [
                "Optimized data storage system",
                "Improved performance of stat tracking",
                "fixed message count tracking",
            ]
        }
    ]
};

class TimerManager {
    constructor() {
        this.timers = new Map();
    }

    set(key, callback, interval) {
        this.clear(key);
        const timer = setInterval(callback, interval);
        this.timers.set(key, timer);
    }

    clear(key) {
        if (this.timers.has(key)) {
            clearInterval(this.timers.get(key));
            this.timers.delete(key);
        }
    }

    clearAll() {
        this.timers.forEach((timer) => clearInterval(timer));
        this.timers.clear();
    }
}

class Cache {
    constructor(expiryTime = 10000) {
        this.cache = new Map();
        this.expiryTime = expiryTime;
    }

    set(key, value) {
        const expiry = Date.now() + this.expiryTime;
        this.cache.set(key, { value, expiry });
    }

    get(key) {
        const cached = this.cache.get(key);
        if (cached && cached.expiry > Date.now()) {
            return cached.value;
        } else {
            this.cache.delete(key);
            return undefined;
        }
    }

    has(key) {
        return this.get(key) !== undefined;
    }

    clear() {
        this.cache.clear();
    }
}

class StatsHandler {
    constructor(api, stats, cache) {
        this.api = api;
        this.stats = stats;
        this.cache = cache;
    }

    async loadStats() {
        try {
            const cachedStats = this.cache.get("stats");
            if (cachedStats) {
                Object.assign(this.stats, cachedStats);
            } else {
                const savedStats = await this.api.Data.load("stats") || {};
                Object.assign(this.stats, savedStats);
                this.cache.set("stats", this.stats);
            }
        } catch (error) {
            console.error(`[BetterStats] Failed to load stats: ${error.message}`);
        }
    }

    async saveStats() {
        try {
            this.cache.set("stats", this.stats);
            await this.api.Data.save("stats", this.stats);
        } catch (error) {
            console.error(`[BetterStats] Failed to save stats: ${error.message}`);
        }
    }

    updateConfig(config) {
        config.settings[0].settings[0].value = this.formatTime(this.stats.totalTime);
        config.settings[0].settings[1].value = this.stats.messageCount.toString();
        config.settings[0].settings[2].value = this.stats.clickCount.toString();
        config.settings[0].settings[3].value = this.stats.voiceConnectCount.toString();
    }

    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
        const seconds = String(totalSeconds % 60).padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    }
}

module.exports = class BetterStats {
    constructor(meta) {
        this.meta = meta;
        this.api = new BdApi(this.meta.name);
        this.stats = {
            totalTime: 0,
            messageCount: 0,
            voiceConnectCount: 0,
            clickCount: 0,
        };

        this.Dispatcher = this.api.Webpack.getModule(m => m.dispatch && m.subscribe);
        this.UserStore = this.api.Webpack.getModule(m => m.getCurrentUser);

        this.handleVoiceStateChange = this.handleVoiceStateChange.bind(this);
        this.handleSendMessage = this.handleSendMessage.bind(this);
        this.handleClick = this.handleClick.bind(this);

        this.timerManager = new TimerManager();
        this.cache = new Cache(30000);
        this.statsHandler = new StatsHandler(this.api, this.stats, this.cache);
    }

    async start() {
        const savedVersion = await this.api.Data.load("version");
        if (savedVersion !== this.meta.version) {
            this.api.UI.showChangelogModal({
                title: this.meta.name,
                subtitle: `Version ${this.meta.version}`,
                changes: config.changelog,
            });
            await this.api.Data.save("version", this.meta.version);
        }
        
        await this.statsHandler.loadStats();
        this.statsHandler.updateConfig(config);
        this.setupListeners();

        this.timerManager.set("saveStats", () => this.statsHandler.saveStats(), 10000);
    }

    stop() {
        this.teardownListeners();
        this.timerManager.clearAll();
        this.statsHandler.saveStats();
    }

    setupListeners() {
        this.Dispatcher?.subscribe("RTC_CONNECTION_STATE", this.handleVoiceStateChange);
        this.Dispatcher?.subscribe("MESSAGE_CREATE", this.handleSendMessage);
        document.addEventListener("click", this.handleClick);
    }

    teardownListeners() {
        this.Dispatcher?.unsubscribe("RTC_CONNECTION_STATE", this.handleVoiceStateChange);
        this.Dispatcher?.unsubscribe("MESSAGE_CREATE", this.handleSendMessage);
        document.removeEventListener("click", this.handleClick);
    }

    handleVoiceStateChange(event) {
        if (event.state === "RTC_CONNECTED") {
            this.timerManager.set("totalTime", () => {
                this.stats.totalTime += 1000;
                this.statsHandler.updateConfig(config);
            }, 1000);
            this.stats.voiceConnectCount++;
            this.statsHandler.updateConfig(config);
        } else if (event.state === "RTC_DISCONNECTED") {
            this.timerManager.clear("totalTime");
        }
    }

    handleSendMessage(event) {
        const currentUser = this.UserStore?.getCurrentUser();
        if (currentUser && event.message.author.id === currentUser.id) {
            this.stats.messageCount += 1/3; // hardcode <33333333333333333333
            this.statsHandler.updateConfig(config);
        }
    }

    handleClick() {
        this.stats.clickCount++;
        this.statsHandler.updateConfig(config);
    }


    getSettingsPanel() {
        return this.api.UI.buildSettingsPanel({
            settings: config.settings,
            onChange: () => {
                // settings are read only, so no need to save
            }
        });
    }
};
