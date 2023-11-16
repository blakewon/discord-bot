require('dotenv').config()

const fetch = require("node-fetch");
const fs = require('fs');
const Discord = require('discord.js');
const Client = require('./client/Client');
const config = require('./config.json');
const {Player} = require('discord-player');
const {Queue} = require('discord-player');
const {QueryType} = require('discord-player');

// at the top of your file
const {EmbedBuilder} = require('discord.js');
const {ActivityType} = require('discord.js');

const client = new Client();
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
      const command = require(`./commands/${file}`);
      client.commands.set(command.name, command);
}

let ggltoken = "AIzaSyDEHsjFMpdXAkdO3qW6L0h50xfWDjCCRO8"
let previous_songs = [];

console.log(client.commands);

const player = new Player(client);


player.extractors.loadDefault().then(r => console.log('Extractors loaded successfully'))

// Still needs to be refactored for 0.6
/*player.events.on('connection', (queue) => {
    queue.connection.connec.voiceConnection.on('stateChange', (oldState, newState) => {
      const oldNetworking = Reflect.get(oldState, 'networking');
      const newNetworking = Reflect.get(newState, 'networking');

        const networkStateChangeHandler = (oldNetworkState, newNetworkState) => {
            const newUdp = Reflect.get(newNetworkState, 'udp');
            clearInterval(newUdp?.keepAliveInterval);
        }

        oldNetworking?.off('stateChange', networkStateChangeHandler);
        newNetworking?.on('stateChange', networkStateChangeHandler);
    });
});*/

player.events.on('audioTrackAdd', (queue, song) => {
    queue.metadata.channel.send(`🎶 | Song **${song.title}** added to the queue!`);
    previous_songs.push(song.url.split('?v=')[1]);
});

player.events.on('playerStart', (queue, track) => {
    // queue.metadata.channel.send(`▶ | Started playing: **${track.title}**!`);
    const exampleEmbed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(track.title)
    .addFields({
        name: '▶ | Now playing', value: 'Author: **' + track.author + '**\nDuration: **' + track.duration + '**'
    },)
    // .setThumbnail(track.thumbnail)
    .setURL(track.url)
    .setFooter({
        text: 'Requested by: ' + track.requestedBy.username,
        iconURL: track.requestedBy.username === "Fleurtje" ? "https://cdn.discordapp.com/app-icons/266301504460161024/edc729aea5b590bee18a57ccb63d5080.png?size=256" : track.requestedBy.avatarURL()
    });
queue.metadata.channel.send({embeds: [exampleEmbed]});
});

player.events.on('audioTracksAdd', (queue, track) => {
    queue.metadata.channel.send(`🎶 | Tracks have been queued!`);
});

player.events.on('disconnect', queue => {
    queue.metadata.channel.send('❌ | I was manually disconnected from the voice channel, clearing queue!');
});

player.on('trackAdd', (queue, track) => {
  queue.metadata.send(`🎶 | Track **${track.title}** queued!`);
});

player.events.on('emptyQueue', queue => {
    queue.metadata.channel.send('✅ | Queue finished!');
    // console.log(`https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${previous_songs[previous_songs.length - 1]}&type=video&key=` + ggltoken)
    // fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${previous_songs[previous_songs.length - 1]}&type=video&key=` + ggltoken)
    //     .then(response => response.json())
    //     .then(data => {
    //       for (item in data.items) {
    //         console.log(data.items[item].id.videoId)
    //         if (!previous_songs.includes(data.items[item].id.videoId)) {
    //             let toPlay = data.items[item].id.videoId
    //             player.search(toPlay, {
    //                     requestedBy: client.user, searchEngine: QueryType.AUTO,
    //                 })
    //                 .then(data => {
    //                     queue.addTrack(data.tracks[0])
    //                     queue.next()
    //                 })
    //                 break;
    //         }
    //     }
    //   })
    //   .catch(error => console.error(error));
});

player.events.on('error', (queue, error) => {
    console.log(`[${queue.guild.name}] Error emitted from the connection: ${error.message}`);
});

// For debugging
/*player.on('debug', async (message) => {
    console.log(`General player debug event: ${message}`);
});

//data['items'][0]['id']['videoId'])

player.events.on('debug', async (queue, message) => {
    console.log(`Player debug event: ${message}`);
});

player.events.on('playerError', (queue, error) => {
    console.log(`Player error event: ${error.message}`);
    console.log(error);
});*/

client.on('ready', function () {
    console.log('Ready!');
    client.user.presence.set({
        activities: [{name: config.activity, type: Number(config.activityType)}],
        status: Discord.Status.Ready
    })
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
            command.execute(interaction);
        }
    } catch (error) {
        console.error(error);
        await interaction.followUp({
            content: 'There was an error trying to execute that command!',
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
