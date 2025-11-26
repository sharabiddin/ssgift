const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/games.db');

class Database {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
    }

    async getGame(gameId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM games WHERE id = ?',
                [gameId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async getActiveGame(gameId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM games WHERE id = ? AND status = ?',
                [gameId, 'active'],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async getOwnedActiveGames(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT id, status FROM games WHERE owner_id = ? AND status = ? ORDER BY created_at DESC',
                [userId, 'active'],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getUserGames(userId, limit = 3) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT DISTINCT g.id, g.status FROM games g LEFT JOIN participants p ON g.id = p.game_id WHERE g.owner_id = ? OR p.user_id = ? ORDER BY g.created_at DESC LIMIT ?',
                [userId, userId, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async createGame(gameId, userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO games (id, owner_id) VALUES (?, ?)',
                [gameId, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async getParticipants(gameId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM participants WHERE game_id = ?',
                [gameId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getParticipantNames(gameId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT display_name FROM participants WHERE game_id = ? ORDER BY joined_at',
                [gameId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getExistingParticipant(gameId, userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM participants WHERE game_id = ? AND user_id = ?',
                [gameId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async addParticipant(gameId, userId, displayName) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO participants (game_id, user_id, display_name) VALUES (?, ?, ?)',
                [gameId, userId, displayName],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async updateParticipantAssignment(gameId, giverId, receiverId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE participants SET assigned_to = ? WHERE game_id = ? AND user_id = ?',
                [receiverId, gameId, giverId],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async finishGame(gameId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE games SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['finished', gameId],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async getConversations(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT c.id, c.game_id, c.user1_id, c.user2_id,
                        p1.display_name as giver_name, p2.display_name as receiver_name,
                        COUNT(m.id) as unread_count
                 FROM conversations c
                 JOIN participants p1 ON c.user1_id = p1.user_id AND c.game_id = p1.game_id
                 JOIN participants p2 ON c.user2_id = p2.user_id AND c.game_id = p2.game_id
                 LEFT JOIN messages m ON c.id = m.conversation_id
                 WHERE c.user1_id = ? OR c.user2_id = ?
                 GROUP BY c.id, c.game_id, c.user1_id, c.user2_id, p1.display_name, p2.display_name
                 ORDER BY c.created_at DESC`,
                [userId, userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getInboxConversations(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT c.id, c.game_id, c.user1_id, c.user2_id,
                        p1.display_name as giver_name, p2.display_name as receiver_name,
                        m.message as last_message, m.timestamp as last_timestamp
                 FROM conversations c
                 JOIN participants p1 ON c.user1_id = p1.user_id AND c.game_id = p1.game_id
                 JOIN participants p2 ON c.user2_id = p2.user_id AND c.game_id = p2.game_id
                 LEFT JOIN messages m ON c.id = m.conversation_id
                 WHERE (c.user1_id = ? OR c.user2_id = ?) AND m.id = (
                     SELECT MAX(m2.id) FROM messages m2 WHERE m2.conversation_id = c.id
                 )
                 ORDER BY m.timestamp DESC`,
                [userId, userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getConversation(conversationId, userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT c.*, p1.display_name as giver_name, p2.display_name as receiver_name
                 FROM conversations c
                 JOIN participants p1 ON c.user1_id = p1.user_id AND c.game_id = p1.game_id
                 JOIN participants p2 ON c.user2_id = p2.user_id AND c.game_id = p2.game_id
                 WHERE c.id = ? AND (c.user1_id = ? OR c.user2_id = ?)`,
                [conversationId, userId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async getMessages(conversationId, limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC LIMIT ?',
                [conversationId, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async createConversation(gameId, user1Id, user2Id) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO conversations (game_id, user1_id, user2_id) VALUES (?, ?, ?)',
                [gameId, user1Id, user2Id],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async saveMessage(conversationId, userId, messageText) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO messages (conversation_id, from_user_id, message) VALUES (?, ?, ?)',
                [conversationId, userId, messageText],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = Database;