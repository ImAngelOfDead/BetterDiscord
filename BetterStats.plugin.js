/**
 * @name BetterStats
 * @version 0.0.7
 * @description Tracks various user statistics in Discord.
 * @author m3th4d0n
 * @source https://github.com/M3th4d0n/BetterDiscord/blob/main/BetterStats.plugin.js
 * @updateUrl https://github.com/M3th4d0n/BetterDiscord/blob/main/BetterStats.plugin.js
 */

class BetterStats {
  constructor() {
    this.startTime = null;
    this.totalTime = 0;
    this.messageCount = 0;
    this.voiceConnectCount = 0;
    this.clickCount = 0;
    this.saveTimeout = null;
    this.interval = null;

    this.handleVoiceStateChange = this.handleVoiceStateChange.bind(this);
    this.handleSendMessage = this.handleSendMessage.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.clearStats = this.clearStats.bind(this);

    this.loadData();
  }

  loadData() {
    const savedData = BdApi.Data.load("BetterStats", "stats") || {};
    this.totalTime = savedData.totalTime || 0;
    this.messageCount = savedData.messageCount || 0;
    this.voiceConnectCount = savedData.voiceConnectCount || 0;
    this.clickCount = savedData.clickCount || 0;
  }

  flushData() {
    BdApi.Data.save("BetterStats", "stats", {
      totalTime: this.totalTime,
      messageCount: this.messageCount,
      voiceConnectCount: this.voiceConnectCount,
      clickCount: this.clickCount,
    });
  }

  scheduleSave() {
    if (this.saveTimeout) return;

    this.saveTimeout = setTimeout(() => {
      this.flushData();
      this.saveTimeout = null;
    }, 30000); // Save every 30 seconds
  }

  start() {
    const Dispatcher = BdApi.Webpack.getModule(
      (m) => m.dispatch && m.subscribe
    );
    const UserStore = BdApi.Webpack.getModule((m) => m.getCurrentUser);

    this.dispatcher = Dispatcher;
    this.userStore = UserStore;

    if (Dispatcher && UserStore) {
      Dispatcher.subscribe("RTC_CONNECTION_STATE", this.handleVoiceStateChange);
      Dispatcher.subscribe("MESSAGE_CREATE", this.handleSendMessage);
      document.addEventListener("click", this.handleClick);
    } else {
      BdApi.showToast("BetterStats: Required modules not found.", {
        type: "error",
      });
    }
  }

  stop() {
    if (this.dispatcher) {
      this.dispatcher.unsubscribe(
        "RTC_CONNECTION_STATE",
        this.handleVoiceStateChange
      );
      this.dispatcher.unsubscribe("MESSAGE_CREATE", this.handleSendMessage);
    }
    document.removeEventListener("click", this.handleClick);

    this.stopTimer();
    this.flushData();
  }

  handleVoiceStateChange(e) {
    if (e.state === "RTC_CONNECTED") {
      this.startTimer();
      this.voiceConnectCount += 1;
      this.scheduleSave();
    } else if (e.state === "RTC_DISCONNECTED") {
      this.stopTimer();
    }
  }

  handleSendMessage(e) {
    const currentUser = this.userStore?.getCurrentUser();
    if (currentUser && e.message.author.id === currentUser.id) {
      this.messageCount += 1;
      this.scheduleSave();
    }
  }

  handleClick() {
    this.clickCount += 1;
    this.scheduleSave();
  }

  startTimer() {
    if (!this.interval) {
      this.startTime = Date.now();
      this.interval = setInterval(() => {
        const elapsed = Date.now() - this.startTime;
        this.totalTime += elapsed;
        this.startTime = Date.now();
        this.scheduleSave();
      }, 1000);
    }
  }

  stopTimer() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      const elapsed = Date.now() - this.startTime;
      this.totalTime += elapsed;
      this.startTime = null;
      this.scheduleSave();
    }
  }

  clearStats() {
    this.totalTime = 0;
    this.messageCount = 0;
    this.voiceConnectCount = 0;
    this.clickCount = 0;
    this.flushData();
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

  getSettingsPanel() {
    return BdApi.React.createElement(SettingsPanel, { plugin: this });
  }
}

class SettingsPanel extends BdApi.React.Component {
  constructor(props) {
    super(props);
    this.plugin = props.plugin;
    this.state = {
      activeTab: "voice",
    };
    this.interval = null;
  }

  componentDidMount() {
    this.interval = setInterval(() => {
      this.setState({
        totalTime: this.plugin.totalTime,
        messageCount: this.plugin.messageCount,
        voiceConnectCount: this.plugin.voiceConnectCount,
        clickCount: this.plugin.clickCount,
      });
    }, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  setActiveTab(tab) {
    this.setState({ activeTab: tab });
  }

  render() {
    const { activeTab } = this.state;
    const totalTime = this.plugin.formatTime(this.plugin.totalTime);
    const { messageCount, voiceConnectCount, clickCount } = this.plugin;

    const tabStyle = (isActive) => ({
      flex: 1,
      padding: "10px",
      marginRight: "5px",
      backgroundColor: isActive ? "#7289da" : "#4f545c",
      color: "#fff",
      border: "none",
      cursor: "pointer",
      textAlign: "center",
      borderRadius: "5px",
      transition: "background-color 0.3s ease",
    });

    const contentStyle = {
      color: "#b9bbbe",
      fontSize: "16px",
      padding: "10px",
      backgroundColor: "#36393f",
      borderRadius: "5px",
    };

    const buttonStyle = {
      marginTop: "20px",
      padding: "10px",
      backgroundColor: "#f04747",
      color: "#fff",
      border: "none",
      cursor: "pointer",
      borderRadius: "5px",
      transition: "background-color 0.3s ease",
    };

    return BdApi.React.createElement(
      "div",
      { style: { padding: "20px" } },
      BdApi.React.createElement(
        "h2",
        { style: { color: "#fff", fontSize: "24px", marginBottom: "10px" } },
        "BetterStats - Statistics"
      ),
      BdApi.React.createElement(
        "div",
        { style: { display: "flex", marginBottom: "10px" } },
        BdApi.React.createElement(
          "button",
          {
            onClick: () => this.setActiveTab("voice"),
            style: tabStyle(activeTab === "voice"),
          },
          "Voice"
        ),
        BdApi.React.createElement(
          "button",
          {
            onClick: () => this.setActiveTab("messages"),
            style: tabStyle(activeTab === "messages"),
          },
          "Messages"
        ),
        BdApi.React.createElement(
          "button",
          {
            onClick: () => this.setActiveTab("clicks"),
            style: tabStyle(activeTab === "clicks"),
          },
          "Clicks"
        )
      ),
      activeTab === "voice" &&
        BdApi.React.createElement(
          "div",
          { style: contentStyle },
          BdApi.React.createElement(
            "strong",
            null,
            "Total time in voice channels:"
          ),
          BdApi.React.createElement("p", null, totalTime),
          BdApi.React.createElement("strong", null, "Total voice connections:"),
          BdApi.React.createElement("p", null, voiceConnectCount)
        ),
      activeTab === "messages" &&
        BdApi.React.createElement(
          "div",
          { style: contentStyle },
          BdApi.React.createElement("strong", null, "Total messages sent:"),
          BdApi.React.createElement("p", null, messageCount)
        ),
      activeTab === "clicks" &&
        BdApi.React.createElement(
          "div",
          { style: contentStyle },
          BdApi.React.createElement("strong", null, "Total clicks:"),
          BdApi.React.createElement("p", null, clickCount)
        ),
      BdApi.React.createElement(
        "button",
        {
          onClick: this.plugin.clearStats,
          style: buttonStyle,
        },
        "Clear Stats"
      )
    );
  }
}

module.exports = BetterStats;
