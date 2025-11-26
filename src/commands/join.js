const { log } = require('../utils/gameUtils');

async function joinCommand(ctx, userStates) {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Unknown';
    
    userStates.set(userId, { action: 'join_game_id' });
    
    await ctx.reply(
        '🎮 Please enter the Game ID you want to join:'
    );
    
    log('Join command initiated', { userId, username });
}

module.exports = joinCommand;