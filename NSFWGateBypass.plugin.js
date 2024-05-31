/**
 * @name NSFWGateBypass
 * @version 0.0.1
 * @description Allows you to access NSFW channels without setting/verifying your age. plugin ported from Vencord.
 * @author z3phyr
 */

module.exports = (() => {
    const config = {
        info: {
            name: "NSFWGateBypass",
            authors: [
                {
                    name: "z3phyr"
                }
            ],
            version: "0.0.1",
            description: "Allows you to access NSFW channels without setting/verifying your age. plugin ported from Vencord."
        },
        defaultConfig: []
    };

    return !global.ZeresPluginLibrary ? class {
        constructor() { this._config = config; }
        load() {
            BdApi.showConfirmationModal("Library Missing", `The library plugin needed for this plugin is missing. Please click Download Now to install it.`, {
                confirmText: "Download",
                cancelText: "Cancel",
                onConfirm: () => {
                    require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                        require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, () => BdApi.showToast("Library Plugin Downloaded. Please restart Discord to apply changes.", {type: "info"}));
                    });
                }
            });
        }
        start() {}
        stop() {}
    } : (([Plugin, Library]) => {
        const { Patcher, WebpackModules } = Library;
        return class NSFWGateBypass extends Plugin {
            onStart() {
                this.patchNSFWGate();
            }

            onStop() {
                Patcher.unpatchAll();
            }

            patchNSFWGate() {
                const ChannelStore = WebpackModules.getByProps("getChannel");
                const ChannelPatcher = WebpackModules.getByProps("isNSFW");
                Patcher.after(ChannelPatcher, "isNSFW", (thisObject, [channelId], returnValue) => {
                    const channel = ChannelStore.getChannel(channelId);
                    if (channel && channel.nsfw) {
                        return true;
                    }
                    return returnValue;
                });

                const UserStore = WebpackModules.getByProps("getCurrentUser");
                const OriginalUserStore = UserStore.getCurrentUser;
                Patcher.after(UserStore, "getCurrentUser", (thisObject, args, returnValue) => {
                    if (returnValue) {
                        returnValue.nsfwAllowed = true;
                    }
                    return returnValue;
                });
            }
        };
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
