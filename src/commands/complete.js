const { log } = require('../utils/gameUtils');

async function completeCommand(ctx, database) {
    const userId = ctx.from.id;
    log('FINISH COMMAND TRIGGERED', { userId });
    
    try {
        const ownedGames = await database.getOwnedActiveGames(userId);

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
}

module.exports = completeCommand;