const { log, generateAssignments } = require('../utils/gameUtils');

async function handleCheck(ctx, gameId, database) {
    try {
        const game = await database.getGame(gameId);
        
        if (!game) {
            await ctx.editMessageText('❌ Game not found.');
            return;
        }
        
        const participants = await database.getParticipantNames(gameId);
        
        const participantNames = participants.map(p => p.display_name).join('\n• ');
        const status = game.status === 'active' ? '🟢 Active' : '🔴 Finished';
        
        await ctx.editMessageText(
            `👤 Game *${gameId}* Status:\n\n` +
            `Status: ${status}\n` +
            `Participants: *${participants.length}*\n\n` +
            (participants.length > 0 ? `• ${participantNames}` : 'No participants yet'),
            { parse_mode: 'Markdown' }
        );
        
        log('Checked game participants via button', { gameId, participantCount: participants.length, userId: ctx.from.id });
        
    } catch (error) {
        log('Error checking game participants via button', { error: error.message, userId: ctx.from.id, gameId });
        await ctx.editMessageText('❌ Error checking game. Please try again.');
    }
}

async function handleFinish(ctx, gameId, database, bot) {
    const userId = ctx.from.id;
    
    try {
        const game = await database.getGame(gameId);
        
        if (!game || game.owner_id !== userId || game.status !== 'active') {
            await ctx.editMessageText('❌ Game not found, you are not the owner, or game is already finished.');
            return;
        }
        
        const participants = await database.getParticipants(gameId);
        
        if (participants.length === 0) {
            await ctx.editMessageText('🎮 Game completed with 0 participants. Game has been closed.');
            await database.finishGame(gameId);
            log('Game finished with 0 participants', { gameId });
            return;
        }
        
        if (participants.length === 1) {
            await ctx.editMessageText('❌ Only you joined the game. Need at least 2 participants for Secret Santa assignments.');
            return;
        }
        
        const assignments = generateAssignments(participants);
        
        if (!assignments) {
            await ctx.editMessageText('❌ Failed to generate valid assignments after multiple attempts. Please try again.');
            return;
        }
        
        // Update assignments in database
        for (const assignment of assignments) {
            await database.updateParticipantAssignment(gameId, assignment.giver.user_id, assignment.receiver.user_id);
        }
        
        await database.finishGame(gameId);
        
        // Create conversations for anonymous messaging
        for (const assignment of assignments) {
            try {
                await database.createConversation(gameId, assignment.giver.user_id, assignment.receiver.user_id);
            } catch (error) {
                log('Failed to create conversation', { 
                    gameId, 
                    giverId: assignment.giver.user_id, 
                    receiverId: assignment.receiver.user_id,
                    error: error.message 
                });
            }
        }
        
        // Send assignments to participants
        for (const assignment of assignments) {
            try {
                await bot.telegram.sendMessage(
                    assignment.giver.user_id,
                    `🎅 Your Secret Santa assignment for game *${gameId}*:\n\n` +
                    `You will buy a gift for: *${assignment.receiver.display_name}*\n\n` +
                    `Use /chat to send anonymous messages! 💬\n\n` +
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

async function handleMessage(ctx, conversationId, database, userId) {
    try {
        const conversation = await database.getConversation(conversationId, userId);
        
        if (!conversation) {
            await ctx.editMessageText('❌ Conversation not found.');
            return;
        }
        
        const messages = await database.getMessages(conversationId, 10);
        
        const isGiver = conversation.user1_id === userId;
        const partnerName = isGiver ? conversation.receiver_name : 'Your Secret Santa';
        const role = isGiver ? '🎁' : '🎅';
        
        let conversationText = `${role} *Game ${conversation.game_id}* → ${partnerName}\n\n`;
        
        if (messages.length === 0) {
            conversationText += '💭 No messages yet. Start the conversation!\n\n';
        } else {
            for (const msg of messages.slice(-5)) {
                const isFromMe = msg.from_user_id === userId;
                const sender = isFromMe ? 'You' : (isGiver ? conversation.receiver_name : 'Your Secret Santa');
                conversationText += `💬 ${sender}: ${msg.message}\n\n`;
            }
        }
        
        conversationText += '✏️ Send a message to continue the conversation!';
        
        await ctx.editMessageText(
            conversationText,
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💬 Send Message', callback_data: `send_${conversationId}` }],
                        [{ text: '🔙 Back to Conversations', callback_data: 'back_conversations' }]
                    ]
                }
            }
        );
        
        log('Conversation opened', { userId, conversationId, gameId: conversation.game_id });
        
    } catch (error) {
        log('Error opening conversation', { error: error.message, userId, conversationId });
        await ctx.editMessageText('❌ Error opening conversation. Please try again.');
    }
}

async function handleSend(ctx, conversationId, userStates) {
    const userId = ctx.from.id;
    
    userStates.set(userId, { action: 'send_message', conversationId });
    
    await ctx.answerCbQuery('Type your message...');
    await ctx.editMessageText('💬 Type your message and send it:');
    
    log('Message input initiated', { userId, conversationId });
}

async function callbackHandler(ctx, userStates, database, bot) {
    const userId = ctx.from.id;
    const data = ctx.callbackQuery.data;
    
    await ctx.answerCbQuery();
    
    if (data.startsWith('check_')) {
        const gameId = data.replace('check_', '');
        await handleCheck(ctx, gameId, database);
        
    } else if (data.startsWith('finish_')) {
        const gameId = data.replace('finish_', '');
        await handleFinish(ctx, gameId, database, bot);
        
    } else if (data.startsWith('msg_')) {
        const conversationId = parseInt(data.replace('msg_', ''));
        await handleMessage(ctx, conversationId, database, userId);
        
    } else if (data.startsWith('send_')) {
        const conversationId = parseInt(data.replace('send_', ''));
        await handleSend(ctx, conversationId, userStates);
    }
}

module.exports = callbackHandler;