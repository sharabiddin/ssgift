const { Telegraf } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data/games.db');

if (!BOT_TOKEN) {
    console.error('BOT_TOKEN environment variable is required');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const db = new sqlite3.Database(DB_PATH);

const userStates = new Map();

function log(message, data = {}) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        message,
        ...data
    }));
}

bot.start(async (ctx) => {
    await ctx.reply(
        'Welcome to Secret Santa Bot! 🎅\n\n' +
        'Available commands:\n' +
        '/create - Create a new Secret Santa game\n' +
        '/join - Join an existing game\n' +
        '/finish - Finish a game and send assignments\n\n' +
        'Use these commands to organize your gift exchange!'
    );
    log('Bot started', { userId: ctx.from.id, username: ctx.from.username });
});

bot.help(async (ctx) => {
    await ctx.reply(
        'Secret Santa Bot Commands:\n\n' +
        '🎮 /create - Create a new game and get a game ID\n' +
        '👥 /join - Join a game using the game ID\n' +
        '🎁 /complete - Complete the game and send assignments (game owner only)\n' +
        '👤 /santas - Check how many participants joined a game\n\n' +
        'To create a game, use /create\n' +
        'Share the game ID with participants so they can /join\n' +
        'When ready, use /complete to assign Secret Santa pairs!'
    );
});

bot.command('complete', async (ctx) => {
    const userId = ctx.from.id;
    log('FINISH COMMAND TRIGGERED', { userId });
    
    try {
        const ownedGames = await new Promise((resolve, reject) => {
            db.all(
                'SELECT id, status FROM games WHERE owner_id = ? AND status = ? ORDER BY created_at DESC',
                [userId, 'active'],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        log('Finish command - owned games found', { userId, gameCount: ownedGames.length });

        if (ownedGames.length === 0) {
            await ctx.reply('❌ You have no active games to finish. Create a game first!');
            return;
        }

        const keyboard = ownedGames.map(game => [
            { text: `🎁 Finish ${game.id}`, callback_data: `finish_${game.id}` }
        ]);

        await ctx.reply(
            '🎁 Select a game to finish:',
            {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            }
        );
        
        log('Finish command completed', { userId, gameCount: ownedGames.length });
        
    } catch (error) {
        log('Error fetching owned games', { error: error.message, userId });
        await ctx.reply('❌ Error loading your games. Please try again.');
    }
});

bot.command('test', async (ctx) => {
    await ctx.reply('Test command works!');
    log('Test command triggered', { userId: ctx.from.id });
});

bot.command('create', async (ctx) => {
    const userId = ctx.from.id;
    const gameId = uuidv4().split('-')[0].toUpperCase();
    
    try {
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO games (id, owner_id) VALUES (?, ?)',
                [gameId, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        await ctx.reply(
            `🎮 New Secret Santa game created!\n\n` +
            `Game ID: \`${gameId}\`\n\n` +
            `Share this ID with participants. When ready, use the buttons below:`,
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '👤 Check Participants', callback_data: `check_${gameId}` },
                            { text: '🎁 Finish Game', callback_data: `finish_${gameId}` }
                        ]
                    ]
                }
            }
        );
        
        log('Game created', { gameId, ownerId: userId, username: ctx.from.username });
    } catch (error) {
        log('Error creating game', { error: error.message, userId });
        await ctx.reply('❌ Failed to create game. Please try again.');
    }
});

bot.command('join', async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Unknown';
    
    userStates.set(userId, { action: 'join_game_id' });
    
    await ctx.reply(
        '🎮 Please enter the Game ID you want to join:'
    );
    
    log('Join command initiated', { userId, username });
});

bot.command('santas', async (ctx) => {
    const userId = ctx.from.id;
    
    try {
        const userGames = await new Promise((resolve, reject) => {
            db.all(
                'SELECT DISTINCT g.id, g.status FROM games g LEFT JOIN participants p ON g.id = p.game_id WHERE g.owner_id = ? OR p.user_id = ? ORDER BY g.created_at DESC LIMIT 10',
                [userId, userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        if (userGames.length === 0) {
            await ctx.reply('❌ You have no games to check. Create or join a game first!');
            return;
        }

        const keyboard = userGames.map(game => [
            { 
                text: `${game.status === 'active' ? '🟢' : '🔴'} ${game.id}`, 
                callback_data: `check_${game.id}` 
            }
        ]);

        await ctx.reply(
            '👤 Select a game to check participants:',
            {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            }
        );
        
        log('Santas command initiated', { userId, gameCount: userGames.length });
        
    } catch (error) {
        log('Error fetching user games', { error: error.message, userId });
        await ctx.reply('❌ Error loading your games. Please try again.');
    }
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const userState = userStates.get(userId);
    
    if (!userState) return;
    
    if (userState.action === 'join_game_id') {
        const gameId = text.trim().toUpperCase();
        
        try {
            const game = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM games WHERE id = ? AND status = ?',
                    [gameId, 'active'],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            if (!game) {
                await ctx.reply('❌ Invalid game ID or game is already finished.');
                userStates.delete(userId);
                return;
            }
            
            const existingParticipant = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM participants WHERE game_id = ? AND user_id = ?',
                    [gameId, userId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            if (existingParticipant) {
                await ctx.reply('❌ You are already participating in this game!');
                userStates.delete(userId);
                return;
            }
            
            userStates.set(userId, { action: 'join_display_name', gameId });
            await ctx.reply('✏️ Please enter the name others should see for you in the game:');
            
        } catch (error) {
            log('Error checking game', { error: error.message, userId, gameId });
            await ctx.reply('❌ Error checking game. Please try again.');
            userStates.delete(userId);
        }
        
    } else if (userState.action === 'join_display_name') {
        const displayName = text.trim();
        const gameId = userState.gameId;
        
        if (displayName.length < 1 || displayName.length > 50) {
            await ctx.reply('❌ Name must be between 1 and 50 characters. Please try again:');
            return;
        }
        
        try {
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO participants (game_id, user_id, display_name) VALUES (?, ?, ?)',
                    [gameId, userId, displayName],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            
            await ctx.reply(
                `🎉 Successfully joined game *${gameId}*!\n\n` +
                `Your display name: *${displayName}*\n\n` +
                `Wait for the game owner to finish the game to receive your Secret Santa assignment!`,
                { parse_mode: 'Markdown' }
            );
            
            log('User joined game', { userId, gameId, displayName });
            userStates.delete(userId);
            
        } catch (error) {
            log('Error joining game', { error: error.message, userId, gameId, displayName });
            await ctx.reply('❌ Failed to join game. Please try again.');
            userStates.delete(userId);
        }
    }
});

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function generateAssignments(participants) {
    const maxRetries = 100;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const shuffled = shuffleArray(participants);
        const assignments = [];
        let valid = true;
        
        for (let i = 0; i < shuffled.length; i++) {
            const giver = shuffled[i];
            const receiver = shuffled[(i + 1) % shuffled.length];
            
            if (giver.user_id === receiver.user_id) {
                valid = false;
                break;
            }
            
            assignments.push({
                giver: giver,
                receiver: receiver
            });
        }
        
        if (valid) {
            return assignments;
        }
    }
    
    return null;
}

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const userState = userStates.get(userId);
    
    if (!userState) return;
    
    if (userState.action === 'check_santas_game_id') {
        const gameId = text.trim().toUpperCase();
        
        try {
            const game = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM games WHERE id = ?',
                    [gameId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            if (!game) {
                await ctx.reply('❌ Game not found.');
                userStates.delete(userId);
                return;
            }
            
            const participants = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT display_name FROM participants WHERE game_id = ? ORDER BY joined_at',
                    [gameId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });
            
            const participantNames = participants.map(p => p.display_name).join('\n• ');
            const status = game.status === 'active' ? '🟢 Active' : '🔴 Finished';
            
            await ctx.reply(
                `👤 Game *${gameId}* Status:\n\n` +
                `Status: ${status}\n` +
                `Participants: *${participants.length}*\n\n` +
                (participants.length > 0 ? `• ${participantNames}` : 'No participants yet'),
                { parse_mode: 'Markdown' }
            );
            
            log('Checked game participants', { gameId, participantCount: participants.length, userId });
            userStates.delete(userId);
            
        } catch (error) {
            log('Error checking game participants', { error: error.message, userId, gameId });
            await ctx.reply('❌ Error checking game. Please try again.');
            userStates.delete(userId);
        }
        
    } else if (userState.action === 'finish_game_id') {
        const gameId = text.trim().toUpperCase();
        
        try {
            const game = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM games WHERE id = ? AND owner_id = ? AND status = ?',
                    [gameId, userId, 'active'],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            if (!game) {
                await ctx.reply('❌ Game not found, you are not the owner, or game is already finished.');
                userStates.delete(userId);
                return;
            }
            
            const participants = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM participants WHERE game_id = ?',
                    [gameId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });
            
            if (participants.length < 2) {
                await ctx.reply('❌ Only you joined the game. Need at least 2 participants to finish.');
                userStates.delete(userId);
                return;
            }
            
            const assignments = generateAssignments(participants);
            
            if (!assignments) {
                await ctx.reply('❌ Failed to generate valid assignments after multiple attempts. Please try again.');
                userStates.delete(userId);
                return;
            }
            
            for (const assignment of assignments) {
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE participants SET assigned_to = ? WHERE game_id = ? AND user_id = ?',
                        [assignment.receiver.user_id, gameId, assignment.giver.user_id],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
            
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE games SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?',
                    ['finished', gameId],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            
            for (const assignment of assignments) {
                try {
                    await bot.telegram.sendMessage(
                        assignment.giver.user_id,
                        `🎅 Your Secret Santa assignment for game *${gameId}*:\n\n` +
                        `You will buy a gift for: *${assignment.receiver.display_name}*\n\n` +
                        `Happy gift giving! 🎁`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (error) {
                    log('Failed to send assignment', { 
                        gameId, 
                        giverId: assignment.giver.user_id, 
                        receiverName: assignment.receiver.display_name,
                        error: error.message 
                    });
                }
            }
            
            await ctx.reply(
                `🎉 Game *${gameId}* finished successfully!\n\n` +
                `All ${participants.length} participants have been sent their Secret Santa assignments via private message.\n\n` +
                `Happy Secret Santa! 🎅🎁`,
                { parse_mode: 'Markdown' }
            );
            
            log('Game finished', { gameId, participantCount: participants.length });
            userStates.delete(userId);
            
        } catch (error) {
            log('Error finishing game', { error: error.message, userId, gameId });
            await ctx.reply('❌ Failed to finish game. Please try again.');
            userStates.delete(userId);
        }
    } else if (userState.action === 'join_game_id') {
        const gameId = text.trim().toUpperCase();
        
        try {
            const game = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM games WHERE id = ? AND status = ?',
                    [gameId, 'active'],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            if (!game) {
                await ctx.reply('❌ Invalid game ID or game is already finished.');
                userStates.delete(userId);
                return;
            }
            
            const existingParticipant = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM participants WHERE game_id = ? AND user_id = ?',
                    [gameId, userId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            if (existingParticipant) {
                await ctx.reply('❌ You are already participating in this game!');
                userStates.delete(userId);
                return;
            }
            
            userStates.set(userId, { action: 'join_display_name', gameId });
            await ctx.reply('✏️ Please enter the name others should see for you in the game:');
            
        } catch (error) {
            log('Error checking game', { error: error.message, userId, gameId });
            await ctx.reply('❌ Error checking game. Please try again.');
            userStates.delete(userId);
        }
        
    } else if (userState.action === 'join_display_name') {
        const displayName = text.trim();
        const gameId = userState.gameId;
        
        if (displayName.length < 1 || displayName.length > 50) {
            await ctx.reply('❌ Name must be between 1 and 50 characters. Please try again:');
            return;
        }
        
        try {
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO participants (game_id, user_id, display_name) VALUES (?, ?, ?)',
                    [gameId, userId, displayName],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            
            await ctx.reply(
                `🎉 Successfully joined game *${gameId}*!\n\n` +
                `Your display name: *${displayName}*\n\n` +
                `Wait for the game owner to finish the game to receive your Secret Santa assignment!`,
                { parse_mode: 'Markdown' }
            );
            
            log('User joined game', { userId, gameId, displayName });
            userStates.delete(userId);
            
        } catch (error) {
            log('Error joining game', { error: error.message, userId, gameId, displayName });
            await ctx.reply('❌ Failed to join game. Please try again.');
            userStates.delete(userId);
        }
    }
});

bot.on('callback_query', async (ctx) => {
    const userId = ctx.from.id;
    const data = ctx.callbackQuery.data;
    
    await ctx.answerCbQuery();
    
    if (data.startsWith('check_')) {
        const gameId = data.replace('check_', '');
        
        try {
            const game = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM games WHERE id = ?',
                    [gameId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            if (!game) {
                await ctx.editMessageText('❌ Game not found.');
                return;
            }
            
            const participants = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT display_name FROM participants WHERE game_id = ? ORDER BY joined_at',
                    [gameId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });
            
            const participantNames = participants.map(p => p.display_name).join('\n• ');
            const status = game.status === 'active' ? '🟢 Active' : '🔴 Finished';
            
            await ctx.editMessageText(
                `👤 Game *${gameId}* Status:\n\n` +
                `Status: ${status}\n` +
                `Participants: *${participants.length}*\n\n` +
                (participants.length > 0 ? `• ${participantNames}` : 'No participants yet'),
                { parse_mode: 'Markdown' }
            );
            
            log('Checked game participants via button', { gameId, participantCount: participants.length, userId });
            
        } catch (error) {
            log('Error checking game participants via button', { error: error.message, userId, gameId });
            await ctx.editMessageText('❌ Error checking game. Please try again.');
        }
        
    } else if (data.startsWith('finish_')) {
        const gameId = data.replace('finish_', '');
        
        try {
            const game = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM games WHERE id = ? AND owner_id = ? AND status = ?',
                    [gameId, userId, 'active'],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            if (!game) {
                await ctx.editMessageText('❌ Game not found, you are not the owner, or game is already finished.');
                return;
            }
            
            const participants = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM participants WHERE game_id = ?',
                    [gameId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });
            
            if (participants.length < 2) {
                await ctx.editMessageText('❌ Only you joined the game. Need at least 2 participants to finish.');
                return;
            }
            
            const assignments = generateAssignments(participants);
            
            if (!assignments) {
                await ctx.editMessageText('❌ Failed to generate valid assignments after multiple attempts. Please try again.');
                return;
            }
            
            for (const assignment of assignments) {
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE participants SET assigned_to = ? WHERE game_id = ? AND user_id = ?',
                        [assignment.receiver.user_id, gameId, assignment.giver.user_id],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
            
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE games SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?',
                    ['finished', gameId],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            
            for (const assignment of assignments) {
                try {
                    await bot.telegram.sendMessage(
                        assignment.giver.user_id,
                        `🎅 Your Secret Santa assignment for game *${gameId}*:\n\n` +
                        `You will buy a gift for: *${assignment.receiver.display_name}*\n\n` +
                        `Happy gift giving! 🎁`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (error) {
                    log('Failed to send assignment via button', { 
                        gameId, 
                        giverId: assignment.giver.user_id, 
                        receiverName: assignment.receiver.display_name,
                        error: error.message 
                    });
                }
            }
            
            await ctx.editMessageText(
                `🎉 Game *${gameId}* finished successfully!\n\n` +
                `All ${participants.length} participants have been sent their Secret Santa assignments via private message.\n\n` +
                `Happy Secret Santa! 🎅🎁`,
                { parse_mode: 'Markdown' }
            );
            
            log('Game finished via button', { gameId, participantCount: participants.length });
            
        } catch (error) {
            log('Error finishing game via button', { error: error.message, userId, gameId });
            await ctx.editMessageText('❌ Failed to finish game. Please try again.');
        }
    }
});

bot.launch();

console.log('Secret Santa Bot started!');
log('Bot launched successfully');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = { bot, db, log };