const Gists = require("gists");

const DATA_FILE_NAME = "onetab-data.json";
const META_DATA_NAME = "metadata.json";
const BACKUP_DATAFILE_NAME = "onetab-data-backup.json";
const SYNC_DATE = Date.now();
const DATA_VERSION = 1;

import conf from "./conf";

const upload = (config, content) => {
    const gists = new Gists({token: config.gist_token});
    let opts = {
        description: "created by onetab sync",
        public: false,
        files: { 
            [DATA_FILE_NAME]: { content: content },
            [META_DATA_NAME]: { content: JSON.stringify({lastsync: SYNC_DATE, version: DATA_VERSION }) },
        }
    };

    return new Promise((resolve, reject) => {
        const create = () => {
            gists.post('/gists', opts, (err, res) => {
                if (err) {
                    reject(err);
                } else if (res.id) {
                    config.gist_id = res.id;
                    config.lastsync = SYNC_DATE;
                    conf.save(config);
                    resolve(res);
                }
            });
        };

        if (typeof config.gist_id !== "undefined" && config.gist_id != "") {
            opts.id = config.gist_id;
            gists.edit(opts, (err, res) => {
                if (err) {
                    reject(err);
                } else if (res.files) {
                    config.lastsync = SYNC_DATE;
                    conf.save(config);
                    resolve(res);
                } else {
                    create();
                }
            });
        } else {
            create();
        }
    });
};

const backup = (config, content) => {
    if (typeof config.gist_id === "undefined" || config.gist_id == "") {
        return Promise.reject(new Error("failed to backup. gist id is not given."))
    }

    const gists = new Gists({token: config.gist_token});
    let opts = {
        id: config.gist_id,
        files: {
            [BACKUP_DATAFILE_NAME]: { content: content }
        },
    };
    return new Promise((resolve, reject) => {
        gists.edit(opts, (err, res) => {
            if (res && res.files) {
                resolve(res);
            } else {
                reject(err || res);
            }
        })
    });
}

const download = (config) => {
    const gists = new Gists({token: config.gist_token});
    return new Promise((resolve, reject) => {
        gists.download({id: config.gist_id}, (err, res) => {
            if (err) {
                reject(err);
            } else if (res.files && res.files[DATA_FILE_NAME]) {
                let content = res.files[DATA_FILE_NAME].content;
                let metadata = res.files[META_DATA_NAME].content || "{}";
                resolve([content, JSON.parse(metadata)]);
            } else {
                reject(res);
            }
        });
    })
};

export default {
    upload: upload,
    download: download,
    backup: backup,
}
