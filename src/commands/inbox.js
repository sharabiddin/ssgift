const { log } = require('../utils/gameUtils');

async function inboxCommand(ctx, database) {
    const userId = ctx.from.id;
    
    try {
        const conversations = await database.getInboxConversations(userId);

        if (conversations.length === 0) {
            await ctx.reply('📬 Your inbox is empty. Use /chat to start conversations!');
            return;
        }

        let inboxText = '📬 *Your Conversations:*\n\n';
        
        for (const conv of conversations) {
            const isGiver = conv.user1_id === userId;
            const partnerName = isGiver ? conv.receiver_name : 'Your Secret Santa';
            const role = isGiver ? '🎁' : '🎅';
            const preview = conv.last_message ? conv.last_message.substring(0, 30) + '...' : 'No messages yet';
            
            inboxText += `${role} *Game ${conv.game_id}* → ${partnerName}\n`;
            inboxText += `💭 "${preview}"\n\n`;
        }
        
        await ctx.reply(inboxText, { parse_mode: 'Markdown' });
        
        log('Inbox command initiated', { userId, conversationCount: conversations.length });
        
    } catch (error) {
        log('Error fetching inbox', { error: error.message, userId });
        await ctx.reply('❌ Error loading inbox. Please try again.');
    }
}

module.exports = inboxCommand;