import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Users, Trophy, ThumbsUp, ThumbsDown, MessageCircle, Send, Zap, Crown, Siren as Fire, Brain, Laugh, Clock, Vote, TrendingUp, Shuffle, History, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { debateService } from '../services/debateService';
import { aiService } from '../services/aiService';

interface DebateClubProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DebateMessage {
  id: string;
  speaker: 'ai1' | 'ai2' | 'user' | 'moderator';
  content: string;
  timestamp: Date;
  model?: string;
  reactions?: { [emoji: string]: number };
  userReaction?: string;
}

interface DebateSession {
  id: string;
  topic: string;
  ai1Model: string;
  ai2Model: string;
  ai1Position: string;
  ai2Position: string;
  status: 'setup' | 'opening' | 'debate' | 'closing' | 'finished';
  currentTurn: 'ai1' | 'ai2';
  messages: DebateMessage[];
  votes: { ai1: number; ai2: number };
  userVote?: 'ai1' | 'ai2';
  winner?: 'ai1' | 'ai2' | 'tie';
  createdAt: Date;
  turnCount: number;
}

interface DebateStats {
  totalDebates: number;
  modelWins: { [model: string]: number };
  topTopics: string[];
  userParticipation: number;
}

const DEBATE_TOPICS = [
  "Is artificial intelligence a threat to humanity?",
  "Should social media be regulated by governments?",
  "Is remote work better than office work?",
  "Should we colonize Mars?",
  "Is cryptocurrency the future of money?",
  "Should we ban single-use plastics?",
  "Is TikTok harmful to society?",
  "Should we have universal basic income?",
  "Is nuclear energy the solution to climate change?",
  "Should we edit human genes?",
  "Is pineapple on pizza acceptable?",
  "Are cats better than dogs?",
  "Should we have a 4-day work week?",
  "Is the metaverse the future of the internet?",
  "Should we tax billionaires more?"
];

const AVAILABLE_MODELS = [
  { id: 'openai', name: 'GPT-4o', personality: 'Analytical and precise' },
  { id: 'gemini', name: 'Gemini Pro', personality: 'Creative and thoughtful' },
  { id: 'deepseek', name: 'DeepSeek', personality: 'Logical and methodical' }
];

const REACTION_EMOJIS = ['🔥', '🤯', '😂', '👏', '💯', '🎯', '🤔', '😴'];

export const DebateClub: React.FC<DebateClubProps> = ({ isOpen, onClose }) => {
  // ... rest of the component code ...
};