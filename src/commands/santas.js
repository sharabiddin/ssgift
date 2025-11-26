const { log } = require('../utils/gameUtils');

async function santasCommand(ctx, database) {
    const userId = ctx.from.id;
    
    try {
        const userGames = await database.getUserGames(userId, 3);

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
}

module.exports = santasCommand;