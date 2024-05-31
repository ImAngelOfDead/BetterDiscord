/**
 * @name BetterStats
 * @version 0.0.2
 * @description Tracks various user statistics in Discord with improved visuals and animations.
 */
const request = require("request");
const fs = require("fs");
const path = require("path");

const config = {
    info: {
        name: "BetterStats",
        authors: [
            {
                name: "z3phyr"
            }
        ],
        version: "0.0.2",
        description: "Tracks various user statistics in Discord with improved visuals and animations."
    },
    defaultConfig: []
};

module.exports = !global.ZeresPluginLibrary ? class {
    constructor() {
        this._config = config;
    }

    load() {
        BdApi.showConfirmationModal("Library plugin is needed",
            `The library plugin needed for this plugin is missing. Please click Download Now to install it.`, {
            confirmText: "Download",
            cancelText: "Cancel",
            onConfirm: () => {
                request.get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", (error, response, body) => {
                    if (error)
                        return electron.shell.openExternal("https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js");

                    fs.writeFileSync(path.join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body);
                });
            }
        });
    }

    start() { }

    stop() { }
} : (([Plugin, Library]) => {
    const { WebpackModules, Patcher, Settings } = Library;
    const Dispatcher = WebpackModules.getByProps('dispatch', 'subscribe');
    const UserStore = WebpackModules.getByProps('getCurrentUser');

    class BetterStats extends Plugin {
        constructor() {
            super();
            this.startTime = null;
            this.totalTime = BdApi.loadData('BetterStats', 'totalTime') || 0;
            this.messageCount = BdApi.loadData('BetterStats', 'messageCount') || 0;
            this.voiceConnectCount = BdApi.loadData('BetterStats', 'voiceConnectCount') || 0;
            this.clickCount = BdApi.loadData('BetterStats', 'clickCount') || 0;
            this.lastMessageTime = 0;
            this.interval = null;
            this.handleVoiceStateChange = this.handleVoiceStateChange.bind(this);
            this.handleSendMessage = this.handleSendMessage.bind(this);
            this.handleClick = this.handleClick.bind(this);
            this.clearStats = this.clearStats.bind(this);
        }

        onStart() {
            Dispatcher.subscribe('RTC_CONNECTION_STATE', this.handleVoiceStateChange);
            Dispatcher.subscribe('MESSAGE_CREATE', this.handleSendMessage);
            document.addEventListener('click', this.handleClick);
        }

        onStop() {
            Dispatcher.unsubscribe('RTC_CONNECTION_STATE', this.handleVoiceStateChange);
            Dispatcher.unsubscribe('MESSAGE_CREATE', this.handleSendMessage);
            document.removeEventListener('click', this.handleClick);
            this.stopTimer();
            this.saveData();
        }

        handleVoiceStateChange(e) {
            if (e.state === 'RTC_CONNECTED') {
                this.startTimer();
                this.voiceConnectCount += 1;
                this.saveData();
                this.updateSettingsPanel();
            } else if (e.state === 'RTC_DISCONNECTED') {
                this.stopTimer();
            }
        }

        handleSendMessage(e) {
            const currentUser = UserStore.getCurrentUser();
            const currentTime = Date.now();
            if (e.message.author.id === currentUser.id && currentTime - this.lastMessageTime > 500 /** this rly shit))) */) {
                this.messageCount += 1;
                this.lastMessageTime = currentTime;
                this.saveData();
                this.updateSettingsPanel();
            }
        }

        handleClick() {
            this.clickCount += 1;
            this.saveData();
            this.updateSettingsPanel();
        }

        startTimer() {
            if (!this.interval) {
                this.startTime = Date.now();
                this.interval = setInterval(() => {
                    const elapsed = Date.now() - this.startTime;
                    this.totalTime += elapsed;
                    this.startTime = Date.now();
                    this.saveData();
                    this.updateSettingsPanel();
                }, 1000);
            }
        }

        stopTimer() {
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
                if (this.startTime) {
                    const elapsed = Date.now() - this.startTime;
                    this.totalTime += elapsed;
                    this.startTime = null;
                    this.saveData();
                    this.updateSettingsPanel();
                }
            }
        }

        clearStats() {
            this.totalTime = 0;
            this.messageCount = 0;
            this.voiceConnectCount = 0;
            this.clickCount = 0;
            this.saveData();
            this.updateSettingsPanel();
        }

        saveData() {
            BdApi.saveData('BetterStats', 'totalTime', this.totalTime);
            BdApi.saveData('BetterStats', 'messageCount', this.messageCount);
            BdApi.saveData('BetterStats', 'voiceConnectCount', this.voiceConnectCount);
            BdApi.saveData('BetterStats', 'clickCount', this.clickCount);
        }

        formatTime(ms) {
            const totalSeconds = Math.floor(ms / 1000);
            const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            const seconds = String(totalSeconds % 60).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        }

        getSettingsPanel() {
            return BdApi.React.createElement(SettingsPanel, { plugin: this });
        }

        updateSettingsPanel() {
            if (this.settingsPanelInstance) {
                this.settingsPanelInstance.forceUpdate();
            }
        }
    }

    class SettingsPanel extends BdApi.React.Component {
        constructor(props) {
            super(props);
            this.plugin = props.plugin;
            this.state = {
                activeTab: 'voice'
            };
            this.interval = null;
            this.setActiveTab = this.setActiveTab.bind(this);
        }

        componentDidMount() {
            this.interval = setInterval(() => {
                this.setState({
                    totalTime: this.plugin.totalTime,
                    messageCount: this.plugin.messageCount,
                    voiceConnectCount: this.plugin.voiceConnectCount,
                    clickCount: this.plugin.clickCount
                });
            }, 1000);
            this.plugin.settingsPanelInstance = this;
        }

        componentWillUnmount() {
            clearInterval(this.interval);
            this.plugin.settingsPanelInstance = null;
        }

        setActiveTab(tab) {
            this.setState({ activeTab: tab });
        }

        render() {
            const { activeTab } = this.state;
            const totalTime = this.plugin.formatTime(this.state.totalTime || 0);
            const { messageCount, voiceConnectCount, clickCount } = this.state;

            const tabStyle = (isActive) => ({
                flex: 1,
                padding: '10px',
                marginRight: '5px',
                backgroundColor: isActive ? '#7289da' : '#4f545c',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'center',
                borderRadius: '5px',
                transition: 'background-color 0.5s ease'
            });

            const contentStyle = {
                color: '#b9bbbe',
                fontSize: '16px',
                padding: '10px',
                backgroundColor: '#36393f',
                borderRadius: '5px',
                animation: 'fadeIn 0.5s ease'
            };

            const buttonStyle = {
                marginTop: '20px',
                padding: '10px',
                backgroundColor: '#f04747',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '5px',
                transition: 'background-color 0.3s ease'
            };

            return BdApi.React.createElement("div", { style: { padding: '20px' } },
                BdApi.React.createElement("h2", { style: { color: '#fff', fontSize: '24px', marginBottom: '10px' } }, "BetterStats - Statistics"),
                BdApi.React.createElement("div", { style: { display: 'flex', marginBottom: '10px', position: 'relative' } },
                    BdApi.React.createElement("button", {
                        onClick: () => this.setActiveTab('voice'),
                        style: tabStyle(activeTab === 'voice')
                    }, "Voice"),
                    BdApi.React.createElement("button", {
                        onClick: () => this.setActiveTab('messages'),
                        style: tabStyle(activeTab === 'messages')
                    }, "Messages"),
                    BdApi.React.createElement("button", {
                        onClick: () => this.setActiveTab('clicks'),
                        style: tabStyle(activeTab === 'clicks')
                    }, "Clicks")
                ),
                activeTab === 'voice' && BdApi.React.createElement("div", { style: contentStyle },
                    BdApi.React.createElement("strong", null, "Total time in voice channels:"),
                    BdApi.React.createElement("p", { style: { marginTop: '5px' } }, totalTime),
                    BdApi.React.createElement("strong", null, "Total voice connections:"),
                    BdApi.React.createElement("p", { style: { marginTop: '5px' } }, voiceConnectCount)
                ),
                activeTab === 'messages' && BdApi.React.createElement("div", { style: contentStyle },
                    BdApi.React.createElement("strong", null, "Total messages sent:"),
                    BdApi.React.createElement("p", { style: { marginTop: '5px' } }, messageCount)
                ),
                activeTab === 'clicks' && BdApi.React.createElement("div", { style: contentStyle },
                    BdApi.React.createElement("strong", null, "Total clicks:"),
                    BdApi.React.createElement("p", { style: { marginTop: '5px' } }, clickCount)
                ),
                BdApi.React.createElement("button", {
                    onClick: this.plugin.clearStats,
                    style: buttonStyle,
                    onMouseOver: (e) => e.target.style.backgroundColor = '#ff5555',
                    onMouseOut: (e) => e.target.style.backgroundColor = '#f04747'
                }, "Clear Stats")
            );
        }
    }

    return BetterStats;
})(global.ZeresPluginLibrary.buildPlugin(config));
