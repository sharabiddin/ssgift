const { Telegraf } = require('telegraf');
const Database = require('./src/database');
const { log } = require('./src/utils/gameUtils');
const { 
    createCommand, 
    joinCommand, 
    completeCommand, 
    chatCommand, 
    inboxCommand, 
    santasCommand 
} = require('./src/commands');
const { textHandler, callbackHandler } = require('./src/handlers');

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error('BOT_TOKEN environment variable is required');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const database = new Database();
const userStates = new Map();

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
        '👤 /santas - Check how many participants joined a game\n' +
        '💬 /chat - Send anonymous messages to your Secret Santa partner\n' +
        '📬 /inbox - View all your conversations\n\n' +
        'To create a game, use /create\n' +
        'Share the game ID with participants so they can /join\n' +
        'When ready, use /complete to assign Secret Santa pairs!'
    );
});

bot.command('complete', (ctx) => completeCommand(ctx, database));
bot.command('test', async (ctx) => {
    await ctx.reply('Test command works!');
    log('Test command triggered', { userId: ctx.from.id });
});
bot.command('chat', (ctx) => chatCommand(ctx, database));
bot.command('inbox', (ctx) => inboxCommand(ctx, database));
bot.command('create', (ctx) => createCommand(ctx, database));
bot.command('join', (ctx) => joinCommand(ctx, userStates));
bot.command('santas', (ctx) => santasCommand(ctx, database));


bot.on('text', (ctx) => textHandler(ctx, userStates, database, bot));
bot.on('callback_query', (ctx) => callbackHandler(ctx, userStates, database, bot));

bot.launch();

console.log('Secret Santa Bot started!');
log('Bot launched successfully');

process.once('SIGINT', () => {
    database.close();
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    database.close();
    bot.stop('SIGTERM');
});

module.exports = { bot, database, log };