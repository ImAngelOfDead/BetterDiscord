/**
 * @name BetterStats
 * @version 0.0.8
 * @description Tracks and displays various user statistics in Discord.
 * @author m3th4d0n
 * @source https://github.com/M3th4d0n/BetterDiscord/blob/main/BetterStats.plugin.js
 * @updateUrl https://github.com/M3th4d0n/BetterDiscord/blob/main/BetterStats.plugin.js
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
};

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
    }

    start() {
        const savedVersion = this.api.Data.load("version");
        if (savedVersion !== this.meta.version) {
            this.api.UI.showChangelogModal({
                title: this.meta.name,
                subtitle: this.meta.version,
                changes: config.changelog,
            });
            this.api.Data.save("version", this.meta.version);
        }
        this.loadStats();
        this.updateConfigWithStats();
        this.setupListeners();
    }

    stop() {
        this.teardownListeners();
        this.saveStats();
    }

    loadStats() {
        const savedStats = this.api.Data.load("stats") || {};
        this.stats = {
            totalTime: savedStats.totalTime || 0,
            messageCount: savedStats.messageCount || 0,
            voiceConnectCount: savedStats.voiceConnectCount || 0,
            clickCount: savedStats.clickCount || 0,
        };
    }

    saveStats() {
        this.api.Data.save("stats", this.stats);
    }

    updateConfigWithStats() {
        config.settings[0].settings[0].value = this.formatTime(
            this.stats.totalTime
        );
        config.settings[0].settings[1].value =
            this.stats.messageCount.toString();
        config.settings[0].settings[2].value = this.stats.clickCount.toString();
        config.settings[0].settings[3].value =
            this.stats.voiceConnectCount.toString();
    }

    setupListeners() {
        const Dispatcher = BdApi.Webpack.getModule(
            (m) => m.dispatch && m.subscribe
        );
        Dispatcher.subscribe(
            "RTC_CONNECTION_STATE",
            this.handleVoiceStateChange.bind(this)
        );
        Dispatcher.subscribe(
            "MESSAGE_CREATE",
            this.handleSendMessage.bind(this)
        );
        document.addEventListener("click", this.handleClick.bind(this));
    }

    teardownListeners() {
        const Dispatcher = BdApi.Webpack.getModule(
            (m) => m.dispatch && m.subscribe
        );
        Dispatcher.unsubscribe(
            "RTC_CONNECTION_STATE",
            this.handleVoiceStateChange.bind(this)
        );
        Dispatcher.unsubscribe(
            "MESSAGE_CREATE",
            this.handleSendMessage.bind(this)
        );
        document.removeEventListener("click", this.handleClick.bind(this));
    }

    handleVoiceStateChange(event) {
        if (event.state === "RTC_CONNECTED") {
            this.stats.voiceConnectCount++;
        }
        this.saveStats();
        this.updateConfigWithStats();
    }

    handleSendMessage(event) {
        const UserStore = BdApi.Webpack.getModule((m) => m.getCurrentUser);
        const currentUser = UserStore?.getCurrentUser();
        if (currentUser && event.message.author.id === currentUser.id) {
            this.stats.messageCount++;
            this.saveStats();
            this.updateConfigWithStats();
        }
    }

    handleClick() {
        this.stats.clickCount++;
        this.saveStats();
        this.updateConfigWithStats();
    }

    getSettingsPanel() {
        return BdApi.UI.buildSettingsPanel({
            settings: config.settings,
        });
    }

    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
            2,
            "0"
        );
        const seconds = String(totalSeconds % 60).padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    }
};
