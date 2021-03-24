const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const config = require('../config');

module.exports = {
    // set message of specific type
    // linked to SET_MESSAGE command
    "getMsg" : async function (type) {
        // open db
        let db = await sqlite.open({
        filename: config.db_path,
        driver: sqlite3.Database,
        });
    
        // get message of specific type
        let row = null;
        try {
        row = await db.get('SELECT message FROM messages WHERE message_id = ?', [type]);
        } catch (e) {
        console.error(e.toString());
        await db.close();
        return [{ message: e.toString() }, null];
        }
        await db.close();
        if (!row) {
        return [
            null,
            `Message type: ${type} not found`
        ];
        }
    
        return [
        null,
        row.message
        ];
    },

    // get message content of specific type
    // linked to GET_MESSAGE command
    "setMsg" : async function (type, msg) {
        // open db
        let db = await sqlite.open({
        filename: config.db_path,
        driver: sqlite3.Database,
        });
    
        // update message of specific type
        try {
        await db.run(`
    UPDATE messages
    SET message = ?
    WHERE
        message_id = ?`,
        [msg, type]
        );
        } catch (e) {
        console.error(e.toString());
        await db.close();
        return [{ message: e.toString() }, null];
        }
    
        await db.close();
        return [
        null,
        `Successfully changed the ${type} message!`
        ];
    }
}