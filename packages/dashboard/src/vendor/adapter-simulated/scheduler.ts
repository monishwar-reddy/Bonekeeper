import { Message, UserRole } from '../core/types';
import { v4 as uuidv4 } from 'uuid';

export function buildHumanMessage(text: string, role: UserRole, name = 'You'): Message {
  return {
    id: uuidv4(), platform: 'simulated', groupId: 'halloween-dev-club',
    sender: { id:'human', name, role, joinedAt: new Date(Date.now()-7_200_000), isBot:false, warnings:0 },
    text, links: text.match(/https?:\/\/[^\s]+/g)||[], isForwarded:false, timestamp: new Date(),
  };
}
