import {describe,it,expect} from 'vitest';
import {pcmToWav} from '../src/server/openrouter';
describe('PCM audio container',()=>{
  it('wraps Gemini PCM in a playable mono 24kHz WAV container',()=>{
    const audio=Buffer.alloc(48000);const wav=pcmToWav(audio);
    expect(wav.subarray(0,4).toString()).toBe('RIFF');expect(wav.subarray(8,12).toString()).toBe('WAVE');
    expect(wav.readUInt32LE(24)).toBe(24000);expect(wav.readUInt32LE(40)).toBe(48000);expect(wav.length).toBe(48044);
    expect(pcmToWav(wav)).toBe(wav);
  });
  it('rejects empty or truncated PCM',()=>{expect(()=>pcmToWav(Buffer.alloc(0))).toThrow();expect(()=>pcmToWav(Buffer.alloc(3))).toThrow();});
});
