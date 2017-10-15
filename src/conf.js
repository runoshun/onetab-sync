const fs = require("fs");
const os = require("os");

const inquirer = require("inquirer");

const CONFIG = os.homedir() + "/.onetab-sync.json"

const QUESTIONS = {
    "chrome_profile_path": [{
        type: "list",
        name: "chrome_profile_path",
        message: "Select the path to user profile directory of Chrome ",
        choices: () => {
            let canditates = findProfiles();
            canditates.push("custom");
            return canditates;
        },
    }, {
        type: "input",
        name: "chrome_profile_path",
        when: (answer) => answer && answer.chrome_profile_path === "custom",
        message: "Please input",
        validate: (value) => {
            try {
                fs.accessSync(value);
                return true;
            } catch (e) {
                return false;
            }
        },
    }],
    "onetab_ext_id": [{
        type: "input",
        name: "onetab_ext_id",
        default: (answer) => {
            return answer.chrome_profile_path ? findOneTabExtensionID(answer.chrome_profile_path) : undefined
        },
        message: "Input the extension ID of OneTab.",
        validate: (value) => !!value,
    }],
    "gist_token": [{
        type: "input",
        name: "gist_token",
        message: "Input your gist access token.",
        validate: (value) => !!value,
    }],
    "gist_id": [{
        type: "input",
        name: "gist_id",
        message: "Input the gist ID which OneTab data is stored.",
        validate: (value) => !!value,
    }],
};

const loadConfig = (requests) => {
    return new Promise((resolve, reject) => {
        let config = {}
        try {
            config = JSON.parse(fs.readFileSync(CONFIG));
        } catch(e) {
            if (e.code !== "ENOENT") {
                reject(e);
            }
        }

        let qs = []
        requests.forEach(name => {
            if (!config[name]) {
                qs = qs.concat(QUESTIONS[name]);
            }
        });
        inquirer.prompt(qs).then(answers => {
            let result = Object.assign(config, answers);
            if (Object.keys(answers).length > 0) {
                saveConfig(result);
                console.info("configuration is saved in " + CONFIG);
            }
            resolve(result);
        });
    });
};

const PROFILE_DIRS = {
    "win32": [
        os.homedir() + "\\AppData\\Local\\Google\\Chrome\\User Data\\Default",
        os.homedir() + "\\AppData\\Local\\Google\\Chrome SxS\\User Data\\Default",
        os.homedir() + "\\AppData\\Local\\Chromium\\User Data\\Default",
        os.homedir() + "\\AppData\\Local\\Vivaldi\\User Data\\Default",
    ],
    "linux": [
        os.homedir() + "/.config/google-chrome/Default",
        os.homedir() + "/.config/google-chrome-beta/Default",
        os.homedir() + "/.config/google-chrome-unstable/Default",
        os.homedir() + "/.config/chromium/Default",
        os.homedir() + "/.config/vivaldi/Default",
    ],
    "darwin": [
        os.homedir() + "/Library/Application Support/Google/Chrome/Default",
        os.homedir() + "~/Library/Application Support/Google/Chrome Canary/Default",
        os.homedir() + "~/Library/Application Support/Chromium/Default",
        os.homedir() + "~/Library/Application Support/Vivaldi/Default",
    ]
}
const findProfiles = () => {
    const dirs = PROFILE_DIRS[os.platform()];
    let profiles = [];
    if (dirs) {
        dirs.forEach(dir => {
            try {
                if (fs.statSync(dir).isDirectory()) {
                    profiles.push(dir);
                }
            } catch (e) { /* skip */ }
        })
    }
    return profiles;
};

const findOneTabExtensionID = (profileDir) => {
    let extsDir = profileDir + "/Extensions";
    let id = undefined;
    fs.readdirSync(extsDir).forEach(ext => {
        try {
            let extDir = extsDir + "/" + ext.toString();
            fs.readdirSync(extDir).forEach(version => {
                let versionDir = extDir + "/" + version.toString();
                try {
                    fs.readdirSync(versionDir).forEach(file => {
                        if (file.toString() === "onetab.html") {
                            id = ext.toString();
                        }
                    })
                } catch (e) { /* skip */ }
            })
        } catch (e) { /* skip */ }
    });
    return id;
};

const saveConfig = (value) => {
    fs.writeFileSync(CONFIG, JSON.stringify(value));
};

export default {
    load: loadConfig,
    save: saveConfig,
};
