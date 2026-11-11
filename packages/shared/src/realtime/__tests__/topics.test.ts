import { describe, expect, it } from 'vitest';
import { chatTopic, realtimeEvents } from '../topics';

describe('shared chat Broadcast contract', () => {
  it('uses the same private topic for typing and read hints', () => {
    expect(chatTopic('chat-123')).toBe('chat:chat-123');
    expect(realtimeEvents).toEqual({ typing: 'typing', read: 'read' });
  });
});
