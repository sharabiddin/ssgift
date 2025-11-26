const { log } = require('../utils/gameUtils');

async function chatCommand(ctx, database) {
    const userId = ctx.from.id;
    
    try {
        const conversations = await database.getConversations(userId);

        if (conversations.length === 0) {
            await ctx.reply('💬 No conversations available. You need to be in a finished Secret Santa game first!');
            return;
        }

        const keyboard = conversations.map(conv => {
            const isGiver = conv.user1_id === userId;
            const partnerName = isGiver ? conv.receiver_name : 'Your Secret Santa';
            const role = isGiver ? '🎁' : '🎅';
            const unreadText = conv.unread_count > 0 ? ` (${conv.unread_count} new)` : '';
            
            return [{
                text: `${role} Game ${conv.game_id} → ${partnerName}${unreadText}`,
                callback_data: `msg_${conv.id}`
            }];
        });

        await ctx.reply(
            '📬 Select a conversation:',
            {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            }
        );
        
        log('Chat command initiated', { userId, conversationCount: conversations.length });
        
    } catch (error) {
        log('Error fetching conversations', { error: error.message, userId });
        await ctx.reply('❌ Error loading conversations. Please try again.');
    }
}

module.exports = chatCommand;