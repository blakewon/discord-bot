require('dotenv').config()

const fetch = require("node-fetch");
const fs = require('fs');
const Discord = require('discord.js');
const Client = require('./client/Client');
const config = require('./config.json');
const {Player} = require('discord-player');
const {Queue} = require('discord-player');
const {QueryType} = require('discord-player');
const {ActivityType} = require('discord.js');

// at the top of your file
const {EmbedBuilder} = require('discord.js');

const client = new Client();
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

let ggltoken = "AIzaSyB2mKxQb79fMyfx-vdYJ4dDXzUOJhRwl3Y"
let previous_songs = [];

console.log(client.commands);

const player = new Player(client);


player.on('connectionCreate', (queue) => {
    previous_songs = [];

    queue.connection.voiceConnection.on('stateChange', (oldState, newState) => {
        const oldNetworking = Reflect.get(oldState, 'networking');
        const newNetworking = Reflect.get(newState, 'networking');

        const networkStateChangeHandler = (oldNetworkState, newNetworkState) => {
            const newUdp = Reflect.get(newNetworkState, 'udp');
            clearInterval(newUdp?.keepAliveInterval);
        }

        oldNetworking?.off('stateChange', networkStateChangeHandler);
        newNetworking?.on('stateChange', networkStateChangeHandler);
    });
});

player.on('error', (queue, error) => {
    console.log(`[${queue.guild.name}] Error emitted from the queue: ${error.message}`);
});

player.on('connectionError', (queue, error) => {
    console.log(`[${queue.guild.name}] Error emitted from the connection: ${error.message}`);
});

player.on('trackStart', (queue, track) => {
    const exampleEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(track.title)
        .addFields({
            name: '▶ | Now playing', value: 'Author: **' + track.author + '**\nDuration: **' + track.duration + '**'
        },)
        // .setThumbnail(track.thumbnail)
        .setURL(queue.current.url)
        .setFooter({
            text: 'Requested by: ' + track.requestedBy.username,
            iconURL: track.requestedBy.username === "Fleurtje" ? "https://cdn.discordapp.com/app-icons/266301504460161024/edc729aea5b590bee18a57ccb63d5080.png?size=256" : track.requestedBy.avatarURL()
        });
    queue.metadata.send({embeds: [exampleEmbed]});
});

player.on('trackAdd', (queue, track) => {
    queue.metadata.send(`🎶 | Track **${track.title}** queued!`);
    previous_songs.push(track.url.split('?v=')[1]);
});

player.on('botDisconnect', queue => {
    queue.metadata.send('❌ | I was manually disconnected from the voice channel, clearing queue!');
});

player.on('channelEmpty', queue => {
    queue.metadata.send('❌ | Nobody is in the voice channel, leaving...');
});

player.on('queueEnd', queue => {
    fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${previous_songs[previous_songs.length - 1]}&type=video&key=` + ggltoken)
        .then(response => response.json())
        .then(data => {
            for (let i in data['items']){
                if (!previous_songs.includes(data['items'][i]['id']['videoId'])) {
                    let toPlay = data['items'][i]['id']['videoId']
                    player.search(toPlay, {
                        requestedBy: client.user, searchEngine: QueryType.AUTO,
                    })
                        .then(data => {
                            queue.addTrack(data['tracks'][0])
                            queue.forceNext()
                        })
                    break;
                }
            }
        })
        .catch(error => console.error(error));
});

//data['items'][0]['id']['videoId'])

client.once('ready', async () => {
    console.log('Ready!');
});


client.on('ready', function () {
    client.user.setPresence({
        activities: [{name: config.activity, type: Number(config.activityType)}],
        status: Discord.PresenceUpdateStatus.Online,
    });
});

client.once('reconnecting', () => {
    console.log('Reconnecting!');
});

client.once('disconnect', () => {
    console.log('Disconnect!');
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    if (!client.application?.owner) await client.application?.fetch();

    if (message.content === '!deploy' && message.author.id === client.application?.owner?.id) {
        await message.guild.commands
            .set(client.commands)
            .then(() => {
                message.reply('Deployed!');
            })
            .catch(err => {
                message.reply('Could not deploy commands! Make sure the bot has the application.commands permission!');
                console.error(err);
            });
    }
});

client.on('interactionCreate', async interaction => {
    const command = client.commands.get(interaction.commandName.toLowerCase());

    try {
        if (interaction.commandName == 'ban' || interaction.commandName == 'userinfo') {
            command.execute(interaction, client);
        } else {
            command.execute(interaction, player);
        }
    } catch (error) {
        console.error(error);
        interaction.followUp({
            content: 'There was an error trying to execute that command!',
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
