import { createReadStream } from "fs";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
  getVoiceConnection,
  demuxProbe,
} from "@discordjs/voice";

const recentWelcomes = new Map();
const COOLDOWN_MS = 15000;

async function textToMp3(text, outPath) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ar&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`TTS fetch failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buffer);
}

export async function playAiWelcome(guild, voiceChannel, memberId) {
  const key = `${guild.id}-${memberId}`;
  const last = recentWelcomes.get(key);
  if (last && Date.now() - last < COOLDOWN_MS) return;
  recentWelcomes.set(key, Date.now());

  const text = "مرحبا بك في dark secret area";
  const filePath = join(process.cwd(), `welcome-${memberId}-${Date.now()}.mp3`);

  try {
    await textToMp3(text, filePath);

    const existing = getVoiceConnection(guild.id);
    if (existing) existing.destroy();

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 15000);

    const stream = createReadStream(filePath);
    const { stream: probed, type } = await demuxProbe(stream);
    const resource = createAudioResource(probed, {
      inputType: type,
      inlineVolume: true,
    });

    const player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);

    await entersState(player, AudioPlayerStatus.Playing, 10000).catch(() => {});
    await entersState(player, AudioPlayerStatus.Idle, 30000).catch(() => {});

    connection.destroy();
  } catch (err) {
    console.error("AI welcome voice error:", err.message);
  } finally {
    await unlink(filePath).catch(() => {});
  }
}
