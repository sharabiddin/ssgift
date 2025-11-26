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

function log(message, data = {}) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        message,
        ...data
    }));
}

function scheduleMessage(bot, recipientId, messageContent, delay) {
    setTimeout(async () => {
        try {
            await bot.telegram.sendMessage(recipientId, messageContent, { parse_mode: 'Markdown' });
            log('Scheduled message delivered', { recipientId, delay });
        } catch (error) {
            log('Failed to send scheduled message notification', { 
                recipientId,
                error: error.message 
            });
        }
    }, delay);
}

module.exports = {
    shuffleArray,
    generateAssignments,
    log,
    scheduleMessage
};