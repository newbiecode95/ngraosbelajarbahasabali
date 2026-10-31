import { describe,it,expect } from 'vitest';
import { createVoiceActivity } from '../src/lib/voice-activity';
describe('voice turns',()=>{
  it('waits through a short pause and ends after a full pause following speech',()=>{
    const activity=createVoiceActivity();
    for(let ms=50;ms<=800;ms+=50)expect(activity(.08,ms)).toBe('listening');
    expect(activity(.001,1500)).toBe('listening');
    expect(activity(.001,2300)).toBe('finished');
  });
  it('does not send silence or a short click as speech',()=>{
    const activity=createVoiceActivity();activity(.2,50);
    expect(activity(0,8000)).toBe('listening');expect(activity(0,9000)).toBe('silent');
  });
});
