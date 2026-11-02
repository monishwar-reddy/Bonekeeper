import { Message, UserRole } from '../core/types';
import { v4 as uuidv4 } from 'uuid';

export function buildHumanMessage(text: string, role: UserRole, name = 'You'): Message {
  const links = text.match(/https?:\/\/[^\s]+|(?:^|\s)(?:[a-z0-9-]+\.)+(?:com|org|net|io|xyz|tk|ml|ga|cf|click|top|work|zip)\b/gi)
    ?.map(link => link.trim()) || [];
  return {
    id: uuidv4(), platform: 'simulated', groupId: 'halloween-dev-club',
    sender: { id:'human', name, role, joinedAt: new Date(Date.now()-7_200_000), isBot:false, warnings:0 },
    text, links, isForwarded:false, timestamp: new Date(),
  };
}
