const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/gameUtils');

async function createCommand(ctx, database) {
    const userId = ctx.from.id;
    const gameId = uuidv4().split('-')[0].toUpperCase();
    
    try {
        await database.createGame(gameId, userId);
        
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
}

module.exports = createCommand;