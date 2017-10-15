const levelup = require("levelup");
const leveldown = require("leveldown");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

export const openOneTabDB = async (config) => {
    try {
        return await openSqliteDb(config);
    } catch (_) { try {
        return await openLevelDb(config);
    } catch(e) {
        return Promise.reject(e);
    } }
}

const openLevelDb = async (config, pathForTest) => {
    let path;
    if (!pathForTest) {
        path = config.chrome_profile_path + "/Local Storage/leveldb";
    } else {
        path = pathForTest;
    }

    try {
        let db = await levelup(leveldown(path), {createIfMissing: false});
        return new Promise((resolve, reject) => {
            let resolved = false;
            db.createKeyStream().on("data", (data) => {
                let key = data.toString();
                if(key.startsWith("_chrome-extension://" + config.onetab_ext_id) && key.endsWith("state")) {
                    resolve(createLevelDBInterface(db, key));
                    resolved = true;
                }
            }).on("end", () => {
                if (!resolved) {
                    reject(new Error("one tab data is not found."));
                }
            });
        })
    } catch (err) {
        return Promise.reject("can't open chrome localstorage db. If browser is running, please quit." + err.message);
    }
};

const createLevelDBInterface = (db, key) => {
    return {
        get: async () => {
            try {
                let value = await db.get(key);
                return value.slice(1).toString('ucs2');
            } catch (e) {
                return Promise.reject(e);
            }
        },
        put: async (value) => {
            try {
                let buf =  Buffer.concat([Buffer.from([0x00]), new Buffer(value, "ucs2")]);
                return await db.put(key, buf);
            } catch (e) {
                return Promise.reject(e);
            }
        },
        close: async () => {
            return db.close();
        }
    }
};

const openSqliteDb = (config, pathForTest) => {
    let path;
    if (!pathForTest) {
        path = config.chrome_profile_path + "/Local Storage/chrome-extension_" + config.onetab_ext_id + "_0.localstorage";
    } else {
        path = pathForTest;
    }

    return new Promise((resolve, reject) => {
        try {
            fs.accessSync(path);
        } catch (e) {
            reject (e);
            return;
        }

        let db = new sqlite3.Database(path);
        db.serialize(() => {
            db.get("SELECT key,value FROM ItemTable WHERE key = ?", "state", (err, row) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(createSqliteDBInterface(db, row.key));
                }
            })
        })
    });
}

const createSqliteDBInterface = (db, key) => {
    return {
        get: () => new Promise((resolve, reject) => {
            db.get("SELECT key,value FROM ItemTable WHERE key = '" + key +  "'", (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.value.toString("ucs2"));
                }
            })
        }),
        put: (value) => new Promise((resolve, reject) => {
            db.run("UPDATE ItemTable SET value = ? WHERE key = ?", new Buffer(value, "ucs2"), key, (err, res) => {
                if (err) {
                    reject(err)
                } else {
                    resolve();
                }
            })
        }),
        close: () => {
            return new Promise((resolve, reject) => {
                db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                })
            })
        }
    }
};

export default openOneTabDB;
