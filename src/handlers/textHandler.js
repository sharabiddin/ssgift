const { log, scheduleMessage } = require('../utils/gameUtils');

async function handleSendMessage(ctx, userState, database, bot) {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const { conversationId } = userState;
    const messageText = text.trim();
    
    if (messageText.length < 1 || messageText.length > 500) {
        await ctx.reply('❌ Message must be between 1 and 500 characters. Please try again:');
        return;
    }
    
    try {
        const conversation = await database.getConversation(conversationId, userId);
        
        if (!conversation) {
            await ctx.reply('❌ Conversation not found.');
            return false;
        }
        
        await database.saveMessage(conversationId, userId, messageText);
        
        const isGiver = conversation.user1_id === userId;
        const recipientId = isGiver ? conversation.user2_id : conversation.user1_id;
        const senderRole = isGiver ? '🎁 Gift Giver' : '🎅 Your Secret Santa';
        
        // Schedule notification with random delay (5-15 minutes)
        const delayMinutes = Math.floor(Math.random() * 11) + 5;
        const delay = delayMinutes * 60 * 1000;
        
        const messageContent = `💬 New message in Game *${conversation.game_id}*!\n\n` +
            `From: ${senderRole}\n` +
            `Message: "${messageText}"\n\n` +
            `Use /chat to reply! 💭`;
        
        scheduleMessage(bot, recipientId, messageContent, delay);
        
        await ctx.reply(
            `✅ Message scheduled!\n\n` +
            `🎮 Game ${conversation.game_id}\n` +
            `💬 "${messageText}"\n\n` +
            `📬 Your partner will receive the message in ${delayMinutes} minutes for privacy. They can see it when they type /inbox or /chat`,
            { parse_mode: 'Markdown' }
        );
        
        log('Message scheduled', { 
            conversationId, 
            gameId: conversation.game_id, 
            fromUserId: userId,
            toUserId: recipientId,
            delayMinutes
        });
        
        return true;
        
    } catch (error) {
        log('Error sending message', { error: error.message, userId, conversationId });
        await ctx.reply('❌ Failed to send message. Please try again.');
        return false;
    }
}

async function handleJoinGameId(ctx, userState, database, userStates) {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const gameId = text.trim().toUpperCase();
    
    try {
        const game = await database.getActiveGame(gameId);
        
        if (!game) {
            await ctx.reply('❌ Invalid game ID or game is already finished.');
            return false;
        }
        
        const existingParticipant = await database.getExistingParticipant(gameId, userId);
        
        if (existingParticipant) {
            await ctx.reply('❌ You are already participating in this game!');
            return false;
        }
        
        userStates.set(userId, { action: 'join_display_name', gameId });
        await ctx.reply('✏️ Please enter the name others should see for you in the game:');
        
        return false; // Don't clear state yet
        
    } catch (error) {
        log('Error checking game', { error: error.message, userId, gameId });
        await ctx.reply('❌ Error checking game. Please try again.');
        return false;
    }
}

async function handleJoinDisplayName(ctx, userState, database) {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const displayName = text.trim();
    const gameId = userState.gameId;
    
    if (displayName.length < 1 || displayName.length > 50) {
        await ctx.reply('❌ Name must be between 1 and 50 characters. Please try again:');
        return false;
    }
    
    try {
        await database.addParticipant(gameId, userId, displayName);
        
        await ctx.reply(
            `🎉 Successfully joined game *${gameId}*!\n\n` +
            `Your display name: *${displayName}*\n\n` +
            `Wait for the game owner to finish the game to receive your Secret Santa assignment!`,
            { parse_mode: 'Markdown' }
        );
        
        log('User joined game', { userId, gameId, displayName });
        return true;
        
    } catch (error) {
        log('Error joining game', { error: error.message, userId, gameId, displayName });
        await ctx.reply('❌ Failed to join game. Please try again.');
        return false;
    }
}

async function textHandler(ctx, userStates, database, bot) {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const userState = userStates.get(userId);
    
    log('Text received', { userId, text: text.substring(0, 50), hasUserState: !!userState, action: userState?.action });
    
    if (!userState) return;
    
    let shouldClearState = true;
    
    if (userState.action === 'send_message') {
        shouldClearState = await handleSendMessage(ctx, userState, database, bot);
    } else if (userState.action === 'join_game_id') {
        shouldClearState = await handleJoinGameId(ctx, userState, database, userStates);
    } else if (userState.action === 'join_display_name') {
        shouldClearState = await handleJoinDisplayName(ctx, userState, database);
    }
    
    if (shouldClearState) {
        userStates.delete(userId);
    }
}

module.exports = textHandler;