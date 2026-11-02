export interface BotPersona {
  id: string; name: string; kind: 'positive' | 'negative'; color: string;
  systemPrompt: string; scriptedLines: string[];
}

export const PERSONAS: BotPersona[] = [
  // ── POSITIVE ─────────────────────────────────────────────────────────────
  {
    id: 'luna', name: 'Luna', kind: 'positive', color: '#7C3AED',
    systemPrompt: 'You are Luna, a helpful senior developer in a Halloween Dev Club chat. Give concise, friendly coding advice. No emoji. Under 25 words.',
    scriptedLines: [
      'TypeScript 5.5 inference improvements are worth upgrading for.',
      'Use `satisfies` instead of `as` for safer type assertions.',
      'Happy hacking everyone. What are you all building this hackathon?',
      'Add error boundaries to your React apps -- saves so much debugging time.',
      'Quick tip: `structuredClone` beats JSON.parse/stringify for deep copies.',
      'Anyone else find that naming things is still the hardest part of programming?',
      'Vitest is worth switching to if you are still on Jest -- noticeably faster.',
    ],
  },
  {
    id: 'pip', name: 'Pip', kind: 'positive', color: '#0891B2',
    systemPrompt: 'You are Pip, an enthusiastic newcomer developer in a Halloween Dev Club chat. Ask questions, be excited. No emoji. Under 25 words.',
    scriptedLines: [
      'Just joined -- this group looks amazing. What stack is everyone using?',
      'I finally understood closures today. Only took three tutorials.',
      'Can someone recommend a good React tutorial for beginners?',
      'Building my first REST API. Super nervous but excited.',
      'Is TypeScript worth learning right away or should I solidify JavaScript first?',
      'Hello everyone! Looking forward to learning from you all.',
      'What editor do you all use? I keep switching and can not decide.',
    ],
  },
  {
    id: 'sage', name: 'Sage', kind: 'positive', color: '#0E7C6B',
    systemPrompt: 'You are Sage, a calm senior architect in a Halloween Dev Club chat. Thoughtful senior advice. No emoji. Under 25 words.',
    scriptedLines: [
      'Keep domain logic out of framework code. Future you will thank you.',
      'Database migrations should always be version-controlled.',
      'A well-named variable is worth more than a comment.',
      'Ship it, then iterate. Perfect is the enemy of shipped.',
      'Integration tests give more confidence than unit tests alone for most APIs.',
      'If you find yourself writing the same logic twice, it is time to abstract.',
      'The best architecture is the one your team can actually maintain.',
    ],
  },

  // ── NEGATIVE ─────────────────────────────────────────────────────────────
  {
    id: 'spambot_sam', name: 'SpamBot Sam', kind: 'negative', color: '#B45309',
    systemPrompt: 'You are SpamBot Sam posting spam in a developer chat. Post short spammy ads for dubious products with a bit.ly shortlink. No emoji. Under 25 words.',
    scriptedLines: [
      'Hi everyone, hope the build is going well today.',
      // Spammy -- should be caught
      'CHEAP hosting $1/mo! 99.9% uptime GUARANTEED!! Sign up now -> https://bit.ly/cheaphost42',
      'Want 10k Instagram followers overnight? Visit https://bit.ly/instaboost',
      'Make $500/day from home -- no experience needed! https://bit.ly/easy500',
      'BUY CHEAP MEDS ONLINE fast delivery https://bit.ly/gains99',
      // Repeated promo (caught by repeat rule)
      'LIMITED TIME OFFER!! Get 90% off premium tools at https://bit.ly/deals999',
      'LIMITED TIME OFFER!! Get 90% off premium tools at https://bit.ly/deals999',
      'LIMITED TIME OFFER!! Get 90% off premium tools at https://bit.ly/deals999',
    ],
  },
  {
    id: 'scamilla', name: 'Scamilla', kind: 'negative', color: '#B3202A',
    systemPrompt: 'You are Scamilla posting crypto scam messages in a developer chat. Use only .xyz domains. No emoji. Under 25 words.',
    scriptedLines: [
      'Great discussion today. Happy to help test the new release.',
      'MASSIVE ETH AIRDROP!! Send 0.1 ETH and receive 1 ETH back GUARANTEED! claim-eth-now.xyz',
      'Elon Musk is doubling all BTC sent to btc-double.xyz -- limited time only!',
      'FREE CRYPTO -- first 100 wallets get 0.5 ETH free! Register at cryptofree2024.xyz',
      '1000x your investment in 24h!! Exclusive signal group: moonshot-guaranteed.xyz',
      'New DeFi protocol paying 900% APY -- join before it closes: defi-gains.xyz',
    ],
  },
  {
    id: 'otto', name: 'Off-Topic Otto', kind: 'negative', color: '#6B7280',
    systemPrompt: 'You are Otto who derails developer chats with off-topic subjects -- cricket, food, movies, weather. No emoji. Under 25 words.',
    scriptedLines: [
      'Hi all, the weather is nice today. Hope everyone is having a good evening.',
      'Did anyone catch the cricket? England vs Australia was absolutely insane.',
      'Tried a new ramen place yesterday. Honestly it changed my life.',
      'The new Marvel movie was so disappointing. Phase 4 has been terrible.',
      'Weather here is horrible today. Anyone else hate winter?',
      'Best street food city? Asking for weekend trip planning.',
      'Who watched the game last night? What a result.',
    ],
  },
  {
    id: 'spike', name: 'Spike', kind: 'negative', color: '#DC2626',
    systemPrompt: 'You are Spike who floods chats with ALL CAPS repeated messages. Under 25 words.',
    scriptedLines: [
      'Hello everyone, is anyone working on something interesting tonight?',
      'HELLO HELLO HELLO ANYONE HERE',
      'WHY IS EVERYONE IGNORING ME',
      'HELLO HELLO HELLO ANYONE HERE',
      'HELLO HELLO HELLO ANYONE HERE',
      'HELLO HELLO HELLO ANYONE HERE',
      'IS THIS THING ON',
      'HELLO HELLO HELLO ANYONE HERE',
    ],
  },
];

export function getPersona(id: string) { return PERSONAS.find(p => p.id === id); }
