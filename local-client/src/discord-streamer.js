const { Client, GatewayIntentBits } = require('discord.js');
const { 
  createAudioPlayer, 
  createAudioResource, 
  joinVoiceChannel, 
  AudioPlayerStatus, 
  StreamType,
  VoiceConnectionStatus,
  generateDependencyReport
} = require('@discordjs/voice');
const { PassThrough } = require('stream');

class DiscordStreamer {
  constructor() {
    this.client = null;
    this.connection = null;
    this.audioPlayer = null;
    this.audioStream = null;
    this.connected = false;
    this.streaming = false;
    this.audioBuffer = [];
    this.processInterval = null;
    this.currentStream = null;
    this.isProcessing = false;
  }

  async connect(botToken, guildId, channelId) {
    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates,
        ],
      });

      await this.client.login(botToken);
      
      await new Promise((resolve, reject) => {
        this.client.once('ready', resolve);
        this.client.once('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      });

      let guild;
      try {
        guild = await this.client.guilds.fetch(guildId);
      } catch (error) {
        throw new Error(`Guild not found or bot not in guild: ${guildId}`);
      }

      await guild.channels.fetch();
      const channel = guild.channels.cache.get(channelId);
      
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }
      
      if (!channel.isVoiceBased()) {
        throw new Error(`Channel is not a voice channel: ${channel.name} (type: ${channel.type})`);
      }

      const permissions = channel.permissionsFor(this.client.user);
      if (!permissions.has('Connect')) {
        throw new Error('Bot does not have CONNECT permission in this channel');
      }
      if (!permissions.has('Speak')) {
        throw new Error('Bot does not have SPEAK permission in this channel');
      }

      this.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });

      await new Promise((resolve, reject) => {
        this.connection.once(VoiceConnectionStatus.Ready, resolve);
        this.connection.once(VoiceConnectionStatus.Failed, reject);
      });

      this.audioPlayer = createAudioPlayer();
      this.connection.subscribe(this.audioPlayer);

      this.audioPlayer.on('error', error => {
        console.error('Audio player error:', error);
        this.streaming = false;
      });

      this.startProcessing();
      this.connected = true;
      
      return true;
    } catch (error) {
      console.error('Discord connection error:', error);
      this.disconnect();
      throw error;
    }
  }

  async disconnect() {
    this.stopStream();

    if (this.audioPlayer) {
      this.audioPlayer.stop();
      this.audioPlayer = null;
    }

    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }

    if (this.audioStream) {
      this.audioStream.destroy();
      this.audioStream = null;
    }

    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }

    this.connected = false;
    this.streaming = false;
    this.audioBuffer = [];
  }

  sendAudio(audioData) {
    if (!this.connected) {
      return;
    }

    try {
      this.audioBuffer.push(audioData);
      
      if (!this.currentStream && this.audioBuffer.length >= 1) {
        this.startContinuousStream();
      }
    } catch (error) {
      console.error('Error buffering audio:', error);
    }
  }

  startProcessing() {
  }
  
  startContinuousStream() {
    if (this.currentStream || !this.connected || !this.audioPlayer) {
      return;
    }
    
    this.currentStream = new PassThrough();
    
    const resource = createAudioResource(this.currentStream, {
      inputType: StreamType.WebmOpus,
      inlineVolume: true
    });
    
    resource.volume.setVolume(1.0);
    
    this.audioPlayer.play(resource);
    this.streaming = true;
    
    this.drainBufferToStream();
  }
  
  async drainBufferToStream() {
    if (!this.currentStream) return;
    
    this.isProcessing = true;
    
    while (this.audioBuffer.length > 0 && this.currentStream) {
      const chunk = this.audioBuffer.shift();
      const buffer = Buffer.from(chunk, 'base64');
      
      if (!this.currentStream.write(buffer)) {
        await new Promise(resolve => this.currentStream.once('drain', resolve));
      }
    }
    
    if (this.currentStream) {
      setTimeout(() => this.drainBufferToStream(), 100);
    }
    
    this.isProcessing = false;
  }

  stopStream() {
    if (this.currentStream) {
      this.currentStream.end();
      this.currentStream = null;
    }
    
    if (this.audioPlayer) {
      this.audioPlayer.stop();
    }
    
    this.streaming = false;
    this.audioBuffer = [];
  }

  isConnected() {
    return this.connected;
  }

  isStreaming() {
    return this.streaming;
  }
}

module.exports = DiscordStreamer;